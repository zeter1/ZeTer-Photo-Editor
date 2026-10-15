// 037B2b-2e: network acquisition of the *documented* CC0 original only.
// This is a source candidate, never an independently reviewed benchmark pin.
import {publishExclusivePhotoCandidate} from './photo-source-publication.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectPhotoJpeg} from './real-photo-source-integrity.mjs';

export const ORIGINAL_PHOTO_URL=
  'https://upload.wikimedia.org/wikipedia/commons/a/a8/Red-brick-wall-texture-clean.jpg';
export const ORIGINAL_PHOTO_POLICY=Object.freeze({
  expectedSha1:'c7fc9f013c70e01f164d232462ddd6e37e4079c4',
  expectedWidth:2560,
  expectedHeight:1920,
});
const MAX_BYTES=32*1024*1024;
const fail=reason=>{throw new TypeError('037 photo acquisition: '+reason);};

// Narrow transport boundary. Tests can inject a synthetic source policy, but
// the user-facing CLI and downloadPhotoSourceCandidate ALWAYS use the pinned one.
export async function readPhotoSourceResponse(response,policy=ORIGINAL_PHOTO_POLICY) {
  if(!response || response.status!==200 || response.redirected ||
      !response.headers || !response.body) fail('expected direct HTTP 200 JPEG without redirects');
  const type=response.headers.get('content-type');
  if(typeof type!=='string' || !/^image\/jpeg(?:\s*;|$)/i.test(type))
    fail('unexpected content type');
  const length=response.headers.get('content-length');
  if(length!==null &&
      (!/^[1-9]\d*$/.test(length) || Number(length)>MAX_BYTES))
    fail('invalid or oversized Content-Length');
  const chunks=[];
  let total=0;
  for await(const chunk of response.body) {
    if(!(chunk instanceof Uint8Array)) fail('invalid response chunk');
    total+=chunk.byteLength;
    if(total>MAX_BYTES) fail('download exceeds 32 MiB safety limit');
    chunks.push(chunk);
  }
  if(!total || (length!==null && total!==Number(length)))
    fail('empty or truncated JPEG response');
  const bytes=Buffer.concat(chunks,total);
  // SHA-1, JPEG SOF, EXIF and ICC structure are verified before any disk write.
  const inspection=inspectPhotoJpeg(bytes,policy);
  return {bytes,inspection};
}

export async function downloadPhotoSourceCandidate(path,{fetcher=globalThis.fetch}={}) {
  if(typeof path!=='string' || !path.trim() || typeof fetcher!=='function')
    fail('provide one new output file path');
  const response=await fetcher(ORIGINAL_PHOTO_URL,{
    method:'GET',
    redirect:'error',
    signal:AbortSignal.timeout(30000),
    headers:{Accept:'image/jpeg'},
  });
  const {bytes,inspection}=await readPhotoSourceResponse(response);
  // Exclusive creation and fd-pinned write rollback: collisions or failed
  // writes cannot overwrite an unrelated file or leave our partial candidate.
  await publishExclusivePhotoCandidate(path,bytes);
  return Object.freeze({
    status:'source-candidate-unreviewed',
    source:ORIGINAL_PHOTO_URL,
    licenseClaim:'CC0-1.0; independently review Commons source and license history',
    sha1:inspection.sha1,
    sha256Candidate:inspection.sha256,
    width:inspection.width,
    height:inspection.height,
    bytes:inspection.bytes,
    hasExif:inspection.hasExif,
    exifOrientation:inspection.exifOrientation,
    hasIcc:inspection.hasIcc,
    pixelDecodeVerified:false,
    colorSpaceVerified:false,
    sha256Pinned:false,
    realPhotoBenchmarkVerified:false,
    photoshopParityVerified:false,
    independentReviewRequired:true,
  });
}

if(process.argv[1] &&
    import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.argv.length!==3) {
    console.error('Usage: node tools/fetch-real-photo-source.mjs <NEW-original.jpg>');
    process.exitCode=2;
  } else {
    try {
      const evidence=await downloadPhotoSourceCandidate(process.argv[2]);
      console.log(JSON.stringify(evidence,null,2));
    } catch(error) {
      console.error(String(error));
      process.exitCode=1;
    }
  }
}
