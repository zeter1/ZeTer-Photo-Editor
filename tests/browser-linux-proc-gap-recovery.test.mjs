import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRendererHeapSampler } from '../tools/browser-renderer-heap-sampler.mjs';
import { sampleLinuxChromiumRss } from '../tools/browser-linux-process-rss.mjs';

const procStat = (pid, ticks) =>
  pid + ' (Chrome renderer (worker)) S ' + Array(18).fill('0').join(' ') + ' ' + ticks + ' 0\n';
const procStatus = 'Name:\tchrome\nVmRSS:\t100 kB\nVmHWM:\t150 kB\n';
const missing = path => Object.assign(new Error('ENOENT: process vanished: ' + path), {
  code:'ENOENT', path,
});

function harness(processCensus, processRssSampler) {
  let processReads = 0, rssReads = 0;
  const sampler = createBrowserRendererHeapSampler({
    async send(method) {
      if (method === 'Performance.enable') return {};
      assert.equal(method, 'Performance.getMetrics');
      return {metrics:[{name:'JSHeapUsedSize',value:100},
        {name:'JSHeapTotalSize',value:200}]};
    },
  }, {
    processClient:{async send(method) {
      if (method === 'Target.getTargets') return {targetInfos:[]};
      assert.equal(method, 'SystemInfo.getProcessInfo');
      return {processInfo:await processCensus(processReads++)};
    }},
    processRssSampler:async processes => processRssSampler(processes,rssReads++),
    schedule:()=>1, unschedule:()=>{},
  });
  return {sampler, counts:()=>({processReads,rssReads})};
}

test('003T/2g: transient real /proc ENOENT breaks adjacency, then a fresh CDP census re-observes independently',async()=>{
  let currentCensus = -1, statReads = 0, statusReads = 0;
  const {sampler,counts} = harness(
    async index => {
      currentCensus = index;
      return [{id:42,type:'renderer',privateMemory:1000}];
    },
    async processes => sampleLinuxChromiumRss(processes,{
      platform:'linux',
      readStat:async path => {
        statReads++;
        return procStat(42,currentCensus >= 2 ? '101' : '100');
      },
      readStatus:async path => {
        statusReads++;
        if (currentCensus === 1) throw missing(path);
        return procStatus;
      },
    }),
  );
  await sampler.start();
  await sampler.snapshot('cancel-owner-revoked');
  await sampler.snapshot('retry-redo-native-verified');
  const report = await sampler.stop();
  assert.deepEqual(counts(),{processReads:4,rssReads:4});
  assert.equal(statReads,7,'each complete read has two stat checks; failed one has only first');
  assert.equal(statusReads,4);
  assert.equal(report.linuxProcessRss.transientProcMissingSnapshots,1);
  assert.equal(report.linuxProcessRss.sampleCount,3);
  assert.equal(report.linuxProcessRss.availability,'sampled');
  assert.equal(report.linuxProcessRss.endAggregateRssBytes,100*1024);
  assert.equal(report.chromiumProcesses.sampleCount,4,'optional RSS failures must not poison CDP');
  assert.equal(report.linuxProcessIdentity.sampleCount,3);
  assert.equal(report.linuxProcessIdentity.uniqueProcessIdentities,2,
    'a changed starttime is a new verified identity, not reuse of stale RSS');
  assert.equal(report.linuxProcessIdentity.newIdentityObservations,0,
    'do not infer arrival across an unobserved /proc interval');
  assert.equal(report.linuxProcessIdentity.missingIdentityObservations,0,
    'do not infer departure across an unobserved /proc interval');
  assert.equal(report.linuxProcessIdentity.provenExitCount,null);
  assert.equal(report.linuxProcessIdentity.workerPidMapping,'unknown');
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.observedAdjacentTransitions,1);
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.unknownAdjacentTransitions,2);
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.missingSamples,1);
  assert.deepEqual(report.linuxProcessIdentity.snapshotCoverage.gaps,[{
    missingSamples:1,firstMissingPhase:'cancel-owner-revoked',
    lastMissingPhase:'cancel-owner-revoked',
    previousObservedPhase:'before-import',nextObservedPhase:'retry-redo-native-verified',
  }]);
  assert.equal(report.stages.find(s=>s.phase==='cancel-owner-revoked').linuxRssGapReason,
    'transient-proc-enoent');
  assert.equal(report.stages.find(s=>s.phase==='cancel-owner-revoked').chromiumRssBytes,undefined,
    'a partial census must never be reported');
  assert.equal(report.linuxProcessRss.sampledMaxAggregateRssBytes,100*1024);
  assert.equal(report.chromiumProcessLifecycle.workerPidMapping,'unknown');
});

