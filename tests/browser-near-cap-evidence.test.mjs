import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrowserNearCapEvidence } from '../tools/browser-near-cap-evidence.mjs';

const base=()=>({
  kind:'zpe-browser-near-cap-ui-v1',format:'PSD16',
  sourcePixels:2030000,sourceRawBytes:2030000*8,protocol:'file:',
  sparseSelectedPixels:576,sparseSelectedBytes:2304,sparseWorkerJobs:1,
  sparseChangedNative:true,sparseOutsideTilesUnchanged:true,
  alphaUnchanged:true,undoExact:true,redoExact:true,
  overCapWorkerJobsBefore:1,overCapWorkerJobsAfter:1,
  overCapStatus:'Контент-заливка: выделено больше безопасного лимита 2000000 px',
  overCapNativeUnchanged:true,overCapPreviewUnchanged:true,
  overCapHistoryUnchanged:true,
  sampledPulseIntervalsMs:[8,9,15],requestedPulseMs:8,pulsesTruncated:false,
  menuToRefusalMs:1000,heapBeforeBytes:null,heapAfterBytes:1024,
  workerPidMapping:'unknown',operationPeakKnown:false,
  limitations:'Sparse Worker success and >2M refusal only; sampled renderer timer/heap, not continuous CPU, operation memory peak, Worker PID or dense near-2M completion.',
});
test('003W/2b-2a: bounded genuine browser receipt for both high depths',()=>{
  assert.equal(validateBrowserNearCapEvidence(base()),true);
  const psb={...base(),format:'PSB32',sourceRawBytes:2030000*16};
  assert.equal(validateBrowserNearCapEvidence(psb),true);
});
test('003W/2b-2a: fail closed on forged near-cap, Worker, memory or native claims',()=>{
  const bad=[
    e=>{e.sourcePixels=1025*1025;},
    e=>{e.sparseSelectedPixels=2000000;},
    e=>{e.sparseSelectedBytes=32;},
    e=>{e.sparseChangedNative=false;},
    e=>{e.sparseOutsideTilesUnchanged=false;},
    e=>{e.alphaUnchanged=false;},
    e=>{e.undoExact=false;},
    e=>{e.redoExact=false;},
    e=>{e.overCapWorkerJobsAfter=2;},
    e=>{e.overCapStatus='OK';},
    e=>{e.overCapNativeUnchanged=false;},
    e=>{e.overCapPreviewUnchanged=false;},
    e=>{e.overCapHistoryUnchanged=false;},
    e=>{e.sampledPulseIntervalsMs=[Number.NaN];},
    e=>{e.pulsesTruncated='yes';},
    e=>{e.menuToRefusalMs=-1;},
    e=>{e.workerPidMapping='verified';},
    e=>{e.operationPeakKnown=true;},
    e=>{e.operationPeakRssBytes=1;},
    e=>{e.limitations='Peak known';},
  ];
  for(const corrupt of bad) {
    const e=base();corrupt(e);
    assert.throws(()=>validateBrowserNearCapEvidence(e),/invalid real near-cap browser evidence/);
  }
});
