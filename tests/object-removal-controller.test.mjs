import test from 'node:test';
import assert from 'node:assert/strict';
import { createObjectRemovalController } from '../src/painting/object-removal-controller.js';

function harness() {
  const layer = { width:20, height:20, x:0, y:0, scaleX:1, scaleY:1, rotation:0 };
  let doc = { layers:[layer] }, selected = layer, serial = 0, locked = false;
  const calls = [], states = [];
  let fill = async args => { calls.push(args); return true; };
  const controller = createObjectRemovalController({
    state:{ getDocument:()=>doc, getSerial:()=>serial, selected:()=>selected, isEditable:()=>!locked },
    geometry:{ toLocal:p=>p, toDocument:p=>p },
    commands:{ remove:args=>fill(args) },
    ui:{ changed:s=>states.push(s), setStatus(){} },
  });
  return { controller, layer, calls, states, switchDoc(){doc={layers:[layer]};},
    replace(){doc.layers[0]={...layer};}, lock(){locked=true;}, edit(){serial++;},
    selectOther(){selected={...layer};}, setFill(fn){fill=fn;} };
}

test('multiple brush strokes accumulate a precise mask; removal freezes it and clears on success', async () => {
  const h=harness(), c=h.controller;
  assert.equal(c.begin({x:3,y:3},4),true);
  c.finish({x:8,y:3},4);
  c.begin({x:12,y:12},3); c.finish({x:12,y:12},3);
  assert.equal(c.hasMask(),true);
  assert.equal(await c.remove(),true);
  const a=h.calls[0];
  assert.equal(a.isAllowed(3,3),true);
  assert.equal(a.isAllowed(7,3),true);
  assert.equal(a.isAllowed(12,12),true);
  assert.equal(a.isAllowed(0,18),false);
  assert.equal(a.ownerLayer,h.layer);
  assert.equal(a.historyLabel,'Удалить объект');
  assert.equal(c.hasMask(),false);
  assert.equal(a.isAllowed(3,3),true);
});

test('cancel rolls back only the active stroke; reset clears the whole mask', () => {
  const c=harness().controller;
  c.begin({x:3,y:3},2); c.finish({x:3,y:3},2);
  c.begin({x:12,y:12},2); c.cancel();
  const m=c.snapshot();
  assert.equal(m.data[3*20+3],1);
  assert.equal(m.data[12*20+12],0);
  c.reset(); assert.equal(c.hasMask(),false);
});

for (const action of ['switchDoc','replace','lock','edit','selectOther']) {
  test(`stale/locked mask cannot edit after ${action}`, async () => {
    const h=harness(); h.controller.begin({x:3,y:3},4); h.controller.finish({x:3,y:3},4);
    h[action](); assert.equal(await h.controller.remove(),false); assert.equal(h.calls.length,0);
  });
}

test('failed fill preserves mask, duplicate submit is blocked and pending mask cannot change', async () => {
  const h=harness(), c=h.controller; let resolve;
  h.setFill(()=>new Promise(r=>{resolve=r;}));
  c.begin({x:3,y:3},4); c.finish({x:3,y:3},4);
  const pending=c.remove();
  assert.equal(await c.remove(),false); assert.equal(c.begin({x:10,y:10},4),false);
  assert.equal(c.reset(),false); assert.equal(c.hasMask(),true);
  resolve(false); assert.equal(await pending,false); assert.equal(c.hasMask(),true);
});

test('outside release is clipped; layer safety limit rejects before allocation', () => {
  const h=harness(), c=h.controller;
  c.begin({x:3,y:3},2); c.finish({x:-100,y:3},2);
  assert.equal(c.snapshot().data[3*20],1);
  c.reset(); h.layer.width=9000; h.layer.height=9000;
  assert.equal(c.begin({x:3,y:3},2),false); assert.equal(c.hasMask(),false);
});

test('abort signals the pending operation and preserves valid mask',async()=>{const h=harness(),c=h.controller;let args;h.setFill(a=>{args=a;return new Promise(r=>a.signal.addEventListener('abort',()=>r(false)));});c.begin({x:3,y:3},4);c.finish({x:3,y:3},4);let p=c.remove();assert.equal(args.isCurrent(),true);c.abort();assert.equal(await p,false);assert.equal(args.signal.aborted,true);assert.equal(c.hasMask(),true);});
