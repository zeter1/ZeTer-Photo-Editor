import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserDenseOwnerEvidence,BROWSER_DENSE_OWNER_LIMITATIONS,
} from '../tools/browser-dense-owner-evidence.mjs';
const valid=()=>({
  kind:'zpe-browser-dense-owner-switch-v1',format:'PSD16',protocol:'file:',
  tabs:2,sourcePixels:2_030_000,selectedPixels:1_973_400,
  selectedBytes:1_973_400*4,workerJobs:1,repliesBeforeSwitch:0,
  terminatedOnSwitch:1,repliesAfterSettling:0,
  originalNativeExact:true,originalUiExact:true,
  survivorNativeExact:true,survivorUiExact:true,
  dispatchToTerminationMs:150,pulseIntervalsMs:[8,11,14],
  heapBeforeBytes:null,heapAfterBytes:20_000,
  successorSelectedPixels:1_973_400,successorSelectedBytes:1_973_400*4,
  changedSelectedPixels:20,outsideSelectionUnchanged:true,alphaUnchanged:true,
  retryHistoryOnce:true,undoExact:true,redoExact:true,originalFinalExact:true,
  retryCompletionMs:4000,retryPulseIntervalsMs:[8,17],
  finalWorkerJobs:2,finalWorkerReplies:1,finalWorkerTerminations:1,
  limitations:BROWSER_DENSE_OWNER_LIMITATIONS,
});
test('003W/2b-2d accept strict independent real-depth receipt shapes',()=>{
  assert.equal(validateBrowserDenseOwnerEvidence(valid()),true);
  assert.equal(validateBrowserDenseOwnerEvidence({...valid(),format:'PSB32'}),true);
});
test('003W/2b-2d refuse fake switched owners, missing tabs and stale results',()=>{
  const cases=[
    e=>{delete e.originalNativeExact;},
    e=>{e.protocol='https:';},e=>{e.tabs=1;},
    e=>{e.sourcePixels=16;},e=>{e.selectedPixels=576;},
    e=>{e.selectedPixels=2_000_001;},e=>{e.selectedBytes--;},
    e=>{e.repliesBeforeSwitch=1;},e=>{e.terminatedOnSwitch=0;},
    e=>{e.repliesAfterSettling=1;},e=>{e.originalNativeExact=false;},
    e=>{e.originalUiExact=false;},e=>{e.survivorNativeExact=false;},
    e=>{e.survivorUiExact=false;},e=>{e.originalFinalExact=false;},
    e=>{e.successorSelectedPixels=1;},e=>{e.successorSelectedBytes=0;},
    e=>{e.changedSelectedPixels=0;},e=>{e.outsideSelectionUnchanged=false;},
    e=>{e.alphaUnchanged=false;},e=>{e.retryHistoryOnce=false;},
    e=>{e.undoExact=false;},e=>{e.redoExact=false;},
    e=>{e.finalWorkerJobs=3;},e=>{e.finalWorkerReplies=2;},
    e=>{e.finalWorkerTerminations=0;},e=>{e.retryCompletionMs=250_000;},
    e=>{e.pulseIntervalsMs=[NaN];},e=>{e.retryPulseIntervalsMs=[-1];},
    e=>{e.heapAfterBytes=-1;},e=>{e.dispatchToTerminationMs=180_000;},
    e=>{e.limitations='operation peak measured';},e=>{e.extras='forged';},
  ];
  for(const mutate of cases){
    const evidence=valid();mutate(evidence);
    assert.throws(()=>validateBrowserDenseOwnerEvidence(evidence),/003W\/2b-2d/);
  }
});
