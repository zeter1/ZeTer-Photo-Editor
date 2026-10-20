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
        windows:windows.map(value=>({
          ...value,pulseIntervalsMs:[...value.pulseIntervalsMs],
        })),
      };
    },
    restore() {
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
