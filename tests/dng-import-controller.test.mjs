import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/dng-fixture.mjs';
import {losslessJpegDngFixture} from './fixtures/dng-lossless-jpeg-fixture.mjs';
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
  assert.deepEqual(layer.rawDng.development,{exposure:0,wbRed:1,wbBlue:1,highlights:0,shadows:0,contrast:0});
  assert.deepEqual(sanitizeProject(JSON.parse(h.commits[0].doc)).layers[0].rawDng,layer.rawDng);
});
test('non-unit RAW DefaultScale persists source geometry, provenance and actual raster pixels in .zpe',async()=>{
  const h=harness();
  const raw=fixture({width:8,height:6,activeArea:[1,1,6,7],
    defaultCropOrigin:[1,1],defaultCropSize:[4,3],defaultScale:[2,1],orientation:6});
  assert.equal(await h.c.importImages([dngFile(raw)]),1);
  assert.deepEqual([h.previews[0].width,h.previews[0].height],[3,8]);
  const layer=h.doc.layers[0];
  assert.deepEqual([layer.width,layer.height],[3,8]);
  assert.deepEqual(layer.rawDng.defaultScale,[2,1]);
  assert.deepEqual([layer.rawDng.width,layer.rawDng.height],[8,6]);
  assert.equal(layer.rawDng.dataUrl,bytesToDataUrl(raw,'application/x-adobe-dng'));
  const project=sanitizeProject(JSON.parse(snapshotDocument(h.doc)));
  assert.deepEqual(project.layers[0].rawDng,layer.rawDng);
  const legacy={...layer.rawDng};
  delete legacy.defaultScale;
  assert.deepEqual(sanitizeProject({...project,layers:[{...project.layers[0],rawDng:legacy}]}).layers[0].rawDng.defaultScale,[1,1]);
});

test('unsupported compressed DNG aborts atomically; other images still work',async()=>{
  const h=harness();
  assert.equal(await h.c.importImages([dngFile(fixture({compression:7}))]),0);
  assert.equal(h.doc.layers.length,0);
  assert.equal(h.commits.length,0);
  assert.match(h.toasts.at(-1)[0],/lossless JPEG/);
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

test('DNG ActiveArea/Orientation preview dimensions differ from immutable sensor dimensions',async()=>{
  const h=harness();
  const source=fixture({width:6,height:4,activeArea:[1,1,4,5],orientation:6});
  assert.equal(await h.c.importImages([dngFile(source)]),1);
  assert.deepEqual([h.previews[0].width,h.previews[0].height],[3,4]);
  const layer=h.doc.layers[0];
  assert.deepEqual([layer.width,layer.height],[3,4]);
  assert.deepEqual([layer.rawDng.width,layer.rawDng.height],[6,4]);
  assert.deepEqual(sanitizeProject(JSON.parse(snapshotDocument(h.doc))).layers[0].rawDng,layer.rawDng);
});


test('calibrated RAW import stores rendering provenance and survives .zpe serialization',async()=>{
  const h=harness();
  const original=fixture({matrix1:[0.9,0.1,0,0.1,1,0,0,0.1,1],illuminant1:21,baselineExposure:0.5});
  assert.equal(await h.c.importImages([dngFile(original)]),1);
  const layer=h.doc.layers[0];
  assert.equal(layer.rawDng.colorPipeline,'matrix-d50-bradford-v1');
  assert.equal(layer.rawDng.baselineExposure,0.5,'camera default EV accompanies native DNG source');
  const reopened=sanitizeProject(JSON.parse(snapshotDocument(h.doc)));
  assert.equal(reopened.layers[0].rawDng.colorPipeline,'matrix-d50-bradford-v1');
  assert.equal(reopened.layers[0].rawDng.baselineExposure,0.5);
  assert.equal(reopened.layers[0].rawDng.dataUrl,layer.rawDng.dataUrl);
  assert.deepEqual(reopened.layers[0].rawDng.development,{exposure:0,wbRed:1,wbBlue:1,highlights:0,shadows:0,contrast:0});
});


test('real SOF3 compressed CFA imports to raster, preserves binary .zpe and rejects bad JPEG atomically',async()=>{
  const h=harness();
  const raw=losslessJpegDngFixture({bits:12,orientation:6,samples:[800,400,200]});
  const snapshot=new Uint8Array(raw).slice();
  assert.equal(await h.c.importImages([dngFile(raw)]),1);
  const layer=h.doc.layers[0];
  assert.equal(layer.rawDng.compression,7);
  assert.equal(layer.rawDng.dataUrl,bytesToDataUrl(raw,'application/x-adobe-dng'));
  assert.deepEqual(new Uint8Array(raw),snapshot);
  assert.deepEqual([layer.width,layer.height],[4,4]);
  const reopened=sanitizeProject(JSON.parse(snapshotDocument(h.doc)));
  assert.deepEqual(reopened.layers[0].rawDng,layer.rawDng);
  const legacy={...layer.rawDng};
  delete legacy.compression;
  assert.equal(sanitizeProject({...reopened,layers:[{...reopened.layers[0],rawDng:legacy}]}).layers[0].rawDng.compression,1);
  const failed=harness();
  assert.equal(await failed.c.importImages([dngFile(fixture({compression:7}))]),0);
  assert.equal(failed.doc.layers.length,0);
  assert.equal(failed.commits.length,0);
});


test('packed 12-bit import keeps native CFA and .zpe provenance across sanitization',async()=>{
  const raw=fixture({bits:12,width:4,height:4,whiteLevel:4095,
    samples:(x,y,c)=>400+x*32+y*16+c*300});
  const h=harness();
  assert.equal(await h.c.importImages([dngFile(raw)]),1);
  const layer=h.doc.layers[0];
  assert.equal(layer.rawDng.bits,12);
  assert.equal(layer.rawDng.compression,1);
  assert.deepEqual([...h.previews[0].first],
    [...developDng(inspectDng(raw)).rgba.slice(0,4)]);
  const saved=sanitizeProject(JSON.parse(snapshotDocument(h.doc))).layers[0].rawDng;
  assert.equal(saved.bits,12);
  assert.equal(saved.compression,1);
  assert.equal(saved.dataUrl,bytesToDataUrl(raw,'application/x-adobe-dng'));
  const legacy=JSON.parse(snapshotDocument(h.doc));
  delete legacy.layers[0].rawDng.bits;
  const restored=sanitizeProject(legacy).layers[0].rawDng;
  assert.equal(restored.bits,null);
  assert.equal(restored.compression,1);
  assert.equal(restored.dataUrl,saved.dataUrl);
});
