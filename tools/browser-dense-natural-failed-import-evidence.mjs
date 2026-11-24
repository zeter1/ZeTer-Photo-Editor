import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 003W/2b-2i: genuinely failed File Open must not revoke the original Worker;
// unlike 2h, the old Worker finishes and commits exactly once before reimport.
export const BROWSER_DENSE_NATURAL_FAILED_IMPORT_LIMITATIONS =
  'Genuine Chromium file:// malformed PSD/PSB File Open during original dense Worker; sampled renderer timer and JS heap only; no operation-exclusive CPU/RSS peak, verified Worker PID or independently Photoshop-authored PSB32 provenance.';
const KEYS=[
  'kind','format','protocol','sourcePixels','malformedFilename','malformedBytes',
  'approvedPrompts','decodeFailed','originalWorkerInFlightAtFailure',
  'failedOpenPreviewUnchanged','failedOpenHistoryUnchanged','failedOpenTabs',
  'selectedPixels','selectedBytes','originalWorkerJobs','originalWorkerReplies',
  'originalWorkerTerminations','originalSelectedOnly','originalAlphaUnchanged',
  'originalHistoryOnce','originalUndoExact','originalRedoExact',
  'importApprovedPrompts','importedName','importedNativeDifferent',
  'importedHighDepth','importedNativeExact','importedPreviewDifferent',
  'importedHistoryClean','stableAfterImport','retrySelectedPixels',
  'retrySelectedOnly','retryAlphaUnchanged','retryHistoryOnce',
  'retryUndoExact','retryRedoExact','finalTabs','finalWorkerJobs',
  'finalWorkerReplies','completionMs','retryCompletionMs',
  'pulseIntervalsMs','heapBeforeBytes','heapAfterBytes',
  'workerPidMapping','operationPeakKnown','limitations',
];
const safeHeap=v=>v===null||(Number.isSafeInteger(v)&&v>=0);
const safeSamples=v=>Array.isArray(v)&&v.length<=256&&
  v.every(x=>Number.isFinite(x)&&x>=0&&x<=600_000);
const allTrue=(v,keys)=>keys.every(k=>v[k]===true);
export function validateBrowserDenseNaturalFailedImportEvidence(v){
  const fail=()=>{throw new TypeError('003W/2b-2i: invalid natural failed-import Worker evidence');};
  const psb=v?.format==='PSB32',ext=psb?'.psb':'.psd';
  if(!v||typeof v!=='object'||Array.isArray(v)||
    Object.keys(v).length!==KEYS.length||
    Object.keys(v).some(k=>!KEYS.includes(k))||
    v.kind!=='zpe-browser-dense-failed-import-natural-completion-v1'||
    !['PSD16','PSB32'].includes(v.format)||v.protocol!=='file:'||
    v.sourcePixels!==2_030_000||
    v.malformedFilename!=='malformed-native-'+(psb?'psb.psb':'psd.psd')||
    v.malformedBytes!==12||v.approvedPrompts!==1||
    !allTrue(v,['decodeFailed','originalWorkerInFlightAtFailure',
      'failedOpenPreviewUnchanged','failedOpenHistoryUnchanged',
      'originalSelectedOnly','originalAlphaUnchanged','originalHistoryOnce',
      'originalUndoExact','originalRedoExact','importedNativeDifferent',
      'importedHighDepth','importedNativeExact','importedPreviewDifferent',
      'importedHistoryClean','stableAfterImport','retrySelectedOnly',
      'retryAlphaUnchanged','retryHistoryOnce','retryUndoExact','retryRedoExact'])||
    v.failedOpenTabs!==1||v.originalWorkerJobs!==1||
    v.originalWorkerReplies!==1||
    ![0,1].includes(v.originalWorkerTerminations)||
    !Number.isSafeInteger(v.selectedPixels)||v.selectedPixels<1_900_000||
    v.selectedPixels>2_000_000||v.selectedBytes!==v.selectedPixels*4||
    v.importApprovedPrompts!==1||typeof v.importedName!=='string'||
    !v.importedName.endsWith(ext)||
    v.retrySelectedPixels!==v.selectedPixels||
    v.finalTabs!==1||v.finalWorkerJobs!==2||v.finalWorkerReplies!==2||
    !Number.isFinite(v.completionMs)||v.completionMs<=0||v.completionMs>205_000||
    !Number.isFinite(v.retryCompletionMs)||v.retryCompletionMs<=0||
    v.retryCompletionMs>205_000||
    !safeSamples(v.pulseIntervalsMs)||
    !safeHeap(v.heapBeforeBytes)||!safeHeap(v.heapAfterBytes)||
    v.workerPidMapping!=='unknown'||v.operationPeakKnown!==false||
    v.limitations!==BROWSER_DENSE_NATURAL_FAILED_IMPORT_LIMITATIONS)fail();
  return true;
}
export async function saveBrowserDenseNaturalFailedImportEvidence(v,dir){
  validateBrowserDenseNaturalFailedImportEvidence(v);
  if(!dir)return null;
  await mkdir(dir,{recursive:true});
  const filename=path.join(dir,'stage003-dense-natural-failed-import-'+v.format.toLowerCase()+'.json');
  await writeFile(filename,JSON.stringify(v,null,2)+'\n');
  return filename;
}
export async function verifyBrowserDenseNaturalFailedImportEvidence(dir){
  if(!dir)throw new TypeError('003W/2b-2i: missing evidence directory');
  for(const format of ['PSD16','PSB32']){
    const v=JSON.parse(await readFile(path.join(dir,
      'stage003-dense-natural-failed-import-'+format.toLowerCase()+'.json'),'utf8'));
    validateBrowserDenseNaturalFailedImportEvidence(v);
    if(v.format!==format)throw new TypeError('003W/2b-2i: wrong format');
  }
  return true;
}
