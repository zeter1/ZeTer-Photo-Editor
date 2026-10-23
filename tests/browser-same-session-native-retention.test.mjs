import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BROWSER_DENSE_CANCEL_LIMITATIONS} from '../tools/browser-dense-cancel-evidence.mjs';
import {createSameSessionNativeRetention,validateSameSessionNativeRetention,
  compareRetainedCycleSamples} from '../tools/browser-same-session-native-retention.mjs';

const fixtureSha256='a'.repeat(64);
const native=()=>({
  kind:'zpe-browser-near-cap-dense-cancel-v1',format:'PSD16',
  sourcePixels:2_030_000,sourceRawBytes:2_030_000*8,protocol:'file:',
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
  requestedPulseMs:8,cancelPulseIntervalsMs:[8,18],retryPulseIntervalsMs:[8,12],
  cancelPulsesTruncated:false,retryPulsesTruncated:false,
  heapBeforeBytes:null,heapAfterBytes:1024,
  workerPidMapping:'unknown',operationPeakKnown:false,
  limitations:BROWSER_DENSE_CANCEL_LIMITATIONS,
});
const mark=(time,rssBase,opts={})=>{
  const cpu={availability:'observed',reason:null,
    readStartedMs:time,readFinishedMs:time+1,
    incarnations:[
      {pid:101,starttimeTicks:'300',userTicks:'50',systemTicks:'5'},
      {pid:102,starttimeTicks:'301',userTicks:'20',systemTicks:'2'},
    ]};
  const rss={availability:'observed',reason:null,
    readStartedMs:time+2,readFinishedMs:time+3,
    processSamples:[
      {pid:101,starttimeTicks:'300',rssBytes:rssBase},
      {pid:102,starttimeTicks:'301',rssBytes:1000},
    ],aggregateRssBytes:rssBase+1000};
  if(opts.unknown){cpu.availability='unknown';cpu.reason='proc-member-vanished';cpu.incarnations=null;}
  if(opts.reused){cpu.incarnations[0].starttimeTicks='999';rss.processSamples[0].starttimeTicks='999';}
  if(opts.rssMissing){rss.availability='unknown';rss.reason='proc-access-denied';rss.processSamples=null;rss.aggregateRssBytes=null;}
  return {cpu,rss};
};
const cycles=()=>[1,2,3].map(i=>{
  const start=100+i*100;
  return {index:i,startMs:start,finishMs:start+40,
    before:mark(start+1,10000+i*1000),
    after:mark(start+30,10000+i*1000+200),
    workerJobs:i+1,workerReplies:i,
    selectedPixels:1_973_400,selectedPixelsChanged:20,
    nativeExactAfterUndo:true,nativeExactAfterRedo:true,
    outsideUnchanged:true,alphaUnchanged:true,historyOnce:true,
    lateRepliesAbsent:true};
});
const report=(c=cycles(),n=native())=>createSameSessionNativeRetention({
  format:n.format,sessionId:randomUUID(),sessionStartedAtUnixMs:1792750000000,
  fixtureSha256,nativeReceipt:n,cycles:c,
});
const check=(r,n=native())=>validateSameSessionNativeRetention(r,n,fixtureSha256);
const copy=r=>structuredClone(r);

test('003T/4: three real-cycle schema and exact independent native/fixture binding',()=>{
  const n=native(),r=report(cycles(),n);
  assert.equal(check(r,n),true);
  assert.deepEqual(r.comparisons.map(x=>x.comparison.deltaBytes),[1000,1000]);
  assert.equal(r.trueOperationPeakKnown,false);
  assert.equal(r.workerPidMapping,'unknown');
  const n32={...n,format:'PSB32',sourceRawBytes:2_030_000*16};
  assert.equal(check(report(cycles(),n32),n32),true);
  assert.throws(()=>check(r,n32),/retention/);
  assert.throws(()=>validateSameSessionNativeRetention(r,n,'f'.repeat(64)),/retention/);
});

test('003T/4: missing /proc, RSS error and reused PID downgrade comparison to unknown',()=>{
  for(const type of ['unknown','rssMissing','reused']){
    const c=cycles();
    if(type==='unknown'||type==='rssMissing')c[1].after=mark(330,12000,{[type]:true});
    else c[1].after=mark(330,12000,{reused:true});
    const r=report(c);
    assert.equal(check(r),true);
    assert.equal(r.comparisons[0].comparison.availability,'unknown');
    assert.equal(r.comparisons[0].comparison.deltaBytes,null);
    assert.equal(r.comparisons[1].comparison.availability,'unknown');
  }
});

test('003T/4: forbid fabricated memory peak, Worker PID, native checks and forged deltas',()=>{
  const original=report();
  const mutants=[
    r=>{r.trueOperationPeakKnown=true;},
    r=>{r.workerPidMapping='verified';},
    r=>{r.leakProven=true;},
    r=>{r.comparisons[0].comparison.deltaBytes=90000000;},
    r=>{r.comparisons[1].comparison.availability='verified-operation-peak';},
    r=>{r.cycles.pop();},
    r=>{r.cycles[1].index=1;},
    r=>{r.cycles[2].workerReplies=1;},
    r=>{r.cycles[1].nativeExactAfterUndo=false;},
    r=>{r.cycles[2].nativeExactAfterRedo=false;},
    r=>{r.cycles[1].outsideUnchanged=false;},
    r=>{r.cycles[0].alphaUnchanged=false;},
    r=>{r.cycles[2].historyOnce=false;},
    r=>{r.cycles[2].lateRepliesAbsent=false;},
    r=>{r.cycles[0].before.rss.readStartedMs=0;},
    r=>{r.cycles[1].startMs=10;},
    r=>{r.cycles[2].before.cpu.incarnations[0].pid=102;},
    r=>{r.cycles[1].after.rss.aggregateRssBytes=1;},
    r=>{r.cycles[0].after.rss.processSamples[0].rssBytes=Infinity;},
    r=>{r.cycles[2].before.cpu.availability='unknown';},
    r=>{r.cycles[1].selectedPixels=576;},
    r=>{r.cycles[2].selectedPixelsChanged=0;},
    r=>{r.extraPeakRssBytes=123;},
    r=>{r.sessionId='not-a-uuid';},
    r=>{r.sessionStartedAtUnixMs=0;},
  ];
  for(const mutate of mutants){
    const r=copy(original);mutate(r);
    assert.throws(()=>check(r),/retention|CPU evidence|RSS|invalid|census/,mutate.toString());
  }
});

test('003T/4: identical sampled PID membership is comparable only, not causal',()=>{
  const c=cycles();
  assert.deepEqual(compareRetainedCycleSamples(c[0].after,c[1].after),
    {availability:'sampled-comparable-only',reason:null,deltaBytes:1000});
  c[1].after.rss.processSamples[0].starttimeTicks='999';
  assert.deepEqual(compareRetainedCycleSamples(c[0].after,c[1].after),
    {availability:'unknown',reason:'missing-or-inconsistent-cpu-rss',deltaBytes:null});
});
