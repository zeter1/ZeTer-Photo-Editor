// 036C test-only evidence: six real Chromium UI milestones and six explicit
// CDP/Linux observations. Sampled memory is NOT an operation peak or Worker RSS.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateWideConnectedBrowserSampling } from './browser-wide-connected-native-evidence.mjs';

const PHASES=Object.freeze(['imported','selected','filled','previewed','undone','redone']);
const SAMPLE_KEYS=Object.freeze([
  'phase','milestoneMs','observedAtUnixMs','samplerElapsedMs',
  'rendererHeapBytes','cdpPrivateMemoryBytes','linuxRssBytes',
  'pidMembershipObserved','workerTargetsObserved','linuxIdentityObserved',
]);
const ROOT_KEYS=Object.freeze([
  'kind','schemaVersion','measurementClass','fixtureKey','format','provenance',
  'quality','stageSamples','milestonesMs','coverage','workerPidMapping',
  'operationPeakRssBytes','provenProcessExitCount','limitations',
]);
const KINDS=Object.freeze({
  rgb16wide:['PSD16',16,'wide-connected-psd16.json'],
  rgb32psbwide:['PSB32',32,'wide-connected-psb32.json'],
});
const isBytes=value=>Number.isSafeInteger(value)&&value>=0;
const fail=message=>{throw new TypeError('036C wide browser artifact: '+message);};
const hasExactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

