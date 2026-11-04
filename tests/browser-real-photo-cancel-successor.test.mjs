import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRealPhotoCancelSuccessorReceipt,validateRealPhotoCancelSuccessorSet}
  from '../tools/browser-real-photo-switch-failure.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
function sample(format,startedAtUnixMs){
  return {
    kind:'zpe-real-photo-browser-cancel-successor-v1',
    status:'public-cancel-first-successor-worker-committed-late-ignored',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:format==='psd16'?16:32,selectedPixels:8288,
    workerRequests:2,workerReplies:2,workerTerminations:2,
    firstWorkerNativeSource:true,firstWorkerReplyFilled:8288,
    firstWorkerChangedTiles:2,firstPreviewTileWrites:2,
    firstPreviewYieldHeld:true,firstWorkerTerminatedBeforeEscape:true,
    publicEscapeKeyDispatched:true,cancelStatusObserved:true,
    firstPreviewReleasedAfterCancel:true,cancelledNativeUnchanged:true,
    cancelledHistoryUnchanged:true,successorJobHeldBeforeDispatch:true,
    lateFirstReplyDuringSuccessor:true,noPrematureSuccessorPublication:true,
    successorRealWorkerNativeSource:true,successorWorkerReplyFilled:8288,
    successorWorkerChangedTiles:2,successorNativeChangedTiles:2,
    successorHistoryAddedOnce:true,successorFillHistoryEntries:1,
    lateFirstReplyAfterSuccessor:true,successorNativeSurvivedLateReply:true,
    successorHistorySurvivedLateReply:true,secondTabHistoryUnchanged:true,
    fillHistoryEntriesAfterLate:1,cancelFirstVerified:true,successFirstVerified:false,
    memoryCapVerified:false,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:600,
  };
}
test('037C-3b-2b/3b-2b requires two independent real-photo cancel-first formats',()=>{
  const result=validateRealPhotoCancelSuccessorSet([
    sample('psd16',1000),sample('psb32',2000)],pins,manifest);
  assert.equal(result.cancelFirstVerified,true);
  assert.deepEqual(result.formats,['psb32','psd16']);
  assert.throws(()=>validateRealPhotoCancelSuccessorSet([
    sample('psd16',1000)],pins,manifest),/independent/);
  assert.throws(()=>validateRealPhotoCancelSuccessorSet([
    sample('psd16',1000),sample('psd16',2000)],pins,manifest),/duplicate/);
  assert.throws(()=>validateRealPhotoCancelSuccessorSet([
    sample('psd16',1000),sample('psb32',1000)],pins,manifest),/duplicate/);
});
test('037C-3b-2b/3b-2b refuses false cancellation, successor and late safety claims',()=>{
  const edits=[
    r=>{r.kind='zpe-real-photo-browser-preview-success-v1';},
    r=>{r.status='real-worker-published-before-public-escape';},
    r=>{r.runIndex=2;},r=>{r.protocol='https:';},
    r=>{r.inputFileSha256='f'.repeat(64);},r=>{r.nativeDefectSha256='0'.repeat(64);},
    r=>{r.sourcePhotoSha256='0'.repeat(64);},r=>{r.bitsPerChannel=8;},
    r=>{r.selectedPixels=0;},r=>{r.workerRequests=1;},
    r=>{r.workerReplies=1;},r=>{r.workerTerminations=1;},
    r=>{r.firstWorkerNativeSource=false;},r=>{r.firstWorkerReplyFilled=1;},
    r=>{r.firstWorkerChangedTiles=1;},r=>{r.firstPreviewTileWrites=1;},
    r=>{r.firstPreviewYieldHeld=false;},r=>{r.firstWorkerTerminatedBeforeEscape=false;},
    r=>{r.publicEscapeKeyDispatched=false;},r=>{r.cancelStatusObserved=false;},
    r=>{r.firstPreviewReleasedAfterCancel=false;},
    r=>{r.cancelledNativeUnchanged=false;},r=>{r.cancelledHistoryUnchanged=false;},
    r=>{r.successorJobHeldBeforeDispatch=false;},
    r=>{r.lateFirstReplyDuringSuccessor=false;},
    r=>{r.noPrematureSuccessorPublication=false;},
    r=>{r.successorRealWorkerNativeSource=false;},r=>{r.successorWorkerReplyFilled=1;},
    r=>{r.successorWorkerChangedTiles=1;},r=>{r.successorNativeChangedTiles=1;},
    r=>{r.successorHistoryAddedOnce=false;},r=>{r.successorFillHistoryEntries=0;},
    r=>{r.lateFirstReplyAfterSuccessor=false;},
    r=>{r.successorNativeSurvivedLateReply=false;},
    r=>{r.successorHistorySurvivedLateReply=false;},
    r=>{r.secondTabHistoryUnchanged=false;},r=>{r.fillHistoryEntriesAfterLate=0;},
    r=>{r.cancelFirstVerified=false;},r=>{r.successFirstVerified=true;},
    r=>{r.memoryCapVerified=true;},r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-1;},
  ];
  for(const edit of edits)for(const format of ['psd16','psb32']){
    const r=sample(format,3000);edit(r);
    assert.throws(()=>validateRealPhotoCancelSuccessorReceipt(r,pins,manifest),
      /037C-3b-2b\/3b-2b/);
  }
});
