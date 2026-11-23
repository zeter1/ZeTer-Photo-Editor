import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDng,inspectDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';

const srgb = v => Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
const pixel = image => Array.from(image.rgba.slice(0,4));
const tagEntry = (buffer, tag, le) => {
  const v=new DataView(buffer),count=v.getUint16(8,le);
  for(let i=0;i<count;i++)if(v.getUint16(10+i*12,le)===tag)return 10+i*12;
  throw new Error('missing TIFF tag '+tag);
};

test('DNG LinearizationTable applies SHORT lookup before black subtraction and sRGB transfer, II/MM',()=>{
  for(const le of [true,false]){
    const lut=Array.from({length:256},(_,i)=>Math.round(i*0.6));
    const bytes=fixture({le,samples:[100,100,100],linearizationTable:lut});
    const saved=new Uint8Array(bytes).slice();
    const source=inspectDng(bytes);
    assert.equal(source.linearization.length,256);
    assert.equal(source.linearization[100],60);
    const rgba=pixel(decodeDng(bytes));
    assert.deepEqual(rgba,[srgb(60/200),srgb(60/200),srgb(60/200),255]);
    assert.deepEqual(new Uint8Array(bytes),saved,'native DNG remains byte-for-byte unchanged');
    assert.ok(rgba[0]<pixel(decodeDng(fixture({le,samples:[100,100,100]})))[0],
      'lookup changes actual developed pixels, not metadata');
  }
});

test('shorter DNG linearization table clamps input code to final entry',()=>{
  const lut=Array.from({length:32},(_,i)=>i*3);
  const src=inspectDng(fixture({samples:[100,100,100],linearizationTable:lut}));
  assert.equal(src.linearization.length,32);
  assert.deepEqual(pixel(decodeDng(src.buffer)),
    [srgb(93/200),srgb(93/200),srgb(93/200),255]);
});

test('reject malformed LinearizationTable types, lengths, unsafe IFD data and do not fallback silently',()=>{
  const lut=Array.from({length:256},(_,i)=>i);
  const make=()=>fixture({linearizationTable:lut});
  let bytes=make(),v=new DataView(bytes),p=tagEntry(bytes,50712,true);
  v.setUint16(p+2,4,true);
  assert.throws(()=>inspectDng(bytes),/LinearizationTable/);
  bytes=make();v=new DataView(bytes);p=tagEntry(bytes,50712,true);
  v.setUint32(p+4,0,true);
  assert.throws(()=>inspectDng(bytes),/LinearizationTable/);
  bytes=make();v=new DataView(bytes);p=tagEntry(bytes,50712,true);
  v.setUint32(p+4,0xffffffff,true);
  assert.throws(()=>inspectDng(bytes),/LinearizationTable/);
  bytes=make();v=new DataView(bytes);p=tagEntry(bytes,50712,true);
  v.setUint32(p+8,bytes.byteLength-1,true);
  assert.throws(()=>inspectDng(bytes),/TIFF tag/);
  assert.throws(()=>inspectDng(fixture({linearizationTable:[0]})),/LinearizationTable/);
});

test('LinearizationTable precedes nonzero DNG BlackLevel (not linearizing normalized pixels)',()=>{
  const lut=Array.from({length:256},(_,i)=>Math.round(i*0.75));
  const bytes=fixture({samples:[100,100,100],blackLevel:20,linearizationTable:lut});
  assert.deepEqual(pixel(decodeDng(bytes)),
    [srgb((75-20)/(200-20)),srgb((75-20)/(200-20)),srgb((75-20)/(200-20)),255]);
});

test('16-bit DNG 65536-entry SHORT linearization is endianness-safe and correctly bounded',()=>{
  const lut=Array.from({length:65536},(_,i)=>Math.round(i*0.8));
  for(const le of [true,false]){
    const bytes=fixture({le,bits:16,samples:[25000,25000,25000],linearizationTable:lut});
    const source=inspectDng(bytes);
    assert.equal(source.linearization.length,65536);
    assert.equal(source.linearization[25000],20000);
    assert.deepEqual(pixel(decodeDng(bytes)),
      [srgb(20000/50000),srgb(20000/50000),srgb(20000/50000),255]);
  }
});

test('8-bit stored DNG may normalize 16-bit linearized WhiteLevel and BlackLevel',()=>{
  for(const le of [true,false]){
    const lut=Array.from({length:256},(_,i)=>i*200);
    const raw=fixture({le,bits:8,samples:[100,100,100],linearizationTable:lut,
      blackLevel:2000,whiteLevel:40000});
    const expected=srgb((20000-2000)/(40000-2000));
    assert.deepEqual(pixel(decodeDng(raw)),[expected,expected,expected,255]);
    assert.equal(inspectDng(raw).white,40000);
    assert.throws(()=>inspectDng(fixture({le,bits:8,whiteLevel:40000})),
      /WhiteLevel\/BlackLevel/,'without LUT, stored sample bit depth still bounds WhiteLevel');
  }
});

test('two-entry inline SHORT lookup is valid; 8-bit Bayer rejects >256 entries',()=>{
  const inline=fixture({linearizationTable:[0,100],samples:[100,100,100]});
  assert.deepEqual(pixel(decodeDng(inline)),
    [srgb(100/200),srgb(100/200),srgb(100/200),255]);
  assert.throws(()=>inspectDng(fixture({linearizationTable:Array.from({length:257},(_,i)=>i)})),
    /LinearizationTable/);
});
