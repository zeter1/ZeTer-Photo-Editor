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
  durationsMs:{
    importInputToPreview:5,fillCommandToHistoryPreview:5,undoToRedo:5,
    cancelledRetryObservation:outcome==='completed-with-cancelled-retry'?15:null,
    recoveredRetryToRedo:outcome==='completed-with-cancelled-retry'?15:null,
  },
  quality:{
    kind:'zpe-browser-synthetic-native-quality-v1',
    reference:'ZeTer-authored constant native background; not Photoshop',
    bitsPerChannel:format==='PSD16'?16:32,channels:4,sampledPixels:25,
    baseline:{mae:20,rmse:25},firstFill:{mae:4,rmse:5},firstRedo:{mae:4,rmse:5},
    cancelled:outcome==='completed-with-cancelled-retry'?{mae:20,rmse:25}:null,
    recoveredFill:outcome==='completed-with-cancelled-retry'?{mae:3,rmse:4}:null,
    recoveredUndo:outcome==='completed-with-cancelled-retry'?{mae:20,rmse:25}:null,
    recoveredRedo:outcome==='completed-with-cancelled-retry'?{mae:3,rmse:4}:null,
  },
  memory:{sampleCount:2,requestedSamplingIntervalMs:50,
    samplingTiming:{method:'serialized-CDP-read-windows',
      snapshotCount:2,periodicSamples:0,pollsAttempted:0,pollsSkippedBusy:0,
      readWindowMs:120,maxReadDurationMs:60,maxBetweenReadWindowsMs:0,
      maxBetweenReadStartsMs:60,trueOperationPeakKnown:false,workerPidMapping:'unknown',
      limitations:'Serialized read, not when all processes were measured atomically.'},
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

test('030: forged duration summaries and malformed values are rejected at artifact boundary',async()=>{
  const p=sample('stage003-psd16-with-cancelled-retry','PSD16','completed-with-cancelled-retry');
  assert.equal(buildBrowserOperationArtifact(p).timeline.durationsMs.cancelledRetryObservation,15);
  const forged=[
    {...p.durationsMs,importInputToPreview:6},
    {...p.durationsMs,fillCommandToHistoryPreview:0},
    {...p.durationsMs,undoToRedo:-1},
    {...p.durationsMs,cancelledRetryObservation:NaN},
    {...p.durationsMs,recoveredRetryToRedo:Infinity},
    {...p.durationsMs,recoveredRetryToRedo:null},
    {...p.durationsMs,unknownMetric:0},
  ];
  for(const durationsMs of forged){
    assert.throws(()=>buildBrowserOperationArtifact({...p,durationsMs}),/duration evidence/);
  }
  const {undoToRedo,...missing}=p.durationsMs;
  assert.throws(()=>buildBrowserOperationArtifact({...p,durationsMs:missing}),/duration evidence/);
  assert.throws(()=>buildBrowserOperationArtifact({...p,durationsMs:undefined}),/duration evidence/);
  const completed=sample('other','PSD16','completed');
  assert.throws(()=>buildBrowserOperationArtifact({
    ...completed,durationsMs:{...completed.durationsMs,cancelledRetryObservation:0},
  }),/duration evidence/);

  const directory=await mkdtemp(path.join(os.tmpdir(),'zpe-030-'));
  try{
    await writeBrowserOperationArtifact(p,{directory});
    await writeBrowserOperationArtifact(
      sample('stage003-psb32-with-cancelled-retry','PSB32','completed-with-cancelled-retry'),
      {directory},
    );
    assert.equal((await verifyBrowserOperationArtifacts(directory)).length,2);
    const location=path.join(directory,'stage003-psd16-with-cancelled-retry.json');
    const artifact=JSON.parse(await readFile(location,'utf8'));
    artifact.timeline.durationsMs.cancelledRetryObservation+=2;
    await writeFile(location,JSON.stringify(artifact),'utf8');
    await assert.rejects(verifyBrowserOperationArtifacts(directory),/inconsistent duration evidence/);
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});

test('031: unsupported Worker/PID/exit/peak claims are rejected on write and JSON read',async()=>{
  const first=sample('stage003-psd16-with-cancelled-retry','PSD16','completed-with-cancelled-retry');
  first.memory.workerTargets={
    workerPidMapping:'unknown',provenWorkerTerminationCount:null,
    uniqueWorkerTargetIds:1,
    targets:[{targetId:'worker-1',type:'worker',firstSeenPhase:'before-import',
      lastSeenPhase:'after-retry',samples:2,observedAtLastSnapshot:false}],
  };
  assert.equal(buildBrowserOperationArtifact(first).timeline.memory.workerTargets.targets.length,1);

  const mutations=[
    m=>{m.workerTargets.provenWorkerTerminationCount=1;},
    m=>{delete m.workerTargets.provenWorkerTerminationCount;},
    m=>{m.workerTargets.workerPidMapping='pid:42';},
    m=>{m.workerTargets.targets[0].pid=42;},
    m=>{m.workerTargets.targets[0].url='file:///private/document.psb';},
    m=>{m.workerTargets.uniqueWorkerTargetIds=2;},
    m=>{m.workerTargets.workerPeakRssBytes=9000;},
    m=>{m.processChurn.provenExitCount=1;},
    m=>{m.processChurn.workerPidMapping='known';},
    m=>{m.linuxProcessIdentity.provenExitCount=1;},
    m=>{m.operationPeakRssBytes=9000;},
    m=>{m.workerRssBytes=9000;},
  ];
  for (const mutate of mutations) {
    const forged=JSON.parse(JSON.stringify(first));
    mutate(forged.memory);
    assert.throws(()=>buildBrowserOperationArtifact(forged),
      /unsupported .*evidence/, 'tampered claims must fail at writer boundary');
  }

  const directory=await mkdtemp(path.join(os.tmpdir(),'zpe-031-'));
  try {
    await writeBrowserOperationArtifact(first,{directory});
    await writeBrowserOperationArtifact(
      sample('stage003-psb32-with-cancelled-retry','PSB32','completed-with-cancelled-retry'),
      {directory},
    );
    assert.equal((await verifyBrowserOperationArtifacts(directory)).length,2);
    const location=path.join(directory,'stage003-psd16-with-cancelled-retry.json');
    const artifact=JSON.parse(await readFile(location,'utf8'));
    // The top-level wrapper is untouched: previously, rebuilt wrapper equality
    // could not detect this nested fake proof.
    artifact.timeline.memory.workerTargets.provenWorkerTerminationCount=1;
    await writeFile(location,JSON.stringify(artifact),'utf8');
    await assert.rejects(verifyBrowserOperationArtifacts(directory),
      /unsupported Worker target evidence/);
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
});

test('033: corrupted synthetic native quality scores fail at JSON write and reread',async()=>{
  const first=sample('stage003-psd16-with-cancelled-retry','PSD16','completed-with-cancelled-retry');
  const mutations=[
    q=>{q.baseline.mae=0;},
    q=>{q.firstRedo.rmse=15;},
    q=>{q.cancelled.mae=0;},
    q=>{q.recoveredFill.mae=NaN;},
    q=>{q.recoveredUndo.mae=2;},
    q=>{q.recoveredRedo.rmse=8;},
    q=>{q.reference='Independent Photoshop reference';},
    q=>{delete q.firstFill;},
  ];
  for(const mutate of mutations){
    const forged=structuredClone(first);
    mutate(forged.quality);
    assert.throws(()=>buildBrowserOperationArtifact(forged),/Synthetic native quality evidence/);
  }
  const directory=await mkdtemp(path.join(os.tmpdir(),'zpe-033-'));
  try{
    await writeBrowserOperationArtifact(first,{directory});
    await writeBrowserOperationArtifact(
      sample('stage003-psb32-with-cancelled-retry','PSB32','completed-with-cancelled-retry'),
      {directory},
    );
    assert.equal((await verifyBrowserOperationArtifacts(directory)).length,2);
    const location=path.join(directory,'stage003-psd16-with-cancelled-retry.json');
    const artifact=JSON.parse(await readFile(location,'utf8'));
    artifact.timeline.quality.recoveredRedo.mae=999;
    await writeFile(location,JSON.stringify(artifact),'utf8');
    await assert.rejects(verifyBrowserOperationArtifacts(directory),
      /Synthetic native quality evidence/);
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});

test('003T: CI operation artifact rejects invented sampling coverage or peak claims',async()=>{
  const p=sample('stage003-psd16-with-cancelled-retry','PSD16','completed-with-cancelled-retry');
  const timing={
    method:'serialized-CDP-read-windows',
    snapshotCount:2,periodicSamples:0,pollsAttempted:1,pollsSkippedBusy:1,
    readWindowMs:120,maxReadDurationMs:60,maxBetweenReadWindowsMs:0,
    maxBetweenReadStartsMs:60,trueOperationPeakKnown:false,
    workerPidMapping:'unknown',
    limitations:'Serialized request, not when all processes were measured atomically.',
  };
  p.memory.samplingTiming=timing;
  assert.equal(buildBrowserOperationArtifact(p).timeline.memory.samplingTiming.trueOperationPeakKnown,false);
  assert.throws(()=>buildBrowserOperationArtifact({
    ...p,origin:'real Chromium file:// UI + native Worker',
    memory:{...p.memory,samplingTiming:null},
  }),/missing real sampling timing coverage/);
  for(const changed of [
    {trueOperationPeakKnown:true},{workerPidMapping:'pid:123'},
    {pollsSkippedBusy:2},{snapshotCount:3},{maxReadDurationMs:121},
  ]){
    assert.throws(()=>buildBrowserOperationArtifact({
      ...p,memory:{...p.memory,samplingTiming:{...timing,...changed}},
    }),/sampling timing/);
  }
  const dir=await mkdtemp(path.join(os.tmpdir(),'zpe-003t-'));
  try{
    await writeBrowserOperationArtifact(p,{directory:dir});
    await writeBrowserOperationArtifact(sample(
      'stage003-psb32-with-cancelled-retry','PSB32','completed-with-cancelled-retry'
    ),{directory:dir});
    assert.equal((await verifyBrowserOperationArtifacts(dir)).length,2);
    const filename=path.join(dir,'stage003-psd16-with-cancelled-retry.json');
    const forged=JSON.parse(await readFile(filename,'utf8'));
    forged.timeline.memory.samplingTiming.trueOperationPeakKnown=true;
    await writeFile(filename,JSON.stringify(forged),'utf8');
    await assert.rejects(verifyBrowserOperationArtifacts(dir),/sampling timing/);
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
});
