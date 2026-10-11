import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../tools/profile-complex-roi.mjs', import.meta.url));
function profile(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding:'utf8', maxBuffer:1024 * 1024, timeout:180000,
  });
}

test('010E-A: >256-tile connected dense ROI preserves RGB16/CMYKA32 native bytes through Worker', () => {
  const child = profile('--models', 'rgb16,cmyka32');
  assert.equal(child.status, 0, child.stderr || String(child.error));
  const report = JSON.parse(child.stdout);
  assert.equal(report.kind, 'zpe-complex-roi-profile-v1');
  assert.equal(report.cases.length, 2);
  assert.match(report.limitations, /not Photoshop-authored reference/);
  assert.match(report.limitations, /not isolated per-operation peaks/);
  for (const [index, model] of ['rgb16', 'cmyka32'].entries()) {
    const result = report.cases[index];
    assert.equal(result.model, model);
    assert.equal(result.width, 256);
    assert.equal(result.height, 256);
    assert.equal(result.tileSize, 4);
    assert.equal(result.tileCount, 4096);
    assert.equal(result.selectedPixels, 2 * 64 * 64 + 96);
    assert.equal(result.filled, result.selectedPixels);
    assert.equal(result.changed, result.selectedPixels);
    assert.ok(result.changedTiles > 256);
    assert.equal(result.maxLayerPixels, 25_000);
    assert.equal(result.budgetRefusal, 'atomic');
    assert.equal(result.cooperativeCancellation, 'atomic');
    assert.equal(result.workerParity, 'exact-native-tiles');
    assert.equal(result.sourceTiles, 'immutable');
    assert.ok(result.cooperativeYields >= 25);
    for (const key of ['fixtureMs', 'syncMs', 'workerRoundTripMs']) {
      assert.ok(Number.isFinite(result[key]) && result[key] >= 0);
    }
    for (const phase of ['before', 'afterSync', 'afterWorker']) {
      assert.ok(result.memory[phase].processRssMiB > 0);
      assert.ok(result.memory[phase].parentHeapMiB >= 0);
      assert.ok(result.memory[phase].parentArrayBuffersMiB >= 0);
    }
  }
});

test('010E-A: complex ROI diagnostic rejects unknown and duplicate models', () => {
  for (const args of [
    ['--models', 'rgb16,rgb16'],
    ['--models', 'unknown'],
    ['--models', ''],
    ['--models'],
    ['--child', 'rgb16,cmyka32'],
  ]) {
    const child = profile(...args);
    assert.notEqual(child.status, 0, args.join(' '));
    assert.match(child.stderr, /Complex ROI profile|Usage:/);
  }
});
