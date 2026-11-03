import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, serializePixelBufferSource, serializeTiledPixelBufferSource,
  deserializePixelBufferSource, forEachSerializedPixelBufferTile,
  forEachSerializedPixelBufferTileCooperative, deserializeEditablePixelBufferSource,
} from '../src/core/pixel-buffer.js';

function native(model) {
  const width = 131, height = 99, channels = model === 'rgb' ? 4 : 5;
  const count = width * height * channels;
  if (model === 'rgb') {
    const data = Uint16Array.from({ length:count }, (_, i) => (i * 1777 + 97) & 65535);
    data[3] = 0; data[count - 1] = 65535;
    return createPixelBuffer({ width, height, model, channels, bitsPerChannel:16, data });
  }
  const data = new Float32Array(count), words = new Uint32Array(data.buffer);
  for (let i = 0; i < count; i++) words[i] = (0x3d002001 + i * 137) >>> 0;
  words[4] = 0x7f812345; // signaling NaN alpha
  words[9] = 0x80000000; // negative zero alpha
  words[count - 1] = 0x7f811111; // edge-tile signaling NaN alpha
  return createPixelBuffer({ width, height, model, channels, bitsPerChannel:32, data });
}

function raw(data) {
  return Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
function tileRaw(buffer, tile) {
  const result = Buffer.alloc(tile.rawBytes);
  const stride = tile.width * buffer.channels * buffer.data.BYTES_PER_ELEMENT;
  const full = raw(buffer.data);
  for (let row = 0; row < tile.height; row++) {
    const start = ((tile.y + row) * buffer.width + tile.x) * buffer.channels * buffer.data.BYTES_PER_ELEMENT;
    full.copy(result, row * stride, start, start + stride);
  }
  return result;
}

// Observe real constructors in the production decode, not mock source bytes.
// dataUrlToBytes allocates one private Uint8Array(rawBytes); another full
// high-depth SampleArray(rawSamples) represents avoidable simultaneous ownership.
function observeDecodedBacking(bits, invoke) {
  const OriginalBytes = globalThis.Uint8Array;
  const name = bits === 16 ? 'Uint16Array' : 'Float32Array';
  const OriginalSamples = globalThis[name];
  const rawAllocations = [], extraSampleAllocations = [];
  globalThis.Uint8Array = new Proxy(OriginalBytes, {
    construct(target, args) {
      const value = Reflect.construct(target, args);
      if (typeof args[0] === 'number') rawAllocations.push(value);
      return value;
    },
  });
  globalThis[name] = new Proxy(OriginalSamples, {
    construct(target, args) {
      const value = Reflect.construct(target, args);
      if (typeof args[0] === 'number') extraSampleAllocations.push(value);
      return value;
    },
  });
  try { return { result:invoke(), rawAllocations, extraSampleAllocations }; }
  finally {
    globalThis.Uint8Array = OriginalBytes;
    globalThis[name] = OriginalSamples;
  }
}

test('003X/6c-4: v1 high-depth decoder adopts its private raw backing without another full-sized plane', () => {
  for (const model of ['rgb', 'cmyk']) {
    const sourceBuffer = native(model), expected = raw(sourceBuffer.data);
    const source = JSON.parse(JSON.stringify(serializePixelBufferSource(sourceBuffer)));
    const { result, rawAllocations, extraSampleAllocations } =
      observeDecodedBacking(source.bitsPerChannel, () => deserializeEditablePixelBufferSource(source));
    const decodedRaw = rawAllocations.filter(b => b.byteLength === source.rawBytes);
    assert.equal(decodedRaw.length, 1, 'one private full raw byte buffer is decoded');
    assert.equal(extraSampleAllocations.filter(d => d.byteLength === source.rawBytes).length, 0,
      'no second full 16/32-bit array allocation');
    assert.strictEqual(result.data.buffer, decodedRaw[0].buffer, 'decoded bytes become the typed pixel backing');
    assert.deepEqual(raw(result.data), expected, 'sNaN, signed zero and alpha raw bits remain exact');
    const second = deserializePixelBufferSource(source);
    result.data[0] = model === 'rgb' ? 123 : 0.25;
    assert.deepEqual(raw(second.data), expected, 'each decode owns a separate writable backing');
    assert.deepEqual(raw(sourceBuffer.data), expected, 'source native pixels remain unchanged');
    assert.deepEqual(raw(deserializePixelBufferSource(source).data), expected, 'saved .zpe v1 is unchanged');
  }
});

test('003X/6c-4: sparse/edge/dense v2 tiles use one backing per decoded tile; assembled plane is exact', () => {
  for (const model of ['rgb', 'cmyk']) {
    const sourceBuffer = native(model), expected = raw(sourceBuffer.data);
    for (const tileSize of [65, 131, 256]) {
      const source = JSON.parse(JSON.stringify(serializeTiledPixelBufferSource(sourceBuffer, { tileSize })));
      const seen = [];
      const { rawAllocations, extraSampleAllocations } =
        observeDecodedBacking(source.bitsPerChannel, () => forEachSerializedPixelBufferTile(source, ({ index, buffer }) => {
          seen.push({ index, buffer, backing:buffer.data.buffer });
        }));
      assert.equal(seen.length, source.tiles.length);
      assert.equal(extraSampleAllocations.length, 0, 'tile decoding does not create copy planes');
      for (const { index, buffer, backing } of seen) {
        const tile = source.tiles[index];
        assert.strictEqual(backing, rawAllocations[index].buffer);
        assert.deepEqual(raw(buffer.data), tileRaw(sourceBuffer, tile), 'exact native edge/alpha bits');
      }
      assert.deepEqual(raw(deserializePixelBufferSource(source).data), expected, 'full v2 assembly remains exact');
      assert.deepEqual(raw(sourceBuffer.data), expected, 'tile traversal does not mutate input');
    }
  }
});

test('003X/6c-4: cooperative cancellation and later tile decode failure keep serialized input retryable', async () => {
  for (const model of ['rgb', 'cmyk']) {
    const sourceBuffer = native(model), expected = raw(sourceBuffer.data);
    const source = serializeTiledPixelBufferSource(sourceBuffer, { tileSize:65 });
    const before = JSON.stringify(source);
    const originalAtob = globalThis.atob;
    let calls = 0;
    globalThis.atob = value => {
      if (++calls === 3) throw new Error('injected late native decode failure');
      return originalAtob(value);
    };
    try {
      assert.throws(() => forEachSerializedPixelBufferTile(source, () => {}), /injected late native decode failure/);
    } finally { globalThis.atob = originalAtob; }
    assert.equal(JSON.stringify(source), before, 'late failure cannot mutate v2 source');
    let cancelled = false, visited = 0;
    const completed = await forEachSerializedPixelBufferTileCooperative(source,
      () => { visited++; }, { batchTiles:1, isCancelled:() => cancelled,
        yieldControl:async () => { cancelled = true; } });
    assert.equal(completed, false);
    assert.equal(visited, 1, 'cancelled traversal skips remaining tile callbacks');
    assert.equal(JSON.stringify(source), before);
    assert.deepEqual(raw(deserializePixelBufferSource(source).data), expected, 'clean retry after failure/cancel');
  }
});
