import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserDenseReplaceEvidence,
  BROWSER_DENSE_REPLACE_LIMITATIONS,
} from '../tools/browser-dense-replace-evidence.mjs';

const valid=()=>({
  kind:'zpe-browser-dense-document-replacement-v1',format:'PSD16',protocol:'file:',
  sourcePixels:2_030_000,marqueeBoundingPixels:1_973_400,
  selectedPixels:1_973_400,selectedBytes:7_893_600,
  deniedPromptCount:1,approvedPromptCount:1,deniedModalAbsent:true,
  deniedOwnerKept:true,deniedJobs:1,deniedReplies:0,deniedTerminations:0,
  newModalSubmitted:true,newWidth:37,newHeight:29,blankNativeRemoved:true,
  blankHistoryReset:true,blankStableAfterSettle:true,
  terminatedBeforeReply:true,terminationsAfterNew:1,oldRepliesAfterSettle:0,
  reimportedHighDepth:true,reimportNativeBaselineExact:true,reimportHistoryClean:true,
  retrySelectedPixels:1_973_400,retrySelectedBytes:7_893_600,
  retryChangedSelectedPixels:24,retryOutsideUnchanged:true,retryAlphaUnchanged:true,
  retryHistoryOnce:true,undoExact:true,redoExact:true,
  finalTabs:1,finalWorkerJobs:2,finalWorkerReplies:1,finalWorkerTerminations:1,
  firstDispatchToTerminationMs:150,retryCompletionMs:5_300,
  cancelPulseIntervalsMs:[8,12],retryPulseIntervalsMs:[9,11],
  heapBeforeBytes:null,heapAfterBytes:52_000,workerPidMapping:'unknown',
  operationPeakKnown:false,limitations:BROWSER_DENSE_REPLACE_LIMITATIONS,
});
test('003W/2b-2f allow separate PSD16 and PSB32 genuine document replacement receipts',()=>{
  assert.equal(validateBrowserDenseReplaceEvidence(valid()),true);
  assert.equal(validateBrowserDenseReplaceEvidence({...valid(),format:'PSB32'}),true);
});
test('003W/2b-2f reject false denial, stale Worker, missing fresh import or dishonest metrics',()=>{
  const cases=[
    e=>{delete e.blankHistoryReset;},e=>{e.kind='wrong';},
    e=>{e.protocol='http:';},e=>{e.sourcePixels=100;},
    e=>{e.marqueeBoundingPixels=576;},e=>{e.selectedPixels=576;},
    e=>{e.selectedBytes=1;},e=>{e.deniedPromptCount=0;},
    e=>{e.approvedPromptCount=0;},e=>{e.deniedModalAbsent=false;},
    e=>{e.deniedOwnerKept=false;},e=>{e.deniedJobs=0;},
    e=>{e.deniedReplies=1;},e=>{e.deniedTerminations=1;},
    e=>{e.newModalSubmitted=false;},e=>{e.newWidth=1450;},
    e=>{e.newHeight=1400;},e=>{e.blankNativeRemoved=false;},
    e=>{e.blankHistoryReset=false;},e=>{e.blankStableAfterSettle=false;},
    e=>{e.terminatedBeforeReply=false;},e=>{e.terminationsAfterNew=0;},
    e=>{e.oldRepliesAfterSettle=1;},e=>{e.reimportedHighDepth=false;},
    e=>{e.reimportNativeBaselineExact=false;},e=>{e.reimportHistoryClean=false;},
    e=>{e.retrySelectedPixels=1;},e=>{e.retrySelectedBytes=4;},
    e=>{e.retryChangedSelectedPixels=0;},e=>{e.retryOutsideUnchanged=false;},
    e=>{e.retryAlphaUnchanged=false;},e=>{e.retryHistoryOnce=false;},
    e=>{e.undoExact=false;},e=>{e.redoExact=false;},
    e=>{e.finalTabs=2;},e=>{e.finalWorkerJobs=3;},
    e=>{e.finalWorkerReplies=2;},e=>{e.finalWorkerTerminations=0;},
    e=>{e.firstDispatchToTerminationMs=180_000;},
    e=>{e.retryCompletionMs=205_001;},
    e=>{e.cancelPulseIntervalsMs=[Infinity];},
    e=>{e.retryPulseIntervalsMs=[-1];},e=>{e.heapBeforeBytes=-1;},
    e=>{e.workerPidMapping='123';},e=>{e.operationPeakKnown=true;},
    e=>{e.limitations='full RAM proven';},e=>{e.extra='forged';},
  ];
  for(const mutate of cases){
    const evidence=valid();mutate(evidence);
    assert.throws(()=>validateBrowserDenseReplaceEvidence(evidence),/003W\/2b-2f/);
  }
});
