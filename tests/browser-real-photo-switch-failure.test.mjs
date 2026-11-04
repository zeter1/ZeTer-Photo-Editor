import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRealPhotoSwitchFailureReceipt,validateRealPhotoSwitchFailureSet}
  from '../tools/browser-real-photo-switch-failure.mjs';

const pins=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-native-artifacts.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url)));
function sample(format,startedAtUnixMs){
  const bits=format==='psd16'?16:32;
  return {
    kind:'zpe-real-photo-browser-cancel-switch-v1',
    status:'public-tab-switch-terminated-no-publication',
    format,runIndex:1,protocol:'file:',
    inputFileSha256:pins.documents[format].fileSha256,
    nativeDefectSha256:pins.documents[format].nativeSha256,
    sourcePhotoSha256:manifest.sourceSha256,
    bitsPerChannel:bits,selectedPixels:8288,
    workerRequests:1,workerTerminations:1,
    actualNativeWorkerJobIntercepted:true,jobHeldBeforeKernelDispatch:true,
    publicTabSwitchRevokedOwner:true,lateMessageInjectedAfterTermination:true,
    lateMessageIgnored:true,nativeBytesUnchanged:true,originalHistoryUnchanged:true,
    secondTabHistoryUnchanged:true,actualMidKernelCancellationVerified:false,
    memoryCapVerified:false,photoshopCompatibilityVerified:false,
    startedAtUnixMs,elapsedMs:200,
  };
}
test('037C-3b-2a: two separately pinned Chromium failure receipts admitted',()=>{
  const set=[sample('psd16',10001),sample('psb32',20002)];
  assert.equal(validateRealPhotoSwitchFailureSet(set,pins,manifest).runs,2);
});
test('037C-3b-2a: corrupted pins, claimed mid-kernel success and false no-publication reject',()=>{
  const edits=[
    r=>{r.protocol='https:';},r=>{r.inputFileSha256='0'.repeat(64);},
    r=>{r.nativeDefectSha256='f'.repeat(64);},
    r=>{r.sourcePhotoSha256='1'.repeat(64);},
    r=>{r.bitsPerChannel=8;},r=>{r.selectedPixels=8192;},
    r=>{r.workerRequests=0;},r=>{r.workerTerminations=0;},
    r=>{r.actualNativeWorkerJobIntercepted=false;},
    r=>{r.jobHeldBeforeKernelDispatch=false;},
    r=>{r.publicTabSwitchRevokedOwner=false;},
    r=>{r.lateMessageInjectedAfterTermination=false;},
    r=>{r.lateMessageIgnored=false;},r=>{r.nativeBytesUnchanged=false;},
    r=>{r.originalHistoryUnchanged=false;},r=>{r.secondTabHistoryUnchanged=false;},
    r=>{r.actualMidKernelCancellationVerified=true;},
    r=>{r.memoryCapVerified=true;},r=>{r.photoshopCompatibilityVerified=true;},
    r=>{r.startedAtUnixMs=0;},r=>{r.elapsedMs=-1;},
    r=>{r.status='worker-success';},
  ];
  for(const change of edits){
    const r=sample('psb32',12345);change(r);
    assert.throws(()=>validateRealPhotoSwitchFailureReceipt(r,pins,manifest),
      /037C-3b-2a/);
  }
});
test('037C-3b-2a: cannot reuse a format or one Chromium session',()=>{
  const set=[sample('psd16',10001),sample('psb32',20002)];
  assert.throws(()=>validateRealPhotoSwitchFailureSet(set.slice(1),pins,manifest),
    /two independent/);
  const duplicate=[structuredClone(set[0]),structuredClone(set[0])];
  assert.throws(()=>validateRealPhotoSwitchFailureSet(duplicate,pins,manifest),/duplicate/);
  const reused=structuredClone(set);
  reused[1].startedAtUnixMs=reused[0].startedAtUnixMs;
  assert.throws(()=>validateRealPhotoSwitchFailureSet(reused,pins,manifest),/duplicate/);
});