function coverageFor(samples,key) {
  const present=samples.filter(sample=>sample[key]!==null);
  return {
    attempts:samples.length,
    observed:present.length,
    coverage:present.length===0?'unavailable':
      present.length===samples.length?'complete':'partial',
    lastObservedBytes:present.length?present.at(-1)[key]:null,
    missingPhases:samples.filter(sample=>sample[key]===null).map(sample=>sample.phase),
  };
}
function expectedCoverage(samples) {
  return {
    renderer:coverageFor(samples,'rendererHeapBytes'),
    cdpPrivateMemory:coverageFor(samples,'cdpPrivateMemoryBytes'),
    linux:coverageFor(samples,'linuxRssBytes'),
    pidMembership:{
      observed:samples.filter(item=>item.pidMembershipObserved).length,
      missingPhases:samples.filter(item=>!item.pidMembershipObserved).map(item=>item.phase),
    },
    workerTargets:{
      observed:samples.filter(item=>item.workerTargetsObserved).length,
      missingPhases:samples.filter(item=>!item.workerTargetsObserved).map(item=>item.phase),
    },
    linuxIdentity:{
      observed:samples.filter(item=>item.linuxIdentityObserved).length,
      missingPhases:samples.filter(item=>!item.linuxIdentityObserved).map(item=>item.phase),
    },
  };
}
function qualityIsValid(q,bits){
  if (!q || q.kind!=='zpe-browser-wide-connected-native-evidence-v1' ||
      q.bitsPerChannel!==bits || q.selectedPixels!==8288 ||
      q.changedSelectedPixels!==8288 || q.changedTiles<2 ||
      q.scoredSamples!==8288*3 || q.outsideSelectionAndAlphaUnchanged!==true ||
      q.undoNativeBytesExact!==true || q.redoNativeBytesExact!==true ||
      typeof q.reference!=='string' || !q.reference.includes('not Photoshop'))return false;
  const names=['mae','rmse','maxError'];
  return ['baseline','repaired'].every(key=>q[key]&&
    names.every(name=>Number.isFinite(q[key][name])&&q[key][name]>=0)) &&
    q.repaired.mae<q.baseline.mae && q.repaired.rmse<q.baseline.rmse;
}
export function validateWideConnectedBrowserArtifact(artifact) {
  if (!hasExactKeys(artifact,ROOT_KEYS) ||
      artifact.kind!=='zpe-wide-connected-browser-observations-v1' ||
      artifact.schemaVersion!==1 ||
      artifact.measurementClass!=='explicit-stage-samples-only' ||
      !Object.hasOwn(KINDS,artifact.fixtureKey) ||
      artifact.format!==KINDS[artifact.fixtureKey][0] ||
      artifact.provenance!=='ZeTer-generated fixture; not Photoshop-authored' ||
      artifact.workerPidMapping!=='unknown' ||
      artifact.operationPeakRssBytes!==null || artifact.provenProcessExitCount!==null ||
      typeof artifact.limitations!=='string' || !artifact.limitations.includes('not true peak') ||
      !qualityIsValid(artifact.quality,KINDS[artifact.fixtureKey][1]) ||
      !Array.isArray(artifact.stageSamples) ||
      artifact.stageSamples.length!==PHASES.length)fail('unsupported identity, source, quality or memory claims');
  const samples=artifact.stageSamples;
  for(let i=0;i<samples.length;i++){
    const s=samples[i];
    if (!hasExactKeys(s,SAMPLE_KEYS) || s.phase!==PHASES[i] ||
        !isBytes(s.milestoneMs) || !isBytes(s.observedAtUnixMs) ||
        !Number.isFinite(s.samplerElapsedMs) || s.samplerElapsedMs<0 ||
        !isBytes(s.rendererHeapBytes) ||
        ![s.cdpPrivateMemoryBytes,s.linuxRssBytes].every(value=>value===null||isBytes(value)) ||
        ![s.pidMembershipObserved,s.workerTargetsObserved,s.linuxIdentityObserved]
          .every(value=>typeof value==='boolean') ||
        (i>0&&(s.milestoneMs<samples[i-1].milestoneMs ||
          s.observedAtUnixMs<samples[i-1].observedAtUnixMs ||
          s.samplerElapsedMs<samples[i-1].samplerElapsedMs))) {
      fail('missing, reordered, forged or malformed stage observation');
    }
  }
  const milestonesMs=Object.fromEntries(samples.map(s=>[s.phase,s.milestoneMs]));
  const coverage=expectedCoverage(samples);
  if (JSON.stringify(artifact.milestonesMs)!==JSON.stringify(milestonesMs) ||
      JSON.stringify(artifact.coverage)!==JSON.stringify(coverage)) {
    fail('unreconciled timestamp or memory coverage summary');
  }
  // Validate the original 036A sampling policy independently at read/write.
  validateWideConnectedBrowserSampling({
    milestonesMs,
    renderer:coverage.renderer,
    linux:coverage.linux,
    workerPidMapping:artifact.workerPidMapping,
    operationPeakRssBytes:artifact.operationPeakRssBytes,
  });
  return true;
}
export function createWideConnectedBrowserArtifact({fixtureKey,quality,stageSamples}={}) {
  if (!Object.hasOwn(KINDS,fixtureKey) || !Array.isArray(stageSamples))
    fail('unknown fixture or observations');
  const samples=stageSamples.map(s=>({...s}));
  const artifact={
    kind:'zpe-wide-connected-browser-observations-v1',
    schemaVersion:1,
    measurementClass:'explicit-stage-samples-only',
    fixtureKey,format:KINDS[fixtureKey][0],
    provenance:'ZeTer-generated fixture; not Photoshop-authored',
    quality,
    stageSamples:samples,
    milestonesMs:Object.fromEntries(samples.map(s=>[s.phase,s.milestoneMs])),
    coverage:expectedCoverage(samples),
    workerPidMapping:'unknown',
    operationPeakRssBytes:null,
    provenProcessExitCount:null,
    limitations:'Six explicit stage snapshots; not true peak RSS, no Worker-to-PID join or proven process exit. Missing CDP/Linux observations remain null.',
  };
  validateWideConnectedBrowserArtifact(artifact);
  return artifact;
}
export async function writeWideConnectedBrowserArtifact(input,{
  directory=process.env.ZPE_BROWSER_OPERATION_ARTIFACT_DIR,
}={}) {
  const artifact=createWideConnectedBrowserArtifact(input);
  if (directory==null || directory==='')return null;
  if (typeof directory!=='string')fail('invalid output directory');
  await mkdir(directory,{recursive:true});
  const destination=path.join(directory,KINDS[artifact.fixtureKey][2]);
  await writeFile(destination,JSON.stringify(artifact,null,2)+'\n','utf8');
  return destination;
}
export async function verifyWideConnectedBrowserArtifacts(directory) {
  if (typeof directory!=='string'||!directory.trim())fail('missing CI directory');
  const files=Object.values(KINDS).map(item=>item[2]);
  for(const file of files) {
    const artifact=JSON.parse(await readFile(path.join(directory,file),'utf8'));
    validateWideConnectedBrowserArtifact(artifact);
    if (KINDS[artifact.fixtureKey][2]!==file)fail('wrong fixture in '+file);
    const canonical=createWideConnectedBrowserArtifact(artifact);
    if (JSON.stringify(artifact)!==JSON.stringify(canonical))
      fail('noncanonical serialized evidence in '+file);
  }
  return files;
}
