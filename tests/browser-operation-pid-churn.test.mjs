import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveOperationPidChurn,validateOperationPidChurn} from
  '../tools/browser-operation-pid-churn.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const phases=['before-first-fill','first-worker-in-flight','after-escape-cancel',
  'before-retry-fill','retry-worker-in-flight','after-retry-completed'];
const observed=(i,identities)=>({availability:'observed',reason:null,
  readStartedMs:i*40,readFinishedMs:i*40+5,
  incarnations:identities.map(([pid,starttimeTicks])=>({pid,starttimeTicks,
    userTicks:'10',systemTicks:'5'}))});
const unknown=i=>({availability:'unknown',reason:'proc-member-vanished',
  readStartedMs:i*40,readFinishedMs:i*40+5,incarnations:null});
function input(){
  const p1=[[41,'100'],[42,'200']];
  const p2=[[41,'100'],[42,'201'],[43,'300']];
  const p3=[[41,'100'],[43,'300']];
  const entries=[p1,p2,p3,p3,p3,p1];
  const cpu={format:'PSD16',protocol:'file:',nativeReceiptSha256:'a'.repeat(64),
    phases:phases.map((phase,i)=>({phase,census:i===3?unknown(i):observed(i,entries[i])}))};
  const coverage={format:'PSD16',protocol:'file:',nativeReceiptSha256:cpu.nativeReceiptSha256,
    cpuReportSha256:digest(cpu),
    stages:phases.map((phase,i)=>({phase,rss:{availability:i===4?'unknown':'observed'}})),
    comparisons:phases.map((_,i)=>({availability:i===3?'unknown':i===4?'unknown':
      'matching-sampled-membership-only'}))};
  return {cpu,coverage};
}

test('003T/3d: native milestone identity churn remains sampled only',()=>{
  for(const format of ['PSD16','PSB32']){
    const {cpu,coverage}=input();cpu.format=format;coverage.format=format;
    coverage.cpuReportSha256=digest(cpu);
    const r=deriveOperationPidChurn(cpu,coverage);
    assert.equal(validateOperationPidChurn(r,cpu,coverage),true);
    assert.equal(r.observedIntervals,2);
    assert.equal(r.unknownIntervals,3);
    assert.equal(r.intervalsWithObservedChurn,2);
    assert.deepEqual(r.intervals[0].retained,[{pid:41,starttimeTicks:'100'}]);
    assert.deepEqual(r.intervals[0].newlyObserved,
      [{pid:42,starttimeTicks:'201'},{pid:43,starttimeTicks:'300'}]);
    assert.deepEqual(r.intervals[0].noLongerObserved,[{pid:42,starttimeTicks:'200'}]);
    assert.deepEqual(r.intervals[0].reusedPidNumbers,[42]);
    assert.deepEqual(r.intervals[1].noLongerObserved,[{pid:42,starttimeTicks:'201'}]);
    assert.equal(r.intervals[2].reason,'cpu-boundary-unknown');
    assert.equal(r.intervals[3].reason,'cpu-boundary-unknown');
    assert.equal(r.intervals[4].reason,'rss-boundary-unknown');
    assert.equal(r.provenProcessExits,null);
    assert.equal(r.workerPidMapping,'unknown');
    assert.equal(r.trueOperationPeakKnown,false);
  }
});

