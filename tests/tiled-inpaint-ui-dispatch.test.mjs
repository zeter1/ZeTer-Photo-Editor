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

test('unavailable Worker cancellation before frozen ROI preserves atomic source', async () => {
  const source = fixture(), snapshot = JSON.stringify(source);
  let samples = 0, yields = 0, cancelled = false;
  const result = await prepareTiledInpaintWithWorker(source, {
    worker:{ async run() { return { unavailable:true }; } },
    isAllowed:(x,y) => { samples++; return x === 7 && y === 7; },
    scanChunkPixels:source.width * source.height,
    isCancelled:() => cancelled,
    yieldControl:async () => { yields++; cancelled = true; },
  });
  assert.equal(samples, source.width * source.height);
  assert.equal(yields, 1, 'fallback must yield before the ROI kernel');
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.loadedTiles, 0);
  assert.equal(result.source, source);
  assert.equal(JSON.stringify(source), snapshot);
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


test('detached Worker results fail closed on counters, native source metadata and unrelated tiles', async () => {
  const source = fixture(), snapshot = JSON.stringify(source);
  const selected = 7 * source.width + 7;
  const valid = inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:Uint32Array.of(selected),
  });
  assert.equal(valid.changedTiles, 1);
  const cases = [
    ['fractional change count', value => { value.changed = 1.5; }],
    ['counter exceeds frozen selection', value => { value.changed = 2; }],
    ['partially synthesized result', value => { value.filled = 0; }],
    ['incorrect dirty count', value => { value.changedTiles = 0; }],
    ['incorrect loaded count', value => { value.loadedTiles = 0; }],
    ['wrong native precision', value => { value.source.bitsPerChannel = 16; }],
    ['wrong color model', value => { value.source.model = 'rgb'; }],
    ['wrong alpha metadata', value => { value.source.alphaMode = 'none'; }],
    ['wrong tile coordinates', value => { value.source.tiles[0].x = 1; }],
    ['missing changed payload', value => { value.source.tiles[0].dataUrl = source.tiles[0].dataUrl; }],
    ['malformed changed tile payload', value => { value.source.tiles[0].dataUrl = 'data:broken'; }],
    ['changed unselected donor tile', value => {
      const old = value.source.tiles[1].dataUrl;
      const prefix = old.indexOf('base64,') + 'base64,'.length;
      // Replace the edited tile with its original bytes and mutate ONLY an
      // untouched donor tile: counters remain plausible, but provenance fails.
      value.source.tiles[0].dataUrl = source.tiles[0].dataUrl;
      value.source.tiles[1].dataUrl = old.slice(0, prefix) +
        (old[prefix] === 'A' ? 'B' : 'A') + old.slice(prefix + 1);
    }],
  ];
  for (const [name, corrupt] of cases) {
    const response = structuredClone(valid);
    corrupt(response);
    await assert.rejects(prepareTiledInpaintWithWorker(source, {
      worker:{ async run() { return response; } },
      isAllowed:(x,y) => y * source.width + x === selected,
    }), /invalid Worker result/, name);
    assert.equal(JSON.stringify(source), snapshot, name + ': immutable donor source');
  }
});

function rgb16Fixture() {
  const data = new Uint16Array(8 * 8 * 3);
  for (let pixel = 0; pixel < 64; pixel += 1) {
    data.set([10000, 20000, 30000], pixel * 3);
  }
  data.set([60000, 60000, 60000], (3 * 8 + 3) * 3);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:8, height:8, model:'rgb', channels:3, bitsPerChannel:16, data,
  }), { tileSize:8 });
}

function rewriteTileByte(tile, offset) {
  const prefix = tile.dataUrl.indexOf('base64,') + 'base64,'.length;
  const bytes = Buffer.from(tile.dataUrl.slice(prefix), 'base64');
  bytes[offset] ^= 1;
  tile.dataUrl = tile.dataUrl.slice(0, prefix) + bytes.toString('base64');
}

