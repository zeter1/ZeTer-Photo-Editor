import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 003W/2b-2f: genuine File -> New refusal/acceptance, not a tab close/switch.
const KEYS=[
  'kind','format','protocol','sourcePixels','marqueeBoundingPixels',
  'selectedPixels','selectedBytes','deniedPromptCount','approvedPromptCount',
  'deniedModalAbsent','deniedOwnerKept','deniedJobs','deniedReplies',
  'deniedTerminations','newModalSubmitted','newWidth','newHeight',
  'blankNativeRemoved','blankHistoryReset','blankStableAfterSettle',
  'terminatedBeforeReply','terminationsAfterNew','oldRepliesAfterSettle',
  'reimportedHighDepth','reimportNativeBaselineExact','reimportHistoryClean',
  'retrySelectedPixels','retrySelectedBytes','retryChangedSelectedPixels',
  'retryOutsideUnchanged','retryAlphaUnchanged','retryHistoryOnce',
  'undoExact','redoExact','finalTabs','finalWorkerJobs','finalWorkerReplies',
  'finalWorkerTerminations','firstDispatchToTerminationMs',
  'retryCompletionMs','cancelPulseIntervalsMs','retryPulseIntervalsMs',
  'heapBeforeBytes','heapAfterBytes','workerPidMapping','operationPeakKnown',
  'limitations',
];
const LIMITATIONS='Actual File New dirty refusal/accepted replacement and fresh imported native dense retry in Chromium file://; sampled renderer timer and heap only; no isolated CPU, operation RSS peak, Worker PID or Photoshop-authored PSB32 provenance.';
const samples=v=>Array.isArray(v)&&v.length<=256&&
  v.every(x=>Number.isFinite(x)&&x>=0&&x<=600_000);
const heap=v=>v===null||(Number.isSafeInteger(v)&&v>=0);

export function validateBrowserDenseReplaceEvidence(v){
  const error=()=>new TypeError('003W/2b-2f: invalid dense document replacement evidence');
  if(!v||typeof v!=='object'||Array.isArray(v)||
    Object.keys(v).length!==KEYS.length||Object.keys(v).some(k=>!KEYS.includes(k))||
    v.kind!=='zpe-browser-dense-document-replacement-v1'||
    !['PSD16','PSB32'].includes(v.format)||v.protocol!=='file:'||
    v.sourcePixels!==2_030_000||
    !Number.isSafeInteger(v.marqueeBoundingPixels)||
    v.marqueeBoundingPixels<1_900_000||v.marqueeBoundingPixels>2_000_000||
    !Number.isSafeInteger(v.selectedPixels)||
    v.selectedPixels<1_900_000||v.selectedPixels>2_000_000||
    v.selectedBytes!==v.selectedPixels*4||
    v.deniedPromptCount!==1||v.approvedPromptCount!==1||
    v.deniedModalAbsent!==true||v.deniedOwnerKept!==true||
    v.deniedJobs!==1||v.deniedReplies!==0||v.deniedTerminations!==0||
    v.newModalSubmitted!==true||v.newWidth!==37||v.newHeight!==29||
    v.blankNativeRemoved!==true||v.blankHistoryReset!==true||
    v.blankStableAfterSettle!==true||v.terminatedBeforeReply!==true||
    v.terminationsAfterNew!==1||v.oldRepliesAfterSettle!==0||
    v.reimportedHighDepth!==true||v.reimportNativeBaselineExact!==true||
    v.reimportHistoryClean!==true||
    v.retrySelectedPixels!==v.selectedPixels||
    v.retrySelectedBytes!==v.selectedBytes||
    !Number.isSafeInteger(v.retryChangedSelectedPixels)||
    v.retryChangedSelectedPixels<=0||v.retryChangedSelectedPixels>v.selectedPixels||
    ![v.retryOutsideUnchanged,v.retryAlphaUnchanged,v.retryHistoryOnce,
      v.undoExact,v.redoExact].every(x=>x===true)||
    v.finalTabs!==1||v.finalWorkerJobs!==2||v.finalWorkerReplies!==1||
    ![1,2].includes(v.finalWorkerTerminations)||
    !Number.isFinite(v.firstDispatchToTerminationMs)||
    v.firstDispatchToTerminationMs<0||v.firstDispatchToTerminationMs>=180_000||
    !Number.isFinite(v.retryCompletionMs)||v.retryCompletionMs<=0||
    v.retryCompletionMs>205_000||
    !samples(v.cancelPulseIntervalsMs)||!samples(v.retryPulseIntervalsMs)||
    !heap(v.heapBeforeBytes)||!heap(v.heapAfterBytes)||
    v.workerPidMapping!=='unknown'||v.operationPeakKnown!==false||
    v.limitations!==LIMITATIONS)throw error();
  return true;
}

export async function saveBrowserDenseReplaceEvidence(v,dir){
  validateBrowserDenseReplaceEvidence(v);
  if(!dir)return null;
  await mkdir(dir,{recursive:true});
  const filename=path.join(dir,'stage003-dense-replace-'+v.format.toLowerCase()+'.json');
  await writeFile(filename,JSON.stringify(v,null,2)+'\n');
  return filename;
}

export async function verifyBrowserDenseReplaceEvidence(dir){
  if(!dir)throw new TypeError('003W/2b-2f: missing evidence directory');
  for(const format of ['PSD16','PSB32']){
    const v=JSON.parse(await readFile(path.join(dir,
      'stage003-dense-replace-'+format.toLowerCase()+'.json'),'utf8'));
    validateBrowserDenseReplaceEvidence(v);
    if(v.format!==format)throw new TypeError('003W/2b-2f: mismatched PSD/PSB format');
  }
  return true;
}
export const BROWSER_DENSE_REPLACE_LIMITATIONS=LIMITATIONS;
