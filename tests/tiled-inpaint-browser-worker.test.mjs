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

test('cancel settles a pending supplier wait before onload or timeout', async () => {
  const h=harness();
  const pending=h.controller.run({source:'obsolete'});
  assert.equal(h.scripts.length,1);
  assert.equal(h.controller.cancel(),false); // no running Worker yet
  assert.deepEqual(await pending,{cancelled:true});
  assert.equal(h.scripts[0].removed,undefined, 'cancel did not wait for supplier timeout');
  assert.equal(h.workers.length,0);

  // A later command may reuse the supplier still loading in the background.
  const next=h.controller.run({source:'current'});
  assert.equal(h.scripts.length,1, 'never inject a duplicate supplier');
  h.globalRef.__zpeTiledInpaintWorkerSource=CODE;
  h.scripts[0].onload();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.workers.length,1);
  h.workers[0].emit('message',{ready:true});
  assert.equal(h.workers[0].sent[0].source,'current');
  h.workers[0].emit('message',{id:h.workers[0].sent[0].id,ok:true,result:{filled:1}});
  assert.deepEqual(await next,{filled:1});
});

test('superseding a pending supplier wait settles the older run immediately', async () => {
  const h=harness();
  const first=h.controller.run({source:'old'});
  const second=h.controller.run({source:'new'});
  assert.deepEqual(await first,{cancelled:true});
  assert.equal(h.scripts.length,1);
  assert.equal(h.scripts[0].removed,undefined, 'obsolete request never waits for load');
  assert.equal(h.workers.length,0);
  h.globalRef.__zpeTiledInpaintWorkerSource=CODE;
  h.scripts[0].onload();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.workers.length,1);
  h.workers[0].emit('message',{ready:true});
  assert.equal(h.workers[0].sent[0].source,'new');
  h.workers[0].emit('message',{id:h.workers[0].sent[0].id,ok:true,result:{filled:1}});
  assert.deepEqual(await second,{filled:1});
});

test('Worker constructor CSP failure falls back; successful boot compute error is never retried', async () => {
  const h=harness({alreadyLoaded:true,workerThrows:true});
  assert.deepEqual(await h.controller.run({}),{unavailable:true});
  assert.deepEqual(h.revoked,['blob:fixture']);
  assert.deepEqual(await h.controller.run({}),{unavailable:true});
  assert.equal(h.scripts.length,0);
  const k=harness({alreadyLoaded:true});
  const pending=k.controller.run({});
  await new Promise(resolve => setImmediate(resolve));
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
