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

test('Stage 003: overlapping CDP polls, markers and stop are serialized in sample order', async () => {
  const release = [];
  let activeReads = 0, maxActiveReads = 0, reads = 0, cleared = 0;
  let triggerPoll;
  const client = { async send(method) {
    if (method === 'Performance.enable') return {};
    assert.equal(method, 'Performance.getMetrics');
    const ordinal = ++reads;
    activeReads += 1;
    maxActiveReads = Math.max(maxActiveReads, activeReads);
    return new Promise(resolve => release.push(() => {
      activeReads -= 1;
      resolve({metrics:[
        {name:'JSHeapUsedSize', value:100 + ordinal * 10},
        {name:'JSHeapTotalSize', value:500},
      ]});
    }));
  }};
  const sampler = createBrowserRendererHeapSampler(client, {
    schedule(callback) { triggerPoll = callback; return 'poll-timer'; },
    unschedule(id) { assert.equal(id, 'poll-timer'); cleared += 1; },
  });
  const nextTurn = () => new Promise(resolve => setImmediate(resolve));
  const starting = sampler.start();
  await nextTurn();
  assert.equal(reads, 1);
  release.shift()();
  await starting;

  const importStage = sampler.snapshot('after-import-preview');
  triggerPoll();
  const workerStage = sampler.snapshot('after-worker-preview');
  const stopping = sampler.stop();
  for (let expectedReads = 2; expectedReads <= 5; expectedReads += 1) {
    await nextTurn();
    assert.equal(reads, expectedReads, 'next CDP query starts after previous snapshot finishes');
    assert.equal(activeReads, 1);
    release.shift()();
  }
  await Promise.all([importStage, workerStage]);
  const report = await stopping;
  assert.equal(maxActiveReads, 1);
  assert.equal(cleared, 1);
  assert.equal(report.sampleCount, 5);
  assert.equal(report.baselineJsHeapUsedBytes, 110);
  assert.equal(report.endJsHeapUsedBytes, 150);
  assert.equal(report.sampledMaxJsHeapUsedBytes, 150);
  assert.deepEqual(report.stages.map(stage => stage.phase),
    ['before-import', 'after-import-preview', 'after-worker-preview', 'finished']);
});

