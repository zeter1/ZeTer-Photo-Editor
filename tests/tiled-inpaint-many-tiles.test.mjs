import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import {
  createPixelBuffer, deserializePixelBufferSource, serializeTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
} from '../src/core/pixel-buffer.js';

// 512 occupied cells inside a legal 4,096-tile source. The 2-pixel halo
// costs 512 * 25 = 12,800 ROI pixels, whereas the global bounding box
// exceeds 180,000 pixels. Merging all cells would be prohibitively expensive.
const WIDTH = 4096, HEIGHT = 64, CELL_COUNT = 512;
const SELECTED = Uint32Array.from({ length:CELL_COUNT }, (_, cell) =>
  (cell % 2 === 0 ? 10 : 50) * WIDTH + cell * 8 + 3);
const OPTIONS = { selectedIndices:SELECTED, halo:2, maxLayerPixels:18_000, maxFillPixels:1_000 };

function fixture({ model = 'rgb', bits = 16 } = {}) {
  const channels = model === 'cmyk' ? 5 : 3;
  const data = bits === 32
    ? new Float32Array(WIDTH * HEIGHT * channels).fill(0.25)
    : new Uint16Array(WIDTH * HEIGHT * channels).fill(12_345);
  if (channels === 5) {
    for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) data[pixel * channels + 4] = 1;
  }
  for (const index of SELECTED) data[index * channels] = bits === 32 ? 9 : 60_000;
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:WIDTH, height:HEIGHT, model, channels, bitsPerChannel:bits,
    colorSpace:bits === 32 ? 'linear-rgb-unmanaged' : 'srgb', data,
  }), { tileSize:8 });
}

function assertNativeRepair(result, source, before) {
  assert.equal(result.filled, CELL_COUNT);
  assert.equal(result.changed, CELL_COUNT);
  assert.equal(result.changedTiles, CELL_COUNT);
  assert.equal(JSON.stringify(source), before, 'all input native tiles remain immutable');
  const pixels = deserializePixelBufferSource(result.source);
  for (const index of SELECTED) {
    const restored = pixels.data[index * source.channels];
    const expected = source.bitsPerChannel === 32 ? 0.25 : 12_345;
    assert.ok(Math.abs(restored - expected) <= (source.bitsPerChannel === 32 ? 1e-6 : 1),
      'repaired native samples cannot borrow frozen selected donors');
  }
}

test('Stage 003: >256 occupied RGB16 tiles use bounded fragments with sync, cooperative and real Worker parity', async () => {
  const source = fixture(), before = JSON.stringify(source);
  const sync = inpaintTiledPixelBufferSourceFromIndices(source, OPTIONS);
  assertNativeRepair(sync, source, before);
  const cooperative = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...OPTIONS, yieldControl:async () => {},
  });
  assert.deepEqual(cooperative, sync, 'cooperative native result must match exact sync bytes');

  const worker = new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url), { type:'module' });
  try {
    assert.deepEqual((await once(worker, 'message'))[0], { ready:true });
    const reply = once(worker, 'message');
    worker.postMessage({ id:906, source, ...OPTIONS });
    const message = (await reply)[0];
    assert.equal(message.ok, true, JSON.stringify(message.error));
    assert.deepEqual(message.result, sync, 'Node Worker uses identical native fragment plan');
  } finally {
    await worker.terminate();
  }
  assert.equal(JSON.stringify(source), before);
});

test('Stage 003: >256 occupied Float32 CMYKA tiles preserve native precision', async () => {
  const source = fixture({ model:'cmyk', bits:32 }), before = JSON.stringify(source);
  const sync = inpaintTiledPixelBufferSourceFromIndices(source, OPTIONS);
  assertNativeRepair(sync, source, before);
  const cooperative = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...OPTIONS, yieldControl:async () => {},
  });
  assert.deepEqual(cooperative, sync);
});

test('Stage 003: >256 tile aggregate ROI cap refuses atomically and cancel discards prepared work', async () => {
  const source = fixture(), before = JSON.stringify(source);
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    ...OPTIONS, maxLayerPixels:12_799,
  }), /сумма рабочих областей/);
  assert.equal(JSON.stringify(source), before);

  let cancelled = false, yields = 0;
  const result = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...OPTIONS,
    isCancelled:() => cancelled,
    yieldControl:async () => { if (++yields === 20) cancelled = true; },
  });
  assert.ok(yields >= 20, 'cancellation reaches a partially processed fragment sequence');
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.source, source);
  assert.equal(JSON.stringify(source), before, 'no partial native mutations escape');
});
