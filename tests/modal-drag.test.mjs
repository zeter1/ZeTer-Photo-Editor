import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const source=main.slice(main.indexOf('function makeModalDraggable(modal) {'),main.indexOf('function attachTextPreview('));

test('shared modal drag stays inside the viewport and stops on pointer release',()=>{
  const events=new Map();
  const header={
    addEventListener:(name,handler)=>events.set(name,handler),
    setPointerCapture:()=>{},
  };
  const modal={
    style:{},offsetWidth:860,offsetHeight:540,offsetLeft:530,offsetTop:270,isConnected:true,
    querySelector:()=>header,getBoundingClientRect:()=>({left:530,top:270}),
  };
  const windowEvents=new Map();
  const context={
    window:{innerWidth:1920,innerHeight:1080,addEventListener:(name,handler)=>windowEvents.set(name,handler),removeEventListener:name=>windowEvents.delete(name)},
    clamp:(value,min,max)=>Math.max(min,Math.min(max,value)),
  };
  vm.runInNewContext(`${source}\nglobalThis.makeDraggable=makeModalDraggable;`,context);
  context.makeDraggable(modal);
  assert.equal(modal.style.left,'530px');
  assert.equal(modal.style.top,'270px');
  events.get('pointerdown')({button:0,pointerId:7,clientX:600,clientY:300,preventDefault(){}});
  events.get('pointermove')({pointerId:7,clientX:1800,clientY:1000});
  assert.equal(modal.style.left,'1048px');
  assert.equal(modal.style.top,'528px');
  events.get('pointerup')({pointerId:7});
  events.get('pointermove')({pointerId:7,clientX:200,clientY:200});
  assert.equal(modal.style.left,'1048px');
  modal.previewCleanup();
  assert.equal(windowEvents.size,0);
});