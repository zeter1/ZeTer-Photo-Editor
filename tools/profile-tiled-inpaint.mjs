import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  createPixelBuffer,
  inpaintTiledPixelBufferSource,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';

const SCRIPT = fileURLToPath(import.meta.url);
const MIB = 1024 * 1024;
const CHANNELS = 5;
const WIDTH = 1024;
const TILE_SIZE = 256;

function parseSizes(value) {
  const sizes = String(value).split(',').map(part => Number(part.trim()));
  if (!sizes.length || sizes.some(size => !Number.isInteger(size) || size < 1 || size > 48) || new Set(sizes).size !== sizes.length) {
    throw new RangeError('Размеры должны быть уникальными целыми числами от 1 до 48 MiB');
  }
  return sizes;
}

function memorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssMiB: +(usage.rss / MIB).toFixed(2),
    heapUsedMiB: +(usage.heapUsed / MIB).toFixed(2),
    arrayBuffersMiB: +(usage.arrayBuffers / MIB).toFixed(2),
    processHighWaterRssMiB: +(process.resourceUsage().maxRSS / 1024).toFixed(2),
  };
}

function measureCase(sizeMiB) {
  const height = Math.floor(sizeMiB * MIB / (WIDTH * CHANNELS * Float32Array.BYTES_PER_ELEMENT));
  const selectedX = TILE_SIZE - 1;
  const selectedY = Math.floor(height / 2);
  const startFixture = performance.now();
  const data = new Float32Array(WIDTH * height * CHANNELS);
  // Fully opaque donor samples; one defective CMYKA pixel crosses a tile seam.
  for (let i = 4; i < data.length; i += CHANNELS) data[i] = 1;
  const selectedOffset = (selectedY * WIDTH + selectedX) * CHANNELS;
  data.set([0.9, 0.8, 0.7, 0.6, 1], selectedOffset);
  const source = serializeTiledPixelBufferSource(createPixelBuffer({
    width:WIDTH, height, model:'cmyk', channels:CHANNELS,
    bitsPerChannel:32, colorSpace:'device-cmyk', data,
  }), { tileSize:TILE_SIZE });
  const fixtureMs = performance.now() - startFixture;
  assert.ok(source.rawBytes <= 48 * MIB);
  if (globalThis.gc) globalThis.gc();
  const before = memorySnapshot();
  const startInpaint = performance.now();
  const result = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => x === selectedX && y === selectedY,
  });
  const inpaintMs = performance.now() - startInpaint;
  const after = memorySnapshot();
  assert.equal(result.filled, 1);
  assert.equal(result.changed, 1);
  assert.equal(result.changedTiles, 1);
  assert.notEqual(result.source, source);
  assert.equal(result.source.rawBytes, source.rawBytes);
  for (let i = 0; i < source.tiles.length; i += 1) {
    const changed = result.source.tiles[i].dataUrl !== source.tiles[i].dataUrl;
    assert.equal(changed, source.tiles[i].x === 0 && source.tiles[i].y === Math.floor(selectedY / TILE_SIZE) * TILE_SIZE,
      `unexpected mutated tile at index ${i}`);
  }
  return {
    requestedMiB:sizeMiB, rawBytes:source.rawBytes, width:WIDTH, height,
    model:'CMYKA Float32', tileSize:TILE_SIZE, selectedPixels:1,
    filled:result.filled, changed:result.changed, changedTiles:result.changedTiles,
    loadedTiles:result.loadedTiles, fixtureMs:+fixtureMs.toFixed(2),
    inpaintMs:+inpaintMs.toFixed(2),
    before, after,
    observedProcessHighWaterGrowthMiB:+Math.max(0, after.processHighWaterRssMiB - before.processHighWaterRssMiB).toFixed(2),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === '--child-mib') {
    const [size] = parseSizes(args[1]);
    process.stdout.write(JSON.stringify(measureCase(size)) + '\n');
    return;
  }
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--sizes')) {
    throw new Error('Использование: node tools/profile-tiled-inpaint.mjs [--sizes 8,24,48]');
  }
  const sizes = parseSizes(args.length ? args[1] : '8,24,48');
  const cases = sizes.map(size => {
    const proc = spawnSync(process.execPath, [
      '--expose-gc', SCRIPT, '--child-mib', String(size),
    ], { encoding:'utf8', maxBuffer:1024 * 1024 });
    if (proc.error) throw proc.error;
    if (proc.status !== 0) {
      throw new Error(`Profile ${size} MiB failed (exit ${proc.status}): ${proc.stderr.trim()}`);
    }
    return JSON.parse(proc.stdout);
  });
  process.stdout.write(JSON.stringify({
    kind:'zpe-tiled-inpaint-profile-v1', node:process.version,
    platform:process.platform, arch:process.arch, cases,
  }, null, 2) + '\n');
}

main();
