import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  deserializePixelBufferSource,
  inpaintTiledPixelBufferSource,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { decodePsd, inspectPsdHeader } from '../src/formats/psd.js';

// These are upstream, MIT-licensed PSD/PSB files pinned by the existing corpus
// manifest. Unlike the synthetic 8/24/48 MiB fixture, this measures decode too.
const fixtures = {
  psd: { file:'psd-tools-4x4-8bit-cmyk.psd', version:1, tileSize:2 },
  psb: { file:'psd-tools-group.psb', version:2, tileSize:16 },
};
const root = new URL('../tests/fixtures/color-management/', import.meta.url);

function psbMergedImageOnly(bytes) {
  // Preserve upstream merged bytes; strip the Photoshop layer/mask section on
  // a separate copy so decodePsd exposes compositePixelBuffer for layered PSB.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 26;
  for (let section = 0; section < 2; section += 1) {
    const length = view.getUint32(offset, false);
    offset += 4 + length;
    assert.ok(offset <= bytes.length, 'truncated PSB metadata section');
  }
  const length = view.getBigUint64(offset, false);
  assert.ok(length <= BigInt(Number.MAX_SAFE_INTEGER), 'oversized PSB layer section');
  const count = Number(length);
  assert.ok(count > 0 && offset + 8 + count < bytes.length, 'invalid PSB layer section');
  const flattened = new Uint8Array(bytes.length - count);
  flattened.set(bytes.subarray(0, offset));
  // The 8-byte length remains zero; original image section is intact.
  flattened.set(bytes.subarray(offset + 8 + count), offset + 8);
  return flattened;
}

function memory() {
  const usage = process.memoryUsage();
  return {
    rssMiB:usage.rss / 1048576,
    heapUsedMiB:usage.heapUsed / 1048576,
    arrayBuffersMiB:usage.arrayBuffers / 1048576,
    processHighWaterRssMiB:process.resourceUsage().maxRSS / 1024,
  };
}

