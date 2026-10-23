// 003T/3c: non-atomic CPU/RSS reads of one CDP process census per real
// high-depth UI milestone. This diagnostic never asserts an operation peak.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {sampleLinuxChromiumRss} from './browser-linux-process-rss.mjs';
import {validateChromiumRssSampleMembership} from './browser-rss-sample-identity.mjs';
import {CPU_PHASES,validateOperationCpuEvidence} from './browser-operation-cpu-evidence.mjs';

const fail=message=>new TypeError('003T/3c CPU/RSS coverage: '+message);
const exact=(value,keys)=>value && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reasons=['unsupported-platform','cdp-unavailable','proc-member-vanished',
  'proc-access-denied','proc-member-unavailable'];
const LIMITATIONS='CPU jiffies and VmRSS were read sequentially, not atomically, from one CDP process census per UI milestone. Matching PID+starttime only establishes sampled membership agreement; no continuous coverage, operation-exclusive CPU, CPU total/peak, memory peak or Worker-to-PID mapping. Unknown reads and PID turnover cannot be interpolated.';

export function validateOperationRssCensus(census){
  if(!exact(census,['availability','reason','readStartedMs','readFinishedMs',
    'processSamples','aggregateRssBytes']) ||
    !Number.isFinite(census.readStartedMs) || census.readStartedMs<0 ||
    !Number.isFinite(census.readFinishedMs) ||
    census.readFinishedMs<census.readStartedMs) throw fail('invalid RSS read window');
  if(census.availability==='unknown'){
    if(!reasons.includes(census.reason) ||
      census.processSamples!==null || census.aggregateRssBytes!==null)
      throw fail('missing RSS snapshot must be entirely unknown');
  }else{
    if(census.availability!=='observed' || census.reason!==null ||
      !Array.isArray(census.processSamples) || !census.processSamples.length)
      throw fail('invalid observed RSS census');
    let sum=0,last=0;
    for(const item of census.processSamples){
      if(!exact(item,['pid','starttimeTicks','rssBytes']) ||
        !Number.isSafeInteger(item.pid) || item.pid<=last ||
        typeof item.starttimeTicks!=='string' ||
        !/^[1-9]\d*$/.test(item.starttimeTicks) ||
        !Number.isSafeInteger(item.rssBytes) || item.rssBytes<0 ||
        !Number.isSafeInteger(sum+item.rssBytes))
        throw fail('invalid RSS member identity/bytes');
      sum+=item.rssBytes;last=item.pid;
    }
    if(census.aggregateRssBytes!==sum)throw fail('forged RSS aggregate');
  }
  return true;
}

export function unknownOperationRssCensus(reason,{now=()=>performance.now()}={}){
  if(!reasons.includes(reason))throw fail('invalid missing RSS reason');
  const t=now();
  const census={availability:'unknown',reason,readStartedMs:t,
    readFinishedMs:t,processSamples:null,aggregateRssBytes:null};
  validateOperationRssCensus(census);
  return census;
}

export async function collectOperationRssCensus(processes,{
  platform=process.platform,now=()=>performance.now(),
  readStat,readStatus,
}={}){
  if(!Array.isArray(processes) || !processes.length ||
    processes.some(p=>!Number.isSafeInteger(p?.id)||p.id<=0) ||
    new Set(processes.map(p=>p.id)).size!==processes.length)
    throw fail('invalid or duplicate CDP membership');
  const start=now();
  if(platform!=='linux')return unknownOperationRssCensus('unsupported-platform',{now:()=>start});
  let result,reason=null;
  try{
    const options={platform};
    if(readStat)options.readStat=readStat;
    if(readStatus)options.readStatus=readStatus;
    const rss=await sampleLinuxChromiumRss(processes,options);
    validateChromiumRssSampleMembership(processes,rss);
    result={availability:'observed',reason:null,readStartedMs:start,
      readFinishedMs:now(),aggregateRssBytes:rss.aggregateRssBytes,
      processSamples:rss.processSamples.map(p=>({
        pid:p.pid,starttimeTicks:p.starttimeTicks,rssBytes:p.rssBytes,
      })).sort((a,b)=>a.pid-b.pid)};
  }catch(error){
    reason=['ENOENT','ESRCH'].includes(error?.code)?'proc-member-vanished':
      ['EACCES','EPERM'].includes(error?.code)?'proc-access-denied':
        'proc-member-unavailable';
    result={availability:'unknown',reason,readStartedMs:start,
      readFinishedMs:now(),processSamples:null,aggregateRssBytes:null};
  }
  validateOperationRssCensus(result);
  return result;
}

