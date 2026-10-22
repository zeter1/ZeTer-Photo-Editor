import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserSelectionFreezeEvidence,
  validateBrowserBroadPreDispatchCancellation,
  summarizeBrowserSelectionFreezeEvidence,
  installBrowserSelectionFreezeObserver,
  validateBrowserSelectionPhaseEvidence,
  summarizeBrowserSelectionPhaseEvidence,
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

const broadCancelled=()=>({
  kind:'zpe-browser-broad-selection-predispatch-cancel-v1',
  format:'PSD16',geometryPixels:1025*1025,
  selectionBoundingPixels:985*985,
  cancellationEvent:'Escape',workerJobsBefore:3,workerJobsAfter:3,
  sourceUnchanged:true,previewUnchanged:true,historyUnchanged:true,
});

test('003W/2a: genuine PSD16/PSB32 broad owner-cancel evidence cannot claim a dispatch or native edit',()=>{
  const valid=broadCancelled();
  assert.equal(validateBrowserBroadPreDispatchCancellation(valid,{
    format:'PSD16',geometryPixels:1025*1025,
  }),true);
  const mutations=[
    x=>{x.workerJobsAfter++;},
    x=>{x.workerJobsBefore=-1;},
    x=>{x.selectionBoundingPixels=3;},
    x=>{x.selectionBoundingPixels=x.geometryPixels;},
    x=>{x.sourceUnchanged=false;},
    x=>{x.previewUnchanged=false;},
    x=>{x.historyUnchanged=false;},
    x=>{x.cancellationEvent='test-internal';},
    x=>{x.operationPeakRssBytes=0;},
    x=>{x.format='PSB32';},
  ];
  for(const corrupt of mutations) {
    const evidence=broadCancelled();
    corrupt(evidence);
    assert.throws(()=>validateBrowserBroadPreDispatchCancellation(evidence,{
      format:'PSD16',geometryPixels:1025*1025,
    }),/invalid broad pre-Worker cancellation evidence/);
  }
  assert.throws(()=>validateBrowserBroadPreDispatchCancellation(valid,{
    format:'PSB32',geometryPixels:1025*1025,
  }),/invalid broad pre-Worker cancellation evidence/);
});

const phaseReceipt=()=>({
  kind:'zpe-browser-selection-phase-observations-v1',
  observationClass:'opt-in-monotonic-boundaries',
  limitations:receipt().limitations,workerPidMapping:'unknown',
  trueOperationPeakKnown:false,requestedPulseIntervalMs:8,
  windows:[{label:'first-fill',startedAtMs:10,handoffAtMs:31,
    selectedPixels:1973400,phaseEvents:[
      {phase:'selection-start',atMs:12,selectedPixels:null},
      {phase:'selection-end',atMs:25,selectedPixels:1973400},
      {phase:'worker-run-start',atMs:27,selectedPixels:1973400}],
    pulseIntervalsMs:[8,19,12],pulsesTruncated:false}],
});
test('003W/3: monotonic native scan is separable from command and Worker handoff',()=>{
  for(const format of ['PSD16','PSB32']) {
    const value=phaseReceipt();
    assert.equal(validateBrowserSelectionPhaseEvidence(value,{format,geometryPixels:2030000}),true);
    const row=summarizeBrowserSelectionPhaseEvidence(value,{format,geometryPixels:2030000})[0];
    assert.equal(row.scanWallMs,13);assert.equal(row.menuToScanMs,2);
    assert.equal(row.scanToWorkerRunMs,2);assert.equal(row.workerRunToPostMs,4);
    assert.equal(row.maxObservedTimerDelayMs,11);
  }
});
test('003W/3: phase receipt rejects counterfeit counts, chronology, RSS and gaps',()=>{
  for(const mutate of [
    r=>r.windows[0].selectedPixels=576,
    r=>r.windows[0].phaseEvents.pop(),
    r=>r.windows[0].phaseEvents[1].atMs=11,
    r=>r.windows[0].phaseEvents[2].atMs=32,
    r=>r.windows[0].phaseEvents[1].selectedPixels=2000001,
    r=>r.windows[0].phaseEvents[0].selectedPixels=0,
    r=>r.windows[0].phaseEvents[2].phase='fake',
    r=>r.windows[0].pulseIntervalsMs=[-1],
    r=>r.windows[0].pulseIntervalsMs=Array(257).fill(8),
    r=>r.windows[0].pulsesTruncated=true,
    r=>r.operationPeakRssBytes=1000,
    r=>r.workerPidMapping='verified',
    r=>r.trueOperationPeakKnown=true,
  ]){const value=phaseReceipt();mutate(value);
    assert.throws(()=>validateBrowserSelectionPhaseEvidence(value,{format:'PSD16',geometryPixels:2030000}),/invalid browser selection phase evidence/);
  }
});