test('UI Worker rejects unselected pixels changed inside an otherwise editable RGB16 or CMYKA32 tile', async () => {
  for (const [name, source, x, y, neighborX, neighborY] of [
    ['RGB16', rgb16Fixture(), 3, 3, 2, 3],
    ['CMYKA32', fixture(), 7, 7, 6, 7],
  ]) {
    const snapshot = JSON.stringify(source);
    const index = y * source.width + x;
    const valid = inpaintTiledPixelBufferSourceFromIndices(source, {
      selectedIndices:Uint32Array.of(index),
    });
    assert.equal(valid.changed, 1, name + ': baseline changes only selected pixel');
    assert.equal(valid.changedTiles, 1, name + ': baseline changes one tile');
    const tainted = structuredClone(valid);
    const tile = tainted.source.tiles[0];
    const sampleBytes = source.channels * source.bitsPerChannel / 8;
    const byteOffset = ((neighborY - tile.y) * tile.width + neighborX - tile.x) * sampleBytes;
    rewriteTileByte(tile, byteOffset);
    // Counters and all metadata are unchanged; only the selected tile's donor
    // pixel differs. The previous tile-only validator accepted this payload.
    await assert.rejects(prepareTiledInpaintWithWorker(source, {
      worker:{async run() { return tainted; }},
      isAllowed:(px,py) => px === x && py === y,
    }), /invalid Worker result/, name);
    assert.equal(JSON.stringify(source), snapshot, name + ': original remains byte-identical');
  }
});

test('UI Worker compares actual native changed-pixel count with reply counters', async () => {
  const source = fixture();
  const selected = [7 * source.width + 6, 7 * source.width + 7];
  const valid = inpaintTiledPixelBufferSourceFromIndices(source, { selectedIndices:selected });
  assert.ok(valid.changed >= 1 && valid.changed <= 2);
  assert.equal(valid.changedTiles, 1);
  const tainted = structuredClone(valid);
  tainted.changed = valid.changed === 1 ? 2 : 1;
  assert.ok(tainted.changed <= tainted.filled && tainted.changedTiles <= tainted.changed);
  await assert.rejects(prepareTiledInpaintWithWorker(source, {
    worker:{async run() { return tainted; }},
    isAllowed:(x,y) => selected.includes(y * source.width + x),
  }), /invalid Worker result/);
});

test('UI Worker rejects alternate Base64 pad bits even when decoded tile bytes match', async () => {
  const source = fixture();
  const selected = 7 * source.width + 7;
  const valid = inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:[selected],
  });
  const tainted = structuredClone(valid), tile = tainted.source.tiles[0];
  const original = tile.dataUrl;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  assert.ok(original.endsWith('=') && !original.endsWith('=='));
  const location = original.length - 2;
  const value = alphabet.indexOf(original[location]);
  assert.equal(value & 3, 0, 'canonical one-pad base64 has zero unused bits');
  tile.dataUrl = original.slice(0, location) + alphabet[value | 1] + original.slice(location + 1);
  assert.deepEqual(Buffer.from(tile.dataUrl.slice(tile.dataUrl.indexOf('base64,') + 7), 'base64'),
    Buffer.from(original.slice(original.indexOf('base64,') + 7), 'base64'));
  await assert.rejects(prepareTiledInpaintWithWorker(source, {
    worker:{async run() { return tainted; }},
    isAllowed:(x,y) => y * source.width + x === selected,
  }), /invalid Worker result/);
});

