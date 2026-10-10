import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import {
  createPixelBuffer,
  inpaintTiledPixelBufferSource,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { createTiledInpaintWorkerJobController } from '../src/core/tiled-inpaint-worker-client.js';

class FakeBrowserWorker {
  constructor() {
    this.handlers = new Map();
    this.sent = [];
    this.terminated = 0;
  }
  addEventListener(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.handlers.get(type)?.delete(handler);
  }
  emit(type, payload) {
    for (const callback of [...(this.handlers.get(type) || [])]) {
      callback(type === 'message' ? { data:payload } : payload);
    }
  }
  postMessage(job) { this.sent.push(job); }
  terminate() { this.terminated += 1; }
}

function fakeController() {
  const workers = [];
  const client = createTiledInpaintWorkerJobController({
    createWorker:() => {
      const worker = new FakeBrowserWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { workers, client };
}

test('Stage 003 Worker client: a real Node worker executes detached Float32 CMYKA job with sync parity', async () => {
  const width = 16, height = 16;
  const data = new Float32Array(width * height * 5);
  for (let i = 0; i < width * height; i += 1) {
    data.set([0.12, 0.23, 0.34, 0.45, 1], i * 5);
  }
  data.set([9, 9, 9, 9, 1], (7 * width + 7) * 5);
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'cmyk', channels:5,
    bitsPerChannel:32, colorSpace:'device-cmyk', data,
  }), { tileSize:8 });
  const original = JSON.stringify(source);
  const expected = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x,y) => x === 7 && y === 7,
    halo:2, maxLayerPixels:100,
  });
  const client = createTiledInpaintWorkerJobController({
    createWorker:() => new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url), { type:'module' }),
  });
  const result = await client.run({ source, selectedIndices:Uint32Array.of(7 * width + 7), halo:2, maxLayerPixels:100 });
  assert.deepEqual(result, expected);
  assert.equal(client.cancel(), false, 'completed job has no live worker');
  assert.equal(JSON.stringify(source), original, 'worker must not mutate caller source');
});

test('Stage 003 Worker client: supersession terminates the old job and ignores late reply', async () => {
  const { client, workers } = fakeController();
  const first = client.run({ source:'old' });
  const oldWorker = workers[0];
  oldWorker.emit('message', { ready:true });
  assert.equal(oldWorker.sent.length, 1);
  const second = client.run({ source:'new' });
  const nextWorker = workers[1];
  assert.deepEqual(await first, { cancelled:true });
  assert.equal(oldWorker.terminated, 1);
  assert.equal(oldWorker.handlers.get('message').size, 0, 'no stale listener');
  oldWorker.emit('message', { id:oldWorker.sent[0].id, ok:true, result:'obsolete' });
  nextWorker.emit('message', { ready:true });
  assert.equal(nextWorker.sent.length, 1);
  assert.notEqual(nextWorker.sent[0].id, oldWorker.sent[0].id);
  nextWorker.emit('message', { id:nextWorker.sent[0].id, ok:true, result:'fresh' });
  assert.equal(await second, 'fresh');
  assert.equal(nextWorker.terminated, 1);
});

test('Stage 003 Worker client: explicit cancellation before ready never dispatches', async () => {
  const { client, workers } = fakeController();
  const pending = client.run({ source:'before-ready' });
  assert.equal(client.cancel(), true);
  assert.deepEqual(await pending, { cancelled:true });
  workers[0].emit('message', { ready:true });
  assert.equal(workers[0].sent.length, 0);
  assert.equal(workers[0].terminated, 1);
  assert.equal(client.cancel(), false);
});

test('Stage 003 Worker client: exact-owner guard fails closed before dispatch and on result', async () => {
  const { client, workers } = fakeController();
  const staleBefore = await client.run({ source:'stale' }, { isCurrent:() => false });
  assert.deepEqual(staleBefore, { cancelled:true });
  assert.equal(workers.length, 0, 'do not allocate Worker for stale owner');

  let current = true;
  const pending = client.run({ source:'live' }, { isCurrent:() => current });
  workers[0].emit('message', { ready:true });
  const id = workers[0].sent[0].id;
  current = false;
  workers[0].emit('message', { id, ok:true, result:'must-not-publish' });
  assert.deepEqual(await pending, { cancelled:true });
  assert.equal(workers[0].terminated, 1);

  const second = client.run({}, { isCurrent:() => { throw new Error('disposed'); } });
  assert.deepEqual(await second, { cancelled:true });
  assert.equal(workers.length, 1);
});

