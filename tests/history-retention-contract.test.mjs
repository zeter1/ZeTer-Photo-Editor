import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStack } from '../src/core/history.js';

test('byte-budget eviction preserves the active snapshot and navigation after a new branch', () => {
  const history = new HistoryStack(10, 12);
  for (const label of ['A', 'B', 'C', 'D']) history.push(label, label.repeat(2));

  assert.deepEqual(history.entries.map(entry => entry.label), ['B', 'C', 'D']);
  assert.equal(history.index, 2);
  assert.equal(history.totalBytes(), 12);
  assert.equal(history.current().snapshot, 'DD');
  assert.equal(history.undo().label, 'C');

  history.push('E', 'EE');
  assert.deepEqual(history.entries.map(entry => entry.label), ['B', 'C', 'E']);
  assert.equal(history.index, 2);
  assert.equal(history.canRedo(), false);
  assert.equal(history.undo().label, 'C');
  assert.equal(history.undo().label, 'B');
  assert.equal(history.undo(), null);
  assert.equal(history.redo().label, 'C');
  assert.equal(history.redo().label, 'E');
  assert.equal(history.redo(), null);
});

test('count eviction and Clear History keep only the exact selected snapshot', () => {
  const history = new HistoryStack(3, 1024);
  for (const label of ['A', 'B', 'C', 'D']) history.push(label, { label });
  assert.deepEqual(history.entries.map(entry => entry.label), ['B', 'C', 'D']);

  const selected = history.undo();
  assert.equal(selected.label, 'C');
  history.clearToCurrent();

  assert.equal(history.entries.length, 1);
  assert.strictEqual(history.current(), selected);
  assert.equal(history.index, 0);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.equal(history.jump(1), null);

  history.push('E', { label:'E' });
  assert.equal(history.undo().label, 'C');
  assert.equal(history.canRedo(), true);
});
