import test from 'node:test';
import assert from 'node:assert/strict';
import { compositeClippingStackPixels, compositeAdjustmentPixels, compositeClippedAdjustmentPixels, compositeClippedRasterPixels } from '../src/core/adjustments.js';
import { createPixelBuffer, serializePixelBufferSource, compositePixelBufferLayers, compositeCmykPixelBufferLayers } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';
const rgba=(...values)=>({data:Uint8ClampedArray.from(values)});
test('Color preserves backdrop luminosity and source chroma across all correction paths',()=>{
  for (const fn of [compositeClippingStackPixels,compositeAdjustmentPixels,compositeClippedAdjustmentPixels,compositeClippedRasterPixels]) {
    const target=rgba(128,128,128,255), base=rgba(128,128,128,255), source=rgba(100,150,50,255);
    if(fn===compositeClippingStackPixels) fn(target,source,'color');
    else if(fn===compositeAdjustmentPixels) fn(target,source,{blendMode:'color'});
    else fn(target,base,source,{blendMode:'color'});
    assert.deepEqual([...target.data],[104,154,54,255],fn.name);
    assert.deepEqual([...source.data],[100,150,50,255]);
  }
});
test('Color gamut clipping preserves luminance and alpha boundaries',()=>{
  const target=rgba(0,0,0,255, 255,255,255,255, 12,34,56,0, 10,20,30,255);
  const source=rgba(255,0,0,255, 0,0,255,255, 100,150,50,128, 255,0,0,0);
  compositeClippingStackPixels(target,source,'color');
  assert.deepEqual([...target.data],[0,0,0,255,255,255,255,255,100,150,50,128,10,20,30,255]);
});
test('native Float32 RGB and CMYK Color remain explicitly rejected, not silently Normal',()=>{
  for(const [model,channels,depth,fn] of [['rgb',4,32,compositePixelBufferLayers],['cmyk',5,16,compositeCmykPixelBufferLayers]]) {
    const buffer=createPixelBuffer({width:1,height:1,model,channels,bitsPerChannel:depth});
    assert.throws(()=>fn(1,1,[{buffer,blendMode:'color'}],{bitsPerChannel:depth}),/Color/);
  }
});

test('PSD/PSB preparation refuses unsupported native Color without mutating the document',async()=>{
  const controller=createPsdExportController({rendering:{
    createCanvas:()=>{throw new Error('unexpected Canvas fallback');},
  }});
  for(const [model,channels,bitsPerChannel] of [['rgb',4,16],['rgb',4,32],['cmyk',5,8]]) {
    const source=serializePixelBufferSource(createPixelBuffer({width:1,height:1,model,channels,bitsPerChannel}));
    for(const groupMode of [false,true]) {
      const doc={width:1,height:1,background:'transparent',groups:groupMode?[{id:'g',blendMode:'color'}]:[],
        layers:[{id:'l',type:'raster',groupId:groupMode?'g':null,blendMode:groupMode?'source-over':'color',highDepthSource:source}]};
      const before=JSON.stringify(doc);
      await assert.rejects(controller.prepareDocument(doc),/Color blend: native high-depth/);
      assert.equal(JSON.stringify(doc),before);
    }
  }
});
