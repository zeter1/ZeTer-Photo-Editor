import test from 'node:test';
import assert from 'node:assert/strict';
import { compositeClippingStackPixels, compositeAdjustmentPixels, compositeClippedAdjustmentPixels, compositeClippedRasterPixels } from '../src/core/adjustments.js';
import { createPixelBuffer, serializePixelBufferSource, compositePixelBufferLayers, compositeCmykPixelBufferLayers } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';
const rgba=(...values)=>({data:Uint8ClampedArray.from(values)});
test('Saturation transfers source saturation while retaining backdrop hue and luma in all four compositors',()=>{
  for(const fn of [compositeClippingStackPixels,compositeAdjustmentPixels,compositeClippedAdjustmentPixels,compositeClippedRasterPixels]) {
    const target=rgba(60,120,180,255), base=rgba(60,120,180,255), source=rgba(240,60,60,255);
    if(fn===compositeClippingStackPixels) fn(target,source,'saturation');
    else if(fn===compositeAdjustmentPixels) fn(target,source,{blendMode:'saturation'});
    else fn(target,base,source,{blendMode:'saturation'});
    assert.deepEqual([...target.data],[36,126,216,255],fn.name);
    assert.deepEqual([...source.data],[240,60,60,255]);
  }
});
test('Saturation handles neutral source/backdrop, transparent edges and partial alpha',()=>{
  const target=rgba(60,120,180,255, 128,128,128,255, 12,34,56,0, 60,120,180,255, 10,20,30,255);
  const source=rgba(100,100,100,255, 180,60,60,255, 100,150,50,128, 180,60,60,128, 255,0,0,0);
  compositeClippingStackPixels(target,source,'saturation');
  assert.deepEqual([...target.data],[109,109,109,255,128,128,128,255,100,150,50,128,60,120,180,255,10,20,30,255]);
});
test('native RGB16/32 and CMYK Saturation cannot silently downgrade to Normal',async()=>{
  for(const [model,channels,depth,fn] of [['rgb',4,16,compositePixelBufferLayers],['rgb',4,32,compositePixelBufferLayers],['cmyk',5,8,compositeCmykPixelBufferLayers]]) {
    const buffer=createPixelBuffer({width:1,height:1,model,channels,bitsPerChannel:depth});
    assert.throws(()=>fn(1,1,[{buffer,blendMode:'saturation'}],{bitsPerChannel:depth}),/Saturation/);
    const controller=createPsdExportController({rendering:{createCanvas:()=>{throw Error('unexpected fallback');}}});
    for(const groupMode of [false,true]) {
      const doc={width:1,height:1,background:'transparent',groups:groupMode?[{id:'g',blendMode:'saturation'}]:[],layers:[{id:'l',type:'raster',groupId:groupMode?'g':null,blendMode:groupMode?'source-over':'saturation',highDepthSource:serializePixelBufferSource(buffer)}]};
      const before=JSON.stringify(doc);
      await assert.rejects(controller.prepareDocument(doc),/Saturation blend: native high-depth/);
      assert.equal(JSON.stringify(doc),before);
    }
  }
});
