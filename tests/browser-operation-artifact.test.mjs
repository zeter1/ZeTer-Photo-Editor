import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildBrowserOperationArtifact,writeBrowserOperationArtifact,verifyBrowserOperationArtifacts} from '../tools/browser-operation-artifact.mjs';

const completedPhases=[
  'import-input-dispatched','import-preview-ready','native-source-verified','selection-created',
  'fill-command-invoked','preview-history-published','undo-complete','redo-complete',
];
const cancelledPhases=[
  'cancel-fill-command-invoked','cancel-kernel-write-observed','cancel-owner-revoked',
  'cancel-native-verified','retry-fill-command-invoked','retry-preview-history-published',
  'retry-undo-native-verified','retry-redo-native-verified',
];
const sample=(operationId,format,outcome)=>({
  kind:'zpe-browser-high-depth-operation-timeline-v1',
  operationId,format,fixture:format==='PSD16'?'large.psd':'large.psb',outcome,
  observedWindowMs:123,
  milestones:[...completedPhases,...(outcome==='completed-with-cancelled-retry'?cancelledPhases:[])]
    .map((phase,index)=>({phase,atMs:1+index*5,sincePreviousMs:index===0?1:5})),
  memory:{sampleCount:2,requestedSamplingIntervalMs:50,
    chromiumPrivateMemoryAvailability:'unavailable',chromiumPrivateSampledMaxBytes:null,
    processChurn:{workerPidMapping:'unknown'},
    linuxProcessIdentity:{provenExitCount:null,noLongerObservedAtLastSnapshotCount:1,
      processes:[{pid:7,starttimeTicks:'12345678901234567890',observedAtLastSnapshot:false}]},
  },
});

test('024B2a: versioned artifact preserves unavailable memory, observation and no-exit claims',async()=>{
  const p=sample('stage003-psd16','PSD16','completed');
  const artifact=buildBrowserOperationArtifact(p);
  assert.equal(artifact.operationPeakRssBytes,null);
  assert.equal(artifact.observedProcessExitCount,null);
  assert.equal(artifact.timeline.memory.chromiumPrivateSampledMaxBytes,null);
  assert.equal(artifact.timeline.memory.linuxProcessIdentity.processes[0].starttimeTicks,'12345678901234567890');
  assert.match(artifact.processExitEvidence,/NOT a verified/);
  assert.equal(await writeBrowserOperationArtifact(p,{directory:''}),null);
  assert.throws(()=>buildBrowserOperationArtifact({...p,operationId:'../escape'}),/unsafe operationId/);
  assert.throws(()=>buildBrowserOperationArtifact({...p,memory:{sampleCount:0}}),/invalid timeline/);
});

test('024B2a: CI file writer and verifier require both genuine PSD16 and PSB32 timelines',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'zpe-024b2-'));
  try {
    const first=sample('stage003-psd16-with-cancelled-retry','PSD16','completed-with-cancelled-retry');
    const second=sample('stage003-psb32-with-cancelled-retry','PSB32','completed-with-cancelled-retry');
    const location=await writeBrowserOperationArtifact(first,{directory});
    assert.equal(location,path.join(directory,'stage003-psd16-with-cancelled-retry.json'));
    assert.deepEqual(JSON.parse(await readFile(location,'utf8')),buildBrowserOperationArtifact(first));
    await assert.rejects(verifyBrowserOperationArtifacts(directory),/ENOENT/);
    await writeBrowserOperationArtifact(second,{directory});
    assert.deepEqual(await verifyBrowserOperationArtifacts(directory),[
      'stage003-psd16-with-cancelled-retry.json','stage003-psb32-with-cancelled-retry.json',
    ]);
    const bad=sample('stage003-psb32-with-cancelled-retry','PSB32','completed');
    await writeBrowserOperationArtifact(bad,{directory});
    await assert.rejects(verifyBrowserOperationArtifacts(directory),/incorrect or unsupported/);
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
});

test('029: reordered, duplicate, inconsistent or altered serialized evidence fails closed',async()=>{
  const p=sample('stage003-psd16-with-cancelled-retry','PSD16','completed-with-cancelled-retry');
  const reordered=p.milestones.map(event=>({...event}));
  [reordered[11].phase,reordered[12].phase]=[reordered[12].phase,reordered[11].phase];
  assert.throws(()=>buildBrowserOperationArtifact({...p,milestones:reordered}),/out-of-order evidence/);
  const duplicate=p.milestones.map(event=>({...event}));
  duplicate[12].phase=duplicate[11].phase;
  assert.throws(()=>buildBrowserOperationArtifact({...p,milestones:duplicate}),/invalid milestone evidence/);
  const wrongDelta=p.milestones.map(event=>({...event}));
  wrongDelta[6].sincePreviousMs=0;
  assert.throws(()=>buildBrowserOperationArtifact({...p,milestones:wrongDelta}),/invalid milestone evidence/);
  assert.throws(()=>buildBrowserOperationArtifact({...p,observedWindowMs:10}),/invalid milestone evidence/);
  assert.throws(()=>buildBrowserOperationArtifact({...p,milestones:p.milestones.slice(0,-1)}),/missing or out-of-order evidence/);
  const directory=await mkdtemp(path.join(os.tmpdir(),'zpe-029-'));
  try {
    await writeBrowserOperationArtifact(p,{directory});
    await writeBrowserOperationArtifact(sample('stage003-psb32-with-cancelled-retry','PSB32','completed-with-cancelled-retry'),{directory});
    const location=path.join(directory,'stage003-psd16-with-cancelled-retry.json');
    const forged=JSON.parse(await readFile(location,'utf8'));
    forged.timeline.milestones[11].phase='cancel-native-verified';
    forged.timeline.milestones[13].phase='cancel-owner-revoked';
    await writeFile(location,JSON.stringify(forged),'utf8');
    await assert.rejects(verifyBrowserOperationArtifacts(directory),/invalid milestone evidence|out-of-order evidence/);
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
});
