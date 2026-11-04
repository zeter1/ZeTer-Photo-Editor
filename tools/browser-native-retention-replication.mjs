// 003T/4b-2: strict per-replica matched native treatment/control evidence.
// Fresh Chromium sessions cannot be compared by absolute RSS or assigned
// to a native allocation owner. Retain even inconvenient unknown windows.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createBrowserHighDepthFixture} from './browser-high-depth-fixtures.mjs';
import {validateNativeObserverControl} from './browser-native-observer-control.mjs';
import {validateSameSessionNativeRetention} from './browser-same-session-native-retention.mjs';

const fail=message=>{throw new TypeError('003T/4b-2 replication: '+message);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const FORMATS=['PSD16','PSB32'];
const stat=comps=>{
  const result={comparablePositive:0,comparableZero:0,comparableNegative:0,unknown:0};
  for(const {comparison} of comps){
    if(comparison.availability==='unknown' && comparison.deltaBytes===null){
      result.unknown++;
    }else if(comparison.availability==='sampled-comparable-only' &&
             Number.isSafeInteger(comparison.deltaBytes)){
      if(comparison.deltaBytes>0)result.comparablePositive++;
      else if(comparison.deltaBytes<0)result.comparableNegative++;
      else result.comparableZero++;
    }else fail('invalid observed/unknown comparison');
  }
  return result;
};

// Only call this function on reports checked against genuine native receipts
// by validateNativeObserverControl / validateSameSessionNativeRetention.
export function summarizeReplicatedNativeSessions(pairs) {
  if(!Array.isArray(pairs)||pairs.length!==2 ||
     pairs.map(p=>p?.format).join(',')!=='PSD16,PSB32')
    fail('requires exact PSD16 and PSB32 matched pairs');
  const seen=new Set();
  const summaries=[];
  for(const {format,control,treatment} of pairs){
    if(control?.format!==format||treatment?.format!==format ||
       control.kind!=='zpe-native-observer-control-v1' ||
       treatment.kind!=='zpe-native-same-session-retention-v1' ||
       control.fixtureSha256!==treatment.fixtureSha256 ||
       control.nativeReceiptSha256===undefined||
       treatment.nativeReceiptSha256===undefined ||
       control.noAdditionalFill!==true ||
       control.trueOperationPeakKnown!==false ||
       treatment.trueOperationPeakKnown!==false ||
       control.leakProven!==false || treatment.leakProven!==false ||
       control.workerPidMapping!=='unknown' || treatment.workerPidMapping!=='unknown' ||
       !Array.isArray(control.comparisons)||control.comparisons.length!==2||
       !Array.isArray(treatment.comparisons)||treatment.comparisons.length!==2)
      fail('invalid or cross-depth evidence or unsupported causal claim');
    for(const r of [control,treatment]){
      if(typeof r.sessionId!=='string'||!r.sessionId ||seen.has(r.sessionId))
        fail('reused/missing Chromium session');
      seen.add(r.sessionId);
    }
    summaries.push({format,controlSessionId:control.sessionId,
      treatmentSessionId:treatment.sessionId,
      observerOnly:stat(control.comparisons),withNativeFill:stat(treatment.comparisons)});
  }
  return {kind:'zpe-native-retention-matched-replica-v1',
    depthCount:2,sessionCount:4,perDepth:summaries,
    comparisonScope:'within-session-sampled-endpoints-only',
    causalOwner:'not-established',leakProven:false,
    trueOperationPeakKnown:false,workerPidMapping:'unknown'};
}

export async function verifyReplicatedNativeSessions(root){
  if(typeof root!=='string'||!root)fail('artifact root required');
  const pairs=[];
  for(const format of FORMATS){
    const key=format.toLowerCase();
    const fixture=createBrowserHighDepthFixture(format==='PSD16'?'rgb16nearcap':'rgb32psbnearcap');
    const expectedHash=hash(Buffer.from(fixture.bytes));
    const load=async(dir,prefix)=>JSON.parse(await readFile(path.join(root,dir,
      'stage003-'+prefix+'-'+key+'.json'),'utf8'));
    const control=await load('control','observer-control');
    const controlNative=await load('control-native','dense-cancel');
    const treatment=await load('treatment','same-session-retention');
    const treatmentNative=await load('treatment-native','dense-cancel');
    validateNativeObserverControl(control,controlNative,expectedHash);
    validateSameSessionNativeRetention(treatment,treatmentNative,expectedHash);
    pairs.push({format,control,treatment});
  }
  return summarizeReplicatedNativeSessions(pairs);
}
