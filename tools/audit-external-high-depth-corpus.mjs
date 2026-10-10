// Stage 002: provenance and raw-header preflight for a future independently
// Photoshop-authored 16-bit PSD + 32-bit PSB corpus. This intentionally does
// NOT decode pixels or certify that a file was actually saved by Photoshop.
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'zpe-external-high-depth-psd-psb-v1';
const MAX_FIXTURE_BYTES = 512 * 1024 * 1024;
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
  if (!Number.isSafeInteger(value) || value < 27 || value > MAX_FIXTURE_BYTES) {
    fail(label, 'must be a safe byte size between 27 and 512 MiB');
  }
  return value;
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
  if (![1, 2].includes(version) || channels < 1 || channels > 56 ||
      width < 1 || height < 1 || width > 300000 || height > 300000 ||
      ![16, 32].includes(bitsPerChannel) || ![3, 4].includes(colorMode)) {
    fail('header', 'unsupported or invalid high-depth RGB/CMYK header');
  }
  return { version, channels, width, height, bitsPerChannel, colorMode };
}

export async function auditExternalHighDepthCorpus(manifestPath) {
  if (typeof manifestPath !== 'string' || !manifestPath.trim()) fail('manifest', 'path required');
  const absoluteManifest = resolve(manifestPath);
  const manifest = JSON.parse(await readFile(absoluteManifest, 'utf8'));
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
    const bytes = await readFile(path);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== item.sha256) fail(id + '.sha256', 'SHA-256 mismatch');
    const header = inspectExternalHighDepthHeader(bytes);
    if (header.version !== kind.version || header.bitsPerChannel !== kind.bitsPerChannel ||
        header.width !== width || header.height !== height ||
        header.channels !== channels || header.colorMode !== colorMode) {
      fail(id + '.header', 'raw header does not match pinned manifest metadata');
    }
    results.push({ id, file, sha256:hash, bytes:info.size, ...header,
      sourceUrl:item.sourceUrl, license:item.license, licenseUrl:item.licenseUrl,
      sourceApplication:item.sourceApplication });
  }
  return {
    schema:SCHEMA,
    passed:true,
    fixtures:results,
    limitations:'Header/hash/declared provenance preflight only. Photoshop authorship, license rights, full PSD/PSB decode, rendering, UI Worker, and RAM usage require separate evidence.',
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
