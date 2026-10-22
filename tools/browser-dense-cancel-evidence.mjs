import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 003W/2b-2c: real file:// Chromium production Worker, cancelled after
// a dense dispatch, followed by a fresh, successful dense Worker retry.
const KEYS=[
  'kind','format','sourcePixels','sourceRawBytes','protocol',
  'marqueeBoundingPixels','firstSelectedPixels','firstSelectedBytes',
  'secondSelectedPixels','secondSelectedBytes','workerJobs',
  'cancelAcknowledged','cancelBeforeReply','terminatedJobsBeforeRetry',
  'repliesBeforeRetry','cancelNativeExact','cancelPreviewExact',
  'cancelHistoryExact','settledNativeExact','settledPreviewExact',
  'settledHistoryExact','retryChangedSelectedPixels','retryOutsideUnchanged',
  'retryAlphaUnchanged','retryUndoExact','retryRedoExact',
  'retryHistoryOnce','finalReplies','firstDispatchToCancelMs',
  'cancelSettledMs','retryMenuToCompletionMs','requestedPulseMs',
  'cancelPulseIntervalsMs','retryPulseIntervalsMs',
  'cancelPulsesTruncated','retryPulsesTruncated',
  'heapBeforeBytes','heapAfterBytes','workerPidMapping',
  'operationPeakKnown','limitations',
];
const LIMITATIONS='Real dense Worker dispatch, Escape termination and retry; bounded renderer timer/heap samples only, not continuous UI responsiveness, isolated CPU, operation memory peak, Worker PID or Photoshop-authored provenance.';

export function validateBrowserDenseCancelEvidence(value) {
  const invalid=()=>new TypeError('003W/2b-2c: invalid dense Worker cancellation evidence');
  if(!value || typeof value!=='object' || Array.isArray(value) ||
     Object.keys(value).length!==KEYS.length ||
     Object.keys(value).some(key=>!KEYS.includes(key)) ||
     value.kind!=='zpe-browser-near-cap-dense-cancel-v1' ||
     !['PSD16','PSB32'].includes(value.format) ||
     value.protocol!=='file:' ||
     value.sourcePixels!==2_030_000 ||
     value.sourceRawBytes!==value.sourcePixels*4*(value.format==='PSD16'?2:4) ||
     !Number.isSafeInteger(value.marqueeBoundingPixels) ||
     value.marqueeBoundingPixels<1_900_000 || value.marqueeBoundingPixels>2_000_000 ||
     ![value.firstSelectedPixels,value.secondSelectedPixels].every(n=>
       Number.isSafeInteger(n)&&n>=1_900_000&&n<=2_000_000) ||
     value.firstSelectedPixels!==value.secondSelectedPixels ||
     value.firstSelectedBytes!==value.firstSelectedPixels*4 ||
     value.secondSelectedBytes!==value.secondSelectedPixels*4 ||
     value.workerJobs!==2 ||
     value.cancelAcknowledged!==true ||
     value.cancelBeforeReply!==true ||
     value.terminatedJobsBeforeRetry!==1 ||
     value.repliesBeforeRetry!==0 ||
     value.cancelNativeExact!==true ||
     value.cancelPreviewExact!==true ||
     value.cancelHistoryExact!==true ||
     value.settledNativeExact!==true ||
     value.settledPreviewExact!==true ||
     value.settledHistoryExact!==true ||
     !Number.isSafeInteger(value.retryChangedSelectedPixels) ||
     value.retryChangedSelectedPixels<1 ||
     value.retryChangedSelectedPixels>value.secondSelectedPixels ||
     value.retryOutsideUnchanged!==true ||
     value.retryAlphaUnchanged!==true ||
     value.retryUndoExact!==true ||
     value.retryRedoExact!==true ||
     value.retryHistoryOnce!==true ||
     value.finalReplies!==1 ||
     !Number.isFinite(value.firstDispatchToCancelMs) ||
     value.firstDispatchToCancelMs<0 || value.firstDispatchToCancelMs>=180_000 ||
     !Number.isFinite(value.cancelSettledMs) ||
     value.cancelSettledMs<500 || value.cancelSettledMs>30_000 ||
     !Number.isFinite(value.retryMenuToCompletionMs) ||
     value.retryMenuToCompletionMs<=0 || value.retryMenuToCompletionMs>205_000 ||
     value.requestedPulseMs!==8 ||
     ![value.cancelPulseIntervalsMs,value.retryPulseIntervalsMs].every(samples=>
       Array.isArray(samples) && samples.length<=256 &&
       samples.every(v=>Number.isFinite(v)&&v>=0&&v<=600_000)) ||
     typeof value.cancelPulsesTruncated!=='boolean' ||
     typeof value.retryPulsesTruncated!=='boolean' ||
     [value.heapBeforeBytes,value.heapAfterBytes].some(v=>
       v!==null&&(!Number.isSafeInteger(v)||v<0)) ||
     value.workerPidMapping!=='unknown' ||
     value.operationPeakKnown!==false ||
     value.limitations!==LIMITATIONS) throw invalid();
  return true;
}

export async function saveBrowserDenseCancelEvidence(value,directory) {
  validateBrowserDenseCancelEvidence(value);
  if(!directory)return null;
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'stage003-dense-cancel-'+value.format.toLowerCase()+'.json');
  await writeFile(file,JSON.stringify(value,null,2)+'\n');
  return file;
}

export async function verifyBrowserDenseCancelEvidence(directory) {
  if(!directory)throw new TypeError('003W/2b-2c: missing evidence directory');
  for(const format of ['PSD16','PSB32']){
    const file=path.join(directory,'stage003-dense-cancel-'+format.toLowerCase()+'.json');
    const value=JSON.parse(await readFile(file,'utf8'));
    validateBrowserDenseCancelEvidence(value);
    if(value.format!==format)throw new TypeError('003W/2b-2c: mismatched native format');
  }
  return true;
}

export const BROWSER_DENSE_CANCEL_LIMITATIONS=LIMITATIONS;
