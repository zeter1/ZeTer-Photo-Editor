import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildBrowserOperationArtifact,writeBrowserOperationArtifact,verifyBrowserOperationArtifacts} from '../tools/browser-operation-artifact.mjs';

const sample=(operationId,format,outcome)=>({
  kind:'zpe-browser-high-depth-operation-timeline-v1',
  operationId,format,fixture:format==='PSD16'?'large.psd':'large.psb',outcome,
  observedWindowMs:123,
  milestones:[{phase:'cancel-kernel-write-observed',atMs:5,sincePreviousMs:5},
    {phase:'retry-redo-native-verified',atMs:6,sincePreviousMs:1}],
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
