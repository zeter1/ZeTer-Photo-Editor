// 037B2b-3c: independent Python/std-lib reader of ZeTer PSD16/PSB32 raw
// layer AND merged channels. Synthetic structural fixture, NOT genuine photo,
// Adobe parity, or independent Photoshop-authored corpus.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectPhotoBundleCandidate} from '../tools/real-photo-bundle-admission.mjs';
import {createVerifiedPhotoDefectDocuments} from '../tools/real-photo-psd-psb-fixtures.mjs';

const reader=fileURLToPath(new URL('../tools/verify-real-photo-psd-native.py',import.meta.url));
const python=process.env.ZPE_PHOTO_PYTHON || (process.platform==='win32'?'python':'python3');
const available=spawnSync(python,['--version'],{encoding:'utf8'}).status===0;
const skip=!available && !process.env.ZPE_REQUIRE_PHOTO_DECODER_TESTS;

function syntheticPhotoBundle() {
  const width=240,height=240;
  // Deliberately NOT an entropy-decodable JPEG and NOT a real CC0 original.
  const jpeg=Uint8Array.from([0xff,0xd8,0xff,0xe0,0,4,0,0,
    0xff,0xc0,0,17,8,0,240,0,240,3,1,0x11,0,2,0x11,0,3,0x11,0,
    0xff,0xda,0,8,3,1,0,2,0,3,0,0x01,0x33,0xff,0xd9]);
  const rgba=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*4;
    rgba[i]=(x*7+y*13)%256;
    rgba[i+1]=(x*11+y*17)%256;
    rgba[i+2]=(x*19+y*23)%256;
    rgba[i+3]=255;
  }
  const digest=(algorithm)=>createHash(algorithm).update(jpeg).digest('hex');
  const sourcePolicy={
    page:'https://example.invalid/synthetic-only',
    license:'CC0-1.0',sha1:digest('sha1'),width,height,
  };
  const decoder={
    tool:'structural-surrogate',version:'1.0',command:'unit test only: no decode',
    exifOrientation:null,orientationApplied:false,iccPolicy:'assumed-sRGB',
    colorEvidence:'Synthetic test pixels, no real image review',
  };
  const manifest=inspectPhotoBundleCandidate({
    jpeg,rgba,decoder,sourcePolicy,crop:{x:0,y:0,width,height},
  }).manifest;
  return {jpeg,rgba,manifest,sourcePolicy};
}

function layerRawChannelOffset(bytes,version) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=26;
  for(let i=0;i<2;i++) {
    const length=view.getUint32(offset,false);
    offset+=4+length;
  }
  // whole layer/mask length, empty ordinary layer-info, empty global mask,
  // tagged Lr16/Lr32 signature/key+length, then one layer record.
  offset+=(version===1?4:8)+(version===1?4:8)+4+8+(version===1?4:8);
  assert.equal(view.getInt16(offset,false),-1);
  offset+=2+16+2+4*(2+(version===1?4:8))+4+4+4;
  const extraLen=view.getUint32(offset,false);
  return offset+4+extraLen;
}

// 037B2b-3d: locate exact one-layer fixture metadata independently of its
// encoder. Mutations leave ALL pixel/channel bytes and native pins unchanged.
function layerMetadataOffsets(bytes,version) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=26;
  for(let i=0;i<2;i++) {
    const length=view.getUint32(offset,false);
    offset+=4+length;
  }
  offset+=(version===1?4:8)+(version===1?4:8)+4+8+(version===1?4:8);
  const countOffset=offset;
  assert.equal(view.getInt16(countOffset,false),-1);
  offset+=2+16+2+4*(2+(version===1?4:8))+4+4+4;
  const flagsOffset=offset-2;
  const extraLength=view.getUint32(offset,false);
  const extraStart=offset+4;
  assert.ok(extraLength>=16);
  assert.equal(view.getUint32(extraStart,false),0);
  const pascalLength=bytes[extraStart+8];
  const unicodeStart=extraStart+8+Math.ceil((1+pascalLength)/4)*4;
  assert.equal(String.fromCharCode(...bytes.slice(unicodeStart+4,unicodeStart+8)),'luni');
  const unicodeChars=view.getUint32(unicodeStart+12,false);
  const unicodePadding=unicodeStart+16+unicodeChars*2;
  assert.ok(unicodePadding<extraStart+extraLength,'fixture must have Unicode padding');
  return {
    count:countOffset+1,
    flags:flagsOffset,
    mask:extraStart+3,
    blendingRanges:extraStart+7,
    pascalName:extraStart+9,
    unicodeBlock:unicodeStart+4,
    unicodeName:unicodeStart+16,
    unicodePadding,
  };
}

