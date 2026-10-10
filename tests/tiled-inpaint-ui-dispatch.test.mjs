import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer,
  inpaintTiledPixelBufferSourceFromIndices,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';
import { createRasterEditController } from '../src/painting/controller.js';

function fixture() {
  const width = 16, height = 16, channels = 5;
  const data = new Float32Array(width * height * channels);
  for (let i = 0; i < width * height; i += 1) data.set([0.1,0.2,0.3,0.4,1],i * channels);
  data.set([9,9,9,9,1],(7 * width + 7) * channels);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, model:'cmyk', channels, bitsPerChannel:32,
    colorSpace:'device-cmyk', data,
  }), { tileSize:8 });
}

test('UI Worker handoff freezes a single selection snapshot with native CMYKA parity', async () => {
  const source = fixture();
  const before = JSON.stringify(source);
  const seen = new Set(), calls = [];
  const expected = inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:Uint32Array.of(7 * source.width + 7),
  });
  const result = await prepareTiledInpaintWithWorker(source, {
    worker:{ async run(job, options) {
      calls.push(job);
      assert.equal(options.isCurrent(), true);
      assert.ok(job.selectedIndices instanceof Uint32Array);
      return inpaintTiledPixelBufferSourceFromIndices(job.source, job);
    } },
    isAllowed:(x,y) => {
      const index = y * source.width + x;
      assert.ok(!seen.has(index), 'selection sampled at most once');
      seen.add(index);
      return x === 7 && y === 7;
    },
    scanChunkPixels:17,
    yieldControl:async () => {},
  });
  assert.equal(calls.length, 1);
  assert.equal(seen.size, source.width * source.height);
  assert.deepEqual([...calls[0].selectedIndices], [7 * source.width + 7]);
  assert.deepEqual(result, expected);
  assert.equal(JSON.stringify(source), before, 'worker input source stays immutable');
});

test('unavailable Worker falls back to the same frozen indices, never double-samples geometry', async () => {
  const source = fixture();
  let sampled = 0;
  const expected = inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:[7 * source.width + 7],
  });
  const result = await prepareTiledInpaintWithWorker(source, {
    worker:{ async run() { return { unavailable:true }; } },
    isAllowed:(x,y) => { sampled++; return x === 7 && y === 7; },
  });
  assert.equal(sampled, source.width * source.height);
  assert.deepEqual(result, expected);
});

test('scan cancellation prevents Worker creation, preview, or tile mutation', async () => {
  const source = fixture();
  let sampled = 0, cancelled = false, dispatched = 0;
  const result = await prepareTiledInpaintWithWorker(source, {
    worker:{ async run() { dispatched++; throw Error('must not dispatch'); } },
    isAllowed:() => { sampled++; return true; },
    isCancelled:() => cancelled,
    scanChunkPixels:17,
    yieldControl:async () => { cancelled = true; },
  });
  assert.equal(sampled, 17);
  assert.equal(dispatched, 0);
  assert.equal(result.cancelled, true);
  assert.equal(result.source, source);
});

test('empty/full selection bypasses Worker; compute errors never become fallback', async () => {
  const source = fixture();
  let dispatched = 0;
  const worker = { async run() { dispatched++; throw Error('kernel-failure'); } };
  for (const allowed of [() => false, () => true]) {
    const result = await prepareTiledInpaintWithWorker(source, { worker, isAllowed:allowed });
    assert.equal(result.changed, 0);
  }
  assert.equal(dispatched, 0);
  await assert.rejects(prepareTiledInpaintWithWorker(source, {
    worker, isAllowed:(x,y) => x === 7 && y === 7,
  }), /kernel-failure/);
  assert.equal(dispatched, 1);
});

test('raster owner switch while Worker runs discards late result without preview/publication', async () => {
  const source = fixture();
  const layer = {id:'tile',type:'raster',locked:false,groupId:null,
    width:16,height:16,highDepthSource:source,dataUrl:null,
    filters:{},highDepthPreview:null};
  const owner = {width:16,height:16,layers:[layer],groups:[]};
  let active = owner, started;
  const begun = new Promise(resolve => { started = resolve; });
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const worker = {
    async run(job, {isCurrent}) {
      started();
      await waiting;
      assert.equal(isCurrent(), false);
      return inpaintTiledPixelBufferSourceFromIndices(job.source, job);
    },
    cancel() {},
  };
  const editor = createRasterEditController({
    getDocument:()=>active, tiledInpaintWorker:worker,
    documentRef:{createElement(){throw Error('stale preview must not render');}},
  });
  const pending = editor.persistTiledHighDepthInpaint(owner,layer,{
    isAllowed:(x,y)=>x===7&&y===7,
  });
  await begun;
  active = {width:16,height:16,layers:[],groups:[]};
  release();
  const outcome = await pending;
  assert.equal(outcome.stale, true);
  assert.equal(outcome.applied, false);
  assert.equal(layer.highDepthSource,source);
  assert.equal(layer.dataUrl,null);
});
