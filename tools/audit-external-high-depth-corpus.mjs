// Stage 002: provenance and raw-header preflight for a future independently
// Photoshop-authored 16-bit PSD + 32-bit PSB corpus. This intentionally does
// NOT decode pixels or certify that a file was actually saved by Photoshop.
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'zpe-external-high-depth-psd-psb-v1';
const MAX_FIXTURE_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const KINDS = Object.freeze({
  psd16:{ extension:'.psd', version:1, bitsPerChannel:16 },
  psb32:{ extension:'.psb', version:2, bitsPerChannel:32 },
});

function fail(label, reason) {
  throw new Error('External high-depth corpus: ' + label + ': ' + reason);
}

function nonempty(value, label, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min) fail(label, 'required non-empty text');
  return value.trim();
}

function httpsUrl(value, label) {
  const text = nonempty(value, label);
  let url;
  try { url = new URL(text); } catch { fail(label, 'invalid URL'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    fail(label, 'requires an HTTPS URL without credentials');
  }
  return text;
}

function safeSize(value, label) {
  if (!Number.isSafeInteger(value) || value < 40 || value > MAX_FIXTURE_BYTES) {
    fail(label, 'must be a safe byte size between 40 and 512 MiB');
  }
  return value;
}

function sameFile(a, b) {
  return a.isFile() && b.isFile() && a.dev === b.dev && a.ino === b.ino && a.size === b.size;
}

function positive(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail(label, 'must be a positive integer');
  return value;
}

// Independent header read (not ZeTer codec/writer). This is a cheap wire
// preflight only: a matching 26-byte header is NOT a valid PSD/PSB decode.
export function inspectExternalHighDepthHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 27) fail('header', 'truncated PSD/PSB');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== '8BPS') fail('header', 'missing 8BPS signature');
  for (let i = 6; i < 12; i += 1) {
    if (bytes[i] !== 0) fail('header', 'reserved bytes must be zero');
  }
  const version = view.getUint16(4, false);
  const channels = view.getUint16(12, false);
  const height = view.getUint32(14, false);
  const width = view.getUint32(18, false);
  const bitsPerChannel = view.getUint16(22, false);
  const colorMode = view.getUint16(24, false);
  if (![1, 2].includes(version) || channels < (colorMode === 4 ? 4 : 3) || channels > 56 ||
      width < 1 || height < 1 || width > 300000 || height > 300000 ||
      ![16, 32].includes(bitsPerChannel) || ![3, 4].includes(colorMode)) {
    fail('header', 'unsupported or invalid high-depth RGB/CMYK header');
  }
  return { version, channels, width, height, bitsPerChannel, colorMode };
}

// Parse only top-level PSD/PSB length envelopes on the same pinned descriptor
// that was hashed. BigInt keeps PSB uint64 lengths exact before bounding them
// by the already-limited fixture size. This does not decode the layer section
// or prove that the composite payload is complete or Photoshop-renderable.
async function inspectExternalHighDepthSections(handle, bytes, version, label) {
  let offset = 26;
  async function readSmall(length, section) {
    if (offset > bytes - length) fail(label + '.sections', 'truncated ' + section);
    const data = Buffer.alloc(length);
    let copied = 0;
    while (copied < length) {
      const { bytesRead } = await handle.read(data, copied, length - copied, offset + copied);
      if (!bytesRead) fail(label + '.sections', 'truncated ' + section);
      copied += bytesRead;
    }
    offset += length;
    return data;
  }
  for (const [section, lengthBytes] of [
    ['color-mode data', 4], ['image resources', 4],
    ['layer/mask data', version === 2 ? 8 : 4],
  ]) {
    const lengthData = await readSmall(lengthBytes, section + ' length');
    const declared = lengthBytes === 8 ? lengthData.readBigUInt64BE(0)
      : BigInt(lengthData.readUInt32BE(0));
    if (declared > BigInt(bytes - offset)) {
      fail(label + '.sections', section + ' exceeds file bounds');
    }
    offset += Number(declared);
  }
  const compression = (await readSmall(2, 'merged image compression')).readUInt16BE(0);
  if (compression > 3) fail(label + '.sections', 'invalid merged image compression');
  if (offset === bytes) fail(label + '.sections', 'missing merged image payload');
  return compression;
}

