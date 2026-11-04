import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';

// 003W/2b-1: exercise the real 2M-pixel UI selection freeze, rather than
// inferring selected indices from a browser marquee's bounding box.
// This is a Node/production-dispatch integration test, NOT Chromium, a
// completed inpainting kernel, or an operation-exclusive memory measurement.
const WIDTH=1450, HEIGHT=1400, TOTAL=WIDTH*HEIGHT;
const CAP=2_000_000;
assert.equal(TOTAL,2_030_000);

function sourceFixture(bitsPerChannel) {
  const samples=bitsPerChannel===32
    ? new Float32Array(TOTAL*4) : new Uint16Array(TOTAL*4);
  for(let i=3;i<samples.length;i+=4) samples[i]=bitsPerChannel===32?1:65535;
  const buffer=createPixelBuffer({
    width:WIDTH,height:HEIGHT,channels:4,model:'rgb',bitsPerChannel,
    colorSpace:bitsPerChannel===32?'linear-rgb-unmanaged':'srgb',
    data:samples,
  });
  return serializeTiledPixelBufferSource(buffer,{tileSize:256});
}

function originalTilePayloads(source) {
  return source.tiles.map(tile=>tile.dataUrl);
}
function checkNativeUnchanged(source,baseline) {
  assert.deepEqual(source.tiles.map(tile=>tile.dataUrl),baseline,
    'Selection freeze must never mutate 16/32-bit source tile bytes');
}
function unchangedWorkerResult(job) {
  // Deliberately no-op kernel reply: this isolates genuine production
  // selection-index freezing + detached result shape validation. The full
  // browser suite independently tests real Worker changes and Undo/Redo.
  return {
    source:job.source,filled:job.selectedIndices.length,
    changed:0,changedTiles:0,loadedTiles:0,
  };
}

test('003W/2b-1: PSD16 dense partial selection freezes exactly 2,000,000 typed indices',async()=>{
  const source=sourceFixture(16),original=originalTilePayloads(source);
  let calls=0,predicates=0,yields=0;
  const result=await prepareTiledInpaintWithWorker(source,{
    maxFillPixels:CAP,
    scanChunkPixels:131_072,
    yieldControl:async()=>{yields++;},
    isAllowed:(x,y)=>{predicates++;return y*WIDTH+x<CAP;},
    worker:{async run(job){
      calls++;
      assert.ok(job.selectedIndices instanceof Uint32Array);
      assert.equal(job.selectedIndices.length,CAP);
      assert.equal(job.selectedIndices.byteLength,CAP*4);
      assert.equal(job.selectedIndices[0],0);
      assert.equal(job.selectedIndices[CAP-1],CAP-1);
      assert.equal(job.selectedIndices[CAP>>1],CAP>>1);
      assert.equal(job.selectedIndices[CAP-1]+1<TOTAL,true,
        'Near-cap selection must be partial, not the no-op full-canvas case');
      return unchangedWorkerResult(job);
    }},
  });
  assert.equal(predicates,TOTAL);
  assert.ok(yields>=1,'Large selection must cooperatively yield to the event loop');
  assert.equal(calls,1);
  assert.equal(result.filled,CAP);
  checkNativeUnchanged(source,original);
});

test('003W/2b-1: PSB32 sparse >2M-pixel geometry never reserves or dispatches dense indices',async()=>{
  const source=sourceFixture(32),original=originalTilePayloads(source);
  const expected=[0,WIDTH-1,WIDTH*(HEIGHT>>1),TOTAL-1];
  let calls=0,predicates=0;
  const result=await prepareTiledInpaintWithWorker(source,{
    maxFillPixels:CAP,
    isAllowed:(x,y)=>{predicates++;return expected.includes(y*WIDTH+x);},
    scanChunkPixels:65_536,yieldControl:async()=>{},
    worker:{async run(job){
      calls++;
      assert.ok(job.selectedIndices instanceof Uint32Array);
      assert.deepEqual([...job.selectedIndices],expected);
      assert.equal(job.selectedIndices.byteLength,expected.length*4);
      return unchangedWorkerResult(job);
    }},
  });
  assert.equal(predicates,TOTAL);
  assert.equal(calls,1);
  assert.equal(result.filled,expected.length);
  checkNativeUnchanged(source,original);
});

test('003W/2b-1: PSB32 2,000,001 selected pixels fail closed with zero Worker jobs',async()=>{
  const source=sourceFixture(32),original=originalTilePayloads(source);
  let calls=0,predicates=0;
  await assert.rejects(prepareTiledInpaintWithWorker(source,{
    maxFillPixels:CAP,
    isAllowed:(x,y)=>{predicates++;return y*WIDTH+x<=CAP;},
    scanChunkPixels:65_536,yieldControl:async()=>{},
    worker:{async run(){calls++;throw Error('over-cap selection dispatched Worker');}},
  }),/выделено больше безопасного лимита 2000000 px/);
  assert.equal(predicates,TOTAL,'Limit refusal must count actual selection through the final pixel');
  assert.equal(calls,0);
  checkNativeUnchanged(source,original);
});
