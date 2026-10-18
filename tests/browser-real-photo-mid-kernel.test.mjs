import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRealPhotoMidKernelFailureReceipt,validateRealPhotoMidKernelFailureSet}
  from '../tools/browser-real-photo-switch-failure.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
function sample(format,startedAtUnixMs){
  return {
    kind:'zpe-real-photo-browser-mid-kernel-switch-v1',
    status:'public-tab-switch-mid-kernel-terminated-no-publication',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:format==='psd16'?16:32,selectedPixels:8288,
    workerRequests:1,workerTerminations:1,
    actualNativeWorkerJobIntercepted:true,
    realKernelJobDispatched:true,realKernelWriteProbeObserved:true,
    probeReportedFilled:1,firstNativeSampleAfterWrite:173.25,
    terminatedAfterKernelWriteBeforeReply:true,
    publicTabSwitchRevokedOwner:true,lateMessageInjectedAfterTermination:true,
    lateMessageIgnored:true,nativeBytesUnchanged:true,originalHistoryUnchanged:true,
    secondTabHistoryUnchanged:true,actualMidKernelCancellationVerified:true,
    memoryCapVerified:false,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:350,
  };
}
test('037C-3b-2b: independently pinned PSD16/PSB32 mid-kernel receipts admitted',()=>{
  const set=[sample('psd16',10001),sample('psb32',20002)];
  assert.equal(validateRealPhotoMidKernelFailureSet(set,pins,manifest).runs,2);
});
test('037C-3b-2b: pre-kernel forgery, false byte integrity and invalid proof reject',()=>{
  const mutations=[
    r=>{r.kind='zpe-real-photo-browser-cancel-switch-v1';},
    r=>{r.status='public-tab-switch-terminated-no-publication';},
    r=>{r.protocol='https:';},r=>{r.inputFileSha256='0'.repeat(64);},
    r=>{r.nativeDefectSha256='f'.repeat(64);},
    r=>{r.sourcePhotoSha256='1'.repeat(64);},
    r=>{r.runIndex=2;},r=>{r.bitsPerChannel=8;},
    r=>{r.selectedPixels=8192;},r=>{r.workerRequests=0;},
    r=>{r.workerTerminations=0;},r=>{r.actualNativeWorkerJobIntercepted=false;},
    r=>{r.realKernelJobDispatched=false;},r=>{r.realKernelWriteProbeObserved=false;},
    r=>{r.probeReportedFilled=0;},r=>{r.firstNativeSampleAfterWrite='not a native sample';},
    r=>{r.terminatedAfterKernelWriteBeforeReply=false;},
    r=>{r.publicTabSwitchRevokedOwner=false;},
    r=>{r.lateMessageInjectedAfterTermination=false;},r=>{r.lateMessageIgnored=false;},
    r=>{r.nativeBytesUnchanged=false;},r=>{r.originalHistoryUnchanged=false;},
    r=>{r.secondTabHistoryUnchanged=false;},r=>{r.actualMidKernelCancellationVerified=false;},
    r=>{r.memoryCapVerified=true;},r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-1;},
  ];
  for(const mutate of mutations){
    const r=sample('psb32',12345);mutate(r);
    assert.throws(()=>validateRealPhotoMidKernelFailureReceipt(r,pins,manifest),/037C-3b-2b/);
  }
});
test('037C-3b-2b: two distinct formats and Chromium sessions mandatory',()=>{
  const a=sample('psd16',10001),b=sample('psb32',20002);
  assert.throws(()=>validateRealPhotoMidKernelFailureSet([a],pins,manifest),/two independent/);
  assert.throws(()=>validateRealPhotoMidKernelFailureSet([a,a],pins,manifest),/duplicate/);
  b.startedAtUnixMs=a.startedAtUnixMs;
  assert.throws(()=>validateRealPhotoMidKernelFailureSet([a,b],pins,manifest),/duplicate/);
});
