// 003T/3d-2: independently controlled file:// Worker target vs Linux PID evidence.
// CDP Worker target identity is NOT an OS PID. All process joins remain scoped
// to the independently spawned Chromium launcher.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {findChrome,devtoolsUrl} from './browser-worker-control-smoke.mjs';
import {connectCdp,evaluate,until} from './browser-chromium-cgroup-control.mjs';
import {probeLinuxPid} from './browser-chromium-pid-lifetime-control.mjs';
import {collectLinuxCpuCensus,unknownLinuxCpuCensus,validateLinuxCpuCensus,
  compareLinuxCpuCensuses} from './browser-linux-cpu-observation.mjs';
import {probeCgroupDelegation,validateCgroupDelegationEvidence}
  from './browser-cgroup-delegation-probe.mjs';

const fail=m=>new Error('003T/3d-2 controlled Worker: '+m);
const check=(v,m)=>{if(!v)throw fail(m);};
const exact=(o,keys)=>o && typeof o==='object' && !Array.isArray(o) &&
  Object.keys(o).sort().join(',')===keys.slice().sort().join(',');
const LIMITS='Worker CDP targets are not OS PIDs. /proc and CDP censuses have blind windows, not process-lifetime proof or operation CPU. Verified launcher PID is not Worker PID. Disposable child cgroup delegation cannot establish exclusive Chromium descendants or true operation peak.';
const targetId=s=>typeof s==='string' && /^[A-Za-z0-9-]{1,128}$/.test(s);
const sortedIds=a=>Array.isArray(a) && a.every(targetId) &&
  a.every((id,i)=>i===0 || a[i-1]<id);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const tick=s=>typeof s==='string' && /^[1-9]\d*$/.test(s) &&
  BigInt(s).toString()===s;

