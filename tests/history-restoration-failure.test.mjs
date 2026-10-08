import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStack } from '../src/core/history.js';
import { createHistoryNavigationController } from '../src/workspace/history-navigation-controller.js';

function createHarness() {
  const history = new HistoryStack();
  for (const label of ['A', 'B', 'C']) history.push(label, label);
  const invalidSnapshots = new Set();
  const failure = new Error('Некорректный снимок истории');
  const publications = [];
  let document = { snapshot:'C' };
  const controller = createHistoryNavigationController({
    state: {
      getHistory: () => history,
      setDocument: value => { document = value; publications.push('document'); },
    },
    guard: { blockPendingDocumentEdit: () => false },
    restore: {
      restoreDocument: snapshot => {
        if (invalidSnapshots.has(snapshot)) throw failure;
        return { snapshot };
      },
    },
    transient: {
      clearSelection: () => publications.push('selection'),
      clearRasterEdit: () => publications.push('raster'),
      resetCrop: () => publications.push('crop'),
    },
    runtime: {
      updateAll: () => publications.push('render'),
      markDirty: () => publications.push('dirty'),
      setStatus: () => publications.push('status'),
    },
  });
  return { history, invalidSnapshots, failure, publications, controller, get document() { return document; } };
}

test('failed Undo snapshot restore preserves the cursor and does not publish a document', () => {
  const h = createHarness();
  h.invalidSnapshots.add('B');
  assert.throws(() => h.controller.undo(), error => error === h.failure);
  assert.equal(h.history.index, 2);
  assert.equal(h.history.current().snapshot, 'C');
  assert.equal(h.history.canRedo(), false);
  assert.deepEqual(h.document, { snapshot:'C' });
  assert.deepEqual(h.publications, []);
  h.invalidSnapshots.delete('B');
  assert.equal(h.controller.undo(), true);
  assert.equal(h.history.index, 1);
  assert.deepEqual(h.document, { snapshot:'B' });
});

test('failed Redo snapshot restore keeps the previously active entry and can retry', () => {
  const h = createHarness();
  assert.equal(h.controller.undo(), true);
  h.publications.length = 0;
  h.invalidSnapshots.add('C');
  assert.throws(() => h.controller.redo(), error => error === h.failure);
  assert.equal(h.history.index, 1);
  assert.equal(h.history.current().snapshot, 'B');
  assert.equal(h.history.canRedo(), true);
  assert.deepEqual(h.document, { snapshot:'B' });
  assert.deepEqual(h.publications, []);
  h.invalidSnapshots.delete('C');
  assert.equal(h.controller.redo(), true);
  assert.equal(h.history.index, 2);
  assert.deepEqual(h.document, { snapshot:'C' });
});

test('failed history jump rolls back the cursor and leaves UI publication untouched', () => {
  const h = createHarness();
  h.invalidSnapshots.add('A');
  assert.throws(() => h.controller.jumpToHistory(0), error => error === h.failure);
  assert.equal(h.history.index, 2);
  assert.equal(h.history.current().snapshot, 'C');
  assert.deepEqual(h.document, { snapshot:'C' });
  assert.deepEqual(h.publications, []);
  h.invalidSnapshots.delete('A');
  assert.equal(h.controller.jumpToHistory(0), true);
  assert.equal(h.history.index, 0);
  assert.deepEqual(h.document, { snapshot:'A' });
});