export async function auditExternalHighDepthCorpus(manifestPath) {
  if (typeof manifestPath !== 'string' || !manifestPath.trim()) fail('manifest', 'path required');
  const absoluteManifest = resolve(manifestPath);
  // The manifest is untrusted metadata. Bound its read independently of the
  // (much larger) fixture budget, and pin the descriptor against path swaps.
  const manifestInfo = await lstat(absoluteManifest);
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink() ||
      manifestInfo.size > MAX_MANIFEST_BYTES) {
    fail('manifest', 'regular file at most 1 MiB required (no symlinks)');
  }
  const manifestHandle = await open(absoluteManifest, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
  let manifestText;
  try {
    const opened = await manifestHandle.stat();
    if (!sameFile(manifestInfo, opened)) fail('manifest', 'replaced before open');
    const chunks = [];
    const buffer = Buffer.alloc(64 * 1024);
    let total = 0;
    while (true) {
      const { bytesRead } = await manifestHandle.read(buffer, 0,
        Math.min(buffer.length, MAX_MANIFEST_BYTES + 1 - total), null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > MAX_MANIFEST_BYTES) fail('manifest', 'exceeds 1 MiB');
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    if (!sameFile(opened, await manifestHandle.stat()) ||
        !sameFile(opened, await lstat(absoluteManifest))) {
      fail('manifest', 'replaced during read');
    }
    manifestText = Buffer.concat(chunks).toString('utf8');
  } finally {
    await manifestHandle.close();
  }
  const manifest = JSON.parse(manifestText);
  if (manifest?.schema !== SCHEMA || !Array.isArray(manifest.fixtures) ||
      manifest.fixtures.length !== 2) {
    fail('manifest', 'expected schema ' + SCHEMA + ' with exactly psd16 and psb32 entries');
  }
  const directory = dirname(absoluteManifest);
  const seenIds = new Set(), seenFiles = new Set();
  const results = [];
  for (const item of manifest.fixtures) {
    const id = item?.id;
    const kind = Object.hasOwn(KINDS, id) ? KINDS[id] : null;
    if (!kind || seenIds.has(id)) fail('fixture id', 'expected unique psd16 and psb32');
    seenIds.add(id);

    const file = nonempty(item.file, id + '.file');
    if (isAbsolute(file) || basename(file) !== file ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}\.(psd|psb)$/.test(file) ||
        !file.toLowerCase().endsWith(kind.extension) || seenFiles.has(file)) {
      fail(id + '.file', 'must be a unique local PSD/PSB filename, without directories or symlinks');
    }
    seenFiles.add(file);
    const expectedSize = safeSize(item.size, id + '.size');
    if (kind.version === 2 && expectedSize < 44) {
      fail(id + '.size', 'PSB requires at least 44 header/section bytes');
    }
    if (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      fail(id + '.sha256', 'requires pinned lowercase SHA-256');
    }
    const width = positive(item.width, id + '.width');
    const height = positive(item.height, id + '.height');
    const channels = positive(item.channels, id + '.channels');
    const colorMode = positive(item.colorMode, id + '.colorMode');
    httpsUrl(item.sourceUrl, id + '.sourceUrl');
    httpsUrl(item.licenseUrl, id + '.licenseUrl');
    nonempty(item.license, id + '.license');
    nonempty(item.provenanceNotes, id + '.provenanceNotes', 20);
    if (item.sourceApplication !== 'Adobe Photoshop') {
      fail(id + '.sourceApplication', 'must claim Adobe Photoshop; verify independently before accepting');
    }

    const path = resolve(directory, file);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) fail(id + '.file', 'regular file required (no symlinks)');
    if (info.size !== expectedSize) fail(id + '.size', 'size mismatch');
    // Pin the opened descriptor, not only the pathname: lstat() followed by
    // an independent createReadStream(path) allowed a rename/symlink swap
    // between the safety check and the bytes actually hashed. O_NOFOLLOW
    // rejects a swapped final symlink where supported; fd/path identity
    // checks also reject a replaced regular file. Never buffer the full PSB.
    const handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    const headerBytes = Buffer.alloc(27);
    const digest = createHash('sha256');
    let headerLength = 0, streamedBytes = 0;
    let hash, header, imageCompression;
    try {
      const opened = await handle.stat();
      if (!sameFile(info, opened)) fail(id + '.file', 'file replaced before open');
      for await (const chunk of handle.createReadStream({ highWaterMark:64 * 1024, autoClose:false })) {
        streamedBytes += chunk.byteLength;
        if (streamedBytes > expectedSize) fail(id + '.size', 'size mismatch during stream');
        digest.update(chunk);
        if (headerLength < headerBytes.length) {
          const copied = Math.min(chunk.byteLength, headerBytes.length - headerLength);
          chunk.copy(headerBytes, headerLength, 0, copied);
          headerLength += copied;
        }
      }
      if (streamedBytes !== expectedSize) fail(id + '.size', 'size mismatch during stream');
      const finished = await handle.stat();
      const pathname = await lstat(path);
      if (!sameFile(opened, finished) || !sameFile(opened, pathname)) {
        fail(id + '.file', 'file replaced during stream');
      }
      hash = digest.digest('hex');
      if (hash !== item.sha256) fail(id + '.sha256', 'SHA-256 mismatch');
      header = inspectExternalHighDepthHeader(headerBytes);
      if (header.version !== kind.version || header.bitsPerChannel !== kind.bitsPerChannel ||
          header.width !== width || header.height !== height ||
          header.channels !== channels || header.colorMode !== colorMode) {
        fail(id + '.header', 'raw header does not match pinned manifest metadata');
      }
      imageCompression = await inspectExternalHighDepthSections(handle, streamedBytes, header.version, id);
      if (!sameFile(opened, await handle.stat()) || !sameFile(opened, await lstat(path))) {
        fail(id + '.file', 'file replaced during section read');
      }
    } finally {
      await handle.close();
    }
    results.push({ id, file, sha256:hash, bytes:streamedBytes, ...header, imageCompression,
      sourceUrl:item.sourceUrl, license:item.license, licenseUrl:item.licenseUrl,
      sourceApplication:item.sourceApplication });
  }
  return {
    schema:SCHEMA,
    passed:true,
    fixtures:results,
    limitations:'Header/hash/top-level section bounds/declared provenance preflight only. Photoshop authorship, license rights, full PSD/PSB decode, rendering, UI Worker, and RAM usage require separate evidence.',
  };
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--manifest') {
    throw new Error('Usage: node tools/audit-external-high-depth-corpus.mjs --manifest /path/to/manifest.json');
  }
  process.stdout.write(JSON.stringify(await auditExternalHighDepthCorpus(process.argv[3]), null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
