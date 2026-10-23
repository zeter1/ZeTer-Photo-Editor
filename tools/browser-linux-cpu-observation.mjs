// 003T/3a: bounded /proc CPU tick observations, never a total operation
// CPU measurement. CDP gives a sampled process census, not Worker -> PID.
import {readFile} from 'node:fs/promises';

const fail = message => new Error('003T CPU evidence: '+message);
const validPid = pid => Number.isSafeInteger(pid) && pid > 0;
const tick = value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === keys.slice().sort().join(',');

export function parseLinuxProcCpuStat(raw, expectedPid) {
  if (typeof raw !== 'string' || !validPid(expectedPid)) throw fail('invalid /proc stat or PID');
  const open=raw.indexOf('('), close=raw.lastIndexOf(')');
  if (open < 1 || close <= open || raw.slice(0,open).trim() !== String(expectedPid))
    throw fail('PID/comm mismatch');
  // After (comm), element 0 is field 3 (state); utime/stime/starttime
  // are fields 14/15/22 respectively. Never round counters through Number.
  const fields=raw.slice(close+1).trim().split(/\s+/);
  if (fields.length < 20 || ![fields[11],fields[12],fields[19]].every(
    value => typeof value === 'string' && /^\d+$/.test(value)))
    throw fail('missing /proc CPU counters or starttime');
  const [userTicks,systemTicks,starttimeTicks]=[fields[11],fields[12],fields[19]]
    .map(value => BigInt(value).toString());
  if (starttimeTicks === '0') throw fail('invalid process starttime');
  return {pid:expectedPid,starttimeTicks,userTicks,systemTicks};
}

export function validateLinuxCpuCensus(census) {
  if (!exact(census,['availability','reason','readStartedMs','readFinishedMs','incarnations']) ||
      !Number.isFinite(census.readStartedMs) || census.readStartedMs < 0 ||
      !Number.isFinite(census.readFinishedMs) ||
      census.readFinishedMs < census.readStartedMs) throw fail('invalid read window');
  if (census.availability === 'unknown') {
    if (!['unsupported-platform','proc-member-unavailable','cdp-unavailable'].includes(census.reason) ||
        census.incarnations !== null) throw fail('missing census must remain unknown');
  } else {
    if (census.availability !== 'observed' || census.reason !== null ||
        !Array.isArray(census.incarnations) || !census.incarnations.length)
      throw fail('invalid observed census');
    let lastPid=0;
    for (const p of census.incarnations) {
      if (!exact(p,['pid','starttimeTicks','userTicks','systemTicks']) ||
          !validPid(p.pid) || p.pid <= lastPid ||
          !tick(p.starttimeTicks) || p.starttimeTicks === '0' ||
          !tick(p.userTicks) || !tick(p.systemTicks))
        throw fail('invalid or duplicate PID incarnation/CPU ticks');
      lastPid=p.pid;
    }
  }
  return true;
}

export function unknownLinuxCpuCensus(reason,{now=()=>performance.now()}={}) {
  if(!['unsupported-platform','proc-member-unavailable','cdp-unavailable'].includes(reason))
    throw fail('invalid unknown CPU reason');
  const at=now();
  const census={availability:'unknown',reason,readStartedMs:at,
    readFinishedMs:at,incarnations:null};
  validateLinuxCpuCensus(census);
  return census;
}

export async function collectLinuxCpuCensus(processes,{
  platform=process.platform,readStat=readFile,now=()=>performance.now(),
}={}) {
  if (!Array.isArray(processes) || !processes.length ||
      processes.some(p=>!validPid(p?.id)) ||
      new Set(processes.map(p=>p.id)).size !== processes.length)
    throw fail('incomplete/duplicate CDP process membership');
  const readStartedMs=now();
  if (!Number.isFinite(readStartedMs) || readStartedMs<0) throw fail('invalid clock');
  let reason=platform==='linux'?null:'unsupported-platform', incarnations=[];
  if (!reason) {
    try {
      for (const {id} of processes) {
        const raw=await readStat('/proc/'+id+'/stat','utf8');
        incarnations.push(parseLinuxProcCpuStat(raw,id));
      }
    } catch {
      // Reject the entire partial read, including earlier valid members.
      reason='proc-member-unavailable';
    }
  }
  const readFinishedMs=now();
  const census={
    availability:reason?'unknown':'observed',reason,
    readStartedMs,readFinishedMs,
    incarnations:reason?null:incarnations.sort((a,b)=>a.pid-b.pid),
  };
  validateLinuxCpuCensus(census);
  return census;
}

export function compareLinuxCpuCensuses(before,after) {
  validateLinuxCpuCensus(before);
  validateLinuxCpuCensus(after);
  if (after.readStartedMs < before.readFinishedMs)
    throw fail('overlapping or reversed census windows');
  const gapMs=after.readStartedMs-before.readFinishedMs;
  let matchedIncarnations=0, missingPids=0, newPids=0, reusedPids=0;
  let user=0n,system=0n;
  const observed=before.availability==='observed' && after.availability==='observed';
  if (observed) {
    const a=new Map(before.incarnations.map(p=>[p.pid,p]));
    const b=new Map(after.incarnations.map(p=>[p.pid,p]));
    for (const [pid,p] of a) {
      const later=b.get(pid);
      if (!later) {missingPids++;continue;}
      if (p.starttimeTicks!==later.starttimeTicks) {reusedPids++;continue;}
      const deltaUser=BigInt(later.userTicks)-BigInt(p.userTicks);
      const deltaSystem=BigInt(later.systemTicks)-BigInt(p.systemTicks);
      if (deltaUser < 0n || deltaSystem < 0n)
        throw fail('CPU counter regressed within the same PID incarnation');
      user+=deltaUser;system+=deltaSystem;matchedIncarnations++;
    }
    for (const pid of b.keys()) if (!a.has(pid)) newPids++;
  }
  return {
    availability:observed?'sampled-overlap-only':'unknown',
    gapMs,matchedIncarnations:observed?matchedIncarnations:null,
    missingPids:observed?missingPids:null,
    newPids:observed?newPids:null,
    reusedPids:observed?reusedPids:null,
    matchedUserTicks:observed?user.toString():null,
    matchedSystemTicks:observed?system.toString():null,
    operationCpuTotalKnown:false,trueOperationPeakKnown:false,
    workerPidMapping:'unknown',
  };
}

export function validateLinuxCpuEvidence(report) {
  if (!exact(report,['kind','origin','before','after','comparison','workerAcknowledged','limitations']) ||
      report.kind!=='zpe-chromium-overlapping-cpu-ticks-v1' ||
      report.origin!=='real Chromium file:// temporary Worker CPU control' ||
      report.workerAcknowledged!==true ||
      typeof report.limitations!=='string' ||
      !report.limitations.includes('not operation CPU') ||
      !report.limitations.includes('not Worker PID') ||
      !report.limitations.includes('blind')) throw fail('invalid CPU evidence metadata');
  const expected=compareLinuxCpuCensuses(report.before,report.after);
  if (!exact(report.comparison,Object.keys(expected)) ||
      Object.keys(expected).some(k=>report.comparison[k]!==expected[k]))
    throw fail('forged CPU delta, coverage or attribution');
  return true;
}
