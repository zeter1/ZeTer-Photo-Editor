import test from 'node:test';
import assert from 'node:assert/strict';
import { settleBrowserRecoveryStartup } from '../tools/browser-recovery-startup.mjs';

function makeHarness({ pendingReads = 3, withRecovery = true, unexpectedModal = false, failed = false } = {}) {
  let polls = 0;
  let accepted = 0;
  let draftCancelled = 0;
  let settled = false;
  const labels = [];
  const evaluate = async (_client, expression) => {
    if (expression.includes("const modal = document.querySelector('#modalRoot .recovery-modal')")) {
      polls++;
      if (failed) return { ready:'error', recovery:false, actionable:false };
      if (polls <= pendingReads) return { ready:'', recovery:false, actionable:false };
      if (withRecovery && !settled) return { ready:'', recovery:true, actionable:true };
      return { ready:'true', recovery:false, actionable:false };
    }
    if (expression.includes("const button = document.querySelector('#modalRoot .recovery-modal [data-new-project]')")) {
      accepted++;
      settled = true;
      return true;
    }
    if (expression.includes("const dialog = document.querySelector('#modalRoot [role=\"dialog\"]')")) {
      draftCancelled++;
      return unexpectedModal ? 'unexpected' : (withRecovery ? 'cancelled' : 'none');
    }
    if (expression.includes("!document.querySelector('#modalRoot [role=dialog]')")) return true;
    throw new Error('Unexpected Chromium expression: ' + expression.slice(0, 100));
  };
  const waitFor = async (label, predicate) => {
    labels.push(label);
    for (let i = 0; i < 30; i++) {
      const result = await predicate();
      if (result) return result;
    }
    throw new Error('Timed out: ' + label);
  };
  const failIfFalse = (value, message) => { if (!value) throw new Error(message); };
  return {
    ports: {evaluate,waitFor,assert:failIfFalse},
    state: () => ({polls,accepted,draftCancelled,labels}),
  };
}

test('035 delayed recovery scan waits for real modal and completes after its public action on three reloads', async () => {
  for (let reload = 1; reload <= 3; reload++) {
    const harness = makeHarness({pendingReads:reload + 3});
    const result = await settleBrowserRecoveryStartup({}, {
      ...harness.ports, label:`035 synthetic reload ${reload}`,
    });
    assert.deepEqual(result, {recoveryPrompt:true,draft:'cancelled'});
    assert.equal(harness.state().accepted, 1);
    assert.equal(harness.state().draftCancelled, 1);
    assert.ok(harness.state().polls > reload + 3);
    assert.equal(harness.state().labels.length, 3);
  }
});

test('035 empty delayed recovery scan never clicks New Project', async () => {
  const harness = makeHarness({pendingReads:5,withRecovery:false});
  const result = await settleBrowserRecoveryStartup({}, harness.ports);
  assert.deepEqual(result, {recoveryPrompt:false,draft:'none'});
  assert.equal(harness.state().accepted, 0);
  assert.ok(harness.state().polls >= 6);
});

test('035 unexpected dialog after bootstrap is rejected rather than dismissed', async () => {
  const harness = makeHarness({pendingReads:2,unexpectedModal:true});
  await assert.rejects(() => settleBrowserRecoveryStartup({}, harness.ports),
    /unexpected modal left after recovery startup/);
  assert.equal(harness.state().accepted, 1);
});

test('035 startup errors cannot be mistaken for a recovered and usable editor', async () => {
  const harness = makeHarness({failed:true});
  await assert.rejects(() => settleBrowserRecoveryStartup({}, harness.ports),
    /application bootstrap failed/);
  assert.equal(harness.state().accepted, 0);
});
