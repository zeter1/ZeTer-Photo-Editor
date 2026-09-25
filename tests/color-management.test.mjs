import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { createCmykToSrgbTransform, cmykPixelBufferToRgba8Preview } from '../src/core/color-management.js';

function putAscii(bytes,offset,value){
  for(let index=0;index<value.length;index+=1)bytes[offset+index]=value.charCodeAt(index);
}

function makeMft1CmykLabProfile(){
  const tagSize=48+4*256+(2**4)*3+3*256;
  const tagOffset=144;
  const bytes=new Uint8Array(tagOffset+tagSize);
  const view=new DataView(bytes.buffer);
  view.setUint32(0,bytes.length,false);
  bytes[8]=4;bytes[9]=0x30;
  putAscii(bytes,12,'prtr');putAscii(bytes,16,'CMYK');putAscii(bytes,20,'Lab ');putAscii(bytes,36,'acsp');
  view.setUint32(128,1,false);
  putAscii(bytes,132,'A2B0');view.setUint32(136,tagOffset,false);view.setUint32(140,tagSize,false);
  putAscii(bytes,tagOffset,'mft1');
  bytes[tagOffset+8]=4;bytes[tagOffset+9]=3;bytes[tagOffset+10]=2;
  for(let axis=0;axis<3;axis+=1)view.setInt32(tagOffset+12+(axis*3+axis)*4,65536,false);
  let cursor=tagOffset+48;
  for(let channel=0;channel<4;channel+=1)for(let value=0;value<256;value+=1)bytes[cursor++]=value;
  for(let c=0;c<2;c+=1)for(let m=0;m<2;m+=1)for(let y=0;y<2;y+=1)for(let k=0;k<2;k+=1){
    bytes[cursor++]=k?0:255;
    bytes[cursor++]=128;
    bytes[cursor++]=128;
  }
  for(let channel=0;channel<3;channel+=1)for(let value=0;value<256;value+=1)bytes[cursor++]=value;
  assert.equal(cursor,bytes.length);
  return bytes;
}

test('Stage 13a executes CMYK A2B0 mft1 Lab ICC transform into sRGB preview',()=>{
  const transform=createCmykToSrgbTransform(makeMft1CmykLabProfile());
  assert.equal(transform.managed,true);
  assert.equal(transform.method,'icc-lut8');
  assert.equal(transform.tag,'A2B0');
  const white=transform.apply(0,0,0,0);
  const black=transform.apply(0,0,0,1);
  const middle=transform.apply(0,0,0,.5);
  assert.ok(white.every(value=>value>.98));
  assert.ok(black.every(value=>value<.02));
  assert.ok(middle.every(value=>value>.4&&value<.6));
});

test('Stage 13a exposes an explicit unmanaged Device CMYK fallback when ICC is absent',()=>{
  const transform=createCmykToSrgbTransform();
  assert.equal(transform.managed,false);
  assert.equal(transform.method,'device-cmyk-fallback');
  assert.match(transform.warning,/ICC profile отсутствует/);
  assert.deepEqual(transform.apply(0,0,0,0),[1,1,1]);
  assert.deepEqual(transform.apply(0,0,0,1),[0,0,0]);
  assert.deepEqual(transform.apply(1,0,0,0),[0,1,1]);
});

test('Stage 13a converts preserved CMYK PixelBuffer samples and alpha into RGBA8 display pixels',()=>{
  const buffer=createPixelBuffer({
    width:2,height:1,model:'cmyk',channels:5,bitsPerChannel:8,colorSpace:'device-cmyk',alphaMode:'straight',
    data:new Uint8ClampedArray([0,0,0,0,255, 0,0,0,255,128]),
  });
  const preview=cmykPixelBufferToRgba8Preview(buffer,createCmykToSrgbTransform(makeMft1CmykLabProfile()));
  assert.deepEqual([...preview],[255,255,255,255, 0,0,0,128]);
});

test('Stage 13a refuses unsupported ICC transform types without silently claiming color management',()=>{
  const profile=makeMft1CmykLabProfile();
  putAscii(profile,144,'mAB ');
  const transform=createCmykToSrgbTransform(profile);
  assert.equal(transform.managed,false);
  assert.match(transform.warning,/Stage 13a поддерживает mft1\/mft2/);
  assert.deepEqual(transform.apply(0,0,0,0),[1,1,1]);
});