function launcherJoin(stage,pid){
  if(stage.launcher.availability!=='sampled' ||
      stage.cpuCensus.availability!=='observed')return 'unknown';
  const found=stage.cpuCensus.incarnations.find(p=>p.pid===pid);
  if(!found)return 'unknown';
  check(found.starttimeTicks===stage.launcher.starttimeTicks,
    'CDP launcher PID /proc incarnation mismatch');
  return 'verified-launcher-only';
}
export function validateControlledWorkerPidEvidence(e){
  check(exact(e,['kind','schemaVersion','origin','launcherPid','pageTargetId',
    'worker','stages','cpuWindows','launcherCdpJoins','cgroup',
    'workerPidMapping','operationCpuTotalKnown','trueOperationPeakKnown',
    'provenWorkerProcessExitCount','limitations']) &&
    e.kind==='zpe-controlled-worker-pid-isolation-v1' && e.schemaVersion===1 &&
    e.origin==='real Linux Chromium file:// temporary controlled Worker' &&
    Number.isSafeInteger(e.launcherPid) && e.launcherPid>0 &&
    targetId(e.pageTargetId) && e.workerPidMapping==='unknown' &&
    e.operationCpuTotalKnown===false && e.trueOperationPeakKnown===false &&
    e.provenWorkerProcessExitCount===null && e.limitations===LIMITS,
    'schema or unsupported process/peak claim');
  const w=e.worker;
  check(exact(w,['before','held','after','controlledTargetId','readyAcknowledged',
    'terminateInvoked']) && sortedIds(w.before) && sortedIds(w.held) &&
    sortedIds(w.after) && targetId(w.controlledTargetId) &&
    w.readyAcknowledged===true && w.terminateInvoked===true &&
    !w.before.includes(w.controlledTargetId) && same(w.after,w.before) &&
    same(w.held,[...w.before,w.controlledTargetId].sort()),
    'Worker must be observed new, live, then absent');
  const phases=['before','held','after'];
  check(exact(e.stages,phases) && exact(e.launcherCdpJoins,phases),
    'missing or additional phase');
  for(const phase of phases){
    const s=e.stages[phase];
    check(exact(s,['pageTargetObserved','launcher','cpuCensus']) &&
      s.pageTargetObserved===true &&
      exact(s.launcher,['availability','starttimeTicks']) &&
      (s.launcher.availability==='sampled' && tick(s.launcher.starttimeTicks) ||
       ['missing','unavailable'].includes(s.launcher.availability) &&
         s.launcher.starttimeTicks===null),
      'invalid launcher identity or page');
    validateLinuxCpuCensus(s.cpuCensus);
    check(e.launcherCdpJoins[phase]===launcherJoin(s,e.launcherPid),
      'forged CDP /proc launcher join');
  }
  const seen=phases.map(phase=>e.stages[phase].launcher)
    .filter(p=>p.availability==='sampled').map(p=>p.starttimeTicks);
  check(seen.every(v=>v===seen[0]),'reused launcher PID');
  const beforeHeld=compareLinuxCpuCensuses(e.stages.before.cpuCensus,
    e.stages.held.cpuCensus);
  const heldAfter=compareLinuxCpuCensuses(e.stages.held.cpuCensus,
    e.stages.after.cpuCensus);
  check(exact(e.cpuWindows,['beforeHeld','heldAfter']) &&
    same(e.cpuWindows.beforeHeld,beforeHeld) &&
    same(e.cpuWindows.heldAfter,heldAfter),
    'forged CPU sampled overlap or missing-read coverage');
  validateCgroupDelegationEvidence(e.cgroup);
  check(!/file:\/\/\/|blob:|\/proc\/\d+|\/sys\/fs\/cgroup\/|\/home\//.test(
    JSON.stringify(e)),'private paths must not leak');
  return true;
}
export function buildControlledWorkerPidEvidence({launcherPid,pageTargetId,
  worker,stages,cgroup}){
  const e={kind:'zpe-controlled-worker-pid-isolation-v1',schemaVersion:1,
    origin:'real Linux Chromium file:// temporary controlled Worker',
    launcherPid,pageTargetId,worker,stages,
    cpuWindows:{
      beforeHeld:compareLinuxCpuCensuses(stages.before.cpuCensus,
        stages.held.cpuCensus),
      heldAfter:compareLinuxCpuCensuses(stages.held.cpuCensus,
        stages.after.cpuCensus),
    },
    launcherCdpJoins:Object.fromEntries(['before','held','after'].map(phase=>
      [phase,launcherJoin(stages[phase],launcherPid)])),
    cgroup,workerPidMapping:'unknown',operationCpuTotalKnown:false,
    trueOperationPeakKnown:false,provenWorkerProcessExitCount:null,
    limitations:LIMITS};
  validateControlledWorkerPidEvidence(e);
  return e;
}
export async function captureControlledWorkerStage(cdp,pid,pageTargetId,{
  targets=()=>cdp.send('Target.getTargets'),
  processes=()=>cdp.send('SystemInfo.getProcessInfo'),
  probe=probeLinuxPid,collect=collectLinuxCpuCensus,
}={}){
  const infos=(await targets())?.targetInfos;
  check(Array.isArray(infos) && infos.some(t=>t.type==='page' &&
    t.targetId===pageTargetId),'missing controller page CDP target');
  const workerIds=infos.filter(t=>t.type==='worker').map(t=>t.targetId).sort();
  check(sortedIds(workerIds),'invalid CDP Worker targets');
  const launcher=await probe(pid);
  let cpuCensus;
  try{
    cpuCensus=await collect((await processes())?.processInfo);
  }catch{
    cpuCensus=unknownLinuxCpuCensus('cdp-unavailable');
  }
  validateLinuxCpuCensus(cpuCensus);
  return {workerIds,stage:{pageTargetObserved:true,launcher,cpuCensus}};
}
export async function runControlledWorkerPidControl(){
  check(process.platform==='linux','real /proc required');
  const dir=await mkdtemp(path.join(tmpdir(),'zpe-003t3d2-'));
  let browser=null,root=null,page=null;
  try{
    const file=path.join(dir,'worker.html');
    await writeFile(file,'<!doctype html><title>Controlled worker</title>');
    const href=pathToFileURL(file).href;
    browser=spawn(findChrome(),[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--disable-background-networking','--no-first-run','--no-default-browser-check',
      '--no-extensions','--remote-debugging-port=0',
      '--user-data-dir='+path.join(dir,'profile'),href,
    ],{stdio:['ignore','ignore','pipe']});
    check(Number.isSafeInteger(browser.pid) && browser.pid>0,'no Chromium PID');
    const ws=await devtoolsUrl(browser);
    root=await connectCdp(ws);
    const url=new URL(ws),origin='http://'+url.hostname+':'+url.port;
    let controller;
    await until('file page',async()=>{
      const response=await fetch(origin+'/json/list');
      const list=await response.json();
      controller=list.find(t=>t.type==='page' && t.url===href &&
        t.webSocketDebuggerUrl && targetId(t.id));
      return Boolean(controller);
    });
    page=await connectCdp(controller.webSocketDebuggerUrl);
    await page.send('Runtime.enable');
    await until('page load',()=>evaluate(page,'document.readyState==="complete"'));
    const take=()=>captureControlledWorkerStage(root,browser.pid,controller.id);
    const before=await take();
    const script='(() => {'+
      'window.__zpeControlled={ready:false};'+
      'const code="self.postMessage(\u0027ready\u0027);self.onmessage=()=>{};";'+
      'const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));'+
      'const worker=new Worker(url);window.__zpeControlled.worker=worker;'+
      'window.__zpeControlled.url=url;'+
      'worker.onmessage=e=>{if(e.data==="ready")window.__zpeControlled.ready=true};'+
      'return true;})()';
    check(await evaluate(page,script)===true,'Worker dispatch failed');
    await until('Worker ready',()=>evaluate(page,
      'window.__zpeControlled?.ready===true'));
    let held;
    await until('Worker CDP target visible',async()=>{
      const s=await take();
      if(s.workerIds.length===before.workerIds.length+1 &&
         s.workerIds.filter(id=>!before.workerIds.includes(id)).length===1)held=s;
      return Boolean(held);
    });
    const controlledTargetId=held.workerIds.find(id=>!before.workerIds.includes(id));
    check(await evaluate(page,
      '(()=>{window.__zpeControlled.worker.terminate();'+
      'URL.revokeObjectURL(window.__zpeControlled.url);return true})()')===true,
      'termination invocation failed');
    let after;
    await until('Worker CDP target absent',async()=>{
      const s=await take();
      if(same(s.workerIds,before.workerIds))after=s;
      return Boolean(after);
    });
    const cgroup=await probeCgroupDelegation();
    return buildControlledWorkerPidEvidence({
      launcherPid:browser.pid,pageTargetId:controller.id,
      worker:{before:before.workerIds,held:held.workerIds,after:after.workerIds,
        controlledTargetId,readyAcknowledged:true,terminateInvoked:true},
      stages:{before:before.stage,held:held.stage,after:after.stage},cgroup});
  }finally{
    page?.close();root?.close();
    if(browser && browser.exitCode===null && browser.signalCode===null)
      browser.kill('SIGTERM');
    await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100});
  }
}
async function main(){
  if(process.argv[2]==='--verify'){
    check(process.argv.length===4,'usage: --verify JSON');
    validateControlledWorkerPidEvidence(JSON.parse(await readFile(process.argv[3],'utf8')));
    console.log('003T/3d-2 controlled Worker/PID verifier PASS');
    return;
  }
  check(process.argv.length===3,'usage: script JSON');
  const e=await runControlledWorkerPidControl();
  await writeFile(process.argv[2],JSON.stringify(e,null,2)+'\n',{flag:'wx'});
  console.log('003T/3d-2 Worker target observed/gone, cgroup '+e.cgroup.status+
    '/'+e.cgroup.reason+'; Worker PID and operation peak unknown');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
