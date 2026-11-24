import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateAcceptancePlan,validateAcceptanceSummary,requiredAcceptanceSuites,
  verifyRealPhotoAcceptanceFiles} from '../tools/verify-browser-real-photo-acceptance.mjs';

const fromFixture=name=>JSON.parse(readFileSync(new URL('./fixtures/real-photo/'+name,import.meta.url)));
const pinned=fromFixture('reviewed-native-artifacts.json');
const photo=fromFixture('reviewed-manifest.json');
const plan=fromFixture('acceptance-plan.json');

test('037C-3c: frozen provenance and every required acceptance suite are explicitly pinned',()=>{
  assert.equal(validateAcceptancePlan(plan,pinned,photo),true);
  assert.equal(requiredAcceptanceSuites.length,14);
  assert.deepEqual(plan.requiredSuites,requiredAcceptanceSuites);
});
test('037C-3c: missing, duplicate, reordered or substituted suites cannot certify acceptance',()=>{
  for(const replace of [
    p=>p.requiredSuites.pop(),
    p=>p.requiredSuites.push('fake-suite'),
    p=>p.requiredSuites[1]=p.requiredSuites[0],
    p=>p.requiredSuites.reverse(),
    p=>p.sourceSha256='0'.repeat(64),
    p=>p.documents.psd16='0'.repeat(64),
    p=>p.documents.psb32='0'.repeat(64),
    p=>p.documents.fake='0'.repeat(64),
    p=>p.memoryPeakVerified=true,
    p=>p.photoshopCompatibilityVerified=true,
  ]){
    const modified=structuredClone(plan);
    replace(modified);
    assert.throws(()=>validateAcceptancePlan(modified,pinned,photo),/037C-3c acceptance/);
  }
});
test('037C-3c: cross-validated saved summaries reject wrong kind, count and tampering',()=>{
  const spec={id:'worker',kind:'worker-evidence',perFormat:3};
  const result={kind:'worker-evidence',runs:6,workerVerified:true};
  assert.equal(validateAcceptanceSummary(spec,result,structuredClone(result)),true);
  for(const changed of [
    {kind:'different',runs:6,workerVerified:true},
    {kind:'worker-evidence',runs:5,workerVerified:true},
    {kind:'worker-evidence',runs:6,workerVerified:false},
  ])assert.throws(()=>validateAcceptanceSummary(spec,result,changed));
  assert.throws(()=>validateAcceptanceSummary(spec,{...result,runs:5},result),/037C-3c acceptance/);
});
test('037C-3c: absent browser evidence fails closed; no plan-only completion',async()=>{
  const tmp=mkdtempSync(path.join(os.tmpdir(),'zpe-037c3c-'));
  try{
    mkdirSync(path.join(tmp,'browser-baselines'));
    await assert.rejects(verifyRealPhotoAcceptanceFiles(tmp),/missing|unexpected|receipt/);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
