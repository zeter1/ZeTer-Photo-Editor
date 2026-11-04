import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import {
  createPixelBuffer, serializeTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
} from '../src/core/pixel-buffer.js';

// A near-solid selection on a many-tile document forces repeated strip layouts.
// 640^2 pixels crosses the shared 4,194,304 operation budget without requiring
// a large input fixture, external Adobe content, or private ROI decoding.
const SIDE = 640;
const selectedIndices = Uint32Array.from(
  { length:SIDE * SIDE - 1 }, (_, i) => i);
const options = {
  halo:4, maxLayerPixels:100, maxFillPixels:SIDE * SIDE,
  selectedIndices,
};

function fixture(model, bitsPerChannel) {
  const channels = bitsPerChannel === 16 ? 3 : 5;
  const Type = bitsPerChannel === 16 ? Uint16Array : Float32Array;
  const data = new Type(SIDE * SIDE * channels);
  data.fill(bitsPerChannel === 16 ? 12000 : 0.2);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:SIDE, height:SIDE, model, channels, bitsPerChannel,
    colorSpace:model === 'rgb' ? 'srgb' : 'device-cmyk', data,
  }), { tileSize:128 });
}

for (const [model, bits] of [['rgb', 16], ['cmyk', 32]]) {
  test(`010E-B3B: cumulative planner budget fails closed for ${model}${bits} on sync/cooperative/Node Worker`, async () => {
    const source = fixture(model, bits);
    const before = JSON.stringify(source);
    const message = /превышен лимит планирования 4194304 операций/;
    assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, options), message);

    let checkpoints = 0;
    await assert.rejects(
      inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
        ...options, isCancelled:() => false,
        yieldControl:async () => { checkpoints += 1; },
      }), message);
    assert.ok(checkpoints > 2, 'cooperative planner must yield before hitting the cap');

    const worker = new Worker(
      new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url),
      { type:'module' });
    try {
      assert.deepEqual((await once(worker, 'message'))[0], { ready:true });
      const pending = once(worker, 'message');
      worker.postMessage({ id:2301, source, ...options });
      const reply = (await pending)[0];
      assert.equal(reply.id, 2301);
      assert.equal(reply.ok, false);
      assert.equal(reply.error?.name, 'RangeError');
      assert.match(reply.error?.message, message);
    } finally {
      await worker.terminate();
    }
    assert.equal(JSON.stringify(source), before, 'no source tile may be published or modified');
  });
}

test('010E-B3B: cooperative cancellation precedes any oversized ROI work or publish', async () => {
  const source = fixture('rgb', 16), before = JSON.stringify(source);
  let cancel = false, yields = 0;
  const result = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...options,
    isCancelled:() => cancel,
    yieldControl:async () => { if (++yields === 3) cancel = true; },
  });
  assert.equal(yields, 3);
  assert.equal(result.cancelled, true);
  assert.strictEqual(result.source, source);
  assert.equal(result.changed, 0);
  assert.equal(result.loadedTiles, 0);
  assert.equal(JSON.stringify(source), before);
});
