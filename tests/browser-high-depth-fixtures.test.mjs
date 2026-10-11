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

test('Stage 003: large ZeTer PSB32 Float32 decodes with exact LE bits and adaptive v2 tiles', async () => {
  const item=createBrowserHighDepthFixture('rgb32psblarge');
  assert.equal(item.version,2);
  assert.equal(item.bitsPerChannel,32);
  assert.equal(item.width,1025);
  assert.equal(item.height,1025);
  const rawBytes=item.width*item.height*item.channels*4;
  assert.ok(rawBytes>PIXEL_BUFFER_TILED_SOURCE_MIN_BYTES && rawBytes<48*1024*1024);
  const header=inspectPsdHeader(item.bytes);
  assert.equal(header.version,2);
  assert.equal(header.bitsPerChannel,32);
  const decoded=await decodePsd(item.bytes);
  assert.equal(decoded.layers.length,1);
  const native=decoded.layers[0].pixelBuffer;
  assert.equal(native.data.constructor,Float32Array);
  assert.equal(native.data.byteLength,rawBytes);
  const index=(x,y)=>(y*item.width+x)*item.channels;
  const samples=(x,y)=>Array.from(native.data.slice(index(x,y),index(x,y)+item.channels));
  assert.deepEqual(samples(0,0),item.normal);
  assert.deepEqual(samples(item.width-1,item.height-1),item.normal);
  assert.deepEqual(samples(item.defectX,item.defectY),item.damaged);
  assert.deepEqual(samples(item.defectX+5,item.defectY),item.normal);
  const word=(x,y,ch)=>new DataView(native.data.buffer,native.data.byteOffset)
    .getUint32((index(x,y)+ch)*4,true);
  const floatBits=value=>new DataView(new Float32Array([value]).buffer).getUint32(0,true);
  for(const [x,y,values] of [
    [0,0,item.normal],
    [item.defectX,item.defectY,item.damaged],
    [item.width-1,item.height-1,item.normal],
  ])for(let ch=0;ch<item.channels;ch++)
    assert.equal(word(x,y,ch),floatBits(values[ch]),'LE Float32 channel bit parity');
  const source=serializePixelBufferSourceAdaptive(native);
  assert.equal(source.kind,'zpe-pixel-buffer-source-v2');
  assert.equal(source.bitsPerChannel,32);
  assert.equal(source.rawBytes,rawBytes);
  assert.ok(source.tiles.length>1);
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


test('010D-D: two independent native PSB32 fixtures keep distinct exact Float32 samples', async () => {
  const first=createBrowserHighDepthFixture('rgb32psblarge');
  const second=createBrowserHighDepthFixture('rgb32psblarge-alt');
  assert.equal(second.version,2);
  assert.equal(second.bitsPerChannel,32);
  assert.equal(second.width,first.width);
  assert.equal(second.height,first.height);
  assert.notEqual(second.filename,first.filename);
  assert.notDeepEqual(second.normal,first.normal);
  assert.notDeepEqual(second.damaged,first.damaged);
  assert.notEqual(Buffer.compare(second.bytes,first.bytes),0,'distinct Float32 samples must change binary PSB payload');
  const decoded=await decodePsd(second.bytes);
  const native=decoded.layers[0].pixelBuffer;
  assert.equal(native.data.constructor,Float32Array);
  const samples=(x,y)=>Array.from(native.data.slice((y*second.width+x)*4,(y*second.width+x)*4+4));
  assert.deepEqual(samples(0,0),second.normal);
  assert.deepEqual(samples(second.defectX,second.defectY),second.damaged);
  assert.deepEqual(samples(second.width-1,second.height-1),second.normal);
  assert.equal(serializePixelBufferSourceAdaptive(native).kind,'zpe-pixel-buffer-source-v2');
});
