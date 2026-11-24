import test from 'node:test';
import assert from 'node:assert/strict';
import {CPU_PHASES,createOperationCpuEvidence} from
  '../tools/browser-operation-cpu-evidence.mjs';
import {unknownLinuxCpuCensus,collectLinuxCpuCensus} from
  '../tools/browser-linux-cpu-observation.mjs';
import {BROWSER_DENSE_CANCEL_LIMITATIONS} from
  '../tools/browser-dense-cancel-evidence.mjs';
import {
  collectOperationRssCensus,unknownOperationRssCensus,validateOperationRssCensus,
  createOperationCpuRssCoverage,validateOperationCpuRssCoverage,
} from '../tools/browser-operation-cpu-rss-coverage.mjs';

function native(format='PSD16'){
  return {
    kind:'zpe-browser-near-cap-dense-cancel-v1',format,protocol:'file:',
    sourcePixels:2_030_000,sourceRawBytes:2_030_000*4*(format==='PSD16'?2:4),
    marqueeBoundingPixels:1_973_400,
    firstSelectedPixels:1_973_400,firstSelectedBytes:1_973_400*4,
    secondSelectedPixels:1_973_400,secondSelectedBytes:1_973_400*4,
    workerJobs:2,cancelAcknowledged:true,selectionReplacedAfterCancel:true,
    cancelBeforeReply:true,terminatedJobsBeforeRetry:1,repliesBeforeRetry:0,
    cancelNativeExact:true,cancelPreviewExact:true,cancelHistoryExact:true,
    settledNativeExact:true,settledPreviewExact:true,settledHistoryExact:true,
    retryChangedSelectedPixels:20,retryOutsideUnchanged:true,
    retryAlphaUnchanged:true,retryUndoExact:true,retryRedoExact:true,
    retryHistoryOnce:true,finalReplies:1,
    firstDispatchToCancelMs:100,cancelSettledMs:1250,retryMenuToCompletionMs:4000,
    requestedPulseMs:8,cancelPulseIntervalsMs:[8,16],retryPulseIntervalsMs:[8,18],
    cancelPulsesTruncated:false,retryPulsesTruncated:false,
    heapBeforeBytes:null,heapAfterBytes:1000,
    workerPidMapping:'unknown',operationPeakKnown:false,
    limitations:BROWSER_DENSE_CANCEL_LIMITATIONS,
  };
}
const p=(pid,starttimeTicks,userTicks='9',systemTicks='2')=>({
  pid,starttimeTicks,userTicks,systemTicks,
});
const observedCpu=(i,start='50')=>({
  availability:'observed',reason:null,
  readStartedMs:i*30,readFinishedMs:i*30+4,
  incarnations:[p(91,start,String(10+i*7),String(i+4))],
});
const observedRss=(i,start='50')=>({
  availability:'observed',reason:null,
  readStartedMs:i*30+5,readFinishedMs:i*30+9,
  processSamples:[{pid:91,starttimeTicks:start,rssBytes:4096+i*1024}],
  aggregateRssBytes:4096+i*1024,
});
function fixture(format='PSD16'){
  const receipt=native(format);
  const cpuStages=CPU_PHASES.map((phase,i)=>({phase,census:i===2
    ?unknownLinuxCpuCensus('proc-member-vanished',{now:()=>i*30})
    :observedCpu(i,i>=4?'51':'50')}));
  const rssStages=CPU_PHASES.map((phase,i)=>({phase,rss:i===3
    ?unknownOperationRssCensus('proc-access-denied',{now:()=>i*30+5})
    :observedRss(i,i>=4?'51':'50')}));
  // The report v1 CPU clock gap from the missing sample to later successful
  // observations must not revive any earlier process counters.
  const cpu=createOperationCpuEvidence({format,nativeReceipt:receipt,stages:cpuStages});
  const report=createOperationCpuRssCoverage({cpuReport:cpu,nativeReceipt:receipt,stages:rssStages});
  return {receipt,cpu,report};
}

test('003T/3c: both-depth native binding and independent CPU/RSS unknown-window recovery',()=>{
  for(const format of ['PSD16','PSB32']){
    const {receipt,cpu,report}=fixture(format);
    assert.equal(validateOperationCpuRssCoverage(report,cpu,receipt),true);
    assert.equal(report.comparisons[0].availability,'matching-sampled-membership-only');
    assert.deepEqual(report.comparisons[2],{availability:'unknown',reason:'cpu-unavailable'});
    assert.deepEqual(report.comparisons[3],{availability:'unknown',reason:'rss-unavailable'});
    assert.equal(report.comparisons[4].availability,'matching-sampled-membership-only');
    assert.equal(cpu.intervals[1].comparison.availability,'unknown');
    assert.equal(cpu.intervals[2].comparison.availability,'unknown');
    assert.equal(cpu.intervals[4].comparison.availability,'sampled-overlap-only');
    assert.equal(report.workerPidMapping,'unknown');
    assert.equal(report.trueOperationPeakKnown,false);
  }
});

