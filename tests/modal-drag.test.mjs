import test from 'node:test';
import assert from 'node:assert/strict';
import { createRapidRightClickTracker, makeModalDraggable } from '../src/ui/modal-controller.js';

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
  const windowTarget={
    innerWidth:1920,innerHeight:1080,
    addEventListener:(name,handler)=>windowEvents.set(name,handler),
    removeEventListener:name=>windowEvents.delete(name),
  };
  makeModalDraggable(modal,{windowTarget,ResizeObserverClass:null});
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


test('rapid right-click tracker fires only for the same project inside the threshold',()=> {
  const tracker=createRapidRightClickTracker({thresholdMs:360});
  assert.equal(tracker.register('project-a',1000),false);
  assert.equal(tracker.register('project-a',1280),true);
  assert.equal(tracker.register('project-a',1300),false);
  assert.equal(tracker.register('project-b',1400),false);
  assert.equal(tracker.register('project-a',1500),false);
  assert.equal(tracker.register('project-a',1900),false);
});
