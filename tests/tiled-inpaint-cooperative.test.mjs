import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer,
  deserializePixelBufferSource,
  inpaintTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
  inpaintTiledPixelBufferSourceCooperative,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { createRasterEditController } from '../src/painting/controller.js';

function fixture(width = 16, height = 160) {
  const channels = 5;
  const data = new Float32Array(width * height * channels);
  for (let i = 0; i < width * height; i += 1) {
    data.set([0.12, 0.23, 0.34, 0.45, 1], i * channels);
  }
  const damaged = (Math.floor(height / 2) * width + 7) * channels;
  data.set([9, 9, 9, 9, 1], damaged);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'cmyk', channels, bitsPerChannel:32,
    colorSpace:'device-cmyk', data,
  }), { tileSize:8 });
}

test('Stage 003: cooperative scan yields and matches synchronous cross-tile inpaint with a one-shot predicate', async () => {
  const source = fixture();
  const before = source.tiles.map(tile => tile.dataUrl);
  const seen = new Set();
  let yields = 0;
  const ySelected = Math.floor(source.height / 2);
  const result = await inpaintTiledPixelBufferSourceCooperative(source, {
    isAllowed:(x, y) => {
      const index = y * source.width + x;
      assert.equal(seen.has(index), false, 'selection was sampled twice');
      seen.add(index);
      return y === ySelected && (x === 7 || x === 8);
    },
    scanChunkPixels:137,
    yieldControl:async () => { yields += 1; },
    halo:2,
  });
  const synchronous = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => y === ySelected && (x === 7 || x === 8),
    halo:2,
  });
  assert.ok(yields > 1);
  assert.equal(seen.size, source.width * source.height);
  assert.equal(result.filled, 2);
  assert.equal(result.changed, 1, 'only the damaged tile needs new payload bytes');
  assert.deepEqual(result.source, synchronous.source);
  assert.ok(result.source.tiles.some((tile, index) => tile.dataUrl !== before[index]));
  assert.ok(source.tiles.every((tile, index) => tile.dataUrl === before[index]));
  const restored = deserializePixelBufferSource(result.source);
  const badSample = (ySelected * source.width + 7) * 5;
  assert.notEqual(restored.data[badSample], 9);
});

test('Stage 003: cooperative scan cancels before tile decode or source publication', async () => {
  const source = fixture();
  const json = JSON.stringify(source);
  let cancelled = false;
  let yielded = 0;
  let sampled = 0;
  const result = await inpaintTiledPixelBufferSourceCooperative(source, {
    isAllowed:() => { sampled += 1; return true; },
    scanChunkPixels:64,
    yieldControl:async () => { yielded += 1; cancelled = true; },
    isCancelled:() => cancelled,
  });
  assert.equal(yielded, 1);
  assert.equal(sampled, 64);
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.source, source);
  assert.equal(JSON.stringify(source), json);
});

test('Stage 003: document replacement during a long scan aborts without preview or mutation', async () => {
  const source = fixture(256, 256);
  const layer = {
    id:'tiled', type:'raster', locked:false, groupId:null,
    width:256, height:256, highDepthSource:source, dataUrl:null,
    filters:{}, highDepthPreview:null,
  };
  const owner = { width:256, height:256, layers:[layer], groups:[] };
  let liveDoc = owner;
  let predicateCalls = 0;
  const controller = createRasterEditController({
    getDocument:() => liveDoc,
    documentRef:{ createElement() { throw new Error('stale job must not build a preview'); } },
  });
  const pending = controller.persistTiledHighDepthInpaint(owner, layer, {
    isAllowed:(x, y) => { predicateCalls += 1; return x === 7 && y === 128; },
  });
  // The first 32,768 coordinates are frozen synchronously, then the scan yields.
  liveDoc = { width:256, height:256, layers:[], groups:[] };
  const result = await pending;
  assert.equal(predicateCalls, 32_768);
  assert.equal(result.applied, false);
  assert.equal(result.stale, true);
  assert.equal(result.changed, 0);
  assert.equal(layer.highDepthSource, source);
  assert.equal(layer.dataUrl, null);
});

