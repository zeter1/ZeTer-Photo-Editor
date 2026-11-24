// 003T/3b: sampled Chromium-wide Linux CPU deltas across actual native UI
// Fill / Escape / retry boundaries. Neither CPU totals nor Worker PID attribution.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {compareLinuxCpuCensuses,validateLinuxCpuCensus} from './browser-linux-cpu-observation.mjs';
import {validateBrowserDenseCancelEvidence} from './browser-dense-cancel-evidence.mjs';

export const CPU_PHASES=[
  'before-first-fill','first-worker-in-flight','after-escape-cancel',
  'before-retry-fill','retry-worker-in-flight','after-retry-completed',
];
const LIMITATIONS='Sequential non-atomic CDP and Linux /proc samples bracket actual native UI actions but leave blind intervals, incomplete process membership and possible unrelated CPU. Matching PID+starttime jiffies are sampled overlap only, not operation CPU total, operation CPU/RSS peak, Worker PID or exclusive process attribution.';
const fail=message=>new TypeError('003T/3b operation CPU evidence: '+message);
const exact=(v,keys)=>v && typeof v==='object' && !Array.isArray(v) &&
  Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const digest=receipt=>createHash('sha256').update(JSON.stringify(receipt)).digest('hex');

export function validateOperationCpuEvidence(report,nativeReceipt) {
  validateBrowserDenseCancelEvidence(nativeReceipt);
  if(!exact(report,['kind','format','protocol','sourcePixels','nativeReceiptSha256',
    'phases','intervals','operationCpuTotalKnown','trueOperationPeakKnown',
    'workerPidMapping','limitations']) ||
    report.kind!=='zpe-native-operation-cpu-boundaries-v1' ||
    !['PSD16','PSB32'].includes(report.format) ||
    report.format!==nativeReceipt.format ||
    report.protocol!=='file:' || report.sourcePixels!==2_030_000 ||
    report.nativeReceiptSha256!==digest(nativeReceipt) ||
    report.operationCpuTotalKnown!==false || report.trueOperationPeakKnown!==false ||
    report.workerPidMapping!=='unknown' || report.limitations!==LIMITATIONS ||
    !Array.isArray(report.phases) || report.phases.length!==CPU_PHASES.length ||
    !Array.isArray(report.intervals) || report.intervals.length!==CPU_PHASES.length-1)
    throw fail('invalid artifact / unsafe native binding or attribution');
  for(let i=0;i<CPU_PHASES.length;i++){
    const phase=report.phases[i];
    if(!exact(phase,['phase','census']) || phase.phase!==CPU_PHASES[i])
      throw fail('missing/reordered UI operation boundary');
    validateLinuxCpuCensus(phase.census);
    if(i===0)continue;
    const previous=report.phases[i-1].census;
    if(phase.census.readStartedMs<previous.readFinishedMs)
      throw fail('impossible UI/OS phase order');
    const expected=compareLinuxCpuCensuses(previous,phase.census);
    const interval=report.intervals[i-1];
    if(!exact(interval,['from','to','comparison']) ||
      interval.from!==CPU_PHASES[i-1] || interval.to!==CPU_PHASES[i] ||
      !exact(interval.comparison,Object.keys(expected)) ||
      Object.keys(expected).some(key=>interval.comparison[key]!==expected[key]))
      throw fail('forged sampled-overlap CPU delta or coverage claim');
  }
  return true;
}

export function createOperationCpuEvidence({format,nativeReceipt,stages}) {
  const report={
    kind:'zpe-native-operation-cpu-boundaries-v1',format,protocol:'file:',
    sourcePixels:2_030_000,nativeReceiptSha256:digest(nativeReceipt),
    phases:stages,
    intervals:stages.slice(1).map((s,i)=>({
      from:stages[i].phase,to:s.phase,
      comparison:compareLinuxCpuCensuses(stages[i].census,s.census),
    })),
    operationCpuTotalKnown:false,trueOperationPeakKnown:false,
    workerPidMapping:'unknown',limitations:LIMITATIONS,
  };
  validateOperationCpuEvidence(report,nativeReceipt);
  return report;
}

export async function saveOperationCpuEvidence(report,nativeReceipt,directory) {
  validateOperationCpuEvidence(report,nativeReceipt);
  if(!directory)throw fail('evidence directory required');
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'stage003-operation-cpu-'+report.format.toLowerCase()+'.json');
  await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return file;
}

export async function verifyOperationCpuEvidence(directory,nativeDirectory) {
  if(!directory || !nativeDirectory)throw fail('two receipt directories required');
  for(const format of ['PSD16','PSB32']){
    const key=format.toLowerCase();
    const report=JSON.parse(await readFile(path.join(directory,
      'stage003-operation-cpu-'+key+'.json'),'utf8'));
    const native=JSON.parse(await readFile(path.join(nativeDirectory,
      'stage003-dense-cancel-'+key+'.json'),'utf8'));
    if(report.format!==format || native.format!==format)throw fail('format mismatch');
    validateOperationCpuEvidence(report,native);
  }
  return true;
}
