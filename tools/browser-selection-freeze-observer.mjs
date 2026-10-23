// 003W: observational timing only for real Chromium file:// UI selection freezes.
// A menu-click-to-Worker-handoff interval is NOT isolated selection CPU time.
// Timer pulses are main-thread samples, NOT a continuous event-loop trace.
const LIMIT=256;
const PULSE_MS=8;
const LIMITATIONS='Menu-to-Worker handoff includes command overhead; timer pulses miss unsampled gaps. Renderer JS heap samples are not process RSS or an operation peak. Worker OS PID is unknown.';

export function installBrowserSelectionFreezeObserver() {
  // This function is injected into a real Chromium page through CDP; keep it self-contained.
  const LIMIT=256, PULSE_MS=8;
  const LIMITATIONS='Menu-to-Worker handoff includes command overhead; timer pulses miss unsampled gaps. Renderer JS heap samples are not process RSS or an operation peak. Worker OS PID is unknown.';
  if (window.__stage003SelectionFreeze) throw new Error('003W observer already installed');
  const originalPost=Worker.prototype.postMessage;
  const previousTiming=window.__zpeTiledInpaintTiming;
  const windows=[];
  let active=null;
  let previousPulse=performance.now();
  const readHeap=()=>{
    const value=performance.memory?.usedJSHeapSize;
    return Number.isSafeInteger(value)&&value>=0?value:null;
  };
  const timer=setInterval(()=>{
    const now=performance.now();
    const elapsed=now-previousPulse;
    previousPulse=now;
    if (!active) return;
    if (active.handoffAtMs!==null && now>active.handoffAtMs+80) {
      active=null;
      return;
    }
    if (active.pulseIntervalsMs.length<LIMIT) active.pulseIntervalsMs.push(elapsed);
    else active.pulsesTruncated=true;
  },PULSE_MS);
  window.__zpeTiledInpaintTiming=function(event) {
    if (active && active.phaseEvents.length<3 && event && typeof event==='object') {
      active.phaseEvents.push({
        phase:event.phase,atMs:event.atMs,selectedPixels:event.selectedPixels,
      });
    }
  };
  Worker.prototype.postMessage=function(value,...rest) {
    if (value?.source?.kind==='zpe-pixel-buffer-source-v2' &&
        value?.selectedIndices instanceof Uint32Array && active) {
      if (active.handoffAtMs!==null) active.duplicateWorkerHandoffs++;
      else {
        active.handoffAtMs=performance.now();
        active.selectedPixels=value.selectedIndices.length;
        active.selectedBytes=value.selectedIndices.byteLength;
        active.firstSelectedIndex=value.selectedIndices[0]??null;
        active.lastSelectedIndex=value.selectedIndices[value.selectedIndices.length-1]??null;
        active.heapAtHandoffBytes=readHeap();
      }
    }
    return originalPost.call(this,value,...rest);
  };
  const control={
    begin(label) {
      if (active && active.handoffAtMs===null) throw new Error('003W previous freeze has no Worker handoff');
      if (!['first-fill','cancel-fill','retry-fill'].includes(label) ||
          windows.some(value=>value.label===label)) throw new TypeError('003W invalid observation label');
      const beganAtMs=performance.now();
      active={
        label,startedAtMs:beganAtMs,handoffAtMs:null,
        selectedPixels:null,selectedBytes:null,firstSelectedIndex:null,lastSelectedIndex:null,
        heapBeforeBytes:readHeap(),heapAtHandoffBytes:null,
        pulseIntervalsMs:[],pulsesTruncated:false,duplicateWorkerHandoffs:0,
        phaseEvents:[],
      };
      windows.push(active);
    },
    snapshot() {
      return {
        kind:'zpe-browser-selection-freeze-observations-v1',
        requestedPulseIntervalMs:PULSE_MS,
        observationClass:'event-loop-timer-sampled',
        limitations:LIMITATIONS,
        workerPidMapping:'unknown',
        trueOperationPeakKnown:false,
        windows:windows.map(({phaseEvents,...value})=>({
          ...value,pulseIntervalsMs:[...value.pulseIntervalsMs],
        })),
      };
    },
    phaseSnapshot() {
      return {
        kind:'zpe-browser-selection-phase-observations-v1',
        observationClass:'opt-in-monotonic-boundaries',
        limitations:LIMITATIONS,
        workerPidMapping:'unknown',trueOperationPeakKnown:false,
        requestedPulseIntervalMs:PULSE_MS,
        windows:windows.map(value=>({
          label:value.label,startedAtMs:value.startedAtMs,
          handoffAtMs:value.handoffAtMs,selectedPixels:value.selectedPixels,
          phaseEvents:value.phaseEvents.map(event=>({...event})),
          pulseIntervalsMs:[...value.pulseIntervalsMs],
          pulsesTruncated:value.pulsesTruncated,
        })),
      };
    },
    restore() {
      if (previousTiming===undefined) delete window.__zpeTiledInpaintTiming;
      else window.__zpeTiledInpaintTiming=previousTiming;
      clearInterval(timer);
      Worker.prototype.postMessage=originalPost;
      delete window.__stage003SelectionFreeze;
    },
  };
  window.__stage003SelectionFreeze=control;
  return true;
}

