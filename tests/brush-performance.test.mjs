import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const render = await readFile(new URL('../src/core/render.js', import.meta.url), 'utf8');
const io = await readFile(new URL('../src/core/io.js', import.meta.url), 'utf8');

test('brush pointer movement never PNG-encodes the canvas', () => {
  const paintTo = main.match(/function paintTo\(p, pointerEvent = null\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(paintTo, 'paintTo function not found');
  assert.doesNotMatch(paintTo, /toDataURL|toBlob|canvasToDataURL|invalidateImageCache|render\(/);
});

test('brush preview is frame-throttled and uses a live raster override', () => {
  assert.match(main, /paintPreviewFrame = requestAnimationFrame\(\(\) =>/);
  assert.match(main, /render\(\{ paintPreview: true \}\)/);
  assert.match(render, /rasterOverrides/);
  assert.match(render, /layer\.type === 'raster' && rasterOverride \? rasterOverride : await getImage\(dataUrl\)/);
  assert.match(render, /cacheable: !\(layer\.type === 'raster' && rasterOverride\)/);
});

test('paintTo draws only the latest segment instead of restroking an ever-growing path', () => {
  const paintTo = main.match(/function paintTo\(p, pointerEvent = null\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(paintTo, /beginPath\(\)/);
  assert.match(paintTo, /moveTo\(last\.x,last\.y\)/);
});

test('finished strokes use asynchronous canvas encoding instead of synchronous toDataURL', () => {
  const persist = main.match(/async function persistPaintLayer\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(persist, 'persistPaintLayer function not found');
  assert.match(persist, /await canvasToDataURL\(canvas,'image\/png'\)/);
  assert.doesNotMatch(persist, /\.toDataURL\(/);
  assert.match(io, /canvas\.toBlob\(/);
});

test('paint start is cancelled when the primary pointer was released during async layer preparation', () => {
  const begin = main.match(/async function beginPaint\(p, pointerId, pointerEvent = null\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(begin, /activePrimaryPointerId === pointerId/);
  assert.match(begin, /if \(!canContinue\(\)\) return false/);
});