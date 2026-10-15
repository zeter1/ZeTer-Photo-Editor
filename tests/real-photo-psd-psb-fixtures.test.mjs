import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodePsd,inspectPsdHeader} from '../src/formats/psd.js';
import {inspectPhotoBundleCandidate,admitPhotoBundle}
  from '../tools/real-photo-bundle-admission.mjs';
import {hashNativeCleanReference} from '../tools/real-photo-native-quality.mjs';
import {createVerifiedPhotoDefectDocuments,verifyPhotoDefectDocument}
  from '../tools/real-photo-psd-psb-fixtures.mjs';
import {serializePhotoDefectArtifactEvidence,verifyPhotoDefectArtifactSet}
  from '../tools/real-photo-psd-psb-artifacts.mjs';

// Structural, non-entropy-decodable JPEG surrogate: NOT genuine photo pixels,
// ICC/EXIF review or an Adobe-authored document. Test-only source override.
function surrogate() {
  const width=240,height=240;
  const jpeg=Uint8Array.from([0xff,0xd8,0xff,0xe0,0,4,0,0,
    0xff,0xc0,0,17,8,0,240,0,240,3,1,0x11,0,2,0x11,0,3,0x11,0,
    0xff,0xda,0,8,3,1,0,2,0,3,0,0x01,0x33,0xff,0xd9]);
  const hash=(bytes,alg)=>createHash(alg).update(bytes).digest('hex');
  const rgba=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*4;
    rgba[i]=(x*7+y*13)%256;
    rgba[i+1]=(x*11+y*17)%256;
    rgba[i+2]=(x*19+y*23)%256;
    rgba[i+3]=255;
  }
  const sourcePolicy={page:'https://example.invalid/unit-only',
    license:'CC0-1.0',sha1:hash(jpeg,'sha1'),width,height};
  const decoder={
    tool:'structural-surrogate',version:'1.0',command:'no entropy decoding in unit test',
    exifOrientation:null,orientationApplied:false,iccPolicy:'assumed-sRGB',
    colorEvidence:'Non-photographic RGB unit data; no ICC or EXIF validation',
  };
  const manifest=inspectPhotoBundleCandidate({
    jpeg,rgba,decoder,sourcePolicy,crop:{x:0,y:0,width,height},
  }).manifest;
  return {jpeg,rgba,manifest,sourcePolicy};
}

test('037B2b-3: gated PSD16/PSB32 exports preserve exact native defect and composite words',async()=>{
  const input=surrogate();
  const result=await createVerifiedPhotoDefectDocuments(input);
  assert.equal(result.kind,'zpe-photo-defect-psd-psb-codec-evidence-v1');
  assert.equal(result.status,'zpe-codec-native-roundtrip-only');
  assert.equal(result.sourcePrecisionBits,8);
  assert.equal(result.selectedPixels,8288);
  assert.equal(result.independentDecoderIccExifReviewRequired,true);
  assert.equal(result.photoshopParityVerified,false);
  assert.equal(result.browserBenchmarkVerified,false);
  const admitted=admitPhotoBundle(input);
  for(const [key,bits,version] of [['psd16',16,1],['psb32',32,2]]) {
    const {bytes,proof}=result.documents[key];
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(proof.format,bits===16?'PSD16':'PSB32');
    assert.equal(proof.selectedPixels,8288);
    assert.equal(proof.nativeLayerAndCompositeExact,true);
    assert.equal(proof.unchangedOutsideSelectionAndAlpha,true);
    assert.equal(proof.fileSha256,createHash('sha256').update(bytes).digest('hex'));
    const header=inspectPsdHeader(bytes);
    assert.equal(header.version,version);
    assert.equal(header.bitsPerChannel,bits);
    assert.equal(header.width,240);
    assert.equal(header.height,240);
    const decoded=await decodePsd(bytes);
    const native=bits===16?admitted.fixtures.rgb16:admitted.fixtures.float32;
    const pin=input.manifest.native[bits===16?'rgb16':'float32'].damagedSha256;
    assert.equal(proof.nativeDefectSha256,pin);
    assert.equal(hashNativeCleanReference(decoded.layers[0].pixelBuffer.data,bits),pin);
    assert.equal(decoded.compositePixelBuffer,null,'layered import intentionally does not decode merged preview');
    assert.equal(decoded.layers[0].pixelBuffer.data[3],bits===16?65535:1);
    assert.equal(native.selectedPixels,8288);
  }
});

