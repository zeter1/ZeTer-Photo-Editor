import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDng,decodeDng,developDng} from '../src/formats/dng.js';
import {dngCameraToLinearSrgb,applyDngColorMatrix} from '../src/formats/dng-color.js';
import {fixture} from './fixtures/dng-fixture.mjs';
const ID=[1,0,0,0,1,0,0,0,1];
const other=[0.9,0.1,0,0.1,1,0,0,0.1,1];
function pixel(image){return [...image.rgba.slice(0,4)];}
function ifdEntry(buffer,tag){
  const view=new DataView(buffer),le=view.getUint8(0)===73;
  const n=view.getUint16(8,le);
  for(let i=0;i<n;i++)if(view.getUint16(10+i*12,le)===tag)return 10+i*12;
  throw new Error('missing fixture tag '+tag);
}
test('ColorMatrix SRATIONAL9 maps neutral camera white to neutral linear sRGB, independent of TIFF endian',()=>{
  for(const le of [true,false]){
    const raw=fixture({le,matrix1:ID,samples:[80,80,80]});
    const copy=raw.slice(0);
    const source=inspectDng(raw);
    assert.equal(source.color.matrix1.length,9);
    const transform=dngCameraToLinearSrgb(source.color);
    const linear=applyDngColorMatrix(transform,0.4,0.4,0.4);
    assert.ok(Math.max(...linear)-Math.min(...linear)<0.002,'D50/D65 white adaptation maintains equal RGB channels');
    const result=developDng(source);
    const channels=pixel(result).slice(0,3);
    assert.ok(Math.max(...channels)-Math.min(...channels)<=1,'neutral CFA is neutral on screen');
    assert.equal(result.colorPipeline,'matrix-d50-bradford-v1');
    assert.deepEqual(new Uint8Array(raw),new Uint8Array(copy),'original source bytes unchanged');
  }
});
test('real ColorMatrix uses off-diagonal camera channels before gamma, unlike legacy preview',()=>{
  const legacy=decodeDng(fixture());
  const calibrated=decodeDng(fixture({matrix1:other}));
  assert.notDeepEqual(pixel(calibrated),pixel(legacy),'actual matrix changes image');
  assert.equal(legacy.colorPipeline,'uncalibrated-bayer-preview');
  assert.equal(calibrated.rgba[3],255);
});
test('dual-illuminant ColorMatrix interpolates boundedly and responds to WB without corrupting raw source',()=>{
  const raw=fixture({matrix1:ID,matrix2:other,illuminant1:21,illuminant2:17});
  const source=inspectDng(raw),original=raw.slice(0);
  assert.deepEqual([source.color.illuminant1,source.color.illuminant2],[21,17]);
  const baseline=developDng(source);
  const warm=developDng(source,{wbRed:1.6,wbBlue:0.7});
  assert.notDeepEqual(pixel(warm),pixel(baseline));
  assert.deepEqual(warm.development,{exposure:0,wbRed:1.6,wbBlue:0.7,highlights:0,shadows:0,contrast:0});
  assert.deepEqual(new Uint8Array(raw),new Uint8Array(original));
});
test('invalid ColorMatrix shape/type, singular determinant, illegal illuminant and rational denominator fail closed',()=>{
  assert.throws(()=>inspectDng(fixture({matrix1:Array(9).fill(1)})),/вырожденная ColorMatrix/);
  assert.throws(()=>inspectDng(fixture({matrix1:ID,illuminant1:0})),/CalibrationIlluminant1/);
  assert.throws(()=>inspectDng(fixture({matrix1:ID,matrix2:other,illuminant2:255})),/CalibrationIlluminant/);
  const wrongType=fixture({matrix1:ID});
  new DataView(wrongType).setUint16(ifdEntry(wrongType,50721)+2,5,true);
  assert.throws(()=>inspectDng(wrongType),/SRATIONAL/);
  const wrongCount=fixture({matrix1:ID});
  new DataView(wrongCount).setUint32(ifdEntry(wrongCount,50721)+4,8,true);
  assert.throws(()=>inspectDng(wrongCount),/SRATIONAL/);
  const zero=fixture({matrix1:ID}),view=new DataView(zero);
  const offset=view.getUint32(ifdEntry(zero,50721)+8,true);
  view.setInt32(offset+4,0,true);
  assert.throws(()=>inspectDng(zero),/нулевой знаменатель/);
});
test('backward compatibility: original uncalibrated files remain importable and pixels deterministic',()=>{
  const raw=fixture();
  assert.equal(inspectDng(raw).color,null);
  assert.deepEqual(pixel(decodeDng(raw)),pixel(decodeDng(raw)));
});

test('ColorMatrix WB controls remain valid across full UI gain range (no spurious whitepoint rejection)',()=>{
  const raw=fixture({matrix1:[0.9,0.1,0,0.1,1,0,0,0.1,1],illuminant1:21});
  for(const wbRed of [0.25,0.5,1,2,4])for(const wbBlue of [0.25,0.5,1,2,4]){
    const developed=decodeDng(raw,{wbRed,wbBlue});
    assert.equal(developed.rgba[3],255);
    assert.equal(developed.colorPipeline,'matrix-d50-bradford-v1');
  }
});
