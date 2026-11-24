import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateBrowserDenseImportEvidence } from './browser-dense-import-evidence.mjs';

// 003W/2b-2h: separate, strict receipt for a *real* malformed File Open while
// a native Worker still owns the original document, followed by explicit
// cancellation, byte-exact source readback and valid native import/retry.
const KEYS=[
  'kind','format','protocol','sourcePixels','malformedFilename','malformedBytes',
  'approvedPrompts','decodeFailed','oldWorkerRetained','nativeExact',
  'previewUnchanged','historyUnchanged','explicitCancelNoReply',
  'tabsAfterFailure','validImportAndRetry',
];

export function validateBrowserDenseFailedImportEvidence(v){
  const fail=()=>new TypeError('003W/2b-2h: invalid failed native import recovery evidence');
  if(!v||typeof v!=='object'||Array.isArray(v)||
    Object.keys(v).length!==KEYS.length||
    Object.keys(v).some(k=>!KEYS.includes(k))||
    v.kind!=='zpe-browser-dense-psd-import-failure-recovery-v1'||
    !['PSD16','PSB32'].includes(v.format)||v.protocol!=='file:'||
    v.sourcePixels!==2_030_000||
    v.malformedFilename!==('malformed-native-'+(v.format==='PSD16'?'psd.psd':'psb.psb'))||
    v.malformedBytes!==12||v.approvedPrompts!==1||
    ![v.decodeFailed,v.oldWorkerRetained,v.nativeExact,
      v.previewUnchanged,v.historyUnchanged,v.explicitCancelNoReply]
      .every(value=>value===true)||v.tabsAfterFailure!==1)throw fail();
  const retry=v.validImportAndRetry;
  if(!retry||retry.format!==v.format||retry.sourcePixels!==v.sourcePixels||
    retry.denialRetainedOwner!==false||retry.preDecodeRetainedWorker!==false||
    retry.originalTerminations!==1||retry.oldReplies!==0||
    retry.oldRepliesAfterSettle!==0)return (()=>{throw fail()})();
  // The legacy success validator expects an *in-flight* owner during valid
  // replacement. Here the test explicitly cancelled the original after the
  // bad import, so only those two time-specific booleans differ.
  try{
    validateBrowserDenseImportEvidence({
      ...retry,denialRetainedOwner:true,preDecodeRetainedWorker:true,
    });
  }catch{throw fail();}
  return true;
}

export async function saveBrowserDenseFailedImportEvidence(v,dir){
  validateBrowserDenseFailedImportEvidence(v);
  if(!dir)return null;
  await mkdir(dir,{recursive:true});
  const filename=path.join(dir,'stage003-dense-failed-import-'+v.format.toLowerCase()+'.json');
  await writeFile(filename,JSON.stringify(v,null,2)+'\n');
  return filename;
}

export async function verifyBrowserDenseFailedImportEvidence(dir){
  if(!dir)throw new TypeError('003W/2b-2h: missing evidence directory');
  for(const format of ['PSD16','PSB32']){
    const receipt=JSON.parse(await readFile(path.join(dir,
      'stage003-dense-failed-import-'+format.toLowerCase()+'.json'),'utf8'));
    validateBrowserDenseFailedImportEvidence(receipt);
    if(receipt.format!==format)throw new TypeError('003W/2b-2h: wrong format');
  }
  return true;
}
