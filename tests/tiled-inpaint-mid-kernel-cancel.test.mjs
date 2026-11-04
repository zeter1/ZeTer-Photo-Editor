import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { Worker } from 'node:worker_threads';
import { createTiledInpaintWorkerJobController } from '../src/core/tiled-inpaint-worker-client.js';

// This fixture does NOT model production source sharing. Shared samples are a
// test-only probe of writes *inside* the actual inpaintSelectedSamples kernel.
// The real tiled Worker clones its source and commits only a complete reply.
const FIXTURE_URL = new URL('./fixtures/tiled-inpaint-kernel-probe-worker.mjs', import.meta.url);
const ORIGINAL = 60_000;
const DONOR = 1_000;

function makeJob(width, height, minX, minY, maxX, maxY) {
  const shared = new SharedArrayBuffer(width * height * 3 * Uint16Array.BYTES_PER_ELEMENT);
  const samples = new Uint16Array(shared);
  samples.fill(DONOR);
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const offset = (y * width + x) * 3;
      samples.fill(ORIGINAL, offset, offset + 3);
    }
  }
  return { job:{ shared, width, height, minX, minY, maxX, maxY }, samples };
}

function monitoredClient({ pollIntervalMs = 0 } = {}) {
  const workers = [];
  const terminations = [];
  const client = createTiledInpaintWorkerJobController({
    pollIntervalMs,
    createWorker:() => {
      const worker = new Worker(FIXTURE_URL, { type:'module' });
      const originalTerminate = worker.terminate.bind(worker);
      worker.terminate = () => {
        const termination = originalTerminate();
        terminations.push(termination);
        return termination;
      };
      workers.push(worker);
      return worker;
    },
  });
  return { client, workers, terminations };
}

async function waitForKernelWrite(samples, index, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Atomics.load(samples, index) === ORIGINAL && Date.now() < deadline) {
    await delay(2);
  }
  assert.notEqual(Atomics.load(samples, index), ORIGINAL,
    'the Worker must have written an actual synthesized pixel before cancellation');
}

test('Stage 003: terminate() interrupts a real CPU-bound kernel before its later pixels and reply', { timeout:20_000 }, async () => {
  const { client, terminations } = monitoredClient();
  const { job, samples } = makeJob(512, 512, 64, 16, 448, 496);
  const earliest = (16 * job.width + 64) * 3;
  const deepInterior = (256 * job.width + 256) * 3;
  const pending = client.run(job);
  try {
    await waitForKernelWrite(samples, earliest);
    assert.equal(Atomics.load(samples, deepInterior), ORIGINAL,
      'kernel is still computing after the first boundary pixel was synthesized');
    assert.equal(client.cancel(), true);
    assert.deepEqual(await pending, { cancelled:true }, 'no partial result may be accepted');
    await Promise.all(terminations);
    assert.equal(Atomics.load(samples, deepInterior), ORIGINAL,
      'terminated kernel must never finish the deep interior');
    assert.equal(client.cancel(), false, 'cancelled worker is no longer active');

    // A terminated kernel must not poison the controller's next job.
    const small = makeJob(64, 64, 24, 24, 40, 40);
    const result = await client.run(small.job);
    assert.deepEqual(result, { filled:16 * 16 });
    assert.equal(Atomics.load(small.samples, (24 * 64 + 24) * 3), DONOR);
    await Promise.all(terminations);
    assert.equal(client.cancel(), false);
  } finally {
    client.cancel();
    await Promise.allSettled(terminations);
    await pending.catch(() => {});
  }
});

test('Stage 003: stale exact-owner poll revokes an executing kernel without a Worker reply', { timeout:20_000 }, async () => {
  const { client, terminations } = monitoredClient({ pollIntervalMs:5 });
  const { job, samples } = makeJob(512, 512, 64, 16, 448, 496);
  const firstBoundary = (16 * job.width + 64) * 3;
  const deepInterior = (256 * job.width + 256) * 3;
  let current = true;
  const pending = client.run(job, { isCurrent:() => current });
  try {
    await waitForKernelWrite(samples, firstBoundary);
    assert.equal(Atomics.load(samples, deepInterior), ORIGINAL);
    current = false; // Simulate document/lock/source changing while Worker is CPU-bound.
    assert.deepEqual(await pending, { cancelled:true });
    await Promise.all(terminations);
    assert.equal(Atomics.load(samples, deepInterior), ORIGINAL);
    assert.equal(client.cancel(), false);
  } finally {
    current = false;
    client.cancel();
    await Promise.allSettled(terminations);
    await pending.catch(() => {});
  }
});
