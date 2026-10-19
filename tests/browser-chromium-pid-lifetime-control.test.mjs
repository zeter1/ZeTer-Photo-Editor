import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChromiumOsPidControlEvidence,probeLinuxPid,
  readVerifiedLinuxPidRss} from '../tools/browser-chromium-pid-lifetime-control.mjs';

const stat=(pid,ticks)=>pid+' (chrome (main)) S '+Array(18).fill('0').join(' ')+
  ' '+ticks+' 0\\n';
const row={pid:4123,starttimeTicks:'18446744073709551619',
  rssBytes:65536,highWaterBytes:98304};
const fixture=()=>({
  kind:'zpe-real-chromium-os-pid-lifetime-v1',schemaVersion:1,
  origin:'real Linux Chromium file:// launcher',pid:4123,
  before:{...row},afterGap:{...row,rssBytes:70000},
  skippedGap:{availability:'not-observed',
    reason:'deliberately-skipped-/proc-read',observedReads:0},
  injectedDeniedRead:{availability:'unavailable',reason:'injected-EACCES',rssBytes:null},
  exit:{closeEventObserved:true,signalSent:'SIGTERM',
    signalObserved:'SIGTERM',exitCode:null},
  postExit:{availability:'missing',starttimeTicks:null},
  trueOperationPeakKnown:false,workerPidMapping:'unknown',
  limitations:'Observed spawned Chromium launcher process (not Worker); VmHWM is not operation peak',
});

test('003T/2c: Linux PID incarnation control accepts only sampled lifetime and explicit gaps',()=>{
  assert.equal(validateChromiumOsPidControlEvidence(fixture()),true);
  const reused=fixture();
  reused.postExit={availability:'reused',starttimeTicks:'18446744073709551620'};
  assert.equal(validateChromiumOsPidControlEvidence(reused),true,
    'later recycled PID is not the original incarnation');
});

test('003T/2c: forged exited PID, op peak, missed /proc, RSS or Worker attribution fail closed',()=>{
  const changes=[
    e=>{e.trueOperationPeakKnown=true;},
    e=>{e.workerPidMapping='4123';},
    e=>{e.workerRssBytes=100;},
    e=>{e.operationPeakRssBytes=200;},
    e=>{e.origin='unit test';},
    e=>{e.afterGap.pid=4124;},
    e=>{e.afterGap.starttimeTicks='18446744073709551620';},
    e=>{e.afterGap.starttimeTicks='1.0';},
    e=>{e.afterGap.rssBytes=-1;},
    e=>{e.before.highWaterBytes=0;},
    e=>{e.skippedGap.availability='sampled';},
    e=>{e.skippedGap.observedReads=1;},
    e=>{e.injectedDeniedRead.rssBytes=1;},
    e=>{e.injectedDeniedRead.reason='actual kernel permission denied';},
    e=>{e.exit.closeEventObserved=false;},
    e=>{e.exit.signalObserved=null;},
    e=>{e.exit.exitCode=0;},
    e=>{e.postExit.availability='unavailable';},
    e=>{e.postExit.starttimeTicks='1';},
    e=>{e.postExit={availability:'reused',starttimeTicks:e.before.starttimeTicks};},
    e=>{e.provenWorkerExitCount=1;},
  ];
  for(const corrupt of changes){
    const changed=structuredClone(fixture());corrupt(changed);
    assert.throws(()=>validateChromiumOsPidControlEvidence(changed),
      /003T OS PID control/);
  }
});

test('003T/2c: /proc ENOENT is not EACCES or failed stat parsing; PID starttime exact',async()=>{
  const pid=73;
  const observed=await probeLinuxPid(pid,{
    readStat:async()=>stat(pid,'18446744073709551619'),
  });
  assert.deepEqual(observed,{availability:'sampled',
    starttimeTicks:'18446744073709551619'});
  for(const code of ['ENOENT','ESRCH']){
    assert.deepEqual(await probeLinuxPid(pid,{readStat:async()=>{
      const e=new Error(code);e.code=code;throw e;
    }}),{availability:'missing',starttimeTicks:null});
  }
  for(const code of ['EACCES','EPERM','EIO']){
    assert.deepEqual(await probeLinuxPid(pid,{readStat:async()=>{
      const e=new Error(code);e.code=code;throw e;
    }}),{availability:'unavailable',starttimeTicks:null});
  }
  assert.deepEqual(await probeLinuxPid(pid,{readStat:async()=>stat(pid,'0')}),
    {availability:'unavailable',starttimeTicks:null});
  assert.deepEqual(await probeLinuxPid(pid,{readStat:async()=>stat(pid+1,'11')}),
    {availability:'unavailable',starttimeTicks:null});
});

test('003T/2c: corrupted RSS membership cannot be admitted as a Linux process sample',async()=>{
  const cdp=[{id:4123,type:'browser'}], valid={
    supported:true,processCount:1,aggregateRssBytes:row.rssBytes,
    largestProcessHighWaterBytes:row.highWaterBytes,
    processSamples:[{...row,type:'browser'}],
  };
  const sample=async()=>valid;
  assert.deepEqual(await readVerifiedLinuxPidRss(4123,{sample}),row);
  for(const invalid of [
    {...valid,processCount:0},
    {...valid,aggregateRssBytes:1},
    {...valid,processSamples:[]},
    {...valid,processSamples:[{...row,pid:4124}]},
    {...valid,processSamples:[{...row,starttimeTicks:'0'}]},
  ])await assert.rejects(readVerifiedLinuxPidRss(4123,{sample:async()=>invalid}),
    /Chromium RSS identity|003T OS PID control/);
  assert.deepEqual(cdp,[{id:4123,type:'browser'}]);
});
