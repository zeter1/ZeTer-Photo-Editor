import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bytesToDataUrl } from '../src/core/io.js';
import { decodePsd } from '../src/formats/psd.js';
import {
  psdAdjustmentNativePlan, psdEmbeddedDocumentFingerprint, psdPreviewFingerprint,
  psdShapeNativePlan, psdSmartObjectMetadataForExport, psdSmartObjectRoundTripPlan, psdTextNativePlan,
} from '../src/document/psd-native-metadata-plans.js';

const textFixture=new URL('./fixtures/photoshop-text/psd-tools-type-layer.psd',import.meta.url);
const shapeFixture=new URL('./fixtures/photoshop-shapes/psd-tools-shape-layer.psd',import.meta.url);
const adjustmentFixture=new URL('./fixtures/photoshop-adjustments/brightness-contrast.psd',import.meta.url);
const blockState=block=>({signature:block.signature==='8B64'?'8B64':'8BIM',key:block.key,dataUrl:bytesToDataUrl(block.data,'application/octet-stream')});

test('text native plan rewrites a real editable TySh fixture and rejects typography drift',async()=>{
  const decoded=await decodePsd(new Uint8Array(await readFile(textFixture)),{maxPixels:2_000_000,maxLayers:50});
  const source=decoded.layers[0],typography=source.psdText.parsed.typography||{};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const importedStyle={
    fontFamily:typography.fontFamily||'Arial, sans-serif',
    fontSize:clamp(Number(typography.fontSize)||Math.round(source.height*.8)||18,6,500),
    fontWeight:typography.fontWeight==='700'?'700':'400',
    fontStyle:typography.fontStyle==='italic'?'italic':'normal',
    align:['left','center','right'].includes(typography.align)?typography.align:'left',
    lineHeight:clamp(Number(typography.lineHeight)||1.18,.8,3),
    letterSpacing:clamp(Number(typography.letterSpacing)||0,-5,20),
    underline:typography.underline===true,
    strikeThrough:typography.strikeThrough===true,
    color:typography.color||'#000000',
  };
  const baseline={
    x:source.x,y:source.y,width:source.width,height:source.height,scaleX:1,scaleY:1,rotation:0,
    text:source.psdText.parsed.text,...importedStyle,
  };
  const layer={
    type:'text',...baseline,x:baseline.x+7,y:baseline.y-3,text:'Hello\nWorld',filters:{},styles:null,
    psdText:{signature:source.psdText.signature,dataUrl:bytesToDataUrl(source.psdText.data,'application/octet-stream'),parsed:structuredClone(source.psdText.parsed),baseline},
  };
  const plan=psdTextNativePlan(layer);
  assert.equal(plan.eligible,true);assert.equal(plan.block.key,'TySh');assert.ok(plan.block.data instanceof Uint8Array);
  assert.deepEqual(plan.bounds,{
    x:Math.round(baseline.x+7),y:Math.round(baseline.y-3),
    width:Math.max(1,Math.round(baseline.width)),height:Math.max(1,Math.round(baseline.height)),
  });
  const changed=psdTextNativePlan({...layer,fontSize:layer.fontSize+1});
  assert.equal(changed.eligible,false);assert.match(changed.reason,/typography/);
});

test('shape native plan rewrites real solid fill/stroke blocks and rejects geometry drift',async()=>{
  const decoded=await decodePsd(new Uint8Array(await readFile(shapeFixture)),{maxPixels:2_000_000,maxLayers:50});
  const source=decoded.layers[0],sourcePath=source.vectorMask.subpaths[0];
  const localize=point=>point?{...point,x:point.x-source.x,y:point.y-source.y}:null;
  const pathPoints=sourcePath.points.map(node=>({x:node.x-source.x,y:node.y-source.y,handleIn:localize(node.handleIn),handleOut:localize(node.handleOut),kind:node.kind}));
  const baseline={fill:source.psdShape.fill,stroke:source.psdShape.stroke,strokeWidth:source.psdShape.strokeWidth,pathClosed:true,width:source.width,height:source.height,scaleX:1,scaleY:1,rotation:0};
  const layer={
    type:'shape',shape:'path',pathClosed:true,pathPoints,x:source.x,y:source.y,width:source.width,height:source.height,scaleX:1,scaleY:1,rotation:0,
    fill:'#112233',stroke:'#445566',strokeWidth:3.5,filters:{},styles:null,
    psdShape:{...structuredClone(source.psdShape),blocks:source.psdShape.blocks.map(blockState),baseline},
  };
  const plan=psdShapeNativePlan(layer);
  assert.equal(plan.eligible,true);assert.equal(plan.metadata.fill,'#112233');assert.equal(plan.metadata.stroke,'#445566');assert.equal(plan.metadata.strokeWidth,3.5);
  assert.ok(plan.metadata.blocks.every(block=>block.data instanceof Uint8Array));assert.equal(plan.vectorMask.subpaths[0].points.length,pathPoints.length);
  assert.ok(Math.abs(plan.vectorMask.subpaths[0].points[0].x-sourcePath.points[0].x)<1e-9);
  const changed=psdShapeNativePlan({...layer,rotation:5});
  assert.equal(changed.eligible,false);assert.match(changed.reason,/resize\/scale\/rotation/);
});

