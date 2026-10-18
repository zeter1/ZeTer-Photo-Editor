import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateRealPhotoMalformedExtraReceipt,validateRealPhotoMalformedExtraSet}
  from '../tools/browser-real-photo-switch-failure.mjs';
import {verifyRealPhotoMalformedExtraFiles}
  from '../tools/verify-browser-real-photo-malformed-extra-artifacts.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
const scenarios=[['psd16','outside'],['psb32','outside'],
  ['psb32','nonfinite-nan'],['psb32','nonfinite-infinity']];
function sample(format,kind,startedAtUnixMs){
  return {
    kind:'zpe-real-photo-browser-malformed-extra-v1',
    status:'native-worker-malformed-extra-rejected-by-public-ui',
    malformedKind:kind,format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:format==='psd16'?16:32,selectedPixels:8288,
    workerRequests:1,workerReplies:1,workerTerminations:1,
    selectionMatched:true,realWorkerNativeResultObserved:true,
    realWorkerReplyFilled:8288,realWorkerChangedTiles:2,
    transportMutation:kind==='outside'?'outside-roi-color-byte':
      kind==='nonfinite-nan'?'selected-color-nan':'selected-color-infinity',
    mutatedBeforeUiValidation:true,selectedAlphaByteCorrupted:false,
    counterCorrupted:false,outsideRoiByteCorrupted:kind==='outside',
    nonfiniteColorSample:kind==='nonfinite-nan'?'nan':
      kind==='nonfinite-infinity'?'infinity':'none',
    publicInvalidWorkerStatusObserved:true,privatePreviewTileWrites:0,
    nativeBytesUnchanged:true,originalHistoryUnchanged:true,
    fillHistoryEntries:0,secondTabHistoryUnchanged:true,
    maxBytesVerified:false,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:100,
  };
}
const set=()=>scenarios.map(([format,kind],i)=>sample(format,kind,(i+1)*1000));

test('037C-3b-3/2b-2 requires four independent genuine-photo receipts',()=>{
  assert.equal(validateRealPhotoMalformedExtraSet(set(),pins,manifest).runs,4);
  assert.throws(()=>validateRealPhotoMalformedExtraSet(set().slice(1),pins,manifest),/four independent/);
  const dup=set();dup[3]=structuredClone(dup[2]);
  assert.throws(()=>validateRealPhotoMalformedExtraSet(dup,pins,manifest),/duplicate/);
  const same=set();same[3].startedAtUnixMs=1000;
  assert.throws(()=>validateRealPhotoMalformedExtraSet(same,pins,manifest),/duplicate/);
});
test('037C-3b-3/2b-2 rejects forged Worker, native and UI proofs',()=>{
  const edits=[
    r=>{r.kind='wrong';},r=>{r.status='success';},r=>{r.protocol='http:';},
    r=>{r.inputFileSha256='0'.repeat(64);},r=>{r.nativeDefectSha256='f'.repeat(64);},
    r=>{r.sourcePhotoSha256='0'.repeat(64);},r=>{r.selectedPixels=42;},
    r=>{r.workerRequests=0;},r=>{r.workerReplies=0;},r=>{r.workerTerminations=0;},
    r=>{r.selectionMatched=false;},r=>{r.realWorkerNativeResultObserved=false;},
    r=>{r.realWorkerReplyFilled=1;},r=>{r.realWorkerChangedTiles=1;},
    r=>{r.transportMutation='none';},r=>{r.mutatedBeforeUiValidation=false;},
    r=>{r.selectedAlphaByteCorrupted=true;},r=>{r.counterCorrupted=true;},
    r=>{r.outsideRoiByteCorrupted=!r.outsideRoiByteCorrupted;},
    r=>{r.nonfiniteColorSample='wrong';},r=>{r.publicInvalidWorkerStatusObserved=false;},
    r=>{r.privatePreviewTileWrites=1;},r=>{r.nativeBytesUnchanged=false;},
    r=>{r.originalHistoryUnchanged=false;},r=>{r.fillHistoryEntries=1;},
    r=>{r.secondTabHistoryUnchanged=false;},r=>{r.maxBytesVerified=true;},
    r=>{r.photoshopCompatibilityVerified=true;},r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-1;},
  ];
  for(const [format,kind] of scenarios)for(const edit of edits){
    const r=sample(format,kind,1000);edit(r);
    assert.throws(()=>validateRealPhotoMalformedExtraReceipt(r,pins,manifest),/037C-3b-3\/2b-2/);
  }
  assert.throws(()=>validateRealPhotoMalformedExtraReceipt(sample('psd16','nonfinite-nan',1000),pins,manifest),/037C-3b-3\/2b-2/);
});
test('037C-3b-3/2b-2 offline verifier refuses missing and stray receipts',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'zpe-malformed-extra-'));
  try{
    for(const [i,[format,kind]] of scenarios.entries())
      await writeFile(path.join(dir,'real-photo-'+format+'-malformed-'+kind+'-run-1.json'),
        JSON.stringify(sample(format,kind,(i+1)*1000)));
    assert.equal((await verifyRealPhotoMalformedExtraFiles(dir)).runs,4);
    await writeFile(path.join(dir,'real-photo-psd16-malformed-alpha-run-1.json'),'{}');
    await assert.rejects(verifyRealPhotoMalformedExtraFiles(dir),/unexpected receipts/);
    await rm(path.join(dir,'real-photo-psd16-malformed-alpha-run-1.json'));
    await rm(path.join(dir,'real-photo-psb32-malformed-outside-run-1.json'));
    await assert.rejects(verifyRealPhotoMalformedExtraFiles(dir),/unexpected receipts/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
