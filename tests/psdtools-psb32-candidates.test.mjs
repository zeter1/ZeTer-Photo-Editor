import test from 'node:test';
import assert from 'node:assert/strict';
import {PSDTOOLS_CASES,verifyExternalPsbHeader,fingerprintNativeLayers}
  from '../tools/verify-psdtools-psb32-candidates.mjs';

const synthetic=()=>{
  const a=Buffer.alloc(26);
  a.write('8BPS');
  a.writeUInt16BE(2,4);
  a.writeUInt16BE(3,12);
  a.writeUInt32BE(150,14);
  a.writeUInt32BE(100,18);
  a.writeUInt16BE(32,22);
  a.writeUInt16BE(3,24);
  return a;
};
const syntheticSpec=bytes=>({size:bytes.length,version:2,width:100,height:150,
  sha256:'fake-sha-is-deliberately-rejected'});
test('002B/2b rejects non-pinned and malformed external high-depth headers',()=>{
  const validLooking=synthetic();
  assert.throws(()=>verifyExternalPsbHeader(validLooking,syntheticSpec(validLooking)),/SHA-256/);
  for(const name of ['32bit.psb','32bit.psd','32bit5x5.psb']) {
    const spec=PSDTOOLS_CASES.find(x=>x.name===name);
    assert.match(spec.sha256,/^[0-9a-f]{64}$/);
    assert.ok(spec.size>26);
  }
  assert.notEqual(PSDTOOLS_CASES[0].version,PSDTOOLS_CASES[1].version);
});

test('002B/2b checks complete real-precision Float32 typed layers',()=>{
  const data=new Float32Array([0,-1,0.5,1,2,3,4,1]);
  const layers={layers:[{name:'L',width:2,height:1,
    pixelBuffer:{bitsPerChannel:32,model:'rgb',data}}]};
  const good=fingerprintNativeLayers(layers);
  assert.equal(good.length,1);
  assert.equal(good[0].rawBytes,32);
  assert.match(good[0].sha256,/^[0-9a-f]{64}$/);
  for(const invalid of [
    {bitsPerChannel:16,model:'rgb',data},
    {bitsPerChannel:32,model:'cmyk',data},
    {bitsPerChannel:32,model:'rgb',data:new Uint16Array(8)},
    {bitsPerChannel:32,model:'rgb',data:new Float32Array(1)},
  ]) assert.throws(()=>fingerprintNativeLayers({layers:[{
    name:'L',width:2,height:1,pixelBuffer:invalid}]}));
  assert.throws(()=>fingerprintNativeLayers({layers:[]}));
});
