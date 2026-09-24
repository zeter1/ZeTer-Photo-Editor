import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('export dialog exposes layered PSD Stage 4 and routes it through encodePsd',()=>{
  assert.match(main,/image\/vnd\.adobe\.photoshop','PSD — слои \(Stage 4\)'/);
  assert.match(main,/async function exportPsdDocument\(exportDoc\)/);
  assert.match(main,/const bytes=encodePsd\(/);
  assert.match(main,/new Blob\(\[bytes\],\{type:'image\/vnd\.adobe\.photoshop'\}\)/);
});

test('PSD export rasterizes layer previews but keeps opacity blend and bitmap mask separate',()=>{
  assert.match(main,/preview\.mask=null;/);
  assert.match(main,/preview\.opacity=1;/);
  assert.match(main,/preview\.blendMode='source-over';/);
  assert.match(main,/opacity:clamp\(Number\(layer\.opacity\?\?1\),0,1\)/);
  assert.match(main,/blendMode:layer\.blendMode\|\|'source-over'/);
  assert.match(main,/renderPsdMaskPixels\(layer,bounds\)/);
});

test('PSD export uses composite fallback for adjustment layers and has bounded raster memory',()=>{
  assert.match(main,/hasAdjustmentLayers\?false:isLayerVisible\(exportDoc,layer\)/);
  assert.match(main,/ZPE Composite Preview \(adjustments baked\)/);
  assert.match(main,/totalPixels>96_000_000/);
  assert.match(main,/maxPixels:48_000_000,maxLayers:500/);
});
