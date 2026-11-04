import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer,
  serializeTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
  inpaintTiledPixelBufferSourceCooperative,
} from '../src/core/pixel-buffer.js';

// Large enough to cross the planner's 32,768-visit checkpoint, but tiny
// compared with the maximum legal native source. No external PSD is implied.
const SIDE = 512;
function fixture() {
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:SIDE, height:SIDE, model:'rgb', channels:3, bitsPerChannel:16,
    colorSpace:'srgb', data:new Uint16Array(SIDE * SIDE * 3).fill(12000),
  }), { tileSize:128 });
}
const selectedIndices = Uint32Array.from({ length:50_000 }, (_, i) => i * 5);
const options = { halo:4, maxLayerPixels:4096, maxFillPixels:60_000 };

test('010E-B3: frozen-index fallback cancels during oversized planning before ROI decode', async () => {
  const source = fixture(), frozen = JSON.stringify(source);
  let cancelled = false, checkpoints = 0;
  const result = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...options, selectedIndices,
    isCancelled:() => cancelled,
    yieldControl:async () => {
      checkpoints++;
      // First yield is the existing pre-ROI boundary. The second must be
      // within planning (not ROI decoding or texture synthesis).
      if (checkpoints === 2) cancelled = true;
    },
  });
  assert.equal(checkpoints, 2, 'a planner checkpoint must occur before a private ROI is decoded');
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.filled, 0);
  assert.equal(result.changedTiles, 0);
  assert.equal(result.loadedTiles, 0);
  assert.strictEqual(result.source, source);
  assert.equal(JSON.stringify(source), frozen);
});

test('010E-B3: geometry-scanned fallback also cancels during planning without resampling', async () => {
  const source = fixture(), frozen = JSON.stringify(source);
  let cancelled = false, checkpoints = 0, samples = 0;
  const result = await inpaintTiledPixelBufferSourceCooperative(source, {
    ...options,
    // Scan exactly once, in one chunk, to isolate the planning-time yield.
    scanChunkPixels:SIDE * SIDE,
    isAllowed:(x, y) => { samples++; return ((y * SIDE + x) % 5) === 0; },
    isCancelled:() => cancelled,
    yieldControl:async () => { checkpoints++; cancelled = true; },
  });
  assert.equal(samples, SIDE * SIDE, 'the selection must be frozen exactly once');
  assert.equal(checkpoints, 1, 'the first cooperative yield must be from the planner');
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.loadedTiles, 0);
  assert.strictEqual(result.source, source);
  assert.equal(JSON.stringify(source), frozen);
});
