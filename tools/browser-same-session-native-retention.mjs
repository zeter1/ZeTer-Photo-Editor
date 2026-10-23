// 003T/4: observations after genuine repeated file:// native edits in ONE
// Chromium process/session. Comparable samples are not an operation peak or leak proof.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createBrowserHighDepthFixture} from './browser-high-depth-fixtures.mjs';
import {validateLinuxCpuCensus} from './browser-linux-cpu-observation.mjs';
import {validateOperationRssCensus,compareCpuRssMembership} from './browser-operation-cpu-rss-coverage.mjs';
import {validateBrowserDenseCancelEvidence} from './browser-dense-cancel-evidence.mjs';

const fail=message=>{throw new TypeError('003T/4 same-session retention: '+message);};
const exact=(value,keys)=>value && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const sha=value=>createHash('sha256').update(value).digest('hex');
const LIMITATIONS='Three sequential real native Fill/Undo/Redo cycles in one Chromium file:// session. RSS samples are sequential non-atomic CDP/proc reads, not operation peaks or continuous process coverage; CPU/RSS membership matching is sampled only. No Worker PID, isolated operation memory, or leak attribution. Missing/reused process identities stay unknown.';
const bool=value=>value===true;
const nonnegative=value=>Number.isFinite(value)&&value>=0;

function checkMark(mark) {
  if(!exact(mark,['cpu','rss']))fail('missing/extra CPU-RSS evidence');
  validateLinuxCpuCensus(mark.cpu);
  validateOperationRssCensus(mark.rss);
  if(mark.rss.readStartedMs<mark.cpu.readFinishedMs)fail('nonsequential CPU/RSS read');
  return compareCpuRssMembership(mark.cpu,mark.rss);
}

export function compareRetainedCycleSamples(previous,current) {
  const a=checkMark(previous),b=checkMark(current);
  if(a.availability!=='matching-sampled-membership-only' ||
      b.availability!=='matching-sampled-membership-only')
    return {availability:'unknown',reason:'missing-or-inconsistent-cpu-rss',deltaBytes:null};
  const x=previous.rss.processSamples,y=current.rss.processSamples;
  if(x.length!==y.length || x.some((p,i)=>p.pid!==y[i].pid ||
      p.starttimeTicks!==y[i].starttimeTicks))
    return {availability:'unknown',reason:'pid-incarnation-or-membership-change',deltaBytes:null};
  const delta=current.rss.aggregateRssBytes-previous.rss.aggregateRssBytes;
  if(!Number.isSafeInteger(delta))fail('RSS difference out of range');
  return {availability:'sampled-comparable-only',reason:null,deltaBytes:delta};
}

