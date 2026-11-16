import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/dng-fixture.mjs';
import {createDocument, createRasterLayer, addLayer, checkedCanvasSize,
  snapshotDocument, sanitizeProject} from '../src/core/state.js';
import {bytesToDataUrl} from '../src/core/io.js';
import {inspectDng, developDng} from '../src/formats/dng.js';
import {createDocumentImportController} from '../src/document/import-controller.js';

function harness(){
  const doc=createDocument({width:8,height:8});
  let current=doc,session=1;
  const statuses=[],toasts=[],commits=[],previews=[];
  const c=createDocumentImportController({
    getDocument:()=>current,
    getActiveSessionId:()=>session,
    isPsdFile:()=>false,
    readFileAsDataURL:async()=> 'data:image/png;base64,aGVsbG8=',
    dimensionsFromDataUrl:async()=>({width:3,height:3}),
    inspectDng,developDng,
    bytesToDataUrl,
    rgbaPixelsToDataUrl:async(width,height,rgba)=>{
      assert.equal(rgba.length,width*height*4);
      previews.push({width,height,first:rgba.slice(0,4)});
      return 'data:image/png;base64,AAAA';
    },
    checkedCanvasSize,createRasterLayer,addLayer,
    blockPendingDocumentEdit:()=>false,
    commit:label=>commits.push({label,doc:snapshotDocument(current)}),
    setStatus:message=>statuses.push(message),
    toast:(message,kind)=>toasts.push([message,kind]),
    fitToView:()=>{},visibleCanvasCenter:()=>({x:4,y:4}),
    openPsd:async()=>{},openProject:async()=>{},
  });
  return {doc,c,commits,previews,statuses,toasts,
    changeSession:()=>{session++;}, changeDocument:()=>{current=createDocument({name:'Other'});}};
}
function dngFile(buffer=fixture()){
  return {name:'sensor.dng',type:'image/x-adobe-dng',
    arrayBuffer:async()=>buffer};
}
test('real DNG bytes → layered raster preview + immutable RAW in .zpe sanitized snapshot',async()=>{
  const h=harness();
  assert.ok(h.c.isImageFile(dngFile()));
  assert.equal(await h.c.importImages([dngFile()]),1);
  assert.equal(h.commits.length,1);
  assert.equal(h.previews[0].width,4);
  const layer=h.doc.layers[0];
  assert.equal(layer.type,'raster');
  assert.equal(layer.width,4);
  assert.ok(layer.rawDng.dataUrl.startsWith('data:application/x-adobe-dng;base64,'));
  assert.deepEqual(layer.rawDng.development,{exposure:0,wbRed:1,wbBlue:1});
  assert.deepEqual(sanitizeProject(JSON.parse(h.commits[0].doc)).layers[0].rawDng,layer.rawDng);
});
test('unsupported compressed DNG aborts atomically; other images still work',async()=>{
  const h=harness();
  assert.equal(await h.c.importImages([dngFile(fixture({compression:7}))]),0);
  assert.equal(h.doc.layers.length,0);
  assert.equal(h.commits.length,0);
  assert.match(h.toasts.at(-1)[0],/сжатые DNG/);
  assert.equal(await h.c.importImages([{name:'regular.png',type:'image/png'}]),1);
  assert.equal(h.doc.layers[0].rawDng,undefined);
});
test('stale document/session while RAW is loading produces no layer and no History',async()=>{
  const h=harness();
  let done;
  const promise=new Promise(resolve=>{done=resolve;});
  const loading=h.c.importImages([{name:'stale.dng',arrayBuffer:()=>promise}]);
  h.changeSession();
  done(fixture());
  assert.equal(await loading,0);
  assert.equal(h.doc.layers.length,0);
  assert.equal(h.commits.length,0);
});

test('RAW bytes and camera dimensions survive separate raster transform and project sanitize',async()=>{
  const h=harness();
  await h.c.importImages([dngFile()]);
  const layer=h.doc.layers[0];
  layer.width=8;
  layer.height=8;
  const reopened=sanitizeProject(JSON.parse(snapshotDocument(h.doc)));
  assert.equal(reopened.layers[0].width,8);
  assert.equal(reopened.layers[0].height,8);
  assert.equal(reopened.layers[0].rawDng.width,4);
  assert.equal(reopened.layers[0].rawDng.height,4);
  assert.equal(reopened.layers[0].rawDng.dataUrl,layer.rawDng.dataUrl);
});
