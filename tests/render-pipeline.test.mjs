import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const render = await readFile(new URL('../src/core/render.js', import.meta.url), 'utf8');

test('full renders are serialized and only the latest completed frame reaches the visible canvas', () => {
  assert.match(main, /let renderBusy = false/);
  assert.match(main, /let renderPending = null/);
  assert.match(main, /const renderBuffer = document\.createElement\('canvas'\)/);
  assert.match(main, /const previewDoc = documentWithTextPreview\(doc, textDraft\)/);
  assert.match(main, /await renderDocument\(renderBuffer, previewDoc/);
  assert.match(main, /if \(request\.version !== renderVersion\) return/);
  assert.doesNotMatch(main, /await renderDocument\(els\.canvas, doc/);
});

test('full render respects effective group visibility', () => {
  assert.match(render, /isLayerVisible\(doc, layer\)/);
});

test('scaled raster rendering requests high-quality image smoothing', () => {
  assert.match(render, /ctx\.imageSmoothingEnabled = true/);
  assert.match(render, /ctx\.imageSmoothingQuality = 'high'/);
});

test('resize interaction calculates every pointer move from the original transform', () => {
  assert.match(main, /initial:\{x:l\.x,y:l\.y,width:l\.width,height:l\.height,scaleX:l\.scaleX,scaleY:l\.scaleY,rotation:l\.rotation\}/);
  assert.match(main, /resizeLayerFromPoint\(\{ \.\.\.l, \.\.\.drag\.initial \}/);
});