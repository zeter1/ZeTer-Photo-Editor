// 003T/2c: independent Linux OS-process lifetime evidence for a real
// Chromium file:// launch. The spawned process is NOT an identified Worker PID,
// and process-lifetime RSS/HWM never establishes an operation peak.
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {findChrome,devtoolsUrl} from './browser-worker-control-smoke.mjs';
import {sampleLinuxChromiumRss} from './browser-linux-process-rss.mjs';
import {validateChromiumRssSampleMembership} from './browser-rss-sample-identity.mjs';
import {parseLinuxProcStartTime} from './browser-linux-process-identity.mjs';

const assert=(v,message)=>{if(!v)throw new Error('003T OS PID control: '+message);};
const canonical=s=>typeof s==='string' && /^[1-9]\d*$/.test(s) && BigInt(s).toString()===s;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function validateChromiumOsPidControlEvidence(e){
  assert(e?.kind==='zpe-real-chromium-os-pid-lifetime-v1' && e.schemaVersion===1,
    'artifact schema');
  assert(Object.keys(e).sort().join(',')===[
    'kind','schemaVersion','origin','pid','before','afterGap','skippedGap',
    'injectedDeniedRead','exit','postExit','trueOperationPeakKnown',
    'workerPidMapping','limitations',
  ].sort().join(','),'unrecognized artifact field');
  assert(e.origin==='real Linux Chromium file:// launcher' &&
    e.trueOperationPeakKnown===false && e.workerPidMapping==='unknown' &&
    !Object.hasOwn(e,'workerRssBytes') && !Object.hasOwn(e,'operationPeakRssBytes') &&
    Number.isSafeInteger(e.pid) && e.pid>0,'unsupported operation/Worker PID claim');
  for(const phase of ['before','afterGap']){
    const p=e[phase];
    assert(p && Object.keys(p).sort().join(',')===
      ['pid','starttimeTicks','rssBytes','highWaterBytes'].sort().join(',') &&
      p.pid===e.pid && canonical(p.starttimeTicks) &&
      Number.isSafeInteger(p.rssBytes) && p.rssBytes>0 &&
      Number.isSafeInteger(p.highWaterBytes) && p.highWaterBytes>=p.rssBytes,
    'invalid sampled per-incarnation /proc RSS');
  }
  assert(e.before.starttimeTicks===e.afterGap.starttimeTicks,
    'reused PID or changed process incarnation across live snapshots');
  assert(e.skippedGap && Object.keys(e.skippedGap).sort().join(',')===
    ['availability','reason','observedReads'].sort().join(',') &&
    e.skippedGap.availability==='not-observed' &&
    e.skippedGap.reason==='deliberately-skipped-/proc-read' &&
    e.skippedGap.observedReads===0,'a skipped read is never a successful sample');
  assert(e.injectedDeniedRead &&
    Object.keys(e.injectedDeniedRead).sort().join(',')===
    ['availability','reason','rssBytes'].sort().join(',') &&
    e.injectedDeniedRead.availability==='unavailable' &&
    e.injectedDeniedRead.reason==='injected-EACCES' &&
    e.injectedDeniedRead.rssBytes===null,
    'denied read must not fabricate RSS');
  assert(e.exit &&
    Object.keys(e.exit).sort().join(',')===
    ['closeEventObserved','signalSent','signalObserved','exitCode'].sort().join(',') &&
    e.exit.closeEventObserved===true && e.exit.signalSent==='SIGTERM' &&
    ((e.exit.signalObserved==='SIGTERM' && e.exit.exitCode===null) ||
     (e.exit.signalObserved===null && e.exit.exitCode===0)),
    'spawned OS process exit requires an actual observed close event');
  const p=e.postExit;
  assert(p && Object.keys(p).sort().join(',')===
    ['availability','starttimeTicks'].sort().join(',') &&
    (p.availability==='missing' && p.starttimeTicks===null ||
     p.availability==='reused' && canonical(p.starttimeTicks) &&
       p.starttimeTicks!==e.before.starttimeTicks),
    'post-exit /proc must be missing or a different incarnation');
  assert(typeof e.limitations==='string' &&
    e.limitations.includes('not Worker') &&
    e.limitations.includes('not operation peak'),
    'missing identity/peak limitations');
  return true;
}

// A missing /proc entry is an observation, while denied/unreadable data is
// explicitly unavailable. An unreadable file must never be called an exited PID.
export async function probeLinuxPid(pid,{readStat=readFile}={}){
  assert(Number.isSafeInteger(pid)&&pid>0,'invalid PID');
  try{
    const stat=await readStat('/proc/'+pid+'/stat','utf8');
    return {availability:'sampled',starttimeTicks:parseLinuxProcStartTime(stat,pid)};
  }catch(error){
    if(error?.code==='ENOENT' || error?.code==='ESRCH')
      return {availability:'missing',starttimeTicks:null};
    return {availability:'unavailable',starttimeTicks:null};
  }
}

export async function readVerifiedLinuxPidRss(pid,{sample=sampleLinuxChromiumRss}={}){
  assert(Number.isSafeInteger(pid)&&pid>0,'invalid RSS PID');
  const list=[{id:pid,type:'browser'}];
  const r=await sample(list);
  assert(r?.supported===true,'Linux /proc RSS unavailable');
  validateChromiumRssSampleMembership(list,r);
  assert(r.processSamples.length===1,'non-atomic PID sample count');
  const p=r.processSamples[0];
  return {pid:p.pid,starttimeTicks:p.starttimeTicks,
    rssBytes:p.rssBytes,highWaterBytes:p.highWaterBytes};
}

async function runRealControl(){
  assert(process.platform==='linux','real /proc control requires Linux');
  const dir=await mkdtemp(path.join(tmpdir(),'zpe-003t-pid-'));
  const file=path.join(dir,'pid-control.html');
  let chrome=null;
  try{
    await writeFile(file,'<!doctype html><meta charset="utf-8"><title>PID control</title><body>Chromium process lifetime</body>');
    const href=pathToFileURL(file).href;
    chrome=spawn(findChrome(),[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--disable-background-networking','--no-first-run','--no-default-browser-check',
      '--no-extensions','--remote-debugging-port=0',
      '--user-data-dir='+path.join(dir,'profile'),href,
    ],{stdio:['ignore','ignore','pipe']});
    assert(Number.isSafeInteger(chrome.pid)&&chrome.pid>0,'Chrome did not spawn');
    const websocket=await devtoolsUrl(chrome);
    const url=new URL(websocket);
    let observedFilePage=false;
    for(let i=0;i<80 && !observedFilePage;i++){
      const response=await fetch('http://'+url.hostname+':'+url.port+'/json/list');
      const targets=await response.json();
      observedFilePage=Array.isArray(targets) && targets.some(t=>t.type==='page'&&t.url===href);
      if(!observedFilePage)await sleep(100);
    }
    assert(observedFilePage,'real Chromium file:// page not established');
    const before=await readVerifiedLinuxPidRss(chrome.pid);
    // The gap was deliberately not sampled; it says nothing about transient
    // child processes or changes while the browser was alive.
    const skippedGap={availability:'not-observed',
      reason:'deliberately-skipped-/proc-read',observedReads:0};
    const denied=await probeLinuxPid(chrome.pid,{readStat:async()=>{
      const error=new Error('injected denial');error.code='EACCES';throw error;
    }});
    assert(denied.availability==='unavailable','injected denied /proc read accepted');
    const injectedDeniedRead={availability:'unavailable',
      reason:'injected-EACCES',rssBytes:null};
    const afterGap=await readVerifiedLinuxPidRss(chrome.pid);
    assert(before.starttimeTicks===afterGap.starttimeTicks,
      'live PID incarnation changed across gap');
    const pid=chrome.pid;
    const closed=once(chrome,'close');
    assert(chrome.kill('SIGTERM')===true,'SIGTERM not delivered to Chromium launcher');
    let closeTimeout;
    let exitCode,signalObserved;
    try{
      [exitCode,signalObserved]=await Promise.race([
        closed,new Promise((_,reject)=>{closeTimeout=setTimeout(()=>reject(
          new Error('Chromium launcher did not exit after SIGTERM')),12000);}),
      ]);
    }finally{
      clearTimeout(closeTimeout);
    }
    assert((exitCode===null && signalObserved==='SIGTERM') ||
      (exitCode===0 && signalObserved===null),
      'unexpected Chromium termination: exitCode='+exitCode+', signal='+signalObserved);
    const probed=await probeLinuxPid(pid);
    assert(probed.availability!=='unavailable','post-close /proc unreadable');
    const postExit=probed.availability==='missing'?
      {availability:'missing',starttimeTicks:null}:
      {availability:'reused',starttimeTicks:probed.starttimeTicks};
    const result={
      kind:'zpe-real-chromium-os-pid-lifetime-v1',schemaVersion:1,
      origin:'real Linux Chromium file:// launcher',pid,before,afterGap,
      skippedGap,injectedDeniedRead,
      exit:{closeEventObserved:true,signalSent:'SIGTERM',
        signalObserved,exitCode},
      postExit,trueOperationPeakKnown:false,workerPidMapping:'unknown',
      limitations:'Observed spawned Chromium launcher process exit (not Worker or any child-process exit). Explicit missed /proc sample and injected EACCES are not real coverage. VmHWM is process-lifetime, not operation peak; no Worker→PID join.',
    };
    validateChromiumOsPidControlEvidence(result);
    return result;
  }finally{
    if(chrome && chrome.exitCode===null && chrome.signalCode===null)
      chrome.kill('SIGKILL');
    await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100});
  }
}

async function main(){
  if(process.argv[2]==='--verify'){
    assert(process.argv.length===4,'usage: --verify JSON');
    const e=JSON.parse(await readFile(process.argv[3],'utf8'));
    validateChromiumOsPidControlEvidence(e);
    console.log('003T Chromium Linux PID lifetime JSON PASS');
    return;
  }
  assert(process.argv.length===3,'usage: node tools/browser-chromium-pid-lifetime-control.mjs JSON');
  const report=await runRealControl();
  await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('003T real Chromium Linux process exit control PASS; Worker PID and operation peak unknown');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
