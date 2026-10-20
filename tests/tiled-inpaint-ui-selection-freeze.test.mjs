import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  createPixelBuffer,
  serializeTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
} from '../src/core/pixel-buffer.js';
import {prepareTiledInpaintWithWorker} from '../src/painting/tiled-inpaint-dispatch.js';

function sourceFixture({bitsPerChannel=16,model='rgb'}={}) {
  const width=16,height=16,channels=model==='cmyk'?5:4;
  const data=bitsPerChannel===32
    ? new Float32Array(width*height*channels)
    : new Uint16Array(width*height*channels);
  for(let i=0;i<width*height;i++){
    const offset=i*channels;
    for(let c=0;c<channels;c++)data[offset+c]=bitsPerChannel===32
      ? (c===channels-1?1:((i+c)%17)/16)
      : (c===channels-1?65535:(i*257+c*1000)%65536);
  }
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width,height,channels,model,bitsPerChannel,
    colorSpace:model==='cmyk'?'device-cmyk':'srgb',data,
  }),{tileSize:8});
}
const localIndex=(x,y,w)=>y*w+x;

test('003U: the UI freeze contains no number-array of selected indices or full-array conversion',async()=>{
  const code=await readFile(new URL('../src/painting/tiled-inpaint-dispatch.js',import.meta.url),'utf8');
  assert.doesNotMatch(code,/\b(?:const|let|var)\s+indices\s*=\s*\[\s*\]/);
  assert.doesNotMatch(code,/Uint32Array\.from\s*\(\s*indices\s*\)/);
  assert.match(code,/new Uint32Array\(capacity\)/);
});

test('003U: sparse RGB16 selection emits exact-size ascending typed indices and preserves native bytes',async()=>{
  const source=sourceFixture();
  const frozen=JSON.stringify(source);
  const selection=[2,31,80,255];
  let dispatched=0;
  const result=await prepareTiledInpaintWithWorker(source,{
    worker:{async run(job){
      dispatched++;
      assert.ok(job.selectedIndices instanceof Uint32Array);
      assert.equal(job.selectedIndices.length,selection.length);
      assert.equal(job.selectedIndices.byteLength,selection.length*4);
      assert.deepEqual([...job.selectedIndices],selection);
      assert.equal(job.maxFillPixels,2000000);
      return inpaintTiledPixelBufferSourceFromIndices(job.source,job);
    }},
    isAllowed:(x,y)=>selection.includes(localIndex(x,y,source.width)),
    scanChunkPixels:19,yieldControl:async()=>{},
  });
  const expected=inpaintTiledPixelBufferSourceFromIndices(source,{
    selectedIndices:new Uint32Array(selection),
  });
  assert.equal(dispatched,1);
  assert.deepEqual(result,expected);
  assert.equal(JSON.stringify(source),frozen);
});

test('003U: dense near-limit CMYKA32 freeze grows to exact typed size without truncation',async()=>{
  const source=sourceFixture({bitsPerChannel:32,model:'cmyk'});
  const indices=Array.from({length:121},(_,i)=>i*2);
  const before=JSON.stringify(source);
  const result=await prepareTiledInpaintWithWorker(source,{
    maxFillPixels:121,
    worker:{async run(job){
      assert.equal(job.selectedIndices.byteLength,indices.length*4);
      assert.deepEqual([...job.selectedIndices],indices);
      return inpaintTiledPixelBufferSourceFromIndices(job.source,job);
    }},
    isAllowed:(x,y)=>localIndex(x,y,16)%2===0 && localIndex(x,y,16)<242,
    scanChunkPixels:31,yieldControl:async()=>{},
  });
  assert.deepEqual(result,inpaintTiledPixelBufferSourceFromIndices(source,{
    selectedIndices:new Uint32Array(indices),maxFillPixels:121,
  }));
  assert.equal(JSON.stringify(source),before);
});

test('003U: empty and full selection remain no-ops even if full selection exceeds cap',async()=>{
  const source=sourceFixture();
  for(const allowed of [()=>false,()=>true]){
    let count=0,workerCalls=0;
    const result=await prepareTiledInpaintWithWorker(source,{
      maxFillPixels:1,
      worker:{async run(){workerCalls++;throw Error('must not run');}},
      isAllowed:(x,y)=>{count++;return allowed(x,y);},
    });
    assert.equal(count,256);
    assert.equal(workerCalls,0);
    assert.equal(result.source,source);
    assert.equal(result.changed,0);
  }
});

test('003U: partial over-limit and unsafe maxFillPixels fail closed without Worker',async()=>{
  const source=sourceFixture();
  let calls=0,scan=0;
  const worker={async run(){calls++;throw Error('must not run');}};
  await assert.rejects(prepareTiledInpaintWithWorker(source,{
    maxFillPixels:2,worker,isAllowed:(x,y)=>{scan++;return localIndex(x,y,16)<3;},
  }),/безопасного лимита/);
  assert.equal(scan,256);
  for(const bad of [0,-1,0.5,NaN,Infinity,'3',Number.MAX_SAFE_INTEGER+1]){
    scan=0;
    await assert.rejects(prepareTiledInpaintWithWorker(source,{
      maxFillPixels:bad,worker,isAllowed:()=>{scan++;return true;},
    }),/unsafe selection size or maxFillPixels/);
    assert.equal(scan,0);
  }
  assert.equal(calls,0);
});

test('003U: cancellation after a cooperative yield never dispatches partial frozen selection',async()=>{
  const source=sourceFixture();
  let samples=0,yields=0,dispatched=0,stop=false;
  const result=await prepareTiledInpaintWithWorker(source,{
    worker:{async run(){dispatched++;throw Error('must not run');}},
    isAllowed:()=>{samples++;return true;},
    isCancelled:()=>stop,scanChunkPixels:17,
    yieldControl:async()=>{yields++;stop=true;},
  });
  assert.equal(samples,17);
  assert.equal(yields,1);
  assert.equal(dispatched,0);
  assert.equal(result.cancelled,true);
  assert.equal(result.source,source);
});

test('003U: Worker-unavailable fallback uses frozen CMYKA32 selection when live predicate changes',async()=>{
  const source=sourceFixture({bitsPerChannel:32,model:'cmyk'});
  const before=JSON.stringify(source);
  let live=new Set([15,65,107]),scanned=0,dispatched=0;
  const result=await prepareTiledInpaintWithWorker(source,{
    worker:{async run(job){
      dispatched++;
      assert.deepEqual([...job.selectedIndices],[15,65,107]);
      live.clear(); // mutate UI selection after freeze but before unavailable reply
      return {unavailable:true};
    }},
    isAllowed:(x,y)=>{scanned++;return live.has(localIndex(x,y,16));},
    scanChunkPixels:49,yieldControl:async()=>{},
  });
  assert.equal(dispatched,1);
  assert.equal(scanned,256,'selection predicate must not be re-sampled during fallback');
  assert.deepEqual(result,inpaintTiledPixelBufferSourceFromIndices(source,{
    selectedIndices:Uint32Array.of(15,65,107),
  }));
  assert.equal(JSON.stringify(source),before);
});
