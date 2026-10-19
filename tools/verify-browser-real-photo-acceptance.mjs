// 037C-3c: cross-scenario, fail-closed final acceptance over genuine-photo receipts.
// Checksums are integrity labels for this CI run, NOT digital signatures or peak-RAM evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateRealPhotoImportReceiptSet} from './verify-browser-real-photo-import-artifacts.mjs';
import {validateRealPhotoWorkerReceiptSet} from './verify-browser-real-photo-worker-artifacts.mjs';
import {validateRealPhotoMemoryObservationSet} from './browser-real-photo-memory-evidence.mjs';
import {verifyRealPhotoSwitchFailureFiles} from './verify-browser-real-photo-switch-failure-artifacts.mjs';
import {verifyRealPhotoMidKernelFailureFiles} from './verify-browser-real-photo-mid-kernel-artifacts.mjs';
import {verifyRealPhotoMidKernelCloseFiles} from './verify-browser-real-photo-mid-kernel-close-artifacts.mjs';
import {verifyRealPhotoMidKernelEscapeFiles} from './verify-browser-real-photo-mid-kernel-escape-artifacts.mjs';
import {verifyRealPhotoCompletedPreviewEscapeFiles} from './verify-browser-real-photo-completed-preview-escape-artifacts.mjs';
import {verifyRealPhotoCompletedPreviewSuccessFiles} from './verify-browser-real-photo-completed-preview-success-artifacts.mjs';
import {verifyRealPhotoCancelSuccessorFiles} from './verify-browser-real-photo-cancel-successor-artifacts.mjs';
import {verifyRealPhotoMalformedAlphaFiles} from './verify-browser-real-photo-malformed-alpha-artifacts.mjs';
import {verifyRealPhotoMalformedCounterFiles} from './verify-browser-real-photo-malformed-counter-artifacts.mjs';
import {verifyRealPhotoMalformedExtraFiles} from './verify-browser-real-photo-malformed-extra-artifacts.mjs';
import {verifyRealPhotoMemoryCapFiles} from './verify-browser-real-photo-memory-cap-artifacts.mjs';

const fail=message=>{throw new TypeError('037C-3c acceptance: '+message);};
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
const formats=['psd16','psb32'];
const specs=[
  {id:'import',dir:'browser-baselines',summary:'browser-baseline-set.json',stem:'baseline',perFormat:3,
    kind:'zpe-real-photo-browser-import-baseline-set-v1'},
  {id:'worker',dir:'browser-baselines',summary:'browser-worker-set.json',stem:'worker',perFormat:3,
    kind:'zpe-real-photo-browser-worker-evidence-set-v1'},
  {id:'memory',dir:'browser-baselines',summary:'browser-memory-set.json',stem:'memory',perFormat:3,
    kind:'zpe-real-photo-memory-observations-set-v1'},
  {id:'switch',dir:'browser-failures',summary:'browser-switch-failure-set.json',stem:'failure',
    kind:'zpe-real-photo-browser-cancel-switch-set-v1',verify:verifyRealPhotoSwitchFailureFiles},
  {id:'mid-kernel',dir:'browser-mid-kernel',summary:'browser-mid-kernel-set.json',stem:'mid-kernel',
    kind:'zpe-real-photo-browser-mid-kernel-switch-set-v1',verify:verifyRealPhotoMidKernelFailureFiles},
  {id:'close',dir:'browser-mid-kernel-close',summary:'browser-mid-kernel-close-set.json',stem:'mid-kernel-close',
    kind:'zpe-real-photo-browser-mid-kernel-close-set-v1',verify:verifyRealPhotoMidKernelCloseFiles},
  {id:'mid-kernel-escape',dir:'browser-mid-kernel-escape',summary:'browser-mid-kernel-escape-set.json',
    stem:'mid-kernel-escape',kind:'zpe-real-photo-browser-mid-kernel-escape-set-v1',verify:verifyRealPhotoMidKernelEscapeFiles},
  {id:'completed-preview-escape',dir:'browser-completed-preview-escape',summary:'browser-completed-preview-escape-set.json',
    stem:'completed-preview-escape',kind:'zpe-real-photo-browser-completed-preview-escape-set-v1',
    verify:verifyRealPhotoCompletedPreviewEscapeFiles},
  {id:'completed-preview-success',dir:'browser-completed-preview-success',summary:'browser-completed-preview-success-set.json',
    stem:'completed-preview-success',kind:'zpe-real-photo-browser-preview-success-set-v1',
    verify:verifyRealPhotoCompletedPreviewSuccessFiles},
  {id:'cancel-successor',dir:'browser-cancel-successor',summary:'browser-cancel-successor-set.json',
    stem:'cancel-successor',kind:'zpe-real-photo-browser-cancel-successor-set-v1',verify:verifyRealPhotoCancelSuccessorFiles},
  {id:'malformed-alpha',dir:'browser-malformed-alpha',summary:'browser-malformed-alpha-set.json',
    stem:'malformed-alpha',kind:'zpe-real-photo-browser-malformed-alpha-set-v1',verify:verifyRealPhotoMalformedAlphaFiles},
  {id:'malformed-counter',dir:'browser-malformed-counter',summary:'browser-malformed-counter-set.json',
    stem:'malformed-counter',kind:'zpe-real-photo-browser-malformed-counter-set-v1',verify:verifyRealPhotoMalformedCounterFiles},
  {id:'malformed-extra',dir:'browser-malformed-extra',summary:'browser-malformed-extra-set.json',
    stem:'malformed',kind:'zpe-real-photo-browser-malformed-extra-set-v1',verify:verifyRealPhotoMalformedExtraFiles},
  {id:'memory-cap',dir:'browser-memory-cap',summary:'browser-memory-cap-set.json',
    stem:'memory-cap',kind:'zpe-real-photo-browser-memory-cap-set-v1',verify:verifyRealPhotoMemoryCapFiles},
];
export const requiredAcceptanceSuites=Object.freeze(specs.map(s=>s.id));

