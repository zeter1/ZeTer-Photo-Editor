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

test('Stage 003: browser-level CDP process private memory samples retain real values and counts', async () => {
  const used = [150, 170, 160];
  const processes = [
    [{ type:'browser', privateMemory:300 }, { type:'renderer', privateMemory:200 }],
    [{ type:'browser', privateMemory:320 }, { type:'renderer', privateMemory:280 }, { type:'utility', privateMemory:40 }],
    [{ type:'browser', privateMemory:310 }, { type:'renderer', privateMemory:230 }],
  ];
  let heapCalls = 0, processCalls = 0;
  const pageClient = { async send(method) {
    if (method === 'Performance.enable') return {};
    assert.equal(method, 'Performance.getMetrics');
    return { metrics:[
      { name:'JSHeapUsedSize', value:used[heapCalls++] },
      { name:'JSHeapTotalSize', value:500 },
    ] };
  } };
  const processClient = { async send(method) {
    assert.equal(method, 'SystemInfo.getProcessInfo');
    return { processInfo:processes[processCalls++] };
  } };
  const sampler = createBrowserRendererHeapSampler(pageClient, {
    processClient, schedule:() => 1, unschedule:() => {},
  });
  await sampler.start();
  await sampler.snapshot('worker-active');
  const report = await sampler.stop();
  assert.equal(heapCalls, 3);
  assert.equal(processCalls, 3);
  assert.equal(report.chromiumProcesses.availability, 'sampled');
  assert.equal(report.chromiumProcesses.sampleCount, 3);
  assert.equal(report.chromiumProcesses.baselinePrivateBytes, 500);
  assert.equal(report.chromiumProcesses.sampledMaxPrivateBytes, 640);
  assert.equal(report.chromiumProcesses.endPrivateBytes, 540);
  assert.equal(report.chromiumProcesses.sampledIncreaseBytes, 140);
  assert.equal(report.chromiumProcesses.maxSampledProcessCount, 3);
  assert.equal(report.sampledMaxJsHeapUsedBytes, 170);
  assert.deepEqual(report.stages.map(item => item.processPrivateMemoryBytes), [500,640,540]);
});

test('Stage 003: missing/unsupported browser process counters never fake RAM or abort heap sampling', async () => {
  for (const response of [
    { processInfo:[{ type:'browser', privateMemory:100 }, { type:'renderer' }] },
    new Error('SystemInfo.getProcessInfo: Method not found'),
  ]) {
    let queries = 0, metrics = 0;
    const pageClient = { async send(method) {
      if (method === 'Performance.enable') return {};
      assert.equal(method, 'Performance.getMetrics');
      metrics += 1;
      return { metrics:[
        { name:'JSHeapUsedSize', value:120 },
        { name:'JSHeapTotalSize', value:200 },
      ] };
    } };
    const processClient = { async send(method) {
      assert.equal(method, 'SystemInfo.getProcessInfo');
      queries += 1;
      if (response instanceof Error) throw response;
      return response;
    } };
    const sampler = createBrowserRendererHeapSampler(pageClient, {
      processClient, schedule:() => 1, unschedule:() => {},
    });
    await sampler.start();
    await sampler.snapshot('after-worker');
    const report = await sampler.stop();
    assert.equal(queries, 1, 'unsupported process counters must be probed only once');
    assert.equal(metrics, 3, 'renderer JS heap monitoring remains intact');
    assert.equal(report.chromiumProcesses.availability, 'unavailable');
    assert.equal(report.chromiumProcesses.sampleCount, 0);
    assert.equal(report.chromiumProcesses.sampledMaxPrivateBytes, null);
    assert.equal(report.chromiumProcesses.sampledIncreaseBytes, null);
    assert.match(report.chromiumProcesses.unavailableReason, /privateMemory|Method not found/);
  }
});
