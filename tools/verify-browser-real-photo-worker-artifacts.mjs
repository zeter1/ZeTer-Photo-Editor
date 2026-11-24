// 037C-2: six separate genuine-photo Chromium Worker receipts, fail closed.
// A passing receipt is browser-native quality evidence, NOT process peak RSS,
// Adobe Photoshop compatibility, calibrated ICC, or full 037C completion.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const formats=Object.freeze({psd16:{bits:16,native:'rgb16'},
  psb32:{bits:32,native:'float32'}});
const fail=reason=>{throw new TypeError('037C-2 Worker receipts: '+reason);};
const validMetrics=m=>m && ['mae','rmse','maxAbsoluteError'].every(
  k=>typeof m[k]==='number' && Number.isFinite(m[k]) && m[k]>=0);
export function validateRealPhotoWorkerReceipt(r,pins,manifest){
  if(!r || !Object.hasOwn(formats,r.format) || ![1,2,3].includes(r.runIndex) ||
      !pins?.documents || !manifest?.native) fail('format/run/pins invalid');
  const f=formats[r.format],pin=pins.documents[r.format],reference=manifest.native[f.native];
  if(r.kind!=='zpe-real-photo-browser-native-worker-v1' ||
      r.status!=='ui-worker-quality-undo-redo-reopen-verified' ||
      r.protocol!=='file:' ||
      r.inputFileSha256!==pin?.fileSha256 ||
      r.sourcePhotoSha256!==pins.sourceSha256 ||
      r.sourcePhotoSha256!==manifest.sourceSha256 ||
      r.nativeDefectSha256!==pin?.nativeSha256 ||
      r.nativeDefectSha256!==reference?.damagedSha256 ||
      r.cleanReferenceSha256!==reference?.cleanSha256 ||
      r.bitsPerChannel!==f.bits || r.sourcePrecisionBits!==8 ||
      r.selectedPixels!==8288 || r.scoredSamples!==8288*3 ||
      !Number.isSafeInteger(r.changedSelectedPixels) ||
      r.changedSelectedPixels<1 || r.changedSelectedPixels>8288 ||
      !Number.isSafeInteger(r.changedTiles) || r.changedTiles<2 ||
      r.workerRequests!==1 ||
      r.outsideSelectionAndAlphaNativeWordsExact!==true ||
      r.undoNativeBytesExact!==true || r.redoNativeBytesExact!==true ||
      r.reopenNativeBytesExact!==true ||
      r.workerVerified!==true || r.qualityVerified!==true ||
      r.undoRedoVerified!==true ||
      !validMetrics(r.baseline)||!validMetrics(r.repaired) ||
      !(r.repaired.mae<r.baseline.mae && r.repaired.rmse<r.baseline.rmse) ||
      !Number.isSafeInteger(r.startedAtUnixMs)||r.startedAtUnixMs<=0 ||
      !Number.isSafeInteger(r.fillElapsedMs)||r.fillElapsedMs<0 ||
      !Number.isSafeInteger(r.totalElapsedMs)||r.totalElapsedMs<r.fillElapsedMs ||
      r.processPeakRssBytes!==null || r.workerPidMapping!=='unknown' ||
      r.photoshopCompatibilityVerified!==false) {
    fail('missing evidence, unpinned photo words, bad quality, or unsupported claim');
  }
  return true;
}
export function validateRealPhotoWorkerReceiptSet(receipts,pins,manifest){
  if(!Array.isArray(receipts)||receipts.length!==6) fail('exactly six independent runs required');
  const keys=new Set(),starts=new Set();
  for(const r of receipts){
    validateRealPhotoWorkerReceipt(r,pins,manifest);
    const key=r.format+'-'+r.runIndex;
    if(keys.has(key)||starts.has(r.startedAtUnixMs))fail('duplicate run/session');
    keys.add(key);starts.add(r.startedAtUnixMs);
  }
  for(const format of Object.keys(formats))for(const i of [1,2,3])
    if(!keys.has(format+'-'+i))fail('missing format/run');
  return {kind:'zpe-real-photo-browser-worker-evidence-set-v1',
    status:'six-independent-native-worker-quality-roundtrips-verified',
    runs:6,repairQualityVerified:true,
    memoryPeakVerified:false,photoshopCompatibilityVerified:false};
}
async function cli(){
  const dir=process.argv[2];
  if(!dir||process.argv.length!==3)fail('usage: node tools/verify-browser-real-photo-worker-artifacts.mjs ARTIFACT-DIR');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
  ]);
  const receipts=[];
  for(const format of Object.keys(formats))for(const run of [1,2,3]){
    receipts.push(JSON.parse(await readFile(path.join(dir,
      'real-photo-'+format+'-worker-run-'+run+'.json'),'utf8')));
  }
  console.log(JSON.stringify(validateRealPhotoWorkerReceiptSet(receipts,pins,manifest)));
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  cli().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
