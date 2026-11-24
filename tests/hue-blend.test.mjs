import test from 'node:test';
import assert from 'node:assert/strict';
import { compositeClippingStackPixels, compositeAdjustmentPixels, compositeClippedAdjustmentPixels, compositeClippedRasterPixels } from '../src/core/adjustments.js';
import { createPixelBuffer, serializePixelBufferSource, compositePixelBufferLayers, compositeCmykPixelBufferLayers } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';
const rgba=(...values)=>({data:Uint8ClampedArray.from(values)});
test('Hue transfers source hue while retaining backdrop saturation and luma in all four compositors',()=>{
  for(const fn of [compositeClippingStackPixels,compositeAdjustmentPixels,compositeClippedAdjustmentPixels,compositeClippedRasterPixels]) {
    const target=rgba(60,120,180,255), base=rgba(60,120,180,255), source=rgba(240,60,60,255);
    if(fn===compositeClippingStackPixels) fn(target,source,'hue');
    else if(fn===compositeAdjustmentPixels) fn(target,source,{blendMode:'hue'});
    else fn(target,base,source,{blendMode:'hue'});
    assert.deepEqual([...target.data],[193,73,73,255],fn.name);
    assert.deepEqual([...source.data],[240,60,60,255]);
  }
});
test('Hue handles neutral source/backdrop, transparent edges and partial alpha',()=>{
  const target=rgba(60,120,180,255, 128,128,128,255, 12,34,56,0, 60,120,180,255, 10,20,30,255);
  const source=rgba(100,100,100,255, 180,60,60,255, 100,150,50,128, 180,60,60,128, 255,0,0,0);
  compositeClippingStackPixels(target,source,'hue');
  assert.deepEqual([...target.data],[109,109,109,255,128,128,128,255,100,150,50,128,127,96,126,255,10,20,30,255]);
});
test('native RGB16/32 and CMYK Hue cannot silently downgrade to Normal',async()=>{
  for(const [model,channels,depth,fn] of [['rgb',4,16,compositePixelBufferLayers],['rgb',4,32,compositePixelBufferLayers],['cmyk',5,8,compositeCmykPixelBufferLayers]]) {
    const buffer=createPixelBuffer({width:1,height:1,model,channels,bitsPerChannel:depth});
    assert.throws(()=>fn(1,1,[{buffer,blendMode:'hue'}],{bitsPerChannel:depth}),/Hue/);
    const controller=createPsdExportController({rendering:{createCanvas:()=>{throw Error('unexpected fallback');}}});
    for(const groupMode of [false,true]) {
      const doc={width:1,height:1,background:'transparent',groups:groupMode?[{id:'g',blendMode:'hue'}]:[],layers:[{id:'l',type:'raster',groupId:groupMode?'g':null,blendMode:groupMode?'source-over':'hue',highDepthSource:serializePixelBufferSource(buffer)}]};
      const before=JSON.stringify(doc);
      await assert.rejects(controller.prepareDocument(doc),/Hue blend: native high-depth/);
      assert.equal(JSON.stringify(doc),before);
    }
  }
});
