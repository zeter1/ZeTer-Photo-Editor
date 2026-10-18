// 037C-3b-2a: real pinned PSD16/PSB32, Chromium file:// UI cancellation.
// The *real* browser Worker reaches its native job postMessage. This opt-in
// harness then withholds only that postMessage to deterministically keep the
// job in flight while a PUBLIC document-tab switch revokes its owner.
// Late reply is deliberately injected after termination; this does NOT claim
// actual mid-kernel completion or memory-cap testing.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createPinnedPhotoNativeFixture} from './real-photo-native-fixtures.mjs';
import {createWideConnectedUiPolygon} from './browser-wide-connected-ui-polygon.mjs';
import {instrumentBrowserKernelSource} from './browser-inpaint-mid-kernel-smoke.mjs';
import {assertEqualNativeTiles} from './browser-wide-connected-native-evidence.mjs';

const ROOT=path.resolve(new URL('..',import.meta.url).pathname);
const FORMATS={psd16:{bits:16,key:'rgb16'},psb32:{bits:32,key:'float32'}};

export function validateRealPhotoSwitchFailureReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-2a: invalid genuine-photo cancellation receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-cancel-switch-v1' ||
    r.status!=='public-tab-switch-terminated-no-publication' ||
    r.runIndex!==1 || r.protocol!=='file:' ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 ||
    r.bitsPerChannel!==fmt.bits || r.selectedPixels!==8288 ||
    r.workerRequests!==1 || r.workerTerminations!==1 ||
    r.actualNativeWorkerJobIntercepted!==true ||
    r.jobHeldBeforeKernelDispatch!==true ||
    r.publicTabSwitchRevokedOwner!==true ||
    r.lateMessageInjectedAfterTermination!==true ||
    r.lateMessageIgnored!==true ||
    r.nativeBytesUnchanged!==true || r.originalHistoryUnchanged!==true ||
    r.secondTabHistoryUnchanged!==true ||
    r.actualMidKernelCancellationVerified!==false ||
    r.memoryCapVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}

export function validateRealPhotoSwitchFailureSet(receipts,pins,manifest){
  if(!Array.isArray(receipts) || receipts.length!==2)
    throw new TypeError('037C-3b-2a: expected two independent format receipts');
  const formats=new Set(),starts=new Set();
  for(const receipt of receipts){
    validateRealPhotoSwitchFailureReceipt(receipt,pins,manifest);
    if(formats.has(receipt.format) || starts.has(receipt.startedAtUnixMs))
      throw new TypeError('037C-3b-2a: duplicate format or session');
    formats.add(receipt.format);starts.add(receipt.startedAtUnixMs);
  }
  if(!formats.has('psd16') || !formats.has('psb32'))
    throw new TypeError('037C-3b-2a: both native depths required');
  return {kind:'zpe-real-photo-browser-cancel-switch-set-v1',runs:2,formats:[...formats].sort(),
    actualMidKernelCancellationVerified:false,memoryCapVerified:false};
}

// 037C-3b-2b phase one: a real photo native kernel write must occur
// BEFORE tab cancellation. This evidence is distinct from 2a's held job.
export function validateRealPhotoMidKernelFailureReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-2b: invalid genuine-photo mid-kernel receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-mid-kernel-switch-v1' ||
    r.status!=='public-tab-switch-mid-kernel-terminated-no-publication' ||
    r.runIndex!==1 || r.protocol!=='file:' ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 ||
    r.bitsPerChannel!==fmt.bits || r.selectedPixels!==8288 ||
    r.workerRequests!==1 || r.workerTerminations!==1 ||
    r.actualNativeWorkerJobIntercepted!==true ||
    r.realKernelJobDispatched!==true ||
    r.realKernelWriteProbeObserved!==true || r.probeReportedFilled!==1 ||
    !Number.isFinite(r.firstNativeSampleAfterWrite) ||
    r.terminatedAfterKernelWriteBeforeReply!==true ||
    r.publicTabSwitchRevokedOwner!==true ||
    r.lateMessageInjectedAfterTermination!==true ||
    r.lateMessageIgnored!==true || r.nativeBytesUnchanged!==true ||
    r.originalHistoryUnchanged!==true || r.secondTabHistoryUnchanged!==true ||
    r.actualMidKernelCancellationVerified!==true ||
    r.memoryCapVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}
export function validateRealPhotoMidKernelFailureSet(receipts,pins,manifest){
  if(!Array.isArray(receipts) || receipts.length!==2)
    throw new TypeError('037C-3b-2b: expected two independent format receipts');
  const formats=new Set(),starts=new Set();
  for(const r of receipts){
    validateRealPhotoMidKernelFailureReceipt(r,pins,manifest);
    if(formats.has(r.format)||starts.has(r.startedAtUnixMs))
      throw new TypeError('037C-3b-2b: duplicate format or session');
    formats.add(r.format);starts.add(r.startedAtUnixMs);
  }
  if(!formats.has('psd16')||!formats.has('psb32'))
    throw new TypeError('037C-3b-2b: both native depths required');
  return {kind:'zpe-real-photo-browser-mid-kernel-switch-set-v1',runs:2,
    formats:[...formats].sort(),actualMidKernelCancellationVerified:true,
    memoryCapVerified:false};
}


export function validateRealPhotoMidKernelCloseReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-2b/2: invalid genuine-photo close receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-mid-kernel-close-v1' ||
    r.status!=='public-tab-close-mid-kernel-terminated-no-survivor-publication' ||
    r.runIndex!==1 || r.protocol!=='file:' ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 ||
    r.bitsPerChannel!==fmt.bits || r.selectedPixels!==8288 ||
    r.workerRequests!==1 || r.workerTerminations!==1 ||
    r.actualNativeWorkerJobIntercepted!==true ||
    r.realKernelJobDispatched!==true || r.realKernelWriteProbeObserved!==true ||
    r.probeReportedFilled!==1 || !Number.isFinite(r.firstNativeSampleAfterWrite) ||
    r.terminatedAfterKernelWriteBeforeReply!==true ||
    r.publicTabCloseRevokedOwner!==true || r.originalTabRemoved!==true ||
    r.lateMessageInjectedAfterTermination!==true || r.lateMessageIgnored!==true ||
    r.survivorProjectUnchanged!==true || r.survivorHistoryUnchanged!==true ||
    // The closed photo tab cannot be publicly saved AFTER removal.
    // Never forge an exact-native-after-close claim from a pre-close baseline.
    r.originalNativeAfterCloseObservable!==false ||
    r.actualMidKernelCancellationVerified!==true ||
    r.memoryCapVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}
export function validateRealPhotoMidKernelCloseSet(receipts,pins,manifest){
  if(!Array.isArray(receipts)||receipts.length!==2)
    throw new TypeError('037C-3b-2b/2: expected two independent close receipts');
  const formats=new Set(),starts=new Set();
  for(const receipt of receipts){
    validateRealPhotoMidKernelCloseReceipt(receipt,pins,manifest);
    if(formats.has(receipt.format)||starts.has(receipt.startedAtUnixMs))
      throw new TypeError('037C-3b-2b/2: duplicate format or Chromium session');
    formats.add(receipt.format);starts.add(receipt.startedAtUnixMs);
  }
  if(!formats.has('psd16')||!formats.has('psb32'))
    throw new TypeError('037C-3b-2b/2: both native depths required');
  return {kind:'zpe-real-photo-browser-mid-kernel-close-set-v1',runs:2,
    formats:[...formats].sort(),actualMidKernelCancellationVerified:true,
    originalNativeAfterCloseObservable:false,memoryCapVerified:false};
}

// 037C-3b-2b/3a: the PUBLIC Escape route revokes a genuine photo Worker
// only after the native kernel has written its first pixel. These receipts
// never claim the Worker naturally finished or Photoshop authored the input.
export function validateRealPhotoMidKernelEscapeReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-2b/3a: invalid genuine-photo Escape receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-mid-kernel-escape-v1' ||
    r.status!=='public-escape-mid-kernel-terminated-no-publication' ||
    r.runIndex!==1 || r.protocol!=='file:' ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 ||
    r.bitsPerChannel!==fmt.bits || r.selectedPixels!==8288 ||
    r.workerRequests!==1 || r.workerTerminations!==1 ||
    r.actualNativeWorkerJobIntercepted!==true ||
    r.realKernelJobDispatched!==true || r.realKernelWriteProbeObserved!==true ||
    r.probeReportedFilled!==1 || !Number.isFinite(r.firstNativeSampleAfterWrite) ||
    r.terminatedAfterKernelWriteBeforeReply!==true ||
    r.publicEscapeKeyDispatched!==true || r.cancelStatusObserved!==true ||
    r.lateMessageInjectedAfterTermination!==true || r.lateMessageIgnored!==true ||
    r.originalNativeBytesUnchanged!==true || r.originalHistoryUnchanged!==true ||
    r.secondTabHistoryUnchanged!==true || r.fillHistoryEntries!==0 ||
    r.actualMidKernelCancellationVerified!==true ||
    r.completedWorkerPreviewRaceVerified!==false ||
    r.memoryCapVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}
export function validateRealPhotoMidKernelEscapeSet(receipts,pins,manifest){
  if(!Array.isArray(receipts)||receipts.length!==2)
    throw new TypeError('037C-3b-2b/3a: expected two independent Escape receipts');
  const formats=new Set(),starts=new Set();
  for(const r of receipts){
    validateRealPhotoMidKernelEscapeReceipt(r,pins,manifest);
    if(formats.has(r.format)||starts.has(r.startedAtUnixMs))
      throw new TypeError('037C-3b-2b/3a: duplicate format or Chromium session');
    formats.add(r.format);starts.add(r.startedAtUnixMs);
  }
  if(!formats.has('psd16')||!formats.has('psb32'))
    throw new TypeError('037C-3b-2b/3a: both native depths required');
  return {kind:'zpe-real-photo-browser-mid-kernel-escape-set-v1',runs:2,
    formats:[...formats].sort(),actualMidKernelCancellationVerified:true,
    completedWorkerPreviewRaceVerified:false,memoryCapVerified:false};
}


export function validateRealPhotoCompletedPreviewEscapeReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-2b/3b-1: invalid completed-Worker preview receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-completed-preview-escape-v1' ||
    r.status!=='public-escape-after-real-worker-reply-before-preview-publication' ||
    r.runIndex!==1 || r.protocol!=='file:' ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 ||
    r.bitsPerChannel!==fmt.bits || r.selectedPixels!==8288 ||
    r.workerRequests!==1 || r.workerRepliesBeforeEscape!==1 ||
    r.workerTerminationsBeforeEscape!==1 || r.workerTerminations!==1 ||
    r.workerResultNativeSource!==true || r.workerReplyFilled!==8288 ||
    !Number.isSafeInteger(r.workerReplyChangedTiles) || r.workerReplyChangedTiles<2 ||
    r.actualNativeWorkerJobDispatched!==true ||
    r.realWorkerResultReceivedBeforeEscape!==true ||
    !Number.isSafeInteger(r.previewTileWritesBeforeEscape) || r.previewTileWritesBeforeEscape<2 ||
    r.previewYieldHeldBeforeEscape!==true ||
    r.publicEscapeKeyDispatched!==true || r.cancelStatusObserved!==true ||
    r.previewReleasedAfterEscape!==true ||
    r.originalNativeBytesUnchanged!==true || r.originalHistoryUnchanged!==true ||
    r.secondTabHistoryUnchanged!==true || r.fillHistoryEntries!==0 ||
    r.completedWorkerPreviewRaceVerified!==true ||
    r.actualMidKernelCancellationVerified!==false ||
    r.memoryCapVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}
export function validateRealPhotoCompletedPreviewEscapeSet(receipts,pins,manifest){
  if(!Array.isArray(receipts)||receipts.length!==2)
    throw new TypeError('037C-3b-2b/3b-1: expected two independent completed-Worker receipts');
  const formats=new Set(),starts=new Set();
  for(const r of receipts){
    validateRealPhotoCompletedPreviewEscapeReceipt(r,pins,manifest);
    if(formats.has(r.format)||starts.has(r.startedAtUnixMs))
      throw new TypeError('037C-3b-2b/3b-1: duplicate format or Chromium session');
    formats.add(r.format);starts.add(r.startedAtUnixMs);
  }
  if(!formats.has('psd16')||!formats.has('psb32'))
    throw new TypeError('037C-3b-2b/3b-1: both native depths required');
  return {kind:'zpe-real-photo-browser-completed-preview-escape-set-v1',
    runs:2,formats:[...formats].sort(),completedWorkerPreviewRaceVerified:true,
    actualMidKernelCancellationVerified:false,memoryCapVerified:false};
}

// 037C-3b-2b/3b-2a: real successful native Worker -> preview publication
// -> public Escape. Success must remain committed; no later cancellation.
export function validateRealPhotoCompletedPreviewSuccessReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-2b/3b-2a: invalid success-first receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-preview-success-v1' ||
    r.status!=='real-worker-published-before-public-escape' ||
    r.runIndex!==1 || r.protocol!=='file:' ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 || r.bitsPerChannel!==fmt.bits ||
    r.selectedPixels!==8288 || r.workerRequests!==1 || r.workerReplies!==1 ||
    r.workerTerminations!==1 || r.workerResultNativeSource!==true ||
    r.workerReplyFilled!==8288 ||
    !Number.isSafeInteger(r.workerReplyChangedTiles) || r.workerReplyChangedTiles<2 ||
    !Number.isSafeInteger(r.previewTileWrites) || r.previewTileWrites<2 ||
    r.previewYieldHeld!==true || r.previewReleasedBeforeEscape!==true ||
    r.successStatusObserved!==true || r.fillHistoryEntriesBeforeEscape!==1 ||
    r.historyAddedExactlyOnce!==true ||
    !Number.isSafeInteger(r.nativeChangedTiles) || r.nativeChangedTiles<2 ||
    r.publicEscapeKeyDispatched!==true || r.cancelStatusObservedAfterEscape!==false ||
    r.committedNativeBytesSurvivedEscape!==true ||
    r.committedHistorySurvivedEscape!==true ||
    r.secondTabHistoryUnchanged!==true || r.fillHistoryEntriesAfterEscape!==1 ||
    r.successFirstVerified!==true || r.cancelFirstVerified!==false ||
    r.memoryCapVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}
export function validateRealPhotoCompletedPreviewSuccessSet(receipts,pins,manifest){
  if(!Array.isArray(receipts)||receipts.length!==2)
    throw new TypeError('037C-3b-2b/3b-2a: expected independent PSD16/PSB32 receipts');
  const formats=new Set(),starts=new Set();
  for(const r of receipts){
    validateRealPhotoCompletedPreviewSuccessReceipt(r,pins,manifest);
    if(formats.has(r.format)||starts.has(r.startedAtUnixMs))
      throw new TypeError('037C-3b-2b/3b-2a: duplicate format or session');
    formats.add(r.format);starts.add(r.startedAtUnixMs);
  }
  if(!formats.has('psd16')||!formats.has('psb32'))
    throw new TypeError('037C-3b-2b/3b-2a: both native depths required');
  return {kind:'zpe-real-photo-browser-preview-success-set-v1',
    runs:2,formats:[...formats].sort(),successFirstVerified:true,cancelFirstVerified:false};
}


// 037C-3b-2b/3b-2b: public cancel-first completed Worker, then a genuine
// successor Worker commits. Injected first-generation replies must never win.
export function validateRealPhotoCancelSuccessorReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-2b/3b-2b: invalid cancel-first successor receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-cancel-successor-v1' ||
    r.status!=='public-cancel-first-successor-worker-committed-late-ignored' ||
    r.runIndex!==1 || r.protocol!=='file:' ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 || r.bitsPerChannel!==fmt.bits ||
    r.selectedPixels!==8288 || r.workerRequests!==2 || r.workerReplies!==2 ||
    r.workerTerminations!==2 || r.firstWorkerNativeSource!==true ||
    r.firstWorkerReplyFilled!==8288 ||
    !Number.isSafeInteger(r.firstWorkerChangedTiles) || r.firstWorkerChangedTiles<2 ||
    !Number.isSafeInteger(r.firstPreviewTileWrites) || r.firstPreviewTileWrites<2 ||
    r.firstPreviewYieldHeld!==true || r.firstWorkerTerminatedBeforeEscape!==true ||
    r.publicEscapeKeyDispatched!==true || r.cancelStatusObserved!==true ||
    r.firstPreviewReleasedAfterCancel!==true ||
    r.cancelledNativeUnchanged!==true || r.cancelledHistoryUnchanged!==true ||
    r.successorJobHeldBeforeDispatch!==true ||
    r.lateFirstReplyDuringSuccessor!==true ||
    r.noPrematureSuccessorPublication!==true ||
    r.successorRealWorkerNativeSource!==true || r.successorWorkerReplyFilled!==8288 ||
    !Number.isSafeInteger(r.successorWorkerChangedTiles) || r.successorWorkerChangedTiles<2 ||
    !Number.isSafeInteger(r.successorNativeChangedTiles) || r.successorNativeChangedTiles<2 ||
    r.successorHistoryAddedOnce!==true || r.successorFillHistoryEntries!==1 ||
    r.lateFirstReplyAfterSuccessor!==true ||
    r.successorNativeSurvivedLateReply!==true ||
    r.successorHistorySurvivedLateReply!==true ||
    r.secondTabHistoryUnchanged!==true || r.fillHistoryEntriesAfterLate!==1 ||
    r.cancelFirstVerified!==true || r.successFirstVerified!==false ||
    r.memoryCapVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}
export function validateRealPhotoCancelSuccessorSet(receipts,pins,manifest){
  if(!Array.isArray(receipts)||receipts.length!==2)
    throw new TypeError('037C-3b-2b/3b-2b: expected independent PSD16/PSB32 receipts');
  const formats=new Set(),starts=new Set();
  for(const r of receipts){
    validateRealPhotoCancelSuccessorReceipt(r,pins,manifest);
    if(formats.has(r.format)||starts.has(r.startedAtUnixMs))
      throw new TypeError('037C-3b-2b/3b-2b: duplicate format or session');
    formats.add(r.format);starts.add(r.startedAtUnixMs);
  }
  if(!formats.has('psd16')||!formats.has('psb32'))
    throw new TypeError('037C-3b-2b/3b-2b: both native depths required');
  return {kind:'zpe-real-photo-browser-cancel-successor-set-v1',
    runs:2,formats:[...formats].sort(),cancelFirstVerified:true,successFirstVerified:false,
    memoryCapVerified:false};
}


// 037C-3b-3/2a: the actual photo Worker finishes, but a test-only transport
// mutation changes one selected native alpha sample before the UI validator.
// Receipt status is not an acceptance claim without independently green CI.
export function validateRealPhotoMalformedReplyReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-3/2a: invalid malformed-alpha photo receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-malformed-alpha-v1' ||
    r.status!=='native-worker-alpha-corrupted-rejected-by-public-ui' ||
    r.protocol!=='file:' || r.runIndex!==1 ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 || r.bitsPerChannel!==fmt.bits ||
    r.selectedPixels!==8288 || r.workerRequests!==1 || r.workerReplies!==1 ||
    r.workerTerminations!==1 || r.selectionMatched!==true ||
    r.realWorkerNativeResultObserved!==true || r.realWorkerReplyFilled!==8288 ||
    !Number.isSafeInteger(r.realWorkerChangedTiles) || r.realWorkerChangedTiles<2 ||
    r.transportMutation==='none' || r.transportMutation!=='selected-alpha-one-byte' ||
    r.mutatedBeforeUiValidation!==true || r.selectedAlphaByteCorrupted!==true ||
    r.publicInvalidWorkerStatusObserved!==true || r.privatePreviewTileWrites!==0 ||
    r.nativeBytesUnchanged!==true || r.originalHistoryUnchanged!==true ||
    r.fillHistoryEntries!==0 || r.secondTabHistoryUnchanged!==true ||
    r.maxBytesVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}
export function validateRealPhotoMalformedExtraReceipt(r,pins,manifest){
  const bad=()=>{throw new TypeError('037C-3b-3/2b-2: invalid photo receipt');};
  const fmt=FORMATS[r?.format],pin=pins?.documents?.[r?.format],kind=r?.malformedKind;
  const allowed=kind==='outside' || (r.format==='psb32' &&
    (kind==='nonfinite-nan'||kind==='nonfinite-infinity'));
  const mutation=kind==='outside'?'outside-roi-color-byte':
    kind==='nonfinite-nan'?'selected-color-nan':'selected-color-infinity';
  if(!fmt||!pin||!allowed||r.kind!=='zpe-real-photo-browser-malformed-extra-v1'||
    r.status!=='native-worker-malformed-extra-rejected-by-public-ui'||
    r.protocol!=='file:'||r.runIndex!==1||
    r.inputFileSha256!==pin.fileSha256||r.nativeDefectSha256!==pin.nativeSha256||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256||
    r.sourcePhotoSha256!==manifest?.sourceSha256||r.bitsPerChannel!==fmt.bits||
    r.selectedPixels!==8288||r.workerRequests!==1||r.workerReplies!==1||
    r.workerTerminations!==1||r.selectionMatched!==true||
    r.realWorkerNativeResultObserved!==true||r.realWorkerReplyFilled!==8288||
    !Number.isSafeInteger(r.realWorkerChangedTiles)||r.realWorkerChangedTiles<2||
    r.transportMutation!==mutation||r.mutatedBeforeUiValidation!==true||
    r.selectedAlphaByteCorrupted!==false||r.counterCorrupted!==false||
    r.outsideRoiByteCorrupted!==(kind==='outside')||
    r.nonfiniteColorSample!==(kind==='nonfinite-nan'?'nan':
      kind==='nonfinite-infinity'?'infinity':'none')||
    r.publicInvalidWorkerStatusObserved!==true||r.privatePreviewTileWrites!==0||
    r.nativeBytesUnchanged!==true||r.originalHistoryUnchanged!==true||
    r.fillHistoryEntries!==0||r.secondTabHistoryUnchanged!==true||
    r.maxBytesVerified!==false||r.photoshopCompatibilityVerified!==false||
    !Number.isSafeInteger(r.startedAtUnixMs)||r.startedAtUnixMs<=0||
    !Number.isSafeInteger(r.elapsedMs)||r.elapsedMs<0)bad();
  return r;
}
export function validateRealPhotoMalformedExtraSet(receipts,pins,manifest){
  if(!Array.isArray(receipts)||receipts.length!==4)
    throw new TypeError('037C-3b-3/2b-2: four independent sessions required');
  const pairs=new Set(),sessions=new Set();
  for(const r of receipts){
    validateRealPhotoMalformedExtraReceipt(r,pins,manifest);
    const pair=r.format+':'+r.malformedKind;
    if(pairs.has(pair)||sessions.has(r.startedAtUnixMs))
      throw new TypeError('037C-3b-3/2b-2: duplicate format/session');
    pairs.add(pair);sessions.add(r.startedAtUnixMs);
  }
  for(const pair of ['psd16:outside','psb32:outside',
    'psb32:nonfinite-nan','psb32:nonfinite-infinity']){
    if(!pairs.has(pair))throw new TypeError('037C-3b-3/2b-2: missing '+pair);
  }
  return {kind:'zpe-real-photo-browser-malformed-extra-set-v1',
    runs:4,scenarios:[...pairs].sort(),failClosed:true,
    maxBytesVerified:false,photoshopCompatibilityVerified:false};
}
export function validateRealPhotoMalformedCounterReceipt(r,pins,manifest){
  const bad=()=>{throw new TypeError('037C-3b-3/2b-1: invalid counter photo receipt');};
  const fmt=FORMATS[r?.format],pin=pins?.documents?.[r?.format];
  if(!fmt||!pin||r.kind!=='zpe-real-photo-browser-malformed-counter-v1'||
    r.status!=='native-worker-counter-corrupted-rejected-by-public-ui'||
    r.protocol!=='file:'||r.runIndex!==1||
    r.inputFileSha256!==pin.fileSha256||r.nativeDefectSha256!==pin.nativeSha256||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256||
    r.sourcePhotoSha256!==manifest?.sourceSha256||r.bitsPerChannel!==fmt.bits||
    r.selectedPixels!==8288||r.workerRequests!==1||r.workerReplies!==1||
    r.workerTerminations!==1||r.selectionMatched!==true||
    r.realWorkerNativeResultObserved!==true||r.realWorkerReplyFilled!==8288||
    !Number.isSafeInteger(r.realWorkerChangedTiles)||r.realWorkerChangedTiles<2||
    !Number.isSafeInteger(r.realWorkerReplyChanged)||
    r.realWorkerReplyChanged<=r.realWorkerChangedTiles||
    r.realWorkerReplyChanged>r.selectedPixels||
    r.mutatedChangedCount!==r.realWorkerReplyChanged-1||
    r.mutatedChangedCount<r.realWorkerChangedTiles||
    r.transportMutation!=='changed-count-minus-one'||
    r.mutatedBeforeUiValidation!==true||r.counterCorrupted!==true||
    r.selectedAlphaByteCorrupted!==false||
    r.publicInvalidWorkerStatusObserved!==true||r.privatePreviewTileWrites!==0||
    r.nativeBytesUnchanged!==true||r.originalHistoryUnchanged!==true||
    r.fillHistoryEntries!==0||r.secondTabHistoryUnchanged!==true||
    r.maxBytesVerified!==false||r.photoshopCompatibilityVerified!==false||
    !Number.isSafeInteger(r.startedAtUnixMs)||r.startedAtUnixMs<=0||
    !Number.isSafeInteger(r.elapsedMs)||r.elapsedMs<0)bad();
  return r;
}
export function validateRealPhotoMalformedCounterSet(receipts,pins,manifest){
  if(!Array.isArray(receipts)||receipts.length!==2)
    throw new TypeError('037C-3b-3/2b-1: two independent formats required');
  const formats=new Set(),sessions=new Set();
  for(const r of receipts){
    validateRealPhotoMalformedCounterReceipt(r,pins,manifest);
    if(formats.has(r.format)||sessions.has(r.startedAtUnixMs))
      throw new TypeError('037C-3b-3/2b-1: duplicate format/session');
    formats.add(r.format);sessions.add(r.startedAtUnixMs);
  }
  if(!formats.has('psd16')||!formats.has('psb32'))
    throw new TypeError('037C-3b-3/2b-1: both depths required');
  return {kind:'zpe-real-photo-browser-malformed-counter-set-v1',
    runs:2,formats:[...formats].sort(),counterRejected:true,
    maxBytesVerified:false,photoshopCompatibilityVerified:false};
}
export function validateRealPhotoMalformedReplySet(receipts,pins,manifest){
  if(!Array.isArray(receipts) || receipts.length!==2)
    throw new TypeError('037C-3b-3/2a: two independent photo formats required');
  const formats=new Set(),sessions=new Set();
  for(const r of receipts){
    validateRealPhotoMalformedReplyReceipt(r,pins,manifest);
    if(formats.has(r.format)||sessions.has(r.startedAtUnixMs))
      throw new TypeError('037C-3b-3/2a: duplicate session or format');
    formats.add(r.format);sessions.add(r.startedAtUnixMs);
  }
  if(!formats.has('psd16')||!formats.has('psb32'))
    throw new TypeError('037C-3b-3/2a: PSD16 and PSB32 are both required');
  return {kind:'zpe-real-photo-browser-malformed-alpha-set-v1',
    runs:2,formats:[...formats].sort(),selectedAlphaRejected:true,
    maxBytesVerified:false,photoshopCompatibilityVerified:false};
}

