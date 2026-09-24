import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('eraser path never auto-creates a raster layer', () => {
  const ensurePaintLayer = main.match(/async function ensurePaintLayer\(point, canContinue = \(\) => true\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(ensurePaintLayer, 'ensurePaintLayer function not found');
  assert.match(ensurePaintLayer, /\['eraser','blur',[\s\S]*?\]\.includes\(currentTool\)[\s\S]*?l = rasterAtPoint;[\s\S]*?if \(!l\) return null/);
});

test('painting maps document coordinates into the selected layer pixel space', () => {
  assert.match(main, /function documentPointToLayerPixel\(point, layer\)/);
  const beginPaint = main.match(/async function beginPaint\(p, pointerId, pointerEvent = null\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  const paintTo = main.match(/function paintTo\(p, pointerEvent = null\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(beginPaint, /documentPointToLayerPixel\(p, l\)/);
  assert.match(paintTo, /documentPointToLayerPixel\(p, layer\)/);
});