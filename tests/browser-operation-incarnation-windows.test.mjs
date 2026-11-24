import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBrowserMilestoneWindows} from '../tools/browser-milestone-window-audit.mjs';
import {
  summarizeBrowserOperationIncarnationWindows,
  validateBrowserOperationIncarnationWindows,
} from '../tools/browser-operation-incarnation-windows.mjs';

function evidence() {
  const samples=[
    {phase:'before-import',readStartedMs:100,readFinishedMs:110,
      pidMembershipObserved:true,linuxIdentityObserved:true,workerTargetsObserved:true,
      chromiumRssBytes:4096,linuxIncarnations:[{pid:42,starttimeTicks:'12345678901234567890'},
        {pid:11,starttimeTicks:'23'}]},
    {phase:'before-first-fill',readStartedMs:120,readFinishedMs:125,
      pidMembershipObserved:true,linuxIdentityObserved:false,workerTargetsObserved:true},
    {phase:'after-large-worker-preview',readStartedMs:139,readFinishedMs:148,
      pidMembershipObserved:true,linuxIdentityObserved:true,workerTargetsObserved:true,
      chromiumRssBytes:5500,linuxIncarnations:[{pid:42,starttimeTicks:'12345678901234567891'}]},
    {phase:'finished',readStartedMs:155,readFinishedMs:166,
      pidMembershipObserved:false,linuxIdentityObserved:false,workerTargetsObserved:false},
  ];
  const timing={snapshotCount:4,periodicSamples:0,readWindowMs:66};
  const milestoneAudit=summarizeBrowserMilestoneWindows(samples,timing);
  return {samples,milestoneAudit};
}

test('003T/2f-2: endpoints retain real sorted Linux PID incarnations, missing reads and every unknown interval',()=>{
  const {samples,milestoneAudit}=evidence();
  const audit=summarizeBrowserOperationIncarnationWindows(samples,milestoneAudit);
  assert.equal(validateBrowserOperationIncarnationWindows(audit,milestoneAudit),true);
  assert.deepEqual(audit.windows.map(w=>w.availability),['observed','unknown','observed','unknown']);
  assert.deepEqual(audit.windows[0].incarnations,[
    {pid:11,starttimeTicks:'23'},{pid:42,starttimeTicks:'12345678901234567890'},
  ]);
  assert.equal(audit.windows[1].incarnations,null);
  assert.deepEqual(audit.windows[2].incarnations,[{pid:42,starttimeTicks:'12345678901234567891'}]);
  assert.equal(audit.unverifiedIntervals.length,3);
  assert.deepEqual(audit.unverifiedIntervals.map(i=>i.unobservedGapMs),[10,14,7]);
  assert.ok(audit.unverifiedIntervals.every(i=>i.pidIncarnationContinuity==='unknown'));
  assert.equal(audit.workerPidMapping,'unknown');
  assert.equal(audit.trueOperationPeakKnown,false);
});

test('003T/2f-2: cannot promote skipped /proc into a fake snapshot or continuous Worker PID',()=>{
  const {samples,milestoneAudit}=evidence();
  const a=summarizeBrowserOperationIncarnationWindows(samples,milestoneAudit);
  for(const tamper of [
    x=>{x.windows[1].availability='observed';x.windows[1].incarnations=[{pid:7,starttimeTicks:'9'}];},
    x=>{x.windows[0].incarnations=null;},
    x=>{x.windows[0].incarnations[1].starttimeTicks='invalid';},
    x=>{x.windows[0].incarnations[1].pid=11;},
    x=>{x.windows[2].incarnations[0].starttimeTicks=123;},
    x=>{x.windows[2].incarnations[0].workerTargetId='abc';},
    x=>{x.windows[2].readStartOffsetMs+=1;},
    x=>{x.windows[3].incarnations=[];},
    x=>{x.unverifiedIntervals.splice(1,1);},
    x=>{x.unverifiedIntervals[0].pidIncarnationContinuity='continuous';},
    x=>{x.unverifiedIntervals[1].unobservedGapMs=0;},
    x=>{x.workerPidMapping='joined';},
    x=>{x.trueOperationPeakKnown=true;},
    x=>{x.operationPeakRssBytes=9000;},
  ]) {
    const forged=structuredClone(a);
    tamper(forged);
    assert.throws(()=>validateBrowserOperationIncarnationWindows(forged,milestoneAudit),
      /Chromium incarnation windows/, 'forged boundary or coverage must be rejected');
  }
});

test('003T/2f-2: observations must derive from actual read payload, not previous milestone state',()=>{
  const {samples,milestoneAudit}=evidence();
  assert.throws(()=>summarizeBrowserOperationIncarnationWindows(
    samples.map((s,i)=>i===0?{...s,linuxIncarnations:undefined}:s),milestoneAudit
  ),/inconsistent sampled Linux identity/);
  assert.throws(()=>summarizeBrowserOperationIncarnationWindows(
    samples.map((s,i)=>i===1?{...s,linuxIncarnations:[{pid:11,starttimeTicks:'23'}]}:s),
    milestoneAudit
  ),/inconsistent sampled Linux identity/);
  const broken=samples.map((s,i)=>i===2?{...s,linuxIncarnations:[
    {pid:42,starttimeTicks:'123'},{pid:42,starttimeTicks:'124'},
  ]}:s);
  assert.throws(()=>summarizeBrowserOperationIncarnationWindows(broken,milestoneAudit),
    /duplicate\/invalid\/reused PID evidence/);
});
