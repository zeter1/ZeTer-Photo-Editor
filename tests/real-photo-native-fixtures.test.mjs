import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hashNativeCleanReference,measureRealPhotoNativeQuality}
  from '../tools/real-photo-native-quality.mjs';
import {createWideConnectedRoiIndices} from '../tools/browser-wide-connected-native-evidence.mjs';
import {
  preparePhotoNativeFixtureCandidate,createPinnedPhotoNativeFixture,
} from '../tools/real-photo-native-fixtures.mjs';

// Deliberately synthetic textured RGBA8 unit surrogate. No photo is bundled or
// claimed and there is no Chromium/Photoshop reference in this test.
function input(bitsPerChannel) {
  const width=272,height=272,rgba=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*4;
    rgba[i]=(x*11+y*13)%256;
    rgba[i+1]=(x*7+y*19)%256;
    rgba[i+2]=(x*17+y*3)%256;
    rgba[i+3]=255;
  }
  return {
    rgba,width,height,expectedRgbaSha256:createHash('sha256').update(rgba).digest('hex'),
    cropX:8,cropY:12,cropWidth:256,cropHeight:240,bitsPerChannel,
  };
}
for(const bits of [16,32]) {
  test(`037B2a: ${bits}-bit candidate cannot be admitted without an independently pinned native digest`,()=>{
    const options=input(bits);
    const candidate=preparePhotoNativeFixtureCandidate(options);
    assert.equal(candidate.admitted,false);
    assert.equal(candidate.selectedPixels,8288);
    assert.equal(candidate.sourcePrecisionBits,8);
    assert.equal(candidate.width,256);
    assert.equal(candidate.height,240);
    assert.equal(candidate.referenceCandidateSha256,
      hashNativeCleanReference(candidate.clean,bits));
    assert.throws(()=>createPinnedPhotoNativeFixture(options),/independently pinned/);
    assert.throws(()=>createPinnedPhotoNativeFixture({
      ...options,expectedReferenceSha256:'f'.repeat(64),
    }),/native clean reference SHA-256 mismatch/);
  });

  test(`037B2a: ${bits}-bit pinned native clean and connected defect are independent exact words`,()=>{
    const options=input(bits);
    const candidate=preparePhotoNativeFixtureCandidate(options);
    const fixture=createPinnedPhotoNativeFixture({
      ...options,expectedReferenceSha256:candidate.referenceCandidateSha256,
    });
    assert.equal(fixture.admitted,true);
    assert.equal(fixture.kind,'zpe-real-photo-pinned-native-fixture-v1');
    assert.notEqual(fixture.clean.buffer,fixture.damaged.buffer);
    assert.deepEqual(fixture.selectedIndices,
      createWideConnectedRoiIndices(256,240,fixture.roiOrigin));
    assert.equal(fixture.roiOrigin.x,8);assert.equal(fixture.roiOrigin.y,0);
    let selected=0,nonselected=0;
    const mark=new Uint8Array(fixture.width*fixture.height);
    for(const pixel of fixture.selectedIndices) mark[pixel]=1;
    for(let pixel=0;pixel<mark.length;pixel++) {
      const base=pixel*4;
      assert.equal(fixture.clean[base+3],bits===16?65535:1);
      assert.equal(fixture.damaged[base+3],fixture.clean[base+3]);
      for(let channel=0;channel<3;channel++) {
        const a=fixture.clean[base+channel],b=fixture.damaged[base+channel];
        if(mark[pixel]){assert.notEqual(a,b);selected++;}
        else {assert.equal(a,b);nonselected++;}
      }
    }
    assert.equal(selected,8288*3);
    assert.equal(nonselected,(256*240-8288)*3);
    // The existing native oracle validates ALL outside pixels + alpha on the
    // independent buffers, not an RGB8 canvas preview.
    const quality=measureRealPhotoNativeQuality({
      before:fixture.damaged,after:fixture.clean.slice(),clean:fixture.clean,
      selectedIndices:fixture.selectedIndices,bitsPerChannel:bits,
      expectedReferenceSha256:fixture.referenceNativeSha256,
    });
    assert.equal(quality.selectedPixels,8288);
    assert.equal(quality.changedSelectedPixels,8288);
    assert.equal(quality.outsideSelectionAndAlphaNativeWordsExact,true);
    assert.ok(quality.baseline.mae>0);
    assert.equal(quality.repaired.mae,0);
    assert.equal(quality.repaired.rmse,0);
  });

  test(`037B2a: ${bits}-bit input mutation, bounds, alpha and digest attacks fail closed`,()=>{
    const options=input(bits);
    const digest=preparePhotoNativeFixtureCandidate(options).referenceCandidateSha256;
    const bad=[
      {...options,expectedRgbaSha256:'0'.repeat(64)},
      {...options,cropX:33},
      {...options,cropWidth:239},
      {...options,cropY:100},
      {...options,cropWidth:2000},
      {...options,bitsPerChannel:8},
      {...options,width:271},
      {...options,expectedReferenceSha256:'x'.repeat(64)},
    ];
    for(const item of bad) {
      assert.throws(()=>preparePhotoNativeFixtureCandidate(item),
        /037 photo native fixture|037 photo source/);
    }
    const altered=input(bits);
    altered.rgba[0]^=1;
    assert.throws(()=>createPinnedPhotoNativeFixture({
      ...altered,expectedReferenceSha256:digest,
    }),/037 photo source/);
    const alpha=input(bits);alpha.rgba[3]=254;
    alpha.expectedRgbaSha256=createHash('sha256').update(alpha.rgba).digest('hex');
    assert.throws(()=>preparePhotoNativeFixtureCandidate(alpha),/unexpected transparency/);
  });
}

test('037B2a: conversion is deterministic, 8-bit derived and channel-preserving',()=>{
  const input16=input(16),input32=input(32);
  const a=preparePhotoNativeFixtureCandidate(input16);
  const b=preparePhotoNativeFixtureCandidate(input16);
  assert.equal(a.referenceCandidateSha256,b.referenceCandidateSha256);
  assert.deepEqual(a.clean,b.clean);
  const f=preparePhotoNativeFixtureCandidate(input32);
  const pixel=1000,px=pixel%256,py=Math.floor(pixel/256);
  const src=((py+input16.cropY)*input16.width+px+input16.cropX)*4;
  for(let channel=0;channel<3;channel++) {
    const byte=input16.rgba[src+channel];
    assert.equal(a.clean[pixel*4+channel],byte*257);
    assert.equal(f.clean[pixel*4+channel],Math.fround(byte/255));
  }
  assert.notEqual(a.referenceCandidateSha256,f.referenceCandidateSha256);
});
