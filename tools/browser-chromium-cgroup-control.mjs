// 003T/2d-2: real Chromium cgroup v2 memory scope feasibility.
// memory.current is a sampled cgroup-wide counter, NEVER an operation peak.
// Even a separate cgroup does not prove complete descendants or exclusive use.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {findChrome,devtoolsUrl} from './browser-worker-control-smoke.mjs';
import {parseLinuxProcStartTime} from './browser-linux-process-identity.mjs';

const MIB=1024*1024;
const fail=message=>new Error('003T Chromium cgroup scope: '+message);
const check=(condition,message)=>{if(!condition)throw fail(message);};
const exact=(value,keys)=>value && !Array.isArray(value) &&
  Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const canonical=s=>typeof s==='string' && /^[1-9]\d*$/.test(s) &&
  BigInt(s).toString()===s;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function parseCgroupV2(text){
  if(typeof text!=='string')return null;
  const found=text.trim().split('\n').filter(line=>line.startsWith('0::'));
  if(found.length!==1)return null;
  const location=found[0].slice(3);
  if(!location.startsWith('/') || location.includes('\\') ||
      location.split('/').some(part=>part==='.' || part==='..') ||
      /[\r\n\0]/.test(location))return null;
  return location;
}

export async function probeChromiumCgroup(pid,{
  platform=process.platform,readText=readFile,
}={}){
  check(Number.isSafeInteger(pid) && pid>0,'invalid Chromium launcher PID');
  const unavailable=reason=>({availability:'unavailable',scope:'unknown',
    memoryCurrentBytes:null,starttimeTicks:null,reason});
  if(platform!=='linux')return unavailable('not-linux');
  try{
    const statBefore=parseLinuxProcStartTime(await readText('/proc/'+pid+'/stat','utf8'),pid);
    const runner=parseCgroupV2(await readText('/proc/self/cgroup','utf8'));
    const browser=parseCgroupV2(await readText('/proc/'+pid+'/cgroup','utf8'));
    if(runner===null || browser===null)return unavailable('no-readable-cgroup-v2');
    // Never leak host cgroup names or treat a cgroup as a Worker PID join.
    const counter=path.join('/sys/fs/cgroup',browser.slice(1),'memory.current');
    const raw=(await readText(counter,'utf8')).trim();
    if(!/^[0-9]+$/.test(raw))return unavailable('invalid-memory-current');
    const memoryCurrentBytes=Number(raw);
    if(!Number.isSafeInteger(memoryCurrentBytes) || memoryCurrentBytes<=0)
      return unavailable('invalid-memory-current');
    const statAfter=parseLinuxProcStartTime(await readText('/proc/'+pid+'/stat','utf8'),pid);
    if(statBefore!==statAfter)return unavailable('pid-incarnation-changed');
    const shared=runner===browser;
    return {availability:'sampled',scope:shared?'shared-with-runner':'separate-unverified',
      memoryCurrentBytes,starttimeTicks:statBefore,
      reason:shared?'runner-and-chromium-share-cgroup':'exclusive-membership-unverified'};
  }catch{
    return unavailable('missing-or-inaccessible-proc-or-cgroup');
  }
}

export function validateChromiumCgroupScopeEvidence(e){
  check(exact(e,['kind','schemaVersion','origin','launcherPid','controlBytes',
    'workerAcknowledged','before','held','trueOperationPeakKnown',
    'workerPidMapping','limitations']), 'unexpected artifact fields');
  check(e.kind==='zpe-real-chromium-cgroup-scope-v1' && e.schemaVersion===1 &&
    e.origin==='real Chromium file:// temporary Worker allocation' &&
    Number.isSafeInteger(e.launcherPid) && e.launcherPid>0 &&
    e.controlBytes===64*MIB && e.workerAcknowledged===true &&
    e.trueOperationPeakKnown===false && e.workerPidMapping==='unknown',
    'false control or peak/Worker PID attribution');
  const reasons=new Set(['not-linux','no-readable-cgroup-v2',
    'invalid-memory-current','pid-incarnation-changed',
    'missing-or-inaccessible-proc-or-cgroup']);
  for(const phase of ['before','held']){
    const s=e[phase];
    check(exact(s,['availability','scope','memoryCurrentBytes',
      'starttimeTicks','reason']),'invalid '+phase+' observation fields');
    if(s.availability==='sampled'){
      check(['shared-with-runner','separate-unverified'].includes(s.scope) &&
        Number.isSafeInteger(s.memoryCurrentBytes) && s.memoryCurrentBytes>0 &&
        canonical(s.starttimeTicks) &&
        s.reason===(s.scope==='shared-with-runner'?
          'runner-and-chromium-share-cgroup':'exclusive-membership-unverified'),
        'invalid sampled cgroup observation');
    }else{
      check(s.availability==='unavailable' && s.scope==='unknown' &&
        s.memoryCurrentBytes===null && s.starttimeTicks===null &&
        reasons.has(s.reason),'unavailable cgroup cannot have memory data');
    }
  }
  if(e.before.availability==='sampled' && e.held.availability==='sampled')
    check(e.before.starttimeTicks===e.held.starttimeTicks &&
      e.before.scope===e.held.scope,
    'PID reuse or cgroup membership changed across operation');
  check(!JSON.stringify(e).includes('file:///') &&
    !JSON.stringify(e).includes('blob:') &&
    !JSON.stringify(e).includes('/sys/fs/cgroup/'),
    'private page or cgroup path leaked');
  check(typeof e.limitations==='string' &&
    e.limitations.includes('not operation peak') &&
    e.limitations.includes('not exclusive') &&
    e.limitations.includes('not Worker') &&
    e.limitations.includes('blind'), 'missing sampling limits');
  return true;
}

