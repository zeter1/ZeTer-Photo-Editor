import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  validateRealPhotoMalformedReplyReceipt,
  validateRealPhotoMalformedReplySet,
} from '../tools/browser-real-photo-switch-failure.mjs';
import {verifyRealPhotoMalformedAlphaFiles} from '../tools/verify-browser-real-photo-malformed-alpha-artifacts.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));

function sample(format,startedAtUnixMs){
  return {
    kind:'zpe-real-photo-browser-malformed-alpha-v1',
    status:'native-worker-alpha-corrupted-rejected-by-public-ui',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:format==='psd16'?16:32,
    selectedPixels:8288,workerRequests:1,workerReplies:1,workerTerminations:1,
    selectionMatched:true,realWorkerNativeResultObserved:true,
    realWorkerReplyFilled:8288,realWorkerChangedTiles:2,
    transportMutation:'selected-alpha-one-byte',
    mutatedBeforeUiValidation:true,selectedAlphaByteCorrupted:true,
    publicInvalidWorkerStatusObserved:true,privatePreviewTileWrites:0,
    nativeBytesUnchanged:true,originalHistoryUnchanged:true,
    fillHistoryEntries:0,secondTabHistoryUnchanged:true,
    maxBytesVerified:false,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:500,
  };
}

test('037C-3b-3/2a verifies independent genuine-photo formats and sessions',()=>{
  const pair=[sample('psd16',1000),sample('psb32',2000)];
  assert.deepEqual(validateRealPhotoMalformedReplySet(pair,pins,manifest).formats,['psb32','psd16']);
  assert.throws(()=>validateRealPhotoMalformedReplySet([pair[0]],pins,manifest),/independent/);
  assert.throws(()=>validateRealPhotoMalformedReplySet([pair[0],pair[0]],pins,manifest),/duplicate/);
  assert.throws(()=>validateRealPhotoMalformedReplySet([pair[0],sample('psb32',1000)],pins,manifest),/duplicate/);
});

test('037C-3b-3/2a rejects tampered native, transport and no-publication claims',()=>{
  const edits=[
    r=>{r.kind='unrelated';},r=>{r.status='success';},
    r=>{r.format='psd8';},r=>{r.runIndex=2;},r=>{r.protocol='http:';},
    r=>{r.inputFileSha256='f'.repeat(64);},
    r=>{r.nativeDefectSha256='0'.repeat(64);},
    r=>{r.sourcePhotoSha256='0'.repeat(64);},
    r=>{r.bitsPerChannel=8;},r=>{r.selectedPixels=2;},
    r=>{r.workerRequests=0;},r=>{r.workerReplies=0;},r=>{r.workerTerminations=0;},
    r=>{r.selectionMatched=false;},r=>{r.realWorkerNativeResultObserved=false;},
    r=>{r.realWorkerReplyFilled=1;},r=>{r.realWorkerChangedTiles=0;},
    r=>{r.transportMutation='counter-only';},
    r=>{r.mutatedBeforeUiValidation=false;},r=>{r.selectedAlphaByteCorrupted=false;},
    r=>{r.publicInvalidWorkerStatusObserved=false;},r=>{r.privatePreviewTileWrites=1;},
    r=>{r.nativeBytesUnchanged=false;},r=>{r.originalHistoryUnchanged=false;},
    r=>{r.fillHistoryEntries=1;},r=>{r.secondTabHistoryUnchanged=false;},
    r=>{r.maxBytesVerified=true;},r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-1;},
  ];
  for(const format of ['psd16','psb32'])for(const edit of edits){
    const receipt=sample(format,3000);
    edit(receipt);
    assert.throws(()=>validateRealPhotoMalformedReplyReceipt(receipt,pins,manifest),
      /037C-3b-3\/2a/);
  }
});

test('037C-3b-3/2a offline verifier rejects stray, missing and renamed receipts',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'zpe-malformed-photo-'));
  try{
    for(const format of ['psd16','psb32']){
      await writeFile(path.join(dir,'real-photo-'+format+'-malformed-alpha-run-1.json'),
        JSON.stringify(sample(format,format==='psd16'?1000:2000)));
    }
    assert.equal((await verifyRealPhotoMalformedAlphaFiles(dir)).runs,2);
    await writeFile(path.join(dir,'real-photo-psd16-malformed-alpha-run-2.json'),'{}');
    await assert.rejects(verifyRealPhotoMalformedAlphaFiles(dir),/unexpected receipts/);
    await rm(path.join(dir,'real-photo-psd16-malformed-alpha-run-2.json'));
    await rm(path.join(dir,'real-photo-psb32-malformed-alpha-run-1.json'));
    await assert.rejects(verifyRealPhotoMalformedAlphaFiles(dir),/unexpected receipts/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