export function validateBrowserSelectionFreezeEvidence(evidence,{
  format,withCancellation=true,geometryPixels,
}={}) {
  const invalid=()=>new TypeError('003W: invalid real-browser selection freeze evidence');
  if (!['PSD16','PSB32'].includes(format) || !Number.isSafeInteger(geometryPixels) ||
      geometryPixels<1 || geometryPixels>0x100000000 ||
      !evidence || typeof evidence!=='object' || Array.isArray(evidence) ||
      evidence.kind!=='zpe-browser-selection-freeze-observations-v1' ||
      evidence.requestedPulseIntervalMs!==PULSE_MS ||
      evidence.observationClass!=='event-loop-timer-sampled' ||
      evidence.limitations!==LIMITATIONS ||
      evidence.workerPidMapping!=='unknown' || evidence.trueOperationPeakKnown!==false ||
      Object.keys(evidence).some(key=>![
        'kind','requestedPulseIntervalMs','observationClass','limitations',
        'workerPidMapping','trueOperationPeakKnown','windows',
      ].includes(key)) || !Array.isArray(evidence.windows)) throw invalid();
  const expected=withCancellation?['first-fill','cancel-fill','retry-fill']:['first-fill'];
  if (evidence.windows.length!==expected.length) throw invalid();
  let previousHandoff=-1;
  for (let index=0;index<evidence.windows.length;index++) {
    const entry=evidence.windows[index];
    if (!entry || typeof entry!=='object' || Array.isArray(entry) ||
        Object.keys(entry).some(key=>![
          'label','startedAtMs','handoffAtMs','selectedPixels','selectedBytes',
          'firstSelectedIndex','lastSelectedIndex','heapBeforeBytes',
          'heapAtHandoffBytes','pulseIntervalsMs','pulsesTruncated','duplicateWorkerHandoffs',
        ].includes(key)) ||
        entry.label!==expected[index] ||
        !Number.isFinite(entry.startedAtMs) || entry.startedAtMs<previousHandoff ||
        !Number.isFinite(entry.handoffAtMs) || entry.handoffAtMs<entry.startedAtMs ||
        !Number.isSafeInteger(entry.selectedPixels) ||
        entry.selectedPixels<1 || entry.selectedPixels>Math.min(2000000,geometryPixels) ||
        entry.selectedBytes!==entry.selectedPixels*4 ||
        !Number.isSafeInteger(entry.firstSelectedIndex) ||
        !Number.isSafeInteger(entry.lastSelectedIndex) ||
        entry.firstSelectedIndex<0 || entry.lastSelectedIndex>=geometryPixels ||
        entry.firstSelectedIndex>entry.lastSelectedIndex ||
        entry.duplicateWorkerHandoffs!==0 || entry.pulsesTruncated!==false ||
        !Array.isArray(entry.pulseIntervalsMs) || entry.pulseIntervalsMs.length>LIMIT ||
        entry.pulseIntervalsMs.some(value=>!Number.isFinite(value) || value<0 || value>120000) ||
        [entry.heapBeforeBytes,entry.heapAtHandoffBytes].some(
          value=>value!==null&&(!Number.isSafeInteger(value)||value<0))) throw invalid();
    previousHandoff=entry.handoffAtMs;
  }
  return true;
}

export function summarizeBrowserSelectionFreezeEvidence(evidence,options) {
  validateBrowserSelectionFreezeEvidence(evidence,options);
  return evidence.windows.map(entry=>{
    const gaps=entry.pulseIntervalsMs.map(value=>Math.max(0,value-PULSE_MS)).sort((a,b)=>a-b);
    return {
      label:entry.label,selectedPixels:entry.selectedPixels,
      menuToWorkerHandoffMs:entry.handoffAtMs-entry.startedAtMs,
      observedPulseCount:gaps.length,
      maxObservedTimerDelayMs:gaps.at(-1)??null,
      p95ObservedTimerDelayMs:gaps.length?gaps[Math.ceil(gaps.length*0.95)-1]:null,
      heapBeforeBytes:entry.heapBeforeBytes,heapAtHandoffBytes:entry.heapAtHandoffBytes,
      evidenceGap:gaps.length?'none':'no-pulse-observed',
    };
  });
}

/**
 * 003W/2a: independently reject a saved real-browser Escape result unless the
 * broad UI selection really avoided dispatch and preserved native/preview/history.
 * Bounding box size is only geometric coverage, NOT counted selected pixels.
 */
