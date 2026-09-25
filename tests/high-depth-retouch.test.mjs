import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPixelBuffer, clonePixelBuffer,
  applyPixelBufferToneDab, applyPixelBufferBlurDab, applyPixelBufferCloneDab, applyPixelBufferSmudgeDab,
  applyCmykPixelBufferBlurDab, applyCmykPixelBufferCloneDab, applyCmykPixelBufferSmudgeDab,
  serializePixelBufferSource, deserializePixelBufferSource,
} from '../src/core/pixel-buffer.js';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');

test('Stage 12f dodge/burn operates in high-depth working space and preserves Float32 HDR headroom',()=>{
  const buffer=createPixelBuffer({
    width:2,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([4,2,1,1, .5,.25,.125,.75]),
  });
  const coverage={width:2,tiles:new Map()};
  const changed=applyPixelBufferToneDab(buffer,.5,.5,1,.5,{brighten:true,strokeCoverage:coverage});
  assert.equal(changed,1);
  assert.ok(buffer.data[0]>4,'dodge must brighten values already above display white');
  assert.equal(buffer.data[3],1);
  const afterDodge=buffer.data[0];
  for(let i=0;i<10;i+=1)applyPixelBufferToneDab(buffer,.5,.5,1,.5,{brighten:true,strokeCoverage:coverage});
  assert.equal(buffer.data[0],afterDodge,'one stroke must not accumulate overlapping tone dabs');
  applyPixelBufferToneDab(buffer,.5,.5,1,.5,{brighten:false,strokeCoverage:{width:2,tiles:new Map()}});
  assert.ok(buffer.data[0]<afterDodge);
  assert.ok(buffer.data[0]>1);
});

test('Stage 12f blur edits Uint16 samples without quantizing them to 8-bit steps',()=>{
  const buffer=createPixelBuffer({
    width:3,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array([
      10001,20003,30007,65535,
      50009,40013,30011,32768,
      65003,1009,22003,65535,
    ]),
  });
  const alpha=[buffer.data[3],buffer.data[7],buffer.data[11]];
  const changed=applyPixelBufferBlurDab(buffer,1.5,.5,1.5,.35,{sampleRadius:1});
  assert.ok(changed>=2);
  assert.deepEqual([buffer.data[3],buffer.data[7],buffer.data[11]],alpha);
  assert.ok([...buffer.data].some((value,index)=>index%4!==3&&value%257!==0));
});

test('Stage 12f clone uses an immutable typed snapshot and can copy HDR samples',()=>{
  const buffer=createPixelBuffer({
    width:3,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([6,3,1.5,1, 1,1,1,1, .25,.5,.75,1]),
  });
  const snapshot=clonePixelBuffer(buffer);
  const changed=applyPixelBufferCloneDab(buffer,snapshot,2.5,.5,.75,{x:-2,y:0},{opacity:1});
  assert.equal(changed,1);
  assert.ok(buffer.data[8]>1);
  assert.ok(Math.abs(buffer.data[8]-6)<1e-5);
  assert.deepEqual([...snapshot.data],[6,3,1.5,1,1,1,1,1,.25,.5,.75,1]);
});

test('Stage 12f healing adapts clone texture toward destination neighborhood without clipping Float32',()=>{
  const buffer=createPixelBuffer({
    width:4,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([
      4,2,1,1,
      5,2.5,1.25,1,
      1,.5,.25,1,
      1.2,.6,.3,1,
    ]),
  });
  const snapshot=clonePixelBuffer(buffer);
  const changed=applyPixelBufferCloneDab(buffer,snapshot,3.5,.5,.75,{x:-2,y:0},{opacity:1,healing:true});
  assert.equal(changed,1);
  assert.ok(Number.isFinite(buffer.data[12]));
  assert.ok(buffer.data[12]>0);
  assert.equal(buffer.data[15],1);
});

test('Stage 12f smudge transports high-depth color while keeping source HDR data representable',()=>{
  const buffer=createPixelBuffer({
    width:3,height:1,model:'rgb',channels:4,bitsPerChannel:32,colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([8,4,2,1, 1,.5,.25,1, .1,.2,.3,1]),
  });
  const changed=applyPixelBufferSmudgeDab(buffer,{x:.5,y:.5},{x:1.5,y:.5},.8,.6);
  assert.equal(changed,1);
  assert.ok(buffer.data[4]>1);
  assert.equal(buffer.data[3],1);
  assert.equal(buffer.data[7],1);
});

test('Stage 12f retouch result survives canonical high-depth source serialization',()=>{
  const buffer=createPixelBuffer({
    width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array([12345,23456,34567,65535]),
  });
  applyPixelBufferToneDab(buffer,.5,.5,1,.37,{brighten:true});
  const restored=deserializePixelBufferSource(serializePixelBufferSource(buffer));
  assert.deepEqual([...restored.data],[...buffer.data]);
  assert.ok(restored.data.some((value,index)=>index<3&&value%257!==0));
});

