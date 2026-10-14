import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserWorkerTargetTracker} from '../tools/browser-worker-target-census.mjs';
import {createBrowserRendererHeapSampler} from '../tools/browser-renderer-heap-sampler.mjs';

const target = (targetId, type='worker') => ({targetId, type, title:'PRIVATE', url:'file:///private/file.psd'});

test('025: observed browser Worker targets have no implied PID or termination evidence', () => {
  const tracker=createBrowserWorkerTargetTracker();
  tracker.observe([target('page','page'),target('w1')], 'before-fill');
  tracker.observe([target('page','page'),target('w1'),target('s1','shared_worker')], 'during-fill');
  tracker.observe([target('page','page'),target('s1','shared_worker')], 'after-cancel');
  tracker.observe([target('page','page'),target('w1'),target('s1','shared_worker')], 'after-retry');
  const report=tracker.report();
  assert.equal(report.sampleCount,4);
  assert.equal(report.uniqueWorkerTargetIds,2);
  assert.equal(report.maxObservedConcurrentWorkerTargets,2);
  assert.equal(report.newTargetObservations,2);
  assert.equal(report.missingTargetObservations,1);
  assert.equal(report.noLongerObservedAtLastSnapshotCount,0);
  assert.equal(report.provenWorkerTerminationCount,null);
  assert.equal(report.workerPidMapping,'unknown');
  assert.deepEqual(report.targets.map(t=>[t.targetId,t.samples,t.observedAtLastSnapshot]),
    [['s1',3,true],['w1',3,true]]);
  assert.deepEqual(report.milestones.map(x=>[x.newlyObservedWorkerTargets,x.missingPreviouslyObservedWorkerTargets]),
    [[0,0],[1,0],[0,1],[1,0]]);
  assert.equal(JSON.stringify(report).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(report).includes('file:///'),false);
});

test('025: malformed target snapshots cannot partially corrupt census', () => {
  const tracker=createBrowserWorkerTargetTracker();
  tracker.observe([target('w1')], 'first');
  for(const invalid of [
    [target('w2'),target('w2')],
    [target('w1','page')],
    [target('w1','service_worker')],
    [target('')],
    [{targetId:'w3'}],
    Array.from({length:2049},(_,i)=>target('w'+i)),
  ]) assert.throws(()=>tracker.observe(invalid,'broken'),/target/i);
  assert.equal(tracker.report().sampleCount,1);
  assert.equal(tracker.report().uniqueWorkerTargetIds,1);
  assert.equal(tracker.report().targets[0].lastSeenPhase,'first');
});

test('025: browser sampler samples target identities independently of /proc and privateMemory', async () => {
  let calls=0;
  const pageClient={async send(method){
    if(method==='Performance.enable')return {};
    assert.equal(method,'Performance.getMetrics');
    return {metrics:[{name:'JSHeapUsedSize',value:100},{name:'JSHeapTotalSize',value:200}]};
  }};
  const batches=[
    [target('page','page')],
    [target('page','page'),target('w1')],
    [target('page','page')],
  ];
  const rootClient={async send(method){
    if(method==='Target.getTargets')return {targetInfos:batches[calls++]};
    assert.equal(method,'SystemInfo.getProcessInfo');
    throw new Error('no process list');
  }};
  const sampler=createBrowserRendererHeapSampler(pageClient,{
    processClient:rootClient, schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  await sampler.snapshot('worker-active');
  const report=await sampler.stop();
  assert.equal(calls,3);
  assert.equal(report.browserWorkerTargets.availability,'sampled');
  assert.equal(report.browserWorkerTargets.uniqueWorkerTargetIds,1);
  assert.equal(report.browserWorkerTargets.noLongerObservedAtLastSnapshotCount,1);
  assert.equal(report.browserWorkerTargets.provenWorkerTerminationCount,null);
  assert.equal(report.browserWorkerTargets.workerPidMapping,'unknown');
  assert.equal(report.chromiumProcesses.availability,'unavailable');
  assert.equal(report.sampleCount,3);
});

test('025: unavailable Target domain leaves renderer and /proc sampling operational', async () => {
  let targetCalls=0, processCalls=0;
  const pageClient={async send(method){
    if(method==='Performance.enable')return {};
    return {metrics:[{name:'JSHeapUsedSize',value:20},{name:'JSHeapTotalSize',value:30}]};
  }};
  const rootClient={async send(method){
    if(method==='Target.getTargets'){targetCalls++;throw new Error('Target method unavailable');}
    assert.equal(method,'SystemInfo.getProcessInfo');
    processCalls++;
    return {processInfo:[{id:100,type:'browser',privateMemory:10}]};
  }};
  const sampler=createBrowserRendererHeapSampler(pageClient,{
    processClient:rootClient,
    processRssSampler:async()=>({supported:true,processCount:1,aggregateRssBytes:90,
      largestProcessHighWaterBytes:100}),
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  await sampler.snapshot('fill');
  const report=await sampler.stop();
  assert.equal(targetCalls,1);
  assert.equal(processCalls,3);
  assert.equal(report.browserWorkerTargets.availability,'unavailable');
  assert.match(report.browserWorkerTargets.unavailableReason,/Target method unavailable/);
  assert.equal(report.browserWorkerTargets.uniqueWorkerTargetIds,0);
  assert.equal(report.browserWorkerTargets.workerPidMapping,'unknown');
  assert.equal(report.chromiumProcesses.availability,'sampled');
  assert.equal(report.linuxProcessRss.availability,'sampled');
});
