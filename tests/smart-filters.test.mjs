import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDocument, createSmartObjectLayer, createSmartFilter, createSmartFilterMask, addLayer,
  sanitizeProject, snapshotDocument, MAX_SMART_FILTERS,
} from '../src/core/state.js';

const render=await readFile(new URL('../src/core/render.js',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const styles=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');

test('Smart Filters Stage 11b survives .zpe sanitization and clamps filter/mask payloads',()=>{
  const doc=createDocument({name:'smart-filters',width:64,height:64});
  addLayer(doc,createSmartObjectLayer({
    width:32,height:32,previewDataUrl:'data:image/png;base64,AAAA',
    embeddedDocument:createDocument({name:'embedded',width:32,height:32}),
    smartFilters:[createSmartFilter({id:'one',name:'Exposure',filters:{exposure:99,blur:-5}}),createSmartFilter({id:'two',name:'Disabled',enabled:false,filters:{brightness:150,gamma:.01}})],
    smartFilterMask:createSmartFilterMask({dataUrl:'data:image/png;base64,BBBB',invert:true,density:3,feather:999}),
  }));
  const layer=sanitizeProject(JSON.parse(snapshotDocument(doc))).layers[0],stack=layer.smartFilters;
  assert.equal(stack.length,2); assert.equal(stack[0].filters.exposure,4); assert.equal(stack[0].filters.blur,0);
  assert.equal(stack[1].enabled,false); assert.equal(stack[1].filters.brightness,150); assert.equal(stack[1].filters.gamma,.1);
  assert.equal(layer.smartFilterMask.enabled,true); assert.equal(layer.smartFilterMask.invert,true);
  assert.equal(layer.smartFilterMask.density,1); assert.equal(layer.smartFilterMask.feather,250);
});

test('Smart Filter sanitizer bounds the stack, repairs duplicate IDs and accepts maskless legacy data',()=>{
  const raw=Array.from({length:MAX_SMART_FILTERS+8},(_,index)=>({id:'duplicate',name:`Filter ${index+1}`,enabled:true,filters:{contrast:100+index}}));
  const safe=sanitizeProject({version:1,name:'bounded',width:20,height:20,background:'transparent',layers:[{id:'so',type:'smart-object',name:'SO',width:10,height:10,previewDataUrl:null,embeddedDocument:null,smartFilters:raw}]});
  assert.equal(safe.layers[0].smartFilters.length,MAX_SMART_FILTERS);
  assert.equal(new Set(safe.layers[0].smartFilters.map(item=>item.id)).size,MAX_SMART_FILTERS);
  assert.equal(safe.layers[0].smartFilterMask,null);
});

test('Smart Filter renderer composites the ordered stack through a separate mask',()=>{
  assert.ok(render.includes('async function applySmartFilterMask(source, filtered, mask, width, height)'));
  assert.ok(render.includes('amount = 1 - density + density * amount;'));
  assert.ok(render.includes("filteredCtx.globalCompositeOperation = 'destination-in';"));
  assert.ok(render.includes('outputCtx.drawImage(source, 0, 0, width, height);'));
  assert.ok(render.includes('for (let index = stack.length - 1; index >= 0; index -= 1)'));
  assert.ok(render.includes('const result = await applySmartFilterMask(source, current, layer.smartFilterMask, width, height);'));
});

test('Smart Filter UI supports mask creation, invert, visibility, density, feather and removal',()=>{
  assert.ok(main.includes('async function setSmartFilterMask(layer=selected(),fromSelection=false)'));
  assert.ok(main.includes('function toggleSmartFilterMask(layer=selected())'));
  assert.ok(main.includes('function invertSmartFilterMask(layer=selected())'));
  assert.ok(main.includes('function removeSmartFilterMask(layer=selected())'));
  assert.ok(main.includes('data-smart-filter-mask-density'));
  assert.ok(main.includes('data-smart-filter-mask-feather'));
  assert.ok(main.includes('Маска смарт-фильтров из выделения'));
  assert.ok(styles.includes('.smart-filter-mask'));
});
