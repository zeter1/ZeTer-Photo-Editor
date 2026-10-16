import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRealPhotoMemoryObservation,validateRealPhotoMemoryObservationSet,
} from '../tools/browser-real-photo-memory-evidence.mjs';

function worker(format='psd16',runIndex=1){
  return {format,runIndex,startedAtUnixMs:1000+runIndex+(format==='psb32'?10:0),
    inputFileSha256:'a'.repeat(64),nativeDefectSha256:'b'.repeat(64),workerVerified:true};
}
function coverage(observed=3,missing=0){
  return {observedSamples:observed,missingSamples:missing,
    observedAtStart:observed>0,observedAtFinish:observed>0};
}
function observation(w=worker()){
  return {
    kind:'zpe-real-photo-browser-memory-observation-v1',
    status:'sampled-not-process-peak',format:w.format,runIndex:w.runIndex,
    workerStartedAtUnixMs:w.startedAtUnixMs,
    inputFileSha256:w.inputFileSha256,nativeDefectSha256:w.nativeDefectSha256,
    processPeakRssBytes:null,workerPidMapping:'unknown',
    memoryPeakVerified:false,photoshopCompatibilityVerified:false,
    report:{
      sampleCount:3,requestedSamplingIntervalMs:50,observedSamplingWindowMs:200,
      baselineJsHeapUsedBytes:100,sampledMaxJsHeapUsedBytes:160,endJsHeapUsedBytes:140,
      stages:[{phase:'before-import'},{phase:'after-import'},
        {phase:'before-fill'},{phase:'after-reopen'},{phase:'finished'}],
      metricCoverage:{chromiumPrivateMemory:coverage(),linuxAggregateRss:coverage()},
      browserWorkerTargets:{availability:'sampled'},
      chromiumProcessLifecycle:{workerPidMapping:'unknown'},
      chromiumProcesses:{availability:'sampled',unavailableReason:null,sampleCount:3,
        baselinePrivateBytes:1000,sampledMaxPrivateBytes:1600,endPrivateBytes:1200},
      linuxProcessRss:{availability:'sampled',unavailableReason:null,sampleCount:3,
        baselineAggregateRssBytes:2000,sampledMaxAggregateRssBytes:2600,endAggregateRssBytes:2100},
    },
  };
}
test('037C-3a: six exact Worker-linked independent sampled-memory receipts',()=>{
  const workers=['psd16','psb32'].flatMap(f=>[1,2,3].map(i=>worker(f,i)));
  const observations=workers.map(w=>observation(w));
  assert.equal(validateRealPhotoMemoryObservationSet(observations,workers).runs,6);
  assert.equal(validateRealPhotoMemoryObservation(observations[0],workers[0]),true);
});
test('037C-3a: genuinely unavailable OS measurements are unknown, not zero/peak',()=>{
  const w=worker(),o=observation(w),r=o.report;
  r.metricCoverage.linuxAggregateRss=coverage(0,3);
  r.metricCoverage.linuxAggregateRss.observedAtStart=false;
  r.metricCoverage.linuxAggregateRss.observedAtFinish=false;
  r.linuxProcessRss={availability:'unavailable',unavailableReason:'no /proc',
    sampleCount:0,baselineAggregateRssBytes:null,sampledMaxAggregateRssBytes:null,
    endAggregateRssBytes:null};
  assert.equal(validateRealPhotoMemoryObservation(o,w),true);
  r.linuxProcessRss.sampledMaxAggregateRssBytes=0;
  assert.throws(()=>validateRealPhotoMemoryObservation(o,w),/037C-3a observations/);
});
test('037C-3a: no forged peak, PID binding, missing coverage, invalid sample or mismatched Worker',()=>{
  const mutations=[
    o=>{o.processPeakRssBytes=0;},o=>{o.memoryPeakVerified=true;},
    o=>{o.workerPidMapping='guessed';},o=>{o.nativeDefectSha256='c'.repeat(64);},
    o=>{o.workerStartedAtUnixMs+=1;},o=>{o.report.sampleCount=1;},
    o=>{o.report.sampledMaxJsHeapUsedBytes=90;},
    o=>{o.report.observedSamplingWindowMs=-1;},
    o=>{o.report.metricCoverage.linuxAggregateRss.missingSamples=1;},
    o=>{o.report.linuxProcessRss.sampledMaxAggregateRssBytes=1900;},
    o=>{o.report.chromiumProcesses.endPrivateBytes=null;},
    o=>{o.report.chromiumProcessLifecycle.workerPidMapping='supposed';},
    o=>{o.report.browserWorkerTargets.availability='estimated';},
    o=>{o.report.processPeakRssBytes=7000;},
    o=>{o.report.stages.splice(3,1);},
  ];
  for(const change of mutations){
    const w=worker(),o=observation(w);change(o);
    assert.throws(()=>validateRealPhotoMemoryObservation(o,w),/037C-3a observations/);
  }
});
test('037C-3a: duplicates, missing runs and spliced Worker references are rejected',()=>{
  const workers=['psd16','psb32'].flatMap(f=>[1,2,3].map(i=>worker(f,i)));
  const originals=workers.map(w=>observation(w));
  assert.throws(()=>validateRealPhotoMemoryObservationSet(originals.slice(1),workers),/six/);
  const dup=structuredClone(originals);dup[5]=structuredClone(dup[4]);
  assert.throws(()=>validateRealPhotoMemoryObservationSet(dup,workers),/duplicate/);
  const tampered=structuredClone(originals);tampered[0].runIndex=3;
  assert.throws(()=>validateRealPhotoMemoryObservationSet(tampered,workers),/unlinked Worker/);
});