// The following functions execute in a real CDP browser page, not in Node.
// The only document readback is the public File -> Save Project route.
async function publicNativeSnapshot(label){
  const s=window.__photoFailure;
  let blob=null;
  const original=URL.createObjectURL;
  URL.createObjectURL=function(value,...args){
    if(value instanceof Blob && value.type==='application/json') blob=value;
    return original.call(URL,value,...args);
  };
  try{
    document.querySelector('.menu-button[data-menu="file"]').click();
    const save=[...document.querySelectorAll('#menuPopover .menu-item')].find(
      b=>b.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
    if(!save || save.disabled) throw Error('037C-3b-2a public Save Project unavailable');
    save.click();
    if(!blob) throw Error('037C-3b-2a no public .zpe JSON');
    const project=JSON.parse(await blob.text());
    const source=project.layers?.find(
      l=>l.name==='Pinned photo defect (8-bit derived)')?.highDepthSource;
    if(source?.kind!=='zpe-pixel-buffer-source-v2' ||
      source.width!==1025 || source.height!==1025 || source.channels!==4 ||
      source.bitsPerChannel!==s.bits || source.model!=='rgb' ||
      !Array.isArray(source.tiles) || source.tiles.length<2)
      throw Error('037C-3b-2a invalid native public snapshot');
    s.snapshots[label]=source;
    return {bits:source.bitsPerChannel,tiles:source.tiles.length,rawBytes:source.rawBytes,
      usedOtherNativeBytes:project.layers.reduce((total,layer)=>
        layer.name==='Pinned photo defect (8-bit derived)' ? total :
          total+Math.max(0,Number(layer.highDepthSource?.rawBytes)||0),0)};
  } finally {URL.createObjectURL=original;}
}
function prepareTabs(){
  const tabs=()=>[...document.querySelectorAll('#docTabs .doc-tab')];
  if(tabs().length!==1) throw Error('037C-3b-2a requires isolated first document');
  document.querySelector('#addDocTabBtn').click();
  if(tabs().length!==2 || tabs()[1]?.getAttribute('aria-selected')!=='true')
    throw Error('037C-3b-2a second document tab not created');
  const secondHistory=[...document.querySelectorAll('#historyList .history-row')]
    .map(r=>r.textContent);
  tabs()[0].click();
  if(tabs()[0]?.getAttribute('aria-selected')!=='true')
    throw Error('037C-3b-2a original tab not active');
  return {secondHistory};
}
function setupPolygon(){
  const s=window.__photoFailure;
  const zoom=document.querySelector('#zoomRange');
  zoom.value='100';zoom.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('[data-tool="marquee"]').click();
  const type=document.querySelector('#selectionType');
  type.value='polygon';type.dispatchEvent(new Event('change',{bubbles:true}));
  document.querySelector('#canvasShell').scrollIntoView({block:'center',inline:'center'});
  const viewport=document.querySelector('#stageViewport');
  viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;
  viewport.scrollTop=(viewport.scrollHeight-viewport.clientHeight)/2;
  const overlay=document.querySelector('#overlayCanvas'),rect=overlay.getBoundingClientRect();
  const points=s.polygon.points.map(p=>({
    x:rect.left+p.x*rect.width/overlay.width,
    y:rect.top+p.y*rect.height/overlay.height,
  }));
  return {width:overlay.width,height:overlay.height,points,
    hits:points.map(p=>document.elementFromPoint(p.x,p.y)?.id),
    inWindow:points.every(p=>p.x>0&&p.y>0&&p.x<innerWidth&&p.y<innerHeight)};
}
function installHeldNativeWorker(){
  const s=window.__photoFailure;
  const post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate;
  s.restore=()=>{
    Worker.prototype.postMessage=post;
    Worker.prototype.terminate=terminate;
  };
  Worker.prototype.postMessage=function(job,...args){
    if(job?.selectedIndices instanceof Uint32Array &&
      job?.source?.kind==='zpe-pixel-buffer-source-v2'){
      s.workerRequests++;
      s.worker=this;s.jobId=job.id;
      s.selectionMatched=job.selectedIndices.length===s.expectedIndices.length &&
        job.selectedIndices.every((v,i)=>v===s.expectedIndices[i]);
      // Hold the real job after ready, before kernel dispatch. This is an
      // intentionally controlled in-flight cancellation, not a synthetic PSD.
      return;
    }
    return post.call(this,job,...args);
  };
  Worker.prototype.terminate=function(...args){
    if(this===s.worker) s.workerTerminations++;
    return terminate.apply(this,args);
  };
  return true;
}
function ensureGeneratedWorkerSupplier(){
  const name='__zpeTiledInpaintWorkerSource';
  if(typeof globalThis[name]==='string') return Promise.resolve(true);
  // The browser adapter normally lazily injects this classic file:// script
  // on first run. Preload only in this test so the post-write probe can be
  // inserted before the native job creates its Worker.
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timeout=setTimeout(()=>{script.remove();reject(Error('037C-3b-2b supplier bootstrap timeout'));},5000);
    const complete=(err)=>{
      clearTimeout(timeout);script.remove();
      if(err) reject(err);
      else if(typeof globalThis[name]!=='string') reject(Error('037C-3b-2b missing supplier after load'));
      else resolve(true);
    };
    script.onload=()=>complete(null);
    script.onerror=()=>complete(Error('037C-3b-2b supplier failed to load'));
    script.src=new URL('./src/core/tiled-inpaint-worker-source.js',document.baseURI).href;
    document.head.appendChild(script);
  });
}
function installMidKernelNativeWorker(instrument){
  const s=window.__photoFailure;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'__zpeTiledInpaintWorkerSource');
  if(typeof descriptor?.value!=='string' || descriptor.configurable!==true)
    throw Error('037C-3b-2b generated file:// Worker supplier unavailable');
  const post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate;
  // Only the test page's supplier descriptor is patched; production artifacts
  // are untouched and the actual native PSD16/PSB32 job enters the real kernel.
  Object.defineProperty(globalThis,'__zpeTiledInpaintWorkerSource',{
    // The kernel receives a bounded ROI buffer, NOT the 1025px document.
    // Keep the probe conditional on a real multi-pixel photo ROI width.
    configurable:true,value:instrument(descriptor.value,{minimumWidth:40}),
  });
  s.restore=()=>{
    Worker.prototype.postMessage=post;
    Worker.prototype.terminate=terminate;
    Object.defineProperty(globalThis,'__zpeTiledInpaintWorkerSource',descriptor);
  };
  s.kernelWrites=0;s.workerReplies=0;s.dispatched=false;s.terminatedDuringKernel=false;
  Worker.prototype.postMessage=function(job,...args){
    if(job?.selectedIndices instanceof Uint32Array &&
      job?.source?.kind==='zpe-pixel-buffer-source-v2'){
      s.workerRequests++;s.worker=this;s.jobId=job.id;
      s.selectionMatched=job.selectedIndices.length===s.expectedIndices.length &&
        job.selectedIndices.every((v,i)=>v===s.expectedIndices[i]);
      this.addEventListener('message',event=>{
        if(event.data?.probe==='zpe-test-native-kernel-write'){
          s.kernelWrites++;
          s.firstNativeSampleAfterWrite=event.data.changedSample;
          s.probeReportedFilled=event.data.filled;
        }
        if(event.data?.id===s.jobId && event.data?.ok===true)
          s.workerReplies++;
      });
      s.dispatched=true;
      return post.call(this,job,...args);
    }
    return post.call(this,job,...args);
  };
  Worker.prototype.terminate=function(...args){
    if(this===s.worker){
      s.workerTerminations++;
      s.terminatedDuringKernel=s.kernelWrites===1 && s.workerReplies===0;
    }
    return terminate.apply(this,args);
  };
  return true;
}



