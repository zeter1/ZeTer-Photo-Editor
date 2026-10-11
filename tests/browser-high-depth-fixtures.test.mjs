import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserHighDepthFixture } from '../tools/browser-high-depth-fixtures.mjs';
import { decodePsd, inspectPsdHeader } from '../src/formats/psd.js';
import { PIXEL_BUFFER_TILED_SOURCE_MIN_BYTES, serializePixelBufferSourceAdaptive } from '../src/core/pixel-buffer.js';

test('Stage 003: browser PSD16 and PSB32 smoke fixtures preserve exact native bytes through binary decoding', async () => {
  for (const key of ['rgb16','rgb32psb']) {
    const item=createBrowserHighDepthFixture(key);
    const header=inspectPsdHeader(item.bytes);
    assert.equal(header.version,item.version,item.filename);
    assert.equal(header.bitsPerChannel,item.bitsPerChannel,item.filename);
    const decoded=await decodePsd(item.bytes);
    assert.equal(decoded.layers.length,1,item.filename);
    const native=decoded.layers[0].pixelBuffer;
    assert.equal(native.bitsPerChannel,item.bitsPerChannel);
    assert.equal(native.data.constructor.name,item.nativeArrayType);
    const index=(item.defectY*item.width+item.defectX)*item.channels;
    assert.deepEqual(Array.from(native.data.slice(0,item.channels)),item.normal);
    assert.deepEqual(Array.from(native.data.slice(index,index+item.channels)),item.damaged);
  }
});

test('Stage 003: fixture builder rejects unspecified formats', () => {
  assert.throws(() => createBrowserHighDepthFixture('unknown'),/Unknown browser high-depth fixture/);
});

test('Stage 003: large ZeTer PSD16 fixture decodes beyond the 8 MiB native v2 threshold', async () => {
  const item=createBrowserHighDepthFixture('rgb16large');
  assert.equal(item.width,1025);
  assert.equal(item.height,1025);
  assert.equal(item.version,1);
  const header=inspectPsdHeader(item.bytes);
  assert.equal(header.bitsPerChannel,16);
  const decoded=await decodePsd(item.bytes);
  const native=decoded.layers[0].pixelBuffer;
  assert.ok(native.data.byteLength>PIXEL_BUFFER_TILED_SOURCE_MIN_BYTES);
  assert.equal(native.data.constructor,Uint16Array);
  const index=(item.defectY*item.width+item.defectX)*item.channels;
  const nearby=((item.defectY+5)*item.width+item.defectX)*item.channels;
  assert.deepEqual(Array.from(native.data.slice(index,index+4)),item.damaged);
  assert.deepEqual(Array.from(native.data.slice(nearby,nearby+4)),item.normal);
  const serialized=serializePixelBufferSourceAdaptive(native);
  assert.equal(serialized.kind,'zpe-pixel-buffer-source-v2');
  assert.equal(serialized.rawBytes,native.data.byteLength);
  assert.ok(serialized.tiles.length>1);
});
