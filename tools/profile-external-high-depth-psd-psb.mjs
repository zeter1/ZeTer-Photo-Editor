// Stage 002/003: opt-in audited high-depth PSD/PSB -> native tiles -> real
// Node Worker integration. This does not certify Photoshop authorship or
// measure file:// Chromium memory / UI behavior.
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { open, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { auditExternalHighDepthCorpus, inspectExternalHighDepthHeader } from './audit-external-high-depth-corpus.mjs';
import { decodePsd } from '../src/formats/psd.js';
import { serializeTiledPixelBufferSource } from '../src/core/pixel-buffer.js';
import { createTiledInpaintWorkerJobController } from '../src/core/tiled-inpaint-worker-client.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';

const workerUrl = new URL('./tiled-inpaint-worker-thread.mjs', import.meta.url);
const sample = () => {
  const { rss, heapUsed, arrayBuffers } = process.memoryUsage();
  return { rssMiB:rss / 1048576, heapUsedMiB:heapUsed / 1048576,
    arrayBuffersMiB:arrayBuffers / 1048576 };
};
const sameFile = (a, b) => a.isFile() && b.isFile() &&
  a.dev === b.dev && a.ino === b.ino && a.size === b.size;

// The auditor opens and hashes its own pinned descriptor. Reopen for decoding
// only with a bounded read, then verify the *same* hash again. This closes the
// pathname-swap window between the preflight and the actual decoder input.
async function readAuditedBytes(path, expected) {
  const handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== expected.bytes) {
      throw new Error('High-depth pipeline: fixture size changed after audit');
    }
    const bytes = Buffer.alloc(expected.bytes);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset,
        Math.min(65536, bytes.length - offset), offset);
      if (bytesRead === 0) throw new Error('High-depth pipeline: fixture truncated during read');
      offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    if ((await handle.read(extra, 0, 1, offset)).bytesRead !== 0 ||
        !sameFile(opened, await handle.stat()) ||
        !sameFile(opened, await lstat(path))) {
      throw new Error('High-depth pipeline: fixture replaced or changed during read');
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

// Exported separately so regression tests can run with transparently
// ZeTer-generated synthetic inputs, without claiming an external corpus.
export async function profileHighDepthBytes(bytes, expected, { tileSize = 128 } = {}) {
  const header = inspectExternalHighDepthHeader(bytes);
  if (!expected || bytes.byteLength !== expected.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== expected.sha256 ||
      ['version', 'bitsPerChannel', 'width', 'height', 'channels', 'colorMode']
        .some(key => header[key] !== expected[key])) {
    throw new Error('High-depth pipeline: decoded input differs from audited fixture');
  }
  const before = sample();
  const decodeStarted = performance.now();
  const decoded = await decodePsd(bytes);
  const decodeMs = performance.now() - decodeStarted;
  const afterDecode = sample();
  // Prefer a native raster layer; Photoshop documents may contain only
  // adjustment/group layers, in which case a native composite is acceptable.
  const candidates = [
    ...(Array.isArray(decoded.layers) ? decoded.layers.map(layer => ({
      buffer:layer?.pixelBuffer, origin:'layer',
    })) : []),
    { buffer:decoded.compositePixelBuffer, origin:'composite' },
  ];
  const candidate = candidates.find(({ buffer }) => buffer &&
    buffer.bitsPerChannel === expected.bitsPerChannel &&
    buffer.width >= 3 && buffer.height >= 3);
  if (!candidate) throw new Error('High-depth pipeline: no native high-depth raster/composite available');
  const buffer = candidate.buffer;
  const Type = expected.bitsPerChannel === 16 ? Uint16Array : Float32Array;
  if (!(buffer.data instanceof Type)) {
    throw new Error('High-depth pipeline: native samples were quantized or changed type');
  }
  const tileStarted = performance.now();
  const source = serializeTiledPixelBufferSource(buffer, { tileSize });
  const tilesMs = performance.now() - tileStarted;
  if (source.kind !== 'zpe-pixel-buffer-source-v2') {
    throw new Error('High-depth pipeline: expected native tiled source');
  }
  const originals = source.tiles.map(tile => tile.dataUrl);
  const afterTiles = sample();
  const x = Math.floor(buffer.width / 2);
  const y = Math.floor(buffer.height / 2);
  let sampled = 0, workersCreated = 0;
  const worker = createTiledInpaintWorkerJobController({
    createWorker() {
      workersCreated += 1;
      return new Worker(workerUrl, { type:'module' });
    },
  });
  const started = performance.now();
  let result;
  try {
    result = await prepareTiledInpaintWithWorker(source, {
      worker, isAllowed:(col, row) => {
        sampled += 1;
        return col === x && row === y;
      },
    });
  } finally {
    worker.cancel();
  }
  const workerMs = performance.now() - started;
  const afterWorker = sample();
  if (workersCreated !== 1 || sampled !== buffer.width * buffer.height ||
      result?.filled !== 1 || result?.cancelled || result?.unavailable ||
      !Number.isSafeInteger(result.changedTiles) || result.changedTiles > 1 ||
      !Array.isArray(result.source?.tiles) ||
      source.tiles.some((tile, index) => tile.dataUrl !== originals[index])) {
    throw new Error('High-depth pipeline: Worker/immutable native tile invariants failed');
  }
  for (const [index, tile] of source.tiles.entries()) {
    const selectedTile = x >= tile.x && x < tile.x + tile.width &&
      y >= tile.y && y < tile.y + tile.height;
    if (!selectedTile && result.source.tiles[index]?.dataUrl !== originals[index]) {
      throw new Error('High-depth pipeline: unselected tile payload changed');
    }
  }
  return {
    fixture:expected.id, version:header.version,
    bitsPerChannel:header.bitsPerChannel, model:buffer.model,
    pixelOrigin:candidate.origin, width:buffer.width, height:buffer.height,
    tileCount:source.tiles.length, filled:result.filled,
    changedTiles:result.changedTiles, workersCreated, selectionSamples:sampled,
    decodeMs, tilesMs, workerMs, memory:{ before, afterDecode, afterTiles, afterWorker },
  };
}

export async function profileExternalHighDepthCorpus(manifestPath) {
  const audited = await auditExternalHighDepthCorpus(manifestPath);
  const directory = dirname(resolve(manifestPath));
  const fixtures = [];
  for (const entry of audited.fixtures) {
    const bytes = await readAuditedBytes(resolve(directory, entry.file), entry);
    fixtures.push(await profileHighDepthBytes(bytes, entry));
  }
  return {
    kind:'zpe-external-high-depth-psd-psb-native-worker-v1',
    passed:true, fixtures,
    limitations:'Input SHA/header and native Node Worker were checked. Manifest provenance/Photoshop authorship and licenses require independent verification. These are process memory snapshots, not peak RSS or Worker heap. No Chromium file:// import, preview, Undo/Redo or Photoshop rendering parity was tested.',
  };
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--manifest') {
    throw new Error('Usage: node tools/profile-external-high-depth-psd-psb.mjs --manifest /path/to/manifest.json');
  }
  process.stdout.write(JSON.stringify(await profileExternalHighDepthCorpus(process.argv[3]), null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