test('037B2b-3: tampered source, pins, document bytes or native words fail closed',async()=>{
  const input=surrogate();
  const output=await createVerifiedPhotoDefectDocuments(input);
  const admitted=admitPhotoBundle(input);
  const native={...admitted.fixtures.rgb16,
    expectedDamagedSha256:input.manifest.native.rgb16.damagedSha256};
  const bytes=output.documents.psd16.bytes;
  const verify=patch=>verifyPhotoDefectDocument({
    bytes,native,version:1,bitsPerChannel:16,...patch,
  });
  const tampered=bytes.slice();tampered[0]^=1;
  await assert.rejects(verify({bytes:tampered}));
  const compositeMutation=bytes.slice();compositeMutation[compositeMutation.length-1]^=1;
  await assert.rejects(verify({bytes:compositeMutation}),/merged plane native word mismatch/);
  await assert.rejects(verify({version:2}),/037 photo PSD\/PSB/);
  await assert.rejects(verify({native:{...native,expectedDamagedSha256:'0'.repeat(64)}}),
    /native source changed/);
  const damaged=native.damaged.slice();damaged[0]^=1;
  await assert.rejects(verify({native:{...native,damaged}}),/native source changed/);
  const alteredRgba=input.rgba.slice();alteredRgba[0]^=1;
  await assert.rejects(createVerifiedPhotoDefectDocuments({...input,rgba:alteredRgba}));
  await assert.rejects(createVerifiedPhotoDefectDocuments({
    ...input,manifest:{...input.manifest,native:{...input.manifest.native,
      float32:{...input.manifest.native.float32,damagedSha256:'0'.repeat(64)}}},
  }));
  await assert.rejects(createVerifiedPhotoDefectDocuments({
    ...input,manifest:{...input.manifest,photoshopParityVerified:true},
  }));
});

test('037B2b-3b: saved PSD16/PSB32 proof is strict and rechecks every native word',async()=>{
  const input=surrogate(); // NOT genuine JPEG entropy decoding.
  const evidence=await createVerifiedPhotoDefectDocuments(input);
  const artifact=serializePhotoDefectArtifactEvidence(evidence);
  const files={psd16:evidence.documents.psd16.bytes,
    psb32:evidence.documents.psb32.bytes};
  const verify=patch=>verifyPhotoDefectArtifactSet({
    ...input,artifact,files,...patch,
  });
  const ok=await verify();
  assert.equal(ok.status,'saved-zpe-native-artifacts-verified');
  assert.equal(ok.photoshopParityVerified,false);
  assert.equal(ok.browserBenchmarkVerified,false);
  assert.equal(ok.documents.psd16.nativeLayerAndCompositeExact,true);
  assert.equal(ok.documents.psb32.nativeLayerAndCompositeExact,true);

  const editedHash=structuredClone(artifact);
  editedHash.documents.psd16.fileSha256='0'.repeat(64);
  await assert.rejects(verify({artifact:editedHash}),/psd16 proof mismatch: fileSha256/);

  const forgedClaim=structuredClone(artifact);
  forgedClaim.photoshopParityVerified=true;
  await assert.rejects(verify({artifact:forgedClaim}),/artifact summary mismatch/);

  const extraClaim=structuredClone(artifact);
  extraClaim.independentPsdDecoderVerified=true;
  await assert.rejects(verify({artifact:extraClaim}),/invalid artifact fields/);

  const extraProof=structuredClone(artifact);
  extraProof.documents.psb32.qualityScore=1;
  await assert.rejects(verify({artifact:extraProof}),/invalid psb32 proof fields/);

  const corrupted=files.psd16.slice();corrupted[corrupted.length-1]^=1;
  await assert.rejects(verify({files:{...files,psd16:corrupted}}),
    /merged plane native word mismatch/);

  await assert.rejects(verify({files:{...files,psb32:files.psd16}}));
  await assert.rejects(verify({files:{...files,psb32:new Uint8Array()}}),
    /missing saved psb32 bytes/);

  const wrongSource=input.rgba.slice();wrongSource[0]^=1;
  await assert.rejects(verify({rgba:wrongSource}));
});


function addUnreviewedPsdSection(bytes,lengthOffset,payload) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(lengthOffset,false),0,
    'one-layer native defect fixture must not already contain color metadata');
  const forged=new Uint8Array(bytes.length+payload.length);
  forged.set(bytes.subarray(0,lengthOffset+4));
  new DataView(forged.buffer).setUint32(lengthOffset,payload.length,false);
  forged.set(payload,lengthOffset+4);
  forged.set(bytes.subarray(lengthOffset+4),lengthOffset+4+payload.length);
  return forged;
}

test('037B2b-3f: saved PSD16/PSB32 verifier rejects unreviewed color/ICC metadata even if file SHA is repinned',async()=>{
  const input=surrogate(); // synthetic structural pixels, NOT a CC0 JPEG decode.
  const evidence=await createVerifiedPhotoDefectDocuments(input);
  const admitted=admitPhotoBundle(input);
  const artifact=serializePhotoDefectArtifactEvidence(evidence);
  const files={
    psd16:evidence.documents.psd16.bytes,
    psb32:evidence.documents.psb32.bytes,
  };
  // Photoshop 8BIM image resource ID 1039 is ICC. Metadata is intentionally
  // unreviewed, yet original native layer and merged bytes are unchanged.
  const fakeIcc=Uint8Array.of(
    0x38,0x42,0x49,0x4d,0x04,0x0f,0,0,0,0,0,4,1,2,3,4,
  );
  for(const [key,bits,version,reference] of [
    ['psd16',16,1,'rgb16'],
    ['psb32',32,2,'float32'],
  ]) {
    const native={
      ...admitted.fixtures[reference],
      expectedDamagedSha256:input.manifest.native[reference].damagedSha256,
    };
    for(const [label,offset,payload,error] of [
      ['color-mode',26,Uint8Array.of(1,2,3,4),/unexpected color mode data/],
      ['ICC-resource',30,fakeIcc,/unexpected image resources/],
    ]) {
      const forged=addUnreviewedPsdSection(files[key],offset,payload);
      assert.notEqual(
        createHash('sha256').update(forged).digest('hex'),artifact.documents[key].fileSha256,
        label+' really changed PSD/PSB file bytes',
      );
      await assert.rejects(
        verifyPhotoDefectDocument({bytes:forged,native,version,bitsPerChannel:bits}),
        error,key+' must reject '+label+' even when native layer/composite pixels match',
      );
      const repinned=structuredClone(artifact);
      repinned.documents[key].fileSha256=createHash('sha256').update(forged).digest('hex');
      await assert.rejects(
        verifyPhotoDefectArtifactSet({
          ...input,artifact:repinned,files:{...files,[key]:forged},
        }),
        error,key+' saved verify must reject '+label+' despite repinned file hash',
      );
    }
  }
});


