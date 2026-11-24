import test from 'node:test';
import assert from 'node:assert/strict';
import { bytesToDataUrl, encodedDataUrlChars, dataUrlToBytes } from '../src/core/io.js';
import {
  createPixelBuffer, serializePixelBufferSource, serializeTiledPixelBufferSource,
  deserializePixelBufferSource, PIXEL_BUFFER_TILE_MIME,
} from '../src/core/pixel-buffer.js';

// Observe actual production Array#join results. This proves retained full-length
// intermediate strings by caller, NOT V8 heap bytes, flattening or peak RSS.
function observeJoins(operation) {
  const original = Array.prototype.join;
  const joins = [];
  Array.prototype.join = function (separator) {
    const result = original.call(this, separator);
    joins.push({ length:result.length, url:result.startsWith('data:') });
    return result;
  };
  try { return { value:operation(), joins }; }
  finally { Array.prototype.join = original; }
}

function native(model) {
  const width = 131, height = 99;
  const channels = model === 'rgb' ? 4 : 5;
  const count = width * height * channels;
  if (model === 'rgb') {
    return createPixelBuffer({
      width, height, model, channels, bitsPerChannel:16, alphaMode:'straight',
      data:Uint16Array.from({ length:count }, (_, i) => (i * 8191 + 997) & 65535),
    });
  }
  const data = new Float32Array(count);
  const words = new Uint32Array(data.buffer);
  for (let i = 0; i < count; i++) words[i] = (0x3d000000 + i * 73) >>> 0;
  words[4] = 0x7f812345; // signaling NaN alpha payload
  words[9] = 0x80000000; // -0 alpha
  words[count - 1] = 0x7f811111; // last edge alpha
  return createPixelBuffer({ width, height, model, channels, bitsPerChannel:32,
    alphaMode:'straight', data });
}

function nativeBytes(data) {
  return Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}

function oracleTile(buffer, tile) {
  const bytes = nativeBytes(buffer.data);
  const rowBytes = tile.width * buffer.channels * buffer.data.BYTES_PER_ELEMENT;
  const raw = Buffer.alloc(rowBytes * tile.height);
  for (let y = 0; y < tile.height; y++) {
    const start = ((tile.y + y) * buffer.width + tile.x)
      * buffer.channels * buffer.data.BYTES_PER_ELEMENT;
    bytes.copy(raw, y * rowBytes, start, start + rowBytes);
  }
  return raw;
}

test('003X/6c-2: production native v1/v2 join only the final full data URL', () => {
  for (const model of ['rgb', 'cmyk']) {
    const buffer = native(model);
    const initial = nativeBytes(buffer.data);
    const { value:v1, joins:v1Joins } = observeJoins(() => serializePixelBufferSource(buffer));
    assert.deepEqual(v1Joins, [{ length:v1.dataUrl.length, url:true }], 'v1 must not join a second full-length Base64 string');
    assert.equal(v1.dataUrl.length, encodedDataUrlChars(initial.length, 'application/x-zeter-pixel-buffer'));
    assert.deepEqual(Buffer.from(dataUrlToBytes(v1.dataUrl, { maxBytes:initial.length })), initial);

    const { value:v2, joins:v2Joins } = observeJoins(() =>
      serializeTiledPixelBufferSource(buffer, { tileSize:65 }));
    assert.equal(v2.tiles.length, 6, 'dense and sparse edge tiles');
    assert.ok(v2.tiles.some(t => t.width === 1), 'right-edge tiles');
    assert.ok(v2.tiles.some(t => t.height === 34), 'bottom-edge tiles');
    assert.deepEqual(v2Joins, v2.tiles.map(tile => ({ length:tile.dataUrl.length, url:true })),
      'one joined output URL per encoded tile; no separate full Base64 join');
    for (const tile of v2.tiles) {
      assert.equal(tile.dataUrl.length, encodedDataUrlChars(tile.rawBytes, PIXEL_BUFFER_TILE_MIME));
      assert.deepEqual(Buffer.from(dataUrlToBytes(tile.dataUrl, { maxBytes:tile.rawBytes })),
        oracleTile(buffer, tile), 'independent backing-byte oracle preserves alpha/NaN/-0');
    }
    assert.deepEqual(nativeBytes(deserializePixelBufferSource(JSON.parse(JSON.stringify(v2))).data),
      initial, 'v2 JSON re-open is byte-exact');
    assert.deepEqual(nativeBytes(buffer.data), initial, 'source buffer stays untouched');
  }
});

test('003X/6c-2: late encoder failure does not join a partial URL or mutate native source', () => {
  for (const model of ['rgb', 'cmyk']) {
    const buffer = native(model);
    const initial = nativeBytes(buffer.data);
    const original = globalThis.btoa;
    // A full 65x65 CMYKA32 tile takes four chunks, RGB16 takes two.
    // Inject specifically in the NEXT tile after the first has been joined.
    const firstTileBytes = 65 * 65 * buffer.channels * buffer.data.BYTES_PER_ELEMENT;
    const failAt = Math.ceil(firstTileBytes / 0x6000) + 1;
    let encodes = 0;
    globalThis.btoa = chunk => {
      if (++encodes === failAt) throw new Error('late tile encoder failure');
      return original(chunk);
    };
    try {
      const { joins } = observeJoins(() => {
        assert.throws(() => serializeTiledPixelBufferSource(buffer, { tileSize:65 }),
          /late tile encoder failure/);
      });
      assert.equal(encodes, failAt, 'first native tile encoded, second failed');
      assert.equal(joins.length, 1, 'first tile URL joined; failed tile has no partial URL');
    } finally { globalThis.btoa = original; }
    assert.deepEqual(nativeBytes(buffer.data), initial);
    const restored = deserializePixelBufferSource(serializeTiledPixelBufferSource(buffer, {tileSize:65}));
    assert.deepEqual(nativeBytes(restored.data), initial, 'fresh save after failure restores all native bits');
  }
});

test('003X/6c-2: explicit URL budget refuses before btoa/join for large native bytes', () => {
  const buffer = native('cmyk');
  const bytes = nativeBytes(buffer.data);
  const required = encodedDataUrlChars(bytes.byteLength);
  const original = globalThis.btoa;
  globalThis.btoa = () => { throw new Error('unexpected encode'); };
  try {
    const { joins } = observeJoins(() =>
      assert.throws(() => bytesToDataUrl(bytes, undefined, {maxDataUrlChars:required - 1}),
        /maxDataUrlChars/));
    assert.deepEqual(joins, []);
  } finally { globalThis.btoa = original; }
  const { value:url, joins } = observeJoins(() =>
    bytesToDataUrl(bytes, undefined, {maxDataUrlChars:required}));
  assert.deepEqual(joins, [{length:required, url:true}]);
  assert.deepEqual(Buffer.from(dataUrlToBytes(url, {maxBytes:bytes.length})), bytes);
});
