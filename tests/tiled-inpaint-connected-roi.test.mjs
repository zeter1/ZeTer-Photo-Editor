import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { inpaintSelectedSamples } from '../src/core/inpaint.js';
import {
  createPixelBuffer, deserializePixelBufferSource, serializeTiledPixelBufferSource,
  inpaintTiledPixelBufferSource, inpaintTiledPixelBufferSourceFromIndices,
  inpaintTiledPixelBufferSourceCooperative,
} from '../src/core/pixel-buffer.js';

const WIDTH = 256;
const HEIGHT = 256;
const SELECTED = Uint32Array.from({ length:WIDTH }, (_, x) => x * WIDTH + x);
const OPTIONS = { halo:2, maxLayerPixels:5_000, maxFillPixels:1_000 };

function connectedDiagonal() {
  const data = new Uint16Array(WIDTH * HEIGHT * 3).fill(10_000);
  for (const index of SELECTED) data.fill(60_000, index * 3, index * 3 + 3);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:WIDTH, height:HEIGHT, model:'rgb', channels:3,
    bitsPerChannel:16, colorSpace:'srgb', data,
  }), { tileSize:8 });
}

test('Stage 003: a wide connected RGB16 selection is partitioned without borrowing selected donors', async () => {
  const source = connectedDiagonal();
  const original = JSON.stringify(source);
  const isAllowed = (x, y) => x === y;
  let sampled = 0;
  const sync = inpaintTiledPixelBufferSource(source, {
    ...OPTIONS, isAllowed:(x, y) => { sampled++; return isAllowed(x, y); },
  });
  assert.equal(sampled, WIDTH * HEIGHT, 'the frozen predicate is sampled once');
  assert.equal(sync.filled, WIDTH);
  assert.equal(sync.changed, WIDTH);
  assert.equal(sync.changedTiles, WIDTH / 8);
  const pixels = deserializePixelBufferSource(sync.source);
  for (const index of SELECTED) {
    assert.deepEqual([...pixels.data.subarray(index * 3, index * 3 + 3)], [10_000, 10_000, 10_000],
      'original selected pixels must not contaminate adjacent ROI donors');
  }
  assert.equal(JSON.stringify(source), original, 'source and untouched native tile bytes stay immutable');

  const direct = inpaintTiledPixelBufferSourceFromIndices(source, {
    ...OPTIONS, selectedIndices:SELECTED,
  });
  assert.deepEqual(direct, sync, 'frozen-index compute matches the synchronous source');
  const cooperative = await inpaintTiledPixelBufferSourceCooperative(source, {
    ...OPTIONS, isAllowed, scanChunkPixels:WIDTH * HEIGHT, yieldControl:async () => {},
  });
  assert.deepEqual(cooperative, sync, 'cooperative tile chunks preserve exact native bytes');

  const worker = new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url), {
    type:'module',
  });
  try {
    assert.deepEqual((await once(worker, 'message'))[0], { ready:true });
    const reply = once(worker, 'message');
    worker.postMessage({ id:901, source, selectedIndices:SELECTED, ...OPTIONS });
    const message = (await reply)[0];
    assert.equal(message.ok, true, JSON.stringify(message.error));
    assert.deepEqual(message.result, sync, 'real Node Worker must match sync output');
  } finally {
    await worker.terminate();
  }
  assert.equal(JSON.stringify(source), original);
});

test('Stage 003: connected-fragment cap rejects atomically; cancellation discards partial private work', async () => {
  const source = connectedDiagonal(), before = JSON.stringify(source);
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:SELECTED, halo:2, maxLayerPixels:4_000,
  }), /рабочая область/);
  assert.equal(JSON.stringify(source), before);
  let cancelled = false;
  let yields = 0;
  const result = await inpaintTiledPixelBufferSourceCooperative(source, {
    ...OPTIONS, isAllowed:(x, y) => x === y, scanChunkPixels:WIDTH * HEIGHT,
    isCancelled:() => cancelled,
    yieldControl:async () => { if (++yields === 10) cancelled = true; },
  });
  assert.ok(yields >= 10);
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.source, source);
  assert.equal(JSON.stringify(source), before, 'no tiles or history are published on cancellation');
});

test('Stage 003: a frozen neighboring selection pixel is not a donor or PatchMatch context', () => {
  const width = 5, height = 3, channels = 3;
  const samples = new Uint16Array(width * height * channels).fill(1_000);
  samples.fill(65_000, (width + 1) * channels, (width + 2) * channels);
  samples.fill(60_000, (width + 2) * channels, (width + 3) * channels);
  const chosen = (x, y) => x === 2 && y === 1;
  const withoutExclusion = samples.slice();
  assert.equal(inpaintSelectedSamples(withoutExclusion, width, height, channels, {
    isAllowed:chosen,
  }), 1);
  assert.notEqual(withoutExclusion[(width + 2) * channels], 1_000);
  assert.equal(inpaintSelectedSamples(samples, width, height, channels, {
    isAllowed:chosen,
    isDonorExcluded:(x, y) => x === 1 && y === 1,
  }), 1);
  for (const channel of samples.subarray((width + 2) * channels, (width + 3) * channels)) {
    assert.ok(Math.abs(channel - 1_000) <= 1,
      'Uint16 weighted synthesis may round by one level but cannot use the poisoned donor');
  }
  assert.deepEqual([...samples.subarray((width + 1) * channels, (width + 2) * channels)],
    [65_000, 65_000, 65_000], 'globally frozen neighbors are never modified');
  assert.throws(() => inpaintSelectedSamples(samples, width, height, channels, {
    isAllowed:chosen, isDonorExcluded:true,
  }), /donor-exclusion/);
});
