// 003T/2d-1 diagnostic: independently controlled Linux PID memory workload.
// This calibrates what sampled RSS and process-lifetime VmHWM CAN observe;
// it intentionally does not claim an editor operation-wide memory peak.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sampleLinuxChromiumRss} from './browser-linux-process-rss.mjs';
import {validateChromiumRssSampleMembership} from './browser-rss-sample-identity.mjs';

const MIB=1024*1024;
const error=message=>new Error('003T memory calibration: '+message);
const check=(ok,message)=>{if(!ok)throw error(message);};
const fields=(value,keys)=>value && typeof value==='object' &&
  Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const validStart=value=>typeof value==='string' && /^[1-9]\d*$/.test(value) &&
  BigInt(value).toString()===value;
const CHILD=`
  let buffer=null;
  process.on('message',({tag,action})=>{
    if(action==='allocate-control' || action==='allocate-operation'){
      const bytes=action==='allocate-control'?16*1024*1024:64*1024*1024;
      buffer=Buffer.allocUnsafe(bytes);
      for(let offset=0;offset<bytes;offset+=4096)buffer[offset]=77;
    }else if(action==='release'){
      buffer=null;
      if(global.gc)global.gc();
    }else{process.exitCode=2;return;}
    process.send({tag,ok:true});
  });
  process.send({tag:0,ok:true});
`;

export function validateIndependentMemoryCalibration(e){
  check(fields(e,['kind','schemaVersion','origin','pid','controlBytes',
    'operationBytes','samples','gap','trueOperationPeakKnown','workerPidMapping','limitations']),
    'invalid artifact field set');
  check(e.kind==='zpe-independent-linux-memory-calibration-v1' &&
    e.schemaVersion===1 && e.origin==='real isolated Node child /proc (not Chromium)' &&
    e.trueOperationPeakKnown===false && e.workerPidMapping==='unknown' &&
    Number.isSafeInteger(e.pid) && e.pid>0 &&
    e.controlBytes===16*MIB && e.operationBytes===64*MIB,
    'unsupported peak/worker claim or control metadata');
  const names=['beforeControl','controlHeld','beforeOperation','operationHeld','afterOperation'];
  check(fields(e.samples,names),'missing or forged observation phase');
  let incarnation=null,previousHwm=0;
  for(const name of names){
    const p=e.samples[name];
    check(fields(p,['pid','starttimeTicks','rssBytes','highWaterBytes']) &&
      p.pid===e.pid && validStart(p.starttimeTicks) &&
      Number.isSafeInteger(p.rssBytes) && p.rssBytes>0 &&
      Number.isSafeInteger(p.highWaterBytes) && p.highWaterBytes>=p.rssBytes &&
      p.highWaterBytes>=previousHwm,'invalid /proc RSS, HWM or reused PID at '+name);
    if(incarnation!==null)check(p.starttimeTicks===incarnation,'changed PID incarnation');
    incarnation=p.starttimeTicks;
    previousHwm=p.highWaterBytes;
  }
  check(e.samples.controlHeld.rssBytes > e.samples.beforeControl.rssBytes + 4*MIB,
    'control workload not resident; calibration inconclusive');
  check(e.samples.operationHeld.rssBytes > e.samples.beforeOperation.rssBytes + 16*MIB,
    'operation workload not resident; calibration inconclusive');
  check(fields(e.gap,['availability','reason','periodicSamples']) &&
    e.gap.availability==='not-observed' &&
    e.gap.reason==='no-continuous-proc-monitor-between-acknowledgements' &&
    e.gap.periodicSamples===0,'missing unobserved sampling gap');
  check(typeof e.limitations==='string' &&
    e.limitations.includes('process-lifetime') &&
    e.limitations.includes('not Chromium') &&
    e.limitations.includes('not operation peak') &&
    e.limitations.includes('Worker'), 'missing calibration limitations');
  return true;
}

async function sample(pid){
  const processes=[{id:pid,type:'calibration'}];
  const rss=await sampleLinuxChromiumRss(processes);
  check(rss.supported===true && rss.processCount===1,'/proc sample unavailable');
  validateChromiumRssSampleMembership(processes,rss);
  const {starttimeTicks,rssBytes,highWaterBytes}=rss.processSamples[0];
  return {pid,starttimeTicks,rssBytes,highWaterBytes};
}

// Child ACK only proves the controlled allocation has been touched before
// sampling. Requests and /proc reads are sequential; there is no continuous
// process-tree census or operation-isolated peak sensor.
function response(child,tag,action){
  return new Promise((resolve,reject)=>{
    let timer;
    const cleanup=()=>{
      clearTimeout(timer);
      child.off('message',onMessage);
      child.off('exit',onExit);
      child.off('error',onError);
    };
    const fail=message=>{cleanup();reject(error(message));};
    const onExit=()=>fail('control child exited before acknowledgement');
    const onError=e=>fail('control child error: '+e.message);
    const onMessage=m=>{
      if(m?.tag!==tag)return;
      if(m.ok!==true)return fail('invalid control child acknowledgement');
      cleanup();resolve();
    };
    child.on('message',onMessage);
    child.once('exit',onExit);
    child.once('error',onError);
    timer=setTimeout(()=>fail('control child acknowledgement timeout'),10000);
    if(action)child.send({tag,action},err=>{if(err)fail('IPC failed: '+err.message);});
  });
}

export async function runIndependentMemoryCalibration(){
  check(process.platform==='linux','Linux /proc required');
  const child=spawn(process.execPath,['--expose-gc','--input-type=module','-e',CHILD],
    {stdio:['ignore','ignore','ignore','ipc']});
  try{
    check(Number.isSafeInteger(child.pid)&&child.pid>0,'control PID unavailable');
    await response(child,0);
    const beforeControl=await sample(child.pid);
    await response(child,1,'allocate-control');
    const controlHeld=await sample(child.pid);
    await response(child,2,'release');
    const beforeOperation=await sample(child.pid);
    await response(child,3,'allocate-operation');
    const operationHeld=await sample(child.pid);
    await response(child,4,'release');
    const afterOperation=await sample(child.pid);
    const report={
      kind:'zpe-independent-linux-memory-calibration-v1',schemaVersion:1,
      origin:'real isolated Node child /proc (not Chromium)',pid:child.pid,
      controlBytes:16*MIB,operationBytes:64*MIB,
      samples:{beforeControl,controlHeld,beforeOperation,operationHeld,afterOperation},
      gap:{availability:'not-observed',
        reason:'no-continuous-proc-monitor-between-acknowledgements',periodicSamples:0},
      trueOperationPeakKnown:false,workerPidMapping:'unknown',
      limitations:'VmHWM is a process-lifetime watermark including pre-operation allocations; it is not operation peak. A single isolated Node PID is not Chromium, a process tree or cgroup. No continuous reads across the acknowledgement gap, no Worker PID attribution.',
    };
    validateIndependentMemoryCalibration(report);
    return report;
  }finally{
    if(child.exitCode===null && child.signalCode===null){
      const closed=once(child,'close');
      child.kill('SIGKILL');
      await closed;
    }
  }
}

async function main(){
  if(process.argv[2]==='--verify'){
    check(process.argv.length===4,'usage: --verify JSON');
    validateIndependentMemoryCalibration(JSON.parse(await readFile(process.argv[3],'utf8')));
    console.log('003T independent Linux memory calibration evidence PASS');
    return;
  }
  check(process.argv.length===3,'usage: node tools/browser-memory-peak-calibration.mjs JSON');
  const report=await runIndependentMemoryCalibration();
  await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('003T independent real Linux RSS/HWM control PASS; operation peak and Worker PID unknown');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