export function validateBrowserBroadPreDispatchCancellation(evidence,{format,geometryPixels}={}) {
  const invalid=()=>new TypeError('003W/2a: invalid broad pre-Worker cancellation evidence');
  if (!['PSD16','PSB32'].includes(format) ||
      !Number.isSafeInteger(geometryPixels) || geometryPixels<900000 ||
      geometryPixels>0x100000000 ||
      !evidence || typeof evidence!=='object' || Array.isArray(evidence) ||
      Object.keys(evidence).length!==10 ||
      Object.keys(evidence).some(key=>![
        'kind','format','geometryPixels','selectionBoundingPixels','cancellationEvent',
        'workerJobsBefore','workerJobsAfter','sourceUnchanged','previewUnchanged','historyUnchanged',
      ].includes(key)) ||
      evidence.kind!=='zpe-browser-broad-selection-predispatch-cancel-v1' ||
      evidence.format!==format || evidence.geometryPixels!==geometryPixels ||
      !Number.isSafeInteger(evidence.selectionBoundingPixels) ||
      evidence.selectionBoundingPixels<900000 ||
      evidence.selectionBoundingPixels>=geometryPixels ||
      evidence.cancellationEvent!=='Escape' ||
      !Number.isSafeInteger(evidence.workerJobsBefore) ||
      evidence.workerJobsBefore<1 ||
      evidence.workerJobsAfter!==evidence.workerJobsBefore ||
      evidence.sourceUnchanged!==true ||
      evidence.previewUnchanged!==true ||
      evidence.historyUnchanged!==true) throw invalid();
  return true;
}

/** 003W/3: fail-closed receipt gate; wall-time is NOT CPU time or RSS peak. */
export function validateBrowserSelectionPhaseEvidence(value,{format,geometryPixels,selectionClass='dense'}={}) {
  const invalid=()=>new TypeError('003W/3: invalid browser selection phase evidence');
  const keys=['kind','observationClass','limitations','workerPidMapping','trueOperationPeakKnown','requestedPulseIntervalMs','windows'];
  const rowKeys=['label','startedAtMs','handoffAtMs','selectedPixels','phaseEvents','pulseIntervalsMs','pulsesTruncated'];
  const phaseKeys=['phase','atMs','selectedPixels'];
  if(!['PSD16','PSB32'].includes(format)||!['dense','sparse'].includes(selectionClass)||
    !Number.isSafeInteger(geometryPixels)||geometryPixels<1900000||
    !value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k))||
    value.kind!=='zpe-browser-selection-phase-observations-v1'||
    value.observationClass!=='opt-in-monotonic-boundaries'||value.limitations!==LIMITATIONS||
    value.workerPidMapping!=='unknown'||value.trueOperationPeakKnown!==false||
    value.requestedPulseIntervalMs!==PULSE_MS||
    !Array.isArray(value.windows)||value.windows.length<1||value.windows.length>12)throw invalid();
  let last=-1;
  for(const row of value.windows) {
    if(!row||typeof row!=='object'||Array.isArray(row)||
      Object.keys(row).length!==rowKeys.length||Object.keys(row).some(k=>!rowKeys.includes(k))||
      !['first-fill','cancel-fill','retry-fill'].includes(row.label)||
      !Number.isFinite(row.startedAtMs)||row.startedAtMs<last||
      !Number.isFinite(row.handoffAtMs)||row.handoffAtMs<row.startedAtMs||
      !Number.isSafeInteger(row.selectedPixels)||row.selectedPixels<1||
      row.selectedPixels>Math.min(2000000,geometryPixels)||
      (selectionClass==='dense' ? row.selectedPixels<1900000 : row.selectedPixels>=1900000)||
      !Array.isArray(row.phaseEvents)||row.phaseEvents.length!==3||
      !Array.isArray(row.pulseIntervalsMs)||row.pulseIntervalsMs.length>LIMIT||
      row.pulseIntervalsMs.some(ms=>!Number.isFinite(ms)||ms<0||ms>120000)||
      row.pulsesTruncated!==false)throw invalid();
    let at=row.startedAtMs;
    for(const [i,name] of ['selection-start','selection-end','worker-run-start'].entries()){
      const event=row.phaseEvents[i];
      if(!event||typeof event!=='object'||Array.isArray(event)||
        Object.keys(event).length!==phaseKeys.length||
        Object.keys(event).some(k=>!phaseKeys.includes(k))||event.phase!==name||
        !Number.isFinite(event.atMs)||event.atMs<at||event.atMs>row.handoffAtMs||
        (i===0?event.selectedPixels!==null:event.selectedPixels!==row.selectedPixels))throw invalid();
      at=event.atMs;
    }
    last=row.handoffAtMs;
  }
  return true;
}
export function summarizeBrowserSelectionPhaseEvidence(value,options) {
  validateBrowserSelectionPhaseEvidence(value,options);
  return value.windows.map(row=>{
    const a=row.phaseEvents,delays=row.pulseIntervalsMs.map(ms=>Math.max(0,ms-PULSE_MS));
    return {
      label:row.label,selectedPixels:row.selectedPixels,
      menuToScanMs:a[0].atMs-row.startedAtMs,scanWallMs:a[1].atMs-a[0].atMs,
      scanToWorkerRunMs:a[2].atMs-a[1].atMs,
      workerRunToPostMs:row.handoffAtMs-a[2].atMs,
      observedPulseCount:delays.length,maxObservedTimerDelayMs:delays.length?Math.max(...delays):null,
      sampleGap:delays.length?'timer-sampled':'no-pulse-observed',
      operationPeakKnown:false,workerPidMapping:'unknown',
    };
  });
}
