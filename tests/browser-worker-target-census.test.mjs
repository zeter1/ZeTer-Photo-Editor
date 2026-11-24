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

test('028: missing middle Target poll breaks adjacency without inventing Worker arrival or exit', () => {
  const tracker=createBrowserWorkerTargetTracker();
  tracker.observe([target('page','page'),target('w1')], 'before-import');
  tracker.noteMissingSnapshot('cancel-revoked');
  tracker.noteMissingSnapshot('sample');
  tracker.observe([target('page','page'),target('w2')], 'after-retry');
  tracker.observe([target('page','page')], 'finished');
  const report=tracker.report();
  assert.equal(report.sampleCount,3);
  assert.equal(report.newTargetObservations,0, 'w2 after a gap is not a proven arrival');
  assert.equal(report.missingTargetObservations,1, 'only adjacent w2 disappearance is measured');
  assert.equal(report.uniqueWorkerTargetIds,2);
  assert.equal(report.observedAtLastSnapshotCount,0);
  assert.equal(report.noLongerObservedAtLastSnapshotCount,2);
  assert.deepEqual(report.targets.map(x=>[x.targetId,x.observedAtLastSnapshot]),
    [['w1',false],['w2',false]]);
  assert.deepEqual(report.snapshotCoverage,{
    observedSamples:3,missingSamples:2,observedAtStart:true,observedAtFinish:true,
    firstObservedPhase:'before-import',lastObservedPhase:'finished',
    observedAdjacentTransitions:1,unknownAdjacentTransitions:3,
    missingMilestonePhases:['cancel-revoked'],
    gaps:[{missingSamples:2,firstMissingPhase:'cancel-revoked',lastMissingPhase:'sample',
      previousObservedPhase:'before-import',nextObservedPhase:'after-retry'}],
  });
  assert.deepEqual(report.milestones.map(x=>[
    x.phase,x.workerTargetCount,x.newlyObservedWorkerTargets,x.missingPreviouslyObservedWorkerTargets,
  ]),[
    ['before-import',1,0,0],['cancel-revoked',null,null,null],
    ['after-retry',1,null,null],['finished',0,0,1],
  ]);
  assert.equal(report.provenWorkerTerminationCount,null);
  assert.equal(report.workerPidMapping,'unknown');
});

test('028: unavailable final Target poll revokes last-visibility claims, not historical sightings', () => {
  const tracker=createBrowserWorkerTargetTracker();
  tracker.noteMissingSnapshot('before-import');
  tracker.observe([target('w1')], 'worker-active');
  tracker.noteMissingSnapshot('finished');
  const report=tracker.report();
  assert.equal(report.sampleCount,1);
  assert.equal(report.observedAtLastSnapshotCount,null);
  assert.equal(report.noLongerObservedAtLastSnapshotCount,null);
  assert.equal(report.targets[0].observedAtLastSnapshot,null);
  assert.equal(report.targets[0].samples,1);
  assert.equal(report.snapshotCoverage.observedAtStart,false);
  assert.equal(report.snapshotCoverage.observedAtFinish,false);
  assert.deepEqual(report.snapshotCoverage.missingMilestonePhases,['before-import','finished']);
  assert.equal(report.milestones.at(-1).workerTargetCount,null);
  assert.throws(()=>tracker.noteMissingSnapshot('bad phase'),/invalid missing snapshot phase/);
  assert.equal(tracker.report().snapshotCoverage.missingSamples,2);
});

