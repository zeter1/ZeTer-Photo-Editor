import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDng,decodeDng} from '../src/formats/dng.js';
import {dngCameraToLinearSrgb,applyDngColorMatrix} from '../src/formats/dng-color.js';
import {fixture} from './fixtures/dng-fixture.mjs';

const ID=[1,0,0,0,1,0,0,0,1];
const D50=[0.96422,1,0.82521];
const FM=[D50[0],0,0,0,1,0,0,0,D50[2]];
const MIX=[0.7,0.26422,0,0.2,0.8,0,0.1,0.2,0.52521];
const CC=[1,0.2,0,0,1,0,0,0,1];
const rgb=image=>[...image.rgba.slice(0,3)];

function entry(buffer,tag){
  const view=new DataView(buffer),le=view.getUint8(0)===73;
  for(let i=0,n=view.getUint16(8,le);i<n;i++)
    if(view.getUint16(10+i*12,le)===tag)return 10+i*12;
  throw new Error('missing tag '+tag);
}

test('ForwardMatrix maps camera-neutral white to D50 XYZ and linear neutral sRGB (II/MM)',()=>{
  for(const le of [true,false]){
    const raw=fixture({le,matrix1:ID,forward1:FM,neutral:[0.7,1,0.8],samples:[70,100,80]});
    const pristine=raw.slice(0),source=inspectDng(raw);
    assert.deepEqual(source.color.forward1,FM);
    const transform=dngCameraToLinearSrgb(source.color);
    const linear=applyDngColorMatrix(transform,0.7,1,0.8);
    assert.ok(Math.max(...linear)-Math.min(...linear)<0.003,JSON.stringify(linear));
    assert.equal(decodeDng(raw).colorPipeline,'forward-d50-v1');
    assert.deepEqual(new Uint8Array(raw),new Uint8Array(pristine));
  }
});

test('ForwardMatrix performs real RGB cross-channel transform, not ColorMatrix fallback',()=>{
  const base=fixture({matrix1:ID,samples:[90,55,20]});
  const forwarded=fixture({matrix1:ID,forward1:MIX,samples:[90,55,20]});
  assert.notDeepEqual(rgb(decodeDng(forwarded)),rgb(decodeDng(base)));
  assert.equal(decodeDng(forwarded).colorPipeline,'forward-d50-v1');
  assert.equal(decodeDng(base).colorPipeline,'matrix-d50-bradford-v1');
});

test('AnalogBalance and matching CameraCalibrationSignature affect DNG forward pixels; mismatch skips CC',()=>{
  const opts={matrix1:ID,forward1:MIX,neutral:[0.75,1,0.9],samples:[90,55,20],
    analogBalance:[1.25,0.8,1.1],calibration1:CC};
  const matched=inspectDng(fixture({...opts,cameraSignature:'sameSig',profileSignature:'sameSig'}));
  const mismatched=inspectDng(fixture({...opts,cameraSignature:'cameraSig',profileSignature:'otherSig'}));
  assert.notDeepEqual(rgb(decodeDng(matched.buffer)),rgb(decodeDng(mismatched.buffer)));
  const white=applyDngColorMatrix(dngCameraToLinearSrgb(matched.color),...matched.neutral);
  assert.ok(Math.max(...white)-Math.min(...white)<0.003,JSON.stringify(white));
  assert.equal(decodeDng(matched.buffer).colorPipeline,'forward-d50-v1');
});

test('ForwardMatrix1/2 dual calibration interpolates with AsShotNeutral, WB and keeps immutable DNG',()=>{
  const raw=fixture({matrix1:ID,matrix2:[0.96,0.04,0,0.05,0.95,0,0,0.05,0.95],
    forward1:FM,forward2:MIX,illuminant1:21,illuminant2:17,samples:[90,55,20]});
  const copy=raw.slice(0);
  const before=decodeDng(raw),after=decodeDng(raw,{wbRed:1.8,wbBlue:0.5});
  assert.notDeepEqual(rgb(before),rgb(after));
  assert.equal(after.colorPipeline,'forward-d50-v1');
  assert.deepEqual(new Uint8Array(raw),new Uint8Array(copy));
});

test('invalid ForwardMatrix/CC/AnalogBalance TIFF shape, denominator and signature fail closed',()=>{
  const args={matrix1:ID,forward1:FM};
  assert.throws(()=>inspectDng(fixture({...args,forward1:Array(9).fill(0)})),/ForwardMatrix/);
  assert.throws(()=>inspectDng(fixture({...args,analogBalance:[1,0,1]})),/AnalogBalance/);
  assert.throws(()=>inspectDng(fixture({...args,calibration1:Array(9).fill(1)})),/CameraCalibration/);
  assert.throws(()=>inspectDng(fixture({forward1:FM})),/ForwardMatrix|ColorMatrix/);
  for(const [tag,type] of [[50964,5],[50723,5],[50727,10]]){
    const raw=fixture({...args,calibration1:ID,analogBalance:[1,1,1]});
    const pos=entry(raw,tag),le=true;
    new DataView(raw).setUint16(pos+2,type,le);
    assert.throws(()=>inspectDng(raw),/ForwardMatrix|CameraCalibration|AnalogBalance/);
  }
  const wrong=fixture(args);
  new DataView(wrong).setUint32(entry(wrong,50964)+4,8,true);
  assert.throws(()=>inspectDng(wrong),/ForwardMatrix/);
  const zero=fixture(args),view=new DataView(zero);
  const off=view.getUint32(entry(zero,50964)+8,true);
  view.setInt32(off+4,0,true);
  assert.throws(()=>inspectDng(zero),/нулевой знаменатель/);
  const signature=fixture({...args,cameraSignature:'badSig',profileSignature:'badSig'});
  new DataView(signature).setUint8(entry(signature,50931)+2,4);
  assert.throws(()=>inspectDng(signature),/Signature/);
});