test('adjustment native plan rewrites a real Photoshop block and keeps raster fallback explicit',async()=>{
  const decoded=await decodePsd(new Uint8Array(await readFile(adjustmentFixture)),{maxPixels:2_000_000,maxLayers:50});
  const source=decoded.adjustmentLayers[0];
  const layer={
    type:'adjustment',adjustment:{kind:'brightness-contrast',brightness:23,contrast:70,legacy:false},filters:{},styles:null,
    psdAdjustment:{kind:source.psdAdjustment.kind,blocks:source.psdAdjustment.blocks.map(blockState),channelIds:source.channelIds},
  };
  const plan=psdAdjustmentNativePlan(layer);
  assert.equal(plan.eligible,true);assert.equal(plan.metadata.kind,'brightness-contrast');assert.ok(plan.metadata.blocks.every(block=>block.data instanceof Uint8Array));
  assert.deepEqual(plan.metadata.channelIds,source.channelIds);
  const changed=psdAdjustmentNativePlan({...layer,styles:{dropShadow:{}}});
  assert.equal(changed.eligible,false);assert.match(changed.reason,/layer styles/);
});

test('smart-object native plan preserves opaque identity only while baseline invariants hold',()=>{
  const previewDataUrl='data:image/png;base64,AA==';
  const embeddedDocument={name:'Nested',width:2,height:3,createdAt:'a',updatedAt:'b',layers:[],groups:[]};
  const layer={
    type:'smart-object',name:'Placed',x:10,y:20,width:30,height:40,scaleX:1,scaleY:1,rotation:0,filters:{},styles:null,smartFilters:[],smartFilterMask:null,
    previewDataUrl,embeddedDocument,
    psdSmartObject:{
      kind:'embedded',uniqueId:'asset-1',placedVersion:3,placedTransform:[0,0,1,0,1,1,0,1],descriptor:{classId:'null',items:{}},asset:{filename:'nested.psd',type:'psd'},
      baseline:{x:10,y:20,width:30,height:40,scaleX:1,scaleY:1,rotation:0,previewFingerprint:psdPreviewFingerprint(previewDataUrl),embeddedFingerprint:psdEmbeddedDocumentFingerprint(embeddedDocument)},
      blocks:[{signature:'8BIM',key:'SoLd',dataUrl:'data:application/octet-stream;base64,AQID'}],
    },
  };
  const doc={layers:[layer],psdSmartObjectSourceCount:1,psdLinkedLayerBlocks:[{signature:'8BIM',key:'lnkD',dataUrl:'data:application/octet-stream;base64,BAUG'}]};
  const plan=psdSmartObjectRoundTripPlan(doc);
  assert.equal(plan.eligible,true);assert.equal(plan.linkedLayerBlocks.length,1);assert.ok(plan.linkedLayerBlocks[0].data instanceof Uint8Array);
  const metadata=psdSmartObjectMetadataForExport(layer);
  assert.equal(metadata.uniqueId,'asset-1');assert.ok(metadata.blocks[0].data instanceof Uint8Array);
  const changed=psdSmartObjectRoundTripPlan({...doc,layers:[{...layer,x:11}]});
  assert.equal(changed.eligible,false);assert.match(changed.reason,/трансформирован/);
});
