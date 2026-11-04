import test from 'node:test';
import assert from 'node:assert/strict';
import {CPU_PHASES,createOperationCpuEvidence,validateOperationCpuEvidence} from
  '../tools/browser-operation-cpu-evidence.mjs';
import {unknownLinuxCpuCensus} from '../tools/browser-linux-cpu-observation.mjs';
import {BROWSER_DENSE_CANCEL_LIMITATIONS} from '../tools/browser-dense-cancel-evidence.mjs';

function native(format='PSD16'){
  return {
    kind:'zpe-browser-near-cap-dense-cancel-v1',format,protocol:'file:',
    sourcePixels:2_030_000,sourceRawBytes:2_030_000*4*(format==='PSD16'?2:4),
    marqueeBoundingPixels:1_973_400,
    firstSelectedPixels:1_973_400,firstSelectedBytes:1_973_400*4,
    secondSelectedPixels:1_973_400,secondSelectedBytes:1_973_400*4,
    workerJobs:2,cancelAcknowledged:true,selectionReplacedAfterCancel:true,
    cancelBeforeReply:true,terminatedJobsBeforeRetry:1,repliesBeforeRetry:0,
    cancelNativeExact:true,cancelPreviewExact:true,cancelHistoryExact:true,
    settledNativeExact:true,settledPreviewExact:true,settledHistoryExact:true,
    retryChangedSelectedPixels:20,retryOutsideUnchanged:true,
    retryAlphaUnchanged:true,retryUndoExact:true,retryRedoExact:true,
    retryHistoryOnce:true,finalReplies:1,
    firstDispatchToCancelMs:100,cancelSettledMs:1250,retryMenuToCompletionMs:4000,
    requestedPulseMs:8,cancelPulseIntervalsMs:[8,16],retryPulseIntervalsMs:[8,18],
    cancelPulsesTruncated:false,retryPulsesTruncated:false,
    heapBeforeBytes:null,heapAfterBytes:1000,
    workerPidMapping:'unknown',operationPeakKnown:false,
    limitations:BROWSER_DENSE_CANCEL_LIMITATIONS,
  };
}
function stages(){
  return CPU_PHASES.map((phase,i)=>({
    phase,
    census:i===3?unknownLinuxCpuCensus('cdp-unavailable',{now:()=>i*10}):{
      availability:'observed',reason:null,
      readStartedMs:i*10,readFinishedMs:i*10+1,
      incarnations:[{pid:72,starttimeTicks:i>=4?'201':'200',
        userTicks:String(i*7),systemTicks:String(i*2)}],
    },
  }));
}
test('003T/3b: actual native PSD16 and PSB32 schema binds CPU windows to strict native receipts',()=>{
  for(const format of ['PSD16','PSB32']){
    const receipt=native(format),e=createOperationCpuEvidence({format,nativeReceipt:receipt,stages:stages()});
    assert.equal(validateOperationCpuEvidence(e,receipt),true);
    assert.equal(e.intervals[0].comparison.availability,'sampled-overlap-only');
    assert.equal(e.intervals[2].comparison.availability,'unknown');
    assert.equal(e.intervals[4].comparison.matchedUserTicks,'7');
    assert.equal(e.intervals[3].comparison.workerPidMapping,'unknown');
  }
});
test('003T/3b: fail closed for CPU forgery, missing phases, PID reuse, native fidelity and peak assertions',()=>{
  const receipt=native(),e=createOperationCpuEvidence({
    format:'PSD16',nativeReceipt:receipt,stages:stages()});
  for(const mutation of [
    x=>{x.intervals[0].comparison.matchedUserTicks='800';},
    x=>{x.intervals[0].comparison.operationCpuTotalKnown=true;},
    x=>{x.intervals[0].comparison.workerPidMapping='verified';},
    x=>{x.intervals[0].comparison.missingPids=1;},
    x=>{x.phases.pop();},
    x=>{x.phases[1].phase='before-first-fill';},
    x=>{x.phases[2].census.readStartedMs=2;},
    x=>{x.phases[1].census.incarnations[0].starttimeTicks='999';},
    x=>{x.phases[1].census.incarnations[0].userTicks='1';},
    x=>{x.phases[3].census.availability='observed';},
    x=>{x.nativeReceiptSha256='0'.repeat(64);},
    x=>{x.trueOperationPeakKnown=true;},
    x=>{x.workerPidMapping='verified';},
    x=>{x.operationCpuTotalKnown=true;},
    x=>{x.format='PSB32';},
    x=>{x.fakeWorkerPid=72;},
  ]){
    const bad=structuredClone(e);mutation(bad);
    assert.throws(()=>validateOperationCpuEvidence(bad,receipt));
  }
  const unsafe=native();unsafe.retryAlphaUnchanged=false;
  assert.throws(()=>validateOperationCpuEvidence(e,unsafe));
});