async function profile(fixtureName) {
  const fixture = fixtures[fixtureName];
  assert.ok(fixture, 'unknown external PSD/PSB fixture');
  const manifest = JSON.parse(await readFile(new URL('corpus-manifest.json', root), 'utf8'));
  const provenance = manifest.fixtures.find(item => item.file === fixture.file);
  assert.ok(provenance && provenance.sourceRepository === 'psd-tools/psd-tools');
  const bytes = new Uint8Array(await readFile(new URL(fixture.file, root)));
  assert.equal(bytes.byteLength, provenance.size, 'external fixture size');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), provenance.sha256, 'external fixture SHA-256');
  const header = inspectPsdHeader(bytes);
  assert.equal(header.version, fixture.version);
  globalThis.gc?.();
  const before = memory();
  const startDecode = performance.now();
  const decoded = await decodePsd(bytes);
  assert.ok(decoded.layers.length >= 1, 'external file must have real layers');
  if (fixtureName === 'psb') assert.ok(decoded.groups.length >= 1, 'external PSB must have a group');

  // Original layered PSB import retains layer topology, but does not expose
  // merged pixels directly. Decode the ORIGINAL upstream image section from
  // an independent copy with only its layer section removed (same oracle path
  // as tests/psd-external-merged-preview.test.mjs).
  const buffer = fixtureName === 'psd'
    ? decoded.layers[0].pixelBuffer
    : (await decodePsd(psbMergedImageOnly(bytes))).compositePixelBuffer;
  const decodeMs = performance.now() - startDecode;
  const afterDecode = memory();
  assert.ok(buffer?.data && buffer.width > 1 && buffer.height > 1);
  if (fixtureName === 'psd') {
    assert.equal(buffer.model, 'cmyk');
    assert.equal(buffer.channels, 5);
  } else {
    assert.equal(buffer.model, 'rgb');
  }
  assert.equal(buffer.bitsPerChannel, 8);

  const startTiles = performance.now();
  const source = serializeTiledPixelBufferSource(buffer, { tileSize:fixture.tileSize });
  const serializeMs = performance.now() - startTiles;
  const afterTiles = memory();
  const originalPayloads = source.tiles.map(tile => tile.dataUrl);
  const x = Math.min(fixture.tileSize - 1, source.width - 2);
  const y = Math.min(fixture.tileSize - 1, source.height - 2);
  const startInpaint = performance.now();
  const result = inpaintTiledPixelBufferSource(source, {
    isAllowed:(col, row) => col === x && row === y,
    halo:4,
  });
  const inpaintMs = performance.now() - startInpaint;
  const afterInpaint = memory();
  assert.equal(result.filled, 1, 'one selected pixel must be filled');
  assert.ok(result.changed === 0 || result.changed === 1);
  assert.ok(result.changedTiles <= 1, 'only selected tile may change');
  assert.ok(result.loadedTiles <= 4, 'small halo must not decode unrelated tiles');
  assert.deepEqual(source.tiles.map(tile => tile.dataUrl), originalPayloads, 'input must stay immutable');

  const restored = deserializePixelBufferSource(result.source);
  let changedSamples = 0;
  for (let index = 0; index < buffer.data.length; index += 1) {
    if (restored.data[index] === buffer.data[index]) continue;
    const pixel = Math.floor(index / buffer.channels);
    assert.equal(pixel, y * buffer.width + x, 'only selected pixel may be changed');
    changedSamples += 1;
  }
  assert.equal(changedSamples > 0, result.changed > 0);
  const modifiedTiles = result.source.tiles.reduce(
    (count, tile, index) => count + Number(tile.dataUrl !== originalPayloads[index]), 0);
  assert.equal(modifiedTiles, result.changedTiles);

  return {
    fixture:fixtureName,
    file:fixture.file,
    sourceRepository:provenance.sourceRepository,
    sourceSha256:provenance.sha256,
    psdVersion:header.version,
    documentWidth:decoded.width,
    documentHeight:decoded.height,
    model:source.model,
    bitsPerChannel:source.bitsPerChannel,
    sourceRawBytes:source.rawBytes,
    tileSize:source.tileSize,
    tileCount:source.tiles.length,
    selectedPixels:1,
    filled:result.filled,
    changed:result.changed,
    changedTiles:result.changedTiles,
    loadedTiles:result.loadedTiles,
    decodeMs,
    serializeMs,
    inpaintMs,
    before,
    afterDecode,
    afterTiles,
    afterInpaint,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--child') {
    if (args.length !== 2 || !fixtures[args[1]]) throw new Error('invalid child fixture');
    process.stdout.write(JSON.stringify(await profile(args[1])) + '\n');
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== '--fixtures')) {
    throw new Error('Usage: node tools/profile-real-psd-inpaint.mjs [--fixtures psd,psb]');
  }
  const names = args.length ? args[1].split(',') : ['psd', 'psb'];
  if (!names.length || new Set(names).size !== names.length || names.some(name => !fixtures[name])) {
    throw new Error('fixtures must be psd, psb or psd,psb');
  }
  const cases = names.map(name => {
    const child = spawnSync(process.execPath, [
      '--expose-gc', fileURLToPath(import.meta.url), '--child', name,
    ], { encoding:'utf8', maxBuffer:1024 * 1024 });
    if (child.error || child.status !== 0) {
      throw new Error('External ' + name + ' profile failed: ' + (child.stderr || child.error?.message || child.status));
    }
    return JSON.parse(child.stdout);
  });
  process.stdout.write(JSON.stringify({
    kind:'zpe-external-psd-psb-tiled-inpaint-profile-v1',
    runtime:{ node:process.version, platform:process.platform, arch:process.arch },
    cases,
    limitations:'Small 8-bit external fixtures; process-wide maxRSS is not isolated inpaint peak; no browser UI/Worker/high-depth timing.',
  }, null, 2) + '\n');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
