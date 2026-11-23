import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeDng,inspectDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';

const gamma=v=>Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
const first=image=>Array.from(image.rgba.slice(0,4));
const tagEntry=(buffer,tag,le)=>{
  const view=new DataView(buffer),count=view.getUint16(8,le);
  for(let i=0;i<count;i++){
    const p=10+i*12;
    if(view.getUint16(p,le)===tag)return p;
  }
  throw Error('missing TIFF tag '+tag);
};
const clamp=(v,limit)=>Math.max(0,Math.min(limit-1,v));

test('BlackLevelDeltaH/V use signed SRATIONAL sensor-site calibration before crop, scale, orientation and demosaic',()=>{
  const deltaH=[-4,0,4,8,0,-4],deltaV=[0,2,-2,4,-4,0];
  for(const le of [true,false])for(const dims of [[1,1],[2,2],[2,4]]){
    const grid=Array.from({length:dims[0]*dims[1]},(_,i)=>8+i*4);
    const at=(x,y)=>{
      const row=((y-1)%dims[0]+dims[0])%dims[0];
      const col=((x-2)%dims[1]+dims[1])%dims[1];
      return grid[row*dims[1]+col]+deltaH[clamp(x-2,6)]+deltaV[clamp(y-1,6)];
    };
    const bytes=fixture({le,width:10,height:8,activeArea:[1,2,7,8],
      defaultCropOrigin:[1.5,1.5],defaultCropSize:[3.5,3.5],
      defaultScale:[2,1],orientation:6,blackRepeatDim:dims,blackLevel:grid,
      blackDeltaH:deltaH,blackDeltaV:deltaV,samples:(x,y)=>Math.round((200+at(x,y))/2)});
    const before=new Uint8Array(bytes).slice();
    const source=inspectDng(bytes);
    assert.deepEqual(source.blackDeltaH,deltaH);
    assert.deepEqual(source.blackDeltaV,deltaV);
    assert.deepEqual(source.blackRepeat,dims);
    const decoded=decodeDng(bytes);
    assert.deepEqual([decoded.width,decoded.height],[4,7]);
    for(let i=0;i<decoded.rgba.length;i+=4)
      assert.deepEqual(Array.from(decoded.rgba.slice(i,i+4)),[gamma(0.5),gamma(0.5),gamma(0.5),255],
        'sensor site '+dims+' / pixel '+i/4);
    assert.deepEqual(new Uint8Array(bytes),before,'never mutate native DNG source');
  }
});

test('only H or V delta is valid; absent delta keeps legacy black normalization',()=>{
  for(const le of [true,false]){
    const h=fixture({le,blackLevel:20,blackDeltaH:[-4,0,4,8],
      samples:(x)=>Math.round((200+20+[-4,0,4,8][x])/2)});
    const v=fixture({le,blackLevel:20,blackDeltaV:[-4,0,4,8],
      samples:(_,y)=>Math.round((200+20+[-4,0,4,8][y])/2)});
    assert.deepEqual(inspectDng(h).blackDeltaH,[-4,0,4,8]);
    assert.equal(inspectDng(h).blackDeltaV,null);
    assert.equal(inspectDng(v).blackDeltaH,null);
    assert.deepEqual(inspectDng(v).blackDeltaV,[-4,0,4,8]);
    for(const src of [h,v])
      assert.deepEqual(first(decodeDng(src)),[gamma(0.5),gamma(0.5),gamma(0.5),255]);
    const legacy=inspectDng(fixture({le,blackLevel:20,samples:[100,100,100]}));
    assert.equal(legacy.blackDeltaH,null);
    assert.equal(legacy.blackDeltaV,null);
    assert.equal(first(decodeDng(legacy.buffer))[0],gamma(80/180));
  }
});

test('LinearizationTable and 2×2 repeat combine with signed sensor deltas before normalization',()=>{
  for(const le of [true,false]){
    const deltaH=[-400,0,400,800],deltaV=[0,-800,400,1200];
    const grid=[2000,2400,2800,3200],white=40000;
    const lut=Array.from({length:256},(_,i)=>i*200);
    const bytes=fixture({le,bits:8,width:4,height:4,blackRepeatDim:[2,2],
      linearizationTable:lut,whiteLevel:white,blackType:4,blackLevel:grid,
      blackDeltaH:deltaH,blackDeltaV:deltaV,
      samples:(x,y)=>(white+grid[(y%2)*2+(x%2)]+deltaH[x]+deltaV[y])/400});
    const source=inspectDng(bytes);
    assert.deepEqual(source.blackDeltaH,deltaH);
    assert.deepEqual(source.blackDeltaV,deltaV);
    const image=decodeDng(bytes);
    for(let i=0;i<image.rgba.length;i+=4)
      assert.deepEqual(Array.from(image.rgba.slice(i,i+4)),[gamma(0.5),gamma(0.5),gamma(0.5),255]);
  }
});

test('delta TIFF tags fail closed on wrong type/count/offset/denominator and invalid effective black',()=>{
  for(const le of [true,false]){
    const valid=()=>fixture({le,width:6,height:4,activeArea:[1,1,4,6],
      blackLevel:20,blackDeltaH:[-2,0,2,4,6],blackDeltaV:[0,-2,2]});
    for(const [tag,write] of [
      [50715,(v,p)=>v.setUint16(p+2,5,le)],
      [50715,(v,p)=>v.setUint32(p+4,4,le)],
      [50715,(v,p)=>v.setUint32(p+4,0xffffffff,le)],
      [50716,(v,p)=>v.setUint16(p+2,4,le)],
      [50716,(v,p)=>v.setUint32(p+4,2,le)],
      [50716,(v,p)=>v.setUint32(p+8,0xffffffff,le)],
    ]){
      const bytes=valid(),view=new DataView(bytes),p=tagEntry(bytes,tag,le);
      write(view,p);
      assert.throws(()=>inspectDng(bytes),/BlackLevelDelta|TIFF|DNG/,'invalid tag '+tag);
    }
    for(const tag of [50715,50716]){
      const bytes=valid(),view=new DataView(bytes),p=tagEntry(bytes,tag,le);
      const start=view.getUint32(p+8,le);
      view.setInt32(start+4,0,le);
      assert.throws(()=>inspectDng(bytes),/знаменатель/);
    }
    assert.throws(()=>inspectDng(fixture({le,blackLevel:2,blackDeltaH:[-4,0,0,0]})),
      /BlackLevel|WhiteLevel/);
    assert.throws(()=>inspectDng(fixture({le,blackLevel:190,blackDeltaV:[0,11,0,0]})),
      /BlackLevel|WhiteLevel/);
  }
});

test('signed SRATIONAL denominator is read algebraically (II/MM), never as UINT32',()=>{
  for(const le of [true,false]){
    const delta=[-4,0,4,8];
    const bytes=fixture({le,blackLevel:20,blackDeltaH:delta,
      samples:(x)=>Math.round((220+delta[x])/2)});
    const view=new DataView(bytes),entry=tagEntry(bytes,50715,le),start=view.getUint32(entry+8,le);
    view.setInt32(start,4000,le);
    view.setInt32(start+4,-1000,le); // +4000 / -1000 = -4
    assert.deepEqual(inspectDng(bytes).blackDeltaH,delta);
    assert.deepEqual(first(decodeDng(bytes)),[gamma(0.5),gamma(0.5),gamma(0.5),255]);
  }
});
