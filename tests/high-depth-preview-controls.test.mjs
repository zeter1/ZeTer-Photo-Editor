import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDocument, createRasterLayer, addLayer, sanitizeProject, snapshotDocument, sanitizeHighDepthPreview } from '../src/core/state.js';
import { createPixelBuffer, serializePixelBufferSource, pixelBufferToToneMappedRgba8Preview } from '../src/core/pixel-buffer.js';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const render=await readFile(new URL('../src/core/render.js',import.meta.url),'utf8');

test('Stage 12c sanitizes and persists per-layer HDR preview controls only while a high-depth source exists',()=>{
  assert.deepEqual(sanitizeHighDepthPreview({toneMap:'bad',displayExposure:99}),{toneMap:'auto',displayExposure:6});
  assert.deepEqual(sanitizeHighDepthPreview({toneMap:'clip',displayExposure:-99}),{toneMap:'clip',displayExposure:-6});
  const buffer=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([2,1,.5,1])});
  const source=serializePixelBufferSource(buffer);
  const doc=createDocument({name:'HDR controls',width:1,height:1});
  addLayer(doc,createRasterLayer({width:1,height:1,dataUrl:'data:image/png;base64,AAAA',highDepthSource:source,highDepthPreview:{toneMap:'aces',displayExposure:2.25}}));
  const safe=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.deepEqual(safe.layers[0].highDepthPreview,{toneMap:'aces',displayExposure:2.25});
  const noSource=sanitizeProject({version:1,name:'plain',width:1,height:1,background:'transparent',layers:[{id:'r',type:'raster',name:'r',width:1,height:1,dataUrl:'data:image/png;base64,AAAA',highDepthPreview:{toneMap:'aces',displayExposure:3}}]});
  assert.equal(noSource.layers[0].highDepthPreview,null);
});

test('Stage 12c exposes Auto, Clip and ACES plus a separate display-exposure stage',()=>{
  const buffer=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',data:new Float32Array([4,4,4,1])});
  const auto=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'auto',displayExposure:0});
  const aces=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'aces',displayExposure:0});
  const clip=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'clip',displayExposure:0});
  const darker=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'aces',displayExposure:-2});
  assert.deepEqual([...auto],[...aces]);
  assert.equal(clip[0],255);
  assert.ok(aces[0]<255);
  assert.ok(darker[0]<aces[0]);
  assert.equal(darker[3],255);
});

test('Stage 12c Auto resolves to Clip for 16-bit sources',()=>{
  const buffer=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:new Uint16Array([50000,40000,30000,65535])});
  const auto=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'auto'});
  const clip=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:'clip'});
  assert.deepEqual([...auto],[...clip]);
});

test('Stage 12c UI and renderer wire tone-map mode and display exposure into cache identity',()=>{
  assert.match(main,/data-high-depth-tone-map/);
  assert.match(main,/data-high-depth-display-exposure/);
  assert.match(main,/data-high-depth-preview-reset/);
  assert.match(main,/function updateHighDepthPreviewSetting\(/);
  assert.match(main,/function bindHighDepthPreviewControls\(/);
  assert.match(render,/const toneMap = \['auto','clip','aces'\]\.includes\(preview\.toneMap\)/);
  assert.match(render,/displayExposure\.toFixed\(3\)/);
  assert.match(render,/pixelBufferToToneMappedRgba8Preview\(buffer, layer\.filters \|\| \{\}, \{ toneMap, displayExposure \}\)/);
});

test('Stage 12c destructive materialization bakes preview controls once and clears their stale state',()=>{
  assert.match(main,/pixelBufferToToneMappedRgba8Preview\(buffer,\{\}, \{toneMap:preview\.toneMap,displayExposure:preview\.displayExposure\}\)/);
  assert.match(main,/l\.highDepthSource=null;\n  l\.highDepthPreview=null;/);
  assert.match(main,/layer\.highDepthSource=null;\n        layer\.highDepthPreview=null;/);
});
