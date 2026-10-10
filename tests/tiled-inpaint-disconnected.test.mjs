import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, serializeTiledPixelBufferSource,
  deserializePixelBufferSource, inpaintTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
} from '../src/core/pixel-buffer.js';

function distantHoles() {
  const width = 256, height = 16, channels = 5;
  const data = new Float32Array(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    data.set([0.12, 0.23, 0.34, 0.45, 1], i * channels);
  }
  for (const x of [7, 248]) data.set([8, 8, 8, 8, 1], (7 * width + x) * channels);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'cmyk', channels, bitsPerChannel:32,
    colorSpace:'device-cmyk', data,
  }), { tileSize:8 });
}

test('Stage 003: distant CMYKA Float32 holes use disjoint ROI and original donors', () => {
  const source = distantHoles(), originals = source.tiles.map(tile => tile.dataUrl);
  let predicateCalls = 0;
  const result = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => { predicateCalls++; return y === 7 && (x === 7 || x === 248); },
    halo:2, maxLayerPixels:64, // Two 5x5 ROIs, global 246x5 ROI.
  });
  assert.equal(predicateCalls, 256 * 16);
  assert.equal(result.filled, 2);
  assert.equal(result.changed, 2);
  assert.equal(result.changedTiles, 2);
  assert.deepEqual(result.source.tiles.flatMap((tile, i) => tile.dataUrl === originals[i] ? [] : [i]), [0, 31]);
  const restored = deserializePixelBufferSource(result.source);
  const donor = [0.12, 0.23, 0.34, 0.45, 1].map(Math.fround);
  for (const x of [7, 248]) {
    const i = (7 * 256 + x) * 5;
    assert.deepEqual([...restored.data.subarray(i, i + 5)], donor);
  }
});

test('Stage 003: aggregate ROI cap rejects distant islands atomically', () => {
  const source = distantHoles(), snapshot = JSON.stringify(source);
  assert.throws(() => inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => y === 7 && (x === 7 || x === 248),
    halo:2, maxLayerPixels:40,
  }), /сумма рабочих областей/);
  assert.equal(JSON.stringify(source), snapshot);
});

test('Stage 003: adjacent occupied tiles with disjoint pixel halos use separate safe ROIs', () => {
  const width = 48, height = 8;
  const samples = new Uint16Array(width * height * 3).fill(10000);
  for (const x of [7, 14]) samples.fill(60000, (3 * width + x) * 3, (3 * width + x + 1) * 3);
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'rgb', channels:3, bitsPerChannel:16,
    colorSpace:'srgb', data:samples,
  }), { tileSize:8 });
  const original = source.tiles.map(tile => tile.dataUrl);
  // Full bounds: 12 * 5 = 60 px; exact non-overlapping halos: 2 * 5 * 5 = 50 px.
  const options = { halo:2, maxLayerPixels:50 };
  const result = inpaintTiledPixelBufferSource(source, {
    ...options, isAllowed:(x, y) => y === 3 && (x === 7 || x === 14),
  });
  const detached = inpaintTiledPixelBufferSourceFromIndices(source, {
    ...options, selectedIndices:new Uint32Array([3 * width + 7, 3 * width + 14]),
  });
  assert.deepEqual(detached, result, 'Worker frozen indices must match the synchronous path');
  assert.equal(result.filled, 2);
  assert.equal(result.changed, 2);
  assert.equal(result.changedTiles, 2);
  assert.deepEqual(result.source.tiles.flatMap((tile, i) => tile.dataUrl === original[i] ? [] : [i]), [0, 1]);
  assert.deepEqual(source.tiles.map(tile => tile.dataUrl), original, 'input stays immutable');
  const restored = deserializePixelBufferSource(result.source);
  for (const x of [7, 14]) {
    const restoredPixel = restored.data.subarray((3 * width + x) * 3, (3 * width + x + 1) * 3);
    for (const sample of restoredPixel) {
      assert.ok(Math.abs(sample - 10000) <= 1, 'weighted Uint16 synthesis may round one level');
    }
  }
});

test('Stage 003: intersecting selected-pixel halos cannot split or bypass ROI cap', () => {
  const width = 48, height = 8;
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'rgb', channels:3, bitsPerChannel:16,
    colorSpace:'srgb', data:new Uint16Array(width * height * 3).fill(10000),
  }), { tileSize:8 });
  const snapshot = JSON.stringify(source);
  assert.throws(() => inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => y === 3 && (x === 7 || x === 10),
    halo:2, maxLayerPixels:30,
  }), /рабочая область/);
  assert.equal(JSON.stringify(source), snapshot);
});
