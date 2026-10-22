import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 003W/2b-2d: independently read two real Chromium file:// PSD16/PSB32
// receipts. Typed selections, tab switch, stale-result isolation and retry.
const KEYS=[
  'kind','format','protocol','tabs','sourcePixels','selectedPixels','selectedBytes',
  'workerJobs','repliesBeforeSwitch','terminatedOnSwitch','repliesAfterSettling',
  'originalNativeExact','originalUiExact','survivorNativeExact','survivorUiExact',
  'dispatchToTerminationMs','pulseIntervalsMs','heapBeforeBytes','heapAfterBytes',
  'successorSelectedPixels','successorSelectedBytes','changedSelectedPixels',
  'outsideSelectionUnchanged','alphaUnchanged','retryHistoryOnce','undoExact',
  'redoExact','originalFinalExact','retryCompletionMs','retryPulseIntervalsMs',
  'finalWorkerJobs','finalWorkerReplies','finalWorkerTerminations','limitations',
];
const LIMITATIONS='Genuine two-tab dense Worker switch and retry; bounded browser timer/heap only, no isolated CPU, operation RSS peak, Worker PID or Photoshop-authored fixture.';
const isSamples=value=>Array.isArray(value)&&value.length<=256&&
  value.every(ms=>Number.isFinite(ms)&&ms>=0&&ms<=600_000);
const isHeap=value=>value===null||(Number.isSafeInteger(value)&&value>=0);

export function validateBrowserDenseOwnerEvidence(value){
  const invalid=()=>new TypeError('003W/2b-2d: invalid native cross-tab Worker evidence');
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==KEYS.length||
    Object.keys(value).some(key=>!KEYS.includes(key))||
    value.kind!=='zpe-browser-dense-owner-switch-v1'||
    !['PSD16','PSB32'].includes(value.format)||value.protocol!=='file:'||
    value.tabs!==2||value.sourcePixels!==2_030_000||
    !Number.isSafeInteger(value.selectedPixels)||
    value.selectedPixels<1_900_000||value.selectedPixels>2_000_000||
    value.selectedBytes!==value.selectedPixels*4||
    value.workerJobs!==1||value.repliesBeforeSwitch!==0||
    value.terminatedOnSwitch!==1||value.repliesAfterSettling!==0||
    ![value.originalNativeExact,value.originalUiExact,
      value.survivorNativeExact,value.survivorUiExact,value.originalFinalExact,
      value.outsideSelectionUnchanged,value.alphaUnchanged,value.retryHistoryOnce,
      value.undoExact,value.redoExact].every(v=>v===true)||
    !Number.isFinite(value.dispatchToTerminationMs)||
    value.dispatchToTerminationMs<0||value.dispatchToTerminationMs>=180_000||
    !isSamples(value.pulseIntervalsMs)||
    !isHeap(value.heapBeforeBytes)||!isHeap(value.heapAfterBytes)||
    value.successorSelectedPixels!==value.selectedPixels||
    value.successorSelectedBytes!==value.selectedBytes||
    !Number.isSafeInteger(value.changedSelectedPixels)||
    value.changedSelectedPixels<1||value.changedSelectedPixels>value.selectedPixels||
    !Number.isFinite(value.retryCompletionMs)||
    value.retryCompletionMs<=0||value.retryCompletionMs>205_000||
    !isSamples(value.retryPulseIntervalsMs)||
    value.finalWorkerJobs!==2||value.finalWorkerReplies!==1||
    (value.finalWorkerTerminations!==1&&value.finalWorkerTerminations!==2)||
    value.limitations!==LIMITATIONS)throw invalid();
  return true;
}
export async function saveBrowserDenseOwnerEvidence(value,directory){
  validateBrowserDenseOwnerEvidence(value);
  if(!directory)return null;
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'stage003-dense-owner-'+value.format.toLowerCase()+'.json');
  await writeFile(file,JSON.stringify(value,null,2)+'\n');
  return file;
}
export async function verifyBrowserDenseOwnerEvidence(directory){
  if(!directory)throw new TypeError('003W/2b-2d: missing receipt directory');
  for(const format of ['PSD16','PSB32']){
    const content=JSON.parse(await readFile(path.join(directory,
      'stage003-dense-owner-'+format.toLowerCase()+'.json'),'utf8'));
    validateBrowserDenseOwnerEvidence(content);
    if(content.format!==format)throw new TypeError('003W/2b-2d: mismatched native format');
  }
  return true;
}
export const BROWSER_DENSE_OWNER_LIMITATIONS=LIMITATIONS;
