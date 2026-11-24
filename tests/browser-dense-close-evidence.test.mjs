import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserDenseCloseEvidence,BROWSER_DENSE_CLOSE_LIMITATIONS,
} from '../tools/browser-dense-close-evidence.mjs';

const valid=()=>({
  kind:'zpe-browser-dense-owner-close-v1',format:'PSD16',protocol:'file:',
  sourcePixels:2_030_000,tabsBefore:2,refusedPromptCount:1,
  refusedTabs:2,refusedOwnerActive:true,refusedWorkerJobs:1,
  refusedWorkerReplies:0,refusedWorkerTerminations:0,
  confirmedPromptCount:1,tabsAfterClose:1,
  originalTabGone:true,remainingOwnerActive:true,
  selectedPixels:1_973_400,selectedBytes:1_973_400*4,
  jobsBeforeClose:1,repliesBeforeClose:0,terminatedOnClose:1,
  repliesAfterSettling:0,survivorNativeExact:true,survivorUiExact:true,
  settledNativeExact:true,settledUiExact:true,
  dispatchToTerminationMs:100,closePulseIntervalsMs:[8,12],
  heapBeforeBytes:null,heapAfterBytes:42_000,
  successorSelectedPixels:1_973_400,successorSelectedBytes:1_973_400*4,
  changedSelectedPixels:100,outsideSelectionUnchanged:true,alphaUnchanged:true,
  retryHistoryOnce:true,undoExact:true,redoExact:true,finalTabs:1,
  finalWorkerJobs:2,finalWorkerReplies:1,finalWorkerTerminations:1,
  retryCompletionMs:4800,retryPulseIntervalsMs:[9,13],
  workerPidMapping:'unknown',operationPeakKnown:false,
  limitations:BROWSER_DENSE_CLOSE_LIMITATIONS,
});
test('003W/2b-2e accept independent PSD16 and PSB32 actual close receipts',()=>{
  assert.equal(validateBrowserDenseCloseEvidence(valid()),true);
  assert.equal(validateBrowserDenseCloseEvidence({...valid(),format:'PSB32'}),true);
});
test('003W/2b-2e fail closed on refused close, ghost tabs, Worker and native corruption',()=>{
  const cases=[
    e=>{delete e.originalTabGone;},e=>{e.protocol='http:';},
    e=>{e.tabsBefore=1;},e=>{e.refusedPromptCount=0;},
    e=>{e.refusedTabs=1;},e=>{e.refusedOwnerActive=false;},
    e=>{e.refusedWorkerJobs=0;},e=>{e.refusedWorkerReplies=1;},
    e=>{e.refusedWorkerTerminations=1;},e=>{e.confirmedPromptCount=0;},
    e=>{e.tabsAfterClose=2;},e=>{e.originalTabGone=false;},
    e=>{e.remainingOwnerActive=false;},e=>{e.selectedPixels=576;},
    e=>{e.selectedPixels=2_000_001;},e=>{e.selectedBytes=0;},
    e=>{e.jobsBeforeClose=2;},e=>{e.repliesBeforeClose=1;},
    e=>{e.terminatedOnClose=0;},e=>{e.repliesAfterSettling=1;},
    e=>{e.survivorNativeExact=false;},e=>{e.survivorUiExact=false;},
    e=>{e.settledNativeExact=false;},e=>{e.settledUiExact=false;},
    e=>{e.successorSelectedPixels=1;},e=>{e.successorSelectedBytes=0;},
    e=>{e.changedSelectedPixels=0;},e=>{e.outsideSelectionUnchanged=false;},
    e=>{e.alphaUnchanged=false;},e=>{e.retryHistoryOnce=false;},
    e=>{e.undoExact=false;},e=>{e.redoExact=false;},e=>{e.finalTabs=2;},
    e=>{e.finalWorkerJobs=3;},e=>{e.finalWorkerReplies=2;},
    e=>{e.finalWorkerTerminations=0;},e=>{e.retryCompletionMs=250_000;},
    e=>{e.closePulseIntervalsMs=[Infinity];},
    e=>{e.retryPulseIntervalsMs=[-1];},e=>{e.heapBeforeBytes=-1;},
    e=>{e.dispatchToTerminationMs=180_000;},
    e=>{e.workerPidMapping='42';},e=>{e.operationPeakKnown=true;},
    e=>{e.limitations='proven CPU peak';},e=>{e.extras='fake';},
  ];
  for(const mutate of cases){const e=valid();mutate(e);
    assert.throws(()=>validateBrowserDenseCloseEvidence(e),/003W\/2b-2e/);
  }
});
