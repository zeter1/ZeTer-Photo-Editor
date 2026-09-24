import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBlurBrushPixels, applyToneBrushPixels } from '../src/core/pixels.js';

test('dodge and burn change RGB gradually while preserving alpha', () => {
  const pixels = new Uint8ClampedArray([
    80, 100, 120, 0,
    80, 100, 120, 128,
    80, 100, 120, 255,
  ]);
  const changed = applyToneBrushPixels(pixels, 3, 1, 1.5, 0.5, 1.5, 0.5, { brighten:true });
  assert.equal(changed, 2);
  assert.deepEqual([...pixels.slice(0,4)], [80,100,120,0]);
  assert.equal(pixels[7], 128);
  assert.equal(pixels[11], 255);
  assert.ok(pixels[4] > 80 && pixels[5] > 100 && pixels[6] > 120);

  const beforeBurn = pixels[8];
  applyToneBrushPixels(pixels, 3, 1, 2.5, 0.5, 1, 0.4, { brighten:false });
  assert.ok(pixels[8] < beforeBurn);
  assert.equal(pixels[11], 255);
});

test('tone brush respects the active selection predicate', () => {
  const pixels = new Uint8ClampedArray([
    100, 100, 100, 255,
    100, 100, 100, 255,
  ]);
  const changed = applyToneBrushPixels(pixels, 2, 1, 1, 0.5, 2, 1, {
    brighten:true,
    isAllowed:(x) => x === 1,
  });
  assert.equal(changed, 1);
  assert.deepEqual([...pixels.slice(0,4)], [100,100,100,255]);
  assert.deepEqual([...pixels.slice(4,8)], [255,255,255,255]);
});

test('tone brush limits overlapping dabs to the selected strength per stroke', () => {
  const pixels = new Uint8ClampedArray([100, 120, 140, 255]);
  const coverage = { width:1, tiles:new Map() };
  const dab = () => applyToneBrushPixels(pixels, 1, 1, 0.5, 0.5, 1, 0.2, { strokeCoverage:coverage });
  dab();
  const first = [...pixels];
  for (let i = 0; i < 40; i += 1) dab();
  assert.deepEqual([...pixels], first, 'overlapping dabs must not turn one stroke white');
  assert.ok(first[0] < 140);
  applyToneBrushPixels(pixels, 1, 1, 0.5, 0.5, 1, 0.2, { strokeCoverage:{ width:1, tiles:new Map() } });
  assert.ok(pixels[0] > first[0], 'a second stroke may strengthen the effect');
  assert.equal(pixels[3], 255);
});

test('tone coverage follows layer coordinates across cropped dabs', () => {
  const pixels = new Uint8ClampedArray([80, 90, 100, 255]);
  const coverage = { width:200, tiles:new Map() };
  applyToneBrushPixels(pixels, 1, 1, 0.5, 0.5, 1, 0.3, { strokeCoverage:coverage, originX:128, originY:5 });
  const first = [...pixels];
  applyToneBrushPixels(pixels, 1, 1, 0.5, 0.5, 1, 0.3, { strokeCoverage:coverage, originX:128, originY:5 });
  assert.deepEqual([...pixels], first);
});

test('blur strength is a percentage and overlapping dabs do not multiply it', () => {
  const pixels = new Uint8ClampedArray([100, 120, 140, 128, 50, 60, 70, 0]);
  const blurred = new Uint8ClampedArray([200, 220, 240, 255, 240, 240, 240, 255]);
  const coverage = { width:2, tiles:new Map() };
  const dab = () => applyBlurBrushPixels(pixels, blurred, 2, 1, 0.5, 0.5, 1, 0.02, { strokeCoverage:coverage });
  dab();
  const first = [...pixels];
  assert.ok(first[0] >= 101 && first[0] <= 103, '2% must be subtle');
  assert.equal(first[3], 128);
  assert.deepEqual(first.slice(4), [50, 60, 70, 0]);
  for (let i = 0; i < 40; i += 1) dab();
  assert.deepEqual([...pixels], first);
  applyBlurBrushPixels(pixels, blurred, 2, 1, 0.5, 0.5, 1, 0.02, { strokeCoverage:{ width:2, tiles:new Map() } });
  assert.ok(pixels[0] > first[0]);
});

test('blur brush respects the active selection', () => {
  const pixels = new Uint8ClampedArray([100, 100, 100, 255, 100, 100, 100, 255]);
  const blurred = new Uint8ClampedArray([200, 200, 200, 255, 200, 200, 200, 255]);
  applyBlurBrushPixels(pixels, blurred, 2, 1, 1, 0.5, 2, 1, { isAllowed:(x) => x === 1 });
  assert.deepEqual([...pixels.slice(0, 4)], [100, 100, 100, 255]);
  assert.ok(pixels[4] > 100);
});