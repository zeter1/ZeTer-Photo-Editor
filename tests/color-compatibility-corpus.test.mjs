import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createCmykToPcsTransform,
  createCmykToSrgbTransform,
  inspectCmykIccProfile,
  inspectDisplayIccProfile,
  cmykPixelBufferToRgba8Preview,
} from '../src/core/color-management.js';
import { decodePsd, encodePsd, inspectPsdHeader } from '../src/adapters/psd.js';

const fixtureRoot=new URL('./fixtures/color-management/',import.meta.url);

async function bytes(name){
  return new Uint8Array(await readFile(new URL(name,fixtureRoot)));
}
async function json(name){
  return JSON.parse(await readFile(new URL(name,fixtureRoot),'utf8'));
}
function sha256(value){
  return createHash('sha256').update(value).digest('hex');
}
function toRgb8(values){
  return values.map(value=>Math.round(Math.max(0,Math.min(1,value))*255));
}
function assertChannelsClose(actual,expected,tolerance,label){
  assert.equal(actual.length,expected.length,label+' channel count');
  actual.forEach((value,index)=>{
    assert.ok(Math.abs(value-expected[index])<=tolerance,`${label} channel ${index}: ${value} vs ${expected[index]} (tol ${tolerance})`);
  });
}
function assertFloatsClose(actual,expected,tolerance,label){
  assert.equal(actual.length,expected.length,label+' value count');
  actual.forEach((value,index)=>{
    assert.ok(Math.abs(value-expected[index])<=tolerance,`${label} value ${index}: ${value} vs ${expected[index]} (tol ${tolerance})`);
  });
}

test('Stage 13e corpus pins real third-party fixtures by size and SHA-256',async()=>{
  const manifest=await json('corpus-manifest.json');
  assert.equal(manifest.schemaVersion,1);
  for(const fixture of manifest.fixtures){
    const data=await bytes(fixture.file);
    assert.equal(data.byteLength,fixture.size,fixture.id+' size');
    assert.equal(sha256(data),fixture.sha256,fixture.id+' sha256');
    assert.match(fixture.sourceCommit,/^[0-9a-f]{40}$/);
    assert.match(fixture.sourceGitBlob,/^[0-9a-f]{40}$/);
  }
});

test('Stage 13e real CC0 ICC profiles stay within LittleCMS 2.19 golden tolerances',async()=>{
  const [source,display,golden]=await Promise.all([
    bytes('CGATS001Compat-v2-micro.icc'),
    bytes('DisplayP3-v4.icc'),
    json('lcms-2.19-golden.json'),
  ]);
  assert.equal(sha256(source),golden.profiles.source.sha256);
  assert.equal(sha256(display),golden.profiles.display.sha256);
  assert.deepEqual(inspectCmykIccProfile(source),{
    colorSpace:'CMYK',pcs:'Lab',tags:['A2B0','cprt','desc','wtpt'],
  });
  const displayInfo=inspectDisplayIccProfile(display);
  assert.equal(displayInfo.colorSpace,'RGB');
  assert.equal(displayInfo.pcs,'XYZ');
  assert.equal(displayInfo.method,'icc-display-matrix-trc');

  const pcs=createCmykToPcsTransform(source,{intent:'perceptual'});
  const srgb=createCmykToSrgbTransform(source,{intent:'perceptual'});
  const p3=createCmykToSrgbTransform(source,{intent:'perceptual',displayProfileBytes:display});
  assert.equal(pcs.managed,true);
  assert.equal(pcs.method,'icc-lut16');
  assert.equal(pcs.tag,'A2B0');
  assert.equal(srgb.managed,true);
  assert.equal(p3.displayProfileManaged,true);
  assert.equal(p3.displayMethod,'icc-display-matrix-trc');

  for(const vector of golden.vectors){
    const cmyk=vector.cmyk8.map(value=>value/255);
    const pcsValue=pcs.apply(...cmyk);
    assertFloatsClose(pcsValue.lab,vector.lab,.8,vector.id+' Lab');
    assertFloatsClose(pcsValue.xyz,vector.xyzD50,.01,vector.id+' XYZ D50');
    assertChannelsClose(toRgb8(srgb.apply(...cmyk)),vector.srgb8,2,vector.id+' sRGB');
    assertChannelsClose(toRgb8(p3.apply(...cmyk)),vector.displayP3_8,2,vector.id+' Display P3');
  }
});

