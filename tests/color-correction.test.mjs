import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustRgb, applyAdvancedColorAdjustments, hasAdvancedColorAdjustments } from '../src/core/color.js';
import { createRasterLayer, sanitizeFilters, sanitizeProject, DEFAULT_LAYER_FILTERS } from '../src/core/state.js';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const render = await readFile(new URL('../src/core/render.js', import.meta.url), 'utf8');

test('neutral advanced color correction preserves RGB values', () => {
  assert.deepEqual(adjustRgb(23, 140, 231, DEFAULT_LAYER_FILTERS), [23, 140, 231]);
  assert.equal(hasAdvancedColorAdjustments(DEFAULT_LAYER_FILTERS), false);
});

test('exposure raises luminance and negative exposure lowers it', () => {
  const original = [80, 100, 120];
  const brighter = adjustRgb(...original, { exposure: 1 });
  const darker = adjustRgb(...original, { exposure: -1 });
  assert.ok(brighter.every((value, index) => value >= original[index]));
  assert.ok(darker.every((value, index) => value <= original[index]));
});

test('temperature and tint move channels in the expected direction', () => {
  const warm = adjustRgb(120, 120, 120, { temperature: 100 });
  const cool = adjustRgb(120, 120, 120, { temperature: -100 });
  assert.ok(warm[0] > warm[2]);
  assert.ok(cool[2] > cool[0]);

  const magenta = adjustRgb(120, 120, 120, { tint: 100 });
  const green = adjustRgb(120, 120, 120, { tint: -100 });
  assert.ok(magenta[1] < magenta[0] && magenta[1] < magenta[2]);
  assert.ok(green[1] > green[0] && green[1] > green[2]);
});

test('advanced pixel adjustment preserves alpha and mutates RGB only when active', () => {
  const pixels = { data: new Uint8ClampedArray([80, 100, 120, 77, 0, 0, 0, 0]) };
  applyAdvancedColorAdjustments(pixels, { exposure: 1, gamma: 1 });
  assert.equal(pixels.data[3], 77);
  assert.deepEqual([...pixels.data.slice(4, 8)], [0, 0, 0, 0]);
  assert.ok(pixels.data[0] > 80);
});

test('filter sanitizer accepts signed color controls and clamps unsafe project values', () => {
  const filters = sanitizeFilters({ temperature: -500, tint: 500, exposure: 9, gamma: 0, hue: 999, shadows: -150 });
  assert.equal(filters.temperature, -100);
  assert.equal(filters.tint, 100);
  assert.equal(filters.exposure, 4);
  assert.equal(filters.gamma, 0.1);
  assert.equal(filters.hue, 180);
  assert.equal(filters.shadows, -100);

  const legacy = sanitizeProject({ version: 1, width: 100, height: 100, layers: [{ ...createRasterLayer(), filters: { brightness: 125 } }] });
  assert.equal(legacy.layers[0].filters.brightness, 125);
  assert.equal(legacy.layers[0].filters.gamma, 1);
  assert.equal(legacy.layers[0].filters.temperature, 0);
});

test('editor exposes non-destructive color correction UI and render wiring', () => {
  assert.match(main, /function openColorCorrectionDialog\(\)/);
  assert.match(main, /Цветокоррекция…/);
  assert.match(main, /commit\('Цветокоррекция слоя'\)/);
  assert.match(main, /COLOR_CORRECTION_CONTROLS/);
  assert.match(render, /applyAdvancedColorAdjustments/);
  assert.match(render, /hue-rotate\(\$\{f\.hue\}deg\)/);
  assert.match(render, /adjustedRasterCache/);
});