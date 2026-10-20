import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserSelectionFreezeEvidence,
  summarizeBrowserSelectionFreezeEvidence,
  installBrowserSelectionFreezeObserver,
} from '../tools/browser-selection-freeze-observer.mjs';

const labels=['first-fill','cancel-fill','retry-fill'];
const geometryPixels=1025*1025;
const windowAt=(label,base)=>({
  label,startedAtMs:base,handoffAtMs:base+12.5,
  selectedPixels:49,selectedBytes:196,firstSelectedIndex:4,lastSelectedIndex:995,
  heapBeforeBytes:null,heapAtHandoffBytes:33554432,
  pulseIntervalsMs:[8,11.25,9,8.5],pulsesTruncated:false,duplicateWorkerHandoffs:0,
});
const receipt=()=>({
  kind:'zpe-browser-selection-freeze-observations-v1',
  requestedPulseIntervalMs:8,observationClass:'event-loop-timer-sampled',
  limitations:'Menu-to-Worker handoff includes command overhead; timer pulses miss unsampled gaps. Renderer JS heap samples are not process RSS or an operation peak. Worker OS PID is unknown.',
  workerPidMapping:'unknown',trueOperationPeakKnown:false,
  windows:labels.map((label,i)=>windowAt(label,100+i*50)),
});
const options={format:'PSD16',withCancellation:true,geometryPixels};

test('003W: real-browser 3-command pulse receipt is bounded and summarizes only measured delays',()=>{
  const evidence=receipt();
  assert.equal(validateBrowserSelectionFreezeEvidence(evidence,options),true);
  const summary=summarizeBrowserSelectionFreezeEvidence(evidence,options);
  assert.equal(summary.length,3);
  assert.equal(summary[0].menuToWorkerHandoffMs,12.5);
  assert.equal(summary[0].maxObservedTimerDelayMs,3.25);
  assert.equal(summary[0].p95ObservedTimerDelayMs,3.25);
  assert.equal(summary[0].selectedPixels,49);
  assert.equal(summary[0].heapBeforeBytes,null);
  assert.equal(summary[0].evidenceGap,'none');
  const missingPulse=receipt();
  missingPulse.windows[0].pulseIntervalsMs=[];
  assert.equal(validateBrowserSelectionFreezeEvidence(missingPulse,options),true);
  assert.equal(summarizeBrowserSelectionFreezeEvidence(missingPulse,options)[0].evidenceGap,
    'no-pulse-observed','lack of pulses must remain unknown, not zero delay');
});

test('003W: verifier rejects forged peak / Worker PID and inconsistent selected-byte evidence',()=>{
  const badCases=[
    x=>{x.operationPeakRssBytes=42;},
    x=>{x.workerPidMapping='verified';},
    x=>{x.trueOperationPeakKnown=true;},
    x=>{x.windows[1].selectedBytes-=4;},
    x=>{x.windows[1].handoffAtMs=x.windows[1].startedAtMs-1;},
    x=>{x.windows[1].selectedPixels=2000001;},
    x=>{x.windows[1].firstSelectedIndex=geometryPixels;},
    x=>{x.windows[1].pulseIntervalsMs.push(-1);},
    x=>{x.windows[1].pulseIntervalsMs.push(Infinity);},
    x=>{x.windows[1].duplicateWorkerHandoffs=1;},
    x=>{x.windows[1].pulsesTruncated=true;},
    x=>{x.windows[2].label='first-fill';},
    x=>{x.windows.pop();},
    x=>{x.windows[2].heapAtHandoffBytes=3.5;},
  ];
  for (const corrupt of badCases) {
    const evidence=receipt();
    corrupt(evidence);
    assert.throws(()=>validateBrowserSelectionFreezeEvidence(evidence,options),
      /invalid real-browser selection freeze evidence/);
  }
});

test('003W: PSD16/PSB32 single-run and cancelled retry are different required sequences',()=>{
  const evidence=receipt();
  const first={...evidence,windows:[evidence.windows[0]]};
  assert.equal(validateBrowserSelectionFreezeEvidence(first,{
    ...options,format:'PSB32',withCancellation:false,
  }),true);
  assert.throws(()=>validateBrowserSelectionFreezeEvidence(first,options),
    /invalid real-browser/);
  assert.throws(()=>validateBrowserSelectionFreezeEvidence(evidence,{
    ...options,geometryPixels:100,
  }),/invalid real-browser/);
});

test('003W: Chromium observer injection is independent of module-scope bindings',()=>{
  const browserFunction=installBrowserSelectionFreezeObserver.toString();
  assert.match(browserFunction,/const LIMIT=256, PULSE_MS=8/);
  assert.match(browserFunction,/Worker.prototype.postMessage=function/);
  assert.match(browserFunction,/clearInterval\(timer\)/);
});
