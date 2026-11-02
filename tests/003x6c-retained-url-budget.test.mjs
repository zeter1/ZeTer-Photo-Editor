import test from 'node:test';
import assert from 'node:assert/strict';
import { bytesToDataUrl, dataUrlToBytes, encodedDataUrlChars } from '../src/core/io.js';
import {
  createPixelBuffer, serializePixelBufferSource, serializeTiledPixelBufferSource,
  serializePixelBufferSourceAdaptive, deserializePixelBufferSource,
  createSerializedPixelBufferTileWorkingSet,
} from '../src/core/pixel-buffer.js';

// Oracle reads native backing bytes, never JS Float32 numbers (which can quiet sNaNs).
function rawBytes(data) {
  return Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}

function tileBytes(data, imageWidth, channels, tile) {
  const sampleBytes = data.BYTES_PER_ELEMENT;
  const raw = rawBytes(data);
  const rowLength = tile.width * channels * sampleBytes;
  const result = Buffer.alloc(rowLength * tile.height);
  for (let y = 0; y < tile.height; y += 1) {
    const start = ((tile.y + y) * imageWidth + tile.x) * channels * sampleBytes;
    raw.copy(result, y * rowLength, start, start + rowLength);
  }
  return result;
}

function makeNative(model) {
  const channels = model === 'rgb' ? 4 : 5;
  const width = 17, height = 11, samples = width * height * channels;
  if (model === 'rgb') {
    const data = Uint16Array.from({ length:samples }, (_, i) => (i * 8191 + 347) & 65535);
    return createPixelBuffer({ width, height, model, channels, bitsPerChannel:16, alphaMode:'straight', data });
  }
  const data = new Float32Array(samples);
  const bits = new Uint32Array(data.buffer);
  for (let i = 0; i < samples; i++) bits[i] = 0x3e000000 + i * 97;
  bits[4] = 0x7f812345; // signaling NaN in alpha
  bits[9] = 0x80000000; // negative zero in alpha
  bits[14] = 0x7fc01234;
  bits[bits.length-1] = 0x7f811111; // signaling NaN on final edge tile
  return createPixelBuffer({ width, height, model, channels, bitsPerChannel:32, alphaMode:'straight', data });
}

test('003X/6c: encoded URL length predicts exact retained ASCII characters and refuses before btoa', () => {
  const original = globalThis.btoa;
  let calls = 0;
  globalThis.btoa = value => { calls++; return original(value); };
  try {
    for (const count of [0, 1, 2, 3, 0x6000 - 1, 0x6000, 0x6001, 0x6000 * 3 + 2]) {
      const bytes = Uint8Array.from({length:count}, (_, i) => (i * 41 + 13) & 255);
      const required = encodedDataUrlChars(count);
      const before = calls;
      assert.throws(() => bytesToDataUrl(bytes, undefined, { maxDataUrlChars: required - 1 }), /maxDataUrlChars/);
      assert.equal(calls, before, 'refuse without calling btoa or creating Base64 chunks');
      const url = bytesToDataUrl(bytes, undefined, { maxDataUrlChars: required });
      assert.equal(url.length, required);
      assert.equal(url, 'data:application/octet-stream;base64,' + Buffer.from(bytes).toString('base64'));
    }
    assert.throws(() => encodedDataUrlChars(Number.MAX_SAFE_INTEGER), RangeError);
    assert.throws(() => bytesToDataUrl(new Uint8Array(1), undefined, { maxDataUrlChars:'100' }), RangeError);
  } finally {
    globalThis.btoa = original;
  }
});

