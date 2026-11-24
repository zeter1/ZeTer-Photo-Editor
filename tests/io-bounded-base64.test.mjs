import test from 'node:test';
import assert from 'node:assert/strict';
import { bytesToDataUrl, dataUrlToBytes } from '../src/core/io.js';
import {
  createPixelBuffer, serializeTiledPixelBufferSource, deserializePixelBufferSource,
  createSerializedPixelBufferTileWorkingSet,
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

test('003X/5: a later dirty LRU eviction encoding failure keeps BOTH earlier tiles live', () => {
  for (const config of [
    { model:'rgb', channels:3, bitsPerChannel:16, value:65011 },
    { model:'cmyk', channels:5, bitsPerChannel:32, value:Math.fround(11.25) },
  ]) {
    const samples = 3 * 3 * config.channels;
    const data = config.bitsPerChannel === 16
      ? Uint16Array.from({ length:samples }, (_, i) => (i * 107 + 19) & 65535)
      : Float32Array.from({ length:samples }, (_, i) => Math.fround((i - 23) / 13));
    const source = serializeTiledPixelBufferSource(createPixelBuffer({
      ...config, width:3, height:3, data,
    }), { tileSize:2 });
    // Tile 0 is 2×2; tiles 1 and 2 are 1×2 and 2×1 respectively.
    // The two smaller dirty tiles fit together but loading tile 0 must
    // evict both of them, not just one.
    const work = createSerializedPixelBufferTileWorkingSet(source, {
      maxResidentBytes:source.tiles[0].rawBytes,
    });
    for (const index of [1, 2]) {
      const tile=source.tiles[index];
      assert.equal(work.visit({
        left:tile.x, top:tile.y, right:tile.x+tile.width, bottom:tile.y+tile.height,
      }, ({buffer}) => { buffer.data[0]=config.value+index; return 1; }), 1);
    }
    assert.equal(work.loadedTileCount,2);
    assert.equal(work.writtenBackTileCount,0);
    const before=work.serialize();
    const originalBtoa=globalThis.btoa;
    let encodes=0;
    globalThis.btoa=bytes=>{
      encodes++;
      if (encodes===2) throw new Error('second LRU writeback failed');
      return originalBtoa(bytes);
    };
    try {
      assert.throws(()=>work.readRegion({left:0,top:0,right:2,bottom:2}),
        /second LRU writeback failed/);
      assert.equal(encodes,2,'first victim was already encoded when second failed');
    } finally {
      globalThis.btoa=originalBtoa;
    }
    assert.equal(work.loadedTileCount,2,'failed planning did not remove either dirty tile');
    assert.equal(work.writtenBackTileCount,0,'no partial writeback was published');
    assert.equal(work.dirtyTileCount,2);
    assert.equal(work.residentTileBytes,source.tiles[0].rawBytes);
    assert.deepEqual(work.serialize(),before,'failed cache load kept exact native edits');
    const restored=deserializePixelBufferSource(JSON.parse(JSON.stringify(work.serialize())));
    for (const index of [1,2]) {
      const tile=source.tiles[index];
      assert.equal(restored.data[(tile.y*3+tile.x)*config.channels],config.value+index);
    }
    assert.deepEqual([...deserializePixelBufferSource(source).data],[...data],
      'original serialized source remains the exact Undo snapshot');
  }
});
