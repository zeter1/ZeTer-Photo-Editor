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


// The public ZPE decoder intentionally does not expose compositePixelBuffer
// when editable layers exist. Read the raw RGB+A merged planes independently
// from PSD/PSB section lengths to verify every native word without Canvas8.
export function verifyRawPhotoMergedPlanes(bytes,native,version,bitsPerChannel) {
  if(!(bytes instanceof Uint8Array) || bytes.byteLength<40 ||
     ![1,2].includes(version) || ![16,32].includes(bitsPerChannel))
    fail('invalid raw composite input');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u32=offset=>{
    if(offset<0 || offset+4>bytes.length) fail('truncated composite section length');
    return view.getUint32(offset,false);
  };
  let offset=26;
  for(let section=0;section<2;section++) {
    const length=u32(offset);
    offset+=4+length;
    if(!Number.isSafeInteger(offset) || offset>bytes.length)
      fail('invalid color/resources length');
  }
  let maskLength;
  if(version===1) {
    maskLength=u32(offset);
    offset+=4;
  } else {
    const high=u32(offset),low=u32(offset+4);
    maskLength=high*0x100000000+low;
    offset+=8;
  }
  offset+=maskLength;
  if(!Number.isSafeInteger(offset) || offset+2>bytes.length ||
     view.getUint16(offset,false)!==0)
    fail('missing or non-raw high-depth merged composite');
  const pixels=native.width*native.height;
  const sampleBytes=bitsPerChannel/8;
  const planeBytes=pixels*sampleBytes;
  const start=offset+2;
  if(start+planeBytes*4!==bytes.length)
    fail('wrong high-depth merged plane count or payload bounds');
  const actualWord=(position)=>bitsPerChannel===16
    ?view.getUint16(position,false):view.getUint32(position,false);
  const expectedView=new DataView(native.damaged.buffer,
    native.damaged.byteOffset,native.damaged.byteLength);
  const expectedWord=(position)=>bitsPerChannel===16
    ?expectedView.getUint16(position,true):expectedView.getUint32(position,true);
  for(let channel=0;channel<4;channel++) {
    const base=start+channel*planeBytes;
    for(let pixel=0;pixel<pixels;pixel++) {
      if(actualWord(base+pixel*sampleBytes)!==
         expectedWord((pixel*4+channel)*sampleBytes))
        fail('merged plane native word mismatch: channel '+channel+', pixel '+pixel);
    }
  }
  return true;
}

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
  const layer=decoded.layers[0].pixelBuffer;
  if(layer?.width!==native.width || layer?.height!==native.height ||
     layer?.model!=='rgb' || layer?.channels!==4 ||
     layer?.bitsPerChannel!==bitsPerChannel ||
     hashNativeCleanReference(layer.data,bitsPerChannel)!==expectedHash)
    fail('imported layer native words or geometry mismatch');
  verifyRawPhotoMergedPlanes(bytes,native,version,bitsPerChannel);
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
