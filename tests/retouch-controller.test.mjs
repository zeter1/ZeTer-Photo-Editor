import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { createRetouchController } from '../src/retouch/controller.js';

function harness({buffer=null,brushCanvas=null,brushContext=null}={}) {
  let previewDirty=0, previewScheduled=0;
  const drag={
    toneCoverage:{width:Math.max(1,buffer?.width||brushCanvas?.width||1),tiles:new Map()},
    blurCoverage:{width:Math.max(1,buffer?.width||brushCanvas?.width||1),tiles:new Map()},
  };
  const controller=createRetouchController({
    getBrushCanvas:()=>brushCanvas,
    getBrushContext:()=>brushContext,
    getDrag:()=>drag,
    getHighDepthPaintBuffer:()=>buffer,
    getHighDepthPaintLayerId:()=>buffer?'layer':null,
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
