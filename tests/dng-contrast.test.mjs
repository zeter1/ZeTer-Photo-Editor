import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDngTonalControls} from '../src/formats/dng-color.js';
import {decodeDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {createDocument,createRasterLayer,addLayer,snapshotDocument,sanitizeProject} from '../src/core/state.js';
import {bytesToDataUrl} from '../src/core/io.js';
import {normalizeRawPresetDevelopment,parseRawPresetFile,RAW_PRESET_FILE_FORMAT} from '../src/formats/dng-presets.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`expected ${b}, got ${a}`);
const oldRecipe={exposure:0,wbRed:1,wbBlue:1,highlights:0,shadows:0,demosaic:'bilinear'};

test('scene-linear contrast is a monotonic luminance curve with fixed black, middle gray, white and hue',()=>{
  near(applyDngTonalControls([0.25,0.25,0.25],{contrast:1})[0],0.15625);
  near(applyDngTonalControls([0.75,0.75,0.75],{contrast:1})[0],0.84375);
  near(applyDngTonalControls([0.25,0.25,0.25],{contrast:-1})[0],0.34375);
  for(const contrast of [-1,-0.25,0,0.5,1]){
    let prev=-1;
    for(let i=0;i<=1000;i++){
      const x=i/1000;
      const next=applyDngTonalControls([x,x,x],{contrast})[0];
      assert.ok(next>=prev-1e-10,`contrast ${contrast} nonmonotonic at ${x}`);
      prev=next;
    }
    for(const x of [0,0.5,1])
      near(applyDngTonalControls([x,x,x],{contrast})[0],x);
  }
  const rgb=[0.08,0.16,0.32],adjusted=applyDngTonalControls(rgb,{contrast:0.7,highlights:-0.3,shadows:0.2});
  adjusted.forEach((value,i)=>near(value/rgb[i],adjusted[0]/rgb[0]));
  assert.deepEqual(applyDngTonalControls(rgb,{contrast:0}),rgb);
});

test('contrast changes real developed RAW pixels without changing native source or allowing invalid amounts',()=>{
  const raw=fixture({samples:(x,y)=>x+y<3?40:145});
  const native=new Uint8Array(raw).slice();
  const baseline=decodeDng(raw);
  const strong=decodeDng(raw,{contrast:1});
  const soft=decodeDng(raw,{contrast:-1});
  assert.notDeepEqual([...strong.rgba],[...baseline.rgba]);
  assert.notDeepEqual([...soft.rgba],[...baseline.rgba]);
  assert.equal(strong.development.contrast,1);
  assert.equal(soft.development.contrast,-1);
  assert.deepEqual(new Uint8Array(raw),native);
  for(const value of [-1.01,1.01,NaN,Infinity,'0.2',null])
    assert.throws(()=>decodeDng(raw,{contrast:value}),/параметры RAW/);
});

test('RAW contrast is saved in .zpe, legacy defaults are neutral and malformed explicit values fail closed',()=>{
  const raw=fixture();
  const developed=decodeDng(raw,{contrast:0.65,shadows:0.2});
  const doc=createDocument({width:4,height:4});
  addLayer(doc,createRasterLayer({width:4,height:4,dataUrl:'data:image/png;base64,AAAA',rawDng:{
    dataUrl:bytesToDataUrl(raw,'application/x-adobe-dng'),width:4,height:4,
    development:developed.development,colorPipeline:developed.colorPipeline,
  }}));
  const saved=JSON.parse(snapshotDocument(doc));
  const opened=sanitizeProject(saved);
  assert.equal(opened.layers[0].rawDng.development.contrast,0.65);
  assert.equal(opened.layers[0].rawDng.dataUrl,doc.layers[0].rawDng.dataUrl);
  const legacy=structuredClone(saved);
  delete legacy.layers[0].rawDng.development.contrast;
  assert.equal(sanitizeProject(legacy).layers[0].rawDng.development.contrast,0);
  for(const value of [NaN,1.5,'0.1',null]){
    const bad=structuredClone(saved);
    bad.layers[0].rawDng.development.contrast=value;
    assert.equal(sanitizeProject(bad).layers[0].rawDng,null);
  }
});

test('old portable RAW preset recipes import as neutral contrast, new recipes round-trip strictly',()=>{
  assert.equal(normalizeRawPresetDevelopment(oldRecipe).contrast,0);
  const wire=presets=>JSON.stringify({format:RAW_PRESET_FILE_FORMAT,schema:1,presets});
  const parsed=parseRawPresetFile(wire([{name:'Legacy',development:oldRecipe}]));
  assert.equal(parsed.ok,true);
  assert.equal(parsed.presets[0].development.contrast,0);
  assert.equal(parseRawPresetFile(wire([{name:'New',development:{...oldRecipe,contrast:0.4}}])).presets[0].development.contrast,0.4);
  for(const invalid of [-1.1,1.1,null,'0.5'])
    assert.equal(parseRawPresetFile(wire([{name:'Bad',development:{...oldRecipe,contrast:invalid}}])).ok,false);
});
