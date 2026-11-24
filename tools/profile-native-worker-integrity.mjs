// Stage 003: repeatable native byte-integrity / Node Worker diagnostic.
// Synthetic inputs are NOT independent Photoshop-authored PSD/PSB fixtures.
// Parent memoryUsage excludes Worker JS heaps; RSS is process-wide and sampled.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createPixelBuffer, inpaintTiledPixelBufferSourceFromIndices,
  serializeTiledPixelBufferSource } from '../src/core/pixel-buffer.js';
import { createTiledInpaintWorkerJobController } from '../src/core/tiled-inpaint-worker-client.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';
import { assertHighDepthWorkerParity } from './profile-external-high-depth-psd-psb.mjs';

const SCRIPT = fileURLToPath(import.meta.url);
const WORKER = new URL('./tiled-inpaint-worker-thread.mjs', import.meta.url);
const MIB = 1048576;
const WIDTH = 512;
const TILE_SIZE = 128;
const MODELS = {
  rgb16:{
    model:'rgb', channels:4, bitsPerChannel:16, Type:Uint16Array,
    colorSpace:'srgb', donor:[12000, 22000, 32000, 65535],
    defect:[62000, 52000, 48000, 65535],
  },
  cmyka32:{
    model:'cmyk', channels:5, bitsPerChannel:32, Type:Float32Array,
    colorSpace:'device-cmyk', donor:[0.12, 0.23, 0.34, 0.45, 1],
    defect:[0.95, 0.8, 0.7, 0.6, 1],
  },
};

function parseSizes(value) {
  const sizes = String(value).split(',').map(part => Number(part.trim()));
  if (!sizes.length || sizes.some(size => !Number.isSafeInteger(size) || size < 1 || size > 48) ||
      new Set(sizes).size !== sizes.length) {
    throw new RangeError('Worker profile: размеры должны быть уникальными целыми числами от 1 до 48 MiB');
  }
  return sizes;
}

function parseModels(value) {
  const names = String(value).split(',');
  if (!names.length || names.some(name => !Object.hasOwn(MODELS, name)) ||
      new Set(names).size !== names.length) {
    throw new RangeError('Worker profile: модели должны быть rgb16,cmyka32 без повторов');
  }
  return names;
}

function memory() {
  const usage = process.memoryUsage();
  return {
    processRssMiB:+(usage.rss / MIB).toFixed(2),
    parentJsHeapMiB:+(usage.heapUsed / MIB).toFixed(2),
    parentArrayBuffersMiB:+(usage.arrayBuffers / MIB).toFixed(2),
    // Linux reports this in KiB; do not mislabel Darwin/Windows values.
    linuxProcessHighWaterRssMiB:process.platform === 'linux'
      ? +(process.resourceUsage().maxRSS / 1024).toFixed(2) : null,
  };
}

