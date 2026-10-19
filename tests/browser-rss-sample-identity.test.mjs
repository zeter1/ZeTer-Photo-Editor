import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { validateChromiumRssSampleMembership } from '../tools/browser-rss-sample-identity.mjs';
import { sampleLinuxChromiumRss } from '../tools/browser-linux-process-rss.mjs';
import { createBrowserRendererHeapSampler } from '../tools/browser-renderer-heap-sampler.mjs';

const cdp=[{id:101,type:'renderer'},{id:202,type:'utility'}];
const rows=[
  {pid:101,starttimeTicks:'300',type:'renderer',rssBytes:120,highWaterBytes:180},
  {pid:202,starttimeTicks:'900',type:'utility',rssBytes:230,highWaterBytes:290},
];
const rss={supported:true,processCount:2,aggregateRssBytes:350,
  largestProcessHighWaterBytes:290,processSamples:rows};

test('003T/2b: complete real-shaped /proc membership is required for CDP aggregate',()=>{
  assert.equal(validateChromiumRssSampleMembership(cdp,rss),true);
  for (const changed of [
    {...rss,processSamples:[rows[0]]},
    {...rss,processSamples:[rows[0],rows[0]]},
    {...rss,processSamples:[rows[0],{...rows[1],pid:303}]},
    {...rss,processSamples:[rows[0],{...rows[1],starttimeTicks:'0'}]},
    {...rss,processSamples:[rows[0],{...rows[1],starttimeTicks:'9.1'}]},
    {...rss,processSamples:[rows[0],{...rows[1],rssBytes:240}]},
    {...rss,processSamples:[rows[0],{...rows[1],highWaterBytes:300}]},
    {...rss,processCount:1},
    {...rss,aggregateRssBytes:351},
    {...rss,largestProcessHighWaterBytes:300},
  ])assert.throws(()=>validateChromiumRssSampleMembership(cdp,changed),/Chromium RSS identity:/);
  assert.throws(()=>validateChromiumRssSampleMembership(
    [{id:101},{id:101}],rss),/duplicate CDP/);
});

test('003T/2b: corrupted /proc membership cannot appear as a sampled RSS peak',async()=>{
  let calls=0;
  const page={async send(method){
    if(method==='Performance.enable')return {};
    return {metrics:[{name:'JSHeapUsedSize',value:42},
      {name:'JSHeapTotalSize',value:100}]};
  }};
  const sampler=createBrowserRendererHeapSampler(page,{
    processClient:{async send(method){
      if(method==='Target.getTargets')return {targetInfos:[]};
      assert.equal(method,'SystemInfo.getProcessInfo');calls++;
      return {processInfo:cdp.map(p=>({...p,privateMemory:1000}))};
    }},
    processRssSampler:async()=>({...rss,processSamples:[rows[0],
      {...rows[1],pid:101}]}),
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  const report=await sampler.stop();
  assert.equal(calls,2);
  assert.equal(report.sampleCount,2);
  assert.equal(report.chromiumProcesses.availability,'sampled');
  assert.equal(report.chromiumProcesses.sampledMaxPrivateBytes,2000);
  assert.equal(report.linuxProcessRss.availability,'unavailable');
  assert.equal(report.linuxProcessRss.sampleCount,0);
  assert.equal(report.linuxProcessRss.sampledMaxAggregateRssBytes,null);
  assert.equal(report.linuxProcessRss.endAggregateRssBytes,null);
  assert.equal(report.linuxProcessIdentity.sampleCount,0);
  assert.match(report.linuxProcessRss.unavailableReason,/Chromium RSS identity/);
  assert.equal(report.chromiumProcessLifecycle.workerPidMapping,'unknown');
  assert.equal(report.samplingTiming.trueOperationPeakKnown,false);
});

test('003T/2b: independent short-lived Linux control PID disappears from /proc without a peak claim',
  {skip:process.platform!=='linux'},async()=>{
    const child=spawn(process.execPath,['-e',
      'process.stdout.write("ready\\n");setInterval(()=>{},1000)'],
    {stdio:['ignore','pipe','pipe']});
    try {
      await once(child.stdout,'data');
      assert.ok(Number.isSafeInteger(child.pid)&&child.pid>0);
      const observed=await sampleLinuxChromiumRss([{id:child.pid,type:'control'}]);
      assert.equal(observed.supported,true);
      assert.equal(observed.processCount,1);
      assert.ok(observed.aggregateRssBytes>0);
      assert.equal(validateChromiumRssSampleMembership([{id:child.pid}],observed),true);
      // This is a process-lifetime control (not Chromium, not a Worker).
      // Its VmHWM cannot be attributed to a browser operation.
    } finally {
      if(child.exitCode===null) {
        child.kill('SIGTERM');
        await once(child,'exit');
      }
    }
    await assert.rejects(sampleLinuxChromiumRss([{id:child.pid}],{
      platform:'linux',
    }),/ENOENT|no such file|ESRCH/);
  });
