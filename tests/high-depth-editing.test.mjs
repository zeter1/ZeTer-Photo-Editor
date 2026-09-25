import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPixelBuffer, clonePixelBuffer, pixelBufferWithStraightAlpha,
  applyPixelBufferBrushDab, applyPixelBufferStrokeSegment, applyCmykPixelBufferBrushDab, applyCmykPixelBufferStrokeSegment,
  floodFillPixelBuffer, floodFillCmykPixelBuffer, clearPixelBufferPixels,
  serializePixelBufferSource, deserializePixelBufferSource,
} from '../src/core/pixel-buffer.js';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const toolConfig=await readFile(new URL('../src/ui/tool-config.js',import.meta.url),'utf8');
const render=await readFile(new URL('../src/core/render.js',import.meta.url),'utf8');

test('Stage 12d paints directly into 16-bit samples without collapsing them to 8-bit steps',()=>{
  const source=createPixelBuffer({width:1,height:1,model:'rgb',channels:3,bitsPerChannel:16,colorSpace:'srgb',data:new Uint16Array([12345,23456,34567])});
  const edited=clonePixelBuffer(source);
  const changed=applyPixelBufferBrushDab(edited,.5,.5,1,[255,0,0],{opacity:.37});
  assert.equal(changed,1);
  assert.deepEqual([...source.data],[12345,23456,34567]);
  assert.ok(edited.data[0]>source.data[0]);
  assert.ok(edited.data[1]<source.data[1]);
  assert.ok(edited.data.some(value=>value%257!==0));
  const restored=deserializePixelBufferSource(serializePixelBufferSource(edited));
  assert.deepEqual([...restored.data],[...edited.data]);
});

test('Stage 12d stroke segments preserve Float32 HDR headroom',()=>{
  const buffer=createPixelBuffer({width:3,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([4,2,1,1,4,2,1,1,4,2,1,1])});
  const changed=applyPixelBufferStrokeSegment(buffer,{x:.5,y:.5},{x:2.5,y:.5},.7,[255,255,255],{opacity:.25});
  assert.ok(changed>=3);
  assert.ok(buffer.data[0]>1);
  assert.ok(buffer.data[4]>1);
  assert.ok(buffer.data[8]>1);
});

test('Stage 12d eraser upgrades RGB high-depth data to straight alpha without changing color samples first',()=>{
  const source=createPixelBuffer({width:1,height:1,model:'rgb',channels:3,bitsPerChannel:16,colorSpace:'srgb',data:new Uint16Array([11111,22222,33333])});
  const rgba=pixelBufferWithStraightAlpha(source);
  assert.equal(rgba.channels,4);
  assert.deepEqual([...rgba.data.slice(0,3)],[11111,22222,33333]);
  assert.equal(rgba.data[3],65535);
  applyPixelBufferBrushDab(rgba,.5,.5,1,[0,0,0],{opacity:.5,erase:true});
  assert.deepEqual([...rgba.data.slice(0,3)],[11111,22222,33333]);
  assert.ok(rgba.data[3]>0&&rgba.data[3]<65535);
});

test('Stage 12d flood fill works in typed source space and keeps HDR values above display white',()=>{
  const buffer=createPixelBuffer({width:2,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([2,2,2,1, .1,.1,.1,1])});
  const filled=floodFillPixelBuffer(buffer,0,0,[255,255,255],{tolerance:0,opacity:.5});
  assert.equal(filled,1);
  assert.ok(buffer.data[0]>1);
  assert.equal(buffer.data[4],Math.fround(.1));
});

test('Stage 12d clear respects a selection predicate at high depth',()=>{
  const buffer=createPixelBuffer({width:2,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([1,0,0,1,0,1,0,1])});
  const cleared=clearPixelBufferPixels(buffer,{isAllowed:(x)=>x===1});
  assert.equal(cleared,1);
  assert.equal(buffer.data[3],1);
  assert.equal(buffer.data[7],0);
});