export async function connectCdp(url){
  const ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(fail('DevTools connection timeout')),8000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(fail('DevTools connection error'));},{once:true});
  });
  let id=0;
  return {
    async send(method,params={}){
      const key=++id;
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{
          ws.removeEventListener('message',handle);reject(fail('DevTools '+method+' timeout'));
        },10000);
        function handle(event){
          let message;
          try{message=JSON.parse(String(event.data));}catch{return;}
          if(message.id!==key)return;
          clearTimeout(timer);ws.removeEventListener('message',handle);
          if(message.error)reject(fail('DevTools '+method+' failed'));
          else resolve(message.result);
        }
        ws.addEventListener('message',handle);
        ws.send(JSON.stringify({id:key,method,params}));
      });
    },
    close(){ws.close();},
  };
}
export async function evaluate(client,expression){
  const result=await client.send('Runtime.evaluate',{
    expression,returnByValue:true,awaitPromise:true});
  check(!result.exceptionDetails,'control page execution failed');
  return result.result?.value;
}
export async function until(label,fn){
  for(let i=0;i<100;i++){
    if(await fn())return;
    await sleep(100);
  }
  throw fail('timeout '+label);
}
export async function runChromiumCgroupScopeControl(){
  check(process.platform==='linux','real Chromium control requires Linux');
  const dir=await mkdtemp(path.join(tmpdir(),'zpe-003t-cgroup-'));
  let browser=null,page=null;
  try{
    const file=path.join(dir,'cgroup.html');
    await writeFile(file,'<!doctype html><meta charset="utf-8"><title>003T cgroup control</title>');
    const href=pathToFileURL(file).href;
    browser=spawn(findChrome(),[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--disable-background-networking','--no-first-run','--no-default-browser-check',
      '--no-extensions','--remote-debugging-port=0',
      '--user-data-dir='+path.join(dir,'profile'),href,
    ],{stdio:['ignore','ignore','pipe']});
    check(Number.isSafeInteger(browser.pid)&&browser.pid>0,'launcher missing');
    const ws=await devtoolsUrl(browser);
    const root=new URL(ws),origin='http://'+root.hostname+':'+root.port;
    let target;
    await until('file:// page',async()=>{
      const res=await fetch(origin+'/json/list');
      const list=await res.json();
      target=list.find(t=>t.type==='page' && t.url===href &&
        t.webSocketDebuggerUrl);
      return Boolean(target);
    });
    page=await connectCdp(target.webSocketDebuggerUrl);
    await page.send('Runtime.enable');
    await until('page ready',async()=>evaluate(page,'document.readyState==="complete"'));
    const before=await probeChromiumCgroup(browser.pid);
    await evaluate(page,`(() => {
      window.__zpeCgroupControl={held:false};
      const code='const p=new Uint8Array(64*1024*1024);for(let i=0;i<p.length;i+=4096)p[i]=7;self.keep=p;self.postMessage("held")';
      const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
      const worker=new Worker(url);
      window.__zpeCgroupControl.worker=worker;
      window.__zpeCgroupControl.url=url;
      worker.onmessage=event=>{
        if(event.data==="held")window.__zpeCgroupControl.held=true;
      };
      return true;
    })()`);
    await until('acknowledged held Worker memory',()=>
      evaluate(page,'window.__zpeCgroupControl?.held===true'));
    const held=await probeChromiumCgroup(browser.pid);
    await evaluate(page,'(() => {window.__zpeCgroupControl.worker.terminate();URL.revokeObjectURL(window.__zpeCgroupControl.url);return true})()');
    const e={kind:'zpe-real-chromium-cgroup-scope-v1',schemaVersion:1,
      origin:'real Chromium file:// temporary Worker allocation',
      launcherPid:browser.pid,controlBytes:64*MIB,workerAcknowledged:true,
      before,held,trueOperationPeakKnown:false,workerPidMapping:'unknown',
      limitations:'cgroup v2 memory.current is a sampled cgroup-wide counter, not operation peak. Same cgroup as runner is not exclusive; even a separate cgroup is not exclusive without descendant/churn proof. Sequential reads have blind windows; launcher PID is not Worker PID.',
    };
    validateChromiumCgroupScopeEvidence(e);
    return e;
  }finally{
    page?.close();
    if(browser && browser.exitCode===null && browser.signalCode===null)
      browser.kill('SIGTERM');
    await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100});
  }
}

async function main(){
  if(process.argv[2]==='--verify'){
    check(process.argv.length===4,'usage: --verify FILE');
    validateChromiumCgroupScopeEvidence(JSON.parse(await readFile(process.argv[3],'utf8')));
    console.log('003T Chromium cgroup scope evidence PASS');
    return;
  }
  check(process.argv.length===3,'usage: script ARTIFACT.json');
  const report=await runChromiumCgroupScopeControl();
  await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('003T real Chromium cgroup probe PASS: before=' +
    report.before.availability+'/'+report.before.scope +
    ', held='+report.held.availability+'/'+report.held.scope +
    '; operation peak/Worker PID unknown');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
