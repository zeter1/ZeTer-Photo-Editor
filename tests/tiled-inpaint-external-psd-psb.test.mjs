import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  inpaintTiledPixelBufferSource,
  inpaintTiledPixelBufferSourceCooperative,
  inpaintTiledPixelBufferSourceFromIndices,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { decodePsd } from '../src/formats/psd.js';
import { createTiledInpaintWorkerJobController } from '../src/core/tiled-inpaint-worker-client.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';

const script = fileURLToPath(new URL('../tools/profile-real-psd-inpaint.mjs', import.meta.url));
const root = new URL('./fixtures/color-management/', import.meta.url);

function psbMergedImageOnly(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 26;
  for (let section = 0; section < 2; section += 1) {
    const length = view.getUint32(offset, false);
    offset += 4 + length;
    assert.ok(offset <= bytes.length);
  }
  const length = view.getBigUint64(offset, false);
  assert.ok(length > 0n && length <= BigInt(Number.MAX_SAFE_INTEGER));
  const count = Number(length);
  assert.ok(offset + 8 + count < bytes.length);
  const flattened = new Uint8Array(bytes.length - count);
  flattened.set(bytes.subarray(0, offset));
  flattened.set(bytes.subarray(offset + 8 + count), offset + 8);
  return flattened;
}

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
  const merged = await decodePsd(psbMergedImageOnly(bytes));
  assert.ok(merged.compositePixelBuffer, 'layer-free copy exposes upstream merged bytes');
  const source = serializeTiledPixelBufferSource(merged.compositePixelBuffer, { tileSize:16 });
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

// These fixtures are pinned independently sourced PSD/PSB bytes. The same real
// off-thread protocol used by the browser adapter must match the bounded native
// kernel; this is Node Worker integration, NOT a browser file:// performance test.
test('Stage 003: external PSD/PSB bytes decode to tiled sources and run through a real Worker', async t => {
  for (const { name, file, tileSize } of [
    { name:'PSD CMYK', file:'psd-tools-4x4-8bit-cmyk.psd', tileSize:2 },
    { name:'PSB RGB', file:'psd-tools-group.psb', tileSize:16 },
  ]) {
    await t.test(name, async () => {
      const bytes = new Uint8Array(await readFile(new URL(file, root)));
      // The external PSB contains layer records. A layer-free copy exposes its
      // independently authored merged composite without altering the fixture.
      const decoded = await decodePsd(file.endsWith('.psb') ? psbMergedImageOnly(bytes) : bytes);
      const buffer = file.endsWith('.psb') ? decoded.compositePixelBuffer : decoded.layers[0].pixelBuffer;
      assert.ok(buffer?.data, 'external Photoshop-format pixels decoded');
      const source = serializeTiledPixelBufferSource(buffer, { tileSize });
      const before = JSON.stringify(source);
      const x = Math.min(tileSize - 1, source.width - 2);
      const y = Math.min(tileSize - 1, source.height - 2);
      const selectedIndices = Uint32Array.of(y * source.width + x);
      const expected = inpaintTiledPixelBufferSourceFromIndices(source, { selectedIndices });
      let sampled = 0, workersCreated = 0;
      const worker = createTiledInpaintWorkerJobController({
        createWorker() {
          workersCreated += 1;
          return new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url), { type:'module' });
        },
      });
      const result = await prepareTiledInpaintWithWorker(source, {
        worker,
        isAllowed:(col, row) => { sampled += 1; return col === x && row === y; },
        scanChunkPixels:7,
        yieldControl:async () => {},
      });
      assert.equal(workersCreated, 1, 'real detached Worker was used');
      assert.equal(worker.cancel(), false, 'completed Worker was cleaned up');
      assert.equal(sampled, source.width * source.height, 'selection geometry frozen exactly once');
      assert.equal(result.filled, 1);
      assert.deepEqual(result, expected, 'Worker and native bounded ROI kernel agree');
      assert.equal(JSON.stringify(source), before, 'input tiles and payloads remain immutable');
    });
  }
});
