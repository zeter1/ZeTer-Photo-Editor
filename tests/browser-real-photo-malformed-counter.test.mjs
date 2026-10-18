import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateRealPhotoMalformedCounterReceipt,validateRealPhotoMalformedCounterSet}
  from '../tools/browser-real-photo-switch-failure.mjs';
import {verifyRealPhotoMalformedCounterFiles}
  from '../tools/verify-browser-real-photo-malformed-counter-artifacts.mjs';
const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
function sample(format,startedAtUnixMs){
  return {
    kind:'zpe-real-photo-browser-malformed-counter-v1',
    status:'native-worker-counter-corrupted-rejected-by-public-ui',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:format==='psd16'?16:32,selectedPixels:8288,
    workerRequests:1,workerReplies:1,workerTerminations:1,
    selectionMatched:true,realWorkerNativeResultObserved:true,
    realWorkerReplyFilled:8288,realWorkerChangedTiles:2,
    realWorkerReplyChanged:4000,mutatedChangedCount:3999,
    transportMutation:'changed-count-minus-one',
    mutatedBeforeUiValidation:true,counterCorrupted:true,
    selectedAlphaByteCorrupted:false,publicInvalidWorkerStatusObserved:true,
    privatePreviewTileWrites:0,nativeBytesUnchanged:true,
    originalHistoryUnchanged:true,fillHistoryEntries:0,
    secondTabHistoryUnchanged:true,maxBytesVerified:false,
    photoshopCompatibilityVerified:false,startedAtUnixMs,elapsedMs:500,
  };
}
test('037C-3b-3/2b-1 verifies independent pinned photo counter receipts',()=>{
  const pair=[sample('psd16',1000),sample('psb32',2000)];
  assert.deepEqual(validateRealPhotoMalformedCounterSet(pair,pins,manifest).formats,['psb32','psd16']);
  assert.throws(()=>validateRealPhotoMalformedCounterSet([pair[0]],pins,manifest),/independent/);
  assert.throws(()=>validateRealPhotoMalformedCounterSet([pair[0],pair[0]],pins,manifest),/duplicate/);
  assert.throws(()=>validateRealPhotoMalformedCounterSet([pair[0],sample('psb32',1000)],pins,manifest),/duplicate/);
});
test('037C-3b-3/2b-1 rejects forged worker, counter and no-publication claims',()=>{
  const edits=[
    r=>{r.kind='wrong';},r=>{r.status='success';},r=>{r.protocol='http:';},
    r=>{r.inputFileSha256='0'.repeat(64);},r=>{r.nativeDefectSha256='0'.repeat(64);},
    r=>{r.sourcePhotoSha256='f'.repeat(64);},r=>{r.bitsPerChannel=8;},
    r=>{r.selectedPixels=42;},r=>{r.workerRequests=0;},r=>{r.workerReplies=0;},
    r=>{r.workerTerminations=0;},r=>{r.selectionMatched=false;},
    r=>{r.realWorkerNativeResultObserved=false;},r=>{r.realWorkerReplyFilled=1;},
    r=>{r.realWorkerChangedTiles=1;},r=>{r.realWorkerReplyChanged=1;},
    r=>{r.realWorkerReplyChanged=8289;},r=>{r.mutatedChangedCount=3998;},
    r=>{r.transportMutation='selected-alpha-one-byte';},r=>{r.counterCorrupted=false;},
    r=>{r.selectedAlphaByteCorrupted=true;},r=>{r.mutatedBeforeUiValidation=false;},
    r=>{r.publicInvalidWorkerStatusObserved=false;},r=>{r.privatePreviewTileWrites=1;},
    r=>{r.nativeBytesUnchanged=false;},r=>{r.originalHistoryUnchanged=false;},
    r=>{r.fillHistoryEntries=1;},r=>{r.secondTabHistoryUnchanged=false;},
    r=>{r.maxBytesVerified=true;},r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-1;},
  ];
  for(const format of ['psd16','psb32'])for(const change of edits){
    const r=sample(format,1000);change(r);
    assert.throws(()=>validateRealPhotoMalformedCounterReceipt(r,pins,manifest),/037C-3b-3\/2b-1/);
  }
});
test('037C-3b-3/2b-1 offline verifier rejects stray/missing receipts',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'zpe-counter-photo-'));
  try{
    for(const format of ['psd16','psb32'])
      await writeFile(path.join(dir,'real-photo-'+format+'-malformed-counter-run-1.json'),
        JSON.stringify(sample(format,format==='psd16'?1000:2000)));
    assert.equal((await verifyRealPhotoMalformedCounterFiles(dir)).runs,2);
    await writeFile(path.join(dir,'real-photo-psd16-malformed-counter-run-2.json'),'{}');
    await assert.rejects(verifyRealPhotoMalformedCounterFiles(dir),/unexpected receipts/);
    await rm(path.join(dir,'real-photo-psd16-malformed-counter-run-2.json'));
    await rm(path.join(dir,'real-photo-psb32-malformed-counter-run-1.json'));
    await assert.rejects(verifyRealPhotoMalformedCounterFiles(dir),/unexpected receipts/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
