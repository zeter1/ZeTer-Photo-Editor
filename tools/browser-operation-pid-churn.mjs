// 003T/3d-1: derive sampled PID-incarnation churn from independently verified
// real native CPU and CPU/RSS receipts; never infer OS exits or Worker PID.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';

const fail=message=>new TypeError('003T/3d PID churn: '+message);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const LIMITATIONS='These are two non-atomic Linux /proc snapshots of CDP process membership, not continuous monitoring. New or missing PID+starttime identities indicate observed membership changes, not proven process starts or exits. Unknown CPU/RSS/mismatched identity snapshots invalidate their adjacent interval, even if another observation succeeds later. This does not identify a Worker OS PID, operation-exclusive CPU, or true operation CPU/RSS peak.';
const validId=p=>Number.isSafeInteger(p.pid) && p.pid>0 &&
  typeof p.starttimeTicks==='string' && /^[1-9]\\d*$/.test(p.starttimeTicks);

function members(cpu){
  if(cpu.availability!=='observed')return null;
  if(!Array.isArray(cpu.incarnations) || !cpu.incarnations.length ||
    cpu.incarnations.some(p=>!validId(p)))throw fail('invalid CPU identity sample');
  const sorted=cpu.incarnations.map(p=>({pid:p.pid,starttimeTicks:p.starttimeTicks}))
    .sort((a,b)=>a.pid-b.pid);
  if(sorted.some((p,i)=>i>0 && p.pid===sorted[i-1].pid))
    throw fail('duplicate PID in census');
  return sorted;
}

export function deriveOperationPidChurn(cpu,coverage){
  if(!['PSD16','PSB32'].includes(cpu?.format) || coverage?.format!==cpu.format ||
    cpu.protocol!=='file:' || coverage.protocol!=='file:' ||
    !Array.isArray(cpu.phases) || cpu.phases.length!==6 ||
    !Array.isArray(coverage.stages) || coverage.stages.length!==6 ||
    !Array.isArray(coverage.comparisons) || coverage.comparisons.length!==6 ||
    coverage.cpuReportSha256!==digest(cpu) ||
    cpu.nativeReceiptSha256!==coverage.nativeReceiptSha256)
    throw fail('unbound native CPU/RSS reports');
  const intervals=[];
  for(let i=1;i<cpu.phases.length;i++){
    const before=cpu.phases[i-1],after=cpu.phases[i];
    if(!before?.census || !after?.census || !before.phase || !after.phase ||
      coverage.stages[i-1]?.phase!==before.phase ||
      coverage.stages[i]?.phase!==after.phase)
      throw fail('missing or reordered native operation boundary');
    const a=members(before.census),b=members(after.census);
    const left=coverage.comparisons[i-1]?.availability;
    const right=coverage.comparisons[i]?.availability;
    let reason=null;
    if(!a || !b)reason='cpu-boundary-unknown';
    else if(coverage.stages[i-1]?.rss?.availability!=='observed' ||
      coverage.stages[i]?.rss?.availability!=='observed')reason='rss-boundary-unknown';
    else if(left!=='matching-sampled-membership-only' ||
      right!=='matching-sampled-membership-only')reason='cpu-rss-membership-unknown';
    const bracketGapMs=after.census.readStartedMs-before.census.readFinishedMs;
    if(!Number.isFinite(bracketGapMs) || bracketGapMs<0)throw fail('invalid boundary clock gap');
    if(reason){
      intervals.push({from:before.phase,to:after.phase,
        availability:'unknown',reason,bracketGapMs,
        retained:null,newlyObserved:null,noLongerObserved:null,reusedPidNumbers:null});
      continue;
    }
    const mapA=new Map(a.map(p=>[p.pid,p]));
    const mapB=new Map(b.map(p=>[p.pid,p]));
    intervals.push({from:before.phase,to:after.phase,
      availability:'sampled-two-boundaries-only',reason:null,bracketGapMs,
      retained:a.filter(p=>mapB.get(p.pid)?.starttimeTicks===p.starttimeTicks),
      newlyObserved:b.filter(p=>mapA.get(p.pid)?.starttimeTicks!==p.starttimeTicks),
      noLongerObserved:a.filter(p=>mapB.get(p.pid)?.starttimeTicks!==p.starttimeTicks),
      reusedPidNumbers:a.filter(p=>mapB.has(p.pid) &&
        mapB.get(p.pid).starttimeTicks!==p.starttimeTicks).map(p=>p.pid),
    });
  }
  return {
    kind:'zpe-native-operation-pid-churn-v1',format:cpu.format,protocol:'file:',
    cpuReportSha256:digest(cpu),coverageSha256:digest(coverage),
    nativeReceiptSha256:cpu.nativeReceiptSha256,
    intervals,
    observedIntervals:intervals.filter(x=>x.availability==='sampled-two-boundaries-only').length,
    unknownIntervals:intervals.filter(x=>x.availability==='unknown').length,
    intervalsWithObservedChurn:intervals.filter(x=>x.newlyObserved?.length ||
      x.noLongerObserved?.length).length,
    provenProcessExits:null,workerPidMapping:'unknown',
    operationCpuTotalKnown:false,trueOperationPeakKnown:false,
    limitations:LIMITATIONS,
  };
}

// This validates the derived receipt *against the complete source evidence*.
// The caller must first independently validate CPU/RSS/native source receipts.
export function validateOperationPidChurn(report,cpu,coverage){
  if(!isDeepStrictEqual(report,deriveOperationPidChurn(cpu,coverage)))
    throw fail('forged churn/missing-window/attribution evidence');
  return true;
}

// Called only after the existing strict native CPU/RSS verifier has passed.
// Same artifact folder is already uploaded by the existing real Chromium CI.
export async function writeVerifiedPidChurnReceipts(coverageDir,cpuDir){
  if(!coverageDir || !cpuDir)throw fail('CPU/RSS artifact paths required');
  for(const format of ['PSD16','PSB32']){
    const key=format.toLowerCase();
    const [cpu,coverage]=await Promise.all([
      readFile(join(cpuDir,'stage003-operation-cpu-'+key+'.json'),'utf8'),
      readFile(join(coverageDir,'stage003-operation-cpu-rss-'+key+'.json'),'utf8'),
    ]).then(data=>data.map(JSON.parse));
    const report=deriveOperationPidChurn(cpu,coverage);
    validateOperationPidChurn(report,cpu,coverage);
    const destination=join(coverageDir,'stage003-operation-pid-churn-'+key+'.json');
    await writeFile(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    validateOperationPidChurn(JSON.parse(await readFile(destination,'utf8')),cpu,coverage);
  }
  return true;
}
