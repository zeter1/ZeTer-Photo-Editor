import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 003W/2b-2a. Real file:// UI evidence, NOT a near-cap dense Worker success.
// Fail closed on unverified memory/PID/CPU or on missing native/history proofs.
const KEYS=[
  'kind','format','sourcePixels','sourceRawBytes','protocol',
  'sparseSelectedPixels','sparseSelectedBytes','sparseWorkerJobs',
  'sparseChangedNative','sparseOutsideTilesUnchanged','alphaUnchanged',
  'undoExact','redoExact','overCapWorkerJobsBefore','overCapWorkerJobsAfter',
  'overCapStatus','overCapNativeUnchanged','overCapPreviewUnchanged',
  'overCapHistoryUnchanged','sampledPulseIntervalsMs','requestedPulseMs',
  'pulsesTruncated','menuToRefusalMs','heapBeforeBytes','heapAfterBytes',
  'workerPidMapping','operationPeakKnown','limitations',
];
export function validateBrowserNearCapEvidence(value) {
  const bad=()=>new TypeError('003W/2b-2a: invalid real near-cap browser evidence');
  if (!value || typeof value!=='object' || Array.isArray(value) ||
    Object.keys(value).length!==KEYS.length ||
    Object.keys(value).some(key=>!KEYS.includes(key)) ||
    value.kind!=='zpe-browser-near-cap-ui-v1' ||
    !['PSD16','PSB32'].includes(value.format) ||
    value.protocol!=='file:' ||
    value.sourcePixels!==2_030_000 ||
    value.sourceRawBytes!==value.sourcePixels*4*(value.format==='PSD16'?2:4) ||
    !Number.isSafeInteger(value.sparseSelectedPixels) ||
    value.sparseSelectedPixels<1 || value.sparseSelectedPixels>1024 ||
    value.sparseSelectedBytes!==value.sparseSelectedPixels*4 ||
    value.sparseWorkerJobs!==1 ||
    value.sparseChangedNative!==true ||
    value.sparseOutsideTilesUnchanged!==true ||
    value.alphaUnchanged!==true ||
    value.undoExact!==true || value.redoExact!==true ||
    value.overCapWorkerJobsBefore!==1 ||
    value.overCapWorkerJobsAfter!==value.overCapWorkerJobsBefore ||
    typeof value.overCapStatus!=='string' ||
    !value.overCapStatus.startsWith('Контент-заливка: выделено больше безопасного лимита 2000000 px') ||
    value.overCapNativeUnchanged!==true ||
    value.overCapPreviewUnchanged!==true ||
    value.overCapHistoryUnchanged!==true ||
    value.requestedPulseMs!==8 ||
    !Array.isArray(value.sampledPulseIntervalsMs) ||
    value.sampledPulseIntervalsMs.length>256 ||
    value.sampledPulseIntervalsMs.some(ms=>!Number.isFinite(ms)||ms<0||ms>120000) ||
    value.pulsesTruncated!==false ||
    !Number.isFinite(value.menuToRefusalMs) ||
    value.menuToRefusalMs<0 || value.menuToRefusalMs>120000 ||
    [value.heapBeforeBytes,value.heapAfterBytes].some(
      v=>v!==null&&(!Number.isSafeInteger(v)||v<0)) ||
    value.workerPidMapping!=='unknown' || value.operationPeakKnown!==false ||
    value.limitations!=='Sparse Worker success and >2M refusal only; sampled renderer timer/heap, not continuous CPU, operation memory peak, Worker PID or dense near-2M completion.') throw bad();
  return true;
}

export async function saveBrowserNearCapEvidence(value,directory) {
  validateBrowserNearCapEvidence(value);
  if (!directory) return null;
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'stage003-near-cap-'+value.format.toLowerCase()+'.json');
  await writeFile(file,JSON.stringify(value,null,2)+'\n');
  return file;
}

export async function verifyBrowserNearCapEvidence(directory) {
  if (!directory) throw new TypeError('003W/2b-2a: missing artifact directory');
  for (const format of ['PSD16','PSB32']) {
    const file=path.join(directory,'stage003-near-cap-'+format.toLowerCase()+'.json');
    const parsed=JSON.parse(await readFile(file,'utf8'));
    validateBrowserNearCapEvidence(parsed);
    if (parsed.format!==format) throw new TypeError('003W/2b-2a: mismatched artifact format');
  }
  return true;
}
