import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPixelBuffer,
  compositePixelBufferLayers,
  compositeCmykPixelBufferLayers,
  MAX_HIGH_DEPTH_COMPOSITE_BYTES,
} from '../src/core/pixel-buffer.js';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const psdExportController=await readFile(new URL('../src/document/psd-export-controller.js',import.meta.url),'utf8');

test('Stage 12g composites multiple 16-bit layers without collapsing samples to 8-bit steps',()=>{
  const bottom=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:new Uint16Array([10001,20003,30007,65535])});
  const top=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:new Uint16Array([60001,1001,22003,32768])});
  const out=compositePixelBufferLayers(1,1,[
    {buffer:bottom,x:0,y:0,opacity:1,blendMode:'source-over'},
    {buffer:top,x:0,y:0,opacity:.5,blendMode:'source-over'},
  ],{bitsPerChannel:16,colorSpace:'srgb'});
  assert.ok(out.data instanceof Uint16Array);
  assert.equal(out.data[3],65535);
  assert.ok(out.data[0]>bottom.data[0]&&out.data[0]<top.data[0]);
  assert.ok([...out.data.slice(0,3)].some(value=>value%257!==0));
});

test('Stage 12g keeps Float32 HDR headroom across source-over and multiply',()=>{
  const bottom=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([4,2,1,1])});
  const half=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([2,1,.5,.5])});
  const normal=compositePixelBufferLayers(1,1,[{buffer:bottom},{buffer:half}],{bitsPerChannel:32});
  assert.ok(normal.data instanceof Float32Array);
  assert.ok(Math.abs(normal.data[0]-3)<1e-6);
  assert.ok(normal.data[0]>1);
  const multiplySource=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([.5,.5,.5,1])});
  const multiply=compositePixelBufferLayers(1,1,[{buffer:bottom},{buffer:multiplySource,blendMode:'multiply'}],{bitsPerChannel:32});
  assert.ok(Math.abs(multiply.data[0]-2)<1e-6);
  assert.ok(multiply.data[0]>1);
});

test('Stage 12g converts sRGB 16-bit samples into linear Float32 working space',()=>{
  const srgbHalf=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:new Uint16Array([32768,32768,32768,65535])});
  const out=compositePixelBufferLayers(1,1,[{buffer:srgbHalf}],{bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged'});
  assert.ok(out.data[0]>.21&&out.data[0]<.22);
  assert.ok(Math.abs(out.data[0]-.5)>.2);
});

test('Stage 12g applies positioned raster-mask alpha before layer opacity',()=>{
  const red=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:new Uint16Array([65535,0,0,65535])});
  const mask=new Uint8ClampedArray([255,255,255,128]);
  const out=compositePixelBufferLayers(2,1,[{buffer:red,x:1,y:0,opacity:.5,maskPixels:mask}],{
    bitsPerChannel:16,
    background:{rgba:[0,0,0,1],colorSpace:'srgb'},
  });
  assert.deepEqual([...out.data.slice(0,4)],[0,0,0,65535]);
  assert.ok(out.data[4]>15000&&out.data[4]<18000);
  assert.equal(out.data[7],65535);
});

test('Stage 12g bounds typed merged-composite allocation',()=>{
  const layer=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:new Uint16Array([0,0,0,65535])});
  assert.ok(MAX_HIGH_DEPTH_COMPOSITE_BYTES>=256*1024*1024);
  assert.throws(()=>compositePixelBufferLayers(2,2,[{buffer:layer}],{bitsPerChannel:32,maxBytes:1}),/лимит/);
});