test('Stage 12d routes brush, eraser, fill, line and selection clear through native high-depth mutations',()=>{
  assert.match(main,/function ensureNativeHighDepthPaintBuffer\(/);
  assert.match(main,/applyPixelBufferBrushDab\(highDepthPaintBuffer/);
  assert.match(main,/applyPixelBufferStrokeSegment\(highDepthPaintBuffer/);
  assert.match(main,/floodFillPixelBuffer\(buffer,x,y/);
  assert.match(main,/clearPixelBufferPixels\(buffer,\{isAllowed:rasterSelectionPredicate\(layer\)\}\)/);
  assert.match(main,/applyHighDepthMutation\(layer,await prepareHighDepthMutation\(layer,buffer\)\)/);
  assert.match(main,/prepareClearedHighDepthMutation/);
});

test('Stage 12d paint preview can bypass the legacy RGBA8 adjustment pass after typed rendering',()=>{
  assert.match(main,/skipAdjustments:true/);
  assert.match(render,/overrideSkipAdjustments/);
  assert.match(render,/highDepthApplied \|\| overrideSkipAdjustments/);
});


test('Stage 13c paints directly into 16-bit CMYK ink samples without RGB rasterization',()=>{
  const source=createPixelBuffer({
    width:1,height:1,model:'cmyk',channels:5,bitsPerChannel:16,colorSpace:'device-cmyk',alphaMode:'straight',
    data:new Uint16Array([10001,20003,30007,40009,65535]),
  });
  const edited=clonePixelBuffer(source);
  const changed=applyCmykPixelBufferBrushDab(edited,.5,.5,1,[.75,.1,.2,.35],{opacity:.37});
  assert.equal(changed,1);
  assert.deepEqual([...source.data],[10001,20003,30007,40009,65535]);
  assert.equal(edited.data[4],65535);
  assert.ok([...edited.data.slice(0,4)].some(value=>value%257!==0));
  assert.notDeepEqual([...edited.data.slice(0,4)],[...source.data.slice(0,4)]);
  const restored=deserializePixelBufferSource(serializePixelBufferSource(edited));
  assert.equal(restored.model,'cmyk');
  assert.deepEqual([...restored.data],[...edited.data]);
});

test('Stage 13c upgrades CMYK to straight alpha for native eraser and clear without changing ink first',()=>{
  const source=createPixelBuffer({
    width:2,height:1,model:'cmyk',channels:4,bitsPerChannel:16,colorSpace:'device-cmyk',
    data:new Uint16Array([11111,22222,33333,44444, 5555,6666,7777,8888]),
  });
  const withAlpha=pixelBufferWithStraightAlpha(source);
  assert.equal(withAlpha.model,'cmyk');
  assert.equal(withAlpha.channels,5);
  assert.deepEqual([...withAlpha.data.slice(0,4)],[11111,22222,33333,44444]);
  assert.equal(withAlpha.data[4],65535);
  applyCmykPixelBufferBrushDab(withAlpha,.5,.5,1,[0,0,0,0],{opacity:.5,erase:true});
  assert.deepEqual([...withAlpha.data.slice(0,4)],[11111,22222,33333,44444]);
  assert.ok(withAlpha.data[4]>0&&withAlpha.data[4]<65535);
  const cleared=clearPixelBufferPixels(withAlpha,{isAllowed:x=>x===1});
  assert.equal(cleared,1);
  assert.equal(withAlpha.data[9],0);
});

test('Stage 13c flood fill stays in CMYK source space and respects selection predicates',()=>{
  const buffer=createPixelBuffer({
    width:3,height:1,model:'cmyk',channels:5,bitsPerChannel:16,colorSpace:'device-cmyk',alphaMode:'straight',
    data:new Uint16Array([
      10001,10001,10001,10001,65535,
      10001,10001,10001,10001,65535,
      60001,60001,60001,60001,65535,
    ]),
  });
  const filled=floodFillCmykPixelBuffer(buffer,0,0,[.2,.3,.4,.5],{tolerance:0,opacity:.5,isAllowed:x=>x<2});
  assert.equal(filled,2);
  assert.ok(buffer.data[0]%257!==0||buffer.data[1]%257!==0);
  assert.equal(buffer.data[10],60001);
});

test('Stage 13c routes CMYK brush, fill, line and clear through canonical PixelBuffer mutations',()=>{
  assert.match(toolConfig,/export const NATIVE_CMYK_PAINT_TOOLS = new Set\(\['brush','eraser','blur','clone','heal','smudge','dodge','burn'\]\)/);
  assert.match(main,/applyCmykPixelBufferBrushDab\(highDepthPaintBuffer/);
  assert.match(main,/applyCmykPixelBufferStrokeSegment\(highDepthPaintBuffer/);
  assert.match(main,/floodFillCmykPixelBuffer\(buffer,x,y/);
  assert.match(main,/buffer\.model==='cmyk'/);
  assert.match(main,/highDepthPreview:buffer\.model==='cmyk'\?null/);
});
