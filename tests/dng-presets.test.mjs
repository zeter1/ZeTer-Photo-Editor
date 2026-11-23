import test from 'node:test';
import assert from 'node:assert/strict';
import {RAW_PRESET_STORAGE_KEY,normalizeRawPresetDevelopment,normalizeRawPresetName,
  readRawPresets,saveRawPreset,deleteRawPreset} from '../src/formats/dng-presets.js';

function storage(){
  const data=new Map();
  return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
}
const neutral={exposure:0,wbRed:1,wbBlue:1,highlights:0,shadows:0,contrast:0,demosaic:'bilinear'};

test('preset names and development reject non-finite data; clamp numeric extremes',()=>{
  assert.deepEqual(normalizeRawPresetDevelopment({...neutral,exposure:900,wbRed:-7,highlights:-90}),
    {...neutral,exposure:5,wbRed:0.25,highlights:-1});
  assert.equal(normalizeRawPresetDevelopment({...neutral,shadows:NaN}),null);
  assert.equal(normalizeRawPresetDevelopment({...neutral,demosaic:'fast'}),null);
  assert.equal(normalizeRawPresetDevelopment({...neutral,exposure:'1'}),null);
  assert.deepEqual(normalizeRawPresetDevelopment({...neutral,demosaic:undefined}),neutral);
  assert.equal(normalizeRawPresetName('   Studio   Neutral \n'),'Studio Neutral');
  assert.equal(normalizeRawPresetName('\u0000\t '),'');
  assert.equal(normalizeRawPresetName('x'.repeat(49)),'');
});
test('save overwrite and delete persistent named recipes without reference aliasing',()=>{
  const store=storage();
  const source={...neutral,exposure:1,shadows:0.6,demosaic:'edge-aware-rgb'};
  assert.equal(saveRawPreset(store,'Portrait',source).ok,true);
  source.exposure=-4;
  assert.equal(readRawPresets(store)[0].development.exposure,1);
  assert.equal(saveRawPreset(store,'portrait',{...neutral,exposure:2}).ok,true);
  assert.equal(readRawPresets(store).length,1);
  assert.equal(readRawPresets(store)[0].development.exposure,2);
  assert.equal(deleteRawPreset(store,'portrait'),true);
  assert.deepEqual(readRawPresets(store),[]);
  assert.equal(deleteRawPreset(store,'portrait'),false);
});
test('cap user presets and reject malformed/tampered or inaccessible storage',()=>{
  const store=storage();
  for(let i=0;i<16;i++)assert.equal(saveRawPreset(store,'Preset '+i,neutral).ok,true);
  assert.equal(saveRawPreset(store,'Overflow',neutral).reason,'limit');
  assert.equal(saveRawPreset(store,'Preset 0',{...neutral,exposure:2}).ok,true);
  store.setItem(RAW_PRESET_STORAGE_KEY,JSON.stringify({schema:1,presets:[
    {name:'Good',development:neutral},{name:'Injected',development:{...neutral,shadows:'1'}},
    {name:'Broken',development:{...neutral,demosaic:'bad'}},{name:'Good',development:neutral}]}));
  assert.deepEqual(readRawPresets(store).map(p=>p.name),['Good']);
  store.setItem(RAW_PRESET_STORAGE_KEY,'{broken');
  assert.deepEqual(readRawPresets(store),[]);
  const denied={getItem(){throw Error('SecurityError');},setItem(){throw Error('QuotaExceeded');}};
  assert.deepEqual(readRawPresets(denied),[]);
  assert.equal(saveRawPreset(denied,'Test',neutral).ok,false);
  assert.equal(deleteRawPreset(denied,'Test'),false);
  assert.equal(saveRawPreset(null,'Test',neutral).ok,false);
});
