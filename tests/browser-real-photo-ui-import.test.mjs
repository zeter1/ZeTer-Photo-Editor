import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRealPhotoImportReceipt,validateRealPhotoImportReceiptSet}
  from '../tools/verify-browser-real-photo-import-artifacts.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
const formats={psd16:{bytes:16810260,bits:16,native:'rgb16',file:'psd16-defect.psd'},
  psb32:{bytes:33620288,bits:32,native:'float32',file:'psb32-defect.psb'}};
function receipt(format,runIndex){
  const f=formats[format];
  return {
    kind:'zpe-real-photo-browser-import-baseline-v1',
    status:'ui-import-and-save-native-baseline-verified',
    format,runIndex,protocol:'file:',
    inputFilename:f.file,inputFileSha256:pins.documents[format].fileSha256,
    inputBytes:f.bytes,sourcePhotoSha256:pins.sourceSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    rawNativeBytes:1025*1025*4*(f.bits/8),
    pixelCount:1025*1025,bitsPerChannel:f.bits,tileCount:9,
    inputNativeMatchedFrozenPin:true,publicSaveNativeMatchedFrozenPin:true,
    startedAtUnixMs:1000+runIndex+(format==='psb32'?10:0),
    importElapsedMs:25,totalElapsedMs:50,workerVerified:false,
    undoRedoVerified:false,realPhotoRepairQualityVerified:false,
    processPeakRssBytes:null,workerPidMapping:'unknown',
    photoshopCompatibilityVerified:false,
  };
}
test('037C-1: six separate photo-derived baseline import receipts are accepted',()=>{
  const r=Object.keys(formats).flatMap(key=>[1,2,3].map(i=>receipt(key,i)));
  assert.equal(validateRealPhotoImportReceiptSet(r,pins,manifest).runs,6);
});
test('037C-1: block unpinned native/photo hashes, unproven quality and missing sessions',()=>{
  for(const mutate of [
    r=>r.nativeDefectSha256='0'.repeat(64),
    r=>r.inputFileSha256='a'.repeat(64),
    r=>r.sourcePhotoSha256='0'.repeat(64),
    r=>r.inputBytes+=1,
    r=>r.rawNativeBytes-=4,
    r=>r.protocol='https:',
    r=>r.workerVerified=true,
    r=>r.undoRedoVerified=true,
    r=>r.realPhotoRepairQualityVerified=true,
    r=>r.processPeakRssBytes=0,
    r=>r.workerPidMapping='estimated',
    r=>r.totalElapsedMs=1,
    r=>r.tileCount=0,
  ]){
    const r=receipt('psd16',1);mutate(r);
    assert.throws(()=>validateRealPhotoImportReceipt(r,pins,manifest),
      /037C browser import receipts/);
  }
  const r=Object.keys(formats).flatMap(key=>[1,2,3].map(i=>receipt(key,i)));
  r[5]={...r[4]};
  assert.throws(()=>validateRealPhotoImportReceiptSet(r,pins,manifest),/duplicate/);
  assert.throws(()=>validateRealPhotoImportReceiptSet(r.slice(1),pins,manifest),/six runs/);
});
