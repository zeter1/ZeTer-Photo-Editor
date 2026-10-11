import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../tools/profile-tiled-region-io.mjs', import.meta.url));

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding:'utf8', maxBuffer:1024 * 1024,
  });
}

test('Stage 003: region IO baseline isolates RGB16 and CMYKA32 and verifies native precision', () => {
  const result = run('--cases', 'rgb16,cmyk32');
  assert.equal(result.status, 0, result.stderr);
  const profile = JSON.parse(result.stdout);
  assert.equal(profile.kind, 'zpe-tiled-region-io-profile-v1');
  assert.deepEqual(profile.cases.map(item => item.case), ['rgb16','cmyk32']);
  assert.match(profile.limitations, /not per-stage peak/);
  for (const entry of profile.cases) {
    assert.equal(entry.width, 1024);
    assert.equal(entry.height, 512);
    assert.equal(entry.tileSize, 256);
    assert.deepEqual(entry.region, { left:200, top:64, right:824, bottom:448 });
    assert.equal(entry.sourceTiles, 8);
    assert.ok(entry.loadedTiles >= 4 && entry.loadedTiles <= entry.sourceTiles);
    assert.equal(entry.changedPixels, 1);
    assert.equal(entry.changedTiles, 1);
    assert.ok(entry.sourceRawBytes > 0);
    for (const phase of ['fixtureMs','readRegionMs','writeRegionMs','serializeMs']) {
      assert.ok(Number.isFinite(entry[phase]) && entry[phase] >= 0, phase);
    }
    for (const phase of ['before','afterRead','afterWrite','afterSerialize']) {
      assert.ok(entry[phase].rssMiB > 0);
      assert.ok(entry[phase].heapUsedMiB >= 0);
      assert.ok(entry[phase].arrayBuffersMiB >= 0);
      assert.ok(entry[phase].processHighWaterRssMiB > 0);
    }
    assert.ok(entry.observedProcessHighWaterGrowthMiB >= 0);
  }
  assert.equal(profile.cases[0].bitsPerChannel, 16);
  assert.equal(profile.cases[0].channels, 3);
  assert.equal(profile.cases[1].bitsPerChannel, 32);
  assert.equal(profile.cases[1].channels, 5);
});

test('Stage 003: region IO profiler rejects unsupported, duplicate and malformed cases', () => {
  for (const name of ['rgb8','rgb16,rgb16','rgb16,','rgb16,cmyk32,rgb16']) {
    const result = run('--cases', name);
    assert.notEqual(result.status, 0, name);
    assert.match(result.stderr, /Допустимые уникальные сценарии/);
  }
  const invalidFlag = run('--size', '1');
  assert.notEqual(invalidFlag.status, 0);
  assert.match(invalidFlag.stderr, /Usage:/);
});