export function compareCpuRssMembership(cpu,rss){
  validateOperationRssCensus(rss);
  // CPU is validated by validateOperationCpuEvidence at the report level.
  if(cpu.availability!=='observed')
    return {availability:'unknown',reason:'cpu-unavailable'};
  if(rss.availability!=='observed')
    return {availability:'unknown',reason:'rss-unavailable'};
  const same=cpu.incarnations.length===rss.processSamples.length &&
    cpu.incarnations.every((p,i)=>p.pid===rss.processSamples[i].pid &&
      p.starttimeTicks===rss.processSamples[i].starttimeTicks);
  return same?{availability:'matching-sampled-membership-only',reason:null}:
    {availability:'unknown',reason:'pid-incarnation-mismatch'};
}

export function validateOperationCpuRssCoverage(report,cpuReport,nativeReceipt){
  validateOperationCpuEvidence(cpuReport,nativeReceipt);
  if(!exact(report,['kind','format','protocol','cpuReportSha256','nativeReceiptSha256',
    'stages','comparisons','operationCpuTotalKnown','trueOperationPeakKnown',
    'workerPidMapping','limitations']) ||
    report.kind!=='zpe-native-operation-cpu-rss-coverage-v1' ||
    report.format!==cpuReport.format || report.protocol!=='file:' ||
    report.cpuReportSha256!==sha(cpuReport) ||
    report.nativeReceiptSha256!==cpuReport.nativeReceiptSha256 ||
    report.operationCpuTotalKnown!==false || report.trueOperationPeakKnown!==false ||
    report.workerPidMapping!=='unknown' || report.limitations!==LIMITATIONS ||
    !Array.isArray(report.stages) || report.stages.length!==CPU_PHASES.length ||
    !Array.isArray(report.comparisons) || report.comparisons.length!==CPU_PHASES.length)
    throw fail('unsafe report metadata or native/CPU binding');
  for(let i=0;i<CPU_PHASES.length;i++){
    const item=report.stages[i],cpu=cpuReport.phases[i].census;
    if(!exact(item,['phase','rss']) || item.phase!==CPU_PHASES[i])
      throw fail('missing/reordered RSS milestone');
    const rss=item.rss;
    validateOperationRssCensus(rss);
    if(rss.readStartedMs<cpu.readFinishedMs ||
      (i+1<CPU_PHASES.length &&
       rss.readFinishedMs>cpuReport.phases[i+1].census.readStartedMs))
      throw fail('impossible sequential CPU/RSS observation order');
    const expected=compareCpuRssMembership(cpu,rss);
    if(!exact(report.comparisons[i],Object.keys(expected)) ||
      Object.keys(expected).some(k=>expected[k]!==report.comparisons[i][k]))
      throw fail('invented CPU/RSS membership coverage or gap recovery');
  }
  return true;
}

export function createOperationCpuRssCoverage({cpuReport,nativeReceipt,stages}){
  const report={kind:'zpe-native-operation-cpu-rss-coverage-v1',
    format:cpuReport.format,protocol:'file:',
    cpuReportSha256:sha(cpuReport),
    nativeReceiptSha256:cpuReport.nativeReceiptSha256,
    stages,comparisons:stages.map((x,i)=>
      compareCpuRssMembership(cpuReport.phases[i].census,x.rss)),
    operationCpuTotalKnown:false,trueOperationPeakKnown:false,
    workerPidMapping:'unknown',limitations:LIMITATIONS};
  validateOperationCpuRssCoverage(report,cpuReport,nativeReceipt);
  return report;
}

export async function saveOperationCpuRssCoverage(report,cpuReport,nativeReceipt,directory){
  validateOperationCpuRssCoverage(report,cpuReport,nativeReceipt);
  if(!directory)throw fail('artifact directory required');
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'stage003-operation-cpu-rss-'+report.format.toLowerCase()+'.json');
  await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return file;
}

export async function verifyOperationCpuRssCoverage(directory,cpuDirectory,nativeDirectory){
  if(!directory || !cpuDirectory || !nativeDirectory)throw fail('three artifact directories required');
  for(const format of ['PSD16','PSB32']){
    const key=format.toLowerCase();
    const [report,cpu,native]=await Promise.all([
      readFile(path.join(directory,'stage003-operation-cpu-rss-'+key+'.json'),'utf8'),
      readFile(path.join(cpuDirectory,'stage003-operation-cpu-'+key+'.json'),'utf8'),
      readFile(path.join(nativeDirectory,'stage003-dense-cancel-'+key+'.json'),'utf8'),
    ]).then(items=>items.map(JSON.parse));
    if(report.format!==format||cpu.format!==format||native.format!==format)
      throw fail('cross-format receipt substitution');
    validateOperationCpuRssCoverage(report,cpu,native);
  }
  return true;
}
