import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDocument, createRasterLayer, addLayer, sanitizeProject, snapshotDocument } from '../src/core/state.js';
import { createPixelBuffer, serializePixelBufferSource, deserializePixelBufferSource } from '../src/core/pixel-buffer.js';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const psdImportController=await readFile(new URL('../src/document/psd-import-controller.js',import.meta.url),'utf8');
const painting=await readFile(new URL('../src/painting/controller.js',import.meta.url),'utf8');
const selectionMutations=await readFile(new URL('../src/selection/raster-mutation-controller.js',import.meta.url),'utf8');

test('Stage 12a keeps a bounded high-depth source inside the .zpe raster schema',()=>{
  const buffer=createPixelBuffer({width:2,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-srgb',data:new Float32Array([-1,0.25,2,1,0.5,0.75,4,0.5])});
  const source=serializePixelBufferSource(buffer);
  const doc=createDocument({name:'HDR',width:2,height:1});
  addLayer(doc,createRasterLayer({name:'HDR layer',width:2,height:1,dataUrl:'data:image/png;base64,AAAA',highDepthSource:source}));
  const safe=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.equal(safe.layers[0].highDepthSource.bitsPerChannel,32);
  assert.equal(safe.layers[0].highDepthSource.rawBytes,32);
  assert.deepEqual([...deserializePixelBufferSource(safe.layers[0].highDepthSource).data],[...buffer.data]);
});

test('Stage 12a does not trust malformed persisted high-depth raster metadata',()=>{
  const doc=createDocument({name:'bad',width:1,height:1});
  addLayer(doc,createRasterLayer({width:1,height:1,dataUrl:'data:image/png;base64,AAAA',highDepthSource:{kind:'zpe-pixel-buffer-source-v1',width:999999,height:999999,model:'rgb',channels:4,bitsPerChannel:32,rawBytes:1,dataUrl:'data:application/x-zeter-pixel-buffer;base64,AAAA'}}));
  const safe=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.equal(safe.layers[0].highDepthSource,null);
});

test('destructive Canvas raster publication invalidates preserved high-depth source',()=>{
  assert.match(painting,/layer\.dataUrl = dataUrl;[\s\S]*?layer\.highDepthSource = null;/);
  assert.match(selectionMutations,/layer\.dataUrl = dataUrl;[\s\S]*?layer\.highDepthSource = null;/);
  assert.ok(psdImportController.includes('highDepthSource=serializePixelBufferSource(sourceLayer.pixelBuffer'));
  assert.ok(psdImportController.includes('MAX_PIXEL_BUFFER_SOURCE_BYTES-highDepthBytesUsed'));
  assert.match(painting,/layer\.highDepthSource = null;[\s\S]*?layer\.highDepthPreview = null;/);
  assert.match(selectionMutations,/layer\.highDepthSource = null;[\s\S]*?layer\.highDepthPreview = null;/);
});
