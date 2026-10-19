import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeBrowserMilestoneWindows, validateBrowserMilestoneWindowAudit,
} from '../tools/browser-milestone-window-audit.mjs';

const samples = () => [
  {phase:'before-import',readStartedMs:100,readFinishedMs:104,
    pidMembershipObserved:true,linuxIdentityObserved:true,workerTargetsObserved:true,
    processPrivateMemoryBytes:1024,chromiumRssBytes:2048},
  {phase:'sample',readStartedMs:112,readFinishedMs:117,
    pidMembershipObserved:false,linuxIdentityObserved:false},
  {phase:'after-import',readStartedMs:120,readFinishedMs:130,
    pidMembershipObserved:false,linuxIdentityObserved:false,workerTargetsObserved:true},
  {phase:'finished',readStartedMs:145,readFinishedMs:160,
    pidMembershipObserved:true,linuxIdentityObserved:false,workerTargetsObserved:false,
    processPrivateMemoryBytes:1200},
];
const timing = {snapshotCount:4,periodicSamples:1,readWindowMs:60};

test('003T/2e: real sample read windows retain missing PID and identity milestones without gap or peak claims',()=>{
  const summary=summarizeBrowserMilestoneWindows(samples(),timing);
  assert.equal(validateBrowserMilestoneWindowAudit(summary,timing,4),true);
  assert.equal(summary.sampledReadCount,4);
  assert.equal(summary.milestones.length, timing.snapshotCount-timing.periodicSamples);
  assert.deepEqual(summary.milestones.map(x=>x.phase),['before-import','after-import','finished']);
  assert.equal(summary.missingPidMilestones,1);
  assert.equal(summary.missingLinuxIdentityMilestones,2);
  assert.equal(summary.unverifiedBetweenMilestoneIntervals,2);
  assert.equal(summary.milestones[1].readStartOffsetMs,20);
  assert.equal(summary.milestones[2].readEndOffsetMs,60);
  assert.equal(summary.trueOperationPeakKnown,false);
  assert.equal(summary.workerPidMapping,'unknown');
});

test('003T/2e: forged JSON peak, Worker PID, temporal boundaries and gaps fail closed',()=>{
  const valid=summarizeBrowserMilestoneWindows(samples(),timing);
  for (const changes of [
    {trueOperationPeakKnown:true},{workerPidMapping:'identified'},
    {missingPidMilestones:0},{missingLinuxIdentityMilestones:0},
    {unverifiedBetweenMilestoneIntervals:0},{sampledReadCount:3},
    {operationPeakRssBytes:123456},
    {milestones:valid.milestones.slice(1)},
    {milestones:valid.milestones.filter(m=>m.phase!=='after-import')},
    {milestones:valid.milestones.map((m,i)=>i===1
      ? {...m,privateMemoryObserved:true} : m)},
    {milestones:valid.milestones.map((m,i)=>i===1
      ? {...m,linuxRssObserved:true} : m)},
    {milestones:valid.milestones.map((m,i)=>i===2
      ? {...m,linuxIdentityObserved:true} : m)},
    {milestones:valid.milestones.map((m,i)=>i===0
      ? {...m,pidMembershipObserved:false} : m)},
    {milestones:valid.milestones.map((m,i)=>i===1?{...m,readStartOffsetMs:0}:m)},
    {milestones:valid.milestones.map((m,i)=>i===2?{...m,readEndOffsetMs:70}:m)},
    {milestones:valid.milestones.map((m,i)=>i===2?{...m,linuxIdentityObserved:null}:m)},
    {milestones:valid.milestones.map((m,i)=>i===2?{...m,pid:7}:m)},
  ]) assert.throws(()=>validateBrowserMilestoneWindowAudit({...valid,...changes},timing,4),/milestone windows/);
  assert.throws(()=>summarizeBrowserMilestoneWindows(samples().slice(1),timing),/milestone windows/);
  assert.throws(()=>validateBrowserMilestoneWindowAudit(valid,
    {...timing,periodicSamples:0},4),/milestone windows/);
  assert.throws(()=>validateBrowserMilestoneWindowAudit(valid,
    {...timing,periodicSamples:4},4),/milestone windows/);
  const impossible=samples();
  impossible[2].chromiumRssBytes=9999;
  assert.throws(()=>summarizeBrowserMilestoneWindows(impossible,timing),/milestone windows/);
});

test('003T/2e: invalid generic milestone labels cannot forge observed Worker targets',()=>{
  const events=samples();
  events[2]={...events[2],phase:'not a target label',workerTargetsObserved:false};
  const audit=summarizeBrowserMilestoneWindows(events,timing);
  assert.equal(audit.milestones[1].phase,'invalid-phase');
  assert.equal(audit.milestones[1].workerTargetsObserved,false);
  assert.throws(()=>validateBrowserMilestoneWindowAudit({
    ...audit,milestones:audit.milestones.map((m,i)=>i===1
      ? {...m,workerTargetsObserved:true} : m),
  },timing,4),/invalid read window or evidence flag/);
});
