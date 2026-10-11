import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import {
  createPixelBuffer, serializeTiledPixelBufferSource, deserializePixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
} from '../src/core/pixel-buffer.js';

const SIDE = 256;
const forward = Uint32Array.from({ length:SIDE }, (_, i) => i * SIDE + i);
const reverse = Uint32Array.from(forward).reverse();
const OPTIONS = { halo:4, maxLayerPixels:8_500, maxFillPixels:300 };

function sourceFor(model, bitsPerChannel) {
  const channels = model === 'cmyk' ? 5 : 3;
  const Type = bitsPerChannel === 32 ? Float32Array : Uint16Array;
  const donor = bitsPerChannel === 32 ? [0.12, 0.24, 0.36, 0.48, 1] : [12000, 22000, 32000];
  const defect = bitsPerChannel === 32 ? [0.91, 0.89, 0.87, 0.85, 1] : [60000, 60000, 60000];
  const data = new Type(SIDE * SIDE * channels);
  for (let i = 0; i < SIDE * SIDE; i += 1) {
    data.set(i % (SIDE + 1) === 0 ? defect : donor, i * channels);
  }
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:SIDE, height:SIDE, channels, model, bitsPerChannel,
    colorSpace:bitsPerChannel === 32 ? 'device-cmyk' : 'srgb', data,
  }), { tileSize:4 });
}

for (const [model, bits] of [['rgb', 16], ['cmyk', 32]]) {
  test(`010E-B1 adaptive runs: diagonal ${model}${bits} exact native sync/Worker/cooperative parity`, async () => {
    const source = sourceFor(model, bits), frozen = JSON.stringify(source);
    // An 8px vertical run-band fits; 4x4 cell fragments and 32px fixed
    // stripes exceed the same budget. The index input is deliberately
    // reverse-ordered to exercise deterministic numeric row ordering.
    const sync = inpaintTiledPixelBufferSourceFromIndices(source, {
      ...OPTIONS, selectedIndices:reverse,
    });
    assert.equal(sync.filled, SIDE);
    assert.equal(sync.changed, SIDE);
    assert.equal(JSON.stringify(source), frozen);
    const pixels = deserializePixelBufferSource(sync.source).data;
    const original = deserializePixelBufferSource(source).data;
    for (let i = 0; i < SIDE * SIDE; i += 1) {
      for (let channel = 0; channel < source.channels; channel += 1) {
        const actual = pixels[i * source.channels + channel];
        const before = original[i * source.channels + channel];
        if (i % (SIDE + 1) !== 0 || channel === 4) {
          assert.ok(Object.is(actual, before), 'untouched native words/alpha must stay identical');
        } else {
          const expected = bits === 32 ? [0.12, 0.24, 0.36, 0.48][channel] :
            [12000, 22000, 32000][channel];
          assert.ok(Math.abs(actual - expected) <= (bits === 32 ? 1e-6 : 1));
        }
      }
    }
    const forwardResult = inpaintTiledPixelBufferSourceFromIndices(source, {
      ...OPTIONS, selectedIndices:forward,
    });
    assert.deepEqual(forwardResult, sync, 'index order must not change the result');
    const cooperative = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
      ...OPTIONS, selectedIndices:reverse, yieldControl:async () => {},
    });
    assert.deepEqual(cooperative, sync);
    const worker = new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url),
      { type:'module' });
    try {
      assert.deepEqual((await once(worker, 'message'))[0], { ready:true });
      const response = once(worker, 'message');
      worker.postMessage({ id:1013, source, ...OPTIONS, selectedIndices:reverse });
      const reply = (await response)[0];
      assert.equal(reply.ok, true, JSON.stringify(reply.error));
      assert.deepEqual(reply.result, sync);
    } finally {
      await worker.terminate();
    }
    assert.equal(JSON.stringify(source), frozen);
  });
}

test('010E-B1: insufficient ROI budget and cooperative cancellation refuse atomically', async () => {
  const source = sourceFor('rgb', 16), frozen = JSON.stringify(source);
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    ...OPTIONS, selectedIndices:reverse, maxLayerPixels:6_000,
  }), /рабочая область|сумма рабочих областей/);
  let cancel = false, yields = 0;
  const cancelled = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...OPTIONS, selectedIndices:reverse,
    isCancelled:() => cancel,
    yieldControl:async () => { if (++yields === 3) cancel = true; },
  });
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.changed, 0);
  assert.equal(cancelled.source, source);
  assert.ok(yields >= 3);
  assert.equal(JSON.stringify(source), frozen);
});

// Thousands of isolated row runs would exceed the adaptive planner cap;
// fixed-grid planning retains the only publication authority and rejects.
test('010E-B1: pathological disconnected checkerboard is bounded and atomic', () => {
  const source = sourceFor('rgb', 16), frozen = JSON.stringify(source);
  const mask = [];
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 2) mask.push(y * SIDE + x);
  }
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    ...OPTIONS, selectedIndices:Uint32Array.from(mask),
    maxFillPixels:40_000, maxLayerPixels:1_000,
  }), RangeError);
  assert.equal(JSON.stringify(source), frozen);
});
