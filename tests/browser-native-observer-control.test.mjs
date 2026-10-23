import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BROWSER_DENSE_CANCEL_LIMITATIONS} from '../tools/browser-dense-cancel-evidence.mjs';
import {createNativeObserverControl,validateNativeObserverControl}
  from '../tools/browser-native-observer-control.mjs';

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

const controls=()=>[1,2,3].map(i=>{
  const startMs=200+i*100;
  return {index:i,startMs,finishMs:startMs+40,
    before:mark(startMs+1,10000+i*700),
    after:mark(startMs+30,10100+i*700),
    workerJobs:2,workerReplies:1,undoNativeExact:true,redoNativeExact:true,
    historyUnchanged:true,selectionUnchanged:true,noNewWorker:true,
    projectReadbacks:3};
});
const make=(c=controls(),n=native())=>createNativeObserverControl({
  format:n.format,sessionId:randomUUID(),sessionStartedAtUnixMs:1792750000000,
  fixtureSha256,nativeReceipt:n,baselineAfterFill:mark(100,8000),controls:c,
});
const check=(r,n=native())=>validateNativeObserverControl(r,n,fixtureSha256);
const copy=x=>structuredClone(x);

test('003T/4b: genuine no-extra-Fill control shape and sampled-only deltas',()=>{
  const n=native(),r=make(controls(),n);
  assert.equal(check(r,n),true);
  assert.deepEqual(r.comparisons.map(x=>x.comparison.deltaBytes),[700,700]);
  assert.equal(r.noAdditionalFill,true);
  assert.equal(r.leakProven,false);
  assert.equal(r.trueOperationPeakKnown,false);
  assert.equal(r.workerPidMapping,'unknown');
  const n32={...n,format:'PSB32',sourceRawBytes:2_030_000*16};
  assert.equal(check(make(controls(),n32),n32),true);
  assert.throws(()=>check(r,n32),/observer control/);
});

test('003T/4b: missing PID membership or reused incarnation stays unknown',()=>{
  for(const name of ['unknown','rssMissing','reused']){
    const c=controls();
    c[1].after=mark(430,11800,{[name]:true});
    const r=make(c);
    assert.equal(check(r),true);
    for(const comparison of r.comparisons){
      assert.equal(comparison.comparison.availability,'unknown');
      assert.equal(comparison.comparison.deltaBytes,null);
    }
  }
});

test('003T/4b: reject forged attribution, cross-identity or incomplete controls',()=>{
  const good=make();
  const mutants=[
    r=>{r.noAdditionalFill=false;},
    r=>{r.trueOperationPeakKnown=true;},
    r=>{r.workerPidMapping='proven';},
    r=>{r.leakProven=true;},
    r=>{r.sessionId='not-a-session';},
    r=>{r.sessionStartedAtUnixMs=0;},
    r=>{r.controls.pop();},
    r=>{r.controls[1].index=1;},
    r=>{r.controls[0].workerJobs=3;},
    r=>{r.controls[1].workerReplies=2;},
    r=>{r.controls[0].undoNativeExact=false;},
    r=>{r.controls[0].redoNativeExact=false;},
    r=>{r.controls[2].historyUnchanged=false;},
    r=>{r.controls[2].noNewWorker=false;},
    r=>{r.controls[1].selectionUnchanged=false;},
    r=>{r.controls[2].projectReadbacks=1;},
    r=>{r.comparisons[0].comparison.deltaBytes=12345678;},
    r=>{r.comparisons[1].comparison.availability='operation-peak';},
    r=>{r.controls[1].before.rss.aggregateRssBytes=0;},
    r=>{r.controls[1].after.rss.processSamples[0].starttimeTicks='999';},
    r=>{r.controls[1].startMs=0;},
    r=>{r.controls[0].before.cpu.readStartedMs=0;},
    r=>{r.controls[0].after.cpu.availability='unknown';},
    r=>{r.extraClaim={leak:true};},
  ];
  for(const mutate of mutants){
    const r=copy(good);mutate(r);
    assert.throws(()=>check(r),/observer control|CPU evidence|RSS|invalid|census|retention/,
      mutate.toString());
  }
});

test('003T/4b: fixture/native source hash and readback window must stay exact',()=>{
  const original=make();
  assert.throws(()=>validateNativeObserverControl(original,native(),'f'.repeat(64)),
    /observer control/);
  const n=native();n.retryUndoExact=false;
  assert.throws(()=>check(original,n),/native|dense|observer control/);
  const r=copy(original);
  r.baselineAfterFill.rss.processSamples=null;
  assert.throws(()=>check(r),/RSS|observer control/);
});