test('Stage 003: cooperative ROI boundaries preserve exact parity and atomic cancellation', async () => {
  const width=256,height=16,channels=3;
  const data=new Uint16Array(width*height*channels).fill(10000);
  for(const x of [7,248]) data.fill(60000,(7*width+x)*channels,(7*width+x+1)*channels);
  const source=serializeTiledPixelBufferSource(createPixelBuffer({
    width,height,model:'rgb',channels,bitsPerChannel:16,colorSpace:'srgb',data,
  }),{tileSize:8}), snapshot=JSON.stringify(source);
  const isAllowed=(x,y)=>y===7&&(x===7||x===248);
  const opts={halo:2,maxLayerPixels:64,scanChunkPixels:width*height};
  const oracle=inpaintTiledPixelBufferSource(source,{...opts,isAllowed});
  let yields=0,samples=0;
  const complete=await inpaintTiledPixelBufferSourceCooperative(source,{
    ...opts,isAllowed:(x,y)=>{samples++;return isAllowed(x,y);},
    yieldControl:async()=>{yields++;},
  });
  assert.equal(yields,2,'yield once for each isolated ROI');
  assert.equal(samples,width*height,'selection sampled only once');
  assert.deepEqual(complete,oracle);
  yields=0;
  let cancelled=false;
  const result=await inpaintTiledPixelBufferSourceCooperative(source,{
    ...opts,isAllowed,isCancelled:()=>cancelled,
    yieldControl:async()=>{yields++;cancelled=true;},
  });
  assert.equal(yields,1,'cancel before second ROI');
  assert.equal(result.cancelled,true);
  assert.equal(result.changed,0);
  assert.equal(result.changedTiles,0);
  assert.equal(result.loadedTiles,0);
  assert.equal(result.source,source);
  assert.equal(JSON.stringify(source),snapshot,'never publish partially computed tiles');
});

test('Stage 003: single-ROI fallback cancellation before serialization preserves source', async () => {
  const source=fixture(),snapshot=JSON.stringify(source),y=Math.floor(source.height/2);
  let yields=0,cancelled=false;
  const result=await inpaintTiledPixelBufferSourceCooperative(source,{
    isAllowed:(x,row)=>row===y&&x===7,
    scanChunkPixels:source.width*source.height,halo:2,
    isCancelled:()=>cancelled,
    yieldControl:async()=>{yields++;cancelled=true;},
  });
  assert.equal(yields,1);
  assert.equal(result.cancelled,true);
  assert.equal(result.changed,0);
  assert.equal(result.source,source);
  assert.equal(JSON.stringify(source),snapshot);
});

test('Stage 003: frozen-index cooperative fallback is identical and cancels between disconnected ROIs', async () => {
  const width = 256, height = 16, channels = 3;
  const data = new Uint16Array(width * height * channels).fill(10000);
  const indices = [7 * width + 7, 7 * width + 248];
  for (const index of indices) data.fill(60000, index * channels, (index + 1) * channels);
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'rgb', channels, bitsPerChannel:16, data,
  }), { tileSize:8 });
  const snapshot = JSON.stringify(source);
  const opts = { selectedIndices:Uint32Array.from(indices), halo:2, maxLayerPixels:64 };
  const expected = inpaintTiledPixelBufferSourceFromIndices(source, opts);
  let yields = 0;
  const complete = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...opts, yieldControl:async () => { yields++; },
  });
  assert.deepEqual(complete, expected);
  assert.equal(yields, 3, 'one pre-ROI yield plus two ROI-boundary yields');
  assert.equal(JSON.stringify(source), snapshot);
  let cancelled = false;
  yields = 0;
  const stopped = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...opts,
    isCancelled:() => cancelled,
    yieldControl:async () => { yields++; if (yields === 2) cancelled = true; },
  });
  assert.equal(yields, 2, 'cancellation after first private ROI');
  assert.equal(stopped.cancelled, true);
  assert.equal(stopped.changed, 0);
  assert.equal(stopped.loadedTiles, 0);
  assert.equal(stopped.source, source);
  assert.equal(JSON.stringify(source), snapshot);
  await assert.rejects(inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...opts, selectedIndices:[indices[0], indices[0]],
  }), /duplicate selected index/);
});


