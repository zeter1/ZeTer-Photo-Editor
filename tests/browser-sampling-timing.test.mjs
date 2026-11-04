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
  assert.deepEqual(report.milestoneWindowAudit.milestones.map(item=>item.phase),
    ['before-import','after-worker','finished']);
  assert.equal(report.milestoneWindowAudit.missingPidMilestones,3);
  assert.equal(report.milestoneWindowAudit.unverifiedBetweenMilestoneIntervals,2);
  assert.equal(report.milestoneWindowAudit.milestones[1].readStartOffsetMs,75);
  assert.equal(report.milestoneWindowAudit.milestones[2].readEndOffsetMs,130);
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


test('003T/2a: long explicit milestone and queued marker skip timer polls instead of creating delayed periodic reads',async()=>{
  let clock=0, tick, release;
  let signalRead;
  const reading=new Promise(resolve=>{signalRead=resolve;});
  let block=false;
  const client={async send(method) {
    if (method==='Performance.enable') return {};
    assert.equal(method,'Performance.getMetrics');
    if (block) {
      signalRead();
      await new Promise(resolve=>{release=resolve;});
    }
    clock+=5;
    return {metrics:[{name:'JSHeapUsedSize',value:100},{name:'JSHeapTotalSize',value:200}]};
  }};
  const sampler=createBrowserRendererHeapSampler(client,{
    now:()=>clock,
    schedule(fn){tick=fn;return 1;},
    unschedule(){},
  });
  await sampler.start(); // baseline [0,5]
  const slow=sampler.snapshot('during-fill');
  const queued=sampler.snapshot('after-fill');
  block=true;
  // Explicit reads were claimed above, even if their CDP work has not
  // entered yet; both timer ticks must be counted as skipped.
  tick();tick();
  await reading;
  tick(); // still in-flight, after a queued stage marker
  block=false;release();
  await Promise.all([slow,queued]);
  const report=await sampler.stop();
  assert.equal(report.sampleCount,4); // baseline, two markers, final
  assert.equal(report.samplingTiming.periodicSamples,0);
  assert.equal(report.samplingTiming.pollsAttempted,3);
  assert.equal(report.samplingTiming.pollsSkippedBusy,3);
  assert.equal(report.samplingTiming.trueOperationPeakKnown,false);
  assert.equal(validateBrowserSamplingTiming(report.samplingTiming,4),true);
});

test('003T/2a: rejected milestone releases the busy guard for later periodic polls',async()=>{
  let clock=0, tick, requests=0;
  const sampler=createBrowserRendererHeapSampler({
    async send(method) {
      if(method==='Performance.enable')return {};
      assert.equal(method,'Performance.getMetrics');
      requests++;
      if (requests===2) throw new Error('transient marker failure');
      clock+=2;
      return {metrics:[{name:'JSHeapUsedSize',value:10},{name:'JSHeapTotalSize',value:20}]};
    },
  },{now:()=>clock,schedule(fn){tick=fn;return 1;},unschedule(){}});
  await sampler.start();
  await assert.rejects(sampler.snapshot('failed-marker'),/transient marker failure/);
  tick(); // must be admitted after failed explicit marker
  await new Promise(resolve=>setImmediate(resolve));
  const report=await sampler.stop();
  assert.equal(report.sampleCount,3);
  assert.equal(report.samplingTiming.periodicSamples,1);
  assert.equal(report.samplingTiming.pollsSkippedBusy,0);
  assert.equal(validateBrowserSamplingTiming(report.samplingTiming,3),true);
});
