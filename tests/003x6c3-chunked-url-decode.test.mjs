import test from 'node:test';
import assert from 'node:assert/strict';
import { bytesToDataUrl, dataUrlToBytes } from '../src/core/io.js';
import {
  createPixelBuffer, serializePixelBufferSource, serializeTiledPixelBufferSource,
  deserializePixelBufferSource,
} from '../src/core/pixel-buffer.js';

const CHUNK_CHARS = 0x8000;
function native(model) {
  const width = 131, height = 99, channels = model === 'rgb' ? 4 : 5;
  const count = width * height * channels;
  if (model === 'rgb') {
    const data = Uint16Array.from({ length:count }, (_, i) => (i * 1777 + 97) & 0xffff);
    return createPixelBuffer({width, height, model, channels, bitsPerChannel:16, data, alphaMode:'straight'});
  }
  const data = new Float32Array(count);
  const words = new Uint32Array(data.buffer);
  for (let i = 0; i < count; i++) words[i] = (0x3d002001 + i * 137) >>> 0;
  words[4] = 0x7f812345; // signaling NaN alpha
  words[9] = 0x80000000; // signed -0 alpha
  words[count - 1] = 0x7f811111; // last edge alpha
  return createPixelBuffer({width, height, model, channels, bitsPerChannel:32, data, alphaMode:'straight'});
}
function bytesOf(array) {
  return Buffer.from(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
}
function tileOracle(buffer, tile) {
  const source = bytesOf(buffer.data);
  const rowBytes = tile.width * buffer.channels * buffer.data.BYTES_PER_ELEMENT;
  const out = Buffer.alloc(rowBytes * tile.height);
  for (let y = 0; y < tile.height; y++) {
    const offset = ((tile.y + y) * buffer.width + tile.x) * buffer.channels * buffer.data.BYTES_PER_ELEMENT;
    source.copy(out, y * rowBytes, offset, offset + rowBytes);
  }
  return out;
}
function observeAtob(operation, replacement = null) {
  const original = globalThis.atob, inputs = [];
  globalThis.atob = input => {
    inputs.push(input.length);
    return replacement ? replacement(input, inputs.length, original) : original(input);
  };
  try { return { result:operation(), inputs }; }
  finally { globalThis.atob = original; }
}

test('003X/6c-3: actual native v1/v2 decode never passes a full Base64 string to atob', () => {
  for (const model of ['rgb', 'cmyk']) {
    const buffer = native(model), original = bytesOf(buffer.data);
    const v1 = serializePixelBufferSource(buffer);
    const { result:v1Bytes, inputs:v1Calls } = observeAtob(() =>
      dataUrlToBytes(v1.dataUrl, { maxBytes:original.length }));
    assert.ok(v1Calls.length > 1, 'large native v1 source must decode in multiple chunks');
    assert.ok(v1Calls.every(n => n <= CHUNK_CHARS), 'atob input is capped at 32 KiB of URL chars');
    assert.deepEqual(Buffer.from(v1Bytes), original);
    assert.deepEqual(bytesOf(deserializePixelBufferSource(JSON.parse(JSON.stringify(v1))).data), original);

    const v2 = serializeTiledPixelBufferSource(buffer, { tileSize:65 });
    assert.equal(v2.tiles.length, 6);
    assert.ok(v2.tiles.some(t => t.width === 1));
    assert.ok(v2.tiles.some(t => t.height === 34));
    for (const tile of v2.tiles) {
      const { result, inputs } = observeAtob(() =>
        dataUrlToBytes(tile.dataUrl, { maxBytes:tile.rawBytes }));
      assert.ok(inputs.every(n => n <= CHUNK_CHARS), 'each v2 tile has bounded decode chunks');
      assert.deepEqual(Buffer.from(result), tileOracle(buffer, tile));
    }
    assert.deepEqual(bytesOf(deserializePixelBufferSource(JSON.parse(JSON.stringify(v2))).data), original);
    assert.deepEqual(bytesOf(buffer.data), original, 'serialization and decoding do not touch source native bits');
  }
});

test('003X/6c-3: output is exact at chunk boundaries, with and without padding', () => {
  for (const length of [0, 1, 2, 3, 4, 0x6000-1, 0x6000, 0x6000+1, 0x6000+2, 0x6000*2+1]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 71 + 203) & 255);
    const url = bytesToDataUrl(bytes);
    const parsed = dataUrlToBytes(url, { maxBytes:length });
    assert.deepEqual(Buffer.from(parsed), Buffer.from(bytes), 'length '+length);
    const withoutPadding = url.replace(/=+$/, '');
    assert.deepEqual(Buffer.from(dataUrlToBytes(withoutPadding, { maxBytes:length })), Buffer.from(bytes));
  }
});

test('003X/6c-3: byte-budget and invalid late Base64 fail before atob chunks', () => {
  const bytes = Uint8Array.from({length:0x6000+4}, (_, i) => i & 255);
  const url = bytesToDataUrl(bytes);
  const { inputs } = observeAtob(() => {
    assert.throws(() => dataUrlToBytes(url, { maxBytes:bytes.length-1 }), /лимит/);
    assert.throws(() => dataUrlToBytes(url.slice(0,-1)+'?', { maxBytes:bytes.length+8 }), /Некорректный/);
    assert.throws(() => dataUrlToBytes(url.slice(0,-2)+'=A', { maxBytes:bytes.length+8 }), /Некорректный/);
    assert.throws(() => dataUrlToBytes(url.slice(0,-2)+'==A', { maxBytes:bytes.length+8 }), /Некорректный/);
  });
  assert.deepEqual(inputs, [], 'preflight does not call atob for oversize or malformed trailing input');
  for (const invalid of [
    'data:application/octet-stream;base64,A',
    'data:application/octet-stream;base64,AA=',
    'data:application/octet-stream;base64,AA===',
    'data:application/octet-stream;base64,AA?A',
    'data:application/octet-stream;base64,AAAA=',
    'data:application/octet-stream;base64,AAAA\n',
    'data:application/octet-stream;BASE64,AA=A',
  ]) assert.throws(() => dataUrlToBytes(invalid), /Некорректный/);
  assert.equal(dataUrlToBytes('data:;base64,').byteLength, 0);
});

test('003X/6c-3: later tile decoder failure cannot publish a partial native source', () => {
  for (const model of ['rgb', 'cmyk']) {
    const buffer = native(model), before = bytesOf(buffer.data);
    const source = serializeTiledPixelBufferSource(buffer, {tileSize:65});
    const original = globalThis.atob;
    let count = 0;
    globalThis.atob = input => {
      if (++count === 3) throw new Error('late tile decoder failure');
      return original(input);
    };
    try {
      assert.throws(() => deserializePixelBufferSource(source), /late tile decoder failure/);
      assert.ok(count === 3);
    } finally { globalThis.atob = original; }
    assert.deepEqual(bytesOf(buffer.data), before);
    assert.deepEqual(bytesOf(deserializePixelBufferSource(source).data), before,
      'same serialized source remains retryable and byte-exact after failure');
    assert.deepEqual(bytesOf(deserializePixelBufferSource(JSON.parse(JSON.stringify(source))).data), before);
  }
});