// 037B2b-3g: structural mutation offsets are derived from PSD/PSB lengths,
// not from ZeTer's decoded object (which can normalize away raw metadata).
function photoLayerMetadataOffsets(bytes,version) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const size=version===1?4:8;
  const layerCountOffset=26+4+4+size+size+4+8+size;
  assert.equal(view.getInt16(layerCountOffset,false),-1);
  const channelRecordsOffset=layerCountOffset+2+16+2;
  const blendModeOffset=channelRecordsOffset+4*(2+size)+4;
  const extraLengthOffset=blendModeOffset+4+4;
  const extraStart=extraLengthOffset+4;
  const pascalCount=bytes[extraStart+8];
  const unicodeStart=extraStart+8+Math.ceil((1+pascalCount)/4)*4;
  assert.equal(String.fromCharCode(...bytes.subarray(unicodeStart+4,unicodeStart+8)),'luni');
  const unicodeCount=view.getUint32(unicodeStart+12,false);
  const unicodePadding=unicodeStart+16+unicodeCount*2;
  assert.ok(unicodePadding<extraStart+view.getUint32(extraLengthOffset,false));
  return {
    layerCount:layerCountOffset+1,channel:channelRecordsOffset,
    blendMode:blendModeOffset,opacity:extraLengthOffset-4,
    flags:extraLengthOffset-2,mask:extraStart+3,
    blendRanges:extraStart+7,pascalName:extraStart+9,
    unicodeKey:unicodeStart+4,unicodeName:unicodeStart+16,
    unicodePadding,
  };
}

function addUnreviewedLayerMaskTrailer(bytes,version) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const lengthOffset=34,size=version===1?4:8;
  const length=version===1?view.getUint32(lengthOffset,false):
    view.getUint32(lengthOffset+4,false);
  const insertAt=lengthOffset+size+length;
  const forged=new Uint8Array(bytes.length+4);
  forged.set(bytes.subarray(0,insertAt));
  forged.set(bytes.subarray(insertAt),insertAt+4);
  const target=new DataView(forged.buffer);
  if(version===1) target.setUint32(lengthOffset,length+4,false);
  else target.setUint32(lengthOffset+4,length+4,false);
  return forged;
}

test('037B2b-3g: saved PSD16/PSB32 refuse hidden native layer metadata even after file SHA is repinned',async()=>{
  const input=surrogate(); // Structural surrogate, not a real photo.
  const evidence=await createVerifiedPhotoDefectDocuments(input);
  const artifact=serializePhotoDefectArtifactEvidence(evidence);
  const admitted=admitPhotoBundle(input);
  const files={psd16:evidence.documents.psd16.bytes,
    psb32:evidence.documents.psb32.bytes};
  for(const [key,version,bits,reference] of [
    ['psd16',1,16,'rgb16'],['psb32',2,32,'float32'],
  ]) {
    const bytes=files[key];
    const offsets=photoLayerMetadataOffsets(bytes,version);
    const native={...admitted.fixtures[reference],
      expectedDamagedSha256:input.manifest.native[reference].damagedSha256};
    const corruptions=[
      ...Object.entries(offsets).map(([label,offset])=>[label,()=>{
        const changed=bytes.slice();changed[offset]^=1;return changed;
      }]),
      ['extra-high-depth-tag',()=>addUnreviewedLayerMaskTrailer(bytes,version)],
    ];
    for(const [label,corrupt] of corruptions) {
      const forged=corrupt();
      const repinned=structuredClone(artifact);
      repinned.documents[key].fileSha256=createHash('sha256').update(forged).digest('hex');
      await assert.rejects(
        verifyPhotoDefectDocument({bytes:forged,native,version,bitsPerChannel:bits}),
        /037 photo PSD.*PSB:/,
        key+' must reject raw '+label+' with native pixels unchanged',
      );
      await assert.rejects(
        verifyPhotoDefectArtifactSet({...input,artifact:repinned,
          files:{...files,[key]:forged}}),
        /037 photo PSD.*PSB:/,
        key+' saved artifact must reject '+label+' after repinning file SHA',
      );
    }
  }
});
