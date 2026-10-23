import test from 'node:test';
import assert from 'node:assert/strict';
import {probeCgroupDelegation} from '../tools/browser-cgroup-delegation-probe.mjs';
import {buildControlledWorkerPidEvidence,validateControlledWorkerPidEvidence,
  captureControlledWorkerStage} from '../tools/browser-controlled-worker-pid-isolation.mjs';

const pid=4123;
const census=(start,end,ticks)=>({
  availability:'observed',reason:null,readStartedMs:start,readFinishedMs:end,
  incarnations:[{pid,starttimeTicks:'9007199254740993111',
    userTicks:String(ticks),systemTicks:'2'}],
});
const stage=(start,end,ticks)=>({
  pageTargetObserved:true,
  launcher:{availability:'sampled',starttimeTicks:'9007199254740993111'},
  cpuCensus:census(start,end,ticks),
});
async function fixture(){
  const cgroup=await probeCgroupDelegation({
    platform:'darwin',name:'zpe-003t2d3-controlled-test'});
  return buildControlledWorkerPidEvidence({
    launcherPid:pid,pageTargetId:'ABCD1234',
    worker:{before:[],held:['FFAA11'],after:[],controlledTargetId:'FFAA11',
      readyAcknowledged:true,terminateInvoked:true},
    stages:{before:stage(1,2,10),held:stage(3,4,12),after:stage(5,6,13)},
    cgroup,
  });
}
test('003T/3d-2: valid lifecycle proves target visibility and launcher-only PID join',async()=>{
  const e=await fixture();
  assert.equal(validateControlledWorkerPidEvidence(e),true);
  assert.equal(e.launcherCdpJoins.held,'verified-launcher-only');
  assert.equal(e.cpuWindows.beforeHeld.availability,'sampled-overlap-only');
  assert.equal(e.workerPidMapping,'unknown');
  assert.equal(e.trueOperationPeakKnown,false);
  assert.equal(e.provenWorkerProcessExitCount,null);
});
test('003T/3d-2: forbid false Worker PID, OS exit, peak or invented CPU',async()=>{
  const e=await fixture();
  const mutations=[
    x=>{x.workerPidMapping=String(pid);},
    x=>{x.workerOsPid=pid;},
    x=>{x.trueOperationPeakKnown=true;},
    x=>{x.operationCpuTotalKnown=true;},
    x=>{x.provenWorkerProcessExitCount=1;},
    x=>{x.operationPeakRssBytes=123;},
    x=>{x.cpuWindows.beforeHeld.matchedUserTicks='999';},
    x=>{x.launcherCdpJoins.held='worker-os-pid';},
    x=>{x.cgroup.trueOperationPeakKnown=true;},
    x=>{x.limitations+=' file:///home/private';},
  ];
  for(const change of mutations){
    const copy=structuredClone(e);change(copy);
    assert.throws(()=>validateControlledWorkerPidEvidence(copy),
      /003T\/3d-2 controlled Worker|003T cgroup delegation/);
  }
});
test('003T/3d-2: reject phantom target, no disappearance, PID reuse',async()=>{
  const e=await fixture();
  const changes=[
    x=>{x.worker.held=[];},
    x=>{x.worker.after=['FFAA11'];},
    x=>{x.worker.readyAcknowledged=false;},
    x=>{x.worker.terminateInvoked=false;},
    x=>{x.worker.controlledTargetId='other';},
    x=>{x.worker.held=['FFAA11','FFAA11'];},
    x=>{x.stages.held.pageTargetObserved=false;},
    x=>{x.stages.after.launcher.starttimeTicks='9007199254740993222';},
    x=>{x.stages.after.cpuCensus.incarnations[0].starttimeTicks=
      '9007199254740993222';},
  ];
  for(const change of changes){
    const copy=structuredClone(e);change(copy);
    assert.throws(()=>validateControlledWorkerPidEvidence(copy),
      /003T\/3d-2 controlled Worker|003T CPU evidence/);
  }
});
test('003T/3d-2: denied Linux or CDP census stays unknown, not zero',async()=>{
  const e=await fixture();
  e.stages.held.launcher={availability:'unavailable',starttimeTicks:null};
  e.stages.held.cpuCensus={availability:'unknown',reason:'proc-access-denied',
    readStartedMs:3,readFinishedMs:4,incarnations:null};
  const derived=buildControlledWorkerPidEvidence({
    launcherPid:e.launcherPid,pageTargetId:e.pageTargetId,worker:e.worker,
    stages:e.stages,cgroup:e.cgroup});
  assert.equal(derived.launcherCdpJoins.held,'unknown');
  assert.equal(derived.cpuWindows.beforeHeld.availability,'unknown');
  assert.equal(derived.cpuWindows.beforeHeld.matchedUserTicks,null);
  assert.equal(derived.cpuWindows.heldAfter.availability,'unknown');
  const forged=structuredClone(derived);
  forged.cpuWindows.beforeHeld.availability='sampled-overlap-only';
  assert.throws(()=>validateControlledWorkerPidEvidence(forged),
    /003T\/3d-2 controlled Worker/);
});
test('003T/3d-2: real capture rejects missing page, duplicate targets, and fails closed on CDP loss',async()=>{
  const empty={send:async()=>({})};
  const opts={
    targets:async()=>({targetInfos:[
      {type:'page',targetId:'ABCD1234'},{type:'worker',targetId:'FFAA11'}]}),
    processes:async()=>{throw new Error('CDP unavailable');},
    probe:async()=>({availability:'unavailable',starttimeTicks:null}),
  };
  const r=await captureControlledWorkerStage(empty,pid,'ABCD1234',opts);
  assert.deepEqual(r.workerIds,['FFAA11']);
  assert.equal(r.stage.cpuCensus.availability,'unknown');
  assert.equal(r.stage.cpuCensus.reason,'cdp-unavailable');
  await assert.rejects(captureControlledWorkerStage(empty,pid,'BAD',{
    ...opts}),/missing controller page/);
  await assert.rejects(captureControlledWorkerStage(empty,pid,'ABCD1234',{
    ...opts,targets:async()=>({targetInfos:[
      {type:'page',targetId:'ABCD1234'},
      {type:'worker',targetId:'FFAA11'},{type:'worker',targetId:'FFAA11'}]})
  }),/invalid CDP Worker targets/);
});
