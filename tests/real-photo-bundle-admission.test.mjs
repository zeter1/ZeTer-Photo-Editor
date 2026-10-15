import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  inspectPhotoBundleCandidate,admitPhotoBundle,PHOTO_BUNDLE_KIND,
} from '../tools/real-photo-bundle-admission.mjs';
import {hashNativeCleanReference} from '../tools/real-photo-native-quality.mjs';

// A structural JPEG surrogate: NOT entropy decodable, NOT a photograph,
// NOT real EXIF/ICC provenance. Source-policy override is unit-test-only;
// the CLI always uses the separately documented Commons SHA-1.
function jpeg(width=240,height=240) {
  return Uint8Array.from([0xff,0xd8,0xff,0xe0,0,4,0,0,
    0xff,0xc0,0,17,8,height>>8,height&255,width>>8,width&255,3,
    1,0x11,0,2,0x11,0,3,0x11,0,
    0xff,0xda,0,8,3,1,0,2,0,3,0,0x01,0x33,0xff,0xd9]);
}
const hash=(buffer,algorithm)=>createHash(algorithm).update(buffer).digest('hex');
function scenario() {
  const width=240,height=240,source=jpeg();
  const rgba=new Uint8Array(width*height*4);
  for(let i=0;i<width*height;i++) {
    rgba[i*4]=(i*13)%256;
    rgba[i*4+1]=(i*7+29)%256;
    rgba[i*4+2]=(i*37+11)%256;
    rgba[i*4+3]=255;
  }
  const sourcePolicy={page:'https://example.invalid/unit-only',
    license:'CC0-1.0',sha1:hash(source,'sha1'),width,height};
  const decoder={
    tool:'unit-surrogate',version:'1.0.0',command:'none; structural JPEG only',
    exifOrientation:null,orientationApplied:false,iccPolicy:'assumed-sRGB',
    colorEvidence:'No color verified: deliberately non-decodable structural unit surrogate',
  };
  const crop={x:0,y:0,width,height};
  return {jpeg:source,rgba,decoder,sourcePolicy,crop};
}
function candidate(s) {
  return inspectPhotoBundleCandidate(s);
}
function admitted(s,manifest) {
  return admitPhotoBundle({...s,manifest});
}
test('037B2b: candidate hashes are deterministic but explicitly NOT admitted',()=>{
  const s=scenario();
  const one=candidate(s),two=candidate(s);
  assert.equal(one.status,'candidate-unpinned-not-admitted');
  assert.equal(one.manifest.kind,PHOTO_BUNDLE_KIND);
  assert.deepEqual(one.manifest,two.manifest);
  assert.equal(one.manifest.sourceSha256,hash(s.jpeg,'sha256'));
  assert.equal(one.manifest.decoded.sha256,hash(s.rgba,'sha256'));
  assert.equal(one.manifest.native.rgb16.cleanSha256.length,64);
  assert.equal(one.manifest.native.float32.damagedSha256.length,64);
  assert.match(one.warning,/No photo benchmark/);
  assert.equal(one.manifest.browserBenchmarkVerified,undefined);
});

test('037B2b: externally pinned manifest validates *both* native clean and defect bytes',()=>{
  // Unit-only successful pin: proves verifier mechanics, NOT photo provenance.
  const s=scenario(),m=candidate(s).manifest;
  const result=admitted(s,m);
  assert.equal(result.status,'pinned-byte-integrity-verified');
  assert.equal(result.originalSha256,m.sourceSha256);
  assert.equal(result.decodedRgbaSha256,m.decoded.sha256);
  assert.equal(result.selectedPixels,8288);
  assert.equal(result.sourcePrecisionBits,8);
  assert.equal(result.independentDecoderIccExifReviewRequired,true);
  assert.equal(result.photoshopParityVerified,false);
  assert.equal(result.browserBenchmarkVerified,false);
  assert.equal(result.fixtures.rgb16.admitted,true);
  assert.equal(result.fixtures.float32.admitted,true);
  assert.notEqual(result.fixtures.rgb16.clean.buffer,result.fixtures.rgb16.damaged.buffer);
  for(const [key,bits] of [['rgb16',16],['float32',32]]) {
    const f=result.fixtures[key];
    assert.equal(hashNativeCleanReference(f.clean,bits),m.native[key].cleanSha256);
    assert.equal(hashNativeCleanReference(f.damaged,bits),m.native[key].damagedSha256);
    assert.equal(f.selectedIndices.length,8288);
  }
});

