// 003T/2b-2: independent real Chromium file:// Worker visibility control.
// Intentionally diagnostic: target IDs are not PIDs; samples are not a RAM peak.
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createBrowserRendererHeapSampler} from './browser-renderer-heap-sampler.mjs';
import {createBrowserWorkerTargetTracker} from './browser-worker-target-census.mjs';
import {validateBrowserSamplingTiming} from './browser-sampling-timing.mjs';

const workerTypes=new Set(['worker','shared_worker','service_worker']);
const assert=(condition,message)=>{if(!condition)throw new Error('003T Chromium control: '+message);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const workerCount=infos=>infos.filter(t=>workerTypes.has(t.type)).length;

export function validateIndependentWorkerControlEvidence(e){
  assert(e?.kind==='zpe-independent-chromium-worker-control-v1' && e.schemaVersion===1,
    'unknown artifact schema');
  assert(Object.keys(e).every(k=>[
    'kind','schemaVersion','origin','control','memory','injectedGap',
    'trueOperationPeakKnown','workerPidMapping','limitations',
  ].includes(k)),'unsupported artifact fields');
  assert(e.origin==='real Chromium file:// temporary page' &&
    e.trueOperationPeakKnown===false && e.workerPidMapping==='unknown' &&
    !Object.hasOwn(e,'operationPeakRssBytes') && !Object.hasOwn(e,'workerRssBytes'),
    'unsupported operation peak or Worker PID attribution');
  const c=e.control;
  assert(c && Object.keys(c).sort().join(',')===[
    'baselineWorkerTargetCount','controlledAbsentAfterTerminate','controlledLiveTargetObserved',
    'ephemeralMessageAcknowledged','gapMethod','periodicPollingDisabled',
    'workerReadyAcknowledged',
  ].sort().join(',') &&
    Number.isSafeInteger(c.baselineWorkerTargetCount) && c.baselineWorkerTargetCount>=0 &&
    c.ephemeralMessageAcknowledged===true && c.workerReadyAcknowledged===true &&
    c.controlledLiveTargetObserved===true &&
    c.controlledAbsentAfterTerminate===true &&
    c.periodicPollingDisabled===true &&
    c.gapMethod==='deliberately-skipped-cdp-target-snapshot',
    'missing independently acknowledged real Worker lifecycle or gap provenance');
  const r=e.memory;
  assert(r && r.sampleCount===5 && r.browserWorkerTargets?.availability==='sampled',
    'complete five-snapshot real Worker census required');
  validateBrowserSamplingTiming(r.samplingTiming,r.sampleCount);
  const w=r.browserWorkerTargets;
  const phases=['before-import','short-worker-missed','control-worker-live',
    'control-worker-gone','finished'];
  assert(w.sampleCount===5 && w.snapshotCoverage?.observedAtStart===true &&
    w.snapshotCoverage?.observedAtFinish===true &&
    w.snapshotCoverage?.missingSamples===0 &&
    Array.isArray(w.milestones) && w.milestones.length===5 &&
    w.milestones.every((m,i)=>m.phase===phases[i]) &&
    w.milestones[0].workerTargetCount===c.baselineWorkerTargetCount &&
    w.milestones[1].workerTargetCount===c.baselineWorkerTargetCount &&
    w.milestones[2].workerTargetCount>c.baselineWorkerTargetCount &&
    w.milestones[3].workerTargetCount===c.baselineWorkerTargetCount &&
    w.milestones[4].workerTargetCount===c.baselineWorkerTargetCount &&
    w.newTargetObservations>=1 && w.missingTargetObservations>=1 &&
    w.uniqueWorkerTargetIds>c.baselineWorkerTargetCount && w.provenWorkerTerminationCount===null &&
    w.workerPidMapping==='unknown',
    'real Worker samples do not establish live/absent transitions');
  assert(Array.isArray(w.targets) &&
    w.targets.length===w.uniqueWorkerTargetIds &&
    w.targets.every(t=>workerTypes.has(t.type) &&
      Object.keys(t).every(k=>['targetId','type','firstSeenPhase','lastSeenPhase',
        'samples','observedAtLastSnapshot'].includes(k))),
    'target IDs invalid or leaked target URLs');
  const p=r.chromiumProcessLifecycle, l=r.linuxProcessIdentity;
  assert(p?.workerPidMapping==='unknown' &&
    p.availability==='sampled' && p.sampleCount===5 &&
    l?.workerPidMapping==='unknown' && l.provenExitCount===null &&
    ['sampled','unavailable'].includes(l.availability) &&
    l.snapshotCoverage?.observedAtStart!==undefined &&
    r.linuxProcessRss && ['sampled','unavailable'].includes(r.linuxProcessRss.availability),
    'real sampled OS PID/incarnation availability or uncertainty missing');
  const g=e.injectedGap;
  assert(g?.workerPidMapping==='unknown' && g.provenWorkerTerminationCount===null &&
    g.sampleCount===2 && g.snapshotCoverage?.observedSamples===2 &&
    g.snapshotCoverage?.missingSamples===1 &&
    g.snapshotCoverage?.unknownAdjacentTransitions===2 &&
    g.snapshotCoverage?.observedAdjacentTransitions===0 &&
    g.newTargetObservations===0 &&
    g.milestones?.length===3 &&
    g.milestones[0].phase==='gap-before' &&
    g.milestones[0].workerTargetCount===c.baselineWorkerTargetCount &&
    g.milestones[1].phase==='gap-injected' &&
    g.milestones[1].workerTargetCount===null &&
    g.milestones[2].phase==='gap-after' &&
    g.milestones[2].workerTargetCount>c.baselineWorkerTargetCount &&
    g.milestones[2].newlyObservedWorkerTargets===null,
    'CDP read gap must not claim observed Worker arrivals');
  const json=JSON.stringify(e);
  assert(!json.includes('file:///') && !json.includes('blob:') &&
    !json.includes('PRIVATE'), 'private browser URL/title leaked');
  return true;
}

export function findChrome(){
  for(const bin of [process.env.CHROME_BIN,'/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser',
    'google-chrome','chromium','chromium-browser'].filter(Boolean)){
    if(path.isAbsolute(bin) && !existsSync(bin))continue;
    const check=spawnSync(bin,['--version'],{encoding:'utf8',timeout:4000});
    if(!check.error && check.status===0)return bin;
  }
  throw new Error('003T Chromium control: Chrome not found');
}

async function until(label,fn,ms=12000){
  const end=Date.now()+ms;
  let last;
  while(Date.now()<end){
    try{const result=await fn();if(result)return result;}catch(e){last=e;}
    await sleep(50);
  }
  throw new Error('003T Chromium control: timeout '+label+(last?': '+last.message:''));
}
export function devtoolsUrl(browser){
  return new Promise((resolve,reject)=>{
    let stderr='';
    const timer=setTimeout(()=>{cleanup();reject(new Error('DevTools startup timeout: '+stderr.slice(-800)));},20000);
    function onData(bytes){
      stderr+=bytes.toString();
      const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if(match){cleanup();resolve(match[1]);}
    }
    function onExit(code){cleanup();reject(new Error('Chrome exited before DevTools: '+code+' '+stderr.slice(-800)));}
    function cleanup(){clearTimeout(timer);browser.stderr.off('data',onData);browser.off('exit',onExit);}
    browser.stderr.on('data',onData);
    browser.once('exit',onExit);
  });
}
class CDP{
  constructor(ws){
    this.ws=ws;this.next=1;this.pending=new Map();
    ws.addEventListener('message',event=>{
      const msg=JSON.parse(String(event.data)),item=this.pending.get(msg.id);
      if(!item)return;
      this.pending.delete(msg.id);clearTimeout(item.timer);
      if(msg.error)item.reject(new Error(msg.error.message));
      else item.resolve(msg.result);
    });
    ws.addEventListener('close',()=>{
      for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('CDP disconnected'));}
      this.pending.clear();
    });
  }
  static async connect(url){
    const ws=new WebSocket(url);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('CDP connect timeout')),8000);
      ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connect failed'));},{once:true});
    });
    return new CDP(ws);
  }
  send(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=this.next++;
      const timer=setTimeout(()=>{
        this.pending.delete(id);reject(new Error('CDP timeout: '+method));
      },10000);
      this.pending.set(id,{resolve,reject,timer});
      this.ws.send(JSON.stringify({id,method,params}));
    });
  }
  close(){this.ws.close();}
}
async function evalPage(page,expression){
  const data=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(data.exceptionDetails)throw new Error('Runtime.evaluate: '+(data.exceptionDetails.text||'exception'));
  return data.result?.value;
}
async function getTargets(browser){
  const response=await browser.send('Target.getTargets');
  assert(Array.isArray(response?.targetInfos),'missing Target.getTargets results');
  return response.targetInfos;
}
async function runControl(){
  const dir=await mkdtemp(path.join(tmpdir(),'zpe-003t-control-'));
  const html=path.join(dir,'control.html');
  let browser=null,root=null,page=null;
  try{
    await writeFile(html,'<!doctype html><html><meta charset="utf-8"><title>003T control</title><body>Worker visibility control</body></html>');
    const chrome=findChrome();
    browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu',
      '--disable-dev-shm-usage','--disable-background-networking','--no-first-run',
      '--no-default-browser-check','--no-extensions','--remote-debugging-port=0',
      '--user-data-dir='+path.join(dir,'profile'),pathToFileURL(html).href],
    {stdio:['ignore','ignore','pipe']});
    const ws=await devtoolsUrl(browser);
    root=await CDP.connect(ws);
    const base=new URL(ws),origin='http://'+base.hostname+':'+base.port;
    const target=await until('file page target',async()=>{
      const res=await fetch(origin+'/json/list');
      const list=await res.json();
      return list.find(t=>t.type==='page' && t.url?.startsWith('file:') && t.webSocketDebuggerUrl);
    });
    page=await CDP.connect(target.webSocketDebuggerUrl);
    await page.send('Runtime.enable');
    await until('file:// page ready',async()=>evalPage(page,'document.readyState === "complete"'));
    const sampler=createBrowserRendererHeapSampler(page,{
      processClient:root,schedule:()=>0,unschedule:()=>{},intervalMs:50,
    });
    await sampler.start();
    const baselineIds=new Set((await getTargets(root)).filter(t=>workerTypes.has(t.type)).map(t=>t.targetId));
    const baselineCount=baselineIds.size;
    async function atBaseline(){
      const ids=(await getTargets(root)).filter(t=>workerTypes.has(t.type)).map(t=>t.targetId);
      return ids.length===baselineCount && ids.every(id=>baselineIds.has(id));
    }
    // A real, acknowledged transient Worker can fall entirely between the two
    // explicit observations. Never infer zero Worker creations from zero IDs.
    await evalPage(page,'(() => { window.__zpeControl={shortDone:false,longReady:false}; const s="self.postMessage(1);self.close()"; const u=URL.createObjectURL(new Blob([s],{type:"text/javascript"})); const w=new Worker(u); w.onmessage=()=>{window.__zpeControl.shortDone=true;w.terminate();URL.revokeObjectURL(u)}; return true; })()');
    await until('short Worker acknowledgement',()=>evalPage(page,'window.__zpeControl?.shortDone===true'));
    await until('short Worker removed from CDP',atBaseline);
    await sampler.snapshot('short-worker-missed');
    const gap=createBrowserWorkerTargetTracker();
    gap.observe(await getTargets(root),'gap-before');
    // Deliberately skip exactly one read: negative *injected* coverage control.
    gap.noteMissingSnapshot('gap-injected');
    await evalPage(page,'(() => {const s="self.payload=new Uint8Array(8*1024*1024);for(let i=0;i<self.payload.length;i+=4096)self.payload[i]=1;self.postMessage(1);setInterval(()=>{},1000)";const u=URL.createObjectURL(new Blob([s],{type:"text/javascript"}));const w=new Worker(u);window.__zpeControl.longWorker=w;window.__zpeControl.longUrl=u;w.onmessage=()=>{window.__zpeControl.longReady=true};return true})()');
    await until('live Worker acknowledgement',()=>evalPage(page,'window.__zpeControl?.longReady===true'));
    await until('live real CDP Worker target',async()=>
      (await getTargets(root)).some(t=>workerTypes.has(t.type) && !baselineIds.has(t.targetId)));
    gap.observe(await getTargets(root),'gap-after');
    await sampler.snapshot('control-worker-live');
    await evalPage(page,'(() => {window.__zpeControl.longWorker.terminate();URL.revokeObjectURL(window.__zpeControl.longUrl);return true})()');
    await until('terminated target absent from CDP',atBaseline);
    await sampler.snapshot('control-worker-gone');
    const full=await sampler.stop();
    const memory={
      sampleCount:full.sampleCount,samplingTiming:full.samplingTiming,
      browserWorkerTargets:full.browserWorkerTargets,
      chromiumProcessLifecycle:full.chromiumProcessLifecycle,
      linuxProcessIdentity:full.linuxProcessIdentity,
      linuxProcessRss:full.linuxProcessRss,
    };
    const result={
      kind:'zpe-independent-chromium-worker-control-v1',
      schemaVersion:1,origin:'real Chromium file:// temporary page',
      control:{baselineWorkerTargetCount:baselineCount,
        ephemeralMessageAcknowledged:true,workerReadyAcknowledged:true,
        controlledLiveTargetObserved:true,controlledAbsentAfterTerminate:true,
        periodicPollingDisabled:true,gapMethod:'deliberately-skipped-cdp-target-snapshot'},
      memory,injectedGap:gap.report(),trueOperationPeakKnown:false,
      workerPidMapping:'unknown',
      limitations:'Real target visibility and intentional read gap control. The short-lived Worker acknowledged execution but appeared in neither boundary snapshot. Target IDs do not map to Linux PIDs. /proc RSS is sequential, PID reuse and lifetime HWM are not operation peak proof.',
    };
    validateIndependentWorkerControlEvidence(result);
    return result;
  }finally{
    page?.close();root?.close();
    if(browser && browser.exitCode===null)browser.kill('SIGTERM');
    await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100});
  }
}

async function main(){
  if(process.argv[2]==='--verify'){
    assert(process.argv.length===4,'expected --verify FILE');
    const evidence=JSON.parse(await readFile(process.argv[3],'utf8'));
    validateIndependentWorkerControlEvidence(evidence);
    console.log('003T independent Worker control artifact PASS');
    return;
  }
  assert(process.argv.length===3,'usage: node tools/browser-worker-control-smoke.mjs ARTIFACT.json');
  const result=await runControl();
  await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log('003T real Chromium file:// Worker control PASS; operation peak and Worker PID unknown');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
