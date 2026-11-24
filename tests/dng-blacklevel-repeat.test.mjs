import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeDng,inspectDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';

const gamma=v=>Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
const first=image=>Array.from(image.rgba.slice(0,4));
const entry=(buffer,tag,le)=>{
  const v=new DataView(buffer),count=v.getUint16(8,le);
  for(let i=0;i<count;i++)if(v.getUint16(10+i*12,le)===tag)return 10+i*12;
  throw Error('missing TIFF tag '+tag);
};

test('per-site BlackLevelRepeatDim uses original sensor coordinates before demosaic, II/MM and crop/scale/orientation',()=>{
  // DNG tag order is [rows,cols], unlike UI dimensions (width×height).
  for(const le of [true,false])for(const dims of [[1,1],[2,1],[1,2],[2,2],[2,4]]){
    const black=Array.from({length:dims[0]*dims[1]},(_,i)=>i*4+4);
    const bytes=fixture({le,width:8,height:6,activeArea:[1,1,6,7],
      defaultCropOrigin:[0.5,0.5],defaultCropSize:[4,4],defaultScale:[1.5,1],
      orientation:6,blackRepeatDim:dims,blackLevel:black,
      samples:(x,y)=>100+black[(((y-1)%dims[0]+dims[0])%dims[0])*dims[1]+
        ((x-1)%dims[1]+dims[1])%dims[1]]/2});
    const before=new Uint8Array(bytes).slice();
    const source=inspectDng(bytes);
    assert.deepEqual(source.blackRepeat,dims);
    assert.deepEqual(source.black,black);
    const result=decodeDng(bytes);
    assert.deepEqual([result.width,result.height],[4,6]);
    for(let i=0;i<result.rgba.length;i+=4)
      assert.deepEqual(Array.from(result.rgba.slice(i,i+4)),[gamma(0.5),gamma(0.5),gamma(0.5),255],
        'sensor phase '+dims+' at output pixel '+(i/4));
    assert.deepEqual(new Uint8Array(bytes),before,'original RAW remains untouched');
  }
});

test('RATIONAL non-integer BlackLevel is decoded before white normalization, II/MM',()=>{
  for(const le of [true,false]){
    const src=fixture({le,blackRepeatDim:[2,2],blackType:5,
      blackLevel:[10.5,20.5,30.5,40.5],samples:[100,100,100]});
    assert.deepEqual(inspectDng(src).black,[10.5,20.5,30.5,40.5]);
    const red=gamma((100-10.5)/(200-10.5));
    assert.equal(first(decodeDng(src))[0],red);
  }
});

test('LONG per-CFA BlackLevel and 16-bit linearization keep sample-domain normalization',()=>{
  for(const le of [true,false]){
    const lut=Array.from({length:256},(_,i)=>i*200);
    const levels=[2000,4000,6000,8000],white=40000;
    const bytes=fixture({le,bits:8,blackType:4,blackRepeatDim:[2,2],
      blackLevel:levels,whiteLevel:white,linearizationTable:lut,
      samples:(x,y)=>Math.round((levels[(y%2)*2+(x%2)]+white)/400)});
    const source=inspectDng(bytes);
    assert.deepEqual(source.black,levels);
    const decoded=decodeDng(bytes);
    for(let i=0;i<decoded.rgba.length;i+=4)
      assert.deepEqual(Array.from(decoded.rgba.slice(i,i+4)),[gamma(0.5),gamma(0.5),gamma(0.5),255],
        'LUT domain plus LONG per-site black normalizes every Bayer site equally');
  }
});

test('malformed BlackLevelRepeatDim/BlackLevel metadata rejects unknown TIFF types, counts and impossible values',()=>{
  for(const le of [true,false]){
    const valid=()=>fixture({le,blackRepeatDim:[2,2],blackLevel:[10,20,30,40]});
    for(const [tag,field,write] of [
      [50713,2,(v,p)=>v.setUint16(p+2,4,le)],
      [50713,4,(v,p)=>v.setUint32(p+4,1,le)],
      [50713,4,(v,p)=>v.setUint32(p+4,0xffffffff,le)],
      [50714,2,(v,p)=>v.setUint16(p+2,12,le)],
      [50714,4,(v,p)=>v.setUint32(p+4,0xffffffff,le)],
      [50714,4,(v,p)=>v.setUint32(p+4,3,le)],
    ]){
      const bytes=valid(),v=new DataView(bytes),p=entry(bytes,tag,le);
      write(v,p);
      assert.throws(()=>inspectDng(bytes),/BlackLevel/, 'invalid tag '+tag+' at field '+field);
    }
    for(const dims of [[0,2],[2,0],[9,1],[1,9],[3,3]]){
      const b=valid(),v=new DataView(b),p=entry(b,50713,le);
      v.setUint16(p+8,dims[0],le);v.setUint16(p+10,dims[1],le);
      assert.throws(()=>inspectDng(b),/BlackLevel/);
    }
    assert.throws(()=>inspectDng(fixture({le,blackRepeatDim:[2,2],blackLevel:[0,0,200,0]})),
      /WhiteLevel\/BlackLevel/);
    const unsupported=valid(),uv=new DataView(unsupported),wp=entry(unsupported,50717,le);
    uv.setUint16(wp,50715,le);
    assert.throws(()=>inspectDng(unsupported),/BlackLevelDeltaH\/V/);
    const rational=fixture({le,blackRepeatDim:[2,2],blackLevel:[1,2,3,4],blackType:5});
    const rv=new DataView(rational),bp=entry(rational,50714,le);
    rv.setUint32(rv.getUint32(bp+8,le)+4,0,le);
    assert.throws(()=>inspectDng(rational),/знаменатель/);
    assert.throws(()=>inspectDng(fixture({le,blackRepeatDim:[2,2],blackLevel:[0,0,0,0],blackType:5}).slice(0,80)),
      /IFD|TIFF|BlackLevel/);
  }
});

test('legacy scalar BlackLevel remains valid without repeat tag',()=>{
  const source=inspectDng(fixture({blackLevel:20,samples:[100,100,100]}));
  assert.deepEqual(source.blackRepeat,[1,1]);
  assert.deepEqual(source.black,[20]);
  assert.deepEqual(first(decodeDng(source.buffer)),Array(3).fill(gamma(80/180)).concat(255));
});
