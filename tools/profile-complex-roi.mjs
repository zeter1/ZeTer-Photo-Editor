// 010E-A: reproducible complex connected ROI diagnostic.
// Synthetic native data, not an Adobe-authored PSD/PSB reference.
// Each model runs in a fresh Node process: process RSS includes Worker threads.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  createPixelBuffer, deserializePixelBufferSource, serializeTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceFromIndices,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
} from '../src/core/pixel-buffer.js';

const SCRIPT = fileURLToPath(import.meta.url);
const WIDTH = 256, HEIGHT = 256, TILE_SIZE = 4, HALO = 4;
const MAX_ROI_PIXELS = 25_000;
const MIB = 1024 * 1024;
const SPECS = {
  rgb16: {
    model:'rgb', bitsPerChannel:16, channels:3, Type:Uint16Array,
    colorSpace:'srgb', donor:[12000, 22000, 32000], defect:[60000, 60000, 60000],
  },
  cmyka32: {
    model:'cmyk', bitsPerChannel:32, channels:5, Type:Float32Array,
    colorSpace:'device-cmyk', donor:[0.12, 0.23, 0.34, 0.45, 1],
    defect:[0.92, 0.88, 0.84, 0.8, 1],
  },
};

function models(value) {
  const names = String(value).split(',');
  if (!names.length || names.some(name => !Object.hasOwn(SPECS, name)) ||
      names.length !== new Set(names).size) {
    throw new RangeError('Complex ROI profile: models must be unique rgb16,cmyka32');
  }
  return names;
}

function memory() {
  const usage = process.memoryUsage();
  return {
    processRssMiB:+(usage.rss / MIB).toFixed(2),
    parentHeapMiB:+(usage.heapUsed / MIB).toFixed(2),
    parentArrayBuffersMiB:+(usage.arrayBuffers / MIB).toFixed(2),
    linuxProcessHighWaterRssMiB:process.platform === 'linux'
      ? +(process.resourceUsage().maxRSS / 1024).toFixed(2) : null,
  };
}

function selectedIndices() {
  const indices = [];
  // Two dense 64x64 islands are connected by an 8-neighbor diagonal corridor.
  // A global halo rectangle costs >53k pixels, and 4x4 tile fragments exceed
  // the aggregate cap. The existing bounded strip/segment plan must fit 25k.
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const islandA = x >= 16 && x < 80 && y >= 16 && y < 80;
      const islandB = x >= 176 && x < 240 && y >= 176 && y < 240;
      const bridge = x >= 80 && x < 176 && x === y;
      if (islandA || islandB || bridge) indices.push(y * WIDTH + x);
    }
  }
  return Uint32Array.from(indices);
}

function fixture(spec, selected) {
  const data = new spec.Type(WIDTH * HEIGHT * spec.channels);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    data.set(spec.donor, index * spec.channels);
  }
  for (const index of selected) data.set(spec.defect, index * spec.channels);
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width:WIDTH, height:HEIGHT, model:spec.model, channels:spec.channels,
    bitsPerChannel:spec.bitsPerChannel, colorSpace:spec.colorSpace, data,
  }), { tileSize:TILE_SIZE });
}

function verifyNative(result, source, originalTiles, spec, selected) {
  assert.equal(result.filled, selected.length);
  assert.equal(result.changed, selected.length);
  assert.ok(result.changedTiles > 256, 'dense connected selection must span >256 native tiles');
  assert.deepEqual(source.tiles.map(tile => tile.dataUrl), originalTiles,
    'original serialized native tiles must remain immutable');
  const original = deserializePixelBufferSource(source).data;
  const repaired = deserializePixelBufferSource(result.source).data;
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (const index of selected) mask[index] = 1;
  const tolerance = spec.bitsPerChannel === 16 ? 1 : 1e-6;
  let changedTileCount = 0;
  for (let index = 0; index < source.tiles.length; index += 1) {
    if (result.source.tiles[index].dataUrl !== originalTiles[index]) changedTileCount += 1;
  }
  assert.equal(changedTileCount, result.changedTiles);
  for (let index = 0; index < mask.length; index += 1) {
    for (let channel = 0; channel < spec.channels; channel += 1) {
      const offset = index * spec.channels + channel;
      if (!mask[index] || channel === 4) {
        assert.ok(Object.is(repaired[offset], original[offset]),
          'unselected native data and alpha must keep their exact bit words');
      } else {
        assert.ok(Math.abs(repaired[offset] - spec.donor[channel]) <= tolerance,
          'global frozen selection cannot serve as its own donor');
      }
    }
  }
}

