import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  inpaintTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceCooperative,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { decodePsd } from '../src/formats/psd.js';

const script = fileURLToPath(new URL('../tools/profile-real-psd-inpaint.mjs', import.meta.url));
const root = new URL('./fixtures/color-management/', import.meta.url);

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding:'utf8', maxBuffer:1024 * 1024,
  });
}

test('Stage 003: independently sourced PSD/PSB decode + tiled inpaint profiles are machine-readable', () => {
  const child = run();
  assert.equal(child.status, 0, child.stderr);
  const report = JSON.parse(child.stdout);
  assert.equal(report.kind, 'zpe-external-psd-psb-tiled-inpaint-profile-v1');
  assert.deepEqual(report.cases.map(item => item.fixture), ['psd', 'psb']);
  assert.ok(report.limitations.includes('8-bit'));
  for (const item of report.cases) {
    assert.equal(item.sourceRepository, 'psd-tools/psd-tools');
    assert.match(item.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(item.sourceRawBytes > 0 && item.sourceRawBytes <= 48 * 1048576);
    assert.equal(item.bitsPerChannel, 8);
    assert.equal(item.selectedPixels, 1);
    assert.equal(item.filled, 1);
    assert.ok(item.changed === 0 || item.changed === 1);
    assert.ok(item.changedTiles <= 1);
    assert.ok(item.loadedTiles >= 1 && item.loadedTiles <= 4);
    assert.ok(item.tileCount >= item.loadedTiles);
    for (const key of ['decodeMs', 'serializeMs', 'inpaintMs']) {
      assert.ok(Number.isFinite(item[key]) && item[key] >= 0, key);
    }
    for (const phase of ['before', 'afterDecode', 'afterTiles', 'afterInpaint']) {
      assert.ok(item[phase].rssMiB > 0);
      assert.ok(item[phase].processHighWaterRssMiB > 0);
      assert.ok(item[phase].arrayBuffersMiB >= 0);
    }
  }
  assert.equal(report.cases[0].model, 'cmyk');
  assert.equal(report.cases[0].psdVersion, 1);
  assert.equal(report.cases[1].model, 'rgb');
  assert.equal(report.cases[1].psdVersion, 2);
});

test('Stage 003: profile refuses unrecognized fixture names (no arbitrary file execution)', () => {
  const child = run('--fixtures', 'psd,unknown');
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /fixtures must be/);
});

test('Stage 003: external CMYK PSD has identical sync/cooperative native tiled results', async () => {
  const bytes = new Uint8Array(await readFile(new URL('psd-tools-4x4-8bit-cmyk.psd', root)));
  const decoded = await decodePsd(bytes);
  const source = serializeTiledPixelBufferSource(decoded.layers[0].pixelBuffer, { tileSize:2 });
  const predicate = (x, y) => x === 1 && y === 1;
  const original = JSON.stringify(source);
  let samples = 0, yields = 0;
  const asynchronous = await inpaintTiledPixelBufferSourceCooperative(source, {
    isAllowed:(x, y) => { samples += 1; return predicate(x, y); },
    scanChunkPixels:3,
    yieldControl:async () => { yields += 1; },
    halo:4,
  });
  const synchronous = inpaintTiledPixelBufferSource(source, { isAllowed:predicate, halo:4 });
  assert.ok(yields > 1);
  assert.equal(samples, 16, 'predicate sampled exactly once per original pixel');
  assert.deepEqual(asynchronous, synchronous);
  assert.equal(JSON.stringify(source), original);
});

test('Stage 003: external layered PSB selection can be cancelled before any ROI tile decode', async () => {
  const bytes = new Uint8Array(await readFile(new URL('psd-tools-group.psb', root)));
  const decoded = await decodePsd(bytes);
  assert.ok(decoded.groups.length >= 1);
  const source = serializeTiledPixelBufferSource(decoded.compositePixelBuffer, { tileSize:16 });
  const snapshot = JSON.stringify(source);
  let calls = 0, cancelled = false;
  const result = await inpaintTiledPixelBufferSourceCooperative(source, {
    isAllowed:() => { calls += 1; return false; },
    scanChunkPixels:17,
    isCancelled:() => cancelled,
    yieldControl:async () => { cancelled = true; },
  });
  assert.equal(calls, 17);
  assert.equal(result.cancelled, true);
  assert.equal(result.changed, 0);
  assert.equal(result.loadedTiles, 0);
  assert.equal(result.source, source);
  assert.equal(JSON.stringify(source), snapshot);
});
