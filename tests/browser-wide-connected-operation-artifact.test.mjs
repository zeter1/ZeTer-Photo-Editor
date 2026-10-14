import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createWideConnectedBrowserArtifact,validateWideConnectedBrowserArtifact,
  writeWideConnectedBrowserArtifact,verifyWideConnectedBrowserArtifacts,
} from '../tools/browser-wide-connected-operation-artifact.mjs';

const PHASES=['imported','selected','filled','previewed','undone','redone'];
function report(fixtureKey='rgb16wide') {
  const bits=fixtureKey==='rgb16wide'?16:32;
  return {
    fixtureKey,
    quality:{
      kind:'zpe-browser-wide-connected-native-evidence-v1',
      reference:'ZeTer-authored constant native clean background; not Photoshop',
      bitsPerChannel:bits,selectedPixels:8288,changedSelectedPixels:8288,
      changedTiles:2,scoredSamples:24864,
      baseline:{mae:32,rmse:45,maxAbsoluteError:64},
      repaired:{mae:0,rmse:0,maxAbsoluteError:0},
      outsideSelectionAndAlphaUnchanged:true,
      undoNativeBytesExact:true,redoNativeBytesExact:true,
    },
    stageSamples:PHASES.map((phase,i)=>({
      phase,milestoneMs:i*10+1,observedAtUnixMs:1800000000000+i*11,
      samplerElapsedMs:100+i*11.1,
      rendererHeapBytes:1000+i,
      cdpPrivateMemoryBytes:i===1||i===3?null:2000+i,
      linuxRssBytes:i===0||i===5?null:3000+i,
      pidMembershipObserved:i!==2,workerTargetsObserved:i!==3,
      linuxIdentityObserved:i===1||i===2,
    })),
  };
}
const clone=value=>structuredClone(value);

test('036C: stage-only Chromium observation artifact retains real gaps and no peak/PID/exit claims',()=>{
  const value=createWideConnectedBrowserArtifact(report());
  assert.equal(validateWideConnectedBrowserArtifact(value),true);
  assert.equal(value.kind,'zpe-wide-connected-browser-observations-v1');
  assert.equal(value.measurementClass,'explicit-stage-samples-only');
  assert.equal(value.workerPidMapping,'unknown');
  assert.equal(value.operationPeakRssBytes,null);
  assert.equal(value.provenProcessExitCount,null);
  assert.equal(value.coverage.renderer.coverage,'complete');
  assert.equal(value.coverage.cdpPrivateMemory.coverage,'partial');
  assert.equal(value.coverage.linux.coverage,'partial');
  assert.deepEqual(value.coverage.linux.missingPhases,['imported','redone']);
  assert.equal(value.coverage.workerTargets.observed,5);
  assert.equal(value.stageSamples[0].linuxRssBytes,null);
  assert.equal(value.milestonesMs.redone,51);
});

test('036C: forged timing, quality, bytes, PID, gaps and schemas fail at write boundary',()=>{
  const invalid=[
    a=>{a.stageSamples[3].phase='undone';},
    a=>{a.stageSamples.pop();},
    a=>{a.stageSamples[2].milestoneMs=0;},
    a=>{a.stageSamples[4].observedAtUnixMs=1;},
    a=>{a.stageSamples[4].samplerElapsedMs=0;},
    a=>{a.stageSamples[2].rendererHeapBytes=NaN;},
    a=>{a.stageSamples[2].linuxRssBytes=-1;},
    a=>{a.stageSamples[2].pidMembershipObserved='yes';},
    a=>{a.stageSamples[2].workerPid=4321;},
    a=>{a.milestonesMs.filled=999;},
    a=>{a.coverage.linux.observed=6;},
    a=>{a.coverage.cdpPrivateMemory.missingPhases=[];},
    a=>{a.operationPeakRssBytes=1;},
    a=>{a.workerPidMapping='pid:12';},
    a=>{a.provenProcessExitCount=1;},
    a=>{a.quality.repaired.mae=42;},
    a=>{a.quality.bitsPerChannel=8;},
    a=>{a.quality.changedSelectedPixels=1;},
    a=>{a.quality.redoNativeBytesExact=false;},
    a=>{a.sneakyExtra='unverified';},
  ];
  const original=createWideConnectedBrowserArtifact(report());
  for(const mutate of invalid){
    const forged=clone(original);mutate(forged);
    assert.throws(()=>validateWideConnectedBrowserArtifact(forged),
      /036C wide browser artifact|036 browser sampling/);
  }
});

test('036C: required versioned PSD16 and PSB32 browser JSON round-trip; tampered persisted file is rejected',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'zpe-wide-036c-'));
  try {
    assert.equal(await writeWideConnectedBrowserArtifact(report(),{directory:''}),null);
    const first=await writeWideConnectedBrowserArtifact(report(),{directory});
    assert.equal(first,path.join(directory,'wide-connected-psd16.json'));
    await assert.rejects(verifyWideConnectedBrowserArtifacts(directory),/ENOENT/);
    const second=await writeWideConnectedBrowserArtifact(report('rgb32psbwide'),{directory});
    assert.equal(second,path.join(directory,'wide-connected-psb32.json'));
    assert.deepEqual(await verifyWideConnectedBrowserArtifacts(directory),[
      'wide-connected-psd16.json','wide-connected-psb32.json',
    ]);
    const artifact=JSON.parse(await readFile(second,'utf8'));
    artifact.coverage.linux.missingPhases=['imported'];
    await writeFile(second,JSON.stringify(artifact),'utf8');
    await assert.rejects(verifyWideConnectedBrowserArtifacts(directory),
      /unreconciled timestamp or memory coverage summary/);
    await writeWideConnectedBrowserArtifact(report('rgb32psbwide'),{directory});
    const swapped=JSON.parse(await readFile(first,'utf8'));
    swapped.fixtureKey='rgb32psbwide';
    swapped.format='PSB32';swapped.quality.bitsPerChannel=32;
    await writeFile(first,JSON.stringify(swapped),'utf8');
    await assert.rejects(verifyWideConnectedBrowserArtifacts(directory),
      /wrong fixture/);
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});
