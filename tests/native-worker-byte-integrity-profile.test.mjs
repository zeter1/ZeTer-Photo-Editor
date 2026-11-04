import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../tools/profile-native-worker-integrity.mjs', import.meta.url));
function run(...args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding:'utf8', maxBuffer:1024 * 1024, timeout:120000,
  });
}

test('Stage 003: actual RGB16 / Float32 CMYKA Workers retain exact native bytes and original tiles', () => {
  const child = run('--sizes', '1', '--models', 'rgb16,cmyka32');
  assert.equal(child.status, 0, child.stderr || String(child.error));
  const report = JSON.parse(child.stdout);
  assert.equal(report.kind, 'zpe-native-worker-byte-integrity-profile-v1');
  assert.equal(report.cases.length, 2);
  assert.match(report.limitations, /not Photoshop\/PSD\/PSB cross-app/);
  assert.match(report.limitations, /not isolated Worker heap/);
  for (const [index, model] of ['rgb16', 'cmyka32'].entries()) {
    const one = report.cases[index];
    assert.equal(one.model, model);
    assert.equal(one.requestedMiB, 1);
    assert.ok(one.rawBytes > 0 && one.rawBytes <= 1048576);
    assert.equal(one.selectionSamples, one.width * one.height);
    assert.equal(one.workersCreated, 1);
    assert.equal(one.filled, 1);
    assert.equal(one.changed, 1);
    assert.equal(one.changedTiles, 1);
    assert.equal(one.selectedPixels, 1);
    assert.ok(Number.isInteger(one.changedTileIndex) && one.changedTileIndex >= 0);
    assert.equal(one.byteParity, 'exact');
    assert.equal(one.inputTiles, 'immutable');
    for (const field of ['fixtureMs','workerRoundTripMs','oracleMs']) {
      assert.ok(Number.isFinite(one[field]) && one[field] >= 0, field);
    }
    for (const phase of ['beforeWorker','afterWorker','afterOracle']) {
      assert.ok(one.memory[phase].processRssMiB > 0);
      assert.ok(one.memory[phase].parentJsHeapMiB >= 0);
      assert.ok(one.memory[phase].parentArrayBuffersMiB >= 0);
    }
  }
});

test('Stage 003: Worker profile refuses out-of-budget and malformed case arguments', () => {
  for (const args of [
    ['--sizes','49'],
    ['--sizes','0'],
    ['--sizes','1,1'],
    ['--models','rgb16,rgb16'],
    ['--models','unknown'],
    ['--models'],
    ['--child','rgb16','1,2'],
  ]) {
    const child = run(...args);
    assert.notEqual(child.status, 0, args.join(' '));
    assert.ok(child.stderr.includes('Worker profile') || child.stderr.includes('Usage:'),
      child.stderr);
  }
});
