import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDng, inspectDng, developDng} from '../src/formats/dng.js';

import {fixture} from './fixtures/dng-fixture.mjs';

test('uncompressed 8-bit RGGB DNG demosaics to visible RGBA with alpha',()=>{
  const b=fixture();
  const source=inspectDng(b);
  assert.deepEqual([source.width,source.height,source.bits,source.pattern.join(',')],[4,4,8,'0,1,1,2']);
  const developed=developDng(source);
  assert.equal(developed.rgba.length,64);
  assert.equal(developed.rgba[3],255);
  assert.ok(developed.rgba[0]>developed.rgba[1] && developed.rgba[1]>developed.rgba[2]);
  assert.ok(developed.rgba[0]>0);
});
test('16-bit big-endian CFA and distinct WB/exposure produce new pixels without changing source',()=>{
  const bytes=fixture({le:false,bits:16,pattern:[2,1,1,0]});
  const original=bytes.slice(0);
  const decoded=decodeDng(bytes);
  const warmer=decodeDng(bytes,{exposure:1,wbRed:1.5,wbBlue:0.5});
  assert.deepEqual(new Uint8Array(bytes),new Uint8Array(original));
  assert.ok(warmer.rgba[0]>decoded.rgba[0]);
  assert.ok(warmer.rgba[2]<decoded.rgba[2]*2);
  assert.equal(warmer.rgba[3],255);
});
test('rejects compressed, truncated, TIFF without DNG version and unsupported CFA',()=>{
  assert.throws(()=>inspectDng(fixture({compression:7})),/сжатые DNG/);
  assert.throws(()=>inspectDng(fixture({truncated:true})),/усечённая|некорректная/);
  const notDng=fixture();
  new DataView(notDng).setUint16(10+12*12,50705,true);
  assert.throws(()=>inspectDng(notDng),/не DNG/);
  assert.throws(()=>inspectDng(fixture({pattern:[0,0,1,2]})),/2×2 Bayer/);
});
test('rejects invalid exposure/white balance without editing RAW',()=>{
  const source=inspectDng(fixture());
  assert.throws(()=>developDng(source,{exposure:99}),/параметры/);
  assert.throws(()=>developDng(source,{wbRed:NaN}),/параметры/);
});
