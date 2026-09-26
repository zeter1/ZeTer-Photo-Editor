import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { floodFillPixels, hexToRgb } from '../src/core/pixels.js';
import { pointInLayer, snapLineEnd } from '../src/core/geometry.js';
import { createShapeLayer, sanitizeProject } from '../src/core/state.js';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const gesture = fs.readFileSync(new URL('../src/painting/gesture-controller.js', import.meta.url), 'utf8');

function rgbaGrid(width, height, color = [255, 255, 255, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set(color, i * 4);
  return data;
}

function setPixel(data, width, x, y, rgba) {
  data.set(rgba, (y * width + x) * 4);
}

function pixel(data, width, x, y) {
  return [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];
}

test('bucket fill stays inside the connected color region', () => {
  const width = 5; const height = 3;
  const data = rgbaGrid(width, height);
  for (let y = 0; y < height; y += 1) setPixel(data, width, 2, y, [0, 0, 0, 255]);
  const changed = floodFillPixels(data, width, height, 0, 1, [255, 0, 0], { tolerance: 0, opacity: 1 });
  assert.equal(changed, 6);
  assert.deepEqual(pixel(data, width, 1, 1), [255, 0, 0, 255]);
  assert.deepEqual(pixel(data, width, 2, 1), [0, 0, 0, 255]);
  assert.deepEqual(pixel(data, width, 4, 1), [255, 255, 255, 255]);
});

test('bucket fill honors an active-selection predicate and opacity', () => {
  const width = 4; const height = 2;
  const data = rgbaGrid(width, height, [0, 0, 255, 255]);
  const changed = floodFillPixels(data, width, height, 0, 0, hexToRgb('#ff0000'), {
    tolerance: 0,
    opacity: 0.5,
    isAllowed: (x) => x < 2,
  });
  assert.equal(changed, 4);
  assert.deepEqual(pixel(data, width, 0, 0), [128, 0, 128, 255]);
  assert.deepEqual(pixel(data, width, 3, 0), [0, 0, 255, 255]);
});

test('line snapping uses 45 degree increments', () => {
  const end = snapLineEnd({ x: 10, y: 10 }, { x: 31, y: 18 }, 45);
  assert.ok(Math.abs(end.y - 10) < 1e-8);
  const diagonal = snapLineEnd({ x: 0, y: 0 }, { x: 10, y: 8 }, 45);
  assert.ok(Math.abs(diagonal.x - diagonal.y) < 1e-8);
});

test('legacy line shape hit testing follows the visible segment instead of the whole bounding box', () => {
  const line = createShapeLayer({ x: 10, y: 20, width: 100, height: 100, shape: 'line', strokeWidth: 2 });
  assert.equal(pointInLayer({ x: 60, y: 70 }, line), true);
  assert.equal(pointInLayer({ x: 20, y: 100 }, line), false);
});

test('project sanitizer preserves supported line geometry fields', () => {
  const safe = sanitizeProject({
    name: 'line-doc', width: 200, height: 100, background: 'transparent',
    layers: [{ type: 'shape', shape: 'line', lineFlip: true, lineMode: 'vertical', width: 1, height: 80, stroke: '#123456', strokeWidth: 7 }],
  });
  assert.equal(safe.layers[0].shape, 'line');
  assert.equal(safe.layers[0].lineFlip, true);
  assert.equal(safe.layers[0].lineMode, 'vertical');
});

test('v1.8 tools are wired to toolbar, menus, shortcuts, selection clipping and fill tolerance', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /data-tool="marquee"/);
  assert.match(index, /data-tool="fill"/);
  assert.match(index, /data-tool="line"/);
  assert.match(index, /data-tool="zoom"/);
  assert.match(index, /id="fillTolerance"/);
  assert.match(main, /KeyM:'marquee'/);
  assert.match(main, /KeyG:'fill'/);
  assert.match(main, /KeyL:'line'/);
  assert.match(main, /KeyZ:'zoom'/);
  assert.match(main, /ctrl&&e\.code==='KeyA'/);
  assert.match(main, /ctrl&&e\.code==='KeyD'/);
  assert.match(main, /clipContext: clipContextToSelection/);
  assert.match(gesture, /selection\?\.clipContext\?\.\(context, layer\)/);
  assert.match(main, /isAllowed:rasterSelectionPredicate\(layer\)/);
});

test('line tool paints into the current raster layer instead of creating one shape layer per stroke',()=>{
  assert.match(main,/async function drawLineOnCurrentRaster\(start,end\)/);
  assert.match(main,/let layer=selected\(\)/);
  assert.match(main,/if\(!isEditableRasterLayer\(layer\)\)[\s\S]*?name:'Линии'/);
  assert.match(main,/await drawLineOnCurrentRaster\(d\.start,end\)/);
  assert.doesNotMatch(main,/if\(Math\.hypot\(end\.x-d\.start\.x,end\.y-d\.start\.y\)>2\)\{addLayer\(doc,createLineLayerFromPoints/);
  assert.match(main,/commit\('Нарисовать линию'\)/);
});