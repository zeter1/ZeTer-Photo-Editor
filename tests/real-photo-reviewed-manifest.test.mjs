// 037B2b-2: independent source/decoder/native pins are frozen in Git.
// This static regression intentionally cannot repin live CI candidates.
// The real-photo Actions workflow separately re-downloads and verifies all bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REAL_PHOTO_SOURCE,PHOTO_BUNDLE_KIND} from '../tools/real-photo-bundle-admission.mjs';

const reviewed=JSON.parse(readFileSync(new URL('./fixtures/real-photo/reviewed-manifest.json',import.meta.url),'utf8'));
test('037B2b-2: independently reviewed Commons identity and decoded image stay frozen',()=>{
  assert.equal(REAL_PHOTO_SOURCE.page,'https://commons.wikimedia.org/wiki/File:Red-brick-wall-texture-clean.jpg');
  assert.equal(REAL_PHOTO_SOURCE.license,'CC0-1.0');
  assert.equal(REAL_PHOTO_SOURCE.sha1,'c7fc9f013c70e01f164d232462ddd6e37e4079c4');
  assert.deepEqual(Object.keys(reviewed).sort(),['kind','sourceSha256','decoded','decoder','crop','native'].sort());
  assert.equal(reviewed.kind,PHOTO_BUNDLE_KIND);
  assert.equal(reviewed.sourceSha256,'dd01cf047c9b2b7a635e29c68a52c5585d7b346f4f99713f79968ea1ea4348b8');
  assert.deepEqual(reviewed.decoded,{sha256:'d1aa01e37ee9944099db871be53f9d30fd00bdd12ead94ba4e09f1dd765b1641',width:2560,height:1920,pixelFormat:'RGBA8'});
  assert.deepEqual(reviewed.crop,{x:0,y:0,width:1025,height:1025});
});
test('037B2b-2: actual EXIF and explicit assumed-sRGB policy are not mislabeled ICC conversion',()=>{
  assert.deepEqual(Object.keys(reviewed.decoder).sort(),['tool','version','command','exifOrientation','orientationApplied','iccPolicy','colorEvidence'].sort());
  assert.equal(reviewed.decoder.exifOrientation,1);
  assert.equal(reviewed.decoder.orientationApplied,false);
  assert.equal(reviewed.decoder.iccPolicy,'assumed-sRGB');
  assert.match(reviewed.decoder.colorEvidence,/No Pillow-assembled embedded ICC/);
  assert.equal('browserBenchmarkVerified' in reviewed,false);
  assert.equal('photoshopParityVerified' in reviewed,false);
});
test('037B2b-2: independent native clean and damaged LE digests are stable',()=>{
  assert.deepEqual(reviewed.native,{
    rgb16:{cleanSha256:'b1eee911c356a3815dd548d3a3d708fd8457b16e35e0eff19dc80a48429fec0a',damagedSha256:'70816f5177ad5008ee164513931e5cf3866c0134ce1a27362df430a4594a7228'},
    float32:{cleanSha256:'48ea38caae87ac76673bd5432f04e42408ab9d032feac8677b0d025de0794f15',damagedSha256:'5ca57278cc7e28fd440435248667ec14236b527be3609ca5f3083e0b1fb63735'},
  });
});