function installMalformedNativeWorkerReply(){
  const s=window.__photoFailure;
  const post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate;
  const add=Worker.prototype.addEventListener,remove=Worker.prototype.removeEventListener;
  const put=CanvasRenderingContext2D.prototype.putImageData;
  const wrapped=new WeakMap();
  s.workerReplies=0;s.previewTileWrites=0;s.mutated=false;
  s.selectedAlphaByteCorrupted=false;s.outsideRoiByteCorrupted=false;
  s.nonfiniteColorSample='none';s.counterCorrupted=false;
  s.restore=()=>{
    Worker.prototype.postMessage=post;
    Worker.prototype.terminate=terminate;
    Worker.prototype.addEventListener=add;
    Worker.prototype.removeEventListener=remove;
    CanvasRenderingContext2D.prototype.putImageData=put;
  };
  // A real Worker handles the untouched frozen ROI and produces a real native
  // result. Only the UI-facing message is corrupted, not the Worker kernel.
  Worker.prototype.postMessage=function(job,...args){
    if(job?.selectedIndices instanceof Uint32Array &&
       job?.source?.kind==='zpe-pixel-buffer-source-v2'){
      s.workerRequests++;s.worker=this;s.jobId=job.id;
      s.selectionMatched=job.selectedIndices.length===s.expectedIndices.length &&
        job.selectedIndices.every((v,i)=>v===s.expectedIndices[i]);
    }
    return post.call(this,job,...args);
  };
  Worker.prototype.addEventListener=function(type,listener,options){
    if(type!=='message' || typeof listener!=='function')return add.call(this,type,listener,options);
    const worker=this;
    const interceptor=function(event){
      const reply=event.data;
      if(worker!==s.worker || reply?.id!==s.jobId ||
         reply.ok!==true || s.mutated)return listener.call(this,event);
      const result=reply.result;
      if(result?.source?.kind!=='zpe-pixel-buffer-source-v2' ||
         result.filled!==8288 || result.changedTiles<2)
        throw Error('037C-3b-3/2a missing genuine native result');
      s.workerReplies++;s.realWorkerNativeResultObserved=true;
      s.realWorkerReplyFilled=result.filled;s.realWorkerChangedTiles=result.changedTiles;
      // Intercept only after the real Worker computed native tile bytes.
      // The wrong count stays within plausible bounds but disagrees with
      // the byte-exact changed-pixel count validated by the application.
      if(s.malformedKind==='counter'){
        if(!Number.isSafeInteger(result.changed) ||
          result.changed<=result.changedTiles||result.changed>result.filled)
          throw Error('037C-3b-3/2b-1 invalid real Worker baseline count');
        s.realWorkerReplyChanged=result.changed;
        s.mutatedChangedCount=result.changed-1;
        s.counterCorrupted=true;s.selectedAlphaByteCorrupted=false;
        s.mutated=true;s.mutatedBeforeUiValidation=true;
        return listener.call(this,{data:{...reply,
          result:{...result,changed:s.mutatedChangedCount}}});
      }
      const index=s.expectedIndices[0],x=index%1025,y=Math.floor(index/1025);
      const tiles=result.source.tiles.map(tile=>({...tile}));
      const ti=tiles.findIndex(tile=>x>=tile.x&&y>=tile.y&&
        x<tile.x+tile.width&&y<tile.y+tile.height);
      if(ti<0 || tiles[ti].dataUrl===s.snapshots.before.tiles[ti].dataUrl)
        throw Error('037C-3b-3/2a selected tile not actually changed by real Worker');
      const tile=tiles[ti],prefix=tile.dataUrl.slice(0,tile.dataUrl.indexOf('base64,')+7);
      if(!prefix.startsWith('data:application/x-zeter-pixel-buffer-tile;base64,'))
        throw Error('037C-3b-3/2a invalid native tile envelope');
      const decoded=atob(tile.dataUrl.slice(prefix.length));
      const bytes=Uint8Array.from(decoded,ch=>ch.charCodeAt(0));
      const bytesPerSample=s.bits/8;
      if(s.malformedKind==='nonfinite-nan'||s.malformedKind==='nonfinite-infinity'){
        if(s.bits!==32)throw Error('037C-3b-3/2b-2 Float32 required');
        const offset=((y-tile.y)*tile.width+(x-tile.x))*4*bytesPerSample;
        const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
        view.setFloat32(offset,s.malformedKind==='nonfinite-nan'?NaN:Infinity,true);
        const mutated=view.getFloat32(offset,true);
        s.nonfiniteColorSample=Number.isNaN(mutated)?'nan':
          mutated===Infinity?'infinity':'invalid';
      }else if(s.malformedKind==='outside'){
        const selected=new Set(s.expectedIndices);
        let outside=-1;
        for(let local=0;local<tile.width*tile.height;local++){
          const px=tile.x+local%tile.width,py=tile.y+Math.floor(local/tile.width);
          if(!selected.has(py*1025+px)){outside=local;break;}
        }
        if(outside<0)throw Error('037C-3b-3/2b-2 missing unselected pixel');
        bytes[outside*4*bytesPerSample]^=1;
        s.outsideRoiByteCorrupted=true;
      }else{
        const offset=(((y-tile.y)*tile.width+(x-tile.x))*4+3)*bytesPerSample;
        if(offset>=bytes.length)throw Error('037C-3b-3/2a selected alpha offset out of tile');
        bytes[offset]^=1;
      }
      let encoded='';
      for(let i=0;i<bytes.length;i+=8192)
        encoded+=String.fromCharCode(...bytes.subarray(i,i+8192));
      tile.dataUrl=prefix+btoa(encoded);
       s.selectedAlphaByteCorrupted=s.malformedKind==='alpha' &&
         tile.dataUrl!==result.source.tiles[ti].dataUrl;
      s.mutated=true;s.mutatedBeforeUiValidation=true;
      const changed={...result,source:{...result.source,tiles}};
      return listener.call(this,{data:{...reply,result:changed}});
    };
    let mapping=wrapped.get(worker);
    if(!mapping){mapping=new Map();wrapped.set(worker,mapping);}
    mapping.set(listener,interceptor);
    return add.call(worker,type,interceptor,options);
  };
  Worker.prototype.removeEventListener=function(type,listener,options){
    return remove.call(this,type,wrapped.get(this)?.get(listener)||listener,options);
  };
  Worker.prototype.terminate=function(...args){
    if(this===s.worker)s.workerTerminations++;
    return terminate.apply(this,args);
  };
  CanvasRenderingContext2D.prototype.putImageData=function(image,x,y,...args){
    if(s.workerReplies>=1 && this.canvas?.width===1025 &&
       this.canvas?.height===1025 && image?.width<=256 && image?.height<=256)
      s.previewTileWrites++;
    return put.call(this,image,x,y,...args);
  };
  return true;
}

function installCompletedWorkerPreviewHold(){
  const s=window.__photoFailure;
  const post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate;
  const put=CanvasRenderingContext2D.prototype.putImageData;
  const timer=window.setTimeout,clear=window.clearTimeout;
  s.workerReplies=0;s.previewTileWrites=0;s.previewYieldHeld=false;
  s.successorMode=!!s.successorMode;s.firstCompletionRecorded=false;s.successorHeld=false;
  s.previewReleased=false;s.heldPreview=null;
  s.restore=()=>{
    Worker.prototype.postMessage=post;
    Worker.prototype.terminate=terminate;
    CanvasRenderingContext2D.prototype.putImageData=put;
    window.setTimeout=timer;
    if(s.heldPreview)clear.call(window,s.heldPreview.timerId);
  };
  Worker.prototype.postMessage=function(job,...args){
    if(job?.selectedIndices instanceof Uint32Array &&
      job?.source?.kind==='zpe-pixel-buffer-source-v2'){
      s.workerRequests++;s.worker=this;s.jobId=job.id;
      s.selectionMatched=job.selectedIndices.length===s.expectedIndices.length &&
        job.selectedIndices.every((v,i)=>v===s.expectedIndices[i]);
      if(s.successorMode && s.workerRequests===1){
        s.firstWorker=this;s.firstJobId=job.id;
      }
      if(s.successorMode && s.workerRequests===2){
        s.successorWorker=this;s.successorJobId=job.id;
        s.successorHeld=true;s.successorPending={job,args};
      }
      this.addEventListener('message',event=>{
        if(event.data?.id===job.id && event.data?.ok===true){
          // The first native reply is already counted. Deliberately injected
          // late events on its terminated Worker cannot become a second reply.
          if(s.successorMode && this===s.firstWorker && s.firstCompletionRecorded)return;
          if(s.successorMode && this===s.firstWorker)s.firstCompletionRecorded=true;
          s.workerReplies++;
          s.workerReplyFilled=event.data.result?.filled;
          s.workerReplyChangedTiles=event.data.result?.changedTiles;
          s.workerResultNativeSource=event.data.result?.source?.kind==='zpe-pixel-buffer-source-v2';
        }
      });
      if(s.successorMode && this===s.successorWorker && s.successorHeld)return;
      return post.call(this,job,...args);
    }
    return post.call(this,job,...args);
  };
  Worker.prototype.terminate=function(...args){
    if(this===s.worker)s.workerTerminations++;
    return terminate.apply(this,args);
  };
  s.resumeSuccessor=()=>{
    if(!s.successorMode || !s.successorHeld || !s.successorPending)
      throw Error('037C-3b-2b/3b-2b successor job not held');
    const pending=s.successorPending;
    s.successorPending=null;s.successorHeld=false;
    post.call(s.successorWorker,pending.job,...pending.args);
    return true;
  };
  CanvasRenderingContext2D.prototype.putImageData=function(image,x,y,...args){
    // The private tiled preview canvas has the photo's dimensions.
    if(s.workerReplies===1 && this.canvas?.width===1025 &&
      this.canvas?.height===1025 && image?.width<=256 && image?.height<=256)
      s.previewTileWrites++;
    return put.call(this,image,x,y,...args);
  };
  window.setTimeout=function(callback,delay,...args){
    // Hold one cooperative preview yield after at least two private tiles.
    if(s.workerReplies===1 && s.workerTerminations===1 &&
      s.previewTileWrites>=2 && !s.previewYieldHeld &&
      delay===0 && typeof callback==='function'){
      s.previewYieldHeld=true;
      const timerId=timer.call(window,callback,300000,...args);
      s.heldPreview={callback,args,timerId};
      return timerId;
    }
    return timer.call(window,callback,delay,...args);
  };
  s.releasePreview=()=>{
    if(!s.previewYieldHeld || !s.heldPreview || s.previewReleased)
      throw Error('037C-3b-2b/3b-1 preview was not held');
    const held=s.heldPreview;
    s.heldPreview=null;s.previewReleased=true;
    clear.call(window,held.timerId);
    held.callback(...held.args);
    return true;
  };
  return true;
}

