// 037B2b: offline, fail-closed admission of a real-photo *candidate* to
// test-only native fixtures. All hashes are over original bytes / decoded
// row-major RGBA8 / canonical LE native words, never a display Canvas.
// JPEG entropy decoding, EXIF normalization and ICC conversion are externally
// performed and reviewed, NOT proven by this module.
import {createHash} from 'node:crypto';
import {inspectPhotoJpeg,verifyPinnedPhotoJpeg,verifyPinnedDecodedRgba}
  from './real-photo-source-integrity.mjs';
import {preparePhotoNativeFixtureCandidate,createPinnedPhotoNativeFixture}
  from './real-photo-native-fixtures.mjs';
import {hashNativeCleanReference} from './real-photo-native-quality.mjs';

export const REAL_PHOTO_SOURCE=Object.freeze({
  page:'https://commons.wikimedia.org/wiki/File:Red-brick-wall-texture-clean.jpg',
  license:'CC0-1.0',
  sha1:'c7fc9f013c70e01f164d232462ddd6e37e4079c4',
  width:2560,height:1920,
});
export const PHOTO_BUNDLE_KIND='zpe-real-photo-bundle-manifest-v1';
const SHA256=/^[0-9a-f]{64}$/;
const fail=reason=>{throw new TypeError('037 photo bundle: '+reason);};
const record=value=>value!==null && typeof value==='object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;
function fields(value,names,label) {
  if(!record(value) || Object.keys(value).sort().join(',')!==[...names].sort().join(','))
    fail('invalid '+label+' fields');
}
const hex=value=>SHA256.test(value??'');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function validateDecoder(decoder,source) {
  fields(decoder,['tool','version','command','exifOrientation','orientationApplied',
    'iccPolicy','colorEvidence'],'decoder provenance');
  if(![decoder.tool,decoder.version,decoder.command,decoder.colorEvidence].every(
    value=>typeof value==='string' && value.trim().length>=3 && value.length<=2048))
    fail('missing decoder tool/version/command/color evidence');
  if(!(decoder.exifOrientation===null ||
       (Number.isSafeInteger(decoder.exifOrientation) &&
        decoder.exifOrientation>=1 && decoder.exifOrientation<=8)) ||
      typeof decoder.orientationApplied!=='boolean' ||
      !['embedded-ICC-to-sRGB','assumed-sRGB'].includes(decoder.iccPolicy))
    fail('invalid EXIF/ICC declaration');
  // Header flags are not sufficient evidence of color correctness or
  // EXIF orientation values. But declarations must not contradict them.
  if(source.hasExif && decoder.exifOrientation===null)
    fail('EXIF present but orientation not recorded');
  if(!source.hasExif && decoder.exifOrientation!==null)
    fail('EXIF orientation declared without EXIF');
  if(source.hasIcc!== (decoder.iccPolicy==='embedded-ICC-to-sRGB'))
    fail('ICC marker and color policy disagree');
  if(decoder.exifOrientation!==null && decoder.exifOrientation!==1 &&
     !decoder.orientationApplied)
    fail('non-identity EXIF orientation not applied');
}
function validateCrop(crop,width,height) {
  fields(crop,['x','y','width','height'],'crop');
  if(![crop.x,crop.y,crop.width,crop.height].every(Number.isSafeInteger) ||
     crop.x<0 || crop.y<0 || crop.width<240 || crop.height<240 ||
     crop.x+crop.width>width || crop.y+crop.height>height ||
     crop.width*crop.height>2_000_000)
    fail('invalid crop geometry');
}
function validatePolicy(policy) {
  fields(policy,['page','license','sha1','width','height'],'source policy');
  if(typeof policy.page!=='string' || policy.license!=='CC0-1.0' ||
     !/^[0-9a-f]{40}$/.test(policy.sha1) ||
     ![policy.width,policy.height].every(n=>Number.isSafeInteger(n)&&n>=240&&n<=10000))
    fail('invalid pinned source policy');
}
function sourceArgs(policy) {
  return {expectedSha1:policy.sha1,expectedWidth:policy.width,
    expectedHeight:policy.height};
}
function nativeOptions(rgba,manifest,bitsPerChannel) {
  const {x,y,width,height}=manifest.crop;
  return {rgba,width:manifest.decoded.width,height:manifest.decoded.height,
    expectedRgbaSha256:manifest.decoded.sha256,bitsPerChannel,
    cropX:x,cropY:y,cropWidth:width,cropHeight:height};
}
function prepareBoth(rgba,manifest) {
  const rgb16=preparePhotoNativeFixtureCandidate(nativeOptions(rgba,manifest,16));
  const float32=preparePhotoNativeFixtureCandidate(nativeOptions(rgba,manifest,32));
  return {rgb16,float32};
}
function nativePins(candidate) {
  return {cleanSha256:candidate.referenceCandidateSha256,
    damagedSha256:hashNativeCleanReference(candidate.damaged,candidate.bitsPerChannel)};
}
// Produces hashes for OUT-OF-BAND REVIEW, never admission. A decoder must
// already have provided the exact raw RGBA8 bytes; JPEG header parsing is
// expressly not a substitute for entropy/color decoding.
export function inspectPhotoBundleCandidate({
  jpeg,rgba,decoder,crop={x:0,y:0,width:1025,height:1025},
  sourcePolicy=REAL_PHOTO_SOURCE,
}={}) {
  validatePolicy(sourcePolicy);
  const source=inspectPhotoJpeg(jpeg,sourceArgs(sourcePolicy));
  validateDecoder(decoder,source);
  validateCrop(crop,source.width,source.height);
  if(!(rgba instanceof Uint8Array)) fail('decoded RGBA8 bytes required');
  const decodedSha=digest(rgba);
  verifyPinnedDecodedRgba(rgba,{
    width:source.width,height:source.height,expectedRgbaSha256:decodedSha,
  });
  const manifest={
    kind:PHOTO_BUNDLE_KIND,
    sourceSha256:source.sha256,
    decoded:{sha256:decodedSha,width:source.width,height:source.height,pixelFormat:'RGBA8'},
    decoder:{...decoder},
    crop:{...crop},
    native:{},
  };
  const fixtures=prepareBoth(rgba,manifest);
  manifest.native={rgb16:nativePins(fixtures.rgb16),
    float32:nativePins(fixtures.float32)};
  return {status:'candidate-unpinned-not-admitted',manifest,
    warning:'Review independently: JPEG entropy decode, EXIF, ICC, original+RGBA8+native pins. No photo benchmark or Photoshop parity.'};
}

