import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  parseLinuxProcCpuStat,collectLinuxCpuCensus,
  validateLinuxCpuCensus,compareLinuxCpuCensuses,validateLinuxCpuEvidence,
} from '../tools/browser-linux-cpu-observation.mjs';

function stat(pid,start='100',user='20',system='7',comm='worker (test) )') {
  const fields=['S',...Array(19).fill('0')];
  fields[11]=user;fields[12]=system;fields[19]=start;
  return pid+' ('+comm+') '+fields.join(' ')+'\n';
}
function census(incarnations,readStartedMs,readFinishedMs) {
  return {availability:'observed',reason:null,readStartedMs,readFinishedMs,incarnations};
}
const item=(pid,starttimeTicks,userTicks,systemTicks)=>({
  pid,starttimeTicks,userTicks,systemTicks,
});
function evidence() {
  const before=census([item(9,'101','20','4'),item(11,'70','100','20')],10,12);
  const after=census([item(9,'101','30','6'),item(11,'71','1','0'),
    item(12,'7','3','2')],20,22);
  return {kind:'zpe-chromium-overlapping-cpu-ticks-v1',
    origin:'real Chromium file:// temporary Worker CPU control',
    workerAcknowledged:true,before,after,
    comparison:compareLinuxCpuCensuses(before,after),
    limitations:'Sampled counters are not operation CPU and not Worker PID; blind gaps.',
  };
}

test('003T/3a: Linux /proc stat correctly parses CPU fields and giant counters without rounding',()=>{
  assert.deepEqual(parseLinuxProcCpuStat(stat(9,'18446744073709551619',
    '999999999999999999999','00025'),9),
    {pid:9,starttimeTicks:'18446744073709551619',
      userTicks:'999999999999999999999',systemTicks:'25'});
  for (const raw of [stat(10), '9 (broken) S 1 2 3',
    stat(9,'0'),stat(9,'5','-1'),stat(9,'4','5','NA')]) {
    assert.throws(()=>parseLinuxProcCpuStat(raw,9),/003T CPU evidence/);
  }
});

test('003T/3a: CDP membership needs all distinct PIDs; permission/ENOENT leaves entire census unknown',async()=>{
  await assert.rejects(collectLinuxCpuCensus([{id:3},{id:3}]),/duplicate/);
  let clock=0;
  const unknown=await collectLinuxCpuCensus([{id:3},{id:4}],{
    platform:'linux',now:()=>++clock,
    readStat:async p=>p.includes('/3/')?stat(3):Promise.reject(Object.assign(
      Error('missing'),{code:'ENOENT'})),
  });
  assert.deepEqual(unknown,{
    availability:'unknown',reason:'proc-member-vanished',
    readStartedMs:1,readFinishedMs:2,incarnations:null,
  });
  assert.equal(validateLinuxCpuCensus(unknown),true);
  const second=await collectLinuxCpuCensus([{id:3}],{
    platform:'linux',now:()=>++clock,readStat:async()=>stat(3)});
  assert.equal(second.availability,'observed','new /proc observation may recover');
  const unsupported=await collectLinuxCpuCensus([{id:3}],{
    platform:'darwin',now:()=>++clock});
  assert.equal(unsupported.availability,'unknown');
  assert.equal(unsupported.reason,'unsupported-platform');
});

test('003T/3a: compare only matching incarnation deltas; no total CPU or Worker PID claims',()=>{
  const e=evidence();
  assert.deepEqual(e.comparison,{
    availability:'sampled-overlap-only',gapMs:8,
    matchedIncarnations:1,missingPids:0,newPids:1,reusedPids:1,
    matchedUserTicks:'10',matchedSystemTicks:'2',
    operationCpuTotalKnown:false,trueOperationPeakKnown:false,
    workerPidMapping:'unknown',
  });
  assert.equal(validateLinuxCpuEvidence(e),true);
  const unknown=compareLinuxCpuCensuses({
    availability:'unknown',reason:'proc-member-unavailable',
    readStartedMs:1,readFinishedMs:2,incarnations:null,
  },e.after);
  assert.equal(unknown.availability,'unknown');
  assert.equal(unknown.matchedUserTicks,null);
  assert.equal(unknown.workerPidMapping,'unknown');
});

test('003T/3a: reject spoofed CPU delta, reused PID CPU carryover, and false peak claims',()=>{
  const e=evidence();
  for(const mutate of [
    x=>{x.comparison.matchedUserTicks='13';},
    x=>{x.comparison.operationCpuTotalKnown=true;},
    x=>{x.comparison.workerPidMapping='mapped';},
    x=>{x.comparison.trueOperationPeakKnown=true;},
    x=>{x.comparison.gapMs=0;},
    x=>{x.before.incarnations[0].pid=11;},
    x=>{x.before.incarnations[0].starttimeTicks='000101';},
    x=>{x.after.readStartedMs=11;},
    x=>{x.before.incarnations.push({...x.before.incarnations[0]});},
    x=>{x.comparison.operationPeakCpuTicks='99';},
  ]) {
    const forged=structuredClone(e);mutate(forged);
    assert.throws(()=>validateLinuxCpuEvidence(forged),/003T CPU evidence/);
  }
  const reset=evidence();
  reset.after.incarnations[0].userTicks='2';
  assert.throws(()=>compareLinuxCpuCensuses(reset.before,reset.after),/regressed/);
});

test('003T/3a: real Linux /proc self PID gives parseable observed CPU counters', {
  skip:process.platform!=='linux',
},async()=>{
  const pid=process.pid;
  const value=await collectLinuxCpuCensus([{id:pid}],{
    platform:'linux',readStat:readFile});
  assert.equal(value.availability,'observed');
  assert.equal(value.incarnations[0].pid,pid);
  assert.ok(BigInt(value.incarnations[0].starttimeTicks)>0n);
});
