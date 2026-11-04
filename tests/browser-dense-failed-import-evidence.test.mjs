import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrowserDenseFailedImportEvidence } from '../tools/browser-dense-failed-import-evidence.mjs';
import { BROWSER_DENSE_IMPORT_LIMITATIONS } from '../tools/browser-dense-import-evidence.mjs';

const valid=()=>({
  kind:'zpe-browser-dense-psd-import-replacement-v1',format:'PSD16',protocol:'file:',
  sourcePixels:2_030_000,marqueeBoundingPixels:1_973_400,
  selectedPixels:1_973_400,selectedBytes:7_893_600,
  deniedPrompts:1,approvedPrompts:1,denialRetainedOwner:true,
  deniedPreviewUnchanged:true,deniedHistoryUnchanged:true,
  preDecodeRetainedWorker:true,originalName:'old.psd',replacementName:'new.psd',
  importedNativeDifferent:true,importedHighDepth:true,importedNativeExact:true,
  importedPreviewDifferent:true,importedHistoryClean:true,stableAfterSettle:true,originalTerminations:1,
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

const validRecovery=(format='PSD16')=>{
  const retry=valid();
  retry.format=format;
  retry.originalName=format==='PSD16'?'old.psd':'old.psb';
  retry.replacementName=format==='PSD16'?'new.psd':'new.psb';
  // The recovery scenario *explicitly* cancels the original after the
  // malformed attempt and before the valid replacement.
  retry.denialRetainedOwner=false;
  retry.preDecodeRetainedWorker=false;
  return {
    kind:'zpe-browser-dense-psd-import-failure-recovery-v1',format,protocol:'file:',
    sourcePixels:2_030_000,
    malformedFilename:format==='PSD16'?'malformed-native-psd.psd':'malformed-native-psb.psb',
    malformedBytes:12,approvedPrompts:1,decodeFailed:true,
    oldWorkerRetained:true,nativeExact:true,previewUnchanged:true,
    historyUnchanged:true,explicitCancelNoReply:true,tabsAfterFailure:1,
    validImportAndRetry:retry,
  };
};

test('003W/2b-2h accepts independent real-corrupt PSD16 and PSB32 recovery receipts',()=>{
  for(const format of ['PSD16','PSB32']){
    assert.equal(validateBrowserDenseFailedImportEvidence(validRecovery(format)),true);
  }
});

test('003W/2b-2h fails closed for forged malformed decode, premature worker cancel and broken native retry',()=>{
  const changes=[
    r=>{delete r.kind;},r=>{r.kind='synthetic';},r=>{r.protocol='http:';},
    r=>{r.format='PSD8';},r=>{r.sourcePixels=32;},
    r=>{r.malformedFilename='not-a-psd.png';},r=>{r.malformedBytes=0;},
    r=>{r.approvedPrompts=0;},r=>{r.decodeFailed=false;},
    r=>{r.oldWorkerRetained=false;},r=>{r.nativeExact=false;},
    r=>{r.previewUnchanged=false;},r=>{r.historyUnchanged=false;},
    r=>{r.explicitCancelNoReply=false;},r=>{r.tabsAfterFailure=2;},
    r=>{r.validImportAndRetry.denialRetainedOwner=true;},
    r=>{r.validImportAndRetry.preDecodeRetainedWorker=true;},
    r=>{r.validImportAndRetry.oldReplies=1;},
    r=>{r.validImportAndRetry.outsideUnchanged=false;},
    r=>{r.validImportAndRetry.undoExact=false;},
    r=>{r.validImportAndRetry.redoExact=false;},
    r=>{r.validImportAndRetry.finalWorkerJobs=3;},
    r=>{r.validImportAndRetry.format='PSB32';},
    r=>{r.extra='forged';},
  ];
  for(const change of changes){
    const receipt=validRecovery();change(receipt);
    assert.throws(()=>validateBrowserDenseFailedImportEvidence(receipt),/003W\/2b-2h/);
  }
});