async function publicSurvivorSnapshot(label){
  const s=window.__photoFailure;
  if(!['before','after'].includes(label)) throw Error('037C-3b-2b/2 invalid survivor stage');
  const tabs=()=>[...document.querySelectorAll('#docTabs .doc-tab')];
  if(label==='before'){
    if(tabs().length!==2) throw Error('037C-3b-2b/2 needs two tabs before close');
    tabs()[1].click();
  }else if(tabs().length!==1 || tabs()[0].getAttribute('aria-selected')!=='true'){
    throw Error('037C-3b-2b/2 close did not leave one active survivor');
  }
  let blob=null;
  const original=URL.createObjectURL;
  URL.createObjectURL=function(value,...args){
    if(value instanceof Blob && value.type==='application/json')blob=value;
    return original.call(URL,value,...args);
  };
  try{
    document.querySelector('.menu-button[data-menu="file"]').click();
    const save=[...document.querySelectorAll('#menuPopover .menu-item')].find(
      b=>b.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
    if(!save || save.disabled) throw Error('037C-3b-2b/2 public survivor Save Project unavailable');
    save.click();
    if(!blob)throw Error('037C-3b-2b/2 missing survivor project JSON');
    const project=JSON.parse(await blob.text());
    const history=[...document.querySelectorAll('#historyList .history-row')]
      .map(row=>row.textContent);
    const photoLeaked=!!project.layers?.some(layer=>
      layer.name==='Pinned photo defect (8-bit derived)' || layer.highDepthSource);
    s.survivorSnapshots[label]={project:JSON.stringify(project),history};
    return {stage:label,photoLeaked,historyRows:history.length,
      projectUnchanged:label==='after'
        ? s.survivorSnapshots.before?.project===s.survivorSnapshots.after.project
        : null,
      historyUnchanged:label==='after'
        ? JSON.stringify(s.survivorSnapshots.before?.history)===JSON.stringify(history)
        : null};
  }finally{
    URL.createObjectURL=original;
    if(label==='before') tabs()[0]?.click();
  }
}
function closeActivePhotoTab(){
  const s=window.__photoFailure;
  const tabs=[...document.querySelectorAll('#docTabs .doc-tab-shell')];
  const close=tabs[0]?.querySelector('.doc-tab-close');
  if(tabs.length!==2 || close?.hidden || !close ||
    tabs[0]?.querySelector('.doc-tab')?.getAttribute('aria-selected')!=='true')
    throw Error('037C-3b-2b/2 photo tab not selected or close unavailable');
  const originalConfirm=window.confirm;
  window.confirm=()=>true;
  try{close.click();}finally{window.confirm=originalConfirm;}
  return {originalRemoved:document.querySelectorAll('#docTabs .doc-tab').length===1,
    survivorSelected:document.querySelector('#docTabs .doc-tab')?.getAttribute('aria-selected')==='true',
    terminations:s.workerTerminations};
}
function injectLateAfterClose(){
  const s=window.__photoFailure;
  if(!s.worker || s.workerTerminations!==1 || s.workerRequests!==1 ||
    !Number.isSafeInteger(s.jobId))
    throw Error('037C-3b-2b/2 close cancellation not observed before late message');
  const delivered=s.worker.dispatchEvent(new MessageEvent('message',{
    data:{id:s.jobId,ok:true,result:{source:s.snapshots.before,
      changed:1,filled:8288,changedTiles:1,loadedTiles:1}},
  }));
  return {delivered,tabs:document.querySelectorAll('#docTabs .doc-tab').length};
}
function injectLateAfterEscape(){
  const s=window.__photoFailure;
  if(!s.worker || s.workerTerminations!==1 || s.workerRequests!==1 ||
    !Number.isSafeInteger(s.jobId))
    throw Error('037C-3b-2b/3a Escape cancellation not observed before late message');
  const delivered=s.worker.dispatchEvent(new MessageEvent('message',{
    data:{id:s.jobId,ok:true,result:{source:s.snapshots.before,
      changed:1,filled:8288,changedTiles:1,loadedTiles:1}},
  }));
  return {delivered,activePhotoTab:
    document.querySelectorAll('#docTabs .doc-tab')[0]?.getAttribute('aria-selected')==='true'};
}
function checkOtherHistoryAfterEscape(){
  const s=window.__photoFailure;
  const tabs=()=>[...document.querySelectorAll('#docTabs .doc-tab')];
  if(tabs().length!==2 || tabs()[0]?.getAttribute('aria-selected')!=='true')
    throw Error('037C-3b-2b/3a original photo tab not active');
  tabs()[1].click();
  const history=[...document.querySelectorAll('#historyList .history-row')]
    .map(row=>row.textContent);
  const secondSelected=tabs()[1]?.getAttribute('aria-selected')==='true';
  tabs()[0].click();
  return {secondSelected,
    originalSelected:tabs()[0]?.getAttribute('aria-selected')==='true',
    historyUnchanged:JSON.stringify(history)===JSON.stringify(s.secondHistoryBefore)};
}
function invokeFill(){
  document.querySelector('.menu-button[data-menu="edit"]').click();
  const action=[...document.querySelectorAll('#menuPopover .menu-item')].find(
    b=>b.querySelector('span')?.textContent==='Контент-заливка выделения');
  if(!action || action.disabled) return false;
  action.click();return true;
}
function switchTab(){
  document.querySelectorAll('#docTabs .doc-tab')[1]?.click();
  // Tab activation rebuilds #docTabs; the clicked DOM node is detached.
  return document.querySelectorAll('#docTabs .doc-tab')[1]
    ?.getAttribute('aria-selected')==='true';
}
function injectLateAndReturnToOriginal(){
  const s=window.__photoFailure;
  if(s.workerTerminations!==1 || s.workerRequests!==1 || !s.worker ||
     !Number.isSafeInteger(s.jobId))
    throw Error('037C-3b-2a cancellation not observed before late injection');
  const worker=s.worker;
  const delivered=worker.dispatchEvent(new MessageEvent('message',{
    data:{id:s.jobId,ok:true,result:{source:s.snapshots.before,
      changed:1,filled:8288,changedTiles:1,loadedTiles:1}},
  }));
  const secondHistory=[...document.querySelectorAll('#historyList .history-row')]
    .map(r=>r.textContent);
  document.querySelectorAll('#docTabs .doc-tab')[0]?.click();
  return {delivered,secondHistory,firstSelected:
    document.querySelectorAll('#docTabs .doc-tab')[0]?.getAttribute('aria-selected')};
}

function injectStaleFirstWorkerReply(){
  const s=window.__photoFailure;
  if(!s.successorMode || !s.firstWorker || !s.firstCompletionRecorded ||
    s.workerRequests!==2 || s.workerTerminations<1 ||
    !Number.isSafeInteger(s.firstJobId))
    throw Error('037C-3b-2b/3b-2b first native reply not completed');
  const delivered=s.firstWorker.dispatchEvent(new MessageEvent('message',{
    data:{id:s.firstJobId,ok:true,result:{source:s.snapshots.before,
      changed:1,filled:8288,changedTiles:1,loadedTiles:1}},
  }));
  s.staleFirstMessages=(s.staleFirstMessages||0)+1;
  return {delivered,staleMessages:s.staleFirstMessages};
}
function inspectHeldSuccessor(){
  const s=window.__photoFailure;
  const history=[...document.querySelectorAll('#historyList .history-row')]
    .map(row=>row.textContent);
  return {pending:s.successorHeld,requests:s.workerRequests,replies:s.workerReplies,
    historyExact:JSON.stringify(history)===JSON.stringify(s.historyBefore),
    fillHistoryEntries:history.filter(row=>row.includes('Контент-заливка')).length,
    prematureSuccess:document.querySelector('#statusText')?.textContent
      ?.includes('Контент-заливка: восстановлено')===true};
}

function inspectPublishedNativeFill(){
  const s=window.__photoFailure,a=s.snapshots.before,b=s.snapshots.published;
  if(!a || !b || a.tiles.length!==b.tiles.length)throw Error('missing public native readback');
  const nativeChangedTiles=a.tiles.reduce((count,tile,i)=>
    count+(tile.dataUrl===b.tiles[i].dataUrl?0:1),0);
  const history=[...document.querySelectorAll('#historyList .history-row')]
    .map(row=>row.textContent);
  s.publishedHistory=history;
  return {nativeChangedTiles,
    fillHistoryEntries:history.filter(value=>value.includes('Контент-заливка')).length,
    historyAddedExactlyOnce:history.length===s.historyBefore.length+1};
}
function inspectPublishedAfterEscape(){
  const s=window.__photoFailure;
  window.__photoFailureAssertNative(s.snapshots.published,s.snapshots.after,
    '037C-3b-2b/3b-2a Escape must preserve completed native Fill');
  const history=[...document.querySelectorAll('#historyList .history-row')]
    .map(row=>row.textContent);
  return {nativeExact:true,
    historyExact:JSON.stringify(history)===JSON.stringify(s.publishedHistory),
    fillHistoryEntries:history.filter(value=>value.includes('Контент-заливка')).length};
}
function compareSnapshots(){
  const s=window.__photoFailure;
  const before=s.snapshots.before,after=s.snapshots.after;
  // Exact public v2 native tile base64 equality: all pixels, all alpha and
  // metadata, including unchanged tiles; NOT Canvas8 pixels.
  const proof=window.__photoFailureAssertNative(before,after,'037C cancelled worker');
  const history=[...document.querySelectorAll('#historyList .history-row')]
    .map(r=>r.textContent);
  return {nativeExact:proof===true,historyExact:
    JSON.stringify(history)===JSON.stringify(s.historyBefore),
    fillHistoryEntries:history.filter(x=>x.includes('Контент-заливка')).length};
}

export async function verifyGenuinePhotoUiSwitchFailure(client,{
  evaluate,waitFor,assert,format,runIndex,sourceDir,artifactDir,baseline,
  midKernel=false,closeDocument=false,escapeCancel=false,completedPreviewEscape=false,
  completedPreviewSuccess=false,cancelFirstSuccessor=false,malformedReply=false,
  malformedKind='alpha',
}={}){
  if(closeDocument && !midKernel)
    throw new TypeError('037C-3b-2b/2 requires genuine post-write kernel cancellation');
  if(escapeCancel && (!midKernel || closeDocument))
    throw new TypeError('037C-3b-2b/3a requires an isolated post-write Escape scenario');
  if(completedPreviewEscape && (midKernel || closeDocument || escapeCancel || completedPreviewSuccess))
    throw new TypeError('037C-3b-2b/3b-1 requires isolated completed-Worker preview race');
  if(cancelFirstSuccessor && (midKernel || closeDocument || escapeCancel || completedPreviewEscape || completedPreviewSuccess))
    throw new TypeError('037C-3b-2b/3b-2b requires isolated cancel-first successor');
  if(completedPreviewSuccess && (midKernel || closeDocument || escapeCancel))
    throw new TypeError('037C-3b-2b/3b-2a requires an isolated preview success');
  if(malformedReply && !['alpha','counter','outside','nonfinite-nan','nonfinite-infinity'].includes(malformedKind))
    throw new TypeError('037C-3b-3 unknown malformed kind');
  if(malformedReply && (midKernel || closeDocument || escapeCancel || completedPreviewEscape || completedPreviewSuccess || cancelFirstSuccessor))
    throw new TypeError('037C-3b-3/2a requires an isolated real Worker malformed reply');
  const fmt=FORMATS[format];
  if(!fmt || runIndex!==1 || !sourceDir || !artifactDir ||
    !baseline?.publicSaveNativeMatchedFrozenPin || baseline.nativeDefectSha256?.length!==64)
    throw new TypeError('037C-3b-2a needs genuine pinned photo baseline');
  const [pins,manifest,rgba]=await Promise.all([
    readFile(path.join(ROOT,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(ROOT,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readFile(path.join(sourceDir,'..','decoded.rgba')),
  ]);
  const admitted=createPinnedPhotoNativeFixture({rgba,width:manifest.decoded.width,
    height:manifest.decoded.height,expectedRgbaSha256:manifest.decoded.sha256,
    bitsPerChannel:fmt.bits,
    expectedReferenceSha256:manifest.native[fmt.key].cleanSha256});
  assert(admitted.admitted && admitted.selectedIndices.length===8288 &&
    baseline.nativeDefectSha256===pins.documents[format].nativeSha256,
    '037C-3b-2a genuine photo independent pins unavailable');
  const started=Date.now();
  const polygon=createWideConnectedUiPolygon(1025,1025,admitted.roiOrigin);
  await evaluate(client,'window.__photoFailure={malformedKind:'+JSON.stringify(malformedKind)+',bits:'+fmt.bits+
    ',polygon:'+JSON.stringify(polygon)+',expectedIndices:'+
    JSON.stringify(Array.from(admitted.selectedIndices))+
    ',snapshots:{},survivorSnapshots:{},workerRequests:0,workerTerminations:0};true');
  const snapshot=label=>evaluate(client,'('+publicNativeSnapshot.toString()+')('+JSON.stringify(label)+')');
  try{
    const before=await snapshot('before');
    assert(before.tiles>1 && before.bits===fmt.bits,'037C-3b-2a invalid initial native tiles');
    const tabs=await evaluate(client,'('+prepareTabs.toString()+')()');
    if(escapeCancel || completedPreviewEscape || completedPreviewSuccess || cancelFirstSuccessor || malformedReply)await evaluate(client,'window.__photoFailure.secondHistoryBefore='+JSON.stringify(tabs.secondHistory)+';true');
    if(closeDocument){
      const survivor=await evaluate(client,'('+publicSurvivorSnapshot.toString()+')("before")');
      assert(survivor.photoLeaked===false && survivor.historyRows===tabs.secondHistory.length,
        '037C-3b-2b/2 survivor baseline invalid',JSON.stringify(survivor));
      // The tab click changes the active document immediately, but the render
      // canvases are resized in a later frame. Do not use the survivor's
      // 1200x800 overlay to project the pinned 1025x1025 photo polygon.
      await waitFor('037C-3b-2b/2 photo canvas restored after survivor Save Project',
        ()=>evaluate(client,`(()=>{
          const tabs=[...document.querySelectorAll('#docTabs .doc-tab')];
          const overlay=document.querySelector('#overlayCanvas');
          return tabs.length===2 && tabs[0].getAttribute('aria-selected')==='true' &&
            overlay?.width===1025 && overlay?.height===1025;
        })()`),10000);
    }
    const view=await evaluate(client,'('+setupPolygon.toString()+')()');
    assert(view.width===1025 && view.height===1025 && view.inWindow &&
      view.hits.every(x=>x==='overlayCanvas'),
      '037C-3b-2a polygon not visible in Chromium',JSON.stringify(view));
    for(const point of view.points){
      await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y,button:'left',buttons:0});
      await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
      await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
    }
    for(const type of ['keyDown','keyUp']) await client.send('Input.dispatchKeyEvent',{
      type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    const selection=await evaluate(client,
      'document.querySelector("#statusText")?.textContent');
    assert(selection?.includes('Многоугольное выделение: 10 точек'),
      '037C-3b-2a polygon selection not committed',selection);
    // Browser-side comparison function has no access to the private app state.
    await evaluate(client,'window.__photoFailureAssertNative=('+assertEqualNativeTiles.toString()+
      ');window.__photoFailure.historyBefore=[...document.querySelectorAll("#historyList .history-row")].map(r=>r.textContent);true');
    // assertEqualNativeTiles throws on mismatch; wrapper returns a boolean.
    await evaluate(client,'window.__photoFailureAssertNative=((f)=>((a,b,label)=>{f(a,b,label);return true}))(window.__photoFailureAssertNative);true');
    if(midKernel){
      assert(await evaluate(client,'('+ensureGeneratedWorkerSupplier.toString()+')()'),
        '037C-3b-2b generated Worker supplier unavailable');
    }
    if(cancelFirstSuccessor)await evaluate(client,'window.__photoFailure.successorMode=true;true');
    await evaluate(client,malformedReply
      ? '('+installMalformedNativeWorkerReply.toString()+')()'
      : completedPreviewEscape || completedPreviewSuccess || cancelFirstSuccessor
      ? '('+installCompletedWorkerPreviewHold.toString()+')()'
      : midKernel
        ? '('+installMidKernelNativeWorker.toString()+')('+instrumentBrowserKernelSource.toString()+')'
        : '('+installHeldNativeWorker.toString()+')()');
    assert(await evaluate(client,'('+invokeFill.toString()+')()'),
      '037C-3b-2a UI native fill disabled');
    await waitFor('037C-3b-2a actual native Worker posted held job',()=>evaluate(client,
      'window.__photoFailure?.workerRequests===1'),30000);
    const tracked=await evaluate(client,
      '({selected:window.__photoFailure.selectionMatched,terminated:window.__photoFailure.workerTerminations})');
    assert(tracked.selected===true && tracked.terminated===0,
      '037C-3b-2a genuine ROI job not intercepted',JSON.stringify(tracked));
    if(midKernel){
      // The Worker has synthesized a native pixel and is held inside the
      // actual kernel, not behind an intercepted job postMessage.
      await waitFor('037C-3b-2b genuine native photo kernel write probe',()=>evaluate(client,
        'window.__photoFailure?.kernelWrites===1'),15000);
      const progress=await evaluate(client,
        '({dispatched:window.__photoFailure.dispatched,filled:window.__photoFailure.probeReportedFilled,sample:window.__photoFailure.firstNativeSampleAfterWrite,replies:window.__photoFailure.workerReplies})');
      assert(progress.dispatched===true && progress.filled===1 &&
        Number.isFinite(progress.sample) && progress.replies===0,
        '037C-3b-2b real kernel write not observed before cancellation',JSON.stringify(progress));
    }

    if(malformedReply){
      await waitFor('037C-3b-3/2a genuine Worker rejected before native publication',
        ()=>evaluate(client,
          'window.__photoFailure?.mutated===true && '+
          'document.querySelector("#statusText")?.textContent?.includes("invalid Worker result")===true'),
        60000);
      const state=await evaluate(client,
        '({requests:window.__photoFailure.workerRequests,replies:window.__photoFailure.workerReplies,'+
        'terminations:window.__photoFailure.workerTerminations,'+
        'selectionMatched:window.__photoFailure.selectionMatched,'+
        'real:window.__photoFailure.realWorkerNativeResultObserved,'+
        'filled:window.__photoFailure.realWorkerReplyFilled,'+
        'tiles:window.__photoFailure.realWorkerChangedTiles,'+
        'alpha:window.__photoFailure.selectedAlphaByteCorrupted,'+
        'counter:window.__photoFailure.counterCorrupted,'+
         'outside:window.__photoFailure.outsideRoiByteCorrupted,'+
         'nonfinite:window.__photoFailure.nonfiniteColorSample,'+
        'replyChanged:window.__photoFailure.realWorkerReplyChanged,'+
        'mutatedChanged:window.__photoFailure.mutatedChangedCount,'+
        'before:window.__photoFailure.mutatedBeforeUiValidation,'+
        'preview:window.__photoFailure.previewTileWrites})');
      assert(state.requests===1 && state.replies===1 && state.terminations===1 &&
        state.selectionMatched && state.real && state.filled===8288 && state.tiles>=2 &&
        (malformedKind==='counter'
          ? state.counter && state.alpha===false &&
            state.replyChanged>state.tiles && state.mutatedChanged===state.replyChanged-1
          : malformedKind==='outside'
             ? state.outside===true && state.alpha===false
             : malformedKind==='nonfinite-nan'
               ? state.nonfinite==='nan' && state.alpha===false
               : malformedKind==='nonfinite-infinity'
                 ? state.nonfinite==='infinity' && state.alpha===false
                 : state.alpha) && state.before && state.preview===0,
        '037C-3b-3/2a malformed Worker was not blocked before preview',
        JSON.stringify(state));
      await snapshot('after');
      const cancelled=await evaluate(client,'('+compareSnapshots.toString()+')()');
      assert(cancelled.nativeExact && cancelled.historyExact && cancelled.fillHistoryEntries===0,
        '037C-3b-3/2a malformed Worker published private native tiles',
        JSON.stringify(cancelled));
      const other=await evaluate(client,'('+checkOtherHistoryAfterEscape.toString()+')()');
      assert(other.historyUnchanged && other.originalSelected,
        '037C-3b-3/2a malformed result changed unrelated tab',JSON.stringify(other));
      const counter=malformedKind==='counter',extra=malformedKind!=='alpha' && !counter;
      const receipt={
        kind:extra?'zpe-real-photo-browser-malformed-extra-v1':
          counter?'zpe-real-photo-browser-malformed-counter-v1':
            'zpe-real-photo-browser-malformed-alpha-v1',
        status:extra?'native-worker-malformed-extra-rejected-by-public-ui':
          counter?'native-worker-counter-corrupted-rejected-by-public-ui':
            'native-worker-alpha-corrupted-rejected-by-public-ui',
        malformedKind:extra?malformedKind:undefined,
        format,runIndex,protocol:'file:',inputFileSha256:baseline.inputFileSha256,
        nativeDefectSha256:baseline.nativeDefectSha256,
        sourcePhotoSha256:manifest.sourceSha256,
        bitsPerChannel:fmt.bits,selectedPixels:8288,
        workerRequests:state.requests,workerReplies:state.replies,
        workerTerminations:state.terminations,selectionMatched:state.selectionMatched,
        realWorkerNativeResultObserved:state.real,realWorkerReplyFilled:state.filled,
        realWorkerChangedTiles:state.tiles,
        realWorkerReplyChanged:counter?state.replyChanged:undefined,
        mutatedChangedCount:counter?state.mutatedChanged:undefined,
        transportMutation:counter?'changed-count-minus-one':
          malformedKind==='outside'?'outside-roi-color-byte':
            malformedKind==='nonfinite-nan'?'selected-color-nan':
              malformedKind==='nonfinite-infinity'?'selected-color-infinity':'selected-alpha-one-byte',
        mutatedBeforeUiValidation:state.before,selectedAlphaByteCorrupted:state.alpha,
        counterCorrupted:counter?state.counter:extra?false:undefined,
        outsideRoiByteCorrupted:extra?state.outside:undefined,
        nonfiniteColorSample:extra?state.nonfinite:undefined,
        publicInvalidWorkerStatusObserved:true,privatePreviewTileWrites:state.preview,
        nativeBytesUnchanged:cancelled.nativeExact,originalHistoryUnchanged:cancelled.historyExact,
        fillHistoryEntries:cancelled.fillHistoryEntries,
        secondTabHistoryUnchanged:other.historyUnchanged,
        maxBytesVerified:false,photoshopCompatibilityVerified:false,
        startedAtUnixMs:started,elapsedMs:Date.now()-started,
      };
      if(extra)validateRealPhotoMalformedExtraReceipt(receipt,pins,manifest);
      else if(counter)validateRealPhotoMalformedCounterReceipt(receipt,pins,manifest);
      else validateRealPhotoMalformedReplyReceipt(receipt,pins,manifest);
      await mkdir(artifactDir,{recursive:true});
      const output=path.join(artifactDir,'real-photo-'+format+
        (extra?'-malformed-'+malformedKind+'-run-1.json':
          counter?'-malformed-counter-run-1.json':'-malformed-alpha-run-1.json'));
      await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
      console.log('037C-3b-3 malformed genuine Worker rejected:',JSON.stringify({output,...receipt}));
      return receipt;
    }

    if(completedPreviewSuccess){
      await waitFor('037C-3b-2b/3b-2a real Worker reply, held preview',()=>evaluate(client,
        'window.__photoFailure?.workerReplies===1 && window.__photoFailure?.previewYieldHeld===true'),60000);
      const state=await evaluate(client,
        '({replies:window.__photoFailure.workerReplies,terminations:window.__photoFailure.workerTerminations,'+
        'filled:window.__photoFailure.workerReplyFilled,changed:window.__photoFailure.workerReplyChangedTiles,'+
        'native:window.__photoFailure.workerResultNativeSource,writes:window.__photoFailure.previewTileWrites})');
      assert(state.replies===1 && state.terminations===1 && state.filled===8288 &&
        state.changed>=2 && state.native===true && state.writes>=2,
        '037C-3b-2b/3b-2a real Worker completion not observed',JSON.stringify(state));
      assert(await evaluate(client,'window.__photoFailure.releasePreview()===true'),
        '037C-3b-2b/3b-2a did not release private preview');
      await waitFor('037C-3b-2b/3b-2a successful native publication',()=>evaluate(client,
        'document.querySelector("#statusText")?.textContent?.includes("Контент-заливка: восстановлено")===true'),30000);
      await snapshot('published');
      const published=await evaluate(client,'('+inspectPublishedNativeFill.toString()+')()');
      assert(published.nativeChangedTiles>=2 && published.historyAddedExactlyOnce &&
        published.fillHistoryEntries===1,
        '037C-3b-2b/3b-2a no single committed native Fill',JSON.stringify(published));
      for(const type of ['keyDown','keyUp'])await client.send('Input.dispatchKeyEvent',{
        type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
      const statusAfter=await evaluate(client,'document.querySelector("#statusText")?.textContent||""');
      assert(!statusAfter.includes('Контент-заливка отменена'),
        '037C-3b-2b/3b-2a completed Fill incorrectly cancelled',statusAfter);
      await evaluate(client,'new Promise(resolve=>setTimeout(resolve,180))');
      await snapshot('after');
      const after=await evaluate(client,'('+inspectPublishedAfterEscape.toString()+')()');
      assert(after.nativeExact && after.historyExact && after.fillHistoryEntries===1,
        '037C-3b-2b/3b-2a Escape rolled back committed native Fill/History',JSON.stringify(after));
      const other=await evaluate(client,'('+checkOtherHistoryAfterEscape.toString()+')()');
      assert(other.secondSelected && other.originalSelected && other.historyUnchanged,
        '037C-3b-2b/3b-2a other tab History changed',JSON.stringify(other));
      const receipt={
        kind:'zpe-real-photo-browser-preview-success-v1',
        status:'real-worker-published-before-public-escape',
        format,runIndex,protocol:'file:',
        inputFileSha256:baseline.inputFileSha256,
        nativeDefectSha256:baseline.nativeDefectSha256,
        sourcePhotoSha256:manifest.sourceSha256,
        bitsPerChannel:fmt.bits,selectedPixels:8288,
        workerRequests:1,workerReplies:state.replies,workerTerminations:state.terminations,
        workerResultNativeSource:state.native,workerReplyFilled:state.filled,
        workerReplyChangedTiles:state.changed,previewTileWrites:state.writes,
        previewYieldHeld:true,previewReleasedBeforeEscape:true,successStatusObserved:true,
        fillHistoryEntriesBeforeEscape:published.fillHistoryEntries,
        historyAddedExactlyOnce:published.historyAddedExactlyOnce,
        nativeChangedTiles:published.nativeChangedTiles,
        publicEscapeKeyDispatched:true,cancelStatusObservedAfterEscape:false,
        committedNativeBytesSurvivedEscape:after.nativeExact,
        committedHistorySurvivedEscape:after.historyExact,
        secondTabHistoryUnchanged:other.historyUnchanged,
        fillHistoryEntriesAfterEscape:after.fillHistoryEntries,
        successFirstVerified:true,cancelFirstVerified:false,
        memoryCapVerified:false,photoshopCompatibilityVerified:false,
        startedAtUnixMs:started,elapsedMs:Date.now()-started,
      };
      validateRealPhotoCompletedPreviewSuccessReceipt(receipt,pins,manifest);
      await mkdir(artifactDir,{recursive:true});
      const output=path.join(artifactDir,'real-photo-'+format+'-completed-preview-success-run-1.json');
      await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
      console.log('037C-3b-2b/3b-2a real completed Fill before Escape:',JSON.stringify({output,...receipt}));
      return receipt;
    }


    if(cancelFirstSuccessor){
      await waitFor('037C-3b-2b/3b-2b first genuine Worker result held in preview',
        ()=>evaluate(client,
          'window.__photoFailure?.workerReplies===1 && window.__photoFailure?.previewYieldHeld===true'),
        60000);
      const first=await evaluate(client,
        '({replies:window.__photoFailure.workerReplies,terminations:window.__photoFailure.workerTerminations,'+
        'filled:window.__photoFailure.workerReplyFilled,changed:window.__photoFailure.workerReplyChangedTiles,'+
        'native:window.__photoFailure.workerResultNativeSource,writes:window.__photoFailure.previewTileWrites})');
      assert(first.replies===1 && first.terminations===1 && first.filled===8288 &&
        first.changed>=2 && first.native===true && first.writes>=2,
        '037C-3b-2b/3b-2b first real Worker reply not observed',JSON.stringify(first));
      for(const type of ['keyDown','keyUp'])await client.send('Input.dispatchKeyEvent',{
        type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
      const cancelledStatus=await evaluate(client,'document.querySelector("#statusText")?.textContent');
      assert(cancelledStatus?.includes('Контент-заливка отменена'),
        '037C-3b-2b/3b-2b public first Escape did not cancel Fill',cancelledStatus);
      assert(await evaluate(client,'window.__photoFailure.releasePreview()===true'),
        '037C-3b-2b/3b-2b first preview did not resume after cancellation');
      await evaluate(client,'new Promise(resolve=>setTimeout(resolve,180))');
      await snapshot('after');
      const cancelled=await evaluate(client,'('+compareSnapshots.toString()+')()');
      assert(cancelled.nativeExact && cancelled.historyExact && cancelled.fillHistoryEntries===0,
        '037C-3b-2b/3b-2b first cancelled result was published',JSON.stringify(cancelled));
      assert(await evaluate(client,'('+invokeFill.toString()+')()'),
        '037C-3b-2b/3b-2b successor public Fill unavailable');
      await waitFor('037C-3b-2b/3b-2b second native Worker job held before dispatch',
        ()=>evaluate(client,'window.__photoFailure?.workerRequests===2 && window.__photoFailure?.successorHeld===true'),
        30000);
      const staleDuring=await evaluate(client,'('+injectStaleFirstWorkerReply.toString()+')()');
      assert(staleDuring.delivered && staleDuring.staleMessages===1,
        '037C-3b-2b/3b-2b first late event could not be injected during successor');
      await evaluate(client,'new Promise(resolve=>setTimeout(resolve,120))');
      const held=await evaluate(client,'('+inspectHeldSuccessor.toString()+')()');
      assert(held.pending && held.requests===2 && held.replies===1 &&
        held.historyExact && held.fillHistoryEntries===0 && !held.prematureSuccess,
        '037C-3b-2b/3b-2b stale first result prematurely committed',JSON.stringify(held));
      assert(await evaluate(client,'window.__photoFailure.resumeSuccessor()===true'),
        '037C-3b-2b/3b-2b real successor Worker was not dispatched');
      await waitFor('037C-3b-2b/3b-2b second genuine Worker published native Fill',
        ()=>evaluate(client,
          'window.__photoFailure?.workerReplies===2 && '+
          'document.querySelector("#statusText")?.textContent?.includes("Контент-заливка: восстановлено")===true'),
        60000);
      const second=await evaluate(client,
        '({requests:window.__photoFailure.workerRequests,replies:window.__photoFailure.workerReplies,'+
        'terminations:window.__photoFailure.workerTerminations,'+
        'filled:window.__photoFailure.workerReplyFilled,changed:window.__photoFailure.workerReplyChangedTiles,'+
        'native:window.__photoFailure.workerResultNativeSource})');
      assert(second.requests===2 && second.replies===2 && second.terminations===2 &&
        second.filled===8288 && second.changed>=2 && second.native,
        '037C-3b-2b/3b-2b genuine successor Worker failed',JSON.stringify(second));
      await snapshot('published');
      const published=await evaluate(client,'('+inspectPublishedNativeFill.toString()+')()');
      assert(published.nativeChangedTiles>=2 && published.historyAddedExactlyOnce &&
        published.fillHistoryEntries===1,
        '037C-3b-2b/3b-2b successor native Fill/history absent',JSON.stringify(published));
      const staleAfter=await evaluate(client,'('+injectStaleFirstWorkerReply.toString()+')()');
      assert(staleAfter.delivered && staleAfter.staleMessages===2,
        '037C-3b-2b/3b-2b first late event after successor missing');
      await evaluate(client,'new Promise(resolve=>setTimeout(resolve,180))');
      await snapshot('after');
      const surviving=await evaluate(client,'('+inspectPublishedAfterEscape.toString()+')()');
      assert(surviving.nativeExact && surviving.historyExact && surviving.fillHistoryEntries===1,
        '037C-3b-2b/3b-2b stale Worker overwrote successor',JSON.stringify(surviving));
      const other=await evaluate(client,'('+checkOtherHistoryAfterEscape.toString()+')()');
      assert(other.secondSelected && other.originalSelected && other.historyUnchanged,
        '037C-3b-2b/3b-2b other document History changed',JSON.stringify(other));
      const receipt={
        kind:'zpe-real-photo-browser-cancel-successor-v1',
        status:'public-cancel-first-successor-worker-committed-late-ignored',
        format,runIndex,protocol:'file:',
        inputFileSha256:baseline.inputFileSha256,
        nativeDefectSha256:baseline.nativeDefectSha256,
        sourcePhotoSha256:manifest.sourceSha256,
        bitsPerChannel:fmt.bits,selectedPixels:8288,
        workerRequests:second.requests,workerReplies:second.replies,
        workerTerminations:second.terminations,
        firstWorkerNativeSource:first.native,firstWorkerReplyFilled:first.filled,
        firstWorkerChangedTiles:first.changed,firstPreviewTileWrites:first.writes,
        firstPreviewYieldHeld:true,firstWorkerTerminatedBeforeEscape:true,
        publicEscapeKeyDispatched:true,cancelStatusObserved:true,
        firstPreviewReleasedAfterCancel:true,
        cancelledNativeUnchanged:cancelled.nativeExact,
        cancelledHistoryUnchanged:cancelled.historyExact,
        successorJobHeldBeforeDispatch:true,
        lateFirstReplyDuringSuccessor:staleDuring.delivered,
        noPrematureSuccessorPublication:held.historyExact && !held.prematureSuccess,
        successorRealWorkerNativeSource:second.native,successorWorkerReplyFilled:second.filled,
        successorWorkerChangedTiles:second.changed,
        successorNativeChangedTiles:published.nativeChangedTiles,
        successorHistoryAddedOnce:published.historyAddedExactlyOnce,
        successorFillHistoryEntries:published.fillHistoryEntries,
        lateFirstReplyAfterSuccessor:staleAfter.delivered,
        successorNativeSurvivedLateReply:surviving.nativeExact,
        successorHistorySurvivedLateReply:surviving.historyExact,
        secondTabHistoryUnchanged:other.historyUnchanged,
        fillHistoryEntriesAfterLate:surviving.fillHistoryEntries,
        cancelFirstVerified:true,successFirstVerified:false,
        memoryCapVerified:false,photoshopCompatibilityVerified:false,
        startedAtUnixMs:started,elapsedMs:Date.now()-started,
      };
      validateRealPhotoCancelSuccessorReceipt(receipt,pins,manifest);
      await mkdir(artifactDir,{recursive:true});
      const output=path.join(artifactDir,'real-photo-'+format+'-cancel-successor-run-1.json');
      await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
      console.log('037C-3b-2b/3b-2b genuine photo cancel-first real successor:',JSON.stringify({output,...receipt}));
      return receipt;
    }

    if(completedPreviewEscape){
      await waitFor('037C-3b-2b/3b-1 genuine Worker reply and held preview',
        ()=>evaluate(client,
          'window.__photoFailure?.workerReplies===1 && window.__photoFailure?.previewYieldHeld===true'),
        60000);
      const state=await evaluate(client,
        '({replies:window.__photoFailure.workerReplies,terminations:window.__photoFailure.workerTerminations,'+
        'filled:window.__photoFailure.workerReplyFilled,changed:window.__photoFailure.workerReplyChangedTiles,'+
        'native:window.__photoFailure.workerResultNativeSource,writes:window.__photoFailure.previewTileWrites})');
      assert(state.replies===1 && state.terminations===1 && state.filled===8288 &&
        state.changed>=2 && state.native===true && state.writes>=2,
        '037C-3b-2b/3b-1 genuine completed Worker was not held in preview',
        JSON.stringify(state));
      for(const type of ['keyDown','keyUp'])await client.send('Input.dispatchKeyEvent',{
        type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
      const statusText=await evaluate(client,'document.querySelector("#statusText")?.textContent');
      assert(statusText?.includes('Контент-заливка отменена'),
        '037C-3b-2b/3b-1 Escape cancellation not observed',statusText);
      assert(await evaluate(client,'window.__photoFailure.releasePreview()===true'),
        '037C-3b-2b/3b-1 held preview not released after public Escape');
      await evaluate(client,'new Promise(resolve=>setTimeout(resolve,180))');
      await snapshot('after');
      const compared=await evaluate(client,'('+compareSnapshots.toString()+')()');
      assert(compared.nativeExact===true && compared.historyExact===true &&
        compared.fillHistoryEntries===0,
        '037C-3b-2b/3b-1 stale Worker preview published native bytes/History',
        JSON.stringify(compared));
      const other=await evaluate(client,'('+checkOtherHistoryAfterEscape.toString()+')()');
      assert(other.secondSelected && other.originalSelected && other.historyUnchanged,
        '037C-3b-2b/3b-1 other tab History changed',JSON.stringify(other));
      const receipt={
        kind:'zpe-real-photo-browser-completed-preview-escape-v1',
        status:'public-escape-after-real-worker-reply-before-preview-publication',
        format,runIndex,protocol:'file:',
        inputFileSha256:baseline.inputFileSha256,
        nativeDefectSha256:baseline.nativeDefectSha256,
        sourcePhotoSha256:manifest.sourceSha256,
        bitsPerChannel:fmt.bits,selectedPixels:8288,
        workerRequests:1,workerRepliesBeforeEscape:state.replies,
        workerTerminationsBeforeEscape:state.terminations,
        workerTerminations:await evaluate(client,'window.__photoFailure.workerTerminations'),
        workerResultNativeSource:state.native,workerReplyFilled:state.filled,
        workerReplyChangedTiles:state.changed,
        actualNativeWorkerJobDispatched:true,
        realWorkerResultReceivedBeforeEscape:true,
        previewTileWritesBeforeEscape:state.writes,previewYieldHeldBeforeEscape:true,
        publicEscapeKeyDispatched:true,cancelStatusObserved:true,
        previewReleasedAfterEscape:true,
        originalNativeBytesUnchanged:true,originalHistoryUnchanged:true,
        secondTabHistoryUnchanged:true,fillHistoryEntries:0,
        completedWorkerPreviewRaceVerified:true,
        actualMidKernelCancellationVerified:false,memoryCapVerified:false,
        photoshopCompatibilityVerified:false,
        startedAtUnixMs:started,elapsedMs:Date.now()-started,
      };
      validateRealPhotoCompletedPreviewEscapeReceipt(receipt,pins,manifest);
      await mkdir(artifactDir,{recursive:true});
      const output=path.join(artifactDir,'real-photo-'+format+'-completed-preview-escape-run-1.json');
      await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
      console.log('037C-3b-2b/3b-1 real Worker completion/preview Escape:',
        JSON.stringify({output,...receipt}));
      return receipt;
    }

    if(closeDocument){
      const closed=await evaluate(client,'('+closeActivePhotoTab.toString()+')()');
      assert(closed.originalRemoved && closed.survivorSelected,
        '037C-3b-2b/2 public close failed',JSON.stringify(closed));
      await waitFor('037C-3b-2b/2 post-write Worker terminated on public document close',
        ()=>evaluate(client,'window.__photoFailure?.workerTerminations===1'),10000);
      const inKernel=await evaluate(client,'window.__photoFailure?.terminatedDuringKernel===true');
      assert(inKernel,'037C-3b-2b/2 closed document Worker did not terminate after native write');
      const late=await evaluate(client,'('+injectLateAfterClose.toString()+')()');
      assert(late.delivered===true && late.tabs===1,
        '037C-3b-2b/2 late result was not dispatched after close',JSON.stringify(late));
      await evaluate(client,'new Promise(resolve=>setTimeout(resolve,120))');
      const survivor=await evaluate(client,'('+publicSurvivorSnapshot.toString()+')("after")');
      assert(survivor.projectUnchanged===true && survivor.historyUnchanged===true &&
        survivor.photoLeaked===false && survivor.historyRows===tabs.secondHistory.length,
        '037C-3b-2b/2 closed Worker polluted surviving project/history',
        JSON.stringify(survivor));
      const sample=await evaluate(client,'window.__photoFailure.firstNativeSampleAfterWrite');
      const receipt={
        kind:'zpe-real-photo-browser-mid-kernel-close-v1',
        status:'public-tab-close-mid-kernel-terminated-no-survivor-publication',
        format,runIndex,protocol:'file:',
        inputFileSha256:baseline.inputFileSha256,
        nativeDefectSha256:baseline.nativeDefectSha256,
        sourcePhotoSha256:manifest.sourceSha256,
        bitsPerChannel:fmt.bits,selectedPixels:8288,
        workerRequests:1,workerTerminations:1,
        actualNativeWorkerJobIntercepted:true,
        realKernelJobDispatched:true,realKernelWriteProbeObserved:true,
        probeReportedFilled:1,firstNativeSampleAfterWrite:sample,
        terminatedAfterKernelWriteBeforeReply:true,
        publicTabCloseRevokedOwner:true,originalTabRemoved:true,
        lateMessageInjectedAfterTermination:true,lateMessageIgnored:true,
        survivorProjectUnchanged:true,survivorHistoryUnchanged:true,
        originalNativeAfterCloseObservable:false,
        actualMidKernelCancellationVerified:true,memoryCapVerified:false,
        photoshopCompatibilityVerified:false,
        startedAtUnixMs:started,elapsedMs:Date.now()-started,
      };
      validateRealPhotoMidKernelCloseReceipt(receipt,pins,manifest);
      await mkdir(artifactDir,{recursive:true});
      const output=path.join(artifactDir,'real-photo-'+format+'-mid-kernel-close-run-1.json');
      await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
      console.log('037C-3b-2b/2 real photo public close post-write:',JSON.stringify({output,...receipt}));
      return receipt;
    }
    if(escapeCancel){
      // CDP keyboard input, NOT a direct call to the internal command.
      // The worker is still inside the test-only post-native-write pause.
      for(const type of ['keyDown','keyUp'])await client.send('Input.dispatchKeyEvent',{
        type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
      const statusText=await evaluate(client,'document.querySelector("#statusText")?.textContent');
      assert(statusText?.includes('Контент-заливка отменена'),
        '037C-3b-2b/3a Escape did not use public cancellation handler',statusText);
      await waitFor('037C-3b-2b/3a post-write Worker terminated on public Escape',
        ()=>evaluate(client,'window.__photoFailure?.workerTerminations===1'),10000);
      const inKernel=await evaluate(client,'window.__photoFailure?.terminatedDuringKernel===true');
      assert(inKernel,'037C-3b-2b/3a Escape was not post native write');
      const late=await evaluate(client,'('+injectLateAfterEscape.toString()+')()');
      assert(late.delivered===true && late.activePhotoTab===true,
        '037C-3b-2b/3a late Worker event not dispatched to active photo tab',JSON.stringify(late));
      await evaluate(client,'new Promise(resolve=>setTimeout(resolve,120))');
      await snapshot('after');
      const compared=await evaluate(client,'('+compareSnapshots.toString()+')()');
      assert(compared.nativeExact && compared.historyExact && compared.fillHistoryEntries===0,
        '037C-3b-2b/3a Escape leaked a native edit or History',JSON.stringify(compared));
      const other=await evaluate(client,'('+checkOtherHistoryAfterEscape.toString()+')()');
      assert(other.secondSelected && other.originalSelected && other.historyUnchanged,
        '037C-3b-2b/3a Escape changed survivor History',JSON.stringify(other));
      const sample=await evaluate(client,'window.__photoFailure.firstNativeSampleAfterWrite');
      const receipt={
        kind:'zpe-real-photo-browser-mid-kernel-escape-v1',
        status:'public-escape-mid-kernel-terminated-no-publication',
        format,runIndex,protocol:'file:',
        inputFileSha256:baseline.inputFileSha256,
        nativeDefectSha256:baseline.nativeDefectSha256,
        sourcePhotoSha256:manifest.sourceSha256,
        bitsPerChannel:fmt.bits,selectedPixels:8288,
        workerRequests:1,workerTerminations:1,
        actualNativeWorkerJobIntercepted:true,realKernelJobDispatched:true,
        realKernelWriteProbeObserved:true,probeReportedFilled:1,
        firstNativeSampleAfterWrite:sample,terminatedAfterKernelWriteBeforeReply:true,
        publicEscapeKeyDispatched:true,cancelStatusObserved:true,
        lateMessageInjectedAfterTermination:true,lateMessageIgnored:true,
        originalNativeBytesUnchanged:true,originalHistoryUnchanged:true,
        secondTabHistoryUnchanged:true,fillHistoryEntries:0,
        actualMidKernelCancellationVerified:true,
        completedWorkerPreviewRaceVerified:false,memoryCapVerified:false,
        photoshopCompatibilityVerified:false,
        startedAtUnixMs:started,elapsedMs:Date.now()-started,
      };
      validateRealPhotoMidKernelEscapeReceipt(receipt,pins,manifest);
      await mkdir(artifactDir,{recursive:true});
      const output=path.join(artifactDir,'real-photo-'+format+'-mid-kernel-escape-run-1.json');
      await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
      console.log('037C-3b-2b/3a genuine-photo public Escape post-write:',JSON.stringify({output,...receipt}));
      return receipt;
    }
    assert(await evaluate(client,'('+switchTab.toString()+')()'),
      '037C-3b-2a public document tab switch blocked');
    await waitFor('037C-3b-2a native Worker terminated on session switch',
      ()=>evaluate(client,'window.__photoFailure?.workerTerminations===1'),10000);
    if(midKernel){
      const inKernel=await evaluate(client,'window.__photoFailure?.terminatedDuringKernel===true');
      assert(inKernel,'037C-3b-2b Worker was not terminated after a real kernel write');
    }
    const late=await evaluate(client,'('+injectLateAndReturnToOriginal.toString()+')()');
    assert(late.delivered===true && late.firstSelected==='true' &&
      JSON.stringify(late.secondHistory)===JSON.stringify(tabs.secondHistory),
      '037C-3b-2a late signal / other document history check failed',JSON.stringify(late));
    await evaluate(client,'new Promise(resolve=>setTimeout(resolve,120))');
    await snapshot('after');
    const compared=await evaluate(client,'('+compareSnapshots.toString()+')()');
    assert(compared.nativeExact===true && compared.historyExact===true &&
      compared.fillHistoryEntries===0,'037C-3b-2a cancelled photo source/history changed',
      JSON.stringify(compared));
    const trackedSample=midKernel
      ? await evaluate(client,'window.__photoFailure.firstNativeSampleAfterWrite')
      : null;
    const receipt={
      kind:'zpe-real-photo-browser-cancel-switch-v1',
      status:'public-tab-switch-terminated-no-publication',
      format,runIndex,protocol:'file:',
      inputFileSha256:baseline.inputFileSha256,
      nativeDefectSha256:baseline.nativeDefectSha256,
      sourcePhotoSha256:manifest.sourceSha256,
      bitsPerChannel:fmt.bits,selectedPixels:8288,
      workerRequests:1,workerTerminations:1,
      actualNativeWorkerJobIntercepted:true,jobHeldBeforeKernelDispatch:true,
      publicTabSwitchRevokedOwner:true,lateMessageInjectedAfterTermination:true,
      lateMessageIgnored:true,nativeBytesUnchanged:true,originalHistoryUnchanged:true,
      secondTabHistoryUnchanged:true,
      actualMidKernelCancellationVerified:false,memoryCapVerified:false,
      photoshopCompatibilityVerified:false,
      startedAtUnixMs:started,elapsedMs:Date.now()-started,
    };
    if(midKernel){
      Object.assign(receipt,{
        kind:'zpe-real-photo-browser-mid-kernel-switch-v1',
        status:'public-tab-switch-mid-kernel-terminated-no-publication',
        realKernelJobDispatched:true,realKernelWriteProbeObserved:true,
        probeReportedFilled:1,firstNativeSampleAfterWrite:trackedSample,
        terminatedAfterKernelWriteBeforeReply:true,
        actualMidKernelCancellationVerified:true,
      });
      delete receipt.jobHeldBeforeKernelDispatch;
      validateRealPhotoMidKernelFailureReceipt(receipt,pins,manifest);
    }else{
      validateRealPhotoSwitchFailureReceipt(receipt,pins,manifest);
    }
    await mkdir(artifactDir,{recursive:true});
    const output=path.join(artifactDir,'real-photo-'+format+
      (midKernel?'-mid-kernel-run-1.json':'-failure-run-1.json'));
    await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    console.log(midKernel?'037C-3b-2b real-photo mid-kernel cancellation:':
      '037C-3b-2a real photo Chromium cancellation:',JSON.stringify({output,...receipt}));
    return receipt;
  } finally{
    await evaluate(client,'window.__photoFailure?.restore?.();'+
      'delete window.__photoFailure;delete window.__photoFailureAssertNative;true');
  }
}
