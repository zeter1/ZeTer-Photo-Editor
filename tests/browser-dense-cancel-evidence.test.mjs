import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserDenseCancelEvidence,
  BROWSER_DENSE_CANCEL_LIMITATIONS,
} from '../tools/browser-dense-cancel-evidence.mjs';

const valid=()=>({
  kind:'zpe-browser-near-cap-dense-cancel-v1',
  format:'PSD16',sourcePixels:2_030_000,sourceRawBytes:2_030_000*8,
  protocol:'file:',marqueeBoundingPixels:1_973_400,
  firstSelectedPixels:1_973_400,firstSelectedBytes:1_973_400*4,
  secondSelectedPixels:1_973_400,secondSelectedBytes:1_973_400*4,
  workerJobs:2,cancelAcknowledged:true,selectionReplacedAfterCancel:true,
  cancelBeforeReply:true,
  terminatedJobsBeforeRetry:1,repliesBeforeRetry:0,
  cancelNativeExact:true,cancelPreviewExact:true,cancelHistoryExact:true,
  settledNativeExact:true,settledPreviewExact:true,settledHistoryExact:true,
  retryChangedSelectedPixels:20,retryOutsideUnchanged:true,
  retryAlphaUnchanged:true,retryUndoExact:true,retryRedoExact:true,
  retryHistoryOnce:true,finalReplies:1,
  firstDispatchToCancelMs:100,cancelSettledMs:1250,
  retryMenuToCompletionMs:4000,requestedPulseMs:8,
  cancelPulseIntervalsMs:[8,18],retryPulseIntervalsMs:[8,12],
  cancelPulsesTruncated:false,retryPulsesTruncated:false,
  heapBeforeBytes:null,heapAfterBytes:1024,
  workerPidMapping:'unknown',operationPeakKnown:false,
  limitations:BROWSER_DENSE_CANCEL_LIMITATIONS,
});

test('003W/2b-2c: PSD16 and PSB32 dense cancellation receipts',()=>{
  assert.equal(validateBrowserDenseCancelEvidence(valid()),true);
  assert.equal(validateBrowserDenseCancelEvidence({
    ...valid(),format:'PSB32',sourceRawBytes:2_030_000*16,
  }),true);
});

test('003W/2b-2c: reject missing cancellation, ghost replies, fake retry or memory claims',()=>{
  const mutations=[
    e=>{e.kind='zpe-browser-near-cap-dense-v1';},
    e=>{e.protocol='https:';},
    e=>{e.sourceRawBytes=0;},
    e=>{e.marqueeBoundingPixels=2_000_001;},
    e=>{e.firstSelectedPixels=576;},
    e=>{e.secondSelectedPixels=1_930_000;},
    e=>{e.firstSelectedBytes=0;},
    e=>{e.workerJobs=1;},
    e=>{e.workerJobs=3;},
    e=>{e.cancelAcknowledged=false;},
    e=>{e.selectionReplacedAfterCancel=false;},
    e=>{e.cancelBeforeReply=false;},
    e=>{e.terminatedJobsBeforeRetry=0;},
    e=>{e.repliesBeforeRetry=1;},
    e=>{e.cancelNativeExact=false;},
    e=>{e.cancelPreviewExact=false;},
    e=>{e.cancelHistoryExact=false;},
    e=>{e.settledNativeExact=false;},
    e=>{e.settledPreviewExact=false;},
    e=>{e.settledHistoryExact=false;},
    e=>{e.retryChangedSelectedPixels=0;},
    e=>{e.retryChangedSelectedPixels=2_000_001;},
    e=>{e.retryOutsideUnchanged=false;},
    e=>{e.retryAlphaUnchanged=false;},
    e=>{e.retryUndoExact=false;},
    e=>{e.retryRedoExact=false;},
    e=>{e.retryHistoryOnce=false;},
    e=>{e.finalReplies=2;},
    e=>{e.firstDispatchToCancelMs=180_000;},
    e=>{e.cancelSettledMs=1;},
    e=>{e.retryMenuToCompletionMs=0;},
    e=>{e.requestedPulseMs=16;},
    e=>{e.cancelPulseIntervalsMs=[Infinity];},
    e=>{e.retryPulseIntervalsMs=Array(257).fill(8);},
    e=>{e.cancelPulsesTruncated='no';},
    e=>{e.heapAfterBytes=-1;},
    e=>{e.workerPidMapping='verified';},
    e=>{e.operationPeakKnown=true;},
    e=>{e.limitations='Worker PID verified';},
    e=>{e.operationPeakRssBytes=1234;},
  ];
  for(const mutate of mutations){
    const receipt=valid();mutate(receipt);
    assert.throws(()=>validateBrowserDenseCancelEvidence(receipt),
      /invalid dense Worker cancellation evidence/);
  }
});
