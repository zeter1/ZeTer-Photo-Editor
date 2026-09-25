import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { createCmykToSrgbTransform, createSrgbToCmykTransform, createCmykSoftProofTransform, inspectCmykIccProfile, cmykPixelBufferToRgba8Preview } from '../src/core/color-management.js';

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


function makeMpeCurveSetCmykLabProfile(){
  const curveSize=40;
  const cvstSize=12+4*8+4*curveSize;
  const clutSize=28+(2**4)*3*4;
  const tagSize=32+cvstSize+clutSize;
  const tag=new Uint8Array(tagSize);
  const view=new DataView(tag.buffer);
  putAscii(tag,0,'mpet');
  view.setUint16(8,4,false);view.setUint16(10,3,false);view.setUint32(12,2,false);
  view.setUint32(16,32,false);view.setUint32(20,cvstSize,false);
  view.setUint32(24,32+cvstSize,false);view.setUint32(28,clutSize,false);

  const cvst=32;
  putAscii(tag,cvst,'cvst');view.setUint16(cvst+8,4,false);view.setUint16(cvst+10,4,false);
  for(let channel=0;channel<4;channel+=1){
    const curveOffset=12+32+channel*curveSize;
    view.setUint32(cvst+12+channel*8,curveOffset,false);view.setUint32(cvst+16+channel*8,curveSize,false);
    const curve=cvst+curveOffset;
    putAscii(tag,curve,'curf');view.setUint16(curve+8,1,false);
    putAscii(tag,curve+12,'parf');view.setUint16(curve+20,0,false);
    view.setFloat32(curve+24,channel===3?2:1,false);
    view.setFloat32(curve+28,1,false);view.setFloat32(curve+32,0,false);view.setFloat32(curve+36,0,false);
  }

  const clut=32+cvstSize;
  putAscii(tag,clut,'clut');view.setUint16(clut+8,4,false);view.setUint16(clut+10,3,false);
  tag[clut+12]=2;tag[clut+13]=2;tag[clut+14]=2;tag[clut+15]=2;
  let cursor=clut+28;
  for(let c=0;c<2;c+=1)for(let m=0;m<2;m+=1)for(let y=0;y<2;y+=1)for(let k=0;k<2;k+=1){
    view.setFloat32(cursor,k?0:100,false);cursor+=4;
    view.setFloat32(cursor,0,false);cursor+=4;
    view.setFloat32(cursor,0,false);cursor+=4;
  }
  assert.equal(cursor,tag.length);
  return makeIccProfileWithTag('D2B0',tag);
}

function makeMbaCmykXyzProfile(){
  const tag=new Uint8Array(184);
  const view=new DataView(tag.buffer);
  putAscii(tag,0,'mBA ');tag[8]=3;tag[9]=4;
  view.setUint32(12,32,false);view.setUint32(16,0,false);view.setUint32(20,0,false);view.setUint32(24,68,false);view.setUint32(28,136,false);
  const identity=identityCurveBytes();
  for(let i=0;i<3;i+=1)tag.set(identity,32+i*12);
  const clut=68;tag[clut]=2;tag[clut+1]=3;tag[clut+2]=2;tag[clut+16]=1;
  let cursor=clut+20;
  for(let x=0;x<2;x+=1)for(let y=0;y<3;y+=1)for(let z=0;z<2;z+=1){
    const yn=y/2;
    tag[cursor++]=0;tag[cursor++]=0;tag[cursor++]=0;tag[cursor++]=Math.round(Math.max(0,1-2*yn)*255);
  }
  assert.equal(cursor,136);
  for(let i=0;i<4;i+=1)tag.set(identity,136+i*12);
  return makeIccProfileWithTag('B2A1',tag,{pcs:'XYZ '});
}

function makeFloatClutMpeTag(inputs,outputs,sampleFn){
  const nodes=2**inputs,elementSize=28+nodes*outputs*4;
  const tag=new Uint8Array(24+elementSize);
  const view=new DataView(tag.buffer);
  putAscii(tag,0,'mpet');view.setUint16(8,inputs,false);view.setUint16(10,outputs,false);view.setUint32(12,1,false);
  view.setUint32(16,24,false);view.setUint32(20,elementSize,false);
  const start=24;putAscii(tag,start,'clut');view.setUint16(start+8,inputs,false);view.setUint16(start+10,outputs,false);
  for(let i=0;i<inputs;i+=1)tag[start+12+i]=2;
  let cursor=start+28;
  for(let node=0;node<nodes;node+=1){
    const coordinates=[];
    for(let channel=0;channel<inputs;channel+=1)coordinates.push((node>>(inputs-1-channel))&1);
    const values=sampleFn(coordinates);
    for(let out=0;out<outputs;out+=1){view.setFloat32(cursor,values[out],false);cursor+=4;}
  }
  assert.equal(cursor,tag.length);
  return tag;
}

