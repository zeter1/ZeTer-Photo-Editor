import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 003W/2b-2e: independent actual file:// dense Worker + dirty close refusal,
// confirmed owner removal, bounded survivor integrity and genuine dense retry.
const KEYS=[
  'kind','format','protocol','sourcePixels','tabsBefore','refusedPromptCount',
  'refusedTabs','refusedOwnerActive','refusedWorkerJobs','refusedWorkerReplies',
  'refusedWorkerTerminations','confirmedPromptCount','tabsAfterClose',
  'originalTabGone','remainingOwnerActive','selectedPixels','selectedBytes',
  'jobsBeforeClose','repliesBeforeClose','terminatedOnClose','repliesAfterSettling',
  'survivorNativeExact','survivorUiExact','settledNativeExact','settledUiExact',
  'dispatchToTerminationMs','closePulseIntervalsMs','heapBeforeBytes',
  'heapAfterBytes','successorSelectedPixels','successorSelectedBytes',
  'changedSelectedPixels','outsideSelectionUnchanged','alphaUnchanged',
  'retryHistoryOnce','undoExact','redoExact','finalTabs','finalWorkerJobs',
  'finalWorkerReplies','finalWorkerTerminations','retryCompletionMs',
  'retryPulseIntervalsMs','workerPidMapping','operationPeakKnown','limitations',
];
const LIMITATIONS='Genuine dirty-close refusal and confirmed in-flight dense Worker owner removal; sampled 8ms renderer timer and heap only, no isolated CPU, operation RSS peak, Worker PID or Photoshop-authored fixture.';
const isSamples=value=>Array.isArray(value)&&value.length<=256&&
  value.every(ms=>Number.isFinite(ms)&&ms>=0&&ms<=600_000);
const isHeap=value=>value===null||(Number.isSafeInteger(value)&&value>=0);
export function validateBrowserDenseCloseEvidence(value){
  const invalid=()=>new TypeError('003W/2b-2e: invalid dense Worker close evidence');
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==KEYS.length||
    Object.keys(value).some(key=>!KEYS.includes(key))||
    value.kind!=='zpe-browser-dense-owner-close-v1'||
    !['PSD16','PSB32'].includes(value.format)||value.protocol!=='file:'||
    value.sourcePixels!==2_030_000||value.tabsBefore!==2||
    value.refusedPromptCount!==1||value.refusedTabs!==2||
    value.refusedOwnerActive!==true||value.refusedWorkerJobs!==1||
    value.refusedWorkerReplies!==0||value.refusedWorkerTerminations!==0||
    value.confirmedPromptCount!==1||value.tabsAfterClose!==1||
    value.originalTabGone!==true||value.remainingOwnerActive!==true||
    !Number.isSafeInteger(value.selectedPixels)||
    value.selectedPixels<1_900_000||value.selectedPixels>2_000_000||
    value.selectedBytes!==value.selectedPixels*4||
    value.jobsBeforeClose!==1||value.repliesBeforeClose!==0||
    value.terminatedOnClose!==1||value.repliesAfterSettling!==0||
    ![value.survivorNativeExact,value.survivorUiExact,
      value.settledNativeExact,value.settledUiExact,
      value.outsideSelectionUnchanged,value.alphaUnchanged,
      value.retryHistoryOnce,value.undoExact,value.redoExact].every(v=>v===true)||
    !Number.isFinite(value.dispatchToTerminationMs)||
    value.dispatchToTerminationMs<0||value.dispatchToTerminationMs>=180_000||
    !isSamples(value.closePulseIntervalsMs)||
    !isHeap(value.heapBeforeBytes)||!isHeap(value.heapAfterBytes)||
    value.successorSelectedPixels!==value.selectedPixels||
    value.successorSelectedBytes!==value.selectedBytes||
    !Number.isSafeInteger(value.changedSelectedPixels)||
    value.changedSelectedPixels<1||value.changedSelectedPixels>value.selectedPixels||
    value.finalTabs!==1||value.finalWorkerJobs!==2||
    value.finalWorkerReplies!==1||
    ![1,2].includes(value.finalWorkerTerminations)||
    !Number.isFinite(value.retryCompletionMs)||
    value.retryCompletionMs<=0||value.retryCompletionMs>205_000||
    !isSamples(value.retryPulseIntervalsMs)||
    value.workerPidMapping!=='unknown'||value.operationPeakKnown!==false||
    value.limitations!==LIMITATIONS)throw invalid();
  return true;
}
export async function saveBrowserDenseCloseEvidence(value,directory){
  validateBrowserDenseCloseEvidence(value);
  if(!directory)return null;
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'stage003-dense-close-'+value.format.toLowerCase()+'.json');
  await writeFile(file,JSON.stringify(value,null,2)+'\n');
  return file;
}
export async function verifyBrowserDenseCloseEvidence(directory){
  if(!directory)throw new TypeError('003W/2b-2e: missing receipt directory');
  for(const format of ['PSD16','PSB32']){
    const content=JSON.parse(await readFile(path.join(directory,
      'stage003-dense-close-'+format.toLowerCase()+'.json'),'utf8'));
    validateBrowserDenseCloseEvidence(content);
    if(content.format!==format)throw new TypeError('003W/2b-2e: mismatched native format');
  }
  return true;
}
export const BROWSER_DENSE_CLOSE_LIMITATIONS=LIMITATIONS;
