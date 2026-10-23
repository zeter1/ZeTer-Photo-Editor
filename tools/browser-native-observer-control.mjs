// 003T/4b: an independent fresh Chromium control session repeats native
// project readback + Undo/Redo without dispatching another Fill. Whole-browser
// sampled RSS cannot prove a retained native allocation or operation peak.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createBrowserHighDepthFixture} from './browser-high-depth-fixtures.mjs';
import {validateBrowserDenseCancelEvidence} from './browser-dense-cancel-evidence.mjs';
import {compareRetainedCycleSamples,validateSameSessionNativeRetention}
  from './browser-same-session-native-retention.mjs';

const fail=message=>{throw new TypeError('003T/4b observer control: '+message);};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).sort().join(',')===keys.slice().sort().join(',');
const hash=data=>createHash('sha256').update(data).digest('hex');
const LIMITATIONS='Independent fresh file:// Chromium observer-only run after one real native Fill. Three subsequent cycles repeat project/native readback and Undo/Redo without additional Fill. Sampled full-browser RSS is not process-exclusive, causal native retention, a leak, a continuous window, or an operation peak. Cross-session/PID RSS deltas must never be subtracted.';

export function validateNativeObserverControl(report,native,fixtureSha256) {
  validateBrowserDenseCancelEvidence(native);
  if(!exact(report,['kind','format','protocol','sessionId','sessionStartedAtUnixMs',
      'fixtureSha256','nativeReceiptSha256','baselineAfterFill','controls','comparisons',
      'noAdditionalFill','trueOperationPeakKnown','workerPidMapping','leakProven','limitations']) ||
      report.kind!=='zpe-native-observer-control-v1' ||
      report.format!==native.format || !['PSD16','PSB32'].includes(report.format) ||
      report.protocol!=='file:' ||
      typeof report.sessionId!=='string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(report.sessionId) ||
      !Number.isSafeInteger(report.sessionStartedAtUnixMs)||report.sessionStartedAtUnixMs<=0 ||
      report.fixtureSha256!==fixtureSha256 || !/^[0-9a-f]{64}$/.test(fixtureSha256) ||
      report.nativeReceiptSha256!==hash(JSON.stringify(native)) ||
      report.noAdditionalFill!==true || report.trueOperationPeakKnown!==false ||
      report.workerPidMapping!=='unknown' || report.leakProven!==false ||
      report.limitations!==LIMITATIONS || !Array.isArray(report.controls) ||
      report.controls.length!==3 || !Array.isArray(report.comparisons) ||
      report.comparisons.length!==2)
    fail('invalid control binding or unsupported causal/peak claim');
  // A self-compare validates each census and CPU/RSS snapshot consistency.
  compareRetainedCycleSamples(report.baselineAfterFill,report.baselineAfterFill);
  let previousFinish=report.baselineAfterFill.rss.readFinishedMs;
  for(let i=0;i<3;i++){
    const c=report.controls[i];
    if(!exact(c,['index','startMs','finishMs','before','after','workerJobs',
        'workerReplies','undoNativeExact','redoNativeExact','historyUnchanged',
        'selectionUnchanged','noNewWorker','projectReadbacks']) ||
        c.index!==i+1 || !Number.isFinite(c.startMs)||!Number.isFinite(c.finishMs) ||
        c.startMs<previousFinish || c.finishMs<c.startMs ||
        c.workerJobs!==2 || c.workerReplies!==1 ||
        c.undoNativeExact!==true || c.redoNativeExact!==true ||
        c.historyUnchanged!==true || c.selectionUnchanged!==true ||
        c.noNewWorker!==true || c.projectReadbacks!==2)
      fail('control requires two exact native project readbacks, stable History and no extra Worker');
    compareRetainedCycleSamples(c.before,c.before);
    compareRetainedCycleSamples(c.after,c.after);
    if(c.before.cpu.readStartedMs<c.startMs ||
       c.after.cpu.readStartedMs<c.before.rss.readFinishedMs ||
       c.after.rss.readFinishedMs>c.finishMs)
      fail('overlapping/nonsequential control observations');
    previousFinish=c.finishMs;
    if(i>0){
      const comparison=compareRetainedCycleSamples(report.controls[i-1].after,c.after);
      const saved=report.comparisons[i-1];
      if(!exact(saved,['from','to','comparison'])||saved.from!==i ||
         saved.to!==i+1 || !exact(saved.comparison,Object.keys(comparison)) ||
         Object.keys(comparison).some(k=>saved.comparison[k]!==comparison[k]))
        fail('forged or cross-session sampled RSS comparison');
    }
  }
  return true;
}

export function createNativeObserverControl({format,sessionId,sessionStartedAtUnixMs,
  fixtureSha256,nativeReceipt,baselineAfterFill,controls}) {
  const report={kind:'zpe-native-observer-control-v1',format,protocol:'file:',
    sessionId,sessionStartedAtUnixMs,fixtureSha256,
    nativeReceiptSha256:hash(JSON.stringify(nativeReceipt)),
    baselineAfterFill,controls,
    comparisons:controls.slice(1).map((c,i)=>({
      from:i+1,to:i+2,comparison:compareRetainedCycleSamples(controls[i].after,c.after),
    })),
    noAdditionalFill:true,trueOperationPeakKnown:false,workerPidMapping:'unknown',
    leakProven:false,limitations:LIMITATIONS};
  validateNativeObserverControl(report,nativeReceipt,fixtureSha256);
  return report;
}

export async function saveNativeObserverControl(report,native,fixtureSha256,directory){
  validateNativeObserverControl(report,native,fixtureSha256);
  if(!directory)fail('artifact directory required');
  await mkdir(directory,{recursive:true});
  const filename='stage003-observer-control-'+report.format.toLowerCase()+'.json';
  await writeFile(path.join(directory,filename),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return path.join(directory,filename);
}

export async function verifyNativeObserverControl(controlDir,controlNativeDir,
  treatmentDir,treatmentNativeDir){
  if(!controlDir||!controlNativeDir||!treatmentDir||!treatmentNativeDir)
    fail('control and treatment artifacts both required');
  const allSessions=new Set();
  for(const format of ['PSD16','PSB32']){
    const key=format.toLowerCase();
    const fixture=createBrowserHighDepthFixture(format==='PSD16'?'rgb16nearcap':'rgb32psbnearcap');
    const fixtureSha=hash(Buffer.from(fixture.bytes));
    const control=JSON.parse(await readFile(path.join(controlDir,
      'stage003-observer-control-'+key+'.json'),'utf8'));
    const controlNative=JSON.parse(await readFile(path.join(controlNativeDir,
      'stage003-dense-cancel-'+key+'.json'),'utf8'));
    const treatment=JSON.parse(await readFile(path.join(treatmentDir,
      'stage003-same-session-retention-'+key+'.json'),'utf8'));
    const treatmentNative=JSON.parse(await readFile(path.join(treatmentNativeDir,
      'stage003-dense-cancel-'+key+'.json'),'utf8'));
    validateNativeObserverControl(control,controlNative,fixtureSha);
    validateSameSessionNativeRetention(treatment,treatmentNative,fixtureSha);
    for(const report of [control,treatment]){
      if(allSessions.has(report.sessionId))fail('reused/cross-depth control or treatment session');
      allSessions.add(report.sessionId);
    }
    // Deliberately do NOT subtract sampled RSS across unrelated OS PID incarnations
    // or conclude that an observed treatment excess belongs to native arrays.
  }
  return true;
}
