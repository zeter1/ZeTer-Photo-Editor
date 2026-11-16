import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDng,inspectDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';

const pixel=(image,x,y)=>[...image.rgba.slice((y*image.width+x)*4,(y*image.width+x)*4+4)];
const sample=(x,y,c)=>25+x*9+y*5+c*20;
const linear=v=>{
  const n=v/255;
  return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
};
const encode=v=>Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
function tagOffset(bytes,tag){
  const v=new DataView(bytes),le=v.getUint8(0)===73;
  for(let i=0;i<v.getUint16(8,le);i++){
    const p=10+12*i;
    if(v.getUint16(p,le)===tag)return {view:v,le,p,offset:v.getUint32(p+8,le)};
  }
  throw Error('Missing fixture TIFF tag '+tag);
}

test('DefaultCropOrigin/Size SHORT, LONG and RATIONAL are sensor-relative to ActiveArea',()=>{
  for(const le of [true,false])for(const type of [3,4,5]){
    const raw=fixture({le,width:8,height:6,activeArea:[1,1,6,7],
      defaultCropOrigin:[1,1],defaultCropSize:[4,3],cropOriginType:type,cropSizeType:type,
      samples:sample});
    const source=inspectDng(raw);
    assert.deepEqual(source.cropWindow,[2,2,4,3]);
    assert.deepEqual([source.width,source.height],[8,6]);
    assert.deepEqual([source.displayWidth,source.displayHeight],[4,3]);
    const developed=decodeDng(raw);
    const full=decodeDng(fixture({le,width:8,height:6,samples:sample}));
    for(let y=0;y<3;y++)for(let x=0;x<4;x++)
      assert.deepEqual(pixel(developed,x,y),pixel(full,x+2,y+2),
        'unchanged Bayer phase for '+(le?'II':'MM')+' TIFF type '+type);
  }
});

test('RATIONAL fractional origins interpolate linear camera channels, not gamma-coded output',()=>{
  const params={width:8,height:6,activeArea:[1,1,6,7],samples:sample};
  const raw=fixture({...params,defaultCropOrigin:[1.5,1],defaultCropSize:[4,3]});
  const original=raw.slice(0);
  const source=inspectDng(raw), cropped=decodeDng(raw);
  const full=decodeDng(fixture({width:8,height:6,samples:sample}));
  assert.deepEqual(source.cropWindow,[2.5,2,4,3]);
  for(let y=0;y<cropped.height;y++)for(let x=0;x<cropped.width;x++){
    const actual=pixel(cropped,x,y);
    for(let c=0;c<3;c++){
      const expected=encode((linear(pixel(full,x+2,y+2)[c])+
        linear(pixel(full,x+3,y+2)[c]))/2);
      assert.ok(Math.abs(actual[c]-expected)<=2,
        'linear interpolation channel='+c+', xy='+x+','+y+' expected='+expected+' got='+actual[c]);
    }
    assert.equal(actual[3],255);
  }
  assert.deepEqual(new Uint8Array(raw),new Uint8Array(original),'native DNG bytes unchanged');
});

test('Fractional DefaultCropSize rounds preview grid once, orientation 1-8 maps exact cropped pixels',()=>{
  const input={width:9,height:7,activeArea:[1,1,7,9],
    defaultCropOrigin:[1.5,0.5],defaultCropSize:[4.5,3.5],samples:sample};
  const flat=decodeDng(fixture({...input,orientation:1}));
  assert.deepEqual([flat.width,flat.height],[5,4]);
  const coords=(o,x,y,w,h)=>({
    1:[x,y],2:[w-1-x,y],3:[w-1-x,h-1-y],4:[x,h-1-y],
    5:[y,x],6:[h-1-y,x],7:[h-1-y,w-1-x],8:[y,w-1-x]
  })[o];
  for(let o=1;o<=8;o++){
    const rotated=decodeDng(fixture({...input,orientation:o}));
    assert.deepEqual([rotated.width,rotated.height],o>=5?[4,5]:[5,4]);
    for(let y=0;y<4;y++)for(let x=0;x<5;x++){
      const [dx,dy]=coords(o,x,y,5,4);
      assert.deepEqual(pixel(rotated,dx,dy),pixel(flat,x,y),'Orientation '+o+' at '+x+','+y);
    }
  }
});

