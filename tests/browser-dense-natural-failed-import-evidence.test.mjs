import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserDenseNaturalFailedImportEvidence,
  BROWSER_DENSE_NATURAL_FAILED_IMPORT_LIMITATIONS,
} from '../tools/browser-dense-natural-failed-import-evidence.mjs';

const valid=(format='PSD16')=>({
  kind:'zpe-browser-dense-failed-import-natural-completion-v1',
  format,protocol:'file:',sourcePixels:2_030_000,
  malformedFilename:format==='PSD16'?'malformed-native-psd.psd':'malformed-native-psb.psb',
  malformedBytes:12,approvedPrompts:1,decodeFailed:true,
  originalWorkerInFlightAtFailure:true,
  failedOpenPreviewUnchanged:true,failedOpenHistoryUnchanged:true,failedOpenTabs:1,
  selectedPixels:1_973_400,selectedBytes:7_893_600,
  originalWorkerJobs:1,originalWorkerReplies:1,originalWorkerTerminations:1,
  originalSelectedOnly:true,originalAlphaUnchanged:true,originalHistoryOnce:true,
  originalUndoExact:true,originalRedoExact:true,importApprovedPrompts:1,
  importedName:format==='PSD16'?'new.psd':'new.psb',
  importedNativeDifferent:true,importedHighDepth:true,importedNativeExact:true,
  importedPreviewDifferent:true,importedHistoryClean:true,stableAfterImport:true,
  retrySelectedPixels:1_973_400,retrySelectedOnly:true,retryAlphaUnchanged:true,
  retryHistoryOnce:true,retryUndoExact:true,retryRedoExact:true,
  finalTabs:1,finalWorkerJobs:2,finalWorkerReplies:2,
  completionMs:4200,retryCompletionMs:3900,pulseIntervalsMs:[8,15],
  heapBeforeBytes:12000,heapAfterBytes:null,workerPidMapping:'unknown',
  operationPeakKnown:false,limitations:BROWSER_DENSE_NATURAL_FAILED_IMPORT_LIMITATIONS,
});
test('003W/2b-2i accepts genuine PSD16/PSB32 natural-completion receipt structure',()=>{
  for(const format of ['PSD16','PSB32'])
    assert.equal(validateBrowserDenseNaturalFailedImportEvidence(valid(format)),true);
});
test('003W/2b-2i rejects cancellation, ghost owner and corrupt success/redo claims',()=>{
  const invalid=[
    r=>{delete r.format;},r=>{r.extra=true;},
    r=>{r.kind='faked';},r=>{r.protocol='https:';},
    r=>{r.malformedFilename='valid.psd';},r=>{r.malformedBytes=16;},
    r=>{r.decodeFailed=false;},r=>{r.approvedPrompts=0;},
    r=>{r.originalWorkerInFlightAtFailure=false;},
    r=>{r.failedOpenHistoryUnchanged=false;},r=>{r.failedOpenTabs=2;},
    r=>{r.selectedPixels=2_000_001;},r=>{r.selectedBytes=5;},
    r=>{r.originalWorkerJobs=2;},r=>{r.originalWorkerReplies=0;},
    r=>{r.originalWorkerTerminations=2;},
    r=>{r.originalSelectedOnly=false;},r=>{r.originalAlphaUnchanged=false;},
    r=>{r.originalHistoryOnce=false;},r=>{r.originalUndoExact=false;},
    r=>{r.originalRedoExact=false;},r=>{r.importApprovedPrompts=0;},
    r=>{r.importedNativeDifferent=false;},r=>{r.importedHighDepth=false;},
    r=>{r.importedNativeExact=false;},r=>{r.importedHistoryClean=false;},
    r=>{r.stableAfterImport=false;},r=>{r.retrySelectedPixels=100;},
    r=>{r.retrySelectedOnly=false;},r=>{r.retryAlphaUnchanged=false;},
    r=>{r.retryHistoryOnce=false;},r=>{r.retryUndoExact=false;},
    r=>{r.retryRedoExact=false;},r=>{r.finalTabs=2;},
    r=>{r.finalWorkerJobs=1;},r=>{r.finalWorkerReplies=1;},
    r=>{r.completionMs=206_000;},r=>{r.pulseIntervalsMs=[NaN];},
    r=>{r.workerPidMapping='verified';},r=>{r.operationPeakKnown=true;},
    r=>{r.limitations='no limitations';},
  ];
  for(const edit of invalid){
    const r=valid();edit(r);
    assert.throws(()=>validateBrowserDenseNaturalFailedImportEvidence(r),/003W\/2b-2i/);
  }
});
