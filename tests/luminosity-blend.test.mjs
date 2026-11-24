import test from 'node:test';
import assert from 'node:assert/strict';
import { compositeClippingStackPixels, compositeAdjustmentPixels, compositeClippedAdjustmentPixels, compositeClippedRasterPixels } from '../src/core/adjustments.js';
import { createPixelBuffer, serializePixelBufferSource, compositePixelBufferLayers, compositeCmykPixelBufferLayers } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';
const rgba=(...values)=>({data:Uint8ClampedArray.from(values)});
test('Luminosity transfers source luma while retaining backdrop hue and saturation in all four compositors',()=>{
  for(const fn of [compositeClippingStackPixels,compositeAdjustmentPixels,compositeClippedAdjustmentPixels,compositeClippedRasterPixels]) {
    const target=rgba(60,120,180,255), base=rgba(60,120,180,255), source=rgba(240,60,60,255);
    if(fn===compositeClippingStackPixels) fn(target,source,'luminosity');
    else if(fn===compositeAdjustmentPixels) fn(target,source,{blendMode:'luminosity'});
    else fn(target,base,source,{blendMode:'luminosity'});
    assert.deepEqual([...target.data],[65,125,185,255],fn.name);
    assert.deepEqual([...source.data],[240,60,60,255]);
  }
});
test('Luminosity handles neutral source/backdrop, transparent edges and partial alpha',()=>{
  const target=rgba(60,120,180,255, 128,128,128,255, 12,34,56,0, 60,120,180,255, 10,20,30,255);
  const source=rgba(100,100,100,255, 180,60,60,255, 100,150,50,128, 180,60,60,128, 255,0,0,0);
  compositeClippingStackPixels(target,source,'luminosity');
  assert.deepEqual([...target.data],[51,111,171,255,96,96,96,255,100,150,50,128,54,114,174,255,10,20,30,255]);
});
test('native RGB16/32 and CMYK Luminosity cannot silently downgrade to Normal',async()=>{
  for(const [model,channels,depth,fn] of [['rgb',4,16,compositePixelBufferLayers],['rgb',4,32,compositePixelBufferLayers],['cmyk',5,8,compositeCmykPixelBufferLayers]]) {
    const buffer=createPixelBuffer({width:1,height:1,model,channels,bitsPerChannel:depth});
    assert.throws(()=>fn(1,1,[{buffer,blendMode:'luminosity'}],{bitsPerChannel:depth}),/Luminosity/);
    const controller=createPsdExportController({rendering:{createCanvas:()=>{throw Error('unexpected fallback');}}});
    for(const groupMode of [false,true]) {
      const doc={width:1,height:1,background:'transparent',groups:groupMode?[{id:'g',blendMode:'luminosity'}]:[],layers:[{id:'l',type:'raster',groupId:groupMode?'g':null,blendMode:groupMode?'source-over':'luminosity',highDepthSource:serializePixelBufferSource(buffer)}]};
      const before=JSON.stringify(doc);
      await assert.rejects(controller.prepareDocument(doc),/Luminosity blend: native high-depth/);
      assert.equal(JSON.stringify(doc),before);
    }
  }
});

test('Luminosity clips extreme source luminance without independently clipping RGB channels',()=>{
  // Backdrop luma is 81. Scaling its chroma toward the target luma gives
  // [0, 6, 12] at luma 5 and [247, 251, 255] at luma 250, after byte rounding.
  for(const [level,expected] of [[5,[0,6,12,255]],[250,[247,251,255,255]],[0,[0,0,0,255]],[255,[255,255,255,255]]]) {
    for(const fn of [compositeClippingStackPixels,compositeAdjustmentPixels,compositeClippedAdjustmentPixels,compositeClippedRasterPixels]) {
      const target=rgba(0,100,200,255), base=rgba(0,100,200,255), source=rgba(level,level,level,255);
      if(fn===compositeClippingStackPixels) fn(target,source,'luminosity');
      else if(fn===compositeAdjustmentPixels) fn(target,source,{blendMode:'luminosity'});
      else fn(target,base,source,{blendMode:'luminosity'});
      assert.deepEqual([...target.data],expected,fn.name+' at luma '+level);
      assert.deepEqual([...source.data],[level,level,level,255]);
      assert.deepEqual([...base.data],fn===compositeClippedRasterPixels?expected:[0,100,200,255]);
    }
  }
});