test('Identity DefaultScale is accepted; non-unit/malformed scale fails explicitly',()=>{
  const params={width:8,height:6,activeArea:[1,1,6,7],
    defaultCropOrigin:[1,1],defaultCropSize:[4,3]};
  assert.deepEqual(inspectDng(fixture({...params,defaultScale:[1,1]})).cropWindow,[2,2,4,3]);
  assert.throws(()=>inspectDng(fixture({...params,defaultScale:[2,1]})),/DefaultScale/);
  assert.throws(()=>inspectDng(fixture({...params,defaultScale:[1,0.5]})),/DefaultScale/);
  const malformed=fixture({...params,defaultScale:[1,1]});
  const {view,le,p}=tagOffset(malformed,50718);
  view.setUint16(p+2,3,le);
  assert.throws(()=>inspectDng(malformed),/DefaultScale/);
});

test('Size-only crop uses default origin; absent crop preserves full ActiveArea',()=>{
  const params={width:8,height:6,activeArea:[1,1,6,7]};
  const noCrop=inspectDng(fixture(params));
  assert.deepEqual(noCrop.cropWindow,[1,1,6,5]);
  const crop=inspectDng(fixture({...params,defaultCropSize:[3,2],cropSizeType:3}));
  assert.deepEqual(crop.cropWindow,[1,1,3,2]);
});

test('Malformed/out-of-range crop tags fail closed without silently using ActiveArea',()=>{
  const params={width:8,height:6,activeArea:[1,1,6,7]};
  for(const [origin,size] of [
    [[-1,0],[4,3]],[[1,1],[6,3]],[[3,0],[4,3]],
    [[0,0],[1,3]],[[0,0],[4,0]]
  ]){
    // TIFF RATIONAL cannot represent negative origins; this case encodes a
    // negative floating input as a large unsigned numerator and must still fail.
    assert.throws(()=>inspectDng(fixture({...params,
      defaultCropOrigin:origin,defaultCropSize:size})),/DefaultCrop/);
  }
  assert.throws(()=>inspectDng(fixture({...params,
    defaultCropOrigin:[1,1],defaultCropSize:[4,3],cropOriginType:10})),/DefaultCropOrigin/);
  for(const tag of [50719,50720]){
    const b=fixture({...params,defaultCropOrigin:[1,1],defaultCropSize:[4,3]});
    const {view,le,p,offset}=tagOffset(b,tag);
    view.setUint32(p+4,3,le); // wrong arity
    assert.throws(()=>inspectDng(b),/DefaultCrop/);
    view.setUint32(p+4,2,le);
    view.setUint32(offset+4,0,le); // zero rational denominator
    assert.throws(()=>inspectDng(b),/знаменатель/);
  }
});

test('unsupported TIFF type and oversized count in crop/scale tags must fail closed',()=>{
  const base={width:8,height:6,activeArea:[1,1,6,7],
    defaultScale:[1,1],defaultCropOrigin:[1,1],defaultCropSize:[4,3]};
  for(const tag of [50718,50719,50720])for(const kind of ['unknown-type','oversized-count']){
    const bytes=fixture(base);
    const {view,le,p}=tagOffset(bytes,tag);
    if(kind==='unknown-type')view.setUint16(p+2,65535,le);
    else view.setUint32(p+4,16_000_001,le);
    assert.throws(()=>inspectDng(bytes),/DefaultCrop|DefaultScale|TIFF tag/,
      `tag ${tag}, ${kind} must not be ignored`);
  }
});

test('ColorMatrix remains applied to fractionally cropped, orientation-aware output',()=>{
  const b=fixture({width:8,height:6,activeArea:[1,1,6,7],defaultCropOrigin:[1.5,1],
    defaultCropSize:[4,3],orientation:6,matrix1:[0.9,0.1,0,0.1,1,0,0,0.1,1],
    illuminant1:21,samples:sample});
  const src=inspectDng(b),preview=decodeDng(b);
  assert.deepEqual(src.cropWindow,[2.5,2,4,3]);
  assert.deepEqual([preview.width,preview.height],[3,4]);
  assert.equal(preview.colorPipeline,'matrix-d50-bradford-v1');
  assert.ok(preview.rgba.some((v,i)=>i%4===0&&v>10));
});