// Only a previously pinned manifest is admitted. Caller may inject a fixture
// source policy for unit tests; the public CLI intentionally NEVER exposes
// this override and uses REAL_PHOTO_SOURCE only.
export function admitPhotoBundle({jpeg,rgba,manifest,sourcePolicy=REAL_PHOTO_SOURCE}={}) {
  validatePolicy(sourcePolicy);
  fields(manifest,['kind','sourceSha256','decoded','decoder','crop','native'],'manifest');
  if(manifest.kind!==PHOTO_BUNDLE_KIND || !hex(manifest.sourceSha256))
    fail('invalid manifest kind or pinned original SHA-256');
  fields(manifest.decoded,['sha256','width','height','pixelFormat'],'decoded');
  if(!hex(manifest.decoded.sha256) || manifest.decoded.pixelFormat!=='RGBA8' ||
     manifest.decoded.width!==sourcePolicy.width ||
     manifest.decoded.height!==sourcePolicy.height)
    fail('invalid pinned RGBA8 geometry or digest');
  validateCrop(manifest.crop,manifest.decoded.width,manifest.decoded.height);
  fields(manifest.native,['rgb16','float32'],'native pins');
  for(const name of ['rgb16','float32']) {
    fields(manifest.native[name],['cleanSha256','damagedSha256'],name+' pins');
    if(!hex(manifest.native[name].cleanSha256) ||
       !hex(manifest.native[name].damagedSha256))
      fail('missing reviewed clean/defect native SHA-256 for '+name);
  }
  const source=verifyPinnedPhotoJpeg(jpeg,{
    ...sourceArgs(sourcePolicy),expectedSha256:manifest.sourceSha256,
  });
  validateDecoder(manifest.decoder,source);
  const decoded=verifyPinnedDecodedRgba(rgba,{
    width:manifest.decoded.width,height:manifest.decoded.height,
    expectedRgbaSha256:manifest.decoded.sha256,
  });
  const rgb16=createPinnedPhotoNativeFixture({
    ...nativeOptions(rgba,manifest,16),
    expectedReferenceSha256:manifest.native.rgb16.cleanSha256,
  });
  const float32=createPinnedPhotoNativeFixture({
    ...nativeOptions(rgba,manifest,32),
    expectedReferenceSha256:manifest.native.float32.cleanSha256,
  });
  for(const [name,fixture] of [['rgb16',rgb16],['float32',float32]]) {
    if(hashNativeCleanReference(fixture.damaged,fixture.bitsPerChannel)!==
       manifest.native[name].damagedSha256)
      fail(name+' native defect SHA-256 mismatch');
    if(fixture.selectedPixels!==8288 || fixture.sourcePrecisionBits!==8)
      fail('invalid connected ROI or precision');
  }
  return {
    kind:'zpe-real-photo-byte-integrity-evidence-v1',
    status:'pinned-byte-integrity-verified',
    originalSha256:source.sha256,decodedRgbaSha256:decoded.sha256,
    rgb16CleanSha256:rgb16.referenceNativeSha256,
    float32CleanSha256:float32.referenceNativeSha256,
    selectedPixels:8288,sourcePrecisionBits:8,
    independentDecoderIccExifReviewRequired:true,
    photoshopParityVerified:false,browserBenchmarkVerified:false,
    fixtures:{rgb16,float32},
  };
}
