import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectPhotoJpeg} from '../tools/real-photo-source-integrity.mjs';
import {inspectPhotoBundleCandidate} from '../tools/real-photo-bundle-admission.mjs';

// Synthetic marker-only JPEG: never assert pixel decode or photographic proof.
const base=Uint8Array.from([0xff,0xd8,0xff,0xe0,0,4,0,0,
  0xff,0xc0,0,17,8,0,240,0,240,3,1,0x11,0,2,0x11,0,3,0x11,0,
  0xff,0xda,0,8,3,1,0,2,0,3,0,0x01,0x33,0xff,0xd9]);
const sha1=bytes=>createHash('sha1').update(bytes).digest('hex');
function exif(orientation=null,little=true) {
  const tiff=little?[73,73,42,0,8,0,0,0]:[77,77,0,42,0,0,0,8];
  if(orientation===null) tiff.push(0,0);
  else if(little) tiff.push(1,0,0x12,1,3,0,1,0,0,0,orientation,0,0,0);
  else tiff.push(0,1,1,0x12,0,3,0,0,0,1,0,orientation,0,0);
  tiff.push(0,0,0,0);
  const payload=[69,120,105,102,0,0,...tiff],length=payload.length+2;
  return [0xff,0xe1,length>>8,length&255,...payload];
}
const jpegWith=(segments=[])=>Uint8Array.from([
  ...base.subarray(0,8),...segments.flat(),...base.subarray(8),
]);
const inspect=bytes=>inspectPhotoJpeg(bytes,{
  expectedSha1:sha1(bytes),expectedWidth:240,expectedHeight:240,
});
const withMutation=(segment,index,value)=>{
  const result=segment.slice();result[index]=value;return jpegWith([result]);
};

test('037B2b-2c: TIFF IFD0 orientation is read from both endian layouts',()=>{
  for(const [orientation,little] of [[null,true],[1,true],[6,true],[8,false],[3,false]]) {
    const bytes=jpegWith([exif(orientation,little)]);
    const result=inspect(bytes);
    assert.equal(result.hasExif,true);
    assert.equal(result.exifOrientation,orientation);
    assert.equal(result.pixelDecodeVerified,false);
  }
  assert.equal(inspect(base).exifOrientation,null);
});

test('037B2b-2c: malformed, duplicate or out-of-range EXIF fails at byte preflight',()=>{
  const good=exif(6),bad=[
    withMutation(good,9,1), // Invalid Exif NUL terminator.
    withMutation(good,10,0), // Invalid TIFF endian marker.
    withMutation(good,12,0), // Invalid TIFF 42 magic.
    withMutation(good,14,255), // IFD offset beyond APP1.
    withMutation(good,18,255), // Excessive IFD entry count.
    withMutation(good,22,2), // Orientation type must be SHORT.
    withMutation(good,28,9), // Orientation must be in 1..8.
    jpegWith([good,good]), // Multiple EXIF APP1 segments.
    jpegWith([[0xff,0xe1,0,8,69,120,105,102,0,0]]), // EXIF header without TIFF.
  ];
  for(let n=0;n<bad.length;n++)
    assert.throws(()=>inspect(bad[n]),/037 photo source.*EXIF/,
      'invalid EXIF case '+n);
});

test('037B2b-2c: declared decoder EXIF must exactly match original TIFF bytes',()=>{
  const rgba=new Uint8Array(240*240*4);
  for(let i=3;i<rgba.length;i+=4)rgba[i]=255;
  const decoder={tool:'synthetic-test',version:'test-1.0',command:'no JPEG decode',
    exifOrientation:6,orientationApplied:true,iccPolicy:'assumed-sRGB',
    colorEvidence:'Synthetic pixels only; no color or photo provenance verified'};
  const bytes=jpegWith([exif(6)]);
  const options={jpeg:bytes,rgba,decoder,crop:{x:0,y:0,width:240,height:240},
    sourcePolicy:{page:'https://example.invalid/test',license:'CC0-1.0',
      sha1:sha1(bytes),width:240,height:240}};
  assert.equal(inspectPhotoBundleCandidate(options).manifest.decoder.exifOrientation,6);
  for(const changed of [
    {exifOrientation:null,orientationApplied:false},
    {exifOrientation:1,orientationApplied:false},
    {exifOrientation:8,orientationApplied:true},
    {exifOrientation:6,orientationApplied:false},
  ]) assert.throws(()=>inspectPhotoBundleCandidate({
    ...options,decoder:{...decoder,...changed},
  }),/037 photo bundle.*(EXIF|orientationApplied)/);
});
