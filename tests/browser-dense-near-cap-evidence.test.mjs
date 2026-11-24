import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserDenseNearCapEvidence,
  BROWSER_DENSE_NEAR_CAP_LIMITATIONS,
} from '../tools/browser-dense-near-cap-evidence.mjs';

const valid=()=>({
  kind:'zpe-browser-near-cap-dense-v1',format:'PSD16',
  sourcePixels:2_030_000,sourceRawBytes:2_030_000*8,protocol:'file:',
  marqueeBoundingPixels:1_973_400,selectedPixels:1_973_400,
  selectedBytes:1_973_400*4,workerJobs:1,changedSelectedPixels:25,
  outsideSelectionUnchanged:true,alphaUnchanged:true,
  undoExact:true,redoExact:true,
  sampledPulseIntervalsMs:[8,9,24],requestedPulseMs:8,pulsesTruncated:false,
  menuToCompletionMs:5700,heapBeforeBytes:null,heapAfterBytes:4096,
  workerPidMapping:'unknown',operationPeakKnown:false,
  limitations:BROWSER_DENSE_NEAR_CAP_LIMITATIONS,
});

test('003W/2b-2b: genuine dense Worker receipts require 1.9M-2M selected indices',()=>{
  assert.equal(validateBrowserDenseNearCapEvidence(valid()),true);
  assert.equal(validateBrowserDenseNearCapEvidence({
    ...valid(),format:'PSB32',sourceRawBytes:2_030_000*16,
  }),true);
});

test('003W/2b-2b: dense receipt rejects missing or inflated native/Worker/CPU evidence',()=>{
  const mutations=[
    e=>{e.kind='zpe-browser-near-cap-ui-v1';},
    e=>{e.sourcePixels=1025*1025;},
    e=>{e.protocol='http:';},
    e=>{e.marqueeBoundingPixels=2_010_000;},
    e=>{e.selectedPixels=576;},
    e=>{e.selectedPixels=2_000_001;},
    e=>{e.selectedBytes=4;},
    e=>{e.workerJobs=0;},
    e=>{e.workerJobs=2;},
    e=>{e.changedSelectedPixels=0;},
    e=>{e.changedSelectedPixels=2_000_001;},
    e=>{e.outsideSelectionUnchanged=false;},
    e=>{e.alphaUnchanged=false;},
    e=>{e.undoExact=false;},
    e=>{e.redoExact=false;},
    e=>{e.sampledPulseIntervalsMs=[Number.NaN];},
    e=>{e.sampledPulseIntervalsMs=Array(257).fill(8);},
    e=>{e.pulsesTruncated='false';},
    e=>{e.menuToCompletionMs=-1;},
    e=>{e.heapBeforeBytes=-1;},
    e=>{e.workerPidMapping='verified';},
    e=>{e.operationPeakKnown=true;},
    e=>{e.limitations='Verified full operation memory peak';},
    e=>{e.operationPeakRssBytes=1000;},
  ];
  for(const corrupt of mutations) {
    const value=valid();corrupt(value);
    assert.throws(()=>validateBrowserDenseNearCapEvidence(value),
      /invalid dense Chromium Worker evidence/);
  }
});
