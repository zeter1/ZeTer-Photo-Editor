import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDocument, createShapeLayer, createVectorMask, addLayer, sanitizeProject, snapshotDocument } from '../src/core/state.js';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');

test('vector mask state survives .zpe sanitization with Bezier handles and boolean operations',()=>{
  const doc=createDocument({width:300,height:200});
  addLayer(doc,createShapeLayer({name:'masked',x:20,y:30,width:160,height:100,vectorMask:createVectorMask({invert:true,linked:false,fillStartsWithAllPixels:true,subpaths:[
    {operation:'add',points:[{x:10,y:10},{x:120,y:10,handleIn:{x:90,y:0},handleOut:{x:140,y:20},kind:'smooth'},{x:120,y:80},{x:10,y:80}]},
    {operation:'subtract',points:[{x:40,y:30},{x:80,y:30},{x:80,y:60},{x:40,y:60}]},
    {operation:'intersect',points:[{x:0,y:0},{x:150,y:0},{x:150,y:90},{x:0,y:90}]},
    {operation:'exclude',points:[{x:100,y:40},{x:140,y:40},{x:140,y:70},{x:100,y:70}]},
  ]})}));
  const safe=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  const mask=safe.layers[0].vectorMask;
  assert.equal(mask.enabled,true);assert.equal(mask.invert,true);assert.equal(mask.linked,false);assert.equal(mask.fillStartsWithAllPixels,true);
  assert.deepEqual(mask.subpaths.map(path=>path.operation),['add','subtract','intersect','exclude']);
  assert.deepEqual(mask.subpaths[0].points[1].handleIn,{x:90,y:0});
  assert.deepEqual(mask.subpaths[0].points[1].handleOut,{x:140,y:20});
  assert.equal(mask.subpaths[0].points[1].kind,'smooth');
});

test('vector mask sanitizer drops invalid paths and normalizes unknown operations',()=>{
  const safe=sanitizeProject({version:1,name:'vm',width:100,height:100,background:'transparent',layers:[{id:'a',type:'shape',name:'a',width:50,height:50,vectorMask:{enabled:false,subpaths:[
    {operation:'mystery',points:[{x:0,y:0},{x:50,y:0},{x:50,y:50}]},{operation:'subtract',points:[{x:1,y:1},{x:2,y:2}]},
  ]}}]});
  assert.equal(safe.layers[0].vectorMask.enabled,false);
  assert.equal(safe.layers[0].vectorMask.subpaths.length,1);
  assert.equal(safe.layers[0].vectorMask.subpaths[0].operation,'add');
  assert.equal(safe.layers[0].vectorMask.subpaths[0].closed,true);
  const empty=sanitizeProject({version:1,name:'empty',width:100,height:100,background:'transparent',layers:[{id:'a',type:'shape',name:'a',width:50,height:50,vectorMask:{subpaths:[]}}]});
  assert.equal(empty.layers[0].vectorMask,null);
});

test('Stage 10 UI exposes vector masks and selection-driven boolean path operations',()=>{
  assert.match(main,/function selectionVectorMaskDocumentNodes\(/);
  assert.match(main,/function selectionVectorMaskSubpath\(/);
  assert.match(main,/createVectorMask\(\{enabled:true,invert:false,subpaths:\[subpath\]\}\)/);
  assert.match(main,/applySelectionToVectorMask\('subtract'\)/);
  assert.match(main,/applySelectionToVectorMask\('intersect'\)/);
  assert.match(main,/applySelectionToVectorMask\('exclude'\)/);
  assert.match(main,/const cx=rect\.x\+rect\.width\/2,cy=rect\.y\+rect\.height\/2,rx=rect\.width\/2,ry=rect\.height\/2,k=\.5522847498307936/);
  assert.match(main,/function importPsdVectorMask\(/);
  assert.match(main,/function exportPsdVectorMask\(/);
  assert.match(main,/preview\.vectorMask=null/);
  assert.match(main,/vectorMask:exportPsdVectorMask\(layer\)/);
});


test('Stage 10c edits vector-mask anchors and handles through the Pen direct-edit pipeline',()=>{
  assert.match(main,/let vectorMaskEditLayerId = null/);
  assert.match(main,/function selectedEditablePathTargets\(\)/);
  assert.match(main,/source:'vector-mask',subpathIndex/);
  assert.match(main,/function pathTargetPoints\(layer,source='shape',subpathIndex=null\)/);
  assert.match(main,/pathSource:hit\.source,subpathIndex:hit\.subpathIndex/);
  assert.match(main,/const points=pathTargetPoints\(layer,drag\.pathSource,drag\.subpathIndex\)/);
  assert.match(main,/function editSelectedVectorMask\(\)/);
  assert.match(main,/Редактировать векторную маску пером/);
  assert.match(main,/vectorMaskEditLayerId===selected\(\)\?\.id/);
});

test('document saved paths survive .zpe sanitization with open/closed Bezier subpaths',()=>{
  const doc=createDocument({width:400,height:300});
  doc.paths=[{id:2007,name:'Cut Path',fillStartsWithAllPixels:false,subpaths:[
    {closed:false,operation:'add',fillRule:'even-odd',points:[
      {x:10,y:20,handleOut:{x:30,y:5},kind:'corner'},
      {x:100,y:80,handleIn:{x:70,y:90},kind:'smooth'},
    ]},
  ]}];
  const safe=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.equal(safe.paths.length,1);
  assert.equal(safe.paths[0].id,2007);
  assert.equal(safe.paths[0].subpaths[0].closed,false);
  assert.equal(safe.paths[0].subpaths[0].fillRule,'even-odd');
  assert.deepEqual(safe.paths[0].subpaths[0].points[0].handleOut,{x:30,y:5});
});
