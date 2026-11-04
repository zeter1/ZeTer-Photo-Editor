import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserRendererHeapSampler} from '../tools/browser-renderer-heap-sampler.mjs';

test('024A: sampled CDP PID arrivals/departures and type counts stay separate from RSS/HWM',async()=>{
  const groups=[
    [{id:11,type:'browser',privateMemory:100},{id:12,type:'renderer',privateMemory:200}],
    [{id:11,type:'browser',privateMemory:130},{id:13,type:'utility',privateMemory:300}],
    [{id:13,type:'utility',privateMemory:310},{id:14,type:'renderer',privateMemory:400}],
  ];
  let index=0;
  const pageClient={async send(method){
    if(method==='Performance.enable')return {};
    assert.equal(method,'Performance.getMetrics');
    return {metrics:[{name:'JSHeapUsedSize',value:300},{name:'JSHeapTotalSize',value:500}]};
  }};
  const processClient={async send(method){
    assert.equal(method,'SystemInfo.getProcessInfo');
    return {processInfo:groups[index++]};
  }};
  const sampler=createBrowserRendererHeapSampler(pageClient,{
    processClient,
    processRssSampler:async (processes)=>({supported:true,processCount:processes.length,
      aggregateRssBytes:4000,largestProcessHighWaterBytes:3500}),
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  await sampler.snapshot('after-worker');
  const result=await sampler.stop();
  const churn=result.chromiumProcessLifecycle;
  assert.equal(churn.availability,'sampled');
  assert.equal(churn.sampleCount,3);
  assert.equal(churn.firstProcessCount,2);
  assert.equal(churn.uniquePidsSeen,4);
  assert.equal(churn.maxSampledPidCount,2);
  assert.equal(churn.newPidObservations,2);
  assert.equal(churn.missingPidObservations,2);
  assert.deepEqual(churn.maximumObservedTypes,{browser:1,renderer:1,utility:1});
  assert.deepEqual(churn.milestones.map(s=>[s.phase,s.newlyObservedPids,s.missingPreviouslyObservedPids]),[
    ['before-import',0,0],['after-worker',1,1],['finished',1,1],
  ]);
  assert.equal(churn.workerPidMapping,'unknown');
  assert.match(churn.limitations,/PID reuse/);
  assert.equal(result.chromiumProcesses.availability,'sampled');
  assert.equal(result.linuxProcessRss.availability,'sampled');
  assert.equal(result.linuxProcessRss.maxObservedIndividualProcessHwmBytes,3500);
  assert.equal(index,3);
});

test('024A: missing CDP process API reports unavailable PID churn, never zero-byte memory claim',async()=>{
  const pageClient={async send(method){
    if(method==='Performance.enable')return {};
    return {metrics:[{name:'JSHeapUsedSize',value:10},{name:'JSHeapTotalSize',value:20}]};
  }};
  const sampler=createBrowserRendererHeapSampler(pageClient,{
    processClient:{async send(){throw new Error('CDP denied process list');}},
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  const result=await sampler.stop();
  assert.equal(result.chromiumProcessLifecycle.availability,'unavailable');
  assert.match(result.chromiumProcessLifecycle.unavailableReason,/CDP denied/);
  assert.equal(result.chromiumProcessLifecycle.sampleCount,0);
  assert.equal(result.chromiumProcessLifecycle.firstProcessCount,null);
  assert.equal(result.linuxProcessRss.availability,'unavailable');
  assert.equal(result.linuxProcessRss.sampledMaxAggregateRssBytes,null);
  assert.equal(result.sampleCount,2);
});