test('037B2b: corrupt original, decoded, pins, crop and false claims fail closed',()=>{
  const s=scenario(),m=candidate(s).manifest;
  const attempts=[
    {...s,jpeg:s.jpeg.slice(0,-1)},
    {...s,rgba:s.rgba.slice(0,-1)},
    {...s,rgba:Uint8Array.from(s.rgba,(v,i)=>i===0?v^1:v)},
    {...s,manifest:{...m,sourceSha256:'0'.repeat(64)}},
    {...s,manifest:{...m,decoded:{...m.decoded,sha256:'0'.repeat(64)}}},
    {...s,manifest:{...m,native:{...m.native,rgb16:{
      ...m.native.rgb16,cleanSha256:'0'.repeat(64)}}}},
    {...s,manifest:{...m,native:{...m.native,float32:{
      ...m.native.float32,damagedSha256:'0'.repeat(64)}}}},
    {...s,manifest:{...m,crop:{...m.crop,width:239}}},
    {...s,manifest:{...m,crop:{...m.crop,x:1}}},
    {...s,manifest:{...m,decoded:{...m.decoded,pixelFormat:'RGB8'}}},
    {...s,manifest:{...m,kind:'zpe-benchmark-claimed-v1'}},
    {...s,manifest:{...m,browserBenchmarkVerified:true}},
    {...s,manifest:{...m,native:{...m.native,rgb16:{
      ...m.native.rgb16,photoshopGold:true}}}},
    {...s,manifest:{...m,decoder:{...m.decoder,version:''}}},
    {...s,manifest:{...m,decoder:{...m.decoder,exifOrientation:6}}},
    {...s,manifest:{...m,decoder:{...m.decoder,iccPolicy:'embedded-ICC-to-sRGB'}}},
    {...s,manifest:{...m,decoder:{...m.decoder,orientationApplied:'yes'}}},
    {...s,manifest:null},
    {...s,manifest:{...m,sourceSha256:undefined}},
  ];
  for(let i=0;i<attempts.length;i++) {
    const item={...attempts[i],manifest:attempts[i].manifest??m};
    // Use the original manifest for source/decoded tamper attempts, never
    // recompute a fingerprint after corruption.
    if(i===17) item.manifest=null;
    assert.throws(()=>admitted(item,item.manifest),/037 (photo bundle|photo source|photo native fixture)/,
      'negative case '+i);
  }
});

test('037B2b: a candidate cannot bypass explicit decoder and opacity checks',()=>{
  const s=scenario();
  const attacks=[
    {...s,decoder:{...s.decoder,colorEvidence:''}},
    {...s,decoder:{...s.decoder,exifOrientation:1}},
    {...s,decoder:{...s.decoder,orientationApplied:1}},
    {...s,decoder:{...s.decoder,iccPolicy:'embedded-ICC-to-sRGB'}},
    {...s,decoder:{...s.decoder,photoAuthentic:true}},
    {...s,crop:{...s.crop,height:239}},
    {...s,crop:{...s.crop,x:1}},
    {...s,sourcePolicy:{...s.sourcePolicy,sha1:'f'.repeat(40)}},
  ];
  for(const entry of attacks)
    assert.throws(()=>candidate(entry),/037 (photo bundle|photo source|photo native fixture)/);
  const rgba=s.rgba.slice();rgba[3]=0;
  assert.throws(()=>candidate({...s,rgba}),/037 photo source/);
});