export function validateSameSessionNativeRetention(report,native,expectedFixtureSha256) {
  validateBrowserDenseCancelEvidence(native);
  if(!exact(report,['kind','format','protocol','sessionId','sessionStartedAtUnixMs',
      'fixtureSha256','nativeReceiptSha256','cycles','comparisons',
      'trueOperationPeakKnown','workerPidMapping','leakProven','limitations']) ||
      report.kind!=='zpe-native-same-session-retention-v1' ||
      !['PSD16','PSB32'].includes(report.format) || report.format!==native.format ||
      report.protocol!=='file:' || typeof report.sessionId!=='string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(report.sessionId) ||
      !Number.isSafeInteger(report.sessionStartedAtUnixMs) || report.sessionStartedAtUnixMs<=0 ||
      typeof expectedFixtureSha256!=='string' ||
      !/^[0-9a-f]{64}$/.test(expectedFixtureSha256) ||
      report.fixtureSha256!==expectedFixtureSha256 ||
      report.nativeReceiptSha256!==sha(JSON.stringify(native)) ||
      report.trueOperationPeakKnown!==false ||
      report.workerPidMapping!=='unknown' || report.leakProven!==false ||
      report.limitations!==LIMITATIONS ||
      !Array.isArray(report.cycles) || report.cycles.length!==3 ||
      !Array.isArray(report.comparisons) || report.comparisons.length!==2)
    fail('wrong file/session/native binding or unsupported peak/Worker claim');
  for(let i=0;i<3;i++) {
    const c=report.cycles[i];
    if(!exact(c,['index','startMs','finishMs','before','after','workerJobs',
      'workerReplies','selectedPixels','nativeExactAfterUndo','nativeExactAfterRedo',
      'selectedPixelsChanged','outsideUnchanged','alphaUnchanged','historyOnce','lateRepliesAbsent']) ||
      c.index!==i+1 || !nonnegative(c.startMs) || !nonnegative(c.finishMs) ||
      c.finishMs<c.startMs || c.workerJobs!==i+2 || c.workerReplies!==i+1 ||
      c.selectedPixels!==native.secondSelectedPixels ||
      !Number.isSafeInteger(c.selectedPixelsChanged) || c.selectedPixelsChanged<=0 ||
      c.selectedPixelsChanged>c.selectedPixels ||
      !['nativeExactAfterUndo','nativeExactAfterRedo','outsideUnchanged',
        'alphaUnchanged','historyOnce','lateRepliesAbsent'].every(k=>bool(c[k])))
      fail('unverified native cycle/History/Worker result');
    checkMark(c.before);checkMark(c.after);
    if(c.before.cpu.readStartedMs<c.startMs ||
        c.after.cpu.readStartedMs<c.before.rss.readFinishedMs ||
        c.after.rss.readFinishedMs>c.finishMs ||
        (i>0 && c.startMs<report.cycles[i-1].finishMs))
      fail('overlapping/out-of-cycle observation timestamps');
    if(i>0){
      const expected=compareRetainedCycleSamples(report.cycles[i-1].after,c.after);
      if(!exact(report.comparisons[i-1],['from','to','comparison']) ||
          report.comparisons[i-1].from!==i ||
          report.comparisons[i-1].to!==i+1 ||
          !exact(report.comparisons[i-1].comparison,Object.keys(expected)) ||
          Object.keys(expected).some(k=>report.comparisons[i-1].comparison[k]!==expected[k]))
        fail('forged retained memory difference or missing-window coverage');
    }
  }
  return true;
}
export function createSameSessionNativeRetention({format,sessionId,sessionStartedAtUnixMs,
  fixtureSha256,nativeReceipt,cycles}) {
  const report={kind:'zpe-native-same-session-retention-v1',
    format,protocol:'file:',sessionId,sessionStartedAtUnixMs,fixtureSha256,
    nativeReceiptSha256:sha(JSON.stringify(nativeReceipt)),cycles,
    comparisons:cycles.slice(1).map((c,i)=>({
      from:i+1,to:i+2,
      comparison:compareRetainedCycleSamples(cycles[i].after,c.after),
    })),
    trueOperationPeakKnown:false,workerPidMapping:'unknown',leakProven:false,
    limitations:LIMITATIONS};
  validateSameSessionNativeRetention(report,nativeReceipt,fixtureSha256);
  return report;
}
export async function saveSameSessionNativeRetention(report,native,fixtureSha256,directory) {
  validateSameSessionNativeRetention(report,native,fixtureSha256);
  if(!directory)fail('artifact directory required');
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'stage003-same-session-retention-'+report.format.toLowerCase()+'.json');
  await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return file;
}
export async function verifySameSessionNativeRetention(directory,nativeDirectory) {
  if(!directory||!nativeDirectory)fail('two artifact directories required');
  const seenSessions=new Set();
  for(const format of ['PSD16','PSB32']){
    const key=format.toLowerCase();
    const report=JSON.parse(await readFile(path.join(directory,
      'stage003-same-session-retention-'+key+'.json'),'utf8'));
    const native=JSON.parse(await readFile(path.join(nativeDirectory,
      'stage003-dense-cancel-'+key+'.json'),'utf8'));
    const fixture=createBrowserHighDepthFixture(format==='PSD16'?'rgb16nearcap':'rgb32psbnearcap');
    validateSameSessionNativeRetention(report,native,sha(Buffer.from(fixture.bytes)));
    if(seenSessions.has(report.sessionId))fail('duplicate Chromium session across formats');
    seenSessions.add(report.sessionId);
  }
  return true;
}
