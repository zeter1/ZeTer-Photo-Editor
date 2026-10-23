import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrowserPhaseAlignedEvidence,
  summarizeBrowserPhaseAlignedEvidence,
} from '../tools/browser-selection-phase-alignment.mjs';
import { installBrowserSelectionFreezeObserver } from '../tools/browser-selection-freeze-observer.mjs';

const options={format:'PSD16',geometryPixels:2030000,selectionClass:'dense'};
const base=()=>({
  kind:'zpe-browser-selection-phase-aligned-v2',
  observationClass:'monotonic-phase-aligned-event-loop-timer-sampled',
  limitations:'Menu-to-Worker handoff includes command overhead; timer pulses miss unsampled gaps. Renderer JS heap samples are not process RSS or an operation peak. Worker OS PID is unknown.',
  workerPidMapping:'unknown',trueOperationPeakKnown:false,requestedPulseIntervalMs:8,
  windows:[{
    label:'first-fill',startedAtMs:10,handoffAtMs:60,selectedPixels:1973400,
    phaseEvents:[
      {phase:'selection-start',atMs:12,selectedPixels:null},
      {phase:'selection-end',atMs:41,selectedPixels:1973400},
      {phase:'worker-run-start',atMs:44,selectedPixels:1973400},
    ],
    pulseIntervalsMs:[8,32,8],pulsesTruncated:false,
    pulseSamples:[
      {atMs:20,elapsedMs:8},{atMs:52,elapsedMs:32},{atMs:60,elapsedMs:8},
    ],clockValid:true,
  }],
});

test('003W/3c: aligned timer samples distinguish scan interior and straddling gaps in both native formats',()=>{
  for(const format of ['PSD16','PSB32']){
    const result=base();
    assert.equal(validateBrowserPhaseAlignedEvidence(result,{...options,format}),true);
    const summary=summarizeBrowserPhaseAlignedEvidence(result,{...options,format})[0];
    assert.equal(summary.scanWallMs,29);
    assert.equal(summary.scanInteriorSamples,1);
    assert.equal(summary.scanIntersectingSamples,2);
    assert.equal(summary.maxInteriorTimerDelayMs,0);
    assert.equal(summary.maxOverlappingTimerDelayMs,24);
    assert.equal(summary.scanSamplingCoverage,'interior-sampled');
    assert.equal(summary.timerIsNotCpuTime,true);
  }
});

test('003W/3c: fail closed for counterfeit timestamps, wrong depths, false RSS and Worker PID',()=>{
  const changes=[
    r=>{r.windows[0].pulseSamples[1].atMs=21;},
    r=>{r.windows[0].pulseSamples[1].elapsedMs=7;},
    r=>{r.windows[0].pulseSamples[2].atMs=61;},
    r=>{r.windows[0].pulseSamples[0].atMs=9;},
    r=>{r.windows[0].pulseSamples.pop();},
    r=>{r.windows[0].pulseSamples[1].cpuTimeMs=32;},
    r=>{r.windows[0].clockValid=false;},
    r=>{r.windows[0].phaseEvents[1].atMs=11;},
    r=>{r.windows[0].selectedPixels=576;},
    r=>{r.windows[0].pulsesTruncated=true;},
    r=>{r.windows[0].pulseIntervalsMs[1]=31;},
    r=>{r.requestedPulseIntervalMs=16;},
    r=>{r.kind='zpe-browser-selection-phase-observations-v1';},
    r=>{r.workerPidMapping='verified';},
    r=>{r.operationPeakRssBytes=4294967296;},
    r=>{r.trueOperationPeakKnown=true;},
  ];
  for(const mutate of changes){
    const value=base();mutate(value);
    assert.throws(()=>validateBrowserPhaseAlignedEvidence(value,options),
      /invalid phase-aligned browser timer evidence/);
  }
  assert.throws(()=>validateBrowserPhaseAlignedEvidence(base(),{
    ...options,format:'PSD8',
  }),/invalid phase-aligned browser timer evidence/);
});

test('003W/3c: missing pulses mean unknown coverage, not zero observed delay',()=>{
  const value=base();
  value.windows[0].pulseSamples=[];
  value.windows[0].pulseIntervalsMs=[];
  const summary=summarizeBrowserPhaseAlignedEvidence(value,options)[0];
  assert.equal(summary.maxInteriorTimerDelayMs,null);
  assert.equal(summary.maxOverlappingTimerDelayMs,null);
  assert.equal(summary.scanSamplingCoverage,'no-scan-overlap-sample');
  assert.equal(summary.missingScanPulsesUnknown,true);
});

test('003W/3c: recorded truncation must mean exactly 256 valid timestamped pulses',()=>{
  const value=base(),row=value.windows[0];
  row.handoffAtMs=2300;
  row.pulsesTruncated=true;
  row.pulseIntervalsMs=Array(256).fill(8);
  row.pulseSamples=Array.from({length:256},(_,i)=>({atMs:20+i*8,elapsedMs:8}));
  assert.equal(validateBrowserPhaseAlignedEvidence(value,options),true);
  assert.equal(summarizeBrowserPhaseAlignedEvidence(value,options)[0].pulsesTruncated,true);
  row.pulseSamples.pop();
  assert.throws(()=>validateBrowserPhaseAlignedEvidence(value,options),
    /invalid phase-aligned browser timer evidence/);
});

test('003W/3c: a >2M refusal has no Worker handoff, even with straddling timer pulse',()=>{
  const value=base(),sparse=value.windows[0];
  sparse.selectedPixels=576;
  sparse.phaseEvents[1].selectedPixels=576;
  sparse.phaseEvents[2].selectedPixels=576;
  value.windows.push({
    label:'retry-fill',startedAtMs:75,handoffAtMs:null,selectedPixels:null,
    phaseEvents:[
      {phase:'selection-start',atMs:76,selectedPixels:null},
      {phase:'selection-end',atMs:390,selectedPixels:2018665},
    ],
    pulseIntervalsMs:[8,319],pulsesTruncated:false,
    pulseSamples:[{atMs:83,elapsedMs:8},{atMs:402,elapsedMs:319}],
    clockValid:true,
  });
  const opts={format:'PSB32',geometryPixels:2030000,
    selectionClass:'sparse-refusal',expectedSparsePixels:576};
  assert.equal(validateBrowserPhaseAlignedEvidence(value,opts),true);
  const summary=summarizeBrowserPhaseAlignedEvidence(value,opts)[1];
  assert.equal(summary.scanWallMs,314);
  assert.equal(summary.maxOverlappingTimerDelayMs,311);
  assert.equal(summary.scanSamplingCoverage,'boundary-overlap-only');
  for(const mutate of [
    r=>{r.windows[1].handoffAtMs=403;},
    r=>{r.windows[1].phaseEvents[1].selectedPixels=1999999;},
    r=>{r.windows[1].phaseEvents.push({phase:'worker-run-start',atMs:401,selectedPixels:2018665});},
    r=>{r.windows[1].pulseSamples[1].atMs=390;},
    r=>{r.windows[0].selectedPixels=577;},
  ]){
    const broken=structuredClone(value);mutate(broken);
    assert.throws(()=>validateBrowserPhaseAlignedEvidence(broken,opts),
      /invalid phase-aligned browser timer evidence/);
  }
});

test('003W/3c: injected Chromium observer remains self-contained and restorable',()=>{
  const source=installBrowserSelectionFreezeObserver.toString();
  assert.match(source,/phaseAlignedSnapshot\(\)/);
  assert.match(source,/pulseSamples\.push/);
  assert.match(source,/Worker\.prototype\.postMessage=originalPost/);
});
