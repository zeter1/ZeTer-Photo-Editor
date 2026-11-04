import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 003W/2b-2g: unlike File New, an imported native Photoshop source must own
// the replacement and a second genuine dense production Worker.
const KEYS=[
  'kind','format','protocol','sourcePixels','marqueeBoundingPixels',
  'selectedPixels','selectedBytes','deniedPrompts','approvedPrompts',
  'denialRetainedOwner','deniedPreviewUnchanged','deniedHistoryUnchanged',
  'preDecodeRetainedWorker','originalName',
  'replacementName','importedNativeDifferent','importedHighDepth',
  'importedPreviewDifferent',
  'importedNativeExact','importedHistoryClean','stableAfterSettle',
  'originalTerminations','oldReplies','oldRepliesAfterSettle',
  'retrySelectedPixels','retrySelectedBytes','changedSelectedPixels',
  'outsideUnchanged','alphaUnchanged','historyOnce','undoExact','redoExact',
  'finalTabs','finalWorkerJobs','finalWorkerReplies',
  'firstDispatchToTerminationMs','retryCompletionMs',
  'cancelPulseIntervalsMs','retryPulseIntervalsMs',
  'heapBeforeBytes','heapAfterBytes','workerPidMapping','operationPeakKnown',
  'limitations',
];
const LIMITATIONS="Real File Open PSD/PSB approved replacement of distinct native source during in-flight dense Worker on Chromium file://; sampled renderer timer and JS heap only; no operation-exclusive CPU/RSS peak, Worker PID or independently Photoshop-authored PSB32 provenance.";
const sample=v=>Array.isArray(v)&&v.length<=256&&
  v.every(x=>Number.isFinite(x)&&x>=0&&x<=600_000);
const heap=v=>v===null||(Number.isSafeInteger(v)&&v>=0);

export function validateBrowserDenseImportEvidence(v){
  const error=()=>new TypeError('003W/2b-2g: invalid dense PSD/PSB import replacement evidence');
  const nativeExt=v?.format==='PSD16'?'.psd':'.psb';
  if(!v||typeof v!=='object'||Array.isArray(v)||
    Object.keys(v).length!==KEYS.length||Object.keys(v).some(k=>!KEYS.includes(k))||
    v.kind!=='zpe-browser-dense-psd-import-replacement-v1'||
    !['PSD16','PSB32'].includes(v.format)||v.protocol!=='file:'||
    v.sourcePixels!==2_030_000||
    !Number.isSafeInteger(v.marqueeBoundingPixels)||
    v.marqueeBoundingPixels<1_900_000||v.marqueeBoundingPixels>2_000_000||
    !Number.isSafeInteger(v.selectedPixels)||
    v.selectedPixels<1_900_000||v.selectedPixels>2_000_000||
    v.selectedBytes!==v.selectedPixels*4||
    v.deniedPrompts!==1||v.approvedPrompts!==1||
    v.denialRetainedOwner!==true||
    v.deniedPreviewUnchanged!==true||v.deniedHistoryUnchanged!==true||
    v.preDecodeRetainedWorker!==true||
    typeof v.originalName!=='string'||!v.originalName.endsWith(nativeExt)||
    typeof v.replacementName!=='string'||!v.replacementName.endsWith(nativeExt)||
    v.originalName===v.replacementName||
    ![v.importedNativeDifferent,v.importedHighDepth,v.importedNativeExact,
      v.importedPreviewDifferent,
      v.importedHistoryClean,v.stableAfterSettle].every(x=>x===true)||
    v.originalTerminations!==1||v.oldReplies!==0||v.oldRepliesAfterSettle!==0||
    v.retrySelectedPixels!==v.selectedPixels||
    v.retrySelectedBytes!==v.selectedBytes||
    !Number.isSafeInteger(v.changedSelectedPixels)||v.changedSelectedPixels<=0||
    v.changedSelectedPixels>v.selectedPixels||
    ![v.outsideUnchanged,v.alphaUnchanged,v.historyOnce,v.undoExact,
      v.redoExact].every(x=>x===true)||
    v.finalTabs!==1||v.finalWorkerJobs!==2||v.finalWorkerReplies!==1||
    !Number.isFinite(v.firstDispatchToTerminationMs)||
    v.firstDispatchToTerminationMs<0||v.firstDispatchToTerminationMs>=180_000||
    !Number.isFinite(v.retryCompletionMs)||v.retryCompletionMs<=0||
    v.retryCompletionMs>205_000||
    !sample(v.cancelPulseIntervalsMs)||!sample(v.retryPulseIntervalsMs)||
    !heap(v.heapBeforeBytes)||!heap(v.heapAfterBytes)||
    v.workerPidMapping!=='unknown'||v.operationPeakKnown!==false||
    v.limitations!==LIMITATIONS)throw error();
  return true;
}

export async function saveBrowserDenseImportEvidence(v,dir){
  validateBrowserDenseImportEvidence(v);
  if(!dir)return null;
  await mkdir(dir,{recursive:true});
  const filename=path.join(dir,'stage003-dense-import-'+v.format.toLowerCase()+'.json');
  await writeFile(filename,JSON.stringify(v,null,2)+'\n');
  return filename;
}

export async function verifyBrowserDenseImportEvidence(dir){
  if(!dir)throw new TypeError('003W/2b-2g: missing evidence directory');
  for(const format of ['PSD16','PSB32']){
    const v=JSON.parse(await readFile(path.join(dir,
      'stage003-dense-import-'+format.toLowerCase()+'.json'),'utf8'));
    validateBrowserDenseImportEvidence(v);
    if(v.format!==format)throw new TypeError('003W/2b-2g: wrong format');
  }
  return true;
}
export const BROWSER_DENSE_IMPORT_LIMITATIONS=LIMITATIONS;
