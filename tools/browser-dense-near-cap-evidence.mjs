import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 003W/2b-2b: actual production Worker on a ~2M dense selection.
// Observed renderer pulses/heap do NOT prove isolated CPU or an operation peak.
const KEYS=[
  'kind','format','sourcePixels','sourceRawBytes','protocol',
  'marqueeBoundingPixels','selectedPixels','selectedBytes','workerJobs',
  'changedSelectedPixels','outsideSelectionUnchanged','alphaUnchanged',
  'undoExact','redoExact','sampledPulseIntervalsMs','requestedPulseMs',
  'pulsesTruncated','menuToCompletionMs','heapBeforeBytes','heapAfterBytes',
  'workerPidMapping','operationPeakKnown','limitations',
];
const LIMITATIONS='Genuine dense native Worker completion; renderer timer/heap samples only, not isolated CPU, continuous event-loop trace, operation memory peak, Worker PID or Photoshop-authored provenance.';

export function validateBrowserDenseNearCapEvidence(value) {
  const invalid=()=>new TypeError('003W/2b-2b: invalid dense Chromium Worker evidence');
  if (!value || typeof value!=='object' || Array.isArray(value) ||
      Object.keys(value).length!==KEYS.length ||
      Object.keys(value).some(key=>!KEYS.includes(key)) ||
      value.kind!=='zpe-browser-near-cap-dense-v1' ||
      !['PSD16','PSB32'].includes(value.format) ||
      value.protocol!=='file:' ||
      value.sourcePixels!==2_030_000 ||
      value.sourceRawBytes!==value.sourcePixels*4*(value.format==='PSD16'?2:4) ||
      !Number.isSafeInteger(value.marqueeBoundingPixels) ||
      value.marqueeBoundingPixels<1_900_000 || value.marqueeBoundingPixels>2_000_000 ||
      !Number.isSafeInteger(value.selectedPixels) ||
      value.selectedPixels<1_900_000 || value.selectedPixels>2_000_000 ||
      value.selectedBytes!==value.selectedPixels*4 ||
      value.workerJobs!==1 ||
      !Number.isSafeInteger(value.changedSelectedPixels) ||
      value.changedSelectedPixels<1 || value.changedSelectedPixels>value.selectedPixels ||
      value.outsideSelectionUnchanged!==true || value.alphaUnchanged!==true ||
      value.undoExact!==true || value.redoExact!==true ||
      value.requestedPulseMs!==8 ||
      !Array.isArray(value.sampledPulseIntervalsMs) ||
      value.sampledPulseIntervalsMs.length>256 ||
      value.sampledPulseIntervalsMs.some(v=>!Number.isFinite(v)||v<0||v>600_000) ||
      typeof value.pulsesTruncated!=='boolean' ||
      !Number.isFinite(value.menuToCompletionMs) ||
      value.menuToCompletionMs<0 || value.menuToCompletionMs>600_000 ||
      [value.heapBeforeBytes,value.heapAfterBytes].some(v=>
        v!==null&&(!Number.isSafeInteger(v)||v<0)) ||
      value.workerPidMapping!=='unknown' ||
      value.operationPeakKnown!==false ||
      value.limitations!==LIMITATIONS) throw invalid();
  return true;
}

export async function saveBrowserDenseNearCapEvidence(value,directory) {
  validateBrowserDenseNearCapEvidence(value);
  if (!directory) return null;
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'stage003-dense-near-cap-'+value.format.toLowerCase()+'.json');
  await writeFile(file,JSON.stringify(value,null,2)+'\n');
  return file;
}

export async function verifyBrowserDenseNearCapEvidence(directory) {
  if (!directory) throw new TypeError('003W/2b-2b: missing dense artifact directory');
  for (const format of ['PSD16','PSB32']) {
    const file=path.join(directory,'stage003-dense-near-cap-'+format.toLowerCase()+'.json');
    const value=JSON.parse(await readFile(file,'utf8'));
    validateBrowserDenseNearCapEvidence(value);
    if (value.format!==format) throw new TypeError('003W/2b-2b: mismatched dense format');
  }
  return true;
}

export const BROWSER_DENSE_NEAR_CAP_LIMITATIONS=LIMITATIONS;
