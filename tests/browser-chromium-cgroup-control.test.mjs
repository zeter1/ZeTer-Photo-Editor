import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCgroupV2,probeChromiumCgroup,validateChromiumCgroupScopeEvidence}
  from '../tools/browser-chromium-cgroup-control.mjs';

const MIB=1024*1024;
const sampled=(value,scope='shared-with-runner',starttimeTicks='12001')=>({
  availability:'sampled',scope,memoryCurrentBytes:value*MIB,starttimeTicks,
  reason:scope==='shared-with-runner'?
    'runner-and-chromium-share-cgroup':'exclusive-membership-unverified',
});
const unavailable=reason=>({availability:'unavailable',scope:'unknown',
  memoryCurrentBytes:null,starttimeTicks:null,reason});
const fixture=()=>({
  kind:'zpe-real-chromium-cgroup-scope-v1',schemaVersion:1,
  origin:'real Chromium file:// temporary Worker allocation',
  launcherPid:421,controlBytes:64*MIB,workerAcknowledged:true,
  before:sampled(200),held:sampled(268),
  trueOperationPeakKnown:false,workerPidMapping:'unknown',
  limitations:'memory.current is not operation peak, cgroup is not exclusive, blind sampling windows; launcher is not Worker PID.',
});

test('003T/2d-2: parse only unique canonical cgroup v2 membership',()=>{
  assert.equal(parseCgroupV2('0::/user.slice/test.scope\n'),' /user.slice/test.scope'.trim());
  for(const input of ['2:cpu:/group','0::relative','0::/a/../b','0::/./b',
    '0::/a\n0::/b','0::/a\\evil','0::/bad\0name']){
    assert.equal(parseCgroupV2(input),null,input);
  }
});

test('003T/2d-2: real-shaped cgroup probes distinguish shared and unverified separate',async()=>{
  const stat=pid=>pid+' (chrome worker main) S '+Array(18).fill('1').join(' ')+' 12001';
  const fake=async name=>{
    if(name==='/proc/421/stat')return stat(421);
    if(name==='/proc/self/cgroup')return '0::/runner\n';
    if(name==='/proc/421/cgroup')return '0::/runner\n';
    if(name==='/sys/fs/cgroup/runner/memory.current')return String(245*MIB)+'\n';
    throw new Error('unexpected '+name);
  };
  const same=await probeChromiumCgroup(421,{platform:'linux',readText:fake});
  assert.deepEqual(same,sampled(245));
  const separate=await probeChromiumCgroup(421,{platform:'linux',readText:async name=>
    name==='/proc/421/cgroup'?'0::/browser\n':
    name==='/sys/fs/cgroup/browser/memory.current'?String(300*MIB):fake(name)});
  assert.deepEqual(separate,sampled(300,'separate-unverified'));
  assert.deepEqual(await probeChromiumCgroup(421,{platform:'darwin'}),unavailable('not-linux'));
  const missing=await probeChromiumCgroup(421,{platform:'linux',readText:async name=>{
    if(name.includes('memory.current'))throw Object.assign(new Error('denied'),{code:'EACCES'});
    return fake(name);
  }});
  assert.deepEqual(missing,unavailable('missing-or-inaccessible-proc-or-cgroup'));
  const reused=await probeChromiumCgroup(421,{platform:'linux',readText:(()=>{
    let statReads=0;
    return async name=>name==='/proc/421/stat'?
      stat(421).replace('12001',String(12001+(statReads++))):fake(name);
  })()});
  assert.deepEqual(reused,unavailable('pid-incarnation-changed'));
});

test('003T/2d-2: cgroup memory.current is accepted ONLY as sampled, not peak',()=>{
  assert.equal(validateChromiumCgroupScopeEvidence(fixture()),true);
  const separate=fixture();
  separate.before=sampled(160,'separate-unverified');
  separate.held=sampled(230,'separate-unverified');
  assert.equal(validateChromiumCgroupScopeEvidence(separate),true);
  const blocked=fixture();
  blocked.before=unavailable('no-readable-cgroup-v2');
  blocked.held=unavailable('missing-or-inaccessible-proc-or-cgroup');
  assert.equal(validateChromiumCgroupScopeEvidence(blocked),true,
    'CI without cgroup v2 must not forge a positive counter');
});

test('003T/2d-2: forged isolation, PID reuse, unknown reads and peak fail closed',()=>{
  const changes=[
    e=>{e.trueOperationPeakKnown=true;},
    e=>{e.workerPidMapping='421';},
    e=>{e.operationPeakRssBytes=268*MIB;},
    e=>{e.workerRssBytes=64*MIB;},
    e=>{e.controlBytes=32*MIB;},
    e=>{e.workerAcknowledged=false;},
    e=>{e.held.starttimeTicks='12002';},
    e=>{e.held.scope='separate-unverified';},
    e=>{e.held.scope='isolated';},
    e=>{e.held.reason='isolated';},
    e=>{e.before.memoryCurrentBytes=0;},
    e=>{e.before.memoryCurrentBytes=-1;},
    e=>{e.before.memoryCurrentBytes=null;},
    e=>{e.held.availability='unavailable';},
    e=>{e.held=unavailable('made-up');},
    e=>{e.held=unavailable('not-linux');e.held.memoryCurrentBytes=12;},
    e=>{delete e.before;},
    e=>{e.limitations+=' file:///private-home';},
    e=>{e.limitations+=' /sys/fs/cgroup/user.slice';},
    e=>{e.limitations+=' blob:memory';},
    e=>{e.limitations='measured peak';},
  ];
  for(const change of changes){
    const e=fixture();
    change(e);
    assert.throws(()=>validateChromiumCgroupScopeEvidence(e),
      /003T Chromium cgroup scope/);
  }
});