test('Stage 13e decodes a real upstream CMYK PSD, runs its printer ICC, and preserves native raster/profile round-trip',async()=>{
  const [psdBytes,display]=await Promise.all([
    bytes('psd-tools-4x4-8bit-cmyk.psd'),
    bytes('DisplayP3-v4.icc'),
  ]);
  assert.deepEqual(inspectPsdHeader(psdBytes),{
    signature:'8BPS',version:1,channels:4,width:4,height:4,bitsPerChannel:8,colorMode:4,
  });
  const decoded=await decodePsd(psdBytes,{maxPixels:1024,maxLayers:20});
  assert.equal(decoded.colorMode,4);
  assert.equal(decoded.layers.length,1);
  const layer=decoded.layers[0];
  assert.equal(layer.width,4);
  assert.equal(layer.height,4);
  assert.equal(layer.pixelBuffer.model,'cmyk');
  assert.equal(layer.pixelBuffer.channels,5);
  assert.equal(layer.pixelBuffer.bitsPerChannel,8);
  assert.equal(decoded.iccProfile.colorSpace.trim(),'CMYK');
  assert.equal(decoded.iccProfile.pcs.trim(),'Lab');
  assert.equal(decoded.iccProfile.bytes.byteLength,557168);
  const profileInfo=inspectCmykIccProfile(decoded.iccProfile.bytes);
  assert.ok(profileInfo.tags.includes('A2B0'));
  assert.ok(profileInfo.tags.includes('B2A0'));

  const transform=createCmykToSrgbTransform(decoded.iccProfile.bytes,{intent:'perceptual',displayProfileBytes:display});
  assert.equal(transform.managed,true);
  assert.equal(transform.method,'icc-lut16');
  assert.equal(transform.displayProfileManaged,true);
  const preview=cmykPixelBufferToRgba8Preview(layer.pixelBuffer,transform);
  assert.equal(preview.length,4*4*4);
  const unique=new Set();
  for(let index=0;index<preview.length;index+=4)unique.add(preview.slice(index,index+3).join(','));
  assert.ok(unique.size>=4,'real CMYK fixture should render several distinct display colours');

  const encoded=encodePsd({
    width:decoded.width,
    height:decoded.height,
    colorMode:'cmyk',
    bitsPerChannel:8,
    compositePixelBuffer:layer.pixelBuffer,
    iccProfile:decoded.iccProfile.bytes,
    layers:[{
      name:layer.name,
      x:layer.x,
      y:layer.y,
      width:layer.width,
      height:layer.height,
      pixelBuffer:layer.pixelBuffer,
      opacity:layer.opacity,
      blendMode:layer.blendMode,
      visible:layer.visible,
    }],
  });
  const roundTrip=await decodePsd(encoded,{maxPixels:1024,maxLayers:20});
  assert.equal(sha256(roundTrip.iccProfile.bytes),sha256(decoded.iccProfile.bytes));
  assert.deepEqual(roundTrip.layers[0].pixelBuffer.data,layer.pixelBuffer.data);
});

test('Stage 13e decodes a real upstream layered PSB v2 with group, vector mask and embedded RGB ICC',async()=>{
  const psbBytes=await bytes('psd-tools-group.psb');
  assert.deepEqual(inspectPsdHeader(psbBytes),{
    signature:'8BPS',version:2,channels:3,width:100,height:200,bitsPerChannel:8,colorMode:3,
  });
  const decoded=await decodePsd(psbBytes,{maxPixels:100000,maxLayers:20});
  assert.equal(decoded.groups.length,1);
  assert.equal(decoded.groups[0].name,'Group 1');
  assert.equal(decoded.groups[0].blendMode,'pass-through');
  assert.equal(decoded.layers.length,2);
  const shape=decoded.layers.find(layer=>layer.name==='Shape 1');
  assert.ok(shape);
  assert.equal(shape.groupKey,decoded.groups[0].key);
  assert.ok(shape.vectorMask);
  assert.ok(shape.mask);
  assert.equal(decoded.iccProfile.colorSpace.trim(),'RGB');
  assert.equal(decoded.iccProfile.pcs.trim(),'XYZ');
  assert.equal(decoded.iccProfile.bytes.byteLength,3144);
});
