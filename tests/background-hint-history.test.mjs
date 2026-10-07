import test from 'node:test';
import assert from 'node:assert/strict';
import { createObjectRemovalController } from '../src/painting/object-removal-controller.js';

function fixture(width=40,height=40) {
  const layer={width,height,x:0,y:0,scaleX:1,scaleY:1,rotation:0};
  let doc={layers:[layer]},serial=0,fill=async()=>true;
  const brush=createObjectRemovalController({strokeHistory:true,documentRef:null,
    state:{getDocument:()=>doc,selected:()=>layer,getSerial:()=>serial,isEditable:()=>true},
    geometry:{toLocal:p=>p,toDocument:p=>p},commands:{remove:args=>fill(args)},
  });
  const stroke=(x,y,mark=1,size=6)=>{brush.begin({x,y},size,mark);brush.finish({x,y},size);};
  const value=(x,y)=>brush.snapshot()?.data[y*width+x]||0;
  return {brush,layer,stroke,value,edit:()=>serial++,switchDoc:()=>doc={layers:[layer]},setFill:fn=>fill=fn};
}
test('mixed overlapping hints undo and redo in stroke order, restoring previous labels',()=>{
  const f=fixture();f.stroke(10,10);f.stroke(10,10,2);assert.equal(f.value(10,10),2);
  assert.ok(f.brush.undo());assert.equal(f.value(10,10),1);
  assert.ok(f.brush.undo());assert.equal(f.brush.hasMask(),false);assert.ok(f.brush.canRedo());
  assert.ok(f.brush.redo());assert.equal(f.value(10,10),1);
  assert.ok(f.brush.redo());assert.equal(f.value(10,10),2);
});
test('no-op and canceled strokes preserve redo, changed strokes replace redo branch',()=>{
  const f=fixture();f.stroke(10,10);f.stroke(20,20,2);f.brush.undo();
  f.stroke(10,10);assert.ok(f.brush.canRedo(),'same-label repaint is no-op');
  f.brush.begin({x:25,y:25},8,2);f.brush.cancel();assert.equal(f.value(25,25),0);assert.ok(f.brush.canRedo());
  f.stroke(30,30,2);assert.equal(f.brush.canRedo(),false);
  f.brush.undo();assert.equal(f.value(30,30),0);assert.equal(f.value(10,10),1);
});
test('active stroke refuses history travel; cancel restores only that stroke',()=>{
  const f=fixture();f.stroke(10,10);f.brush.begin({x:10,y:10},8,2);
  assert.equal(f.brush.undo(),false);assert.equal(f.brush.redo(),false);assert.ok(f.brush.isDrawing());
  f.brush.cancel();assert.equal(f.value(10,10),1);f.brush.undo();assert.equal(f.brush.hasMask(),false);
});
test('reset, owner changes and successful publication clear both transient histories',async()=>{
  for(const action of ['reset','edit','switchDoc','remove']) {
    const f=fixture();f.stroke(10,10);f.stroke(20,20,2);f.brush.undo();
    if(action==='reset')f.brush.reset();else if(action==='remove')await f.brush.remove();else f[action]();
    assert.equal(Boolean(f.brush.canUndo()),false,action);assert.equal(Boolean(f.brush.canRedo()),false,action);assert.equal(f.brush.hasMask(),false,action);
  }
});
test('pending inference blocks hint undo/redo; failed publication retains the mask and history',async()=>{
  const f=fixture();f.stroke(10,10);let complete;f.setFill(()=>new Promise(resolve=>complete=resolve));
  const pending=f.brush.remove();assert.ok(f.brush.isBusy());assert.equal(f.brush.undo(),false);assert.equal(f.brush.redo(),false);assert.equal(f.brush.reset(),false);
  complete(false);await pending;assert.equal(f.value(10,10),1);assert.ok(f.brush.undo());assert.equal(f.brush.hasMask(),false);
});
test('outside centers clip paint at every edge and corner without extending layer mask',()=>{
  for(const [x,y,px,py] of [[20,-2,20,0],[-2,20,0,20],[42,20,39,20],[20,42,20,39],[-2,-2,0,0]]) {
    const f=fixture();f.stroke(x,y,2,12);assert.equal(f.value(px,py),2);assert.equal(f.brush.snapshot().data.length,1600);
    f.brush.undo();assert.equal(f.brush.hasMask(),false);f.brush.redo();assert.equal(f.value(px,py),2);
  }
});
test('history caps both stroke count and full-mask memory; travel reuses snapshots',()=>{
  const small=fixture();for(let i=0;i<40;i++)small.stroke(20,20,i%2?2:1);
  let count=0;while(small.brush.undo())count++;assert.equal(count,32);
  const large=fixture(2048,2048);for(let i=0;i<12;i++)large.stroke(20,20,i%2?2:1);
  count=0;while(large.brush.undo())count++;assert.equal(count,8,'32 MiB / 4 MiB');
  count=0;while(large.brush.redo())count++;assert.equal(count,8);
});