test('Stage 12f routes blur, clone, heal, smudge, dodge and burn through native high-depth paint state',()=>{
  assert.match(main,/NATIVE_HIGH_DEPTH_PAINT_TOOLS = new Set\(\['brush','eraser','blur','clone','heal','smudge','dodge','burn'\]\)/);
  assert.match(main,/applyPixelBufferToneDab\(highDepthPaintBuffer/);
  assert.match(main,/applyCmykPixelBufferBlurDab:applyPixelBufferBlurDab/);
  assert.match(main,/applyCmykPixelBufferCloneDab:applyPixelBufferCloneDab/);
  assert.match(main,/applyCmykPixelBufferSmudgeDab:applyPixelBufferSmudgeDab/);
  assert.match(main,/prepareNativeHighDepthCloneStroke/);
  assert.match(main,/nativeHighDepthCloneSegment/);
  assert.match(main,/nativeHighDepthSmudgeSegment/);
  assert.match(main,/nativeHighDepthToneSegment/);
  assert.match(main,/nativeHighDepthBlurSegment/);
  assert.match(main,/NATIVE_HIGH_DEPTH_PAINT_TOOLS\.has\(paintTool\)/);
  assert.match(main,/if\(!layer\.highDepthSource\)await ensureRasterBuffer\(layer\)/);
});


test('Stage 13c blur preserves native 16-bit CMYK channel precision and alpha',()=>{
  const buffer=createPixelBuffer({
    width:3,height:1,model:'cmyk',channels:5,bitsPerChannel:16,colorSpace:'device-cmyk',alphaMode:'straight',
    data:new Uint16Array([
      10001,20003,30007,40009,65535,
      50009,40013,30011,20017,32768,
      65003,1009,22003,33007,65535,
    ]),
  });
  const alpha=[buffer.data[4],buffer.data[9],buffer.data[14]];
  const changed=applyCmykPixelBufferBlurDab(buffer,1.5,.5,1.5,.35,{sampleRadius:1});
  assert.ok(changed>=2);
  assert.deepEqual([buffer.data[4],buffer.data[9],buffer.data[14]],alpha);
  assert.ok([...buffer.data].some((value,index)=>index%5!==4&&value%257!==0));
});

test('Stage 13c CMYK clone/heal uses immutable typed source and preserves model',()=>{
  const buffer=createPixelBuffer({
    width:3,height:1,model:'cmyk',channels:5,bitsPerChannel:32,colorSpace:'device-cmyk',alphaMode:'straight',
    data:new Float32Array([
      .9,.1,.2,.3,1,
      .2,.3,.4,.5,1,
      .05,.05,.05,.8,1,
    ]),
  });
  const snapshot=clonePixelBuffer(buffer);
  const snapshotBefore=[...snapshot.data];
  const cloned=applyCmykPixelBufferCloneDab(buffer,snapshot,2.5,.5,.75,{x:-2,y:0},{opacity:1});
  assert.equal(cloned,1);
  assert.ok(Math.abs(buffer.data[10]-.9)<1e-5);
  assert.deepEqual([...snapshot.data],snapshotBefore);
  const healed=applyCmykPixelBufferCloneDab(buffer,snapshot,1.5,.5,.75,{x:-1,y:0},{opacity:.7,healing:true});
  assert.equal(healed,1);
  assert.ok([...buffer.data.slice(5,9)].every(Number.isFinite));
});

test('Stage 13c CMYK smudge transports native ink samples without RGB conversion',()=>{
  const buffer=createPixelBuffer({
    width:3,height:1,model:'cmyk',channels:5,bitsPerChannel:32,colorSpace:'device-cmyk',alphaMode:'straight',
    data:new Float32Array([
      .8,.4,.2,.1,1,
      .1,.1,.1,.1,1,
      .05,.2,.4,.7,1,
    ]),
  });
  const changed=applyCmykPixelBufferSmudgeDab(buffer,{x:.5,y:.5},{x:1.5,y:.5},.8,.6);
  assert.equal(changed,1);
  assert.ok(buffer.data[5]>.1);
  assert.equal(buffer.data[9],1);
});

test('Stage 13c routes blur, clone/heal and smudge natively for CMYK while keeping Dodge/Burn guarded',()=>{
  assert.match(main,/NATIVE_CMYK_PAINT_TOOLS = new Set\(\['brush','eraser','blur','clone','heal','smudge'\]\)/);
  assert.match(main,/highDepthPaintBuffer\.model==='cmyk'\?applyCmykPixelBufferBlurDab/);
  assert.match(main,/highDepthPaintBuffer\.model==='cmyk'\?applyCmykPixelBufferCloneDab/);
  assert.match(main,/highDepthPaintBuffer\.model==='cmyk'\?applyCmykPixelBufferSmudgeDab/);
  assert.match(main,/native CMYK source сохранён без изменений/);
});