test('Stage 12g export planner keeps Canvas8 as explicit fallback instead of claiming precision',()=>{
  assert.match(psdExportController,/function buildHighDepthComposite\(/);
  assert.match(main,/Stage 12g: merged composite оставлен на Canvas8 fallback/);
  assert.match(main,/vector mask слоя/);
  assert.match(main,/isolated Canvas group composite/);
  assert.match(main,/if\(!compositePixelBuffer\)\{/);
});


test('Stage 13b composites native CMYK layers without RGB conversion or 8-bit quantization',()=>{
  const bottom=createPixelBuffer({width:1,height:1,model:'cmyk',channels:5,bitsPerChannel:16,colorSpace:'device-cmyk',alphaMode:'straight',data:new Uint16Array([10001,20003,30007,40009,65535])});
  const top=createPixelBuffer({width:1,height:1,model:'cmyk',channels:5,bitsPerChannel:16,colorSpace:'device-cmyk',alphaMode:'straight',data:new Uint16Array([50001,40003,30001,20011,32768])});
  const out=compositeCmykPixelBufferLayers(1,1,[
    {buffer:bottom,opacity:1,blendMode:'source-over'},
    {buffer:top,opacity:.5,blendMode:'source-over'},
  ],{bitsPerChannel:16});
  assert.equal(out.model,'cmyk');
  assert.equal(out.channels,5);
  assert.ok(out.data instanceof Uint16Array);
  assert.equal(out.data[4],65535);
  assert.ok(out.data[0]>bottom.data[0]&&out.data[0]<top.data[0]);
  assert.ok([...out.data.slice(0,4)].some(value=>value%257!==0));
});

test('Stage 13c CMYK composite applies raster-mask alpha and component blend modes without RGB conversion',()=>{
  const ink=createPixelBuffer({width:1,height:1,model:'cmyk',channels:5,bitsPerChannel:8,colorSpace:'device-cmyk',alphaMode:'straight',data:new Uint8ClampedArray([200,100,50,25,255])});
  const mask=new Uint8ClampedArray([255,255,255,128]);
  const out=compositeCmykPixelBufferLayers(1,1,[{buffer:ink,opacity:.5,maskPixels:mask}],{bitsPerChannel:8});
  assert.ok(out.data[4]>=63&&out.data[4]<=65);
  assert.deepEqual([...out.data.slice(0,4)],[200,100,50,25]);

  const bottom=createPixelBuffer({width:1,height:1,model:'cmyk',channels:5,bitsPerChannel:16,colorSpace:'device-cmyk',alphaMode:'straight',data:new Uint16Array([30000,20000,10000,5000,65535])});
  const top=createPixelBuffer({width:1,height:1,model:'cmyk',channels:5,bitsPerChannel:16,colorSpace:'device-cmyk',alphaMode:'straight',data:new Uint16Array([40000,30000,20000,10000,65535])});
  const normal=compositeCmykPixelBufferLayers(1,1,[{buffer:bottom},{buffer:top,blendMode:'source-over'}],{bitsPerChannel:16});
  const multiply=compositeCmykPixelBufferLayers(1,1,[{buffer:bottom},{buffer:top,blendMode:'multiply'}],{bitsPerChannel:16});
  assert.notDeepEqual([...multiply.data.slice(0,4)],[...normal.data.slice(0,4)]);
  assert.ok([...multiply.data.slice(0,4)].some(value=>value%257!==0));
});


test('Stage 13c export planner no longer forces native CMYK layers with supported component blends to RGB fallback',()=>{
  assert.doesNotMatch(main,/CMYK merged composite Stage 13b поддерживает только Normal blend/);
  assert.match(psdExportController,/blendMode:item\.layer\.blendMode\|\|'source-over'/);
});

test('Stage 12g/13c typed compositors implement the expanded Photoshop-compatible component blend modes',()=>{
  const makeRgb=value=>createPixelBuffer({
    width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([value,value,value,1]),
  });
  const expected=new Map([['soft-light',.375],['hard-light',.625],['difference',.5],['exclusion',.625]]);
  for(const [blendMode,target] of expected){
    const out=compositePixelBufferLayers(1,1,[{buffer:makeRgb(.25)},{buffer:makeRgb(.75),blendMode}],{bitsPerChannel:32});
    assert.ok(Math.abs(out.data[0]-target)<1e-6,blendMode);
  }

  const makeCmyk=value=>createPixelBuffer({
    width:1,height:1,model:'cmyk',channels:5,bitsPerChannel:32,colorSpace:'device-cmyk',alphaMode:'straight',
    data:new Float32Array([value,value,value,value,1]),
  });
  for(const [blendMode,target] of expected){
    const out=compositeCmykPixelBufferLayers(1,1,[{buffer:makeCmyk(.25)},{buffer:makeCmyk(.75),blendMode}],{bitsPerChannel:32});
    assert.ok(Math.abs(out.data[0]-target)<1e-6,blendMode);
  }
});