export async function profileNativeWorkerCase(modelName, requestedMiB) {
  const spec = MODELS[modelName];
  if (!spec) throw new RangeError('Worker profile: unknown native model');
  if (!parseSizes(String(requestedMiB)).length) throw new RangeError('Worker profile: invalid size');
  const height = Math.floor(requestedMiB * MIB / (WIDTH * spec.channels * spec.Type.BYTES_PER_ELEMENT));
  if (height < 3) throw new RangeError('Worker profile: insufficient source height');
  const targetX = TILE_SIZE - 1, targetY = Math.floor(height / 2);
  const fixtureStart = performance.now();
  const pixels = new spec.Type(WIDTH * height * spec.channels);
  for (let offset = 0; offset < pixels.length; offset += spec.channels) {
    pixels.set(spec.donor, offset);
  }
  pixels.set(spec.defect, (targetY * WIDTH + targetX) * spec.channels);
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width:WIDTH, height, model:spec.model, channels:spec.channels,
    bitsPerChannel:spec.bitsPerChannel, colorSpace:spec.colorSpace, data:pixels,
  }), { tileSize:TILE_SIZE });
  const fixtureMs = performance.now() - fixtureStart;
  assert.ok(source.rawBytes <= requestedMiB * MIB && source.rawBytes > 0);
  const originalTiles = source.tiles.map(tile => tile.dataUrl);
  const selected = Uint32Array.of(targetY * WIDTH + targetX);
  if (globalThis.gc) globalThis.gc();
  const beforeWorker = memory();
  let workersCreated = 0, selectionSamples = 0;
  const worker = createTiledInpaintWorkerJobController({
    createWorker() {
      workersCreated += 1;
      return new Worker(WORKER, { type:'module' });
    },
  });
  let result;
  const workerStart = performance.now();
  try {
    result = await prepareTiledInpaintWithWorker(source, {
      worker,
      scanChunkPixels:32768,
      isAllowed:(x, y) => {
        selectionSamples += 1;
        return x === targetX && y === targetY;
      },
    });
  } finally {
    worker.cancel();
  }
  const workerRoundTripMs = performance.now() - workerStart;
  const afterWorker = memory();
  assert.equal(workersCreated, 1, 'real Worker must execute');
  assert.equal(selectionSamples, WIDTH * height, 'selection scanned exactly once');
  assert.equal(result?.filled, 1);
  assert.equal(result?.changed, 1);
  assert.equal(result?.changedTiles, 1);
  assert.equal(result?.cancelled, undefined);
  assert.deepEqual(source.tiles.map(tile => tile.dataUrl), originalTiles,
    'Worker must not mutate source tile payloads');
  let changedTileIndex = -1;
  for (const [index, tile] of source.tiles.entries()) {
    const changed = result.source.tiles[index].dataUrl !== originalTiles[index];
    const containsTarget = targetX >= tile.x && targetX < tile.x + tile.width &&
      targetY >= tile.y && targetY < tile.y + tile.height;
    assert.equal(changed, containsTarget, 'only the selected native tile may change');
    if (changed) changedTileIndex = index;
  }

  // The oracle uses the exact same frozen indices but runs without a Worker.
  // This is byte-level native parity, NOT independent Adobe pixel parity.
  const oracleStart = performance.now();
  const oracle = inpaintTiledPixelBufferSourceFromIndices(source, { selectedIndices:selected });
  assertHighDepthWorkerParity(result, oracle);
  const oracleMs = performance.now() - oracleStart;
  const afterOracle = memory();
  return {
    model:modelName, requestedMiB, rawBytes:source.rawBytes,
    width:WIDTH, height, tileSize:TILE_SIZE,
    tileCount:source.tiles.length, selectedPixels:1, changedTileIndex,
    workersCreated, selectionSamples,
    filled:result.filled, changed:result.changed, changedTiles:result.changedTiles,
    byteParity:'exact', inputTiles:'immutable',
    fixtureMs:+fixtureMs.toFixed(2),
    workerRoundTripMs:+workerRoundTripMs.toFixed(2),
    oracleMs:+oracleMs.toFixed(2),
    memory:{ beforeWorker, afterWorker, afterOracle },
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 3 && args[0] === '--child') {
    const models = parseModels(args[1]), sizes = parseSizes(args[2]);
    if (models.length !== 1 || sizes.length !== 1) {
      throw new RangeError('Worker profile: child expects one model and one size');
    }
    process.stdout.write(JSON.stringify(await profileNativeWorkerCase(models[0], sizes[0])) + '\n');
    return;
  }
  const usage = 'Usage: node tools/profile-native-worker-integrity.mjs [--sizes 8,24,48] [--models rgb16,cmyka32]';
  if (args.length % 2) throw new Error(usage);
  const flags = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--sizes', '--models'].includes(args[i]) || flags.has(args[i])) throw new Error(usage);
    flags.set(args[i], args[i + 1]);
  }
  const sizes = parseSizes(flags.get('--sizes') ?? '8,24,48');
  const models = parseModels(flags.get('--models') ?? 'rgb16,cmyka32');
  const cases = [];
  // Fresh child process per case prevents cross-case process HWM contamination.
  for (const size of sizes) for (const model of models) {
    const child = spawnSync(process.execPath, [
      '--expose-gc', SCRIPT, '--child', model, String(size),
    ], { encoding:'utf8', maxBuffer:1024 * 1024 });
    if (child.error) throw child.error;
    if (child.status !== 0) {
      throw new Error('Native Worker profile failed (' + model + '/' + size + ' MiB): ' +
        child.stderr.trim());
    }
    cases.push(JSON.parse(child.stdout));
  }
  process.stdout.write(JSON.stringify({
    kind:'zpe-native-worker-byte-integrity-profile-v1',
    node:process.version, platform:process.platform, arch:process.arch,
    limitations:'Synthetic native PixelBuffer source, Node worker_threads only. ' +
      'Same-algorithm byte oracle, not Photoshop/PSD/PSB cross-app rendering parity. ' +
      'Memory snapshots are process-wide RSS and parent thread heap, not isolated Worker heap, ' +
      'browser file:// memory or true operation peak. No performance thresholds.',
    cases,
  }, null, 2) + '\n');
}

if (process.argv[1] === SCRIPT) main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
