import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDng, developDng, decodeDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {createDocument,createRasterLayer,addLayer,sanitizeProject,snapshotDocument} from '../src/core/state.js';
import {bytesToDataUrl} from '../src/core/io.js';

const srgb = value => {
  const v=Math.max(0,Math.min(1,value));
  return Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
};
function tagEntry(buffer,tag=51109){
  const v=new DataView(buffer),le=v.getUint8(0)===73;
  for(let i=0;i<v.getUint16(8,le);i++){
    const pos=10+i*12;
    if(v.getUint16(pos,le)===tag)return {v,le,pos,offset:v.getUint32(pos+8,le)};
  }
  throw Error('missing DNG tag '+tag);
}

test('BaselineExposureOffset SRATIONAL is parsed in both TIFF byte orders; absent profile offset defaults to 0',()=>{
  assert.equal(inspectDng(fixture()).baselineExposureOffset,0);
  for(const le of [true,false])for(const ev of [-0.75,0,0.5]){
    assert.equal(inspectDng(fixture({le,baselineExposureOffset:ev})).baselineExposureOffset,ev);
  }
});

test('DNG profile offset adds to camera BaselineExposure, not manual slider, in linear scene light',()=>{
  const original=fixture({samples:[25,25,25],baselineExposure:1,baselineExposureOffset:-0.5});
  const untouched=original.slice(0);
  const plain=decodeDng(fixture({samples:[25,25,25]}));
  const camera=decodeDng(original);
  const compensated=decodeDng(original,{exposure:-0.5});
  assert.equal(plain.rgba[0],srgb(25/200));
  assert.equal(camera.rgba[0],srgb((25/200)*Math.SQRT2));
  assert.deepEqual([...compensated.rgba],[...plain.rgba]);
  assert.equal(camera.development.exposure,0);
  assert.equal(camera.baselineExposure,1);
  assert.equal(camera.baselineExposureOffset,-0.5);
  assert.deepEqual(new Uint8Array(original),new Uint8Array(untouched));
});

test('camera-profile offset also changes calibrated ColorMatrix pixels and re-develop can Undo/Redo slider levels',()=>{
  const color={matrix1:[1,0,0,0,1,0,0,0,1],neutral:[1,1,1],samples:[45,35,25]};
  const before=decodeDng(fixture(color));
  const after=decodeDng(fixture({...color,baselineExposureOffset:0.5}));
  const cancelled=decodeDng(fixture({...color,baselineExposureOffset:0.5}),{exposure:-0.5});
  assert.notDeepEqual([...after.rgba],[...before.rgba]);
  assert.deepEqual([...cancelled.rgba],[...before.rgba]);
});

test('invalid BaselineExposureOffset type/count/denominator/EV bounds/pointer fails closed for II and MM',()=>{
  for(const le of [true,false]){
    const reject=mutate=>{
      const buffer=fixture({le,baselineExposureOffset:0.5});
      mutate(tagEntry(buffer));
      assert.throws(()=>inspectDng(buffer),/DNG:.*(BaselineExposureOffset|знаменатель|границ)/);
    };
    reject(({v,le,pos})=>v.setUint16(pos+2,5,le));
    reject(({v,le,pos})=>v.setUint32(pos+4,2,le));
    reject(({v,le,offset})=>v.setInt32(offset+4,0,le));
    reject(({v,le,offset})=>v.setInt32(offset,-17000,le));
    reject(({v,le,pos})=>v.setUint32(pos+8,0xfffffff0,le));
    reject(({v,le,pos})=>v.setUint16(pos+2,65535,le));
  }
  const source=inspectDng(fixture());
  source.baselineExposureOffset=NaN;
  assert.throws(()=>developDng(source),/BaselineExposureOffset/);
});

test('profile-offset provenance survives .zpe v2; legacy v1/v2 defaults to zero, invalid metadata rejects',()=>{
  const raw=fixture({baselineExposure:0.25,baselineExposureOffset:-0.75});
  const doc=createDocument({width:4,height:4});
  const pixels=decodeDng(raw);
  addLayer(doc,createRasterLayer({width:4,height:4,dataUrl:'data:image/png;base64,AAAA',rawDng:{
    dataUrl:bytesToDataUrl(raw,'application/x-adobe-dng'),width:4,height:4,
    development:pixels.development,colorPipeline:pixels.colorPipeline,
    baselineExposure:pixels.baselineExposure,baselineExposureOffset:pixels.baselineExposureOffset
  }}));
  const saved=JSON.parse(snapshotDocument(doc));
  assert.equal(sanitizeProject(saved).layers[0].rawDng.baselineExposureOffset,-0.75);
  const legacy=structuredClone(saved);
  delete legacy.layers[0].rawDng.baselineExposureOffset;
  assert.equal(sanitizeProject(legacy).layers[0].rawDng.baselineExposureOffset,0);
  for(const invalid of [Infinity,-17,'0.5',null]){
    const value=structuredClone(saved);
    value.layers[0].rawDng.baselineExposureOffset=invalid;
    assert.equal(sanitizeProject(value).layers[0].rawDng,null);
  }
});
