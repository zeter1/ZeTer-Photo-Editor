import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import {
  createPixelBuffer,
  deserializePixelBufferSource,
  inpaintTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { runTiledInpaintWorkerJob } from '../src/core/tiled-inpaint-worker-protocol.js';

const WIDTH = 256;
const HEIGHT = 16;
const SELECTED = [7 * WIDTH + 7, 7 * WIDTH + 248];

function fixture() {
  const data = new Float32Array(WIDTH * HEIGHT * 5);
  for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
    data.set([0.12, 0.23, 0.34, 0.45, 1], i * 5);
  }
  for (const index of SELECTED) data.set([9, 9, 9, 9, 1], index * 5);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:WIDTH, height:HEIGHT, model:'cmyk', channels:5,
    bitsPerChannel:32, colorSpace:'device-cmyk', data,
  }), { tileSize:8 });
}

async function readyWorker() {
  const worker = new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url), {
    type:'module',
  });
  try {
    const [ready] = await once(worker, 'message');
    assert.deepEqual(ready, { ready:true });
    return worker;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

async function send(worker, job) {
  const response = once(worker, 'message');
  worker.postMessage(job);
  const [message] = await response;
  return message;
}

test('Stage 003 Worker protocol: actual Node Worker matches synchronous disconnected CMYKA fill', async () => {
  const source = fixture();
  const before = JSON.stringify(source);
  const job = {
    id:17, source, selectedIndices:Uint32Array.from(SELECTED),
    halo:2, maxLayerPixels:64,
  };
  const expected = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => SELECTED.includes(y * WIDTH + x),
    halo:2, maxLayerPixels:64,
  });
  const direct = runTiledInpaintWorkerJob(job);
  assert.deepEqual(direct, expected);
  const worker = await readyWorker();
  try {
    const reply = await send(worker, job);
    assert.equal(reply.id, 17);
    assert.equal(reply.ok, true);
    assert.deepEqual(reply.result, expected);
    assert.equal(reply.result.filled, 2);
    assert.equal(reply.result.changedTiles, 2);
    const restored = deserializePixelBufferSource(reply.result.source);
    for (const index of SELECTED) assert.notEqual(restored.data[index * 5], 9);
    assert.equal(JSON.stringify(source), before, 'caller source is never mutated');
  } finally {
    await worker.terminate();
  }
});

test('Stage 003 Worker protocol: malformed indices fail closed and do not poison later jobs', async () => {
  const source = fixture();
  const original = JSON.stringify(source);
  const worker = await readyWorker();
  try {
    for (const indices of [[SELECTED[0], SELECTED[0]], [-1], [WIDTH * HEIGHT]]) {
      const reply = await send(worker, { id:9, source, selectedIndices:indices });
      assert.equal(reply.id, 9);
      assert.equal(reply.ok, false);
      assert.equal(reply.error.name, 'RangeError');
      assert.match(reply.error.message, /selected index/);
    }
    const ok = await send(worker, { id:10, source, selectedIndices:[] });
    assert.equal(ok.ok, true);
    assert.equal(ok.result.changed, 0);
    assert.equal(JSON.stringify(source), original);
  } finally {
    await worker.terminate();
  }
});

test('Stage 003 Worker protocol: terminated idle worker never receives a job or publishes source', async () => {
  const source = fixture();
  const original = JSON.stringify(source);
  const worker = await readyWorker();
  const exitCode = await worker.terminate();
  assert.ok(Number.isInteger(exitCode));
  assert.equal(JSON.stringify(source), original);
});

test('Stage 003 Worker protocol: compact selection bitmap preserves bit boundaries, order and tiled parity', () => {
  const source = fixture();
  const before = JSON.stringify(source);
  // Indices on either side of an 8-bit boundary share neither a byte nor a bit.
  const indices = [7 * WIDTH + 248, 7 * WIDTH + 8, 7 * WIDTH + 7];
  const expectedSelection = new Set(indices);
  const expected = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => expectedSelection.has(y * WIDTH + x),
    halo:2, maxLayerPixels:300,
  });
  const actual = runTiledInpaintWorkerJob({
    source, selectedIndices:Uint32Array.from(indices),
    halo:2, maxLayerPixels:300,
  });
  assert.deepEqual(actual, expected);
  assert.deepEqual(runTiledInpaintWorkerJob({
    source, selectedIndices:[...indices].reverse(),
    halo:2, maxLayerPixels:300,
  }), expected, 'array input and reordered indices must have identical semantics');
  assert.equal(JSON.stringify(source), before, 'the detached worker input remains immutable');

  for (const invalid of [
    [indices[0], indices[1], indices[0]],
    [indices[0], WIDTH * HEIGHT],
    [-1],
    [3.5],
    [NaN],
  ]) {
    assert.throws(
      () => runTiledInpaintWorkerJob({ source, selectedIndices:invalid }),
      /invalid or duplicate selected index/,
    );
  }
});

test('Stage 003 Worker protocol: invalid geometry and oversized index lists fail before bitmap allocation', () => {
  const source = fixture();
  assert.throws(() => runTiledInpaintWorkerJob({
    source:{ width:Math.floor(48 * 1024 * 1024 / 3) + 1, height:1 },
    selectedIndices:[],
  }), /invalid source geometry/);
  assert.throws(() => runTiledInpaintWorkerJob({
    source,
    selectedIndices:new Array(WIDTH * HEIGHT + 1).fill(0),
  }), /invalid or duplicate selected index/);
});

test('Stage 003: frozen-index compute avoids the full predicate scan and preserves sparse cross-tile semantics', () => {
  const source = fixture();
  const input = Uint32Array.from([SELECTED[1], SELECTED[0]]);
  const unchanged = JSON.stringify(source);
  const expected = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => SELECTED.includes(y * WIDTH + x),
    halo:2, maxLayerPixels:64,
  });
  const result = inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:input, halo:2, maxLayerPixels:64,
  });
  assert.deepEqual(result, expected);
  assert.deepEqual([...input], [SELECTED[1], SELECTED[0]], 'caller snapshot remains unchanged');
  assert.equal(JSON.stringify(source), unchanged);
  assert.deepEqual(inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:[], halo:2,
  }), inpaintTiledPixelBufferSource(source, { isAllowed:() => false, halo:2 }));

  // The protocol must dispatch the frozen-index kernel, not reconstruct an
  // isAllowed callback and perform another width*height scan in the Worker.
  assert.match(runTiledInpaintWorkerJob.toString(), /inpaintTiledPixelBufferSourceFromIndices/);
  assert.doesNotMatch(runTiledInpaintWorkerJob.toString(), /\bisAllowed\s*:/);
});

test('Stage 003: frozen-index input validation rejects duplicates before publication', () => {
  const source = fixture();
  for (const selectedIndices of [
    [SELECTED[0], SELECTED[0]], [WIDTH * HEIGHT], [-1], [NaN], [3.5],
  ]) {
    assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
      selectedIndices,
    }), /invalid or duplicate selected index/);
  }
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:'7',
  }), /frozen selection indices/);
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices({
    width:Math.floor(48 * 1024 * 1024 / 3) + 1, height:1,
  }, { selectedIndices:[] }), /invalid source geometry/);
});
