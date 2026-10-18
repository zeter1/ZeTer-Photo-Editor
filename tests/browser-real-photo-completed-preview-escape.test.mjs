import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRealPhotoCompletedPreviewEscapeReceipt,validateRealPhotoCompletedPreviewEscapeSet}
  from '../tools/browser-real-photo-switch-failure.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
function sample(format,startedAtUnixMs){
  return {
    kind:'zpe-real-photo-browser-completed-preview-escape-v1',
    status:'public-escape-after-real-worker-reply-before-preview-publication',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:format==='psd16'?16:32,selectedPixels:8288,
    workerRequests:1,workerRepliesBeforeEscape:1,workerTerminationsBeforeEscape:1,
    workerTerminations:1,workerResultNativeSource:true,workerReplyFilled:8288,
    workerReplyChangedTiles:2,actualNativeWorkerJobDispatched:true,
    realWorkerResultReceivedBeforeEscape:true,previewTileWritesBeforeEscape:2,
    previewYieldHeldBeforeEscape:true,publicEscapeKeyDispatched:true,
    cancelStatusObserved:true,previewReleasedAfterEscape:true,
    originalNativeBytesUnchanged:true,originalHistoryUnchanged:true,
    secondTabHistoryUnchanged:true,fillHistoryEntries:0,
    completedWorkerPreviewRaceVerified:true,actualMidKernelCancellationVerified:false,
    memoryCapVerified:false,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:450,
  };
}
test('037C-3b-2b/3b-1 demands independent PSD16/PSB32 real Worker preview races',()=>{
  const result=validateRealPhotoCompletedPreviewEscapeSet([
    sample('psd16',12000),sample('psb32',24000)],pins,manifest);
  assert.equal(result.runs,2);
  assert.equal(result.completedWorkerPreviewRaceVerified,true);
  assert.throws(()=>validateRealPhotoCompletedPreviewEscapeSet([sample('psd16',12000)],pins,manifest),/independent/);
  assert.throws(()=>validateRealPhotoCompletedPreviewEscapeSet([
    sample('psd16',12000),sample('psd16',24000)],pins,manifest),/duplicate/);
  assert.throws(()=>validateRealPhotoCompletedPreviewEscapeSet([
    sample('psd16',12000),sample('psb32',12000)],pins,manifest),/duplicate/);
});
test('037C-3b-2b/3b-1 rejects fake Worker completion, timing, native bytes, history',()=>{
  const edits=[
    r=>{r.kind='zpe-real-photo-browser-mid-kernel-escape-v1';},
    r=>{r.status='public-escape-mid-kernel-terminated-no-publication';},
    r=>{r.runIndex=2;},r=>{r.protocol='https:';},
    r=>{r.inputFileSha256='0'.repeat(64);},r=>{r.nativeDefectSha256='f'.repeat(64);},
    r=>{r.sourcePhotoSha256='1'.repeat(64);},
    r=>{r.bitsPerChannel=8;},r=>{r.selectedPixels=100;},
    r=>{r.workerRequests=0;},r=>{r.workerRepliesBeforeEscape=0;},
    r=>{r.workerTerminationsBeforeEscape=0;},r=>{r.workerTerminations=2;},
    r=>{r.workerResultNativeSource=false;},r=>{r.workerReplyFilled=1;},
    r=>{r.workerReplyChangedTiles=1;},r=>{r.actualNativeWorkerJobDispatched=false;},
    r=>{r.realWorkerResultReceivedBeforeEscape=false;},
    r=>{r.previewTileWritesBeforeEscape=1;},r=>{r.previewYieldHeldBeforeEscape=false;},
    r=>{r.publicEscapeKeyDispatched=false;},r=>{r.cancelStatusObserved=false;},
    r=>{r.previewReleasedAfterEscape=false;},
    r=>{r.originalNativeBytesUnchanged=false;},r=>{r.originalHistoryUnchanged=false;},
    r=>{r.secondTabHistoryUnchanged=false;},r=>{r.fillHistoryEntries=1;},
    r=>{r.completedWorkerPreviewRaceVerified=false;},
    r=>{r.actualMidKernelCancellationVerified=true;},
    r=>{r.memoryCapVerified=true;},r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-1;},
  ];
  for(const edit of edits)for(const format of ['psd16','psb32']){
    const r=sample(format,18000);edit(r);
    assert.throws(()=>validateRealPhotoCompletedPreviewEscapeReceipt(r,pins,manifest),
      /037C-3b-2b\/3b-1/);
  }
});
