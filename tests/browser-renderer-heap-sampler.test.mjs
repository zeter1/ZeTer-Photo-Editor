import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRendererHeapSampler } from '../tools/browser-renderer-heap-sampler.mjs';

test('Stage 003: renderer sampler records actual CDP heap values without fragile thresholds', async () => {
  let interval, stopped = false;
  const usages = [100, 160, 260, 190, 150];
  let count = 0;
  const methods = [];
  const client = { async send(method) {
    methods.push(method);
    if (method === 'Performance.enable') return {};
    assert.equal(method, 'Performance.getMetrics');
    const used = usages[count++];
    return { metrics:[{ name:'JSHeapUsedSize', value:used }, { name:'JSHeapTotalSize', value:512 }] };
  } };
  const sampler = createBrowserRendererHeapSampler(client, {
    now:() => count * 10,
    schedule(callback, ms) { assert.equal(ms, 50); interval = callback; return 'clock'; },
    unschedule(id) { assert.equal(id, 'clock'); stopped = true; },
  });
  await sampler.start();
  await sampler.snapshot('after-import-preview');
  interval();
  await new Promise(resolve => setImmediate(resolve));
  await sampler.snapshot('after-worker-preview');
  const report = await sampler.stop();
  assert.equal(report.sampleCount, 5);
  assert.equal(report.baselineJsHeapUsedBytes, 100);
  assert.equal(report.sampledMaxJsHeapUsedBytes, 260);
  assert.equal(report.endJsHeapUsedBytes, 150);
  assert.equal(report.sampledIncreaseBytes, 160);
  assert.deepEqual(report.stages.map(item => item.phase), [
    'before-import', 'after-import-preview', 'after-worker-preview', 'finished',
  ]);
  assert.ok(report.limitations.includes('NOT Worker'));
  assert.equal(methods[0], 'Performance.enable');
  assert.equal(stopped, true);
});

test('Stage 003: missing renderer metrics fail explicitly (no invented zero/peak)', async () => {
  const client = { async send(method) {
    return method === 'Performance.enable' ? {} : {metrics:[{name:'JSHeapUsedSize',value:10}]};
  } };
  const sampler = createBrowserRendererHeapSampler(client);
  await assert.rejects(sampler.start(), /invalid JS heap metrics/);
});

test('Stage 003: poll failures fail the profile and clear the interval', async () => {
  let next, cleared = 0, request = 0;
  const client = { async send(method) {
    if (method === 'Performance.enable') return {};
    if (++request === 2) throw new Error('CDP closed');
    return {metrics:[{name:'JSHeapUsedSize',value:10},{name:'JSHeapTotalSize',value:20}]};
  } };
  const sampler = createBrowserRendererHeapSampler(client, {
    schedule(fn) {next=fn;return 'token';}, unschedule() {cleared++;},
  });
  await sampler.start();
  next();
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(sampler.stop(), /CDP closed/);
  assert.equal(cleared, 1);
});
