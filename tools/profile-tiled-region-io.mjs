import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  createPixelBuffer,
  createSerializedPixelBufferTileWorkingSet,
  deserializePixelBufferSource,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';

// Diagnostic only: measure the synchronous read/write bottleneck before
// introducing cooperative checkpoints. No time/RAM thresholds are CI gates.
const SCRIPT = fileURLToPath(import.meta.url);
const MIB = 1024 * 1024;
const WIDTH = 1024;
const HEIGHT = 512;
const TILE_SIZE = 256;
const REGION = Object.freeze({ left:200, top:64, right:824, bottom:448 });
const CASES = Object.freeze({
  rgb16:{ model:'rgb', channels:3, bitsPerChannel:16, colorSpace:'srgb' },
  cmyk32:{ model:'cmyk', channels:5, bitsPerChannel:32, colorSpace:'device-cmyk' },
});

function snapshot() {
  const m = process.memoryUsage();
  return {
    rssMiB:+(m.rss / MIB).toFixed(2),
    heapUsedMiB:+(m.heapUsed / MIB).toFixed(2),
    arrayBuffersMiB:+(m.arrayBuffers / MIB).toFixed(2),
    processHighWaterRssMiB:+(process.resourceUsage().maxRSS / 1024).toFixed(2),
  };
}

function fixture(name) {
  const config = CASES[name];
  assert.ok(config, 'unknown diagnostic case');
  const length = WIDTH * HEIGHT * config.channels;
  const data = name === 'rgb16' ? new Uint16Array(length) : new Float32Array(length);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const base = (y * WIDTH + x) * config.channels;
      if (name === 'rgb16') {
        data[base] = (x * 31 + y * 17) & 65535;
        data[base + 1] = (x * 7 + y * 109) & 65535;
        data[base + 2] = (x * 13 + y * 3) & 65535;
      } else {
        data[base] = (x % 97) / 100;
        data[base + 1] = (y % 89) / 100;
        data[base + 2] = 0.25;
        data[base + 3] = 0.5;
        data[base + 4] = 1;
      }
    }
  }
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width:WIDTH, height:HEIGHT, data, ...config,
  }), { tileSize:TILE_SIZE });
  return { data, source, config };
}

function validateRead(region, original, config) {
  assert.equal(region.x, REGION.left);
  assert.equal(region.y, REGION.top);
  assert.equal(region.buffer.width, REGION.right - REGION.left);
  assert.equal(region.buffer.height, REGION.bottom - REGION.top);
  assert.equal(region.buffer.bitsPerChannel, config.bitsPerChannel);
  const { channels } = config;
  const width = region.buffer.width;
  for (let row = 0; row < region.buffer.height; row += 1) {
    const originalOffset = ((REGION.top + row) * WIDTH + REGION.left) * channels;
    const localOffset = row * width * channels;
    const count = width * channels;
    assert.deepEqual(
      region.buffer.data.subarray(localOffset, localOffset + count),
      original.subarray(originalOffset, originalOffset + count),
      'readRegion must preserve exact native samples across tile seams',
    );
  }
}

