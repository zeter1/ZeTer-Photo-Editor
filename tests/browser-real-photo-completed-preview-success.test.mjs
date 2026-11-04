import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRealPhotoCompletedPreviewSuccessReceipt,validateRealPhotoCompletedPreviewSuccessSet}
  from '../tools/browser-real-photo-switch-failure.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
function sample(format,startedAtUnixMs){
  return {
    kind:'zpe-real-photo-browser-preview-success-v1',
    status:'real-worker-published-before-public-escape',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:format==='psd16'?16:32,selectedPixels:8288,
    workerRequests:1,workerReplies:1,workerTerminations:1,
    workerResultNativeSource:true,workerReplyFilled:8288,workerReplyChangedTiles:2,
    previewTileWrites:2,previewYieldHeld:true,previewReleasedBeforeEscape:true,
    successStatusObserved:true,fillHistoryEntriesBeforeEscape:1,
    historyAddedExactlyOnce:true,nativeChangedTiles:2,
    publicEscapeKeyDispatched:true,cancelStatusObservedAfterEscape:false,
    committedNativeBytesSurvivedEscape:true,committedHistorySurvivedEscape:true,
    secondTabHistoryUnchanged:true,fillHistoryEntriesAfterEscape:1,
    successFirstVerified:true,cancelFirstVerified:false,
    memoryCapVerified:false,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:500,
  };
}
test('037C-3b-2b/3b-2a requires two distinct real-photo success-first native formats',()=>{
  const result=validateRealPhotoCompletedPreviewSuccessSet([
    sample('psd16',1000),sample('psb32',2000)],pins,manifest);
  assert.equal(result.successFirstVerified,true);
  assert.deepEqual(result.formats,['psb32','psd16']);
  assert.throws(()=>validateRealPhotoCompletedPreviewSuccessSet([sample('psd16',1000)],pins,manifest),/independent/);
  assert.throws(()=>validateRealPhotoCompletedPreviewSuccessSet([
    sample('psd16',1000),sample('psd16',2000)],pins,manifest),/duplicate/);
  assert.throws(()=>validateRealPhotoCompletedPreviewSuccessSet([
    sample('psd16',1000),sample('psb32',1000)],pins,manifest),/duplicate/);
});
test('037C-3b-2b/3b-2a rejects false success, stale native or History claims',()=>{
  const edits=[
    r=>{r.kind='zpe-real-photo-browser-completed-preview-escape-v1';},
    r=>{r.status='public-escape-after-real-worker-reply-before-preview-publication';},
    r=>{r.runIndex=2;},r=>{r.protocol='https:';},
    r=>{r.inputFileSha256='0'.repeat(64);},r=>{r.nativeDefectSha256='f'.repeat(64);},
    r=>{r.sourcePhotoSha256='0'.repeat(64);},r=>{r.bitsPerChannel=8;},
    r=>{r.selectedPixels=0;},r=>{r.workerRequests=0;},r=>{r.workerReplies=0;},
    r=>{r.workerTerminations=2;},r=>{r.workerResultNativeSource=false;},
    r=>{r.workerReplyFilled=1;},r=>{r.workerReplyChangedTiles=1;},
    r=>{r.previewTileWrites=1;},r=>{r.previewYieldHeld=false;},
    r=>{r.previewReleasedBeforeEscape=false;},r=>{r.successStatusObserved=false;},
    r=>{r.fillHistoryEntriesBeforeEscape=0;},r=>{r.historyAddedExactlyOnce=false;},
    r=>{r.nativeChangedTiles=0;},r=>{r.publicEscapeKeyDispatched=false;},
    r=>{r.cancelStatusObservedAfterEscape=true;},
    r=>{r.committedNativeBytesSurvivedEscape=false;},
    r=>{r.committedHistorySurvivedEscape=false;},
    r=>{r.secondTabHistoryUnchanged=false;},r=>{r.fillHistoryEntriesAfterEscape=0;},
    r=>{r.successFirstVerified=false;},r=>{r.cancelFirstVerified=true;},
    r=>{r.memoryCapVerified=true;},r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-2;},
  ];
  for(const edit of edits)for(const format of ['psd16','psb32']){
    const r=sample(format,3000);edit(r);
    assert.throws(()=>validateRealPhotoCompletedPreviewSuccessReceipt(r,pins,manifest),
      /037C-3b-2b\/3b-2a/);
  }
});
