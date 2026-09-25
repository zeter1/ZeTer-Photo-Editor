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

function identityCurveBytes(){
  const bytes=new Uint8Array(12);
  const view=new DataView(bytes.buffer);
  putAscii(bytes,0,'curv');
  view.setUint32(8,0,false);
  return bytes;
}

function makeIccProfileWithTag(tagSignature,tagBytes,{pcs='Lab '}={}){
  const offset=144;
  const bytes=new Uint8Array(offset+tagBytes.length);
  const view=new DataView(bytes.buffer);
  view.setUint32(0,bytes.length,false);
  bytes[8]=4;bytes[9]=0x40;
  putAscii(bytes,12,'prtr');putAscii(bytes,16,'CMYK');putAscii(bytes,20,pcs);putAscii(bytes,36,'acsp');
  view.setUint32(128,1,false);
  putAscii(bytes,132,tagSignature);
  view.setUint32(136,offset,false);
  view.setUint32(140,tagBytes.length,false);
  bytes.set(tagBytes,offset);
  return bytes;
}

function makeMabCmykLabProfile(){
  const tag=new Uint8Array(184);
  const view=new DataView(tag.buffer);
  putAscii(tag,0,'mAB ');
  tag[8]=4;tag[9]=3;
  view.setUint32(12,32,false);
  view.setUint32(16,0,false);
  view.setUint32(20,0,false);
  view.setUint32(24,68,false);
  view.setUint32(28,136,false);
  const identity=identityCurveBytes();
  for(let index=0;index<3;index+=1)tag.set(identity,32+index*12);
  tag[68]=2;tag[69]=2;tag[70]=2;tag[71]=2;tag[84]=1;
  let cursor=88;
  for(let c=0;c<2;c+=1)for(let m=0;m<2;m+=1)for(let y=0;y<2;y+=1)for(let k=0;k<2;k+=1){
    tag[cursor++]=k?0:255;
    tag[cursor++]=128;
    tag[cursor++]=128;
  }
  for(let index=0;index<4;index+=1)tag.set(identity,136+index*12);
  assert.equal(cursor,136);
  return makeIccProfileWithTag('A2B0',tag);
}

function makeMpeCmykLabProfile(){
  const elementSize=28+(2**4)*3*4;
  const tag=new Uint8Array(24+elementSize);
  const view=new DataView(tag.buffer);
  putAscii(tag,0,'mpet');
  view.setUint16(8,4,false);view.setUint16(10,3,false);view.setUint32(12,1,false);
  view.setUint32(16,24,false);view.setUint32(20,elementSize,false);
  const start=24;
  putAscii(tag,start,'clut');
  view.setUint16(start+8,4,false);view.setUint16(start+10,3,false);
  tag[start+12]=2;tag[start+13]=2;tag[start+14]=2;tag[start+15]=2;
  let cursor=start+28;
  for(let c=0;c<2;c+=1)for(let m=0;m<2;m+=1)for(let y=0;y<2;y+=1)for(let k=0;k<2;k+=1){
    view.setFloat32(cursor,k?0:100,false);cursor+=4;
    view.setFloat32(cursor,0,false);cursor+=4;
    view.setFloat32(cursor,0,false);cursor+=4;
  }
  assert.equal(cursor,tag.length);
  return makeIccProfileWithTag('D2B0',tag);
}

test('Stage 13b executes ICC v4 mAB A-CLUT-B pipelines',()=>{
  const transform=createCmykToSrgbTransform(makeMabCmykLabProfile());
  assert.equal(transform.managed,true);
  assert.equal(transform.method,'icc-mab');
  assert.equal(transform.tag,'A2B0');
  assert.ok(transform.apply(0,0,0,0).every(value=>value>.98));
  assert.ok(transform.apply(0,0,0,1).every(value=>value<.02));
});

test('Stage 13b executes float multiProcessElements D2B CLUT pipelines',()=>{
  const transform=createCmykToSrgbTransform(makeMpeCmykLabProfile());
  assert.equal(transform.managed,true);
  assert.equal(transform.method,'icc-mpe');
  assert.equal(transform.tag,'D2B0');
  assert.ok(transform.apply(0,0,0,0).every(value=>value>.98));
  assert.ok(transform.apply(0,0,0,1).every(value=>value<.02));
});

test('Stage 13b rendering-intent policy resolves missing intent tags explicitly',()=>{
  const transform=createCmykToSrgbTransform(makeMabCmykLabProfile(),{intent:'relative',displaySpace:'srgb'});
  assert.equal(transform.managed,true);
  assert.equal(transform.requestedIntent,'relative');
  assert.equal(transform.intent,'perceptual');
  assert.match(transform.warning,/A2B1 отсутствует/);
});

test('Stage 13b refuses unsupported display targets instead of claiming a managed preview',()=>{
  const transform=createCmykToSrgbTransform(makeMabCmykLabProfile(),{displaySpace:'display-p3'});
  assert.equal(transform.managed,false);
  assert.equal(transform.displaySpace,'srgb');
  assert.match(transform.warning,/доступен только sRGB/);
});
