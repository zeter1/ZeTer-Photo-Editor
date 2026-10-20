import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRendererHeapSampler } from '../tools/browser-renderer-heap-sampler.mjs';
import { sampleLinuxChromiumRss } from '../tools/browser-linux-process-rss.mjs';

const makePage = () => ({async send(method) {
  if (method === 'Performance.enable') return {};
  assert.equal(method, 'Performance.getMetrics');
  return {metrics:[{name:'JSHeapUsedSize',value:100},
    {name:'JSHeapTotalSize',value:200}]};
}});
const stat = (pid, ticks) =>
  String(pid)+' (Chrome helper (gpu)) S '+Array(18).fill('0').join(' ')+' '+ticks+' 0\n';
const status = pid => 'VmRSS:\t'+(pid === 11 ? 100 : 200)+' kB\nVmHWM:\t'+
  (pid === 11 ? 150 : 250)+' kB\n';
const processList = () => [
  {id:11,type:'browser',privateMemory:1000},
  {id:12,type:'renderer',privateMemory:2000},
];
const procError = (code, message) => Object.assign(new Error(message), {code});
function makeSampler({processes = () => processList(), readRss}) {
  let cdpReads = 0, rssReads = 0;
  const sampler = createBrowserRendererHeapSampler(makePage(), {
    processClient:{async send(method) {
      if (method === 'Target.getTargets') return {targetInfos:[]};
      assert.equal(method, 'SystemInfo.getProcessInfo');
      return {processInfo:processes(++cdpReads)};
    }},
    processRssSampler:async ids => readRss(ids, ++rssReads),
    schedule:()=>1,unschedule:()=>{},
  });
  return {sampler, counts:() => ({cdpReads,rssReads})};
}

test('003T/2g: ENOENT discards partial /proc and recovers only from a fresh CDP census', async () => {
  const {sampler,counts} = makeSampler({
    readRss:(processes,attempt) => sampleLinuxChromiumRss(processes,{
      platform:'linux',
      readStat:async path => {
        const pid = Number(path.split('/')[2]);
        return stat(pid, pid === 12 && attempt >= 3 ? 202 : 201);
      },
      readStatus:async path => {
        const pid = Number(path.split('/')[2]);
        if (attempt === 2 && pid === 12)
          throw procError('ENOENT','ENOENT: vanished between stat/status');
        return status(pid);
      },
    }),
  });
  await sampler.start();
  await sampler.snapshot('before-first-fill'); // PID 11 succeeds, PID 12 fails: discard both
  await sampler.snapshot('after-large-worker-preview'); // new PID 12 incarnation
  const report = await sampler.stop();
  assert.deepEqual(counts(),{cdpReads:4,rssReads:4});
  assert.equal(report.linuxProcessRss.availability,'sampled');
  assert.equal(report.linuxProcessRss.unavailableReason,null);
  assert.equal(report.linuxProcessRss.sampleCount,3);
  assert.equal(report.linuxProcessRss.baselineAggregateRssBytes,300*1024);
  assert.equal(report.linuxProcessRss.endAggregateRssBytes,300*1024);
  assert.deepEqual(report.stages.map(s=>s.linuxIdentityObserved),[true,false,true,true]);
  assert.equal(report.stages[1].chromiumRssBytes,undefined);
  assert.equal(report.stages[1].linuxIncarnations,undefined);
  assert.deepEqual(report.stages[2].linuxIncarnations,[
    {pid:11,starttimeTicks:'201'},{pid:12,starttimeTicks:'202'},
  ]);
  assert.deepEqual(report.metricCoverage.linuxAggregateRss.missingMilestonePhases,
    ['before-first-fill']);
  assert.equal(report.linuxProcessIdentity.sampleCount,3);
  assert.equal(report.linuxProcessIdentity.uniqueProcessIdentities,3);
  assert.equal(report.linuxProcessIdentity.newIdentityObservations,0);
  assert.equal(report.linuxProcessIdentity.missingIdentityObservations,0);
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.observedAdjacentTransitions,1);
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.unknownAdjacentTransitions,2);
  assert.deepEqual(report.linuxProcessIdentity.snapshotCoverage.gaps.map(g=>g.missingSamples),[1]);
  assert.deepEqual(report.incarnationWindowAudit.windows.map(w=>w.availability),
    ['observed','unknown','observed','observed']);
  assert.equal(report.chromiumProcesses.sampleCount,4,
    'privateMemory from independent valid CDP reads must not be disabled by /proc');
  assert.equal(report.chromiumProcessLifecycle.workerPidMapping,'unknown');
  assert.equal(report.linuxProcessIdentity.provenExitCount,null);
  assert.equal(report.incarnationWindowAudit.trueOperationPeakKnown,false);
});