test('003X/6c: native RGB16 and CMYKA32 sparse, edge and dense tiles preflight aggregate URLs before ANY encode', () => {
  for (const model of ['rgb', 'cmyk']) {
    const buffer = makeNative(model);
    const options = { tileSize:4 };
    const source = serializeTiledPixelBufferSource(buffer, options);
    assert.ok(source.tiles.length >= 12, 'dense multi-tile source');
    assert.ok(source.tiles.some(tile => tile.width < 4 || tile.height < 4), 'noncontiguous edge tiles');
    const count = source.tiles.reduce((sum, tile) => sum + tile.dataUrl.length, 0);
    const oracleCount = source.tiles.reduce((sum, tile) => sum +
      ('data:application/x-zeter-pixel-tile;base64,'.length + 4*Math.ceil(tile.rawBytes/3)), 0);
    // The MIME prefix itself is tested separately by the persisted string readback.
    assert.ok(count > source.rawBytes, 'retained URL characters exceed native raw-byte count');
    assert.ok(count >= oracleCount - source.tiles.length*80);
    const unchanged = rawBytes(buffer.data);
    const originalBtoa = globalThis.btoa;
    let calls = 0;
    globalThis.btoa = () => { calls++; throw new Error('unexpected Base64 encoder'); };
    try {
      assert.throws(() => serializeTiledPixelBufferSource(buffer, { ...options, maxDataUrlChars:count-1 }), /maxDataUrlChars/);
      assert.throws(() => serializePixelBufferSourceAdaptive(buffer, {
        ...options, tiledThresholdBytes:1, maxDataUrlChars:count-1,
      }), /maxDataUrlChars/);
      assert.throws(() => serializeTiledPixelBufferSource(buffer, { ...options, maxDataUrlChars:-1 }), /maxDataUrlChars/);
      assert.equal(calls, 0, 'entire source budget rejects before the first sparse/edge/dense tile encoding');
    } finally {
      globalThis.btoa = originalBtoa;
    }
    assert.deepEqual(rawBytes(buffer.data), unchanged, 'failure never mutates original native bytes');
    const accepted = serializeTiledPixelBufferSource(buffer, { ...options, maxDataUrlChars:count });
    assert.deepEqual(accepted, source, 'exact-bound serialization is deterministic');
    for (const tile of accepted.tiles) {
      const oracle = tileBytes(buffer.data, buffer.width, buffer.channels, tile);
      assert.deepEqual(Buffer.from(dataUrlToBytes(tile.dataUrl)), oracle, 'native tile bits including alpha');
      assert.equal(tile.dataUrl, 'data:' + tile.dataUrl.split(';')[0].slice(5) + ';base64,' + oracle.toString('base64'));
    }
    const restored = deserializePixelBufferSource(JSON.parse(JSON.stringify(accepted)));
    assert.deepEqual(rawBytes(restored.data), unchanged, '.zpe v2 JSON round-trip is byte-exact');
  }
});

test('003X/6c: legacy .zpe v1 + adaptive v1 obey exact source URL budget, without lost native bits', () => {
  for (const model of ['rgb', 'cmyk']) {
    const buffer = makeNative(model);
    const original = serializePixelBufferSource(buffer);
    const dataUrlLength = original.dataUrl.length;
    let calls = 0;
    const btoa = globalThis.btoa;
    globalThis.btoa = () => { calls++; throw new Error('unexpected Base64 encoder'); };
    try {
      assert.throws(() => serializePixelBufferSource(buffer, { maxDataUrlChars:dataUrlLength-1 }), /maxDataUrlChars/);
      assert.throws(() => serializePixelBufferSourceAdaptive(buffer, {
        tiledThresholdBytes:Number.MAX_SAFE_INTEGER, maxDataUrlChars:dataUrlLength-1,
      }), /maxDataUrlChars/);
      assert.equal(calls, 0);
    } finally { globalThis.btoa = btoa; }
    const accepted = serializePixelBufferSource(buffer, { maxDataUrlChars:dataUrlLength });
    assert.deepEqual(accepted, original);
    assert.deepEqual(rawBytes(deserializePixelBufferSource(JSON.parse(JSON.stringify(accepted))).data),
      rawBytes(buffer.data), '.zpe v1 is bit-exact');
  }
});

test('003X/6c: refused source snapshot does not invalidate dirty cached native edits or Undo source', () => {
  for (const model of ['rgb', 'cmyk']) {
    const buffer = makeNative(model);
    const original = serializeTiledPixelBufferSource(buffer, {tileSize:4});
    const work = createSerializedPixelBufferTileWorkingSet(original, {maxResidentBytes:original.tiles[0].rawBytes});
    const selected = original.tiles[0];
    assert.equal(work.visit({left:0,top:0,right:selected.width,bottom:selected.height},
      ({buffer:tile}) => { tile.data[0] = model === 'rgb' ? 45555 : Math.fround(1.125); return 1; }), 1);
    const expected = work.serialize();
    const originalNative = rawBytes(deserializePixelBufferSource(original).data);
    const dirtyNative = rawBytes(deserializePixelBufferSource(expected).data);
    assert.notDeepEqual(dirtyNative, originalNative);
    assert.throws(() => serializeTiledPixelBufferSource(buffer, {
      tileSize:4, maxDataUrlChars:1,
    }), /maxDataUrlChars/);
    assert.deepEqual(work.serialize(), expected, 'failed independent snapshot does not change dirty state');
    assert.deepEqual(rawBytes(deserializePixelBufferSource(work.serialize()).data), dirtyNative);
    assert.deepEqual(rawBytes(deserializePixelBufferSource(original).data), originalNative,
      'original native source remains Undo snapshot');
  }
});
