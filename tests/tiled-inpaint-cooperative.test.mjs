import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer,
  deserializePixelBufferSource,
  inpaintTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceCooperative,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { createRasterEditController } from '../src/painting/controller.js';

function fixture(width = 16, height = 160) {
  const channels = 5;
  const data = new Float32Array(width * height * channels);
  for (let i = 0; i < width * height; i += 1) {
    data.set([0.12, 0.23, 0.34, 0.45, 1], i * channels);
  }
  const damaged = (Math.floor(height / 2) * width + 7) * channels;
  data.set([9, 9, 9, 9, 1], damaged);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'cmyk', channels, bitsPerChannel:32,
    colorSpace:'device-cmyk', data,
  }), { tileSize:8 });
}

test('Stage 003: cooperative scan yields and matches synchronous cross-tile inpaint with a one-shot predicate', async () => {
  const source = fixture();
  const before = source.tiles.map(tile => tile.dataUrl);
  const seen = new Set();
  let yields = 0;
  const ySelected = Math.floor(source.height / 2);
  const result = await inpaintTiledPixelBufferSourceCooperative(source, {
    isAllowed:(x, y) => {
      const index = y * source.width + x;
      assert.equal(seen.has(index), false, 'selection was sampled twice');
      seen.add(index);
      return y === ySelected && (x === 7 || x === 8);
    },
    scanChunkPixels:137,
    yieldControl:async () => { yields += 1; },
    halo:2,
  });
  const synchronous = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => y === ySelected && (x === 7 || x === 8),
    halo:2,
  });
  assert.ok(yields > 1);
  assert.equal(seen.size, source.width * source.height);
  assert.equal(result.filled, 2);
  assert.equal(result.changed, 2);
  assert.deepEqual(result.source, synchronous.source);
  assert.ok(result.source.tiles.some((tile, index) => tile.dataUrl !== before[index]));
  assert.ok(source.tiles.every((tile, index) => tile.dataUrl === before[index]));
  const restored = deserializePixelBufferSource(result.source);
  const badSample = (ySelected * source.width + 7) * 5;
  assert.notEqual(restored.data[badSample], 9);
});

test('Stage 003: cooperative scan cancels before tile decode or source publication', async () => {
  const source = fixture();
  const json = JSON.stringify(source);
  let cancelled = false;
  let yielded = 0;
  let sampled = 0;
  const result = await inpaintTiledPixelBufferSourceCooperative(source, {
    isAllowed:() => { sampled += 1; return true; },
    scanChunkPixels:64,
    yieldControl:async () => { yielded += 1; cancelled = true; },
    isCancelled:() => cancelled,
  });
  assert.equal(yielded, 1);
  assert.equal(sampled, 64);
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.source, source);
  assert.equal(JSON.stringify(source), json);
});

test('Stage 003: document replacement during a long scan aborts without preview or mutation', async () => {
  const source = fixture(256, 256);
  const layer = {
    id:'tiled', type:'raster', locked:false, groupId:null,
    width:256, height:256, highDepthSource:source, dataUrl:null,
    filters:{}, highDepthPreview:null,
  };
  const owner = { width:256, height:256, layers:[layer], groups:[] };
  let liveDoc = owner;
  let predicateCalls = 0;
  const controller = createRasterEditController({
    getDocument:() => liveDoc,
    documentRef:{ createElement() { throw new Error('stale job must not build a preview'); } },
  });
  const pending = controller.persistTiledHighDepthInpaint(owner, layer, {
    isAllowed:(x, y) => { predicateCalls += 1; return x === 7 && y === 128; },
  });
  // The first 32,768 coordinates are frozen synchronously, then the scan yields.
  liveDoc = { width:256, height:256, layers:[], groups:[] };
  const result = await pending;
  assert.equal(predicateCalls, 32_768);
  assert.equal(result.applied, false);
  assert.equal(result.stale, true);
  assert.equal(result.changed, 0);
  assert.equal(layer.highDepthSource, source);
  assert.equal(layer.dataUrl, null);
});
