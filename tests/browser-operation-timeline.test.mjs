import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserOperationTimeline} from '../tools/browser-operation-timeline.mjs';
function report() {return {
  sampleCount:7,sampledMaxJsHeapUsedBytes:1200,
  chromiumProcesses:{availability:'unavailable',sampledMaxPrivateBytes:null},
  linuxProcessRss:{availability:'sampled',sampledMaxAggregateRssBytes:9000,maxObservedIndividualProcessHwmBytes:7000},
  chromiumProcessLifecycle:{availability:'sampled',uniquePidsSeen:3,newPidObservations:1,
    missingPidObservations:1,workerPidMapping:'unknown'},
};}
const steps=['import-input-dispatched','import-preview-ready','native-source-verified','selection-created',
  'fill-command-invoked','preview-history-published','undo-complete','redo-complete'];
test('024A: operation duration is distinct from sampled memory and process lifetime HWM',()=>{
  let clock=100;
  const t=createBrowserOperationTimeline({operationId:'stage003-psd16',fixture:'native.psd',format:'PSD16',now:()=>clock});
  for(const step of steps){clock+=5;t.mark(step);}
  clock+=3;
  const r=t.finish({outcome:'completed',memoryReport:report()});
  assert.equal(r.observedWindowMs,43);
  assert.equal(r.durationsMs.importInputToPreview,5);
  assert.equal(r.durationsMs.fillCommandToHistoryPreview,5);
  assert.equal(r.durationsMs.undoToRedo,5);
  assert.equal(r.durationsMs.cancelledRetryObservation,null);
  assert.equal(r.durationsMs.recoveredRetryToRedo,null);
  assert.equal(r.memory.linuxRssSampledMaxBytes,9000);
  assert.equal(r.memory.requestedSamplingIntervalMs,null);
  assert.equal(r.memory.maxObservedSinglePidLifetimeHwmBytes,7000);
  assert.equal(r.memory.chromiumPrivateMemoryAvailability,'unavailable');
  assert.equal(r.memory.processChurn.workerPidMapping,'unknown');
  assert.equal(r.memory.metricCoverage,null);
  assert.match(r.memory.limitations,/No exact peak/);
  assert.deepEqual(r.milestones.map(x=>x.phase),steps);
  assert.throws(()=>t.mark('too-late'),/finished/);
  assert.throws(()=>t.finish({outcome:'completed',memoryReport:report()}),/finished/);
});
test('024A: cancelled retry requires actual owner revocation plus unchanged native samples',()=>{
  let clock=1;
  const t=createBrowserOperationTimeline({operationId:'stage003-psb32',fixture:'native.psb',format:'PSB32',now:()=>clock++});
  for(const step of steps)t.mark(step);
  assert.throws(()=>t.finish({outcome:'completed-with-cancelled-retry',memoryReport:report()}),/atomicity evidence/);
  for(const step of ['cancel-fill-command-invoked','cancel-kernel-write-observed',
    'cancel-owner-revoked','cancel-native-verified','retry-fill-command-invoked',
    'retry-preview-history-published','retry-undo-native-verified','retry-redo-native-verified'])t.mark(step);
  const r=t.finish({outcome:'completed-with-cancelled-retry',memoryReport:report()});
  assert.equal(r.durationsMs.cancelledRetryObservation,3);
  assert.equal(r.durationsMs.recoveredRetryToRedo,3);
});
test('024A: failed/incomplete runs and invalid clocks cannot masquerade as success',()=>{
  assert.throws(()=>createBrowserOperationTimeline({operationId:'illegal id',fixture:'native.psd',format:'PSD16'}),/invalid identity/);
  let clock=50;
  const t=createBrowserOperationTimeline({operationId:'failed-psd16',fixture:'native.psd',format:'PSD16',now:()=>clock});
  t.mark('import-input-dispatched');
  assert.throws(()=>t.mark('import-input-dispatched'),/repeated/);
  assert.throws(()=>t.finish({outcome:'completed',memoryReport:report()}),/missing milestones/);
  clock=49;assert.throws(()=>t.mark('import-preview-ready'),/non-monotonic/);
  clock=53;t.mark('failure-observed');
  const r=t.finish({outcome:'failed',memoryReport:{sampleCount:1}});
  assert.equal(r.outcome,'failed');
  assert.equal(r.memory.linuxRssSampledMaxBytes,null);
  assert.equal(r.durationsMs.fillCommandToHistoryPreview,null);
});

test('029: finished timeline refuses reordered successful and cancelled-retry evidence',()=>{
  let clock=0;
  const t=createBrowserOperationTimeline({operationId:'ordered-check',fixture:'native.psd',format:'PSD16',now:()=>clock++});
  for (const step of [...steps.slice(0,3),steps[4],steps[3],...steps.slice(5)]) t.mark(step);
  assert.throws(()=>t.finish({outcome:'completed',memoryReport:report()}),/out-of-order evidence/);

  const c=createBrowserOperationTimeline({operationId:'cancel-order',fixture:'native.psb',format:'PSB32',now:()=>clock++});
  for (const step of steps)c.mark(step);
  for (const step of [
    'cancel-fill-command-invoked','cancel-kernel-write-observed','cancel-owner-revoked',
    'retry-fill-command-invoked','cancel-native-verified','retry-preview-history-published',
    'retry-undo-native-verified','retry-redo-native-verified',
  ]) c.mark(step);
  assert.throws(()=>c.finish({outcome:'completed-with-cancelled-retry',memoryReport:report()}),/out-of-order evidence/);
});
