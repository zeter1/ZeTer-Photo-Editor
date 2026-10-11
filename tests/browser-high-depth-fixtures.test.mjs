import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserHighDepthFixture } from '../tools/browser-high-depth-fixtures.mjs';
import { decodePsd, inspectPsdHeader } from '../src/formats/psd.js';

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