test('037B2b-3c: independent Python readback proves exact native layer and merged pins', {
  skip,
},async()=>{
  const input=syntheticPhotoBundle();
  const evidence=await createVerifiedPhotoDefectDocuments(input);
  const dir=await mkdtemp(join(tmpdir(),'zpe-photo-independent-'));
  try {
    function verify(fmt,bytes,pin,filename,width=240,height=240) {
      const args=[reader,fmt,join(dir,filename),String(width),String(height),pin];
      const result=spawnSync(python,args,{encoding:'utf8',maxBuffer:1024*1024});
      return result;
    }
    for(const [key,fmt,bits,filename] of [
      ['psd16','PSD16',16,'defect.psd'],['psb32','PSB32',32,'defect.psb'],
    ]) {
      const data=evidence.documents[key].bytes;
      const pin=input.manifest.native[bits===16?'rgb16':'float32'].damagedSha256;
      await writeFile(join(dir,filename),data);
      const success=verify(fmt,data,pin,filename);
      assert.equal(success.status,0,success.stderr);
      const report=JSON.parse(success.stdout);
      assert.equal(report.status,'independent-python-native-readback-only');
      assert.equal(report.nativeLayerSha256,pin);
      assert.equal(report.nativeMergedSha256,pin);
      assert.equal(report.fileSha256,evidence.documents[key].proof.fileSha256);
      assert.equal(report.photoshopParityVerified,false);
      assert.equal(report.realPhotoVerified,false);

      assert.notEqual(verify(fmt,data,'0'.repeat(64),filename).status,0,
        'must reject unpinned layer reference');
      assert.notEqual(verify(fmt,data,pin,filename,239).status,0);
      assert.notEqual(verify(fmt==='PSD16'?'PSB32':'PSD16',data,pin,filename).status,0);

      // All these edits preserve the native RGBA layer and merged SHA-256.
      // A pixel-only structural reader used to accept these altered semantics.
      const metadata=layerMetadataOffsets(data,bits===16?1:2);
      for(const [name,position,message] of [
        ['layer-count',metadata.count,/expected one RGBA layer/],
        ['protected-layer',metadata.flags,/unexpected layer flags/],
        ['silent-mask',metadata.mask,/unexpected layer mask/],
        ['blending-ranges',metadata.blendingRanges,/unexpected layer blending ranges/],
        ['pascal-name',metadata.pascalName,/unexpected Pascal layer name/],
        ['unicode-key',metadata.unicodeBlock,/expected Unicode layer name block/],
        ['unicode-name',metadata.unicodeName,/unexpected Unicode layer name/],
        ['unicode-padding',metadata.unicodePadding,/invalid Unicode layer name padding/],
      ]) {
        const forged=data.slice();
        forged[position]^=1;
        await writeFile(join(dir,filename),forged);
        const denied=verify(fmt,forged,pin,filename);
        assert.notEqual(denied.status,0,name+' changed metadata must fail closed');
        assert.match(denied.stderr,message,name);
      }

      const alteredLayer=data.slice();
      const channelOffset=layerRawChannelOffset(alteredLayer,bits===16?1:2);
      alteredLayer[channelOffset+2]^=1;
      await writeFile(join(dir,filename),alteredLayer);
      assert.notEqual(verify(fmt,alteredLayer,pin,filename).status,0,
        'layer-only tamper must fail independently of merged channels');

      const alteredCompression=data.slice();
      alteredCompression[channelOffset+1]=1;
      await writeFile(join(dir,filename),alteredCompression);
      assert.notEqual(verify(fmt,alteredCompression,pin,filename).status,0,
        'compressed layer must fail closed');

      const alteredMerged=data.slice();
      alteredMerged[alteredMerged.length-1]^=1;
      await writeFile(join(dir,filename),alteredMerged);
      assert.notEqual(verify(fmt,alteredMerged,pin,filename).status,0,
        'merged-only tamper must fail independently of layer');

      await writeFile(join(dir,filename),data.slice(0,-1));
      assert.notEqual(verify(fmt,data,pin,filename).status,0,'truncation');
      await writeFile(join(dir,filename),Uint8Array.from([...data,0]));
      assert.notEqual(verify(fmt,data,pin,filename).status,0,'extra payload');
    }
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