test('003T/2g: terminal ENOENT is unknown even after earlier good reads',async()=>{
  const {sampler,counts}=makeSampler({readRss:(processes,attempt)=>{
    if(attempt===2)throw procError('ENOENT','ENOENT: a child exited');
    return sampleLinuxChromiumRss(processes,{
      platform:'linux',
      readStat:async path=>stat(Number(path.split('/')[2]),201),
      readStatus:async path=>status(Number(path.split('/')[2])),
    });
  }});
  await sampler.start();
  const report=await sampler.stop();
  assert.deepEqual(counts(),{cdpReads:2,rssReads:2});
  assert.equal(report.linuxProcessRss.availability,'unavailable');
  assert.match(report.linuxProcessRss.unavailableReason,/ENOENT/);
  assert.equal(report.linuxProcessRss.sampleCount,1);
  assert.equal(report.linuxProcessRss.endAggregateRssBytes,null);
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.observedAtFinish,false);
  assert.equal(report.linuxProcessIdentity.provenExitCount,null);
});

test('003T/2g: EACCES or unsupported Linux must latch; no retry after hard failure',async()=>{
  for(const fail of [
    ()=>{throw procError('EACCES','EACCES: permission denied');},
    ()=>{throw procError('EACCES','ENOENT: spoofed text with EACCES code');},
    ()=>({supported:false,reason:'Linux /proc is unavailable on this platform'}),
  ]) {
    const {sampler,counts}=makeSampler({readRss:async()=>fail()});
    await sampler.start();
    await sampler.snapshot('before-first-fill');
    const report=await sampler.stop();
    assert.deepEqual(counts(),{cdpReads:3,rssReads:1});
    assert.equal(report.linuxProcessRss.availability,'unavailable');
    assert.equal(report.linuxProcessRss.sampleCount,0);
    assert.equal(report.linuxProcessRss.endAggregateRssBytes,null);
    assert.equal(report.linuxProcessIdentity.snapshotCoverage.observedSamples,0);
    assert.equal(report.chromiumProcessLifecycle.workerPidMapping,'unknown');
  }
});

test('003T/2g: a starttime mismatch is not ENOENT and cannot be retried',async()=>{
  let statReads=0;
  const {sampler,counts}=makeSampler({readRss:(processes,attempt)=>
    sampleLinuxChromiumRss(processes,{
      platform:'linux',
      readStat:async path=>{
        const pid=Number(path.split('/')[2]);
        if(attempt===2 && pid===11)return stat(pid,++statReads===1?201:202);
        return stat(pid,201);
      },
      readStatus:async path=>status(Number(path.split('/')[2])),
    }),
  });
  await sampler.start();
  await sampler.snapshot('before-first-fill');
  const report=await sampler.stop();
  assert.deepEqual(counts(),{cdpReads:3,rssReads:2});
  assert.match(report.linuxProcessRss.unavailableReason,/PID was reused/);
  assert.equal(report.linuxProcessRss.sampleCount,1);
  assert.equal(report.linuxProcessRss.endAggregateRssBytes,null);
  assert.equal(report.linuxProcessIdentity.snapshotCoverage.observedAdjacentTransitions,0);
});

test('003T/2g: duplicate or dropped CDP PID list cannot become a recovered partial aggregate',async()=>{
  for(const bad of [
    [{id:11,type:'browser',privateMemory:1000},{id:11,type:'renderer',privateMemory:2000}],
    [{id:11,type:'browser',privateMemory:1000},{type:'renderer',privateMemory:2000}],
    [],
  ]) {
    const {sampler,counts}=makeSampler({
      processes:n=>n===1?processList():bad,
      readRss:processes=>sampleLinuxChromiumRss(processes,{
        platform:'linux',
        readStat:async path=>stat(Number(path.split('/')[2]),201),
        readStatus:async path=>status(Number(path.split('/')[2])),
      }),
    });
    await sampler.start();
    await sampler.snapshot('before-first-fill');
    const report=await sampler.stop();
    assert.deepEqual(counts(),{cdpReads:2,rssReads:1});
    assert.equal(report.linuxProcessRss.sampleCount,1);
    assert.equal(report.linuxProcessRss.endAggregateRssBytes,null);
    assert.equal(report.linuxProcessIdentity.snapshotCoverage.observedAtFinish,false);
    assert.equal(report.linuxProcessIdentity.provenExitCount,null);
    assert.equal(report.chromiumProcessLifecycle.workerPidMapping,'unknown');
  }
});
