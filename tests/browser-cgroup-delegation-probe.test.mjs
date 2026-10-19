import test from 'node:test';
import assert from 'node:assert/strict';
import {probeCgroupDelegation,validateCgroupDelegationEvidence}
  from '../tools/browser-cgroup-delegation-probe.mjs';

const stat=(pid,tick)=>pid+' (node disposable worker) S '+
  Array(18).fill('1').join(' ')+' '+tick;
function harness({createError=null,moveError=null,observed='expected',
  reuse=false,selfChanged=false}={}){
  let group='',stops=0,removes=0,moves=0,reads=0;
  const child={pid:942,async stop(){stops++;}};
  const io={
    platform:'linux',name:'zpe-003t2d3-test-control',
    async readText(p){
      if(p==='/proc/self/cgroup')return selfChanged && moves?'0::/different\n':'0::/runner\n';
      if(p==='/sys/fs/cgroup/cgroup.controllers')return 'memory cpu\n';
      if(p==='/proc/942/stat')return stat(942,reuse && reads++?'12002':'12001');
      if(p==='/proc/942/cgroup')return '0::'+(
        observed==='expected'?'/runner/zpe-003t2d3-test-control':
        observed==='runner'?'/runner':'/other')+'\n';
      throw new Error('unexpected read');
    },
    async create(p){
      if(createError)throw Object.assign(new Error('denied'),{code:createError});
      group=p;
    },
    async writeText(p,value){
      assert.equal(p,group+'/cgroup.procs');
      assert.equal(value,'942');
      moves++;
      if(moveError)throw Object.assign(new Error('denied'),{code:moveError});
    },
    async remove(p){assert.equal(p,group);removes++;},
    async launchControl(){return child;},
  };
  return {io,counts:()=>({stops,removes,moves})};
}
test('003T/2d-3: controlled child must be migrated and torn down',async()=>{
  const h=harness();
  const e=await probeCgroupDelegation(h.io);
  assert.equal(validateCgroupDelegationEvidence(e),true);
  assert.equal(e.status,'control-migration-observed');
  assert.equal(e.reason,'controlled-child-migration-verified');
  assert.equal(e.cleanup,'complete');
  assert.equal(e.browserDescendantCoverage,'unknown');
  assert.equal(e.trueOperationPeakKnown,false);
  assert.deepEqual(h.counts(),{stops:1,removes:1,moves:1});
});
test('003T/2d-3: real CI read-only or restricted cgroup means BLOCKED, never peak',async()=>{
  for(const code of ['EROFS','EACCES','EPERM','EBUSY']){
    const h=harness({createError:code});
    const e=await probeCgroupDelegation(h.io);
    assert.equal(validateCgroupDelegationEvidence(e),true);
    assert.equal(e.status,'blocked');
    assert.equal(e.cgroupCreated,false);
    assert.equal(e.cleanup,'not-created');
    assert.deepEqual(h.counts(),{stops:0,removes:0,moves:0});
  }
  const h=harness({moveError:'EPERM'});
  const e=await probeCgroupDelegation(h.io);
  assert.equal(e.status,'blocked');
  assert.equal(e.reason,'cgroup-move-permission-denied');
  assert.equal(e.childMembershipVerified,false);
  assert.equal(e.cleanup,'complete');
  assert.deepEqual(h.counts(),{stops:1,removes:1,moves:1});
});
test('003T/2d-3: mismatched membership, reused PID and changed runner fail closed',async()=>{
  for(const options of [
    {observed:'runner'},{reuse:true},{selfChanged:true},
  ]){
    const h=harness(options);
    const e=await probeCgroupDelegation(h.io);
    assert.equal(e.status,'unknown');
    assert.equal(e.childMembershipVerified,false);
    assert.equal(e.cleanup,'complete');
    assert.deepEqual(h.counts(),{stops:1,removes:1,moves:1});
  }
  const e=await probeCgroupDelegation({platform:'darwin',name:'zpe-003t2d3-test'});
  assert.equal(e.status,'blocked');
  assert.equal(e.reason,'not-linux');
});
test('003T/2d-3: forged child success, peak, PID map, path leak rejected',async()=>{
  const e=await probeCgroupDelegation(harness().io);
  for(const mutate of [
    x=>{x.trueOperationPeakKnown=true;},
    x=>{x.workerPidMapping='942';},
    x=>{x.browserDescendantCoverage='complete';},
    x=>{x.operationPeakRssBytes=123;},
    x=>{x.status='blocked';},
    x=>{x.childMembershipVerified=false;},
    x=>{x.cleanup='not-created';},
    x=>{x.reason='cgroup-create-read-only';},
    x=>{x.limitations+=' /sys/fs/cgroup/private';},
    x=>{x.limitations+=' file:///home/runner/private';},
  ]){
    const forged=structuredClone(e);
    mutate(forged);
    assert.throws(()=>validateCgroupDelegationEvidence(forged),/003T cgroup delegation/);
  }
});
