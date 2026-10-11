import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import {
  createPixelBuffer, deserializePixelBufferSource, serializeTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
} from '../src/core/pixel-buffer.js';

// Two dense islands occupy 512 native 4x4 tiles. A global padded rectangle
// consumes 53,824 px; 512 independent 12x12 tile fragments consume 73,728 px.
// Bounded strip/segment grouping fits within 12,000 px instead.
const WIDTH = 256, HEIGHT = 256;
const SELECTED = [];
for (const origin of [16, 176]) {
  for (let y = origin; y < origin + 64; y += 1) {
    for (let x = origin; x < origin + 64; x += 1) SELECTED.push(y * WIDTH + x);
  }
}
const INDICES = Uint32Array.from(SELECTED);
const OPTIONS = { selectedIndices:INDICES, halo:4, maxLayerPixels:12_000, maxFillPixels:20_000 };

function makeSource(model, bitsPerChannel) {
  const channels = model === 'cmyk' ? 5 : 3;
  const data = bitsPerChannel === 32
    ? new Float32Array(WIDTH * HEIGHT * channels)
    : new Uint16Array(WIDTH * HEIGHT * channels);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      data[index * channels + channel] = channel === 4 ? 1 :
        bitsPerChannel === 32 ? 0.2 + channel * 0.05 : 10_000 + channel * 250;
    }
  }
  for (const index of INDICES) {
    for (let channel = 0; channel < (channels === 5 ? 4 : 3); channel += 1) {
      data[index * channels + channel] = bitsPerChannel === 32 ? 0.9 : 60_000;
    }
  }
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:WIDTH, height:HEIGHT, model, channels, bitsPerChannel,
    colorSpace:bitsPerChannel === 32 ? 'linear-rgb-unmanaged' : 'srgb', data,
  }), { tileSize:4 });
}

function assertRepaired(source, result, before) {
  assert.equal(result.filled, INDICES.length);
  assert.equal(result.changed, INDICES.length);
  assert.equal(JSON.stringify(source), before, 'source native bytes must stay immutable');
  const pixels = deserializePixelBufferSource(result.source);
  const selected = new Uint8Array(WIDTH * HEIGHT);
  for (const index of INDICES) selected[index] = 1;
  const original = deserializePixelBufferSource(source);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    for (let channel = 0; channel < source.channels; channel += 1) {
      const actual = pixels.data[index * source.channels + channel];
      const expected = selected[index] && channel !== 4 ?
        (source.bitsPerChannel === 32 ? 0.2 + channel * 0.05 : 10_000 + channel * 250) :
        original.data[index * source.channels + channel];
      assert.ok(Math.abs(actual - expected) < (source.bitsPerChannel === 32 ? 1e-6 : 1),
        'frozen donors and untouched native pixels must remain exact');
    }
  }
  for (let index = 0; index < source.tiles.length; index += 1) {
    const tile = source.tiles[index];
    const occupies = tile.x >= 16 && tile.x < 80 && tile.y >= 16 && tile.y < 80 ||
      tile.x >= 176 && tile.x < 240 && tile.y >= 176 && tile.y < 240;
    if (!occupies) assert.equal(result.source.tiles[index].dataUrl, tile.dataUrl,
      'unselected serialized tiles must be byte-identical');
  }
}

for (const [model, bits] of [['rgb', 16], ['cmyk', 32]]) {
  test(`Stage 003 010C: dense islands ${model}${bits} use bounded stripes, exact sync/cooperative/Worker parity`, async () => {
    const source = makeSource(model, bits), before = JSON.stringify(source);
    const sync = inpaintTiledPixelBufferSourceFromIndices(source, OPTIONS);
    assertRepaired(source, sync, before);
    const cooperative = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
      ...OPTIONS, yieldControl:async () => {},
    });
    assert.deepEqual(cooperative, sync);
    const worker = new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url),
      { type:'module' });
    try {
      assert.deepEqual((await once(worker, 'message'))[0], { ready:true });
      const reply = once(worker, 'message');
      worker.postMessage({ id:1012, source, ...OPTIONS });
      const message = (await reply)[0];
      assert.equal(message.ok, true, JSON.stringify(message.error));
      assert.deepEqual(message.result, sync);
    } finally {
      await worker.terminate();
    }
    assert.equal(JSON.stringify(source), before);
  });
}

test('Stage 003 010C: aggregate cap rejects dense strips without publishing a partial tile', async () => {
  const source = makeSource('rgb', 16), before = JSON.stringify(source);
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    ...OPTIONS, maxLayerPixels:9_000,
  }), /сумма рабочих областей/);
  assert.equal(JSON.stringify(source), before);

  let cancelled = false, yields = 0;
  const result = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...OPTIONS, isCancelled:() => cancelled,
    yieldControl:async () => { if (++yields === 3) cancelled = true; },
  });
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.source, source);
  assert.ok(yields >= 3);
  assert.equal(JSON.stringify(source), before);
});
