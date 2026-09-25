import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer,
  createRgba8PixelBuffer,
  isPixelBuffer,
  pixelBufferByteLength,
  pixelBufferToRgba8Preview,
  serializePixelBufferSource,
  sanitizeSerializedPixelBufferSource,
  deserializePixelBufferSource,
  MAX_PIXEL_BUFFER_SOURCE_BYTES,
} from '../src/core/pixel-buffer.js';

test('PixelBuffer keeps RGBA8 data zero-copy for the current Canvas bridge', () => {
  const data=new Uint8ClampedArray([10,20,30,255,40,50,60,128]);
  const buffer=createRgba8PixelBuffer(2,1,data);
  assert.equal(isPixelBuffer(buffer),true);
  assert.equal(buffer.model,'rgb');
  assert.equal(buffer.channels,4);
  assert.equal(buffer.bitsPerChannel,8);
  assert.equal(buffer.sampleType,'uint');
  assert.equal(buffer.colorSpace,'srgb');
  assert.strictEqual(buffer.data,data);
  assert.strictEqual(pixelBufferToRgba8Preview(buffer),data);
  assert.equal(pixelBufferByteLength(buffer),8);
});

test('PixelBuffer converts 16-bit RGB to an 8-bit preview without changing source precision', () => {
  const data=new Uint16Array([0,32768,65535, 65535,0,32768]);
  const buffer=createPixelBuffer({width:2,height:1,model:'rgb',channels:3,bitsPerChannel:16,data,colorSpace:'srgb'});
  const preview=pixelBufferToRgba8Preview(buffer);
  assert.deepEqual([...preview],[0,128,255,255, 255,0,128,255]);
  assert.strictEqual(buffer.data,data);
  assert.equal(buffer.bitsPerChannel,16);
});

test('PixelBuffer accepts normalized 32-bit float RGBA and clamps preview only at the bridge', () => {
  const data=new Float32Array([-0.25,0.25,1.25,0.5]);
  const buffer=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,data,colorSpace:'linear-srgb'});
  assert.deepEqual([...pixelBufferToRgba8Preview(buffer)],[0,64,255,128]);
  assert.equal(buffer.data[0],-0.25);
  assert.equal(buffer.data[2],1.25);
  assert.equal(buffer.sampleType,'float');
});

test('PixelBuffer can carry CMYK precision but refuses fake RGB preview without color management', () => {
  const buffer=createPixelBuffer({
    width:1,height:1,model:'cmyk',channels:4,bitsPerChannel:16,
    data:new Uint16Array([0,12000,32000,5000]),colorSpace:'device-cmyk',profileName:'Unmanaged CMYK',
  });
  assert.equal(isPixelBuffer(buffer),true);
  assert.equal(buffer.model,'cmyk');
  assert.throws(() => pixelBufferToRgba8Preview(buffer),/color-management/);
});

test('PixelBuffer rejects mismatched channels, alpha semantics, sample types and lengths', () => {
  assert.throws(() => createPixelBuffer({width:1,height:1,model:'rgb',channels:2,bitsPerChannel:8}),RangeError);
  assert.throws(() => createPixelBuffer({width:1,height:1,model:'rgb',channels:3,bitsPerChannel:8,alphaMode:'straight'}),RangeError);
  assert.throws(() => createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,data:new Uint8ClampedArray(4)}),TypeError);
  assert.throws(() => createPixelBuffer({width:2,height:1,model:'rgb',channels:4,bitsPerChannel:8,data:new Uint8ClampedArray(4)}),RangeError);
});

test('Stage 12a serializes 16-bit and float PixelBuffers in canonical little-endian .zpe sources', () => {
  const source16=createPixelBuffer({width:2,height:1,model:'rgb',channels:3,bitsPerChannel:16,data:new Uint16Array([0,1,65535,32768,40000,7])});
  const packed16=serializePixelBufferSource(source16);
  assert.equal(packed16.kind,'zpe-pixel-buffer-source-v1');
  assert.equal(packed16.byteOrder,'little-endian');
  assert.equal(packed16.rawBytes,12);
  assert.deepEqual([...deserializePixelBufferSource(packed16).data],[0,1,65535,32768,40000,7]);
  const source32=createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-srgb',data:new Float32Array([-0.5,0.25,2,1])});
  const packed32=serializePixelBufferSource(source32);
  const roundTrip=deserializePixelBufferSource(packed32);
  assert.deepEqual([...roundTrip.data],[-0.5,0.25,2,1]);
  assert.equal(roundTrip.colorSpace,'linear-srgb');
});

test('serialized PixelBuffer sources are bounded and malformed payloads are rejected without decoding them', () => {
  const buffer=createPixelBuffer({width:2,height:1,model:'rgb',channels:3,bitsPerChannel:16,data:new Uint16Array(6)});
  assert.throws(()=>serializePixelBufferSource(buffer,{maxBytes:4}),RangeError);
  const packed=serializePixelBufferSource(buffer);
  assert.equal(sanitizeSerializedPixelBufferSource({...packed,rawBytes:999}),null);
  assert.equal(sanitizeSerializedPixelBufferSource({...packed,dataUrl:packed.dataUrl+'AAAA'}),null);
  assert.equal(MAX_PIXEL_BUFFER_SOURCE_BYTES,48*1024*1024);
});
