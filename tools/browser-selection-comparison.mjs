import { validateBrowserDenseNearCapEvidence } from './browser-dense-near-cap-evidence.mjs';
import { validateBrowserNearCapEvidence } from './browser-near-cap-evidence.mjs';
import {
  validateBrowserSelectionPhaseEvidence,validateBrowserSelectionRefusalPhaseEvidence,
  summarizeBrowserSelectionPhaseEvidence,
} from './browser-selection-freeze-observer.mjs';

// This intentionally reports observed ranges, not estimated p95, CPU or RSS.
// Each record is a separate fresh Chromium file:// process, verified above.
export function compareMatchedScanRows(rows,selectionClass){
  const invalid=()=>new TypeError('003W/3b: invalid comparative scan evidence');
  if(!['dense','sparse'].includes(selectionClass)||!Array.isArray(rows)||rows.length!==4)
    throw invalid();
  const result=[];
  for(const format of ['PSD16','PSB32']){
    const pair=rows.filter(row=>row?.format===format);
    if(pair.length!==2||pair[0].run!==1||pair[1].run!==2||
      !Number.isSafeInteger(pair[0].selectedPixels)||pair[0].selectedPixels<1||
      pair[0].selectedPixels!==pair[1].selectedPixels||
      (selectionClass==='dense'?pair[0].selectedPixels!==1973400:
        pair[0].selectedPixels>1024)||
      pair.some(row=>!Number.isFinite(row.scanWallMs)||row.scanWallMs<0||
        !Number.isSafeInteger(row.sampledIntervals)||row.sampledIntervals<0||
        row.sampledIntervals>256||row.pulsesTruncated!==false||
        !Number.isFinite(row.maxObservedTimerDelayMs)&&row.maxObservedTimerDelayMs!==null||
        row.maxObservedTimerDelayMs!==null&&row.maxObservedTimerDelayMs<0||
        row.operationPeakKnown!==false||row.workerPidMapping!=='unknown'||
        (selectionClass==='sparse'&&(
          !Number.isSafeInteger(row.refusalSelectedPixels)||
          row.refusalSelectedPixels<=2000000||row.refusalSelectedPixels>2030000||
          !Number.isFinite(row.refusalScanWallMs)||row.refusalScanWallMs<0))
      ))throw invalid();
    result.push({
      format,selectionClass,independentRuns:2,selectedPixels:pair[0].selectedPixels,
      scanWallObservedRangeMs:[
        Math.min(...pair.map(row=>row.scanWallMs)),
        Math.max(...pair.map(row=>row.scanWallMs))],
      observedPulseCount:pair.map(row=>row.sampledIntervals),
      maxSampledTimerDelayMs:pair.map(row=>row.maxObservedTimerDelayMs),
      ...(selectionClass==='sparse'?{
        refusalSelectedPixels:pair.map(row=>row.refusalSelectedPixels),
        refusalScanObservedRangeMs:[
          Math.min(...pair.map(row=>row.refusalScanWallMs)),
          Math.max(...pair.map(row=>row.refusalScanWallMs))],
      }:{}),
      limitations:'Independent wall times and sparse timer samples; no CPU, continuous trace, RSS peak, or Worker PID.',
    });
  }
  return result;
}

export function validateBrowserSelectionComparisonRecords(records,selectionClass){
  if(!Array.isArray(records)||records.length!==4)
    throw new TypeError('003W/3b: expected four independent native browser receipts');
  const rows=[];
  for(const {format,run,phase,legacy} of records){
    if(!['PSD16','PSB32'].includes(format)||![1,2].includes(run)||legacy?.format!==format)
      throw new TypeError('003W/3b: wrong file/format/run');
    let measured,refusal=null;
    if(selectionClass==='dense'){
      validateBrowserDenseNearCapEvidence(legacy);
      validateBrowserSelectionPhaseEvidence(phase,{
        format,geometryPixels:2030000,selectionClass:'dense'});
      if(phase.windows.length!==1||phase.windows[0].label!=='first-fill'||
        phase.windows[0].selectedPixels!==legacy.selectedPixels)
        throw new TypeError('003W/3b: dense Worker/phase mismatch');
      measured=phase;
    }else if(selectionClass==='sparse'){
      validateBrowserNearCapEvidence(legacy);
      validateBrowserSelectionRefusalPhaseEvidence(phase,{
        format,geometryPixels:2030000,expectedSparsePixels:legacy.sparseSelectedPixels});
      measured={...phase,windows:[phase.windows[0]]};
      refusal=phase.windows[1];
    }else throw new TypeError('003W/3b: wrong selection class');
    const summary=summarizeBrowserSelectionPhaseEvidence(measured,{
      format,geometryPixels:2030000,selectionClass});
    const row=measured.windows[0];
    rows.push({format,run,selectedPixels:row.selectedPixels,
      scanWallMs:summary[0].scanWallMs,
      sampledIntervals:row.pulseIntervalsMs.length,
      maxObservedTimerDelayMs:summary[0].maxObservedTimerDelayMs,
      pulsesTruncated:row.pulsesTruncated,
      operationPeakKnown:phase.trueOperationPeakKnown,
      workerPidMapping:phase.workerPidMapping,
      ...(refusal?{
        refusalSelectedPixels:refusal.phaseEvents[1].selectedPixels,
        refusalScanWallMs:refusal.phaseEvents[1].atMs-refusal.phaseEvents[0].atMs,
      }:{})});
  }
  return compareMatchedScanRows(rows,selectionClass);
}
