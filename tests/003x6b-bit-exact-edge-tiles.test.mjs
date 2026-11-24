import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, serializePixelBufferSource, serializeTiledPixelBufferSource,
  deserializePixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { dataUrlToBytes } from '../src/core/io.js';

// Independent expected bytes: never read a Float32 sample as a JS Number.
function expectedTileBytes(data, imageWidth, channels, x, y, width, height) {
  const raw = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const sampleBytes = data.BYTES_PER_ELEMENT;
  const rowBytes = width * channels * sampleBytes;
  const expected = new Uint8Array(rowBytes * height);
  for (let row = 0; row < height; row += 1) {
    const offset = ((y + row) * imageWidth + x) * channels * sampleBytes;
    expected.set(raw.subarray(offset, offset + rowBytes), row * rowBytes);
  }
  return expected;
}

test('003X/6b: CMYKA32 noncontiguous edge tiles preserve signaling-NaN, alpha and -0 bits', () => {
  const backing = new Float32Array(40);
  const samples = backing.subarray(5, 35); // Nonzero backing byte offset.
  const bits = new Uint32Array(samples.buffer, samples.byteOffset, samples.length);
  for (let i = 0; i < bits.length; i += 1) bits[i] = 0x3f000000 + i;
  bits[4] = 0x7f812345; // signaling-NaN in alpha
  bits[9] = 0x80000000; // negative zero in another alpha
  bits[14] = 0x7fc01234; // quiet-NaN payload
  bits[29] = 0x7f811111; // signaling-NaN in right-edge alpha
  const buffer = createPixelBuffer({
    width: 3, height: 2, model: 'cmyk', channels: 5, bitsPerChannel: 32,
    alphaMode: 'straight', data: samples,
  });
  const tiled = serializeTiledPixelBufferSource(buffer, { tileSize: 2 });
  assert.equal(tiled.tiles.length, 2);
  for (const tile of tiled.tiles) {
    assert.deepEqual(
      dataUrlToBytes(tile.dataUrl), expectedTileBytes(samples, 3, 5, tile.x, tile.y, tile.width, tile.height),
      `tile x=${tile.x} y=${tile.y} must not convert to JS Number`,
    );
  }
  const decoded = deserializePixelBufferSource(tiled);
  assert.deepEqual(new Uint8Array(decoded.data.buffer), new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
});

test('003X/6b: legacy .zpe v1 source preserves raw Float32 bits on encode and decode', () => {
  const samples = new Float32Array(10);
  const bits = new Uint32Array(samples.buffer);
  bits.set([0x7f812345, 0x80000000, 0x7fc0abcd, 0x7f801234, 0x3f800000,
    0x00000000, 0x80000000, 0x7f812222, 0x7f7fffff, 0x7f814444]);
  const buffer = createPixelBuffer({
    width: 2, height: 1, model: 'cmyk', channels: 5, bitsPerChannel: 32, data: samples,
  });
  const source = serializePixelBufferSource(buffer);
  assert.deepEqual(dataUrlToBytes(source.dataUrl), new Uint8Array(samples.buffer));
  const decoded = deserializePixelBufferSource(source);
  assert.deepEqual(new Uint8Array(decoded.data.buffer), new Uint8Array(samples.buffer));
});

test('003X/6b: noncontiguous RGB16 right-edge tile remains little-endian and round-trips', () => {
  const backing = new Uint16Array(22);
  const samples = backing.subarray(2, 20);
  samples.set([0, 65535, 17, 128, 2, 32768, 444, 555, 666, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
  const buffer = createPixelBuffer({ width:3, height:2, model:'rgb', channels:3, bitsPerChannel:16, data:samples });
  const source = serializeTiledPixelBufferSource(buffer, { tileSize:2 });
  for (const tile of source.tiles) {
    assert.deepEqual(dataUrlToBytes(tile.dataUrl), expectedTileBytes(samples, 3, 3, tile.x, tile.y, tile.width, tile.height));
  }
  assert.deepEqual(deserializePixelBufferSource(source).data, samples);
});

test('003X/6b: explicit v1 byte limit refuses before starting Base64 encoding', () => {
  const data = new Float32Array(5);
  const source = createPixelBuffer({ width:1, height:1, model:'cmyk', channels:5, bitsPerChannel:32, data });
  const initialBtoa = globalThis.btoa;
  let calls = 0;
  globalThis.btoa = () => { calls += 1; throw new Error('unexpected encoder call'); };
  try {
    assert.throws(() => serializePixelBufferSource(source, { maxBytes: 19 }), RangeError);
    assert.equal(calls, 0);
  } finally {
    globalThis.btoa = initialBtoa;
  }
});
