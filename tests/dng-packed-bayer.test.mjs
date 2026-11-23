import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDng,inspectDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {tiledDng} from './fixtures/dng-tile-fixture.mjs';

const color=[0.9,0.1,0,0.1,1,0,0,0.1,1];
const samples=(x,y,c)=>55+x*13+y*17+c*91;
const pixels=(bytes)=>[...decodeDng(bytes,{wbRed:1.2,wbBlue:0.8,exposure:0.3}).rgba];

test('10/12/14-bit packed Bayer strips use MSB-first samples and byte-aligned scanlines (II/MM)',()=>{
  for(const bits of [10,12,14])for(const le of [true,false])
    for(const width of [5,6]){
      const options={width,height:6,bits,le,whiteLevel:2**bits-1,samples,
        activeArea:[1,1,6,width],matrix1:color,illuminant1:21};
      const packed=fixture(options),copy=packed.slice(0);
      const canonical=fixture({...options,bits:16});
      const s=inspectDng(packed);
      assert.equal(s.bits,bits);
      assert.equal(s.rowBytes,Math.ceil(width*bits/8));
      assert.deepEqual(pixels(packed),pixels(canonical),
        `bits=${bits} le=${le} width=${width}`);
      assert.deepEqual(new Uint8Array(packed),new Uint8Array(copy),'native DNG immutable');
    }
});

test('packed 10-bit sample boundaries preserve exact high-order bit ordering',()=>{
  const b=fixture({bits:10,width:4,height:4,whiteLevel:1023,
    samples:(x)=>x===0?0x155:x===1?0x2aa:0});
  const s=inspectDng(b);
  const bytes=new Uint8Array(b,s.offsets[0],s.rowBytes);
  assert.deepEqual([...bytes.slice(0,3)],[0x55,0x6a,0xa0],
    'two 10-bit samples cross three byte boundaries MSB-first');
});

test('packed TIFF Bayer tiles use per-tile row padding and preserve clipped edges',()=>{
  for(const bits of [10,12,14])for(const le of [true,false])
    for(const tileWidth of [2,4]){
      const options={width:10,height:6,bits,le,whiteLevel:2**bits-1,samples,
        activeArea:[1,1,6,9],defaultCropOrigin:[0.5,0.5],
        defaultCropSize:[6.5,3.5],orientation:6,matrix1:color,illuminant1:21};
      const t=tiledDng(options,{tileWidth,tileLength:4,compression:1});
      const s=inspectDng(t.buffer);
      assert.equal(s.tiled,true);
      assert.equal(s.blockRowBytes,Math.ceil(bits*tileWidth/8));
      assert.deepEqual(pixels(t.buffer),pixels(t.uncompressed),
        `packed tile vs packed strip bits=${bits} le=${le} width=${tileWidth}`);
    }
});

test('packed Bayer rejects unsupported FillOrder, illegal depth and truncated data',()=>{
  for(const bits of [9,11,13,15])
    assert.throws(()=>inspectDng(fixture({bits,whiteLevel:100})),/Bayer|bit/i);
  assert.throws(()=>inspectDng(fixture({bits:12,fillOrder:2})),/FillOrder/);
  assert.throws(()=>inspectDng(fixture({bits:12,fillOrder:3})),/FillOrder/);
  assert.throws(()=>inspectDng(fixture({bits:12,width:5,truncated:true})),/Bayer|усечён|полос|тайл/);
  const damaged=fixture({bits:14,fillOrder:1});
  const v=new DataView(damaged),le=true,count=v.getUint16(8,le);
  for(let i=0;i<count;i++){
    const pos=10+i*12;
    if(v.getUint16(pos,le)!==266)continue;
    v.setUint16(pos+2,65000,le); // unknown type must never be ignored
    break;
  }
  assert.throws(()=>inspectDng(damaged),/FillOrder|TIFF tag/);
});

function reframePackedStrips(raw,{bits,width,height,rowsPerStrip}){
  // Preserve native sensor bytes, move only the three TIFF directory values.
  const count=Math.ceil(height/rowsPerStrip),rowBytes=Math.ceil(width*bits/8);
  const bytes=new Uint8Array(raw.byteLength+count*8),v=new DataView(bytes.buffer);
  bytes.set(new Uint8Array(raw));
  const le=v.getUint8(0)===73,ifd=v.getUint32(4,le),n=v.getUint16(ifd,le);
  const tag=(id)=>{
    for(let i=0;i<n;i++){
      const pos=ifd+2+i*12;
      if(v.getUint16(pos,le)===id)return pos;
    }
    throw Error('missing TIFF '+id);
  };
  const base=v.getUint32(tag(273)+8,le),origin=raw.byteLength;
  v.setUint32(tag(278)+8,rowsPerStrip,le);
  v.setUint32(tag(273)+4,count,le);
  v.setUint32(tag(279)+4,count,le);
  v.setUint32(tag(273)+8,origin,le);
  v.setUint32(tag(279)+8,origin+4*count,le);
  for(let i=0;i<count;i++){
    v.setUint32(origin+i*4,base+i*rowsPerStrip*rowBytes,le);
    v.setUint32(origin+count*4+i*4,Math.min(rowsPerStrip,height-i*rowsPerStrip)*rowBytes,le);
  }
  return {buffer:bytes.buffer,countsOffset:origin+4*count,le};
}

test('multiple packed strips reset bit alignment at each strip/scanline',()=>{
  for(const bits of [10,12,14])for(const le of [true,false]){
    const options={bits,le,width:5,height:6,whiteLevel:2**bits-1,
      samples,defaultCropOrigin:[0.5,0],defaultCropSize:[4,6]};
    const single=fixture(options);
    const strips=reframePackedStrips(single,{bits,width:5,height:6,rowsPerStrip:2});
    const src=inspectDng(strips.buffer);
    assert.equal(src.offsets.length,3);
    assert.deepEqual(pixels(strips.buffer),pixels(single),'multi-strip equals single strip');
    const copy=strips.buffer.slice(0),v=new DataView(copy);
    v.setUint32(strips.countsOffset+4,src.rowBytes*2-1,le);
    assert.throws(()=>decodeDng(copy),/Bayer|полос|усечён|тайл/,'middle strip truncated');
  }
});
