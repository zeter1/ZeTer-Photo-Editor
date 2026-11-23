import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDng,decodeDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {createDocument,createRasterLayer,addLayer,sanitizeProject,snapshotDocument} from '../src/core/state.js';
import {bytesToDataUrl} from '../src/core/io.js';

const srgb = value => {
  const v=Math.max(0,Math.min(1,value));
  return Math.round(255*(v<=0.0031308 ? 12.92*v : 1.055*v**(1/2.4)-0.055));
};
function entry(bytes,tag=50730){
  const view=new DataView(bytes), le=view.getUint8(0)===73;
  for(let i=0;i<view.getUint16(8,le);i++){
    const p=10+i*12;
    if(view.getUint16(p,le)===tag)
      return {view,le,p,offset:view.getUint32(p+8,le)};
  }
  throw Error('missing tag '+tag);
}

test('DNG BaselineExposure signed SRATIONAL is read from II/MM TIFF and absence means zero EV',()=>{
  assert.equal(inspectDng(fixture()).baselineExposure,0);
  for(const le of [true,false])for(const ev of [-1.25,0,0.75]){
    assert.equal(inspectDng(fixture({le,baselineExposure:ev})).baselineExposure,ev);
  }
});

test('DNG BaselineExposure applies additive EV scene-linearly before sRGB; manual exposure remains relative',()=>{
  const original=fixture({samples:[40,40,40],baselineExposure:1});
  const untouched=original.slice(0);
  const plain=decodeDng(fixture({samples:[40,40,40]}));
  const compensated=decodeDng(original);
  const combined=decodeDng(original,{exposure:-1});
  assert.equal(plain.rgba[0],srgb(40/200));
  assert.equal(compensated.rgba[0],srgb(2*40/200));
  assert.deepEqual([...combined.rgba],[...plain.rgba],'manual -1 EV cancels camera baseline +1 EV');
  assert.equal(compensated.development.exposure,0,'baseline is not silently baked into user slider');
  assert.equal(compensated.baselineExposure,1);
  assert.deepEqual(new Uint8Array(original),new Uint8Array(untouched),'original DNG bytes must stay untouched');
});

test('BaselineExposure rejects malformed types, counts, denominator, unsafe EV, and out-of-bounds pointer',()=>{
  for(const le of [true,false]){
    const corrupt=(mutate)=>{
      const b=fixture({le,baselineExposure:1});
      const e=entry(b);
      mutate(e);
      assert.throws(()=>inspectDng(b),/DNG:.*(BaselineExposure|знаменатель|границ)/);
    };
    corrupt(({view,p,le})=>view.setUint16(p+2,5,le));
    corrupt(({view,p,le})=>view.setUint32(p+4,2,le));
    corrupt(({view,offset,le})=>view.setInt32(offset+4,0,le));
    corrupt(({view,offset,le})=>view.setInt32(offset,17000,le)); // +17 EV
    corrupt(({view,p,le})=>view.setUint32(p+8,0xfffffff0,le));
    corrupt(({view,p,le})=>view.setUint16(p+2,65535,le));
  }
});

test('BaselineExposure provenance survives .zpe sanitization, legacy defaults and invalid metadata is rejected',()=>{
  const raw=fixture({baselineExposure:0.5});
  const doc=createDocument({width:4,height:4});
  const frame=decodeDng(raw);
  addLayer(doc,createRasterLayer({width:4,height:4,dataUrl:'data:image/png;base64,AAAA',rawDng:{
    dataUrl:bytesToDataUrl(raw,'application/x-adobe-dng'),width:4,height:4,
    development:frame.development,colorPipeline:frame.colorPipeline,baselineExposure:frame.baselineExposure
  }}));
  const saved=JSON.parse(snapshotDocument(doc));
  assert.equal(sanitizeProject(saved).layers[0].rawDng.baselineExposure,0.5);
  const legacy=structuredClone(saved);
  delete legacy.layers[0].rawDng.baselineExposure;
  assert.equal(sanitizeProject(legacy).layers[0].rawDng.baselineExposure,0);
  for(const value of [Infinity,17,'1',null]){
    const changed=structuredClone(saved);
    changed.layers[0].rawDng.baselineExposure=value;
    assert.equal(sanitizeProject(changed).layers[0].rawDng,null,'reject '+String(value));
  }
});
