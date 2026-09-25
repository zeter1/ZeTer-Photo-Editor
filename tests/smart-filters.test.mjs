import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDocument, createSmartObjectLayer, createSmartFilter, addLayer,
  sanitizeProject, snapshotDocument, MAX_SMART_FILTERS,
} from '../src/core/state.js';

const render=await readFile(new URL('../src/core/render.js',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const styles=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');

test('Smart Filters Stage 11a survives .zpe sanitization and clamps filter payloads',()=>{
  const doc=createDocument({name:'smart-filters',width:64,height:64});
  addLayer(doc,createSmartObjectLayer({
    width:32,height:32,previewDataUrl:'data:image/png;base64,AAAA',
    embeddedDocument:createDocument({name:'embedded',width:32,height:32}),
    smartFilters:[
      createSmartFilter({id:'one',name:'Exposure',filters:{exposure:99,blur:-5}}),
      createSmartFilter({id:'two',name:'Disabled',enabled:false,filters:{brightness:150,gamma:.01}}),
    ],
  }));
  const safe=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  const stack=safe.layers[0].smartFilters;
  assert.equal(stack.length,2);
  assert.equal(stack[0].name,'Exposure');
  assert.equal(stack[0].filters.exposure,4);
  assert.equal(stack[0].filters.blur,0);
  assert.equal(stack[1].enabled,false);
  assert.equal(stack[1].filters.brightness,150);
  assert.equal(stack[1].filters.gamma,.1);
});

test('Smart Filter sanitizer bounds the stack and repairs duplicate IDs',()=>{
  const raw=Array.from({length:MAX_SMART_FILTERS+8},(_,index)=>({
    id:'duplicate',name:`Filter ${index+1}`,enabled:true,filters:{contrast:100+index},
  }));
  const safe=sanitizeProject({
    version:1,name:'bounded',width:20,height:20,background:'transparent',
    layers:[{id:'so',type:'smart-object',name:'SO',width:10,height:10,previewDataUrl:null,embeddedDocument:null,smartFilters:raw}],
  });
  const stack=safe.layers[0].smartFilters;
  assert.equal(stack.length,MAX_SMART_FILTERS);
  assert.equal(new Set(stack.map(item=>item.id)).size,MAX_SMART_FILTERS);
});

test('Smart Filter renderer applies visible top-first stack in bottom-up order and isolates its cache key',()=>{
  assert.match(render,/function smartFilterStackSignature\(layer\)/);
  assert.match(render,/async function applySmartFilterStack\(source, layer\)/);
  assert.match(render,/for \(let index = stack\.length - 1; index >= 0; index -= 1\)/);
  assert.match(render,/if \(!item \|\| item\.enabled === false\) continue/);
  assert.match(render,/layer\.type === 'smart-object' \? await applySmartFilterStack\(img, layer\) : img/);
  assert.match(render,/smartFilterStackSignature\(layer\)/);
  assert.match(render,/smartFilterCache\.clear\(\)/);
});

test('Smart Filter UI supports live add/edit, visibility, reordering, removal and bounded count',()=>{
  assert.match(main,/function openSmartFilterDialog\(layer=selected\(\),index=-1\)/);
  assert.match(main,/function moveSmartFilter\(layer,index,direction\)/);
  assert.match(main,/function toggleSmartFilter\(layer,index\)/);
  assert.match(main,/function removeSmartFilter\(layer,index\)/);
  assert.match(main,/function clearSmartFilters\(layer=selected\(\)\)/);
  assert.match(main,/data-smart-filter-edit/);
  assert.match(main,/data-smart-filter-up/);
  assert.match(main,/data-smart-filter-down/);
  assert.match(main,/Достигнут лимит: 24 смарт-фильтра/);
  assert.match(main,/Фильтры в списке применяются снизу вверх/);
  assert.match(styles,/\.smart-filter-stack/);
  assert.match(styles,/\.smart-filter-modal/);
});
