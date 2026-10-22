import test from 'node:test';
import assert from 'node:assert/strict';
import {createPixelBuffer,serializeTiledPixelBufferSource} from '../src/core/pixel-buffer.js';
import {prepareTiledInpaintWithWorker} from '../src/painting/tiled-inpaint-dispatch.js';
function fixture(depth){
 const width=16,height=16,channels=4;
 const data=depth===32?new Float32Array(width*height*channels):new Uint16Array(width*height*channels);
 for(let i=0;i<width*height;i++)data[i*channels+3]=depth===32?1:65535;
 return serializeTiledPixelBufferSource(createPixelBuffer({
   width,height,model:'rgb',channels,bitsPerChannel:depth,colorSpace:'srgb',data,
 }),{tileSize:8});
}
for(const depth of [16,32]){
 test('003W/3: native RGB'+depth+' exact scan boundaries preserve source',async()=>{
   const source=fixture(depth),before=JSON.stringify(source),events=[];
   let job;
   const result=await prepareTiledInpaintWithWorker(source,{
     worker:{async run(value){job=value;return {cancelled:true};}},
     isAllowed:(x,y)=>x===4&&y===7,scanChunkPixels:17,yieldControl:async()=>{},
     onTiming:e=>events.push(e),
   });
   assert.equal(result.cancelled,true);
   assert.deepEqual([...job.selectedIndices],[7*16+4]);
   assert.deepEqual(events.map(e=>e.phase),['selection-start','selection-end','worker-run-start']);
   assert.deepEqual(events.map(e=>e.selectedPixels),[null,1,1]);
   assert.ok(events.every(e=>Number.isFinite(e.atMs)));
   assert.ok(events[0].atMs<=events[1].atMs&&events[1].atMs<=events[2].atMs);
   assert.equal(JSON.stringify(source),before);
 });
 test('003W/3: native RGB'+depth+' observer failure preserves cap and cancellation',async()=>{
   const source=fixture(depth),observer=()=>{throw Error('instrumentation-failure');};
   let runs=0;
   const worker={async run(){runs++;return {cancelled:true};}};
   const ok=await prepareTiledInpaintWithWorker(source,{
     worker,isAllowed:(x,y)=>x===1&&y===1,onTiming:observer,
   });
   assert.equal(ok.cancelled,true);assert.equal(runs,1);
   await assert.rejects(prepareTiledInpaintWithWorker(source,{
     worker,isAllowed:(x,y)=>y===1&&x<3,maxFillPixels:2,onTiming:observer,
   }),/безопасного лимита/);
   assert.equal(runs,1);
   let stopped=false;const events=[];
   const cancelled=await prepareTiledInpaintWithWorker(source,{
     worker,isAllowed:()=>true,isCancelled:()=>stopped,scanChunkPixels:17,
     yieldControl:async()=>{stopped=true;},onTiming:e=>events.push(e),
   });
   assert.equal(cancelled.cancelled,true);
   assert.deepEqual(events.map(e=>e.phase),['selection-start']);
   assert.equal(runs,1);
 });
}
