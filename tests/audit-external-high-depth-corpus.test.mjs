import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditExternalHighDepthCorpus, inspectExternalHighDepthHeader } from '../tools/audit-external-high-depth-corpus.mjs';

const cli = fileURLToPath(new URL('../tools/audit-external-high-depth-corpus.mjs', import.meta.url));

function mockHeader(version, bitsPerChannel) {
  // Header-only mock; deliberately NOT a valid Photoshop document. These
  // tests prove preflight validation, not an independent high-depth corpus.
  const bytes = Buffer.alloc(30);
  bytes.write('8BPS', 0, 'ascii');
  bytes.writeUInt16BE(version, 4);
  bytes.writeUInt16BE(4, 12);
  bytes.writeUInt32BE(5, 14);
  bytes.writeUInt32BE(7, 18);
  bytes.writeUInt16BE(bitsPerChannel, 22);
  bytes.writeUInt16BE(3, 24);
  bytes.writeUInt32BE(0x1a2b3c4d, 26);
  return bytes;
}

async function corpus(t) {
  const directory = await mkdtemp(join(tmpdir(), 'zpe-high-depth-corpus-'));
  t.after(() => rm(directory, { recursive:true, force:true }));
  const fixtures = [];
  for (const { id, name, version, bits } of [
    { id:'psd16', name:'independent-rgb16.psd', version:1, bits:16 },
    { id:'psb32', name:'independent-hdr32.psb', version:2, bits:32 },
  ]) {
    const bytes = mockHeader(version, bits);
    await writeFile(join(directory, name), bytes);
    fixtures.push({
      id, file:name, size:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex'),
      width:7, height:5, channels:4, colorMode:3,
      sourceUrl:'https://example.org/original/' + name,
      sourceApplication:'Adobe Photoshop',
      license:'MIT', licenseUrl:'https://example.org/license',
      provenanceNotes:'Independent publisher and original revision must be verified manually.',
    });
  }
  const manifest = { schema:'zpe-external-high-depth-psd-psb-v1', fixtures };
  const manifestPath = join(directory, 'manifest.json');
  const save = async () => writeFile(manifestPath, JSON.stringify(manifest));
  await save();
  return { directory, manifest, manifestPath, save };
}

test('Stage 002 P0: pinned external high-depth corpus preflight validates both raw headers and CLI JSON', async t => {
  const state = await corpus(t);
  const report = await auditExternalHighDepthCorpus(state.manifestPath);
  assert.equal(report.passed, true);
  assert.deepEqual(report.fixtures.map(item => [item.id, item.version, item.bitsPerChannel]), [
    ['psd16', 1, 16], ['psb32', 2, 32],
  ]);
  assert.match(report.limitations, /Header\/hash/);
  const child = spawnSync(process.execPath, [cli, '--manifest', state.manifestPath], { encoding:'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), report);
});

test('Stage 002 P0: modified external payload fails SHA-256 even when the header is unchanged', async t => {
  const state = await corpus(t);
  const file = join(state.directory, state.manifest.fixtures[0].file);
  const bytes = await readFile(file);
  bytes[29] ^= 1;
  await writeFile(file, bytes);
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /SHA-256 mismatch/);
});

test('Stage 002 P0: PSD16 and PSB32 use multi-chunk streaming hashes including the last byte', async t => {
  const state = await corpus(t);
  for (const [index, fixture] of state.manifest.fixtures.entries()) {
    // Header-only mock plus a large synthetic tail, NOT a valid Photoshop file.
    const bytes = Buffer.alloc(64 * 1024 * (index + 2) + 137, 0x40 + index);
    mockHeader(index + 1, index ? 32 : 16).copy(bytes);
    bytes[bytes.length - 1] = 0x73 + index;
    await writeFile(join(state.directory, fixture.file), bytes);
    fixture.size = bytes.length;
    fixture.sha256 = createHash('sha256').update(bytes).digest('hex');
  }
  await state.save();
  const report = await auditExternalHighDepthCorpus(state.manifestPath);
  assert.equal(report.passed, true);
  assert.deepEqual(report.fixtures.map(item => item.bytes), state.manifest.fixtures.map(item => item.size));

  // Corruption beyond the initial 64 KiB must never escape the full-file hash.
  const file = join(state.directory, state.manifest.fixtures[1].file);
  const bytes = await readFile(file);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(file, bytes);
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /SHA-256 mismatch/);
});

test('Stage 002 P0: manifest size, depth and raw PSB version mismatches are rejected', async t => {
  const state = await corpus(t);
  state.manifest.fixtures[0].size += 1;
  await state.save();
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /size mismatch/);
  state.manifest.fixtures[0].size -= 1;
  state.manifest.fixtures[1].width = 6;
  await state.save();
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /raw header does not match/);
  state.manifest.fixtures[1].width = 7;
  state.manifest.fixtures[1].id = 'psd16';
  await state.save();
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /unique psd16 and psb32/);
});

test('Stage 002 P0: provenance gaps and filesystem traversal cannot pass audit', async t => {
  const state = await corpus(t);
  const fixture = state.manifest.fixtures[0];
  fixture.file = '../independent-rgb16.psd';
  await state.save();
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /without directories/);
  fixture.file = 'independent-rgb16.psd';
  fixture.sourceApplication = 'ZeTer Photo Editor';
  await state.save();
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /must claim Adobe Photoshop/);
  fixture.sourceApplication = 'Adobe Photoshop';
  fixture.sourceUrl = 'file:///local/unknown.psd';
  await state.save();
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /requires an HTTPS URL/);
});

test('Stage 002 P0: an identical-hash symlink cannot stand in for a pinned fixture', async t => {
  const state = await corpus(t);
  const fixture = state.manifest.fixtures[0];
  const path = join(state.directory, fixture.file);
  const backing = join(state.directory, 'backing-rgb16.psd');
  await rename(path, backing);
  try {
    await symlink(backing, path);
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOTSUP') {
      t.skip('Symlinks unavailable in this environment');
      return;
    }
    throw error;
  }
  // Byte size and SHA-256 still exactly match the pinned manifest. The
  // filesystem identity rule, not just the digest, must reject this path.
  assert.equal(createHash('sha256').update(await readFile(backing)).digest('hex'), fixture.sha256);
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /regular file required/);
});

test('Stage 002 P0: audit can retry a corrected fixture after a streaming digest failure', async t => {
  const state = await corpus(t);
  const fixture = state.manifest.fixtures[1];
  const path = join(state.directory, fixture.file);
  const correct = await readFile(path);
  const tampered = Buffer.from(correct);
  tampered[tampered.length - 1] ^= 0x04;
  await writeFile(path, tampered);
  await assert.rejects(auditExternalHighDepthCorpus(state.manifestPath), /SHA-256 mismatch/);
  await writeFile(path, correct);
  const recovered = await auditExternalHighDepthCorpus(state.manifestPath);
  assert.equal(recovered.passed, true);
  assert.equal(recovered.fixtures[1].sha256, fixture.sha256);
});

test('Stage 002 P0: truncated and non-PSD headers fail independent parser', () => {
  assert.throws(() => inspectExternalHighDepthHeader(new Uint8Array([1, 2, 3])), /truncated/);
  const wrong = mockHeader(1, 16);
  wrong[0] = 0;
  assert.throws(() => inspectExternalHighDepthHeader(wrong), /8BPS signature/);
  const unsupported = mockHeader(1, 8);
  assert.throws(() => inspectExternalHighDepthHeader(unsupported), /unsupported or invalid/);
});
