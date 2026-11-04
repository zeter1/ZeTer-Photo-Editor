import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer,
  createSerializedPixelBufferTileWorkingSet,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';

function fixture(model, bitsPerChannel) {
  const width = 256, height = 256, channels = model === 'rgb' ? 3 : 5;
  const data = bitsPerChannel === 16
    ? new Uint16Array(width * height * channels)
    : new Float32Array(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    for (let channel = 0; channel < channels; channel++) {
      data[i * channels + channel] = bitsPerChannel === 16
        ? ((i + channel * 731) % 65536) : ((i + channel) % 97) / 97;
    }
  }
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, channels, model, bitsPerChannel, data,
  }), { tileSize:64 });
}

for (const [model, depth] of [['rgb',16],['cmyk',32]]) {
  test('Stage 003: cooperative readRegion keeps native precision ' + model + depth, async () => {
    const source = fixture(model, depth), snapshot = JSON.stringify(source);
    const bounds = { left:0, top:0, right:256, bottom:256 };
    const synchronous = createSerializedPixelBufferTileWorkingSet(source).readRegion(bounds);
    const working = createSerializedPixelBufferTileWorkingSet(source);
    let yields = 0;
    const region = await working.readRegionCooperative(bounds, { yieldControl:async () => { yields++; } });
    assert.equal(yields, 2);
    assert.deepEqual(region, synchronous);
    assert.equal(working.dirtyTileCount, 0);
    assert.equal(JSON.stringify(source), snapshot);
    let cancelled = false, cancelledYields = 0;
    const incomplete = createSerializedPixelBufferTileWorkingSet(source);
    const result = await incomplete.readRegionCooperative(bounds, {
      isCancelled:() => cancelled,
      yieldControl:async () => { cancelledYields++; cancelled = true; },
    });
    assert.equal(result, null);
    assert.equal(cancelledYields, 1);
    assert.equal(incomplete.dirtyTileCount, 0);
    assert.ok(incomplete.loadedTileCount > 0 && incomplete.loadedTileCount < source.tiles.length);
    assert.equal(JSON.stringify(source), snapshot);
  });
}

test('Stage 003: frozen-index fallback cancels during a private native ROI read', async () => {
  const source = fixture('cmyk',32), snapshot = JSON.stringify(source);
  let yields = 0, cancelled = false;
  const result = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    selectedIndices:Uint32Array.of(128 * 256 + 128), halo:128,
    isCancelled:() => cancelled,
    yieldControl:async () => { if (++yields === 2) cancelled = true; },
  });
  assert.equal(yields, 2);
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.changedTiles, 0);
  assert.equal(result.loadedTiles, 0);
  assert.equal(result.source, source);
  assert.equal(JSON.stringify(source), snapshot);
});

test('Stage 003: invalid read cancellation callbacks fail closed', async () => {
  const working = createSerializedPixelBufferTileWorkingSet(fixture('rgb',16));
  const bounds = { left:0,top:0,right:32,bottom:32 };
  await assert.rejects(working.readRegionCooperative(bounds, { isCancelled:null }), /invalid cancellation callbacks/);
  await assert.rejects(working.readRegionCooperative(bounds, { yieldControl:null }), /invalid cancellation callbacks/);
  assert.equal(working.dirtyTileCount, 0);
});
