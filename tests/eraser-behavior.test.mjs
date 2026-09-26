import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const gesture = await readFile(new URL('../src/painting/gesture-controller.js', import.meta.url), 'utf8');

test('eraser path never auto-creates a raster layer', () => {
  const ensurePaintLayer = gesture.match(/async function ensurePaintLayer\(point, tool, canContinue = \(\) => true\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(ensurePaintLayer, 'ensurePaintLayer function not found');
  assert.match(ensurePaintLayer, /EXISTING_RASTER_ONLY_TOOLS\.has\(tool\)[\s\S]*?layer = rasterAtPoint;[\s\S]*?if \(!layer\) return null/);
});

test('painting maps document coordinates into the selected layer pixel space', () => {
  assert.match(main, /function documentPointToLayerPixel\(point, layer\)/);
  assert.match(main, /toLocal: documentPointToLayerPixel/);
  assert.match(gesture, /const localPoint = target\.toLocal\(point, layer\)/);
  assert.match(gesture, /const next = target\.toLocal\(point, layer\)/);
});