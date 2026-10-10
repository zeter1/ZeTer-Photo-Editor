import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserTiledInpaintWorkerController } from '../src/core/tiled-inpaint-browser-worker.js';

const CODE = '/* ZeTer tiled Content-Aware Worker. Generated; do not edit. */';
function harness({ alreadyLoaded = false, workerThrows = false } = {}) {
  const scripts = [], workers = [], revoked = [];
  const globalRef = alreadyLoaded ? { __zpeTiledInpaintWorkerSource:CODE } : {};
  const documentRef = { baseURI:'file:///tmp/zpe/index.html', head:{ appendChild(script) { scripts.push(script); } },
    createElement(tag) { assert.equal(tag, 'script'); return { remove() { this.removed = true; } }; } };
  class BlobType { constructor(content, opts) { assert.deepEqual(content,[CODE]); assert.equal(opts.type,'text/javascript'); } }
  class WorkerType {
    constructor(url) { if (workerThrows) throw Error('Blocked by CSP'); this.url=url;this.sent=[];this.handlers={};workers.push(this); }
    addEventListener(type,cb) {this.handlers[type]=cb;}
    removeEventListener(type,cb) {if(this.handlers[type]===cb)delete this.handlers[type];}
    postMessage(value) {this.sent.push(value);}
    terminate() { this.terminated=true; }
    emit(type,data) {this.handlers[type]?.({data});}
  }
  const URLApi = {
    createObjectURL() {return 'blob:fixture';},
    revokeObjectURL(url) { revoked.push(url); },
  };
  const controller = createBrowserTiledInpaintWorkerController({documentRef,globalRef,WorkerType,BlobType,URLApi,loadTimeoutMs:100});
  return {controller,scripts,workers,revoked,globalRef};
}

test('file:// supplier is lazy, single-flight and hands a Blob URL to a classic Worker', async () => {
  const h=harness();
  const a=h.controller.run({source:'a'});
  const b=h.controller.run({source:'b'});
  assert.equal(h.scripts.length,1);
  assert.equal(h.scripts[0].src,'file:///tmp/zpe/src/core/tiled-inpaint-worker-source.js');
  h.globalRef.__zpeTiledInpaintWorkerSource=CODE;
  h.scripts[0].onload();
  assert.deepEqual(await a,{cancelled:true});
  await Promise.resolve();
  assert.equal(h.workers.length,1);
  h.workers[0].emit('message',{ready:true});
  assert.equal(h.workers[0].sent[0].source,'b');
  h.workers[0].emit('message',{id:h.workers[0].sent[0].id,ok:true,result:{filled:1}});
  assert.deepEqual(await b,{filled:1});
  assert.deepEqual(h.revoked,['blob:fixture']);
  assert.equal(h.scripts[0].removed,true);
});

test('script failure triggers a non-destructive unavailable fallback', async () => {
  const h=harness();
  const work=h.controller.run({});
  h.scripts[0].onerror();
  assert.deepEqual(await work,{unavailable:true});
  assert.deepEqual(await h.controller.run({}),{unavailable:true});
  assert.equal(h.scripts.length,1);
  assert.equal(h.workers.length,0);
});

test('cancel during pending loader suppresses Worker creation and result', async () => {
  const h=harness();
  const pending=h.controller.run({});
  assert.equal(h.controller.cancel(),false);
  h.globalRef.__zpeTiledInpaintWorkerSource=CODE;
  h.scripts[0].onload();
  assert.deepEqual(await pending,{cancelled:true});
  assert.equal(h.workers.length,0);
});

test('Worker constructor CSP failure falls back; successful boot compute error is never retried', async () => {
  const h=harness({alreadyLoaded:true,workerThrows:true});
  assert.deepEqual(await h.controller.run({}),{unavailable:true});
  assert.deepEqual(h.revoked,['blob:fixture']);
  assert.deepEqual(await h.controller.run({}),{unavailable:true});
  assert.equal(h.scripts.length,0);
  const k=harness({alreadyLoaded:true});
  const pending=k.controller.run({});
  await Promise.resolve();
  k.workers[0].emit('message',{ready:true});
  k.workers[0].emit('message',{id:k.workers[0].sent[0].id,ok:false,error:{message:'kernel failed'}});
  await assert.rejects(pending,/kernel failed/);
});

test('stale owner does not load a supplier or create a Worker', async () => {
  const h=harness();
  assert.deepEqual(await h.controller.run({},{isCurrent:()=>false}),{cancelled:true});
  assert.equal(h.scripts.length,0);
  assert.equal(h.workers.length,0);
});

test('missing supplier onload times out and leaves no hanging request', async () => {
  const h=harness();
  const result=await h.controller.run({});
  assert.deepEqual(result,{unavailable:true});
  assert.equal(h.workers.length,0);
  assert.equal(h.scripts[0].removed,true);
});