test('Stage 003: a rejected manual marker does not poison later samples', async () => {
  let reads = 0;
  const client = { async send(method) {
    if (method === 'Performance.enable') return {};
    assert.equal(method, 'Performance.getMetrics');
    if (++reads === 2) throw new Error('CDP marker failed');
    return {metrics:[
      {name:'JSHeapUsedSize', value:reads * 10},
      {name:'JSHeapTotalSize', value:100},
    ]};
  }};
  const sampler = createBrowserRendererHeapSampler(client, {
    schedule:() => 1, unschedule:() => {},
  });
  await sampler.start();
  await assert.rejects(sampler.snapshot('bad-marker'), /CDP marker failed/);
  await sampler.snapshot('recovered');
  const result = await sampler.stop();
  assert.equal(reads, 4);
  assert.equal(result.endJsHeapUsedBytes, 40);
  assert.deepEqual(result.stages.map(stage => stage.phase),
    ['before-import', 'recovered', 'finished']);
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

import { sampleLinuxChromiumRss } from '../tools/browser-linux-process-rss.mjs';

test('010E memory: Linux /proc RSS uses complete validated CDP PID set and never calls summed HWM a peak', async () => {
  const reads = [];
  const values = new Map([
    ['/proc/11/status', 'Name:\tchrome\nVmRSS:\t100 kB\nVmHWM:\t120 kB\n'],
    ['/proc/12/status', 'Name:\tchrome\nVmRSS:\t200 kB\nVmHWM:\t250 kB\n'],
  ]);
  const data = await sampleLinuxChromiumRss([{id:11},{id:12}], {
    platform:'linux',
    readStatus:async (path, encoding) => {
      assert.equal(encoding, 'utf8');
      reads.push(path);
      return values.get(path);
    },
  });
  assert.deepEqual(reads, ['/proc/11/status', '/proc/12/status']);
  assert.deepEqual(data, {
    supported:true, processCount:2, aggregateRssBytes:300*1024,
    largestProcessHighWaterBytes:250*1024,
  });
  const unsupported = await sampleLinuxChromiumRss([{id:11}], {
    platform:'win32', readStatus:async () => { throw new Error('should not read'); },
  });
  assert.equal(unsupported.supported, false);
  assert.match(unsupported.reason, /Linux/);
});

test('010E memory: malformed, duplicate, vanished PIDs and missing Linux status cannot become invented RSS', async () => {
  const good = 'VmRSS:\t200 kB\nVmHWM:\t250 kB\n';
  for (const [processes, status, message] of [
    [[{id:42},{id:42}], good, /duplicate/],
    [[{id:0}], good, /invalid/],
    [[{id:42}], 'VmHWM: 300 kB\n', /VmRSS/],
    [[{id:42}], 'VmRSS: 250 kB\nVmHWM: 249 kB\n', /smaller/],
    [[{id:42}], 'VmRSS: NaN kB\nVmHWM: 250 kB\n', /VmRSS/],
  ]) {
    await assert.rejects(sampleLinuxChromiumRss(processes, {
      platform:'linux', readStatus:async () => status,
    }), message);
  }
  await assert.rejects(sampleLinuxChromiumRss([{id:42}], {
    platform:'linux', readStatus:async () => { throw new Error('ENOENT: process exited'); },
  }), /ENOENT/);
});

test('010E memory: separate RSS and privateMemory snapshots, then explicit unavailable state after /proc failure', async () => {
  let n = 0, rssCalls = 0;
  const pageClient = { async send(method) {
    if (method === 'Performance.enable') return {};
    assert.equal(method,'Performance.getMetrics');
    n += 1;
    return { metrics:[
      {name:'JSHeapUsedSize',value:n*10},
      {name:'JSHeapTotalSize',value:100},
    ] };
  } };
  const processClient = { async send(method) {
    assert.equal(method, 'SystemInfo.getProcessInfo');
    return { processInfo:[{id:101,type:'browser',privateMemory:100}] };
  } };
  const samples = [500, 900, 700];
  const sampler = createBrowserRendererHeapSampler(pageClient, {
    processClient,
    processRssSampler:async () => ({
      supported:true, processCount:1, aggregateRssBytes:samples[rssCalls++],
      largestProcessHighWaterBytes:1000,
    }),
    schedule:()=>1, unschedule:()=>{},
  });
  await sampler.start();
  await sampler.snapshot('after-native-worker');
  const report = await sampler.stop();
  assert.equal(report.linuxProcessRss.availability, 'sampled');
  assert.equal(report.linuxProcessRss.sampleCount, 3);
  assert.equal(report.linuxProcessRss.baselineAggregateRssBytes, 500);
  assert.equal(report.linuxProcessRss.sampledMaxAggregateRssBytes, 900);
  assert.equal(report.linuxProcessRss.endAggregateRssBytes, 700);
  assert.equal(report.linuxProcessRss.sampledIncreaseBytes, 400);
  assert.equal(report.linuxProcessRss.maxObservedIndividualProcessHwmBytes, 1000);
  assert.deepEqual(report.stages.map(s => s.chromiumRssBytes), samples);
  assert.equal(report.chromiumProcesses.availability, 'sampled');

  let brokenReads = 0;
  const broken = createBrowserRendererHeapSampler(pageClient, {
    processClient,
    processRssSampler:async () => { brokenReads += 1; throw new Error('ENOENT Chromium child exited'); },
    schedule:()=>1, unschedule:()=>{},
  });
  await broken.start();
  await broken.snapshot('after');
  const failed = await broken.stop();
  assert.equal(brokenReads, 1);
  assert.equal(failed.linuxProcessRss.availability, 'unavailable');
  assert.match(failed.linuxProcessRss.unavailableReason, /ENOENT/);
  assert.equal(failed.linuxProcessRss.sampleCount, 0);
  assert.equal(failed.linuxProcessRss.sampledMaxAggregateRssBytes, null);
  assert.equal(failed.chromiumProcesses.availability, 'sampled');
});