export function validateAcceptancePlan(plan,pins,photo){
  if(plan?.kind!=='zpe-real-photo-037c-final-acceptance-plan-v1' ||
      plan.sourceSha256!==pins?.sourceSha256 ||
      plan.sourceSha256!==photo?.sourceSha256 ||
      plan.documents?.psd16!==pins?.documents?.psd16?.fileSha256 ||
      plan.documents?.psb32!==pins?.documents?.psb32?.fileSha256 ||
      Object.keys(plan.documents).sort().join(',')!=='psb32,psd16' ||
      !Array.isArray(plan.requiredSuites) ||
      plan.requiredSuites.join(',')!==requiredAcceptanceSuites.join(',') ||
      plan.memoryPeakVerified!==false ||
      plan.photoshopCompatibilityVerified!==false)fail('changed/missing suite or frozen provenance pin');
  return true;
}
function receiptNames(spec){
  if(spec.id==='malformed-extra')return [
    'real-photo-psd16-malformed-outside-run-1.json',
    'real-photo-psb32-malformed-outside-run-1.json',
    'real-photo-psb32-malformed-nonfinite-nan-run-1.json',
    'real-photo-psb32-malformed-nonfinite-infinity-run-1.json',
  ].sort();
  const result=[];
  for(const format of formats)for(let i=1;i<=(spec.perFormat||1);i++)
    result.push('real-photo-'+format+'-'+spec.stem+'-run-'+i+'.json');
  return result.sort();
}
async function loadReceiptSet(dir,spec){
  const names=receiptNames(spec),entries=await readdir(dir);
  const actual=entries.filter(n=>n.startsWith('real-photo-') &&
    n.includes('-'+spec.stem+'-run-') && n.endsWith('.json')).sort();
  // Malformed-extra excludes alpha/counter, which have their own directories.
  assert.deepStrictEqual(actual,names,'037C-3c '+spec.id+': missing/unexpected receipt');
  return Promise.all(names.map(async name=>{
    const raw=await readFile(path.join(dir,name));
    return {name,sha256:sha256(raw),data:JSON.parse(raw.toString('utf8'))};
  }));
}
export function validateAcceptanceSummary(spec,result,saved){
  if(result?.kind!==spec.kind || result?.runs!==(spec.perFormat?spec.perFormat*2:
      spec.id==='malformed-extra'?4:2))fail('incorrect suite kind/count: '+spec.id);
  assert.deepStrictEqual(saved,result,'037C-3c mismatched published suite summary: '+spec.id);
  return true;
}
export async function verifyRealPhotoAcceptanceFiles(rootDir){
  if(!rootDir)fail('missing real-photo CI artifact root');
  const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [plan,pins,photo]=await Promise.all([
    readFile(path.join(project,'tests/fixtures/real-photo/acceptance-plan.json'),'utf8').then(JSON.parse),
    readFile(path.join(project,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(project,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
  ]);
  validateAcceptancePlan(plan,pins,photo);
  const evidence=[];
  let totalReceipts=0;
  for(const spec of specs){
    const dir=path.join(rootDir,spec.dir);
    const receipts=await loadReceiptSet(dir,spec);
    let result;
    if(spec.id==='import')result=validateRealPhotoImportReceiptSet(receipts.map(r=>r.data),pins,photo);
    else if(spec.id==='worker')result=validateRealPhotoWorkerReceiptSet(receipts.map(r=>r.data),pins,photo);
    else if(spec.id==='memory'){
      const workers=await loadReceiptSet(dir,specs[1]);
      validateRealPhotoWorkerReceiptSet(workers.map(r=>r.data),pins,photo);
      result=validateRealPhotoMemoryObservationSet(receipts.map(r=>r.data),workers.map(r=>r.data));
    } else result=await spec.verify(dir);
    const summaryRaw=await readFile(path.join(rootDir,spec.summary));
    const saved=JSON.parse(summaryRaw.toString('utf8'));
    validateAcceptanceSummary(spec,result,saved);
    totalReceipts+=receipts.length;
    evidence.push({id:spec.id,kind:result.kind,runs:result.runs,summaryFile:spec.summary,
      summarySha256:sha256(summaryRaw),receipts:receipts.map(({name,sha256})=>({name,sha256}))});
  }
  const ledger={kind:'zpe-real-photo-037c-evidence-ledger-v1',
    status:'validated-photo-derived-browser-evidence-matrix',sourceSha256:pins.sourceSha256,
    documents:Object.fromEntries(formats.map(f=>[f,pins.documents[f].fileSha256])),
    suiteCount:evidence.length,receiptCount:totalReceipts,memoryPeakVerified:false,
    photoshopCompatibilityVerified:false,ciRunId:process.env.GITHUB_RUN_ID||null,
    ciHeadSha:process.env.GITHUB_SHA||null,suites:evidence};
  return {...ledger,sha256:sha256(Buffer.from(JSON.stringify(ledger)))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(process.argv.length!==3)fail('usage: node tools/verify-browser-real-photo-acceptance.mjs CI-ARTIFACT-ROOT');
  verifyRealPhotoAcceptanceFiles(process.argv[2]).then(
    result=>console.log(JSON.stringify(result,null,2)+'\n'),
    error=>{console.error(error.stack||String(error));process.exitCode=1;});
}
