import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, createSerializedPixelBufferTileWorkingSet, deserializePixelBufferSource, serializeTiledPixelBufferSource } from '../src/core/pixel-buffer.js';
import { createRetouchController } from '../src/retouch/controller.js';

function harness({buffer=null,workingSet=null,brushCanvas=null,brushContext=null}={}) {
  let previewDirty=0, previewScheduled=0;
  const drag={
    toneCoverage:{width:Math.max(1,workingSet?.width||buffer?.width||brushCanvas?.width||1),tiles:new Map()},
    blurCoverage:{width:Math.max(1,workingSet?.width||buffer?.width||brushCanvas?.width||1),tiles:new Map()},
  };
  const controller=createRetouchController({
    getBrushCanvas:()=>brushCanvas,
    getBrushContext:()=>brushContext,
    getDrag:()=>drag,
    getHighDepthPaintBuffer:()=>buffer,
    getHighDepthPaintWorkingSet:()=>workingSet,
    getHighDepthPaintLayerId:()=>buffer||workingSet?'layer':null,
    markHighDepthPreviewDirty:()=>{previewDirty+=1;},
    brushWidthForPointer:()=>2,
    rasterSelectionPredicate:()=>null,
    schedulePaintPreview:()=>{previewScheduled+=1;},
    getToolOpacity:()=>1,
    getSmudgeStrength:()=>.5,
    getDodgeStrength:()=>.25,
    getBurnStrength:()=>.25,
    getBlurStrength:()=>.3,
    documentRef:{createElement:()=>{throw new Error('Unexpected Canvas allocation');}},
  });
  return {controller,counts:()=>({previewDirty,previewScheduled})};
}

test('retouch controller owns clone source separately from per-stroke snapshots',()=>{
  const {controller}=harness();
  const source={layerId:'layer',documentPoint:{x:10,y:20},localPoint:{x:3,y:4}};
  controller.setCloneSource(source);
  source.localPoint.x=999;
  assert.deepEqual(controller.getCloneSource(),{
    layerId:'layer',documentPoint:{x:10,y:20},localPoint:{x:3,y:4},
  });
  controller.resetStroke();
  assert.equal(controller.getCloneSource().layerId,'layer');
});

test('Canvas8 dodge routing changes RGB while preserving alpha',()=>{
  const pixels=new Uint8ClampedArray([100,120,140,255]);
  let putCount=0;
  const brushContext={
    getImageData:()=>({data:pixels}),
    putImageData:()=>{putCount+=1;},
  };
  const {controller}=harness({brushCanvas:{width:1,height:1},brushContext});
  assert.equal(controller.applyToneDab({id:'layer'},{x:.5,y:.5},null,true),true);
  assert.ok(pixels[0]>100&&pixels[1]>120&&pixels[2]>140);
  assert.equal(pixels[3],255);
  assert.equal(putCount,1);
});

test('native high-depth tone routing edits typed samples and requests preview',()=>{
  const buffer=createPixelBuffer({
    width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array([10001,20003,30007,65535]),
  });
  const {controller,counts}=harness({buffer});
  assert.equal(controller.applyNativeHighDepthToneDab({id:'layer'},{x:.5,y:.5},null,true),true);
  assert.ok(buffer.data[0]>10001);
  assert.equal(buffer.data[3],65535);
  assert.deepEqual(counts(),{previewDirty:1,previewScheduled:1});
});

test('resetStroke invalidates native clone snapshot but keeps chosen source',()=>{
  const buffer=createPixelBuffer({
    width:2,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([2,1,.5,1,.2,.3,.4,1]),
  });
  const {controller}=harness({buffer});
  controller.setCloneSource({
    layerId:'layer',documentPoint:{x:.5,y:.5},localPoint:{x:.5,y:.5},
  });
  const offset=controller.prepareNativeHighDepthCloneStroke({id:'layer'},{x:1.5,y:.5});
  assert.deepEqual(offset,{x:-1,y:0});
  controller.resetStroke();
  assert.equal(
    controller.applyNativeHighDepthCloneDab({id:'layer'},{x:1.5,y:.5},offset,null,false),
    false,
  );
  assert.equal(controller.getCloneSource().layerId,'layer');
});


test('Stage 17d tiled dodge lazily edits one touched tile and preserves untouched payloads',()=>{
  const source=createPixelBuffer({
    width:4,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array([
      10001,12003,14005,65535, 16007,18009,20011,65535,
      22013,24015,26017,65535, 28019,30021,32023,65535,
    ]),
  });
  const packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  const untouched=packed.tiles[1].dataUrl;
  const workingSet=createSerializedPixelBufferTileWorkingSet(packed);
  const {controller,counts}=harness({workingSet});
  assert.equal(controller.applyNativeHighDepthToneDab({id:'layer'},{x:.5,y:.5},null,true),true);
  assert.equal(workingSet.loadedTileCount,1);
  assert.equal(workingSet.dirtyTileCount,1);
  const next=workingSet.serialize();
  assert.equal(next.tiles[1].dataUrl,untouched);
  assert.ok(deserializePixelBufferSource(next).data[0]>source.data[0]);
  assert.deepEqual(counts(),{previewDirty:1,previewScheduled:1});
});

test('Stage 17d tiled blur reads a cross-tile halo and writes native samples without a full plane',()=>{
  const source=createPixelBuffer({
    width:4,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array([
      0,0,0,65535, 0,0,0,65535,
      65535,65535,65535,65535, 65535,65535,65535,65535,
    ]),
  });
  const workingSet=createSerializedPixelBufferTileWorkingSet(serializeTiledPixelBufferSource(source,{tileSize:2}));
  const {controller,counts}=harness({workingSet});
  assert.equal(controller.applyNativeHighDepthBlurDab({id:'layer'},{x:1.5,y:.5},null),true);
  assert.equal(workingSet.loadedTileCount,2);
  assert.ok(workingSet.dirtyTileCount>=1);
  const restored=deserializePixelBufferSource(workingSet.serialize());
  assert.ok(restored.data[4]>0,'left side should sample the bright neighboring tile');
  assert.deepEqual(counts(),{previewDirty:1,previewScheduled:1});
});

test('Stage 17d tiled clone uses an immutable lazy source snapshot instead of a full clone buffer',()=>{
  const source=createPixelBuffer({
    width:4,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array([
      60000,1000,1000,65535, 50000,2000,2000,65535,
      1000,1000,60000,65535, 2000,2000,50000,65535,
    ]),
  });
  const packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  const workingSet=createSerializedPixelBufferTileWorkingSet(packed);
  const {controller}=harness({workingSet});
  const layer={id:'layer',highDepthSource:packed};
  controller.setCloneSource({layerId:'layer',documentPoint:{x:.5,y:.5},localPoint:{x:.5,y:.5}});
  const offset=controller.prepareNativeHighDepthCloneStroke(layer,{x:2.5,y:.5});
  assert.deepEqual(offset,{x:-2,y:0});
  assert.equal(controller.applyNativeHighDepthCloneDab(layer,{x:2.5,y:.5},offset,null,false),true);
  const restored=deserializePixelBufferSource(workingSet.serialize());
  assert.ok(restored.data[8]>source.data[8],'destination red should move toward the immutable source');
  assert.ok(restored.data[10]<source.data[10],'destination blue should move toward the immutable source');
});