test('Stage 003 Worker client: malformed reply, compute error and early exit fail closed; later jobs work', async () => {
  const { client, workers } = fakeController();
  const bad = client.run({});
  workers[0].emit('message', { ready:true });
  workers[0].emit('message', { id:workers[0].sent[0].id, ok:'maybe' });
  await assert.rejects(bad, /invalid reply/);
  assert.equal(workers[0].terminated, 1);

  const errored = client.run({});
  workers[1].emit('message', { ready:true });
  workers[1].emit('message', {
    id:workers[1].sent[0].id, ok:false,
    error:{ name:'RangeError', message:'invalid selected index' },
  });
  await assert.rejects(errored, error => error.name === 'RangeError' && /selected index/.test(error.message));

  const recovered = client.run({});
  workers[2].emit('message', { ready:true });
  workers[2].emit('message', { id:workers[2].sent[0].id - 1, ok:true, result:'wrong-id' });
  workers[2].emit('message', { id:workers[2].sent[0].id, ok:true, result:'ok' });
  assert.equal(await recovered, 'ok');

  assert.equal(client.cancel(), false);
});

test('Stage 003 Worker client: invalid factory and invalid isCurrent reject instead of publishing', async () => {
  assert.throws(() => createTiledInpaintWorkerJobController(), /createWorker/);
  const { client, workers } = fakeController();
  await assert.rejects(client.run({}, { isCurrent:true }), /isCurrent/);
  assert.equal(workers.length, 0);
});


test('Stage 003 Worker client: synchronous ready/reply during subscription leaves no active job or handlers', async () => {
  class ReentrantReadyWorker extends FakeBrowserWorker {
    addEventListener(type, handler) {
      super.addEventListener(type, handler);
      if (type === 'error') this.emit('message', { ready:true });
    }
    postMessage(job) {
      super.postMessage(job);
      this.emit('message', { id:job.id, ok:true, result:'instant' });
    }
  }
  const workers = [];
  const client = createTiledInpaintWorkerJobController({
    createWorker:() => {
      const worker = new ReentrantReadyWorker();
      workers.push(worker);
      return worker;
    },
  });
  assert.equal(await client.run({ source:'example' }), 'instant');
  assert.equal(workers[0].sent.length, 1);
  assert.equal(workers[0].terminated, 1);
  assert.equal(workers[0].handlers.get('message').size, 0);
  assert.equal(workers[0].handlers.get('error').size, 0);
  assert.equal(client.cancel(), false, 'already completed worker cannot remain active');
  assert.equal(await client.run({ source:'next' }), 'instant', 'subsequent work remains available');
});

test('Stage 003 Worker client: synchronous subscription errors clean up and allow recovery', async () => {
  class StartupErrorWorker extends FakeBrowserWorker {
    addEventListener(type, handler) {
      super.addEventListener(type, handler);
      if (type === 'error') this.emit('error', { message:'startup failed' });
    }
  }
  const workers = [];
  const client = createTiledInpaintWorkerJobController({
    createWorker:() => {
      const worker = workers.length === 0 ? new StartupErrorWorker() : new FakeBrowserWorker();
      workers.push(worker);
      return worker;
    },
  });
  await assert.rejects(client.run({ source:'first' }), /startup failed/);
  assert.equal(workers[0].terminated, 1);
  assert.equal(workers[0].handlers.get('message').size, 0);
  assert.equal(workers[0].handlers.get('error').size, 0);
  assert.equal(client.cancel(), false);
  const recovered = client.run({ source:'second' });
  workers[1].emit('message', { ready:true });
  workers[1].emit('message', { id:workers[1].sent[0].id, ok:true, result:'recovered' });
  assert.equal(await recovered, 'recovered');
});

test('Stage 003 Worker client: exceptions while subscribing terminate a partially attached worker', async () => {
  class ThrowingSubscribeWorker extends FakeBrowserWorker {
    addEventListener(type, handler) {
      super.addEventListener(type, handler);
      if (type === 'error') throw new Error('listener registration failed');
    }
  }
  const worker = new ThrowingSubscribeWorker();
  const client = createTiledInpaintWorkerJobController({ createWorker:() => worker });
  await assert.rejects(client.run({}), /listener registration failed/);
  assert.equal(worker.terminated, 1);
  assert.equal(worker.handlers.get('message').size, 0);
  assert.equal(worker.handlers.get('error').size, 0);
  assert.equal(client.cancel(), false);
});
