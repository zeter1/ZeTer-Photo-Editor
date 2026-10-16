import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRealPhotoWorkerReceipt,validateRealPhotoWorkerReceiptSet}
  from '../tools/verify-browser-real-photo-worker-artifacts.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
function receipt(format,runIndex){
  const f=format==='psd16'?{bits:16,native:'rgb16'}:{bits:32,native:'float32'};
  return {
    kind:'zpe-real-photo-browser-native-worker-v1',
    status:'ui-worker-quality-undo-redo-reopen-verified',
    format,runIndex,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    sourcePhotoSha256:pins.sourceSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    cleanReferenceSha256:manifest.native[f.native].cleanSha256,
    bitsPerChannel:f.bits,selectedPixels:8288,
    changedSelectedPixels:7000,changedTiles:3,scoredSamples:8288*3,
    baseline:{mae:1,rmse:2,maxAbsoluteError:4},
    repaired:{mae:0.5,rmse:1,maxAbsoluteError:3},
    outsideSelectionAndAlphaNativeWordsExact:true,workerRequests:1,
    undoNativeBytesExact:true,redoNativeBytesExact:true,reopenNativeBytesExact:true,
    workerVerified:true,qualityVerified:true,undoRedoVerified:true,
    processPeakRssBytes:null,workerPidMapping:'unknown',
    photoshopCompatibilityVerified:false,sourcePrecisionBits:8,
    startedAtUnixMs:10_000+runIndex+(format==='psb32'?10:0),
    fillElapsedMs:100,totalElapsedMs:150,
  };
}
test('037C-2: accepts the six distinct pinned Chromium/photo Worker receipts',()=>{
  const set=['psd16','psb32'].flatMap(f=>[1,2,3].map(i=>receipt(f,i)));
  assert.equal(validateRealPhotoWorkerReceiptSet(set,pins,manifest).runs,6);
});
test('037C-2: rejects forged quality, missing Worker, native data, Undo/reopen and false peak RSS',()=>{
  const mutations=[
    r=>{r.protocol='https:';},r=>{r.workerRequests=0;},
    r=>{r.changedTiles=1;},r=>{r.selectedPixels=8192;},
    r=>{r.changedSelectedPixels=0;},r=>{r.bitsPerChannel=8;},
    r=>{r.cleanReferenceSha256='0'.repeat(64);},
    r=>{r.nativeDefectSha256='1'.repeat(64);},
    r=>{r.sourcePhotoSha256='2'.repeat(64);},
    r=>{r.repaired.mae=1.1;},r=>{r.repaired.rmse=3;},
    r=>{r.repaired.mae=NaN;},r=>{r.undoNativeBytesExact=false;},
    r=>{r.redoNativeBytesExact=false;},r=>{r.reopenNativeBytesExact=false;},
    r=>{r.outsideSelectionAndAlphaNativeWordsExact=false;},
    r=>{r.workerVerified=false;},r=>{r.qualityVerified=false;},
    r=>{r.processPeakRssBytes=0;},r=>{r.workerPidMapping='guessed';},
    r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.sourcePrecisionBits=16;},r=>{r.totalElapsedMs=10;},
  ];
  for(const modify of mutations){
    const r=receipt('psd16',1);modify(r);
    assert.throws(()=>validateRealPhotoWorkerReceipt(r,pins,manifest),/037C-2 Worker receipts/);
  }
});
test('037C-2: missing formats, duplicate runs and reused sessions fail closed',()=>{
  const all=['psd16','psb32'].flatMap(f=>[1,2,3].map(i=>receipt(f,i)));
  assert.throws(()=>validateRealPhotoWorkerReceiptSet(all.slice(1),pins,manifest),/six/);
  const same=all.map(x=>structuredClone(x));
  same[5]={...same[4]};
  assert.throws(()=>validateRealPhotoWorkerReceiptSet(same,pins,manifest),/duplicate/);
  const shared=all.map(x=>structuredClone(x));
  shared[0].startedAtUnixMs=shared[4].startedAtUnixMs;
  assert.throws(()=>validateRealPhotoWorkerReceiptSet(shared,pins,manifest),/duplicate/);
});