test('003T/3c: fail closed for fabricated coverage, RSS, native data and reordered readings',()=>{
  const {receipt,cpu,report}=fixture();
  const mutations=[
    x=>{x.comparisons[2]={availability:'matching-sampled-membership-only',reason:null};},
    x=>{x.comparisons[3].reason='cpu-unavailable';},
    x=>{x.stages[4].rss.processSamples[0].starttimeTicks='50';},
    x=>{x.stages[4].rss.aggregateRssBytes+=1;},
    x=>{x.stages[0].rss.processSamples[0].rssBytes=-1;},
    x=>{x.stages[1].rss.processSamples[0].pid=0;},
    x=>{x.stages[3].rss.processSamples=[];},
    x=>{x.stages[2].rss.readStartedMs=40;},
    x=>{x.stages[0].rss.readStartedMs=2;},
    x=>{x.stages[0].rss.readFinishedMs=36;},
    x=>{x.stages[1].rss.reason='proc-member-vanished';},
    x=>{x.stages[1].phase='before-first-fill';},
    x=>{x.stages.pop();},
    x=>{x.cpuReportSha256='0'.repeat(64);},
    x=>{x.nativeReceiptSha256='0'.repeat(64);},
    x=>{x.operationCpuTotalKnown=true;},
    x=>{x.trueOperationPeakKnown=true;},
    x=>{x.workerPidMapping='verified';},
    x=>{x.workerPid=91;},
  ];
  for(const edit of mutations){
    const bad=structuredClone(report);edit(bad);
    assert.throws(()=>validateOperationCpuRssCoverage(bad,cpu,receipt),/003T\/3c/);
  }
  const changed=structuredClone(cpu);
  changed.phases[4].census.incarnations[0].userTicks='999';
  assert.throws(()=>validateOperationCpuRssCoverage(report,changed,receipt));
  const invalidNative=structuredClone(receipt);
  invalidNative.retryAlphaUnchanged=false;
  assert.throws(()=>validateOperationCpuRssCoverage(report,cpu,invalidNative));
});

test('003T/3c: changed incarnation is unknown, not an RSS-vs-CPU join',()=>{
  const {receipt,cpu,report}=fixture();
  const stages=structuredClone(report.stages);
  stages[1].rss.processSamples[0].starttimeTicks='500';
  const coverage=createOperationCpuRssCoverage({cpuReport:cpu,nativeReceipt:receipt,stages});
  assert.deepEqual(coverage.comparisons[1],
    {availability:'unknown',reason:'pid-incarnation-mismatch'});
  assert.equal(validateOperationCpuRssCoverage(coverage,cpu,receipt),true);
});

const procStat=(pid,start)=>pid+' (Chromium (worker)) S '+
  Array(18).fill('0').join(' ')+' '+start+' 0\n';
const procStatus='Name:\tchrome\nVmRSS:\t100 kB\nVmHWM:\t150 kB\n';
const error=code=>Object.assign(Error(code),{code});

test('003T/3c: partial RSS /proc failure and independently recovered census',async()=>{
  const members=[{id:91,type:'renderer'},{id:92,type:'utility'}];
  let t=0;
  const options={
    now:()=>++t,platform:'linux',
    readStat:async path=>procStat(Number(path.split('/')[2]),'70'),
    readStatus:async path=>path.includes('/92/')?Promise.reject(error('ENOENT')):procStatus,
  };
  const missed=await collectOperationRssCensus(members,options);
  assert.equal(missed.availability,'unknown');
  assert.equal(missed.reason,'proc-member-vanished');
  assert.equal(missed.aggregateRssBytes,null);
  assert.equal(missed.processSamples,null);
  const recovered=await collectOperationRssCensus(members,{
    ...options,readStatus:async()=>procStatus});
  assert.equal(recovered.availability,'observed');
  assert.equal(recovered.aggregateRssBytes,204800);
  assert.equal(recovered.processSamples.length,2);
  assert.equal(validateOperationRssCensus(recovered),true);
  const denied=await collectOperationRssCensus(members,{
    ...options,readStatus:async()=>Promise.reject(error('EACCES'))});
  assert.equal(denied.reason,'proc-access-denied');
});

test('003T/3c: CPU /proc preserves cause and recovers without stale counters',async()=>{
  const pid=91;
  const stat=(user)=>pid+' (renderer) '+
    ['S',...Array(19).fill('0')].map((v,i)=>i===11?String(user):i===19?'70':v).join(' ')+'\n';
  const members=[{id:pid}];
  let t=0;
  const base={now:()=>++t,platform:'linux'};
  const missing=await collectLinuxCpuCensus(members,{
    ...base,readStat:async()=>{throw error('ENOENT');}});
  assert.equal(missing.reason,'proc-member-vanished');
  assert.equal(missing.incarnations,null);
  const denied=await collectLinuxCpuCensus(members,{
    ...base,readStat:async()=>{throw error('EPERM');}});
  assert.equal(denied.reason,'proc-access-denied');
  const recovery=await collectLinuxCpuCensus(members,{
    ...base,readStat:async()=>stat(20)});
  assert.equal(recovery.availability,'observed');
  assert.equal(recovery.incarnations[0].userTicks,'20');
});
