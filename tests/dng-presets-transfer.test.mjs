import test from 'node:test';
import assert from 'node:assert/strict';
import {RAW_PRESET_STORAGE_KEY, RAW_PRESET_FILE_FORMAT, exportRawPresetFile,
  parseRawPresetFile, importRawPresetFile, readRawPresets, saveRawPreset} from '../src/formats/dng-presets.js';

const neutral={exposure:0,wbRed:1,wbBlue:1,highlights:0,shadows:0,contrast:0,demosaic:'bilinear'};
const store=()=>{const values=new Map();return {
  getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const wire=presets=>JSON.stringify({format:RAW_PRESET_FILE_FORMAT,schema:1,presets});
const item=(name,development=neutral)=>({name,development});

test('portable RAW library exports only canonical recipes and imports across browsers',()=>{
  const a=store(),b=store();
  assert.equal(saveRawPreset(a,'Studio Shadows',{...neutral,shadows:1}).ok,true);
  const exported=exportRawPresetFile(a);
  assert.equal(exported.ok,true);
  assert.equal(exported.filename,'ZeTer-RAW-presets.json');
  assert.equal(exported.content.includes('dataUrl'),false);
  assert.deepEqual(parseRawPresetFile(exported.content).presets,
    [{name:'Studio Shadows',development:{...neutral,shadows:1}}]);
  assert.deepEqual(importRawPresetFile(b,exported.content).added,1);
  assert.deepEqual(readRawPresets(b),readRawPresets(a));
});

test('portable import merges atomically and overwrites duplicate names case-insensitively',()=>{
  const s=store();saveRawPreset(s,'Portrait',neutral);saveRawPreset(s,'Keep',{...neutral,exposure:2});
  const result=importRawPresetFile(s,wire([item('portrait',{...neutral,exposure:4}),item('New')]));
  assert.equal(result.ok,true);
  assert.equal(result.added,1);
  assert.equal(result.overwritten,1);
  assert.deepEqual(readRawPresets(s).map(p=>p.name),['portrait','Keep','New']);
  assert.equal(readRawPresets(s)[1].development.exposure,2);
  assert.equal(readRawPresets(s)[0].development.exposure,4);
});

test('malformed, oversized, duplicate and extra-payload JSON cannot partially mutate presets',()=>{
  const s=store();saveRawPreset(s,'Safe',neutral);
  const initial=s.getItem(RAW_PRESET_STORAGE_KEY);
  const cases=[
    '{broken',wire([item('Valid'),item('valid')]),wire([item('Fine'),item('Bad',{...neutral,wbRed:9})]),
    wire([item('Camera',{...neutral,sourceBytes:'data:fake'})]),
    wire([{...item('X'),dataUrl:'data:raw'}]),
    JSON.stringify({format:RAW_PRESET_FILE_FORMAT,schema:2,presets:[item('X')]}),
    JSON.stringify({format:RAW_PRESET_FILE_FORMAT,schema:1,presets:[item('X')],layers:[]}),
    wire(Array.from({length:17},(_,i)=>item('Extra '+i))),
    ' '.repeat(24001)
  ];
  for(const text of cases){
    assert.equal(importRawPresetFile(s,text).ok,false,text.slice(0,50));
    assert.equal(s.getItem(RAW_PRESET_STORAGE_KEY),initial,'atomic rejection');
  }
  for(let i=0;i<15;i++)saveRawPreset(s,'Other '+i,neutral);
  const full=s.getItem(RAW_PRESET_STORAGE_KEY);
  assert.equal(importRawPresetFile(s,wire([item('Overflow')])).reason,'limit');
  assert.equal(s.getItem(RAW_PRESET_STORAGE_KEY),full);
  const denied={getItem:()=>null,setItem(){throw Error('Quota exceeded');}};
  assert.equal(importRawPresetFile(denied,wire([item('Good')])).reason,'storage');
});