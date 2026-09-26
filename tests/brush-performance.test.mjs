import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const painting = await readFile(new URL('../src/painting/controller.js', import.meta.url), 'utf8');
const gesture = await readFile(new URL('../src/painting/gesture-controller.js', import.meta.url), 'utf8');
const render = await readFile(new URL('../src/core/render.js', import.meta.url), 'utf8');
const io = await readFile(new URL('../src/core/io.js', import.meta.url), 'utf8');

test('brush pointer movement never PNG-encodes the canvas', () => {
  const move = gesture.match(/function move\(point, pointerEvent = null\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(move, 'paint gesture move function not found');
  assert.doesNotMatch(move, /toDataURL|toBlob|canvasToDataURL|invalidateImageCache|render\(/);
});

test('brush preview is frame-throttled and uses a live raster override', () => {
  assert.match(painting, /paintPreviewFrame = requestFrame\(\(\) =>/);
  assert.match(painting, /renderPaintPreview\(\)/);
  assert.match(main, /rasterEdit\.paintPreviewOverrides\(\)/);
  assert.match(render, /rasterOverrides/);
  assert.match(render, /const overrideSource = overrideEntry\?\.source \|\| overrideEntry \|\| null/);
  assert.match(render, /layer\.type === 'raster' && overrideSource \? overrideSource : await getImage\(dataUrl\)/);
  assert.match(render, /cacheable: !\(layer\.type === 'raster' && overrideSource\)/);
  assert.match(render, /overrideSkipAdjustments/);
});

test('paint gesture move draws only the latest segment instead of restroking an ever-growing path', () => {
  const move = gesture.match(/function move\(point, pointerEvent = null\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(move, /beginPath\(\)/);
  assert.match(move, /moveTo\(last\.x, last\.y\)/);
});

test('finished strokes use asynchronous canvas encoding instead of synchronous toDataURL', () => {
  const persist = painting.match(/async function persistPaintLayer\(\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(persist, 'persistPaintLayer function not found');
  assert.match(persist, /await canvasToDataURL\(canvas,\s*'image\/png'\)/);
  assert.doesNotMatch(persist, /\.toDataURL\(/);
  assert.match(io, /canvas\.toBlob\(/);
});

test('paint start is cancelled when the primary pointer was released during async layer preparation', () => {
  assert.match(main, /canContinue:\(\)=>activePrimaryPointerId===e\.pointerId/);
  assert.match(gesture, /const layer = await ensurePaintLayer\(point, tool, canContinue\);[\s\S]*?if \(!canContinue\(\)\) return false/);
});
