// 037C-3a: genuine-photo Chromium observational memory, never a true peak.
// The Worker receipt remains an independent byte/quality proof.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateRealPhotoWorkerReceiptSet} from './verify-browser-real-photo-worker-artifacts.mjs';
import {validateBrowserSamplingTiming} from './browser-sampling-timing.mjs';

const fail=message=>{throw new TypeError('037C-3a observations: '+message);};
const count=value=>Number.isSafeInteger(value)&&value>=0;
const bytes=value=>Number.isSafeInteger(value)&&value>=0;
const available=['sampled','unavailable'];
function checkCoverage(coverage,samples,label){
  if(!coverage || !count(coverage.observedSamples) ||
      !count(coverage.missingSamples) ||
      coverage.observedSamples+coverage.missingSamples!==samples ||
      typeof coverage.observedAtStart!=='boolean' ||
      typeof coverage.observedAtFinish!=='boolean' ||
      (coverage.observedAtStart&&coverage.observedSamples===0) ||
      (coverage.observedAtFinish&&coverage.observedSamples===0))
    fail('invalid '+label+' sample coverage');
}
function checkOptionalMetric(metric,coverage,samples,label,fields){
  if(!metric || !available.includes(metric.availability) ||
      !count(metric.sampleCount) ||
      metric.sampleCount!==coverage.observedSamples ||
      (metric.availability==='unavailable' && typeof metric.unavailableReason!=='string') ||
      (metric.availability==='sampled' && metric.unavailableReason!==null) ||
      (metric.sampleCount===0 && metric.availability==='sampled'))
    fail('invalid '+label+' availability');
  for(const key of ['baseline','maximum','end']){
    const value=metric[fields[key]];
    const observed=key==='baseline'?coverage.observedAtStart:
      key==='end'?coverage.observedAtFinish:metric.sampleCount>0;
    if(observed?!bytes(value):value!==null)fail('invalid '+label+' '+key+' reading');
  }
  if(metric.sampleCount && (metric[fields.maximum]<metric[fields.baseline] &&
      coverage.observedAtStart || metric[fields.maximum]<metric[fields.end] &&
      coverage.observedAtFinish))fail('sampled maximum below observed value');
}
export function validateRealPhotoMemoryObservation(observation,worker){
  const o=observation, r=o?.report;
  if(!o || !worker || !['psd16','psb32'].includes(o.format) ||
      ![1,2,3].includes(o.runIndex) ||
      o.kind!=='zpe-real-photo-browser-memory-observation-v1' ||
      o.status!=='sampled-not-process-peak' ||
      o.format!==worker.format || o.runIndex!==worker.runIndex ||
      o.workerStartedAtUnixMs!==worker.startedAtUnixMs ||
      o.inputFileSha256!==worker.inputFileSha256 ||
      o.nativeDefectSha256!==worker.nativeDefectSha256 ||
      worker.workerVerified!==true ||
      o.processPeakRssBytes!==null || o.workerPidMapping!=='unknown' ||
      o.memoryPeakVerified!==false || o.photoshopCompatibilityVerified!==false)
    fail('unlinked Worker evidence or unsupported peak/attribution claim');
  if(!r || !count(r.sampleCount) || r.sampleCount<2 ||
      !Number.isFinite(r.requestedSamplingIntervalMs) ||
      r.requestedSamplingIntervalMs<1 ||
      !Number.isFinite(r.observedSamplingWindowMs) ||
      r.observedSamplingWindowMs<0 ||
      !bytes(r.baselineJsHeapUsedBytes) ||
      !bytes(r.sampledMaxJsHeapUsedBytes) ||
      !bytes(r.endJsHeapUsedBytes) ||
      r.sampledMaxJsHeapUsedBytes<r.baselineJsHeapUsedBytes ||
      r.sampledMaxJsHeapUsedBytes<r.endJsHeapUsedBytes ||
      !Array.isArray(r.stages) || r.stages.length<3 ||
      r.stages[0]?.phase!=='before-import' ||
      r.stages.at(-1)?.phase!=='finished' ||
      !r.stages.some(stage=>stage.phase==='after-import') ||
      !r.stages.some(stage=>stage.phase==='after-reopen') ||
      !r.metricCoverage || !r.chromiumProcesses || !r.linuxProcessRss ||
      !r.chromiumProcessLifecycle || !r.browserWorkerTargets ||
      !available.includes(r.browserWorkerTargets.availability) ||
      r.chromiumProcessLifecycle.workerPidMapping!=='unknown')
    fail('incomplete renderer sampling or unqualified process/Worker identity');
  if (r.samplingTiming == null) fail('missing sampling timing coverage');
  validateBrowserSamplingTiming(r.samplingTiming,r.sampleCount);
  const privateCoverage=r.metricCoverage.chromiumPrivateMemory;
  const rssCoverage=r.metricCoverage.linuxAggregateRss;
  checkCoverage(privateCoverage,r.sampleCount,'CDP private memory');
  checkCoverage(rssCoverage,r.sampleCount,'Linux RSS');
  checkOptionalMetric(r.chromiumProcesses,privateCoverage,r.sampleCount,'CDP private memory',{
    baseline:'baselinePrivateBytes',maximum:'sampledMaxPrivateBytes',end:'endPrivateBytes',
  });
  checkOptionalMetric(r.linuxProcessRss,rssCoverage,r.sampleCount,'Linux RSS',{
    baseline:'baselineAggregateRssBytes',maximum:'sampledMaxAggregateRssBytes',
    end:'endAggregateRssBytes',
  });
  // Even complete sampled coverage is not the real operation peak.
  if('processPeakRssBytes' in r || 'truePeakRssBytes' in r ||
      'workerPeakRssBytes' in r) fail('fabricated peak inside sampler report');
  return true;
}
export function validateRealPhotoMemoryObservationSet(observations,workers){
  if(!Array.isArray(observations)||observations.length!==6 ||
      !Array.isArray(workers)||workers.length!==6)fail('exactly six observations/Worker receipts required');
  const workerByKey=new Map(workers.map(worker=>[worker.format+'-'+worker.runIndex,worker]));
  if(workerByKey.size!==6)fail('duplicate Worker receipt');
  const keys=new Set();
  for(const observation of observations){
    const key=observation?.format+'-'+observation?.runIndex;
    if(keys.has(key))fail('duplicate observation');
    keys.add(key);
    validateRealPhotoMemoryObservation(observation,workerByKey.get(key));
  }
  for(const format of ['psd16','psb32'])for(const run of [1,2,3])
    if(!keys.has(format+'-'+run))fail('missing format/run');
  return {kind:'zpe-real-photo-memory-observations-set-v1',
    status:'six-sampled-browser-observations-not-process-peaks',
    runs:6,memoryPeakVerified:false,workerPidMapping:'unknown'};
}
export async function writeRealPhotoMemoryObservation({
  report,worker,artifactDir,
}){
  if(!artifactDir)fail('artifact dir required');
  const observation={
    kind:'zpe-real-photo-browser-memory-observation-v1',
    status:'sampled-not-process-peak',format:worker?.format,runIndex:worker?.runIndex,
    workerStartedAtUnixMs:worker?.startedAtUnixMs,
    inputFileSha256:worker?.inputFileSha256,
    nativeDefectSha256:worker?.nativeDefectSha256,
    processPeakRssBytes:null,workerPidMapping:'unknown',
    memoryPeakVerified:false,photoshopCompatibilityVerified:false,report,
  };
  validateRealPhotoMemoryObservation(observation,worker);
  await mkdir(artifactDir,{recursive:true});
  const output=path.join(artifactDir,'real-photo-'+observation.format+
    '-memory-run-'+observation.runIndex+'.json');
  await writeFile(output,JSON.stringify(observation,null,2)+'\n',{flag:'wx'});
  return {output,format:observation.format,runIndex:observation.runIndex,
    sampleCount:report.sampleCount,
    linuxRssAvailability:report.linuxProcessRss.availability};
}
async function cli(){
  if(process.argv.length!==3)fail('usage: node tools/browser-real-photo-memory-evidence.mjs ARTIFACT-DIR');
  const dir=path.resolve(process.argv[2]);
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
  ]);
  const workers=[],observations=[];
  for(const format of ['psd16','psb32'])for(const run of [1,2,3]){
    workers.push(JSON.parse(await readFile(path.join(dir,
      'real-photo-'+format+'-worker-run-'+run+'.json'),'utf8')));
    observations.push(JSON.parse(await readFile(path.join(dir,
      'real-photo-'+format+'-memory-run-'+run+'.json'),'utf8')));
  }
  validateRealPhotoWorkerReceiptSet(workers,pins,manifest);
  console.log(JSON.stringify(validateRealPhotoMemoryObservationSet(observations,workers)));
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  cli().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
