import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReplicatedNativeSessions}
  from '../tools/browser-native-retention-replication.mjs';

const compare=(delta)=>({comparison:delta===null
  ?{availability:'unknown',reason:'pid-incarnation-or-membership-change',deltaBytes:null}
  :{availability:'sampled-comparable-only',reason:null,deltaBytes:delta}});
const pair=(format,tag)=>({
  format,
  control:{kind:'zpe-native-observer-control-v1',format,sessionId:tag+'-observer',
    fixtureSha256:format==='PSD16'?'a'.repeat(64):'b'.repeat(64),
    nativeReceiptSha256:'d'.repeat(64),noAdditionalFill:true,
    trueOperationPeakKnown:false,workerPidMapping:'unknown',leakProven:false,
    comparisons:[compare(600),compare(-200)]},
  treatment:{kind:'zpe-native-same-session-retention-v1',format,
    sessionId:tag+'-treatment',fixtureSha256:format==='PSD16'?'a'.repeat(64):'b'.repeat(64),
    nativeReceiptSha256:'e'.repeat(64),trueOperationPeakKnown:false,
    workerPidMapping:'unknown',leakProven:false,
    comparisons:[compare(null),compare(0)]},
});
const good=()=>[pair('PSD16','a'),pair('PSB32','b')];
const cloned=x=>structuredClone(x);

test('003T/4b-2: count only comparable within-session sampled RSS, not leaks',()=>{
  const report=summarizeReplicatedNativeSessions(good());
  assert.equal(report.sessionCount,4);
  assert.equal(report.leakProven,false);
  assert.equal(report.causalOwner,'not-established');
  assert.equal(report.trueOperationPeakKnown,false);
  assert.equal(report.workerPidMapping,'unknown');
  assert.deepEqual(report.perDepth[0].observerOnly,
    {comparablePositive:1,comparableZero:0,comparableNegative:1,unknown:0});
  assert.deepEqual(report.perDepth[1].withNativeFill,
    {comparablePositive:0,comparableZero:1,comparableNegative:0,unknown:1});
  assert.equal(report.comparisonScope,'within-session-sampled-endpoints-only');
});

test('003T/4b-2: never accept missing/mixed depth or reused sessions',()=>{
  const mutators=[
    v=>v.pop(),
    v=>v.reverse(),
    v=>v[1].format='PSD16',
    v=>v[1].control.sessionId=v[0].treatment.sessionId,
    v=>v[0].treatment.sessionId=v[0].control.sessionId,
    v=>v[0].control.sessionId='',
    v=>v[0].control.fixtureSha256='f'.repeat(64),
    v=>v[0].control.noAdditionalFill=false,
    v=>v[1].treatment.leakProven=true,
    v=>v[0].control.trueOperationPeakKnown=true,
    v=>v[0].treatment.trueOperationPeakKnown=true,
    v=>v[1].control.workerPidMapping='renderer-pid',
    v=>v[0].treatment.comparisons.pop(),
    v=>v[0].control.comparisons[0].comparison.deltaBytes=null,
    v=>v[0].treatment.comparisons[0].comparison.deltaBytes=0,
    v=>v[0].treatment.comparisons[1].comparison.deltaBytes=NaN,
    v=>v[0].control.comparisons[0].comparison.availability='operation-peak',
  ];
  for(const modify of mutators){
    const inputs=cloned(good());modify(inputs);
    assert.throws(()=>summarizeReplicatedNativeSessions(inputs),/003T\/4b-2 replication/,
      modify.toString());
  }
});
