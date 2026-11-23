import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDng,decodeDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {createDocument,createRasterLayer,addLayer,snapshotDocument,sanitizeProject} from '../src/core/state.js';
import {bytesToDataUrl} from '../src/core/io.js';

const ID=[1,0,0,0,1,0,0,0,1];
const WHITE=[0.3457,0.3585]; // synthetic D50-like xy, not camera-authored
const NEUTRAL=[WHITE[0]/WHITE[1],1,(1-WHITE[0]-WHITE[1])/WHITE[1]];
const rgb=p=>[...p.rgba.slice(0,3)];
function entry(bytes,tag=50729){
  const view=new DataView(bytes),le=view.getUint8(0)===73;
  for(let i=0;i<view.getUint16(8,le);i++){
    const p=10+i*12;
    if(view.getUint16(p,le)===tag)return {view,le,p,offset:view.getUint32(p+8,le)};
  }
  throw Error('missing tag '+tag);
}

test('AsShotWhiteXY RATIONAL[2] II/MM matches equivalent AsShotNeutral camera pixels and preserves bytes',()=>{
  for(const le of [true,false]){
    const raw=fixture({le,matrix1:ID,neutral:null,whiteXY:WHITE,samples:[75,60,45]});
    const before=raw.slice(0),source=inspectDng(raw);
    assert.deepEqual(source.color.whiteXY,WHITE);
    assert.equal(source.color.neutral,null);
    assert.equal(source.whiteBalanceSource,'as-shot-white-xy');
    const xy=decodeDng(raw);
    const n=decodeDng(fixture({le,matrix1:ID,neutral:NEUTRAL,samples:[75,60,45]}));
    assert.ok(rgb(xy).every((v,i)=>Math.abs(v-rgb(n)[i])<=1),
      'xy colour preview should match explicitly derived camera neutral');
    assert.equal(xy.colorPipeline,'matrix-d50-bradford-v1');
    assert.deepEqual(new Uint8Array(raw),new Uint8Array(before));
  }
});

test('AsShotWhiteXY derives neutral through AB*CC*ColorMatrix, with dual illuminant and ForwardMatrix',()=>{
  const xy=fixture({matrix1:ID,matrix2:ID,neutral:null,whiteXY:WHITE,
    illuminant1:21,illuminant2:17,forward1:ID,forward2:ID,
    calibration1:[1.05,0,0,0,1,0,0,0,0.95],calibration2:[1.05,0,0,0,1,0,0,0,0.95],
    analogBalance:[1.1,1,0.9]});
  const source=inspectDng(xy);
  const result=decodeDng(xy);
  assert.equal(result.colorPipeline,'forward-d50-v1');
  assert.deepEqual(source.color.whiteXY,WHITE);
  assert.notDeepEqual(rgb(result),rgb(decodeDng(xy,{wbRed:2,wbBlue:0.5})));
});

test('AsShotWhiteXY malformed type/count, xy, rational, pointer and mutually exclusive neutral fail closed',()=>{
  for(const le of [true,false]){
    const create=()=>fixture({le,matrix1:ID,neutral:null,whiteXY:WHITE});
    const mutate=(fn)=>{
      const raw=create();fn(entry(raw));
      assert.throws(()=>inspectDng(raw),/DNG:.*(AsShotWhiteXY|знаменатель|границ)/);
    };
    mutate(({view,p,le})=>view.setUint16(p+2,10,le));
    mutate(({view,p,le})=>view.setUint32(p+4,3,le));
    mutate(({view,offset,le})=>view.setUint32(offset+4,0,le));
    mutate(({view,p,le})=>view.setUint32(p+8,0xfffffff0,le));
    for(const xy of [[0,0.35],[0.9,0.2],[0.3,0],[1,0.1]])
      assert.throws(()=>inspectDng(fixture({le,matrix1:ID,neutral:null,whiteXY:xy})),/AsShotWhiteXY/);
    assert.throws(()=>inspectDng(fixture({le,matrix1:ID,whiteXY:WHITE})),/AsShotWhiteXY.*AsShotNeutral/);
    assert.throws(()=>inspectDng(fixture({le,neutral:null,whiteXY:WHITE})),/AsShotWhiteXY.*ColorMatrix/);
    assert.throws(()=>inspectDng(fixture({le,matrix1:ID,neutral:null})),/AsShotNeutral.*AsShotWhiteXY/);
  }
});

test('AsShotWhiteXY project snapshot preserves the untouched original DNG for independent re-develop',()=>{
  const original=fixture({matrix1:ID,neutral:null,whiteXY:WHITE});
  const frame=decodeDng(original),doc=createDocument({width:4,height:4});
  const dataUrl=bytesToDataUrl(original,'application/x-adobe-dng');
  addLayer(doc,createRasterLayer({width:4,height:4,dataUrl:'data:image/png;base64,AAAA',
    rawDng:{dataUrl,width:4,height:4,development:frame.development,colorPipeline:frame.colorPipeline,
      baselineExposure:frame.baselineExposure,whiteBalanceSource:frame.whiteBalanceSource}}));
  const saved=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.equal(saved.layers[0].rawDng.dataUrl,dataUrl);
  assert.equal(saved.layers[0].rawDng.colorPipeline,'matrix-d50-bradford-v1');
  assert.equal(saved.layers[0].rawDng.whiteBalanceSource,'as-shot-white-xy');
  const legacy=JSON.parse(snapshotDocument(doc));
  delete legacy.layers[0].rawDng.whiteBalanceSource;
  assert.equal(sanitizeProject(legacy).layers[0].rawDng.whiteBalanceSource,'legacy-unspecified');
  assert.notDeepEqual(rgb(decodeDng(original,{exposure:0.75})),rgb(frame),
    'redevelop from saved native source applies exposure without losing white-point choice');
});
