import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPixelBuffer, pixelBufferToToneMappedRgba8Preview } from '../src/core/pixel-buffer.js';

const render=await readFile(new URL('../src/core/render.js',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const painting=await readFile(new URL('../src/painting/controller.js',import.meta.url),'utf8');

test('Stage 12b applies advanced color controls directly from 16-bit samples before the RGBA8 bridge',()=>{
  const source=new Uint16Array([32768,32768,32768,65535]);
  const original=[...source];
  const buffer=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:source});
  const neutral=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'auto'});
  const brighter=pixelBufferToToneMappedRgba8Preview(buffer,{exposure:1}, {toneMap:'auto'});
  const warm=pixelBufferToToneMappedRgba8Preview(buffer,{temperature:100}, {toneMap:'auto'});
  assert.ok(Math.abs(neutral[0]-128)<=1);
  assert.ok(brighter[0]>neutral[0] && brighter[1]>neutral[1] && brighter[2]>neutral[2]);
  assert.ok(warm[0]>warm[2]);
  assert.equal(neutral[3],255);
  assert.deepEqual([...source],original);
});

test('Stage 12b tone-maps 32-bit linear HDR values without flattening every highlight to 255',()=>{
  const source=new Float32Array([
    0.18,0.18,0.18,1,
    1,1,1,1,
    4,4,4,1,
  ]);
  const original=[...source];
  const buffer=createPixelBuffer({width:3,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:source});
  const preview=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'auto'});
  const low=preview[0],mid=preview[4],high=preview[8];
  assert.ok(low>0 && low<mid);
  assert.ok(mid<high);
  assert.ok(high<255);
  assert.deepEqual([...source],original);
});

test('Stage 12b keeps HDR exposure and gamma in the high-depth stage before tone mapping',()=>{
  const buffer=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([0.5,0.25,0.125,0.75])});
  const base=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'auto'});
  const adjusted=pixelBufferToToneMappedRgba8Preview(buffer,{exposure:1,gamma:1.25,vibrance:30,highlights:-10,shadows:15}, {toneMap:'auto'});
  assert.notDeepEqual([...adjusted.slice(0,3)],[...base.slice(0,3)]);
  assert.equal(adjusted[3],Math.round(0.75*255));
});

test('renderer prefers the high-depth source, caches decoded typed data and skips the old 8-bit advanced pass',()=>{
  assert.match(render,/async function makeHighDepthRasterSource\(layer\)/);
  assert.match(render,/deserializePixelBufferSource\(metadata\)/);
  assert.match(render,/pixelBufferToToneMappedRgba8Preview\(buffer, layer\.filters \|\| \{\}, \{ toneMap, displayExposure \}\)/);
  assert.match(render,/HIGH_DEPTH_RASTER_CACHE_LIMIT = 2/);
  assert.match(render,/cached && cached\.sourceToken === sourceToken && cached\.buffer/);
  assert.match(render,/const source = highDepthApplied[\s\S]*\? filtered[\s\S]*: await makeAdjustedRasterSource/);
  assert.match(render,/rasterOverride \|\| layer\.dataUrl \|\| layer\.highDepthSource/);
});

test('destructive raster editing materializes the selected HDR preview and then invalidates precision',()=>{
  assert.match(painting,/function drawHighDepthRasterBase\(layer, canvas, context\)/);
  assert.match(painting,/const preview = sanitizeHighDepthPreview\(layer\.highDepthPreview\)/);
  assert.match(painting,/pixelBufferToToneMappedRgba8Preview\([\s\S]*?buffer,[\s\S]*?toneMap: preview\.toneMap,[\s\S]*?displayExposure: preview\.displayExposure/);
  assert.match(painting,/if \(!drawHighDepthRasterBase\(layer, brushCanvas, brushContext\) && layer\.dataUrl\)/);
  assert.match(painting,/layer\.highDepthSource = null/);
  assert.match(main,/layer\.highDepthSource=null/);
});
