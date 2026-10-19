import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIndependentWorkerControlEvidence} from '../tools/browser-worker-control-smoke.mjs';
import {createBrowserWorkerTargetTracker} from '../tools/browser-worker-target-census.mjs';
import {summarizeBrowserSamplingTiming} from '../tools/browser-sampling-timing.mjs';

function fixture(){
  const worker=createBrowserWorkerTargetTracker();
  for(const [phase,live] of [
    ['before-import',false],['short-worker-missed',false],
    ['control-worker-live',true],['control-worker-gone',false],['finished',false],
  ])worker.observe(live?[{targetId:'real-target-1',type:'worker',url:'file:///private'}]:[],phase);
  const gap=createBrowserWorkerTargetTracker();
  gap.observe([],'gap-before');
  gap.noteMissingSnapshot('gap-injected');
  gap.observe([{targetId:'real-target-1',type:'worker'}],'gap-after');
  const stages=['before-import','short-worker-missed','control-worker-live',
    'control-worker-gone','finished'];
  const samples=stages.map((phase,i)=>({
    phase,readStartedMs:i*20,elapsedMs:i*20+2,readFinishedMs:i*20+4,
  }));
  return {
    kind:'zpe-independent-chromium-worker-control-v1',schemaVersion:1,
    origin:'real Chromium file:// temporary page',trueOperationPeakKnown:false,
    workerPidMapping:'unknown',
    limitations:'No Worker PID or operation peak evidence',
    control:{baselineWorkerTargetCount:0,
      ephemeralMessageAcknowledged:true,workerReadyAcknowledged:true,
      controlledLiveTargetObserved:true,controlledAbsentAfterTerminate:true,
      periodicPollingDisabled:true,gapMethod:'deliberately-skipped-cdp-target-snapshot'},
    memory:{sampleCount:5,samplingTiming:summarizeBrowserSamplingTiming(samples,0,0),
      browserWorkerTargets:{...worker.report(),availability:'sampled'},
      chromiumProcessLifecycle:{availability:'sampled',sampleCount:5,workerPidMapping:'unknown'},
      linuxProcessIdentity:{availability:'unavailable',workerPidMapping:'unknown',
        provenExitCount:null,snapshotCoverage:{observedAtStart:false}},
      linuxProcessRss:{availability:'unavailable'}},
    injectedGap:gap.report(),
  };
}

test('003T/2b-2: correctly limited control evidence validates without Worker PID inference',()=>{
  const e=fixture();
  assert.equal(validateIndependentWorkerControlEvidence(e),true);
  assert.equal(e.memory.browserWorkerTargets.newTargetObservations,1);
  assert.equal(e.injectedGap.newTargetObservations,0);
  assert.equal(e.injectedGap.snapshotCoverage.unknownAdjacentTransitions,2);
  assert.equal(e.memory.browserWorkerTargets.provenWorkerTerminationCount,null);
});

test('003T/2b-2: forged operation peak, PID join, read gaps and missing live control fail closed',()=>{
  const mutators=[
    e=>{e.trueOperationPeakKnown=true;},
    e=>{e.workerPidMapping='worker:123';},
    e=>{e.workerRssBytes=42;},
    e=>{e.operationPeakRssBytes=999;},
    e=>{e.control.baselineWorkerTargetCount=1;},
    e=>{e.control.ephemeralMessageAcknowledged=false;},
    e=>{e.control.gapMethod='actual-cdp-failure';},
    e=>{e.control.periodicPollingDisabled=false;},
    e=>{e.memory.browserWorkerTargets.milestones[2].workerTargetCount=0;},
    e=>{e.memory.browserWorkerTargets.provenWorkerTerminationCount=1;},
    e=>{e.memory.browserWorkerTargets.workerPidMapping='guessed';},
    e=>{e.memory.browserWorkerTargets.targets[0].url='file:///private';},
    e=>{e.memory.chromiumProcessLifecycle.sampleCount=0;},
    e=>{e.memory.linuxProcessIdentity.provenExitCount=1;},
    e=>{e.memory.samplingTiming.trueOperationPeakKnown=true;},
    e=>{e.injectedGap.newTargetObservations=1;},
    e=>{e.injectedGap.snapshotCoverage.unknownAdjacentTransitions=0;},
    e=>{e.injectedGap.milestones[2].newlyObservedWorkerTargets=1;},
    e=>{e.injectedGap.milestones[1].workerTargetCount=0;},
    e=>{e.origin='synthetic';},
  ];
  for(const mutate of mutators){
    const corrupted=structuredClone(fixture());
    mutate(corrupted);
    assert.throws(()=>validateIndependentWorkerControlEvidence(corrupted),
      /003T Chromium control|Browser sampling timing/);
  }
});

test('003T/2b-2: a skipped CDP target observation cannot establish a PID or target arrival',()=>{
  const tracker=createBrowserWorkerTargetTracker();
  tracker.observe([],'before');
  tracker.noteMissingSnapshot('gap');
  tracker.observe([{targetId:'long-lived',type:'worker'}],'after');
  const report=tracker.report();
  assert.equal(report.newTargetObservations,0);
  assert.equal(report.milestones[2].newlyObservedWorkerTargets,null);
  assert.equal(report.snapshotCoverage.missingSamples,1);
  assert.equal(report.workerPidMapping,'unknown');
  assert.equal(report.provenWorkerTerminationCount,null);
});
