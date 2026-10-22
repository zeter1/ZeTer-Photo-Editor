import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrowserDenseImportEvidence, BROWSER_DENSE_IMPORT_LIMITATIONS } from '../tools/browser-dense-import-evidence.mjs';

const valid=()=>({
  kind:'zpe-browser-dense-psd-import-replacement-v1',format:'PSD16',protocol:'file:',
  sourcePixels:2_030_000,marqueeBoundingPixels:1_973_400,
  selectedPixels:1_973_400,selectedBytes:7_893_600,
  deniedPrompts:1,approvedPrompts:1,denialRetainedOwner:true,
  preDecodeRetainedWorker:true,originalName:'old.psd',replacementName:'new.psd',
  importedNativeDifferent:true,importedHighDepth:true,importedNativeExact:true,
  importedHistoryClean:true,stableAfterSettle:true,originalTerminations:1,
  oldReplies:0,oldRepliesAfterSettle:0,retrySelectedPixels:1_973_400,
  retrySelectedBytes:7_893_600,changedSelectedPixels:25,outsideUnchanged:true,
  alphaUnchanged:true,historyOnce:true,undoExact:true,redoExact:true,
  finalTabs:1,finalWorkerJobs:2,finalWorkerReplies:1,
  firstDispatchToTerminationMs:200,retryCompletionMs:4500,
  cancelPulseIntervalsMs:[8,12],retryPulseIntervalsMs:[7,11],
  heapBeforeBytes:24000,heapAfterBytes:null,
  workerPidMapping:'unknown',operationPeakKnown:false,
  limitations:BROWSER_DENSE_IMPORT_LIMITATIONS,
});
test('003W/2b-2g accept genuine independent PSD16 and PSB32 import replacement receipts',()=>{
  assert.equal(validateBrowserDenseImportEvidence(valid()),true);
  assert.equal(validateBrowserDenseImportEvidence({...valid(),format:'PSB32',
    originalName:'old.psb',replacementName:'new.psb'}),true);
});
test('003W/2b-2g fail closed on forgery, old replies, misleading CPU/Memory or incomplete native retry',()=>{
  const changes=[
    e=>{delete e.kind;},e=>{e.kind='File New';},e=>{e.format='canvas8';},
    e=>{e.protocol='http:';},e=>{e.sourcePixels=10;},
    e=>{e.marqueeBoundingPixels=576;},e=>{e.selectedPixels=576;},
    e=>{e.selectedBytes=4;},e=>{e.deniedPrompts=0;},
    e=>{e.approvedPrompts=0;},e=>{e.denialRetainedOwner=false;},
    e=>{e.preDecodeRetainedWorker=false;},e=>{e.originalName='same.psd';e.replacementName='same.psd';},
    e=>{e.replacementName='new.png';},e=>{e.importedNativeDifferent=false;},
    e=>{e.importedHighDepth=false;},e=>{e.importedNativeExact=false;},
    e=>{e.importedHistoryClean=false;},e=>{e.stableAfterSettle=false;},
    e=>{e.originalTerminations=0;},e=>{e.oldReplies=1;},
    e=>{e.oldRepliesAfterSettle=1;},e=>{e.retrySelectedPixels=1;},
    e=>{e.retrySelectedBytes=4;},e=>{e.changedSelectedPixels=0;},
    e=>{e.changedSelectedPixels=1_973_401;},e=>{e.outsideUnchanged=false;},
    e=>{e.alphaUnchanged=false;},e=>{e.historyOnce=false;},
    e=>{e.undoExact=false;},e=>{e.redoExact=false;},
    e=>{e.finalTabs=2;},e=>{e.finalWorkerJobs=3;},
    e=>{e.finalWorkerReplies=2;},e=>{e.firstDispatchToTerminationMs=180_001;},
    e=>{e.retryCompletionMs=205_001;},e=>{e.cancelPulseIntervalsMs=[Infinity];},
    e=>{e.retryPulseIntervalsMs=[-2];},e=>{e.heapBeforeBytes=-9;},
    e=>{e.workerPidMapping='verified';},e=>{e.operationPeakKnown=true;},
    e=>{e.limitations='Operation-exclusive peak verified';},e=>{e.extra='forged';},
  ];
  for(const mutate of changes){
    const receipt=valid();mutate(receipt);
    assert.throws(()=>validateBrowserDenseImportEvidence(receipt),/003W\/2b-2g/);
  }
});
