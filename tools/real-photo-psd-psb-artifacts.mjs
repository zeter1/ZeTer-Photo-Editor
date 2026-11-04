// 037B2b-3b: verify ON-DISK ZeTer photo defect PSD16/PSB32 artifacts.
// This is a self-codec/native byte-integrity gate, NOT a Photoshop reader,
// a verified JPEG entropy decode or real-photo browser quality evidence.
import {admitPhotoBundle,REAL_PHOTO_SOURCE} from './real-photo-bundle-admission.mjs';
import {verifyPhotoDefectDocument} from './real-photo-psd-psb-fixtures.mjs';

export const PHOTO_DEFECT_ARTIFACT_FILE='codec-evidence.json';
const fail=message=>{throw new TypeError('037 photo artifact: '+message);};
const isRecord=value=>value!==null && typeof value==='object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;
function exactFields(value,expected,label) {
  if(!isRecord(value) ||
     Object.keys(value).sort().join(',')!==[...expected].sort().join(','))
    fail('invalid '+label+' fields');
}
function matchFields(actual,expected,label) {
  exactFields(actual,Object.keys(expected),label);
  for(const [key,value] of Object.entries(expected))
    if(actual[key]!==value) fail(label+' mismatch: '+key);
}

// Persist the SAME already-computed codec proof as a read-only evidence record.
// Never re-label a candidate or a self-codec proof as independently reviewed.
export function serializePhotoDefectArtifactEvidence(evidence) {
  if(!isRecord(evidence) || !isRecord(evidence.documents))
    fail('missing verified codec evidence');
  const {documents,...summary}=evidence;
  if(!isRecord(documents.psd16?.proof) || !isRecord(documents.psb32?.proof))
    fail('missing PSD16/PSB32 proofs');
  return {...summary,documents:{
    psd16:{...documents.psd16.proof},
    psb32:{...documents.psb32.proof},
  }};
}

// Re-admit independently pinned JPEG, decoded RGBA8 and native LE references,
// then decode the SAVED PSD and PSB files (not new exports) and check every
// native layer + merged composite word, ROI and exact file hashes.
export async function verifyPhotoDefectArtifactSet({
  jpeg,rgba,manifest,artifact,files,sourcePolicy=REAL_PHOTO_SOURCE,
}={}) {
  const admitted=admitPhotoBundle({jpeg,rgba,manifest,sourcePolicy});
  const summary={
    kind:'zpe-photo-defect-psd-psb-codec-evidence-v1',
    status:'zpe-codec-native-roundtrip-only',
    originalSha256:admitted.originalSha256,
    decodedRgbaSha256:admitted.decodedRgbaSha256,
    sourcePrecisionBits:8,
    selectedPixels:8288,
    independentDecoderIccExifReviewRequired:true,
    photoshopParityVerified:false,
    browserBenchmarkVerified:false,
  };
  exactFields(artifact,[...Object.keys(summary),'documents'],'artifact');
  for(const [key,value] of Object.entries(summary))
    if(artifact[key]!==value) fail('artifact summary mismatch: '+key);
  exactFields(artifact.documents,['psd16','psb32'],'document proofs');
  exactFields(files,['psd16','psb32'],'saved document files');
  const checked={};
  for(const [key,bits,version,reference] of [
    ['psd16',16,1,'rgb16'],['psb32',32,2,'float32'],
  ]) {
    if(!(files[key] instanceof Uint8Array) || files[key].byteLength===0)
      fail('missing saved '+key+' bytes');
    const native={...admitted.fixtures[reference],
      expectedDamagedSha256:manifest.native[reference].damagedSha256};
    const proof=await verifyPhotoDefectDocument({
      bytes:files[key],native,version,bitsPerChannel:bits,
    });
    matchFields(artifact.documents[key],proof,key+' proof');
    checked[key]=proof;
  }
  return {
    status:'saved-zpe-native-artifacts-verified',
    independentDecoderIccExifReviewRequired:true,
    photoshopParityVerified:false,
    browserBenchmarkVerified:false,
    documents:checked,
  };
}
