import test from 'node:test';
import assert from 'node:assert/strict';
import { bytesToDataUrl, dataUrlToBytes } from '../src/core/io.js';
import {
  createPixelBuffer, serializeTiledPixelBufferSource, deserializePixelBufferSource,
} from '../src/core/pixel-buffer.js';

test('binary data URL: chunk boundaries preserve exact bytes and bound each btoa input', () => {
  const original = globalThis.btoa;
  const seen = [];
  globalThis.btoa = value => {
    seen.push(value.length);
    assert.ok(value.length <= 0x6000, 'btoa must never receive a complete large tile');
    return original(value);
  };
  try {
    for (const length of [0, 1, 2, 3, 0x6000 - 1, 0x6000, 0x6000 + 1, 0x6000 + 2, 0x6000 * 13 + 2]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 53 + 197) & 255);
      const url = bytesToDataUrl(bytes, 'application/octet-stream');
      assert.equal(url, 'data:application/octet-stream;base64,' + Buffer.from(bytes).toString('base64'));
      assert.deepEqual(dataUrlToBytes(url, { maxBytes:bytes.byteLength + 1 }), bytes);
    }
    assert.ok(seen.length > 13, 'large sources must be chunked');
  } finally {
    globalThis.btoa = original;
  }
});

test('RGB16 and CMYKA32 tiled canonical bytes survive chunked encoding', () => {
  for (const config of [
    { model:'rgb', channels:4, bitsPerChannel:16, width:41, height:31 },
    { model:'cmyk', channels:5, bitsPerChannel:32, width:35, height:29 },
  ]) {
    const samples = config.width * config.height * config.channels;
    const data = config.bitsPerChannel === 16 ? new Uint16Array(samples) : new Float32Array(samples);
    for (let i=0; i<samples; i+=1) data[i] = config.bitsPerChannel === 16
      ? (i * 733 + 1229) & 65535 : ((i % 121) - 60) / 63;
    const buffer = createPixelBuffer({ ...config, data });
    const source = serializeTiledPixelBufferSource(buffer, { tileSize:7, maxBytes:1024 * 1024 });
    assert.ok(source.tiles.length > 1);
    const decoded = deserializePixelBufferSource(source, { maxBytes:1024 * 1024 });
    assert.deepEqual(Array.from(decoded.data), Array.from(data));
  }
});

test('an encoder failure after a successful chunk aborts instead of producing a partial URL', () => {
  const original = globalThis.btoa;
  let count = 0;
  globalThis.btoa = value => {
    count += 1;
    if (count === 2) throw new Error('encoder injection');
    return original(value);
  };
  try {
    const bytes = new Uint8Array(0x6000 * 2 + 3);
    assert.throws(() => bytesToDataUrl(bytes), /encoder injection/);
    assert.equal(count, 2);
  } finally {
    globalThis.btoa = original;
  }
});
