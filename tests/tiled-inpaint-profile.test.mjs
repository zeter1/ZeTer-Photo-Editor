import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../tools/profile-tiled-inpaint.mjs', import.meta.url));

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding:'utf8', maxBuffer:1024 * 1024,
  });
}

test('Stage 003 profile is machine-readable and verifies untouched tiled payloads', () => {
  const child = run('--sizes', '1');
  assert.equal(child.status, 0, child.stderr);
  const profile = JSON.parse(child.stdout);
  assert.equal(profile.kind, 'zpe-tiled-inpaint-profile-v1');
  assert.equal(profile.cases.length, 1);
  const one = profile.cases[0];
  assert.equal(one.requestedMiB, 1);
  assert.equal(one.model, 'CMYKA Float32');
  assert.ok(one.rawBytes > 0 && one.rawBytes <= 1024 * 1024);
  assert.equal(one.selectedPixels, 1);
  assert.equal(one.filled, 1);
  assert.equal(one.changed, 1);
  assert.equal(one.changedTiles, 1);
  assert.ok(one.loadedTiles >= 1);
  assert.ok(Number.isFinite(one.fixtureMs) && one.fixtureMs >= 0);
  assert.ok(Number.isFinite(one.inpaintMs) && one.inpaintMs >= 0);
  for (const phase of ['before','after']) {
    assert.ok(one[phase].rssMiB > 0);
    assert.ok(one[phase].arrayBuffersMiB >= 0);
    assert.ok(one[phase].processHighWaterRssMiB > 0);
  }
});

test('Stage 003 profile rejects sizes above the 48 MiB native source limit', () => {
  const child = run('--sizes', '49');
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /1 до 48 MiB/);
});
