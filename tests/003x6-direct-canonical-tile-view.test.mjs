import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, serializeTiledPixelBufferSource } from '../src/core/pixel-buffer.js';
import { dataUrlToBytes } from '../src/core/io.js';

function canonicalSamples(buffer, x, y, width, height) {
  const bytesPerSample = buffer.bitsPerChannel / 8;
  const result = new Uint8Array(width * height * buffer.channels * bytesPerSample);
  const view = new DataView(result.buffer);
  let offset = 0;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width * buffer.channels; col += 1) {
      const sample = buffer.data[((row + y) * buffer.width + x) * buffer.channels + col];
      if (buffer.bitsPerChannel === 16) view.setUint16(offset, sample, true);
      else view.setFloat32(offset, sample, true);
      offset += bytesPerSample;
    }
  }
  return result;
}

test('003X/6: contiguous native RGB16 tile encodes exact little-endian bytes from offset view', () => {
  const backing = new Uint16Array(16);
  const samples = backing.subarray(2, 14); // Nonzero byte offset must not leak neighbours.
  samples.set([0, 65535, 17, 2, 32768, 65534, 123, 456, 789, 1, 3, 5]);
  const buffer = createPixelBuffer({
    width: 2, height: 2, model: 'rgb', channels: 3, bitsPerChannel: 16, data: samples,
  });
  const tiled = serializeTiledPixelBufferSource(buffer, { tileSize: 2 });
  assert.equal(tiled.tiles.length, 1);
  assert.deepEqual(dataUrlToBytes(tiled.tiles[0].dataUrl), new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
  assert.equal(tiled.tiles[0].rawBytes, samples.byteLength);
});

test('003X/6: contiguous CMYKA32 preserves original Float32 bit patterns and alpha', () => {
  const samples = new Float32Array(20);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.fround((i + 1) / 31);
  const bits = new Uint32Array(samples.buffer);
  bits[0] = 0x7fc01234; // Noncanonical quiet-NaN payload is meaningful for exact native serialization.
  bits[1] = 0x80000000; // Negative zero.
  const buffer = createPixelBuffer({
    width: 2, height: 2, model: 'cmyk', channels: 5, bitsPerChannel: 32,
    colorSpace: 'device-cmyk', alphaMode: 'straight', data: samples,
  });
  const tiled = serializeTiledPixelBufferSource(buffer, { tileSize: 2 });
  assert.deepEqual(dataUrlToBytes(tiled.tiles[0].dataUrl), new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
  assert.equal(tiled.tiles[0].rawBytes, samples.byteLength);
});

test('003X/6: noncontiguous edge tile still packs precise RGB16 row slices', () => {
  const samples = Uint16Array.from({ length: 3 * 2 * 3 }, (_, i) => i * 1023 + 5);
  const buffer = createPixelBuffer({
    width: 3, height: 2, model: 'rgb', channels: 3, bitsPerChannel: 16, data: samples,
  });
  const tiled = serializeTiledPixelBufferSource(buffer, { tileSize: 2 });
  assert.equal(tiled.tiles.length, 2);
  const rightEdge = tiled.tiles[1];
  assert.deepEqual([rightEdge.x, rightEdge.y, rightEdge.width, rightEdge.height], [2, 0, 1, 2]);
  assert.deepEqual(dataUrlToBytes(rightEdge.dataUrl), canonicalSamples(buffer, 2, 0, 1, 2));
});
