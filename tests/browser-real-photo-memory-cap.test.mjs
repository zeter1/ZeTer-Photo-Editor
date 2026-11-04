import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateRealPhotoMemoryCapReceipt,validateRealPhotoMemoryCapSet}
  from '../tools/browser-real-photo-switch-failure.mjs';
import {verifyRealPhotoMemoryCapFiles}
  from '../tools/verify-browser-real-photo-memory-cap-artifacts.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
function sample(format,startedAtUnixMs){
  const bits=format==='psd16'?16:32,rawBytes=1025*1025*4*bits/8;
  return {
    kind:'zpe-real-photo-browser-memory-cap-v1',
    status:'public-cap-refusal-real-worker-retry',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:bits,selectedPixels:8288,rawBytes,
    refusedMaxBytes:rawBytes-1,recoveredMaxBytes:rawBytes,
    publicDuplicates:format==='psd16'?5:2,
    budgetErrorObserved:true,refusalWorkerRequests:0,
    refusalNativeBytesUnchanged:true,refusalHistoryUnchanged:true,
    refusalFillHistoryEntries:0,
    retryWorkerRequests:1,retryWorkerReplies:1,retryNativeResultObserved:true,
    retrySelectionMatched:true,retryFilled:8288,retryChangedTiles:2,
    retryNativeBytesChanged:true,retryFillHistoryAdded:1,
    secondTabHistoryUnchanged:true,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:100,
  };
}
const set=()=>[sample('psd16',1000),sample('psb32',2000)];
test('037C-3b-3/2b-2 requires independent PSD16 and PSB32 memory-cap receipts',()=>{
  assert.equal(validateRealPhotoMemoryCapSet(set(),pins,manifest).runs,2);
  assert.throws(()=>validateRealPhotoMemoryCapSet(set().slice(1),pins,manifest),/two isolated/);
  const duplicate=set();duplicate[1]=structuredClone(duplicate[0]);
  assert.throws(()=>validateRealPhotoMemoryCapSet(duplicate,pins,manifest),/duplicate/);
  const sameTime=set();sameTime[1].startedAtUnixMs=1000;
  assert.throws(()=>validateRealPhotoMemoryCapSet(sameTime,pins,manifest),/duplicate/);
});
test('037C-3b-3/2b-2 rejects forged byte budget / Worker / persistence evidence',()=>{
  const tamper=[
    r=>{r.kind='other';},r=>{r.status='success';},r=>{r.protocol='http:';},
    r=>{r.inputFileSha256='0'.repeat(64);},r=>{r.nativeDefectSha256='0'.repeat(64);},
    r=>{r.sourcePhotoSha256='0'.repeat(64);},r=>{r.selectedPixels=1;},
    r=>{r.rawBytes--;},r=>{r.refusedMaxBytes=r.rawBytes;},
    r=>{r.refusedMaxBytes=-1;},r=>{r.recoveredMaxBytes=r.rawBytes-1;},
    r=>{r.publicDuplicates=0;},r=>{r.budgetErrorObserved=false;},
    r=>{r.refusalWorkerRequests=1;},r=>{r.refusalNativeBytesUnchanged=false;},
    r=>{r.refusalHistoryUnchanged=false;},r=>{r.refusalFillHistoryEntries=1;},
    r=>{r.retryWorkerRequests=0;},r=>{r.retryWorkerReplies=0;},
    r=>{r.retryNativeResultObserved=false;},r=>{r.retrySelectionMatched=false;},
    r=>{r.retryFilled=0;},r=>{r.retryChangedTiles=1;},
    r=>{r.retryNativeBytesChanged=false;},r=>{r.retryFillHistoryAdded=0;},
    r=>{r.secondTabHistoryUnchanged=false;},
    r=>{r.photoshopCompatibilityVerified=true;},r=>{r.startedAtUnixMs=0;},
    r=>{r.elapsedMs=-1;},
  ];
  for(const format of ['psd16','psb32'])for(const change of tamper){
    const r=sample(format,1000);change(r);
    assert.throws(()=>validateRealPhotoMemoryCapReceipt(r,pins,manifest),/037C-3b-3\/2b-2/);
  }
});
test('037C-3b-3/2b-2 verifier refuses missing, stray or mismatched cap artifacts',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'zpe-photo-cap-'));
  try{
    for(const [i,format] of ['psd16','psb32'].entries())
      await writeFile(path.join(dir,'real-photo-'+format+'-memory-cap-run-1.json'),
        JSON.stringify(sample(format,(i+1)*1000)));
    assert.equal((await verifyRealPhotoMemoryCapFiles(dir)).runs,2);
    await writeFile(path.join(dir,'real-photo-psd16-memory-cap-run-2.json'),'{}');
    await assert.rejects(verifyRealPhotoMemoryCapFiles(dir),/unexpected/);
    await rm(path.join(dir,'real-photo-psd16-memory-cap-run-2.json'));
    await rm(path.join(dir,'real-photo-psb32-memory-cap-run-1.json'));
    await assert.rejects(verifyRealPhotoMemoryCapFiles(dir),/unexpected/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
