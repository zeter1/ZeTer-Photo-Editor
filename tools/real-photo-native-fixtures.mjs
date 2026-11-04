// 037B2a: deterministic bridge from an independently pinned RGBA8 photo decode
// to two distinct native clean/defect references. This is test-only preparation:
// RGB16/Float32 are DERIVED FROM 8-BIT pixels, NOT high-depth photo capture,
// Adobe-authored data, or evidence that a particular JPEG/ICC decoder is correct.
import {hashNativeCleanReference} from './real-photo-native-quality.mjs';
import {verifyPinnedDecodedRgba} from './real-photo-source-integrity.mjs';
import {createWideConnectedRoiIndices} from './browser-wide-connected-native-evidence.mjs';

const SHA256=/^[0-9a-f]{64}$/;
const fail=reason=>{throw new TypeError('037 photo native fixture: '+reason);};
const MAX_DECODE_PIXELS=10_000_000;
const MAX_CROP_PIXELS=2_000_000;

function derive({
  rgba,width,height,expectedRgbaSha256,bitsPerChannel,
  cropX=0,cropY=0,cropWidth=1025,cropHeight=1025,
}={}) {
  // The source JPEG SHA-256, license, orientation and color-space checks must
  // be performed independently before this RGBA8 input can be called a photo.
  // A hash calculated here is only a candidate until pinned outside this tool.
  if (![width,height,cropX,cropY,cropWidth,cropHeight].every(Number.isSafeInteger) ||
      width*height>MAX_DECODE_PIXELS ||
      cropX<0 || cropY<0 || cropWidth<240 || cropHeight<240 ||
      cropX+cropWidth>width || cropY+cropHeight>height ||
      cropWidth*cropHeight>MAX_CROP_PIXELS ||
      ![16,32].includes(bitsPerChannel)) {
    fail('invalid native format, bounded crop, or dimensions');
  }
  verifyPinnedDecodedRgba(rgba,{width,height,expectedRgbaSha256});
  const Type=bitsPerChannel===16?Uint16Array:Float32Array;
  const clean=new Type(cropWidth*cropHeight*4);
  // Stable row-major crop; do NOT route through display Canvas or scale pixels.
  for(let y=0;y<cropHeight;y++) for(let x=0;x<cropWidth;x++) {
    const src=((cropY+y)*width+cropX+x)*4;
    const dst=(y*cropWidth+x)*4;
    for(let channel=0;channel<3;channel++) {
      const byte=rgba[src+channel];
      clean[dst+channel]=bitsPerChannel===16?byte*257:Math.fround(byte/255);
    }
    clean[dst+3]=bitsPerChannel===16?65535:1;
  }
  const roiX=Math.floor((cropWidth-240)/2);
  const roiY=Math.floor((cropHeight-240)/2);
  const selectedIndices=createWideConnectedRoiIndices(cropWidth,cropHeight,{x:roiX,y:roiY});
  if(selectedIndices.length!==8288) fail('unexpected connected ROI topology');
  // Fresh native snapshot: only color words of the exact 8288 frozen indices
  // are contaminated. Alpha and all pixels outside selection are byte-exact.
  const damaged=clean.slice();
  for(const index of selectedIndices) {
    const offset=index*4;
    for(let channel=0;channel<3;channel++) {
      const word=clean[offset+channel];
      damaged[offset+channel]=bitsPerChannel===16
        ? word^0xffff : Math.fround(word+1);
    }
  }
  return {
    kind:'zpe-real-photo-native-candidate-v1',
    admitted:false,width:cropWidth,height:cropHeight,
    channels:4,alphaChannel:3,bitsPerChannel,
    colorSpace:bitsPerChannel===16?'srgb-from-rgba8':'srgb-normalized-from-rgba8',
    sourcePrecisionBits:8,sourceDecodedRgbaSha256:expectedRgbaSha256,
    crop:{x:cropX,y:cropY,width:cropWidth,height:cropHeight},
    roiOrigin:{x:roiX,y:roiY},
    selectedPixels:selectedIndices.length,selectedIndices,
    clean,damaged,
    referenceCandidateSha256:hashNativeCleanReference(clean,bitsPerChannel),
  };
}

// Candidate inspection never confers fixture admission. Record this digest in
// a separately reviewed/pinned manifest BEFORE the admission/benchmark step.
export function preparePhotoNativeFixtureCandidate(options) {
  return derive(options);
}

export function createPinnedPhotoNativeFixture(options={}) {
  const expectedReferenceSha256=options?.expectedReferenceSha256;
  if(!SHA256.test(expectedReferenceSha256??'')) fail('independently pinned native reference SHA-256 required');
  const candidate=derive(options);
  if(candidate.referenceCandidateSha256!==expectedReferenceSha256)
    fail('native clean reference SHA-256 mismatch');
  return {
    ...candidate,
    kind:'zpe-real-photo-pinned-native-fixture-v1',
    admitted:true,referenceNativeSha256:expectedReferenceSha256,
  };
}
