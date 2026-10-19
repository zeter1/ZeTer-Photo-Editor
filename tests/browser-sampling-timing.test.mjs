import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRendererHeapSampler } from '../tools/browser-renderer-heap-sampler.mjs';
import { summarizeBrowserSamplingTiming, validateBrowserSamplingTiming } from '../tools/browser-sampling-timing.mjs';

test('003T: busy timer ticks and serialized CDP read windows expose unsampled gaps', async () => {
  let clock=0, tick;
  const client={async send(method) {
    if(method==='Performance.enable')return {};
    assert.equal(method,'Performance.getMetrics');
    clock+=10;
    return {metrics:[{name:'JSHeapUsedSize',value:100},{name:'JSHeapTotalSize',value:200}]};
  }};
  const sampler=createBrowserRendererHeapSampler(client,{
    now:()=>clock, schedule(fn){tick=fn;return 1;}, unschedule(){},
  });
  await sampler.start(); // read window [0,10]
  clock=40;
  tick(); tick(); // first poll admitted, second must be counted as skipped
  await new Promise(resolve=>setImmediate(resolve)); // poll [40,50]
  clock=75;
  await sampler.snapshot('after-worker'); // [75,85]
  clock=120;
  const report=await sampler.stop(); // [120,130]
  const t=report.samplingTiming;
  assert.equal(report.sampleCount,4);
  assert.equal(t.snapshotCount,4);
  assert.equal(t.periodicSamples,1);
  assert.equal(t.pollsAttempted,2);
  assert.equal(t.pollsSkippedBusy,1);
  assert.equal(t.readWindowMs,130);
  assert.equal(t.maxReadDurationMs,10);
  assert.equal(t.maxBetweenReadWindowsMs,35);
  assert.equal(t.maxBetweenReadStartsMs,45);
  assert.equal(t.trueOperationPeakKnown,false);
  assert.equal(t.workerPidMapping,'unknown');
  assert.equal(validateBrowserSamplingTiming(t,report.sampleCount),true);
});

test('003T: /proc latency is included in observation duration; busy polls cannot imply continuous coverage',async()=>{
  let clock=0;
  const sampler=createBrowserRendererHeapSampler({
    async send(method){
      if(method==='Performance.enable')return {};
      clock+=3;
      return {metrics:[{name:'JSHeapUsedSize',value:10},{name:'JSHeapTotalSize',value:20}]};
    },
  },{
    now:()=>clock, processClient:{async send(method){
      clock+=method==='Target.getTargets'?8:13;
      return method==='Target.getTargets' ? {targetInfos:[]} :
        {processInfo:[{id:3,type:'renderer',privateMemory:200}]};
    }},
    processRssSampler:async()=>{clock+=21;return {
      supported:true,processCount:1,aggregateRssBytes:300,largestProcessHighWaterBytes:400,
    };},
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  clock+=1;
  const report=await sampler.stop();
  assert.equal(report.samplingTiming.maxReadDurationMs,45);
  assert.equal(report.samplingTiming.maxBetweenReadWindowsMs,1);
  assert.equal(report.chromiumProcesses.availability,'sampled');
  assert.equal(report.linuxProcessRss.availability,'sampled');
  assert.equal(report.linuxProcessIdentity.availability,'unavailable','RSS does not prove identity');
});

test('003T: inconsistent, unbounded or fabricated timing is rejected before publication',()=>{
  const samples=[
    {phase:'before-import',readStartedMs:0,elapsedMs:2,readFinishedMs:5},
    {phase:'sample',readStartedMs:12,elapsedMs:14,readFinishedMs:16},
    {phase:'finished',readStartedMs:30,elapsedMs:31,readFinishedMs:34},
  ];
  const timing=summarizeBrowserSamplingTiming(samples,2,1);
  assert.equal(validateBrowserSamplingTiming(timing,3),true);
  for(const change of [
    {trueOperationPeakKnown:true},{workerPidMapping:'pid-7'},
    {snapshotCount:2},{pollsSkippedBusy:3},{periodicSamples:2},
    {maxBetweenReadWindowsMs:10000},{readWindowMs:NaN},
    {maxReadDurationMs:-1},{pollsAttempted:-1},
    {operationPeakRssBytes:123},{provenWorkerPid:7},
  ])assert.throws(()=>validateBrowserSamplingTiming({...timing,...change},3),/sampling timing/);
  assert.throws(()=>summarizeBrowserSamplingTiming([
    samples[0],{...samples[1],readStartedMs:4},samples[2]],2,1),/non-monotonic/);
  assert.throws(()=>summarizeBrowserSamplingTiming([
    samples[0],{...samples[1],elapsedMs:17},samples[2]],2,1),/non-monotonic/);
});
