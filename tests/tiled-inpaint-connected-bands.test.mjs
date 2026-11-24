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
const OPTIONS = { halo:4, maxLayerPixels:17_000, maxFillPixels:600 };
const indices = [];
for (let y = 0; y < SIDE; y++) {
  indices.push(y * SIDE + y, y * SIDE + SIDE - 1 - y);
}
const forward = Uint32Array.from(indices).sort();
const reverse = Uint32Array.from(forward).reverse();

function fixture(model, bitsPerChannel) {
  const channels = model === 'rgb' ? 3 : 5;
  const donor = bitsPerChannel === 16 ? [12000, 22000, 32000] : [0.12, 0.24, 0.36, 0.48, 1];
  const corrupt = bitsPerChannel === 16 ? [60000, 60000, 60000] : [0.91, 0.89, 0.87, 0.85, 1];
  const Type = bitsPerChannel === 16 ? Uint16Array : Float32Array;
  const data = new Type(SIDE * SIDE * channels);
  for (let i = 0; i < SIDE * SIDE; i++) data.set(donor, i * channels);
  for (const i of forward) data.set(corrupt, i * channels);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:SIDE, height:SIDE, channels, model, bitsPerChannel,
    colorSpace:model === 'rgb' ? 'srgb' : 'device-cmyk', data,
  }), { tileSize:4 });
}

for (const [model, bits] of [['rgb', 16], ['cmyk', 32]]) {
  test(`010E-B2 connected bands: twin diagonal ${model}${bits} native sync/cooperative/Worker parity`, async () => {
    const source = fixture(model, bits), originalJson = JSON.stringify(source);
    const sync = inpaintTiledPixelBufferSourceFromIndices(source, {
      ...OPTIONS, selectedIndices:reverse,
    });
    assert.equal(sync.filled, forward.length);
    assert.equal(sync.changed, forward.length);
    assert.equal(JSON.stringify(source), originalJson, 'frozen source must not mutate');
    const result = deserializePixelBufferSource(sync.source).data;
    const before = deserializePixelBufferSource(source).data;
    const changed = new Set(forward);
    for (let i = 0; i < SIDE * SIDE; i++) {
      for (let channel = 0; channel < source.channels; channel++) {
        const offset = i * source.channels + channel;
        if (!changed.has(i) || channel === 4) {
          assert.ok(Object.is(result[offset], before[offset]), 'unselected native bytes or alpha changed');
        } else {
          const expected = bits === 16 ? [12000, 22000, 32000][channel] :
            [0.12, 0.24, 0.36, 0.48][channel];
          assert.ok(Math.abs(result[offset] - expected) <= (bits === 16 ? 1 : 1e-6));
        }
      }
    }
    const forwardResult = inpaintTiledPixelBufferSourceFromIndices(source, {
      ...OPTIONS, selectedIndices:forward,
    });
    assert.deepEqual(forwardResult, sync, 'input order must not affect native bytes');
    const cooperative = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
      ...OPTIONS, selectedIndices:reverse, yieldControl:async () => {},
    });
    assert.deepEqual(cooperative, sync);
    const worker = new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url),
      { type:'module' });
    try {
      assert.deepEqual((await once(worker, 'message'))[0], { ready:true });
      const pending = once(worker, 'message');
      worker.postMessage({ id:2102, source, ...OPTIONS, selectedIndices:reverse });
      const reply = (await pending)[0];
      assert.equal(reply.ok, true, JSON.stringify(reply.error));
      assert.deepEqual(reply.result, sync);
    } finally {
      await worker.terminate();
    }
    assert.equal(JSON.stringify(source), originalJson);
  });
}

test('010E-B2: budget refusal and cooperative cancellation remain private', async () => {
  const source = fixture('rgb', 16), frozen = JSON.stringify(source);
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    ...OPTIONS, maxLayerPixels:12_000, selectedIndices:reverse,
  }), /рабочая область|сумма рабочих областей/);
  let cancel = false, yields = 0;
  const cancelled = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...OPTIONS, selectedIndices:reverse, isCancelled:() => cancel,
    yieldControl:async () => { if (++yields >= 3) cancel = true; },
  });
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.source, source);
  assert.equal(cancelled.changed, 0);
  assert.ok(yields >= 3);
  assert.equal(JSON.stringify(source), frozen);
});

test('010E-B2: adversarial checkerboard stays behind hard run/component budgets', () => {
  const source = fixture('rgb', 16), frozen = JSON.stringify(source);
  const mask = [];
  for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x += 2) {
    mask.push(y * SIDE + x);
  }
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    ...OPTIONS, maxFillPixels:40_000, maxLayerPixels:2_000,
    selectedIndices:Uint32Array.from(mask),
  }), RangeError);
  assert.equal(JSON.stringify(source), frozen);
});
