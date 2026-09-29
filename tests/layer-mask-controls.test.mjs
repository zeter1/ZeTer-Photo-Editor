import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyMaskControlsAlpha } from '../src/core/pixels.js';
import { createLayerMask, sanitizeLayerMask } from '../src/core/state.js';

test('layer mask defaults and sanitizer preserve bounded professional controls', () => {
  assert.deepEqual(createLayerMask(), {
    enabled:true,
    dataUrl:null,
    invert:false,
    density:1,
    feather:0,
    linked:true,
    transform:null,
  });
  assert.deepEqual(sanitizeLayerMask({
    enabled:false,
    dataUrl:'data:image/png;base64,AA==',
    invert:true,
    density:4,
    feather:999,
    linked:false,
    transform:{ a:1, b:0, c:0, d:1, e:12, f:-8 },
  }), {
    enabled:false,
    dataUrl:'data:image/png;base64,AA==',
    invert:true,
    density:1,
    feather:250,
    linked:false,
    transform:{ a:1, b:0, c:0, d:1, e:12, f:-8 },
  });
});

test('layer mask density and invert transform alpha without mutating input', () => {
  const source = Uint8ClampedArray.from([0, 64, 255]);
  assert.deepEqual([...applyMaskControlsAlpha(source, 3, 1, { invert:true })], [255, 191, 0]);
  assert.deepEqual([...applyMaskControlsAlpha(source, 3, 1, { density:.5 })], [128, 160, 255]);
  assert.deepEqual([...applyMaskControlsAlpha(source, 3, 1, { density:0 })], [255, 255, 255]);
  assert.deepEqual([...source], [0, 64, 255]);
});

test('layer mask feather creates bounded soft transitions', () => {
  const alpha = new Uint8ClampedArray(7 * 3);
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 7; x += 1) alpha[y * 7 + x] = x < 3 ? 255 : 0;
  }
  const feathered = applyMaskControlsAlpha(alpha, 7, 3, { feather:2 });
  assert.ok(feathered.some(value => value > 0 && value < 255));
  assert.equal(feathered.length, alpha.length);
});

test('render/export owners consume one canonical mask-control alpha transform', async () => {
  const [render, exportController, main] = await Promise.all([
    readFile(new URL('../src/core/render.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/document/psd-export-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  ]);
  assert.match(render, /applyMaskControlsAlpha/);
  assert.match(render, /applyLayerMaskToContext/);
  assert.match(exportController, /applyMaskControlsAlpha/);
  assert.match(exportController, /invert\/density\/feather/);
  assert.match(main, /Параметры растровой маски/);
  assert.match(main, /Инвертировать растровую маску/);
  assert.match(main, /Включить \/ отключить растровую маску/);
  assert.match(main, /Связать \/ отвязать растровую маску/);
  assert.match(render, /positionLayerMaskCoverage/);
  assert.match(exportController, /multiplyAffineTransforms/);
});
