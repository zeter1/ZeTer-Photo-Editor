// 003T/2d-3: non-privileged, bounded cgroup v2 delegation feasibility.
// This migrates ONLY our disposable Node control child, never the CI runner or
// a browser process. Even a successful migration cannot establish Chromium
// descendants, Worker PID, operation exclusivity, or an operation RAM peak.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir,rmdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseCgroupV2} from './browser-chromium-cgroup-control.mjs';
import {parseLinuxProcStartTime} from './browser-linux-process-identity.mjs';

const ROOT='/sys/fs/cgroup';
const LIMITATIONS='Controlled Node child cgroup migration is not browser process-tree membership or operation peak. Concurrent descendants, process churn, Worker PID mapping and blind sampling windows remain unknown.';
const fail=reason=>new Error('003T cgroup delegation: '+reason);
const exact=(value,keys)=>value && !Array.isArray(value) &&
  Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const reasonFor=(stage,error)=>{
  if(error?.code==='EROFS')return stage+'-read-only';
  if(error?.code==='EACCES' || error?.code==='EPERM')return stage+'-permission-denied';
  if(error?.code==='EBUSY')return stage+'-busy';
  return stage+'-unavailable';
};

export function validateCgroupDelegationEvidence(e){
  if(!exact(e,['kind','schemaVersion','origin','status','reason','cgroupCreated',
    'migrationAttempted','childMembershipVerified','cleanup',
    'browserDescendantCoverage','trueOperationPeakKnown','workerPidMapping','limitations']) ||
    e.kind!=='zpe-cgroup-delegation-feasibility-v1' || e.schemaVersion!==1 ||
    e.origin!=='real Linux runner disposable Node child cgroup v2 probe' ||
    !['blocked','unknown','control-migration-observed'].includes(e.status) ||
    typeof e.cgroupCreated!=='boolean' || typeof e.migrationAttempted!=='boolean' ||
    typeof e.childMembershipVerified!=='boolean' ||
    !['not-created','complete'].includes(e.cleanup) ||
    e.cleanup!==(e.cgroupCreated?'complete':'not-created') ||
    (e.migrationAttempted && !e.cgroupCreated) ||
    (e.childMembershipVerified && !e.migrationAttempted) ||
    e.browserDescendantCoverage!=='unknown' || e.trueOperationPeakKnown!==false ||
    e.workerPidMapping!=='unknown' || e.limitations!==LIMITATIONS)
    throw fail('invalid artifact shape or unsupported attribution');
  const reasons=new Set(['not-linux','no-readable-cgroup-v2',
    'cgroup-create-read-only','cgroup-create-permission-denied',
    'cgroup-create-busy','cgroup-create-unavailable',
    'cgroup-move-read-only','cgroup-move-permission-denied',
    'cgroup-move-busy','cgroup-move-unavailable',
    'control-child-unverifiable','control-membership-mismatch',
    'control-pid-incarnation-changed','runner-membership-changed']);
  if(e.status==='control-migration-observed'){
    if(e.reason!=='controlled-child-migration-verified' || !e.cgroupCreated ||
      !e.migrationAttempted || !e.childMembershipVerified)throw fail('forged migration');
  }else{
    if(!reasons.has(e.reason) || e.childMembershipVerified ||
      (e.status==='blocked' && !(
        e.reason==='not-linux' || e.reason.startsWith('cgroup-create-') ||
        e.reason.startsWith('cgroup-move-'))) ||
      (e.status==='unknown' && !(
        e.reason==='no-readable-cgroup-v2' ||
        e.reason.startsWith('control-') || e.reason==='runner-membership-changed')))
      throw fail('unsupported reason or false observation');
    if(e.reason.startsWith('cgroup-create-') &&
      (e.cgroupCreated || e.migrationAttempted))throw fail('false cgroup create');
    if(e.reason.startsWith('cgroup-move-') &&
      (!e.cgroupCreated || !e.migrationAttempted))throw fail('false migration attempt');
    if(['not-linux','no-readable-cgroup-v2'].includes(e.reason) &&
      (e.cgroupCreated || e.migrationAttempted))throw fail('false platform observation');
  }
  const text=JSON.stringify(e);
  if(/file:\/\/\/|blob:|\/sys\/fs\/cgroup\/|\/proc\/\d+|\/home\/|operationPeakRssBytes/i.test(text))
    throw fail('private path or unsupported peak');
  return true;
}

async function launchNodeControl(){
  const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],
    {stdio:'ignore'});
  await once(child,'spawn');
  return {pid:child.pid,async stop(){
    if(child.exitCode!==null || child.signalCode!==null)return;
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(fail('control-child-stop-timeout')),5000);
      child.once('exit',()=>{clearTimeout(timeout);resolve();});
      if(!child.kill('SIGKILL')){
        clearTimeout(timeout);
        reject(fail('control-child-stop-failed'));
      }
    });
  }};
}

