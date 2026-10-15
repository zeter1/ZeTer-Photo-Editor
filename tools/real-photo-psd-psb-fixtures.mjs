// 037B2b-3 (preparatory): fail-closed ZPE PSD16/PSB32 defect documents
// from a previously pinned offline RGBA8/native bundle. No Adobe goldens,
// genuine photo source review, or browser benchmark is implied by codec parity.
import {createHash} from 'node:crypto';
import {admitPhotoBundle,REAL_PHOTO_SOURCE} from './real-photo-bundle-admission.mjs';
import {hashNativeCleanReference,measureRealPhotoNativeQuality}
  from './real-photo-native-quality.mjs';
import {createPixelBuffer} from '../src/core/pixel-buffer.js';
import {encodePsd,encodePsb,decodePsd,inspectPsdHeader} from '../src/formats/psd.js';

const fail=reason=>{throw new TypeError('037 photo PSD/PSB: '+reason);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const formats=Object.freeze([
  {key:'psd16',version:1,bitsPerChannel:16,encode:encodePsd},
  {key:'psb32',version:2,bitsPerChannel:32,encode:encodePsb},
]);

// Check the entire native layer AND merged composite, not an 8-bit preview.
// This is a ZPE writer -> ZPE reader consistency gate, not an independent PSD oracle.
export async function verifyPhotoDefectDocument({bytes,native,version,bitsPerChannel}={}) {
  if(!(bytes instanceof Uint8Array) ||
     !native || native.admitted!==true || native.sourcePrecisionBits!==8 ||
     native.bitsPerChannel!==bitsPerChannel ||
     ![16,32].includes(bitsPerChannel) ||
     !((version===1 && bitsPerChannel===16)||(version===2 && bitsPerChannel===32)) ||
     native.selectedPixels!==8288 || native.selectedIndices?.length!==8288 ||
     native.width*native.height*4!==native.damaged?.length ||
     native.clean?.length!==native.damaged.length)
    fail('invalid admitted native source or PSD/PSB format');
  const expectedHash=hashNativeCleanReference(native.damaged,bitsPerChannel);
  if(expectedHash!==native.expectedDamagedSha256 ||
     hashNativeCleanReference(native.clean,bitsPerChannel)!==native.referenceNativeSha256)
    fail('native source changed after admission');
  const header=inspectPsdHeader(bytes);
  if(header.version!==version || header.bitsPerChannel!==bitsPerChannel ||
     header.colorMode!==3 || header.channels!==4 ||
     header.width!==native.width || header.height!==native.height)
    fail('unexpected PSD/PSB header, dimensions, depth or color mode');
  const decoded=await decodePsd(bytes,{maxPixels:2_000_000,maxLayers:4});
  if(decoded.layers?.length!==1 || decoded.groups?.length ||
     decoded.layers[0]?.name!=='Pinned photo defect (8-bit derived)')
    fail('unexpected layer tree');
  for(const [name,buffer] of [
    ['layer',decoded.layers[0].pixelBuffer],
    ['merged',decoded.compositePixelBuffer],
  ]) {
    const exact=buffer?.data &&
      hashNativeCleanReference(buffer.data,bitsPerChannel)===expectedHash;
    if(buffer?.width!==native.width || buffer?.height!==native.height ||
       buffer?.model!=='rgb' || buffer?.channels!==4 ||
       buffer?.bitsPerChannel!==bitsPerChannel || !exact)
      fail(name+' changed native words or geometry: '+JSON.stringify({
        width:buffer?.width,height:buffer?.height,model:buffer?.model,
        channels:buffer?.channels,depth:buffer?.bitsPerChannel,
        hash:buffer?.data?hashNativeCleanReference(buffer.data,bitsPerChannel):null,
        expectedHash,
      }));
  }
  const quality=measureRealPhotoNativeQuality({
    before:decoded.layers[0].pixelBuffer.data,after:native.clean.slice(),
    clean:native.clean,selectedIndices:native.selectedIndices,bitsPerChannel,
    expectedReferenceSha256:native.referenceNativeSha256,
  });
  if(quality.selectedPixels!==8288 ||
     quality.outsideSelectionAndAlphaNativeWordsExact!==true ||
     quality.changedSelectedPixels!==8288 ||
     quality.baseline.mae<=0 || quality.repaired.mae!==0)
    fail('ROI or nonselection/alpha integrity mismatch');
  return {
    format:version===1?'PSD16':'PSB32',fileSha256:sha(bytes),
    nativeDefectSha256:expectedHash,selectedPixels:quality.selectedPixels,
    nativeLayerAndCompositeExact:true,
    unchangedOutsideSelectionAndAlpha:true,
  };
}

export async function createVerifiedPhotoDefectDocuments({
  jpeg,rgba,manifest,sourcePolicy=REAL_PHOTO_SOURCE,
}={}) {
  // Public CLI never exposes sourcePolicy. Override exists only for the explicitly
  // non-photo structural unit surrogate in tests.
  const admitted=admitPhotoBundle({jpeg,rgba,manifest,sourcePolicy});
  const documents={};
  for(const format of formats) {
    const native=format.bitsPerChannel===16
      ?admitted.fixtures.rgb16:admitted.fixtures.float32;
    // A fresh typed array avoids writer mutation affecting the pinned oracle.
    const pixelBuffer=createPixelBuffer({
      width:native.width,height:native.height,model:'rgb',channels:4,
      bitsPerChannel:format.bitsPerChannel,colorSpace:'srgb',
      data:native.damaged.slice(),
    });
    const bytes=format.encode({
      width:native.width,height:native.height,colorMode:'rgb',
      bitsPerChannel:format.bitsPerChannel,compositePixelBuffer:pixelBuffer,
      layers:[{
        name:'Pinned photo defect (8-bit derived)',x:0,y:0,
        width:native.width,height:native.height,pixelBuffer,
        visible:true,opacity:1,blendMode:'source-over',
      }],
    });
    const proof=await verifyPhotoDefectDocument({
      bytes,native:{...native,expectedDamagedSha256:
        manifest.native[format.bitsPerChannel===16?'rgb16':'float32'].damagedSha256},
      version:format.version,bitsPerChannel:format.bitsPerChannel,
    });
    documents[format.key]={bytes,proof};
  }
  return {
    kind:'zpe-photo-defect-psd-psb-codec-evidence-v1',
    status:'zpe-codec-native-roundtrip-only',
    originalSha256:admitted.originalSha256,
    decodedRgbaSha256:admitted.decodedRgbaSha256,
    sourcePrecisionBits:8,selectedPixels:8288,
    independentDecoderIccExifReviewRequired:true,
    photoshopParityVerified:false,browserBenchmarkVerified:false,
    documents,
  };
}
