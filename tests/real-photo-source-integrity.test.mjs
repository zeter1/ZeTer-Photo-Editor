import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectPhotoJpeg,verifyPinnedPhotoJpeg,verifyPinnedDecodedRgba}
  from '../tools/real-photo-source-integrity.mjs';

// Structural surrogate, deliberately not entropy-decodable and NOT a photograph.
const jpeg=(width=1025,height=1025)=>{
  const sof=[0xff,0xc0,0,17,8,height>>8,height&255,width>>8,width&255,3,
    1,0x11,0,2,0x11,0,3,0x11,0];
  return Uint8Array.from([0xff,0xd8,0xff,0xe0,0,4,0,0,
    ...sof,0xff,0xda,0,8,3,1,0,2,0,3,0,0x01,0x33,0xff,0xd9]);
};
const hash=(bytes,algorithm)=>createHash(algorithm).update(bytes).digest('hex');
const args=bytes=>({expectedSha1:hash(bytes,'sha1'),expectedWidth:1025,expectedHeight:1025});

test('037B1: original JPEG marker/SOF/scan inspection reports candidate but no pixel or ICC proof',()=>{
  const bytes=jpeg(),p=inspectPhotoJpeg(bytes,args(bytes));
  assert.equal(p.kind,'zpe-real-photo-jpeg-source-v1');
  assert.equal(p.sha256,hash(bytes,'sha256'));
  assert.equal(p.sha1,hash(bytes,'sha1'));
  assert.equal(p.width,1025);assert.equal(p.height,1025);
  assert.equal(p.precision,8);assert.equal(p.components,3);
  assert.equal(p.pixelDecodeVerified,false);assert.equal(p.colorSpaceVerified,false);
  assert.equal(p.sha256Pinned,undefined);
  assert.equal(verifyPinnedPhotoJpeg(bytes,{...args(bytes),expectedSha256:p.sha256}).sha256Pinned,true);
});

test('037B1: no unpinned JPEG admission; fail closed on changed bytes, wrong geometry, and malformed markers',()=>{
  const bytes=jpeg(),options=args(bytes),sha=hash(bytes,'sha256');
  const bad=[
    ()=>verifyPinnedPhotoJpeg(bytes,{...options}),
    ()=>verifyPinnedPhotoJpeg(bytes,{...options,expectedSha256:'f'.repeat(64)}),
    ()=>inspectPhotoJpeg(bytes,{...options,expectedSha1:'0'.repeat(40)}),
    ()=>inspectPhotoJpeg(bytes,{...options,expectedWidth:240}),
    ()=>inspectPhotoJpeg(bytes.subarray(0,-2),{...options,expectedSha1:hash(bytes.subarray(0,-2),'sha1')}),
    ()=>{const b=bytes.slice();b[0]=0;return inspectPhotoJpeg(b,args(b));},
    ()=>{const b=bytes.slice();b[3]=0x00;return inspectPhotoJpeg(b,args(b));},
    ()=>{const b=bytes.slice();b[5]=0xff;return inspectPhotoJpeg(b,args(b));},
    ()=>{const b=bytes.slice();b[8+4]=12;return inspectPhotoJpeg(b,args(b));},
    ()=>{const b=jpeg(1024);return inspectPhotoJpeg(b,args(b));},
    ()=>{const b=bytes.slice();b[b.length-5]=0;return inspectPhotoJpeg(b,args(b));},
    ()=>inspectPhotoJpeg('not bytes',options),
    ()=>inspectPhotoJpeg(bytes,{...options,expectedSha1:null}),
  ];
  for(const badCase of bad) assert.throws(badCase,/037 photo source/);
  assert.equal(verifyPinnedPhotoJpeg(bytes,{...options,expectedSha256:sha}).sha256,sha);
});

test('037B1: independent RGBA8 decode fingerprint enforces exact native-order byte hash and opacity',()=>{
  const rgba=new Uint8Array(240*240*4);
  for(let p=0;p<240*240;p++){
    rgba[p*4]=p%251;rgba[p*4+1]=(p*9)%253;rgba[p*4+2]=(p*23)%255;rgba[p*4+3]=255;
  }
  const expectedRgbaSha256=hash(rgba,'sha256');
  const opts={width:240,height:240,expectedRgbaSha256};
  assert.equal(verifyPinnedDecodedRgba(rgba,opts).sha256,expectedRgbaSha256);
  assert.throws(()=>verifyPinnedDecodedRgba(rgba,{...opts,expectedRgbaSha256:'0'.repeat(64)}),/037 photo source/);
  assert.throws(()=>verifyPinnedDecodedRgba(rgba,{...opts,width:241}),/037 photo source/);
  assert.throws(()=>verifyPinnedDecodedRgba(rgba,{...opts,expectedRgbaSha256:null}),/037 photo source/);
  const altered=rgba.slice();altered[0]++;
  assert.throws(()=>verifyPinnedDecodedRgba(altered,opts),/037 photo source/);
  const transparent=rgba.slice();transparent[3]=254;
  assert.throws(()=>verifyPinnedDecodedRgba(transparent,{
    ...opts,expectedRgbaSha256:hash(transparent,'sha256'),
  }),/037 photo source/);
});