test('003T/2g: persistent permission/unsupported and untrusted ENOENT cannot trigger retries',async()=>{
  const failures=[
    Object.assign(new Error('EACCES: permission denied'),{code:'EACCES',path:'/proc/42/stat'}),
    {supported:false,reason:'Linux /proc unsupported'},
    new Error('ENOENT: string alone is not reliable'),
    missing('/proc/999/stat'),
    Object.assign(new Error('ENOENT but no path'),{code:'ENOENT'}),
    new Error('Chromium RSS: PID was reused during /proc sample for pid 42'),
  ];
  for (const failure of failures) {
    const {sampler,counts}=harness(
      async()=>[{id:42,type:'renderer',privateMemory:1000}],
      async()=>{if (failure instanceof Error || failure?.code) throw failure;return failure;},
    );
    await sampler.start();
    await sampler.snapshot('after-import');
    const report=await sampler.stop();
    assert.equal(counts().rssReads,1,'unsafe failure permanently disables RSS in this profile');
    assert.equal(report.linuxProcessRss.availability,'unavailable');
    assert.equal(report.linuxProcessRss.sampleCount,0);
    assert.equal(report.linuxProcessRss.endAggregateRssBytes,null);
    assert.equal(report.linuxProcessRss.transientProcMissingSnapshots,0);
    assert.equal(report.linuxProcessIdentity.sampleCount,0);
    assert.equal(report.chromiumProcesses.sampleCount,3);
  }
});

test('003T/2g: repeated genuine missing PID remains unknown, with one bounded attempt per fresh census',async()=>{
  const {sampler,counts}=harness(
    async()=>[{id:42,type:'renderer',privateMemory:1000}],
    async()=>{throw missing('/proc/42/status');},
  );
  await sampler.start();
  await sampler.snapshot('still-missing');
  const report=await sampler.stop();
  assert.deepEqual(counts(),{processReads:3,rssReads:3});
  assert.equal(report.linuxProcessRss.sampleCount,0);
  assert.equal(report.linuxProcessRss.availability,'unavailable');
  assert.equal(report.linuxProcessRss.transientProcMissingSnapshots,3);
  assert.equal(report.linuxProcessRss.endAggregateRssBytes,null);
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.observedSamples,0);
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.missingSamples,3);
  assert.equal(report.linuxProcessIdentity.provenExitCount,null);
});

test('003T/2g: invalid duplicate/dropped CDP census is not re-used for Linux RSS',async()=>{
  for (const bad of [
    [{id:42,type:'browser',privateMemory:100},{id:42,type:'renderer',privateMemory:200}],
    [{id:42,type:'renderer',privateMemory:100},{}],
    [],
  ]) {
    const {sampler,counts}=harness(
      async i=>i===0?[{id:42,type:'renderer',privateMemory:100}]:bad,
      async processes=>({
        supported:true,processCount:processes.length,aggregateRssBytes:100,
        largestProcessHighWaterBytes:100,
        processSamples:[{pid:42,starttimeTicks:'100',type:'renderer',
          rssBytes:100,highWaterBytes:100}],
      }),
    );
    await sampler.start();
    await sampler.snapshot('invalid-census');
    const report=await sampler.stop();
    assert.equal(counts().rssReads,1);
    assert.equal(report.linuxProcessRss.sampleCount,1);
    assert.equal(report.linuxProcessRss.endAggregateRssBytes,null);
    assert.equal(report.linuxProcessIdentity.snapshotCoverage.missingSamples,2);
    assert.equal(report.chromiumProcessLifecycle.workerPidMapping,'unknown');
  }
});

test('003T/2g: a vanished second member invalidates all earlier member bytes in that census',async()=>{
  let index = -1;
  const {sampler,counts}=harness(
    async i=>{
      index=i;
      return i < 2
        ? [{id:42,type:'browser',privateMemory:100},{id:43,type:'renderer',privateMemory:200}]
        : [{id:42,type:'browser',privateMemory:100}];
    },
    async processes=>sampleLinuxChromiumRss(processes,{
      platform:'linux',
      readStat:async path=>procStat(Number(path.split('/')[2]),'100'),
      readStatus:async path=>{
        if (index===1 && path==='/proc/43/status')throw missing(path);
        return procStatus;
      },
    }),
  );
  await sampler.start();
  await sampler.snapshot('vanished-member');
  await sampler.snapshot('new-census');
  const report=await sampler.stop();
  assert.deepEqual(counts(),{processReads:4,rssReads:4});
  assert.equal(report.linuxProcessRss.transientProcMissingSnapshots,1);
  assert.equal(report.linuxProcessRss.sampleCount,3);
  assert.equal(report.stages.find(x=>x.phase==='vanished-member').chromiumRssBytes,undefined,
    'first successfully read member MUST NOT leak into failed aggregate');
  assert.equal(report.stages.find(x=>x.phase==='vanished-member').linuxIncarnations,undefined);
  assert.equal(report.stages.find(x=>x.phase==='new-census').chromiumRssBytes,100*1024);
  assert.equal(report.linuxProcessIdentity.newIdentityObservations,0);
  assert.equal(report.linuxProcessIdentity.missingIdentityObservations,0,
    'the disappearance of PID 43 across the /proc gap is not a continuous transition');
  assert.equal(report.linuxProcessIdentity.provenExitCount,null);
});

test('003T/2g: differing starttime before/after /proc status is rejected without an aggregate',async()=>{
  let statReads=0;
  await assert.rejects(sampleLinuxChromiumRss([{id:42,type:'renderer'}],{
    platform:'linux',
    readStat:async()=>procStat(42,String(++statReads===1?100:101)),
    readStatus:async()=>procStatus,
  }),/PID was reused/);
  assert.equal(statReads,2);
});