async function one(model) {
  const spec = SPECS[model];
  if (!spec) throw new RangeError('Complex ROI profile: unknown model');
  const selected = selectedIndices();
  const startFixture = performance.now();
  const source = fixture(spec, selected);
  const fixtureMs = performance.now() - startFixture;
  const originalTiles = source.tiles.map(tile => tile.dataUrl);
  const options = {
    selectedIndices:selected, halo:HALO, maxLayerPixels:MAX_ROI_PIXELS,
    maxFillPixels:20_000,
  };
  assert.ok(source.rawBytes <= 48 * MIB);
  // Refusal must happen before any partial publication.
  assert.throws(() => inpaintTiledPixelBufferSourceFromIndices(source, {
    ...options, maxLayerPixels:1_000,
  }), /рабочая область|сумма рабочих областей/);
  assert.deepEqual(source.tiles.map(tile => tile.dataUrl), originalTiles);

  if (globalThis.gc) globalThis.gc();
  const before = memory();
  const startSync = performance.now();
  const sync = inpaintTiledPixelBufferSourceFromIndices(source, options);
  const syncMs = performance.now() - startSync;
  const afterSync = memory();
  verifyNative(sync, source, originalTiles, spec, selected);

  const startWorker = performance.now();
  const worker = new Worker(new URL('./tiled-inpaint-worker-thread.mjs', import.meta.url), {
    type:'module',
  });
  let reply;
  try {
    assert.deepEqual((await once(worker, 'message'))[0], { ready:true });
    const message = once(worker, 'message');
    worker.postMessage({ id:1014, source, ...options });
    reply = (await message)[0];
    assert.equal(reply.ok, true, JSON.stringify(reply.error));
  } finally {
    await worker.terminate();
  }
  const workerMs = performance.now() - startWorker;
  const afterWorker = memory();
  assert.deepEqual(reply.result, sync, 'real detached Worker must preserve exact native tile bytes');

  let yields = 0, cancelled = false;
  const partial = await inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
    ...options, isCancelled:() => cancelled,
    yieldControl:async () => { if (++yields === 25) cancelled = true; },
  });
  assert.ok(yields >= 25, 'cancellation must happen after cooperative checkpoints');
  assert.equal(partial.cancelled, true);
  assert.equal(partial.changed, 0);
  assert.equal(partial.source, source);
  assert.deepEqual(source.tiles.map(tile => tile.dataUrl), originalTiles);

  return {
    model, width:WIDTH, height:HEIGHT, tileSize:TILE_SIZE,
    rawBytes:source.rawBytes, tileCount:source.tiles.length,
    selectedPixels:selected.length, changedTiles:sync.changedTiles,
    filled:sync.filled, changed:sync.changed, maxLayerPixels:MAX_ROI_PIXELS,
    budgetRefusal:'atomic', cooperativeCancellation:'atomic',
    workerParity:'exact-native-tiles', sourceTiles:'immutable',
    fixtureMs:+fixtureMs.toFixed(2), syncMs:+syncMs.toFixed(2),
    workerRoundTripMs:+workerMs.toFixed(2), cooperativeYields:yields,
    memory:{ before, afterSync, afterWorker },
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === '--child') {
    const oneModel = models(args[1]);
    if (oneModel.length !== 1) throw new RangeError('Complex ROI profile: child expects one model');
    process.stdout.write(JSON.stringify(await one(oneModel[0])) + '\n');
    return;
  }
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--models')) {
    throw new Error('Usage: node tools/profile-complex-roi.mjs [--models rgb16,cmyka32]');
  }
  const cases = [];
  for (const model of models(args.length ? args[1] : 'rgb16,cmyka32')) {
    const child = spawnSync(process.execPath, [
      '--expose-gc', SCRIPT, '--child', model,
    ], { encoding:'utf8', maxBuffer:1024 * 1024, timeout:180000 });
    if (child.error) throw child.error;
    if (child.status !== 0) {
      throw new Error('Complex ROI profile ' + model + ' failed: ' + child.stderr.trim());
    }
    cases.push(JSON.parse(child.stdout));
  }
  process.stdout.write(JSON.stringify({
    kind:'zpe-complex-roi-profile-v1', node:process.version,
    platform:process.platform, arch:process.arch,
    limitations:'Synthetic connected ROI in Node worker_threads, not Photoshop-authored reference or browser file://. ' +
      'RSS is process-wide; parent heap excludes Worker heaps. Memory observations are not isolated per-operation peaks. ' +
      'Exact native parity is with the same inpaint algorithm; no quality/performance threshold claimed.',
    cases,
  }, null, 2) + '\n');
}

if (process.argv[1] === SCRIPT) main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