function makeIccProfileWithTags(entries,{pcs='XYZ '}={}){
  const tableEnd=132+entries.length*12;
  let total=tableEnd;
  for(const entry of entries)total+=entry.data.length;
  const bytes=new Uint8Array(total),view=new DataView(bytes.buffer);
  view.setUint32(0,total,false);bytes[8]=4;bytes[9]=0x40;
  putAscii(bytes,12,'prtr');putAscii(bytes,16,'CMYK');putAscii(bytes,20,pcs);putAscii(bytes,36,'acsp');
  view.setUint32(128,entries.length,false);
  let cursor=tableEnd;
  entries.forEach((entry,index)=>{
    const pos=132+index*12;putAscii(bytes,pos,entry.signature);view.setUint32(pos+4,cursor,false);view.setUint32(pos+8,entry.data.length,false);
    bytes.set(entry.data,cursor);cursor+=entry.data.length;
  });
  return bytes;
}

function makeRoundTripCmykXyzProfile(){
  const d2b=makeFloatClutMpeTag(4,3,([c,m,y,k])=>[(1-k)*.96422,1-k,(1-k)*.82521]);
  const b2d=makeFloatClutMpeTag(3,4,([x,y,z])=>[0,0,0,1-y]);
  return makeIccProfileWithTags([{signature:'D2B1',data:d2b},{signature:'B2D1',data:b2d}],{pcs:'XYZ '});
}

test('Stage 13c executes MPE cvst curve sets before downstream CLUT elements',()=>{
  const transform=createCmykToSrgbTransform(makeMpeCurveSetCmykLabProfile());
  assert.equal(transform.managed,true);
  assert.equal(transform.method,'icc-mpe');
  const middle=transform.apply(0,0,0,.5);
  assert.ok(middle.every(value=>value>.70&&value<.80),'K=.5 is squared to .25 before neutral Lab CLUT');
});

test('Stage 13c executes lutBToAType mBA for profile-managed sRGB editing colours',()=>{
  const transform=createSrgbToCmykTransform(makeMbaCmykXyzProfile(),{intent:'relative'});
  assert.equal(transform.managed,true);
  assert.equal(transform.method,'icc-mba');
  const white=transform.apply(1,1,1),black=transform.apply(0,0,0);
  assert.ok(white[3]<.03);
  assert.ok(black[3]>.97);
});

test('Stage 13c builds profile-to-profile CMYK soft proof with ICC BPC plumbing',()=>{
  const profile=makeRoundTripCmykXyzProfile();
  const info=inspectCmykIccProfile(profile);
  assert.equal(info.colorSpace,'CMYK');
  assert.deepEqual(info.tags,['B2D1','D2B1']);
  const editing=createSrgbToCmykTransform(profile,{intent:'relative'});
  assert.equal(editing.managed,true);
  assert.equal(editing.method,'icc-b2d-mpe');
  assert.ok(editing.apply(1,1,1)[3]<.03);
  assert.ok(editing.apply(0,0,0)[3]>.97);

  const proof=createCmykSoftProofTransform(profile,profile,{intent:'relative',blackPointCompensation:true});
  assert.equal(proof.managed,true);
  assert.equal(proof.softProof,true);
  assert.equal(proof.blackPointCompensation,true);
  assert.ok(proof.apply(0,0,0,0).every(value=>value>.97));
  assert.ok(proof.apply(0,0,0,1).every(value=>value<.03));
});

test('Stage 13c keeps explicit fallbacks when proof/output transforms are unavailable',()=>{
  const source=makeMft1CmykLabProfile();
  const editing=createSrgbToCmykTransform(source,{intent:'relative'});
  assert.equal(editing.managed,false);
  assert.match(editing.warning,/Device-CMYK fallback/);
  const proof=createCmykSoftProofTransform(source,source,{intent:'relative',blackPointCompensation:true});
  assert.equal(proof.softProof,false);
  assert.match(proof.warning,/Soft proof недоступен/);
});