function profile(name) {
  const startFixture = performance.now();
  const { data, source, config } = fixture(name);
  const fixtureMs = performance.now() - startFixture;
  const beforePayloads = source.tiles.map(tile => tile.dataUrl);
  globalThis.gc?.();
  const before = snapshot();
  const working = createSerializedPixelBufferTileWorkingSet(source);

  const startRead = performance.now();
  const region = working.readRegion(REGION);
  const readRegionMs = performance.now() - startRead;
  const afterRead = snapshot();
  assert.ok(region, 'nonempty region');
  validateRead(region, data, config);
  assert.equal(working.dirtyTileCount, 0, 'read must not dirty tiles');

  // One exact sample change at the seam, while writeRegion scans the complete
  // rectangular region and must not dirty any neighbouring source tile.
  const changedX = TILE_SIZE * 2 - 1;
  const changedY = TILE_SIZE - 1;
  const originalOffset = (changedY * WIDTH + changedX) * config.channels;
  const localOffset = ((changedY - REGION.top) * region.buffer.width
    + changedX - REGION.left) * config.channels;
  const replacement = name === 'rgb16'
    ? (data[originalOffset] ^ 1)
    : (data[originalOffset] === 1 ? 0.5 : 1);
  assert.notEqual(replacement, data[originalOffset]);
  region.buffer.data[localOffset] = replacement;

  const startWrite = performance.now();
  const changed = working.writeRegion(region);
  const writeRegionMs = performance.now() - startWrite;
  const afterWrite = snapshot();
  assert.equal(changed, 1);
  assert.equal(working.dirtyTileCount, 1);

  const startSerialize = performance.now();
  const serialized = working.serialize();
  const serializeMs = performance.now() - startSerialize;
  const afterSerialize = snapshot();

  const changedTileIndices = serialized.tiles.flatMap((tile, index) =>
    tile.dataUrl !== beforePayloads[index] ? [index] : []);
  assert.equal(changedTileIndices.length, 1, 'only the affected tile payload changes');
  assert.equal(serialized.rawBytes, source.rawBytes);
  assert.deepEqual(source.tiles.map(tile => tile.dataUrl), beforePayloads,
    'private read/write/serialize must never mutate the original source');
  const restored = deserializePixelBufferSource(serialized);
  assert.equal(restored.data[originalOffset], replacement);
  for (let i = 0; i < data.length; i += 1) {
    if (i === originalOffset) continue;
    assert.ok(Object.is(restored.data[i], data[i]), 'untouched native sample changed at ' + i);
  }

  return {
    case:name, model:config.model, bitsPerChannel:config.bitsPerChannel,
    channels:config.channels, width:WIDTH, height:HEIGHT, tileSize:TILE_SIZE,
    region:{ ...REGION }, sourceRawBytes:source.rawBytes,
    sourceTiles:source.tiles.length, loadedTiles:working.loadedTileCount,
    changedPixels:changed, changedTiles:changedTileIndices.length,
    fixtureMs:+fixtureMs.toFixed(2),
    readRegionMs:+readRegionMs.toFixed(2),
    writeRegionMs:+writeRegionMs.toFixed(2),
    serializeMs:+serializeMs.toFixed(2),
    before, afterRead, afterWrite, afterSerialize,
    observedProcessHighWaterGrowthMiB:+Math.max(0,
      afterSerialize.processHighWaterRssMiB - before.processHighWaterRssMiB).toFixed(2),
  };
}

function parseCases(value) {
  const names = String(value || '').split(',').map(part => part.trim());
  if (!names.length || new Set(names).size !== names.length
      || names.some(name => !Object.hasOwn(CASES, name))) {
    throw new RangeError('Допустимые уникальные сценарии: rgb16,cmyk32');
  }
  return names;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--child') {
    if (args.length !== 2) throw new Error('Usage: --child rgb16|cmyk32');
    const names = parseCases(args[1]);
    if (names.length !== 1) throw new Error('Child requires one case');
    process.stdout.write(JSON.stringify(profile(names[0])) + '\n');
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== '--cases')) {
    throw new Error('Usage: node tools/profile-tiled-region-io.mjs [--cases rgb16,cmyk32]');
  }
  const names = parseCases(args.length ? args[1] : 'rgb16,cmyk32');
  const cases = names.map(name => {
    const result = spawnSync(process.execPath,
      ['--expose-gc', SCRIPT, '--child', name],
      { encoding:'utf8', maxBuffer:1024 * 1024 });
    if (result.error || result.status !== 0) {
      throw new Error('Region ' + name + ' profile failed: '
        + (result.stderr || result.error?.message || result.status));
    }
    return JSON.parse(result.stdout);
  });
  process.stdout.write(JSON.stringify({
    kind:'zpe-tiled-region-io-profile-v1',
    runtime:{ node:process.version, platform:process.platform, arch:process.arch },
    cases,
    limitations:'Synthetic native tiles; synchronous Node operations only. Process-wide high-water RSS is not per-stage peak or browser/Worker/GPU memory.',
  }, null, 2) + '\n');
}

try { main(); }
catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