export async function probeCgroupDelegation({
  platform=process.platform,readText=readFile,create=mkdir,writeText=writeFile,
  remove=rmdir,launchControl=launchNodeControl,
  name='zpe-003t2d3-'+process.pid+'-'+randomBytes(6).toString('hex'),
}={}){
  if(!/^zpe-003t2d3-[a-zA-Z0-9-]+$/.test(name))
    throw fail('invalid disposable group name');
  const evidence={kind:'zpe-cgroup-delegation-feasibility-v1',schemaVersion:1,
    origin:'real Linux runner disposable Node child cgroup v2 probe',
    status:'unknown',reason:'no-readable-cgroup-v2',cgroupCreated:false,
    migrationAttempted:false,childMembershipVerified:false,cleanup:'not-created',
    browserDescendantCoverage:'unknown',trueOperationPeakKnown:false,
    workerPidMapping:'unknown',limitations:LIMITATIONS};
  const done=(status,reason)=>{
    evidence.status=status;evidence.reason=reason;
    validateCgroupDelegationEvidence(evidence);
    return evidence;
  };
  if(platform!=='linux')return done('blocked','not-linux');
  let parent,relative;
  try{
    relative=parseCgroupV2(await readText('/proc/self/cgroup','utf8'));
    if(relative===null || relative.includes('//') ||
       !/^\/[a-zA-Z0-9_./-]*$/.test(relative))
      return done('unknown','no-readable-cgroup-v2');
    // Reading cgroup.controllers proves the cgroup-v2 mount endpoint exists,
    // not that the runner has delegation or usable controllers.
    await readText(ROOT+'/cgroup.controllers','utf8');
    parent=path.resolve(ROOT,'.'+relative);
    if(parent!==ROOT && !parent.startsWith(ROOT+'/'))
      return done('unknown','no-readable-cgroup-v2');
  }catch{
    return done('unknown','no-readable-cgroup-v2');
  }
  const dir=path.join(parent,name);
  let child;
  try{
    try{
      await create(dir);
    }catch(error){
      return done('blocked',reasonFor('cgroup-create',error));
    }
    evidence.cgroupCreated=true;
    try{
      child=await launchControl();
      if(!Number.isSafeInteger(child?.pid) || child.pid<=0 ||
         typeof child.stop!=='function')throw fail('invalid control child');
      const startBefore=parseLinuxProcStartTime(
        await readText('/proc/'+child.pid+'/stat','utf8'),child.pid);
      evidence.migrationAttempted=true;
      try{
        // Only migrate this newly spawned, disposable Node child.
        await writeText(path.join(dir,'cgroup.procs'),String(child.pid),'utf8');
      }catch(error){
        return doneAfterCleanup('blocked',reasonFor('cgroup-move',error));
      }
      const observed=parseCgroupV2(
        await readText('/proc/'+child.pid+'/cgroup','utf8'));
      const startAfter=parseLinuxProcStartTime(
        await readText('/proc/'+child.pid+'/stat','utf8'),child.pid);
      if(startAfter!==startBefore)
        return doneAfterCleanup('unknown','control-pid-incarnation-changed');
      if(observed!==relative.replace(/\/$/,'')+'/'+name)
        return doneAfterCleanup('unknown','control-membership-mismatch');
      if(parseCgroupV2(await readText('/proc/self/cgroup','utf8'))!==relative)
        return doneAfterCleanup('unknown','runner-membership-changed');
      evidence.childMembershipVerified=true;
      return doneAfterCleanup('control-migration-observed',
        'controlled-child-migration-verified');
    }catch{
      return doneAfterCleanup('unknown','control-child-unverifiable');
    }
  }finally{
    if(child)await child.stop();
    if(evidence.cgroupCreated){
      // No leaked delegated group. Cleanup failures MUST fail CI rather than
      // fabricating a clean receipt; never log the private cgroup path.
      try{await remove(dir);evidence.cleanup='complete';}
      catch{throw fail('cannot-remove-disposable-cgroup');}
    }
  }
  // Return from the try executes after finally; the shared evidence object
  // gains its actual teardown state before validation below.
  function doneAfterCleanup(status,reason){
    evidence.status=status;evidence.reason=reason;
    return evidence;
  }
}

async function main(){
  const arg=process.argv[2];
  if(arg==='--verify'){
    if(process.argv.length!==4)throw fail('usage: --verify ARTIFACT.json');
    validateCgroupDelegationEvidence(JSON.parse(await readFile(process.argv[3],'utf8')));
    console.log('003T cgroup delegation evidence PASS');
    return;
  }
  if(process.argv.length!==3)throw fail('usage: script ARTIFACT.json');
  const receipt=await probeCgroupDelegation();
  // Delayed validation after the finally cleanup.
  validateCgroupDelegationEvidence(receipt);
  await writeFile(arg,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log('003T real Linux cgroup delegation: '+receipt.status+
    ' ('+receipt.reason+'); browser descendants/operation peak/Worker PID unknown');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
