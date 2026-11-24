// 037C-1: fail-closed checker for six independent baseline-only Chromium receipts.
// No receipt here certifies native Worker inpainting, Undo/Redo or photo repair.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const formats={psd16:{filename:'psd16-defect.psd',bits:16,bytes:16810260,native:'rgb16'},
  psb32:{filename:'psb32-defect.psb',bits:32,bytes:33620288,native:'float32'}};
const fail=m=>{throw new TypeError('037C browser import receipts: '+m);};
export function validateRealPhotoImportReceipt(receipt,pins,manifest){
  if(!receipt || !Object.hasOwn(formats,receipt.format) ||
    ![1,2,3].includes(receipt.runIndex) || !pins || !manifest) fail('invalid receipt or pins');
  const f=formats[receipt.format],documentPin=pins.documents?.[receipt.format];
  if(receipt.kind!=='zpe-real-photo-browser-import-baseline-v1' ||
    receipt.status!=='ui-import-and-save-native-baseline-verified' ||
    receipt.protocol!=='file:' || receipt.inputFilename!==f.filename ||
    receipt.inputFileSha256!==documentPin?.fileSha256 ||
    receipt.nativeDefectSha256!==documentPin?.nativeSha256 ||
    receipt.nativeDefectSha256!==manifest.native?.[f.native]?.damagedSha256 ||
    receipt.sourcePhotoSha256!==pins.sourceSha256 ||
    receipt.sourcePhotoSha256!==manifest.sourceSha256 ||
    receipt.inputBytes!==f.bytes ||
    receipt.rawNativeBytes!==1025*1025*4*(f.bits/8) ||
    receipt.pixelCount!==1025*1025 || receipt.bitsPerChannel!==f.bits ||
    !Number.isSafeInteger(receipt.tileCount) || receipt.tileCount<2 ||
    receipt.inputNativeMatchedFrozenPin!==true ||
    receipt.publicSaveNativeMatchedFrozenPin!==true ||
    !Number.isSafeInteger(receipt.startedAtUnixMs) || receipt.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(receipt.importElapsedMs) || receipt.importElapsedMs<0 ||
    !Number.isSafeInteger(receipt.totalElapsedMs) ||
    receipt.totalElapsedMs<receipt.importElapsedMs ||
    receipt.workerVerified!==false || receipt.undoRedoVerified!==false ||
    receipt.realPhotoRepairQualityVerified!==false ||
    receipt.photoshopCompatibilityVerified!==false ||
    receipt.processPeakRssBytes!==null || receipt.workerPidMapping!=='unknown')
    fail('wrong frozen byte pin, observation, or overclaimed benchmark');
  return true;
}
export function validateRealPhotoImportReceiptSet(receipts,pins,manifest){
  if(!Array.isArray(receipts) || receipts.length!==6) fail('must contain six runs');
  const keys=new Set(),timestamps=new Set();
  for(const receipt of receipts){
    validateRealPhotoImportReceipt(receipt,pins,manifest);
    const key=receipt.format+'-'+receipt.runIndex;
    if(keys.has(key) || timestamps.has(receipt.startedAtUnixMs))
      fail('duplicate run or reused browser session timestamp');
    keys.add(key); timestamps.add(receipt.startedAtUnixMs);
  }
  for(const format of Object.keys(formats))for(const n of [1,2,3])
    if(!keys.has(format+'-'+n)) fail('missing format/run');
  return {kind:'zpe-real-photo-browser-import-baseline-set-v1',
    status:'six-public-ui-import-save-native-baselines-verified',
    runs:6,workerVerified:false,repairQualityVerified:false,photoshopParityVerified:false};
}
async function cli(){
  const dir=process.argv[2];
  if(!dir || process.argv.length!==3) fail('usage: node tools/verify-browser-real-photo-import-artifacts.mjs ARTIFACT-DIR');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
  ]);
  const receipts=[];
  for(const format of Object.keys(formats))for(const run of [1,2,3]){
    const name=`real-photo-${format}-baseline-run-${run}.json`;
    receipts.push(JSON.parse(await readFile(path.join(dir,name),'utf8')));
  }
  console.log(JSON.stringify(validateRealPhotoImportReceiptSet(receipts,pins,manifest)));
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  cli().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