test('028: CDP Target failure after a valid snapshot does not fabricate successful finish', async () => {
  let targetCalls=0, processCalls=0;
  const pageClient={async send(method){
    if (method==='Performance.enable')return {};
    assert.equal(method,'Performance.getMetrics');
    return {metrics:[{name:'JSHeapUsedSize',value:10},{name:'JSHeapTotalSize',value:20}]};
  }};
  const rootClient={async send(method){
    if (method==='Target.getTargets') {
      targetCalls++;
      if (targetCalls===1) return {targetInfos:[target('page','page'),target('w1')]};
      throw new Error('CDP Target refused subsequent polling');
    }
    assert.equal(method,'SystemInfo.getProcessInfo');
    processCalls++;
    return {processInfo:[{id:123,type:'browser',privateMemory:40}]};
  }};
  const sampler=createBrowserRendererHeapSampler(pageClient,{
    processClient:rootClient,
    processRssSampler:async()=>({supported:false,reason:'not Linux'}),
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  await sampler.snapshot('cancel-revoked');
  const report=await sampler.stop();
  const census=report.browserWorkerTargets;
  assert.equal(targetCalls,2,'unsupported Target method is not retried');
  assert.equal(processCalls,3,'independent CDP process sampling continues');
  assert.equal(report.sampleCount,3);
  assert.equal(census.availability,'unavailable');
  assert.match(census.unavailableReason,/refused/);
  assert.equal(census.sampleCount,1);
  assert.equal(census.observedAtLastSnapshotCount,null);
  assert.equal(census.noLongerObservedAtLastSnapshotCount,null);
  assert.equal(census.targets[0].observedAtLastSnapshot,null);
  assert.deepEqual(report.stages.map(x=>x.workerTargetsObserved),[true,false,false]);
  assert.equal(census.snapshotCoverage.observedAtStart,true);
  assert.equal(census.snapshotCoverage.observedAtFinish,false);
  assert.deepEqual(census.snapshotCoverage.missingMilestonePhases,['cancel-revoked','finished']);
  assert.deepEqual(census.snapshotCoverage.gaps,[{
    missingSamples:2,firstMissingPhase:'cancel-revoked',lastMissingPhase:'finished',
    previousObservedPhase:'before-import',nextObservedPhase:null,
  }]);
  assert.equal(census.provenWorkerTerminationCount,null);
  assert.equal(census.workerPidMapping,'unknown');
  assert.equal(report.chromiumProcesses.sampleCount,3);
});

test('028: an incompatible generic heap milestone remains an unavailable target snapshot', async () => {
  let targetCalls=0;
  const pageClient={async send(method){
    if(method==='Performance.enable') return {};
    assert.equal(method,'Performance.getMetrics');
    return {metrics:[{name:'JSHeapUsedSize',value:10},{name:'JSHeapTotalSize',value:20}]};
  }};
  const processClient={async send(method){
    if(method==='Target.getTargets'){
      targetCalls++;
      return {targetInfos:[target('w1')]};
    }
    assert.equal(method,'SystemInfo.getProcessInfo');
    return {processInfo:[{id:7,type:'browser',privateMemory:12}]};
  }};
  const sampler=createBrowserRendererHeapSampler(pageClient,{
    processClient,
    processRssSampler:async()=>({supported:false,reason:'not Linux'}),
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  await sampler.snapshot('after recovery/reload');
  const report=await sampler.stop();
  assert.equal(targetCalls,2,'invalid target phase disables later Target queries only');
  assert.equal(report.chromiumProcesses.sampleCount,3);
  assert.equal(report.sampleCount,3);
  assert.equal(report.browserWorkerTargets.availability,'unavailable');
  assert.match(report.browserWorkerTargets.unavailableReason,/invalid target snapshot\/phase/);
  assert.equal(report.browserWorkerTargets.snapshotCoverage.missingSamples,2);
  assert.deepEqual(report.browserWorkerTargets.snapshotCoverage.missingMilestonePhases,
    ['invalid-phase','finished']);
  assert.equal(report.browserWorkerTargets.observedAtLastSnapshotCount,null);
  assert.equal(report.browserWorkerTargets.workerPidMapping,'unknown');
  assert.deepEqual(report.milestoneWindowAudit.milestones.map(item => item.phase),
    ['before-import','invalid-phase','finished']);
  assert.equal(report.milestoneWindowAudit.milestones[1].workerTargetsObserved,false);
  assert.equal(report.milestoneWindowAudit.trueOperationPeakKnown,false);
});
