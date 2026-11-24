import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRealPhotoMidKernelEscapeReceipt,validateRealPhotoMidKernelEscapeSet}
  from '../tools/browser-real-photo-switch-failure.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));

function sample(format,startedAtUnixMs){
  return {
    kind:'zpe-real-photo-browser-mid-kernel-escape-v1',
    status:'public-escape-mid-kernel-terminated-no-publication',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:format==='psd16'?16:32,selectedPixels:8288,
    workerRequests:1,workerTerminations:1,actualNativeWorkerJobIntercepted:true,
    realKernelJobDispatched:true,realKernelWriteProbeObserved:true,
    probeReportedFilled:1,firstNativeSampleAfterWrite:173.25,
    terminatedAfterKernelWriteBeforeReply:true,
    publicEscapeKeyDispatched:true,cancelStatusObserved:true,
    lateMessageInjectedAfterTermination:true,lateMessageIgnored:true,
    originalNativeBytesUnchanged:true,originalHistoryUnchanged:true,
    secondTabHistoryUnchanged:true,fillHistoryEntries:0,
    actualMidKernelCancellationVerified:true,
    completedWorkerPreviewRaceVerified:false,
    memoryCapVerified:false,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:300,
  };
}
test('037C-3b-2b/3a requires separate real-photo PSD16 and PSB32 Escape sessions',()=>{
  const result=validateRealPhotoMidKernelEscapeSet([
    sample('psd16',12000),sample('psb32',24000)],pins,manifest);
  assert.equal(result.runs,2);
  assert.equal(result.completedWorkerPreviewRaceVerified,false);
  assert.throws(()=>validateRealPhotoMidKernelEscapeSet([
    sample('psd16',12000)],pins,manifest),/independent/);
  assert.throws(()=>validateRealPhotoMidKernelEscapeSet([
    sample('psd16',12000),sample('psd16',24000)],pins,manifest),/duplicate/);
  assert.throws(()=>validateRealPhotoMidKernelEscapeSet([
    sample('psd16',12000),sample('psb32',12000)],pins,manifest),/duplicate/);
});
test('037C-3b-2b/3a fails closed on counterfeit Escape, Worker and no-publication claims',()=>{
  const edits=[
    r=>{r.kind='zpe-real-photo-browser-mid-kernel-close-v1';},
    r=>{r.status='public-tab-close-mid-kernel-terminated-no-survivor-publication';},
    r=>{r.protocol='https:';},r=>{r.runIndex=2;},
    r=>{r.inputFileSha256='0'.repeat(64);},
    r=>{r.nativeDefectSha256='f'.repeat(64);},
    r=>{r.sourcePhotoSha256='1'.repeat(64);},
    r=>{r.bitsPerChannel=8;},r=>{r.selectedPixels=8192;},
    r=>{r.workerRequests=0;},r=>{r.workerTerminations=0;},
    r=>{r.actualNativeWorkerJobIntercepted=false;},
    r=>{r.realKernelJobDispatched=false;},
    r=>{r.realKernelWriteProbeObserved=false;},
    r=>{r.probeReportedFilled=0;},
    r=>{r.firstNativeSampleAfterWrite=NaN;},
    r=>{r.terminatedAfterKernelWriteBeforeReply=false;},
    r=>{r.publicEscapeKeyDispatched=false;},
    r=>{r.cancelStatusObserved=false;},
    r=>{r.lateMessageInjectedAfterTermination=false;},
    r=>{r.lateMessageIgnored=false;},
    r=>{r.originalNativeBytesUnchanged=false;},
    r=>{r.originalHistoryUnchanged=false;},
    r=>{r.secondTabHistoryUnchanged=false;},
    r=>{r.fillHistoryEntries=1;},
    r=>{r.actualMidKernelCancellationVerified=false;},
    r=>{r.completedWorkerPreviewRaceVerified=true;},
    r=>{r.memoryCapVerified=true;},
    r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-1;},
  ];
  for(const edit of edits){
    for(const format of ['psd16','psb32']){
      const r=sample(format,18000);edit(r);
      assert.throws(()=>validateRealPhotoMidKernelEscapeReceipt(r,pins,manifest),
        /037C-3b-2b\/3a/);
    }
  }
});
