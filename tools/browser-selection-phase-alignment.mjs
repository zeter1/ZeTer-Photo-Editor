import {
  validateBrowserSelectionPhaseEvidence,
  validateBrowserSelectionRefusalPhaseEvidence,
} from './browser-selection-freeze-observer.mjs';

// 003W/3c: v2 supplements immutable v1 phase receipts; it never upgrades
// timer drift into a CPU measurement or an operation-specific RSS peak.
const LIMIT = 256;
const PULSE_MS = 8;
const INVALID = '003W/3c: invalid phase-aligned browser timer evidence';
const headerKeys = ['kind','observationClass','limitations','workerPidMapping',
  'trueOperationPeakKnown','requestedPulseIntervalMs','windows'];
const rowKeys = ['label','startedAtMs','handoffAtMs','selectedPixels',
  'phaseEvents','pulseIntervalsMs','pulsesTruncated','pulseSamples','clockValid'];

function fail() { throw new TypeError(INVALID); }

export function validateBrowserPhaseAlignedEvidence(receipt,options={}) {
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
    Object.keys(receipt).length!==headerKeys.length||
    Object.keys(receipt).some(key=>!headerKeys.includes(key))||
    receipt.kind!=='zpe-browser-selection-phase-aligned-v2'||
    receipt.observationClass!=='monotonic-phase-aligned-event-loop-timer-sampled'||
    !Array.isArray(receipt.windows))fail();
  const legacy={
    ...receipt,kind:'zpe-browser-selection-phase-observations-v1',
    observationClass:'opt-in-monotonic-boundaries',
    windows:receipt.windows.map(row=>{
      if(!row||typeof row!=='object'||Array.isArray(row)||
        Object.keys(row).length!==rowKeys.length||
        Object.keys(row).some(key=>!rowKeys.includes(key)))fail();
      const {pulseSamples,clockValid,...rest}=row;
      // v1 rejects truncation by policy; v2 records it explicitly with 256
      // exact samples and conservatively declines to infer complete coverage.
      return {...rest,pulsesTruncated:false};
    }),
  };
  try {
    if(options.selectionClass==='sparse-refusal')
      validateBrowserSelectionRefusalPhaseEvidence(legacy,options);
    else validateBrowserSelectionPhaseEvidence(legacy,options);
  } catch { fail(); }
  for(const row of receipt.windows){
    if(row.clockValid!==true||typeof row.pulsesTruncated!=='boolean'||
      !Array.isArray(row.pulseSamples)||
      row.pulseSamples.length!==row.pulseIntervalsMs.length||
      row.pulseSamples.length>LIMIT||
      (row.pulsesTruncated && row.pulseSamples.length!==LIMIT))fail();
    let previousAt=null;
    for(let i=0;i<row.pulseSamples.length;i++){
      const sample=row.pulseSamples[i];
      if(!sample||typeof sample!=='object'||Array.isArray(sample)||
        Object.keys(sample).length!==2||
        !Object.hasOwn(sample,'atMs')||!Object.hasOwn(sample,'elapsedMs')||
        !Number.isFinite(sample.atMs)||!Number.isFinite(sample.elapsedMs)||
        sample.elapsedMs<=0||sample.elapsedMs>120000||
        sample.elapsedMs!==row.pulseIntervalsMs[i]||
        sample.atMs<row.startedAtMs||
        (previousAt!==null && (sample.atMs<=previousAt ||
          Math.abs(sample.atMs-previousAt-sample.elapsedMs)>0.01))||
        (row.handoffAtMs!==null && sample.atMs>row.handoffAtMs+80))
        fail();
      previousAt=sample.atMs;
    }
  }
  return true;
}

export function summarizeBrowserPhaseAlignedEvidence(receipt,options={}) {
  validateBrowserPhaseAlignedEvidence(receipt,options);
  return receipt.windows.map(row=>{
    const scanStart=row.phaseEvents[0].atMs;
    const scanEnd=row.phaseEvents[1].atMs;
    // Attribution is interval-based: a late callback crossing the scan
    // boundary does NOT prove the whole delay was caused by the scan.
    const touching=row.pulseSamples.filter(sample=>
      sample.atMs>=scanStart && sample.atMs-sample.elapsedMs<=scanEnd);
    const enclosed=touching.filter(sample=>
      sample.atMs-sample.elapsedMs>=scanStart && sample.atMs<=scanEnd);
    const maxDelay=samples=>samples.length?
      Math.max(...samples.map(s=>Math.max(0,s.elapsedMs-PULSE_MS))):null;
    return {
      label:row.label,selectedPixels:row.selectedPixels,
      scanWallMs:scanEnd-scanStart,
      sampleCount:row.pulseSamples.length,
      scanInteriorSamples:enclosed.length,
      scanIntersectingSamples:touching.length,
      maxInteriorTimerDelayMs:maxDelay(enclosed),
      maxOverlappingTimerDelayMs:maxDelay(touching),
      scanSamplingCoverage:enclosed.length?'interior-sampled':
        touching.length?'boundary-overlap-only':'no-scan-overlap-sample',
      missingScanPulsesUnknown:true,
      pulsesTruncated:row.pulsesTruncated,
      clockValid:row.clockValid,
      timerIsNotCpuTime:true,
      operationPeakKnown:false,
      workerPidMapping:'unknown',
    };
  });
}