test('Stage 003: large single ROI yields during native synthesis and matches synchronous Uint16 tiles', async () => {
  const width = 256, height = 256, channels = 3;
  const data = new Uint16Array(width * height * channels).fill(12000);
  const center = 128 * width + 128;
  data.fill(60000, center * channels, (center + 1) * channels);
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'rgb', channels, bitsPerChannel:16, data,
  }), { tileSize:64 });
  const before = JSON.stringify(source);
  const opts = { selectedIndices:Uint32Array.of(center), halo:128 };
  const synchronous = inpaintTiledPixelBufferSourceFromIndices(source, opts);
  let yields = 0;
  const cooperative = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...opts, yieldControl:async () => { yields++; },
  });
  assert.ok(yields >= 3, 'pre-ROI, inner native synthesis, and final boundary yields');
  assert.deepEqual(cooperative, synchronous, 'all native tile bytes and counters stay identical');
  assert.equal(JSON.stringify(source), before, 'the immutable source never changes');
});

test('Stage 003: cancellation after entering a single ROI kernel discards every private tile', async () => {
  const width = 256, height = 256, channels = 5;
  const data = new Float32Array(width * height * channels);
  for (let index = 0; index < width * height; index++) data.set([0.1, 0.2, 0.3, 0.4, 1], index * channels);
  const center = 128 * width + 128;
  data.set([9, 9, 9, 9, 1], center * channels);
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'cmyk', channels, bitsPerChannel:32,
    colorSpace:'device-cmyk', data,
  }), { tileSize:64 });
  const before = JSON.stringify(source);
  let yields = 0, cancelled = false;
  const result = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    selectedIndices:Uint32Array.of(center), halo:128,
    isCancelled:() => cancelled,
    yieldControl:async () => { if (++yields === 2) cancelled = true; },
  });
  assert.equal(yields, 2, 'the first checkpoint is pre-ROI, the second is inside its native kernel');
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.changedTiles, 0);
  assert.equal(result.loadedTiles, 0);
  assert.equal(result.source, source);
  assert.equal(JSON.stringify(source), before, 'cancelled private ROI never mutates input tiles');
});

test('Stage 003: multi-tile ROI serialization cancels atomically and preserves synchronous high-depth parity', async () => {
  const width = 64, height = 64, channels = 3, indices = [];
  const data = new Uint16Array(width * height * channels).fill(10000);
  for (let row = 0; row < 6; row++) {
    for (let column = 0; column < 6; column++) {
      const index = (4 + row * 8) * width + (4 + column * 8);
      indices.push(index);
      data.fill(50000, index * channels, (index + 1) * channels);
    }
  }
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'rgb', channels, bitsPerChannel:16, data,
  }), { tileSize:8 });
  const snapshot = JSON.stringify(source);
  const options = { selectedIndices:Uint32Array.from(indices), halo:2 };
  const oracle = inpaintTiledPixelBufferSourceFromIndices(source, options);
  assert.equal(oracle.changedTiles, 36, 'each selected pixel dirties a different tile');
  let totalYields = 0;
  const complete = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...options, yieldControl:async () => { totalYields++; },
  });
  assert.ok(totalYields > 8, 'kernel, ROI and multi-tile serialization checkpoints must run');
  assert.deepEqual(complete, oracle);
  let cancelled = false, observedYields = 0;
  const stopped = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...options,
    isCancelled:() => cancelled,
    yieldControl:async () => {
      observedYields++;
      // The final eight yields in the successful run belong to serialization
      // of 36 changed tiles; cancel after several private payloads are encoded.
      if (observedYields === totalYields - 3) cancelled = true;
    },
  });
  assert.equal(observedYields, totalYields - 3);
  assert.equal(stopped.cancelled, true);
  assert.equal(stopped.changed, 0);
  assert.equal(stopped.changedTiles, 0);
  assert.equal(stopped.source, source);
  assert.equal(JSON.stringify(source), snapshot);
});