test('037C-3b-3: malformed native alpha/Float32 replies fail closed before preview or History', async () => {
  const source = fixture(), snapshot = JSON.stringify(source);
  const index = 7 * source.width + 7;
  const valid = inpaintTiledPixelBufferSourceFromIndices(source, {
    selectedIndices:Uint32Array.of(index),
  });
  const corruptions = [
    ['alpha changed in selected CMYKA32 pixel', bytes => bytes.writeFloatLE(0.25, (7 * 8 + 7) * 20 + 16)],
    ['NaN in selected C channel', bytes => bytes.writeFloatLE(NaN, (7 * 8 + 7) * 20)],
    ['Infinity in selected M channel', bytes => bytes.writeFloatLE(Infinity, (7 * 8 + 7) * 20 + 4)],
  ];
  for (const [name, corrupt] of corruptions) {
    const reply = structuredClone(valid);
    const tile = reply.source.tiles[0];
    const prefix = tile.dataUrl.indexOf('base64,') + 7;
    const bytes = Buffer.from(tile.dataUrl.slice(prefix), 'base64');
    corrupt(bytes);
    tile.dataUrl = tile.dataUrl.slice(0, prefix) + bytes.toString('base64');
    const layer = { id:'native', type:'raster', locked:false, groupId:null,
      width:source.width, height:source.height, highDepthSource:source,
      dataUrl:null, highDepthPreview:null, filters:{} };
    const document = { width:source.width,height:source.height,layers:[layer],groups:[] };
    const editor = createRasterEditController({
      getDocument:()=>document,
      tiledInpaintWorker:{async run() {return reply;}},
      documentRef:{createElement() {throw new Error('preview must not render');}},
    });
    await assert.rejects(editor.persistTiledHighDepthInpaint(document,layer,{
      isAllowed:(x,y)=>y * source.width + x === index,
    }), /invalid Worker result/, name);
    assert.equal(layer.highDepthSource,source,name + ': original native source retained');
    assert.equal(layer.dataUrl,null,name + ': no preview published');
    assert.equal(JSON.stringify(source),snapshot,name + ': byte-exact source');
  }
});

test('037C-3b-3: strict maxBytes rejects before sampling/Worker dispatch, then normal job recovers', async () => {
  for (const source of [rgb16Fixture(),fixture()]) {
    let sampled = 0,dispatched = 0;
    await assert.rejects(prepareTiledInpaintWithWorker(source,{
      maxBytes:source.rawBytes-1,
      worker:{async run(){dispatched++; throw new Error('unexpected Worker launch');}},
      isAllowed:()=>{sampled++;return true;},
    }), /serialized PixelBuffer source|лимит|working set/);
    assert.equal(sampled,0,'cap checked before touching selection');
    assert.equal(dispatched,0,'cap checked before creating Worker job');
    const selected = source.model === 'rgb' ? 3 * source.width + 3 : 7 * source.width + 7;
    const result = await prepareTiledInpaintWithWorker(source,{
      maxBytes:source.rawBytes,
      isAllowed:(x,y)=>y * source.width + x === selected,
      worker:{async run(job) {dispatched++;return inpaintTiledPixelBufferSourceFromIndices(job.source,job);}},
    });
    assert.equal(dispatched,1,'a refused job does not poison the next valid job');
    assert.ok(result.changed>0);
    assert.equal(result.source.rawBytes,source.rawBytes);
  }
});

test('037C-3b-3: mixed unavailable/native Worker result must not silently trigger CPU fallback', async () => {
  const source=fixture();
  let selected=0;
  await assert.rejects(prepareTiledInpaintWithWorker(source,{
    isAllowed:(x,y)=>{selected++;return x===7&&y===7;},
    worker:{async run(){return {unavailable:true, source};}},
  }),/invalid Worker result/);
  assert.equal(selected,source.width*source.height,'no repeated selection sampling');
});

test('over-budget native source fails before selection sampling or Worker, and retry succeeds', async () => {
  const source = fixture(), snapshot = JSON.stringify(source);
  let samples = 0, jobs = 0, yields = 0;
  const worker = { async run(job) {
    jobs++;
    return inpaintTiledPixelBufferSourceFromIndices(job.source, job);
  } };
  const options = {
    worker,
    isAllowed:(x,y) => { samples++; return x === 7 && y === 7; },
    yieldControl:async () => { yields++; },
  };
  for (const maxBytes of [source.rawBytes - 1, 0]) {
    await assert.rejects(prepareTiledInpaintWithWorker(source, {
      ...options, maxBytes,
    }), error => error instanceof RangeError &&
      error.message.startsWith('Контент-заливка: native source превышает'));
    assert.equal(samples, 0, 'no geometry sample on refused budget');
    assert.equal(yields, 0, 'no cooperative scan on refused budget');
    assert.equal(jobs, 0, 'no Worker job on refused budget');
    assert.equal(JSON.stringify(source), snapshot);
  }
  const success = await prepareTiledInpaintWithWorker(source, {
    ...options, maxBytes:source.rawBytes,
  });
  assert.equal(jobs, 1);
  assert.equal(samples, source.width * source.height);
  assert.equal(success.filled, 1);
  assert.ok(success.changed > 0);
  assert.equal(JSON.stringify(source), snapshot);
});