test('003T/3d: rejects forged turnover, recovered gaps, pid claims and unrelated receipts',()=>{
  const {cpu,coverage}=input();const r=deriveOperationPidChurn(cpu,coverage);
  for(const mutate of [
    x=>{x.intervals[0].reusedPidNumbers=[];},
    x=>{x.intervals[1].noLongerObserved=[];},
    x=>{x.intervals[2].availability='sampled-two-boundaries-only';},
    x=>{x.intervals[4].reason=null;},
    x=>{x.observedIntervals++;},
    x=>{x.intervalsWithObservedChurn++;},
    x=>{x.provenProcessExits=1;},
    x=>{x.workerPidMapping='verified';},
    x=>{x.trueOperationPeakKnown=true;},
    x=>{x.operationCpuTotalKnown=true;},
    x=>{x.workerPid=41;},
    x=>{x.coverageSha256='0'.repeat(64);},
  ]){
    const forged=structuredClone(r);mutate(forged);
    assert.throws(()=>validateOperationPidChurn(forged,cpu,coverage),/003T\/3d/);
  }
  const bad=structuredClone(coverage);bad.cpuReportSha256='a'.repeat(64);
  assert.throws(()=>deriveOperationPidChurn(cpu,bad),/unbound/);
  const duplicate=structuredClone(cpu);
  duplicate.phases[0].census.incarnations.push({...duplicate.phases[0].census.incarnations[0]});
  const fixed=structuredClone(coverage);fixed.cpuReportSha256=digest(duplicate);
  assert.throws(()=>deriveOperationPidChurn(duplicate,fixed),/duplicate PID/);
});

test('003T/3d: missing CPU snapshot never invents empty membership or bridges gap',()=>{
  const {cpu,coverage}=input();
  cpu.phases[0].census=unknown(0);coverage.cpuReportSha256=digest(cpu);
  const r=deriveOperationPidChurn(cpu,coverage);
  assert.equal(r.intervals[0].availability,'unknown');
  assert.equal(r.intervals[0].retained,null);
  assert.equal(r.intervals[0].newlyObserved,null);
  assert.equal(r.intervals[0].noLongerObserved,null);
  assert.equal(r.observedIntervals,1);
  assert.equal(r.unknownIntervals,4);
});

test('003T/3d: RSS incarnation uncertainty prevents attributing a churn interval',()=>{
  const {cpu,coverage}=input();
  coverage.comparisons[1]={availability:'unknown',reason:'pid-incarnation-mismatch'};
  const r=deriveOperationPidChurn(cpu,coverage);
  assert.equal(r.intervals[0].reason,'cpu-rss-membership-unknown');
  assert.equal(r.intervals[1].reason,'cpu-rss-membership-unknown');
  assert.equal(r.intervals[0].newlyObserved,null);
  assert.equal(r.intervals[1].reusedPidNumbers,null);
  assert.equal(r.intervals[2].availability,'unknown');
});

test('003T/3d: written independent both-depth artifact readback and exclusive creation',async()=>{
  const {mkdtemp,mkdir,writeFile,readFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {writeVerifiedPidChurnReceipts}=await import('../tools/browser-operation-pid-churn.mjs');
  const root=await mkdtemp(join(tmpdir(),'zpe-churn-test-'));
  const cpuDir=join(root,'cpu'),rssDir=join(root,'rss');
  try{
    await Promise.all([mkdir(cpuDir),mkdir(rssDir)]);
    for(const format of ['PSD16','PSB32']){
      const {cpu,coverage}=input();
      cpu.format=format;coverage.format=format;
      coverage.cpuReportSha256=digest(cpu);
      const suffix=format.toLowerCase();
      await Promise.all([
        writeFile(join(cpuDir,'stage003-operation-cpu-'+suffix+'.json'),JSON.stringify(cpu)),
        writeFile(join(rssDir,'stage003-operation-cpu-rss-'+suffix+'.json'),JSON.stringify(coverage)),
      ]);
    }
    assert.equal(await writeVerifiedPidChurnReceipts(rssDir,cpuDir),true);
    for(const format of ['PSD16','PSB32']){
      const suffix=format.toLowerCase();
      const receipt=JSON.parse(await readFile(
        join(rssDir,'stage003-operation-pid-churn-'+suffix+'.json'),'utf8'));
      assert.equal(receipt.format,format);
      assert.equal(receipt.provenProcessExits,null);
      assert.equal(receipt.workerPidMapping,'unknown');
    }
    await assert.rejects(writeVerifiedPidChurnReceipts(rssDir,cpuDir),{code:'EEXIST'});
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
