import test from 'node:test';
import assert from 'node:assert/strict';

import { createLayerGroupCommandController } from '../src/layers/command-controller.js';
import {
  createDocument,
  createShapeLayer,
  createLayerGroup,
  addLayer,
  addLayerGroup,
} from '../src/core/state.js';

function createHarness(initialDocument) {
  let activeDocument = initialDocument;
  let pending = false;
  const commits = [];
  const statuses = [];
  const modals = [];

  const controller = createLayerGroupCommandController({
    state: { getDocument: () => activeDocument },
    transaction: {
      commit: label => commits.push(label),
      blockPendingEdit: () => pending,
    },
    ui: {
      showModal: options => modals.push(options),
      setStatus: message => statuses.push(message),
    },
  });

  return {
    controller,
    commits,
    statuses,
    modals,
    setDocument(value) { activeDocument = value; },
    setPending(value) { pending = value; },
  };
}

function makeNestedDocument({ rootLocked = false } = {}) {
  const doc = createDocument({ name: 'commands', width: 64, height: 64 });
  const root = addLayerGroup(doc, createLayerGroup({ name: 'Root', locked: rootLocked }));
  const child = addLayerGroup(doc, createLayerGroup({ name: 'Child', parentGroupId: root.id }));
  const layer = addLayer(doc, createShapeLayer({ name: 'Nested' }));
  layer.groupId = child.id;
  doc.selectedLayerId = layer.id;
  return { doc, root, child, layer };
}

test('layer visibility and selected wrappers publish one canonical transaction', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createShapeLayer({ name: 'Layer' }));
  const h = createHarness(doc);

  assert.equal(h.controller.toggleLayerVisibility(doc, layer.id), true);
  assert.equal(layer.visible, false);
  assert.deepEqual(h.commits, ['Скрыть слой']);

  assert.equal(h.controller.toggleSelectedLayerVisibility(), true);
  assert.equal(layer.visible, true);
  assert.deepEqual(h.commits, ['Скрыть слой', 'Показать слой']);
});

test('nested locked ancestor blocks layer lock, delete, duplicate and rename', () => {
  const { doc, layer } = makeNestedDocument({ rootLocked: true });
  const h = createHarness(doc);

  assert.equal(h.controller.toggleLayerLock(doc, layer.id), false);
  assert.equal(h.controller.deleteLayer(doc, layer.id), false);
  assert.equal(h.controller.duplicateLayer(doc, layer.id), false);
  assert.equal(h.controller.renameLayer(doc, layer.id), false);

  assert.equal(layer.locked, false);
  assert.equal(doc.layers.length, 1);
  assert.equal(h.modals.length, 0);
  assert.deepEqual(h.commits, []);
  assert.ok(h.statuses.some(message => message.includes('заблокирован')));
});

test('delete obeys the pending-edit guard and successful delete/duplicate commit once', () => {
  const doc = createDocument();
  const first = addLayer(doc, createShapeLayer({ name: 'First' }));
  const second = addLayer(doc, createShapeLayer({ name: 'Second' }));
  const h = createHarness(doc);

  h.setPending(true);
  assert.equal(h.controller.deleteLayer(doc, second.id), false);
  assert.equal(doc.layers.length, 2);
  assert.deepEqual(h.commits, []);

  h.setPending(false);
  assert.equal(h.controller.duplicateLayer(doc, first.id), true);
  assert.equal(doc.layers.length, 3);
  assert.deepEqual(h.commits, ['Дублировать слой']);

  assert.equal(h.controller.deleteLayer(doc, second.id), true);
  assert.equal(doc.layers.some(layer => layer.id === second.id), false);
  assert.deepEqual(h.commits, ['Дублировать слой', 'Удалить слой']);
});

test('layer rename re-resolves exact owner and skips same-name or stale submissions', () => {
  const first = createDocument({ name: 'first' });
  const layer = addLayer(first, createShapeLayer({ name: 'Original' }));
  const second = createDocument({ name: 'second' });
  const h = createHarness(first);

  assert.equal(h.controller.renameLayer(first, layer.id), true);
  assert.equal(h.modals.length, 1);
  h.modals.at(-1).onSubmit({ name: 'Original' });
  assert.deepEqual(h.commits, []);

  assert.equal(h.controller.renameLayer(first, layer.id), true);
  const staleModal = h.modals.at(-1);
  h.setDocument(second);
  staleModal.onSubmit({ name: 'Stale write' });
  assert.equal(layer.name, 'Original');
  assert.deepEqual(h.commits, []);

  h.setDocument(first);
  assert.equal(h.controller.renameLayer(first, layer.id), true);
  h.modals.at(-1).onSubmit({ name: 'Renamed' });
  assert.equal(layer.name, 'Renamed');
  assert.deepEqual(h.commits, ['Переименовать слой']);
});

test('group visibility and lock use recursive ancestor policy', () => {
  const { doc, root, child } = makeNestedDocument({ rootLocked: true });
  const h = createHarness(doc);

  assert.equal(h.controller.toggleGroupVisibility(doc, child.id), true);
  assert.equal(child.visible, false);
  assert.deepEqual(h.commits, ['Скрыть группу слоёв']);

  assert.equal(h.controller.toggleGroupLock(doc, child.id), false);
  assert.equal(child.locked, false);
  assert.deepEqual(h.commits, ['Скрыть группу слоёв']);

  root.locked = false;
  assert.equal(h.controller.toggleGroupLock(doc, child.id), true);
  assert.equal(child.locked, true);
  assert.deepEqual(h.commits, ['Скрыть группу слоёв', 'Заблокировать группу слоёв']);
});

test('group creation and rename reject locked or stale owners without history', () => {
  const { doc, root, child } = makeNestedDocument({ rootLocked: true });
  const h = createHarness(doc);

  assert.equal(h.controller.createGroup(doc, child.id), null);
  assert.deepEqual(h.commits, []);

  root.locked = false;
  const created = h.controller.createGroup(doc, child.id);
  assert.ok(created);
  assert.equal(created.parentGroupId, child.id);
  assert.deepEqual(h.commits, ['Новая подгруппа']);

  assert.equal(h.controller.renameGroup(doc, created.id), true);
  h.modals.at(-1).onSubmit({ name: created.name });
  assert.deepEqual(h.commits, ['Новая подгруппа']);

  const staleModal = h.modals.at(-1);
  h.setDocument(createDocument({ name: 'other' }));
  staleModal.onSubmit({ name: 'Wrong owner' });
  assert.notEqual(created.name, 'Wrong owner');
  assert.deepEqual(h.commits, ['Новая подгруппа']);
});

test('group properties commit only real validated changes and stale Apply is a no-op', () => {
  const { doc, child } = makeNestedDocument();
  child.blendMode = 'pass-through';
  child.opacity = 1;
  const h = createHarness(doc);

  assert.equal(h.controller.editGroupProperties(doc, child.id), true);
  h.modals.at(-1).onSubmit({ blendMode: 'pass-through', opacity: '100' });
  assert.deepEqual(h.commits, []);

  assert.equal(h.controller.editGroupProperties(doc, child.id), true);
  h.modals.at(-1).onSubmit({ blendMode: 'multiply', opacity: '75' });
  assert.equal(child.blendMode, 'multiply');
  assert.equal(child.opacity, .75);
  assert.deepEqual(h.commits, ['Параметры группы']);

  assert.equal(h.controller.editGroupProperties(doc, child.id), true);
  const staleModal = h.modals.at(-1);
  h.setDocument(createDocument({ name: 'other' }));
  staleModal.onSubmit({ blendMode: 'screen', opacity: '50' });
  assert.equal(child.blendMode, 'multiply');
  assert.equal(child.opacity, .75);
  assert.deepEqual(h.commits, ['Параметры группы']);
});

test('delete group preserves members at the parent level and commits once', () => {
  const { doc, root, child, layer } = makeNestedDocument();
  const grandchild = addLayerGroup(doc, createLayerGroup({ name: 'Grandchild', parentGroupId: child.id }));
  const nestedLayer = addLayer(doc, createShapeLayer({ name: 'Nested 2' }));
  nestedLayer.groupId = grandchild.id;
  const h = createHarness(doc);

  assert.equal(h.controller.deleteGroup(doc, child.id), true);
  assert.equal(doc.groups.some(group => group.id === child.id), false);
  assert.equal(layer.groupId, root.id);
  assert.equal(grandchild.parentGroupId, root.id);
  assert.equal(nestedLayer.groupId, grandchild.id);
  assert.deepEqual(h.commits, ['Удалить группу слоёв']);
});

test('relative reorder rejects locks and does not publish history for a no-op target', () => {
  const doc = createDocument();
  const a = addLayer(doc, createShapeLayer({ name: 'A' }));
  const b = addLayer(doc, createShapeLayer({ name: 'B' }));
  const c = addLayer(doc, createShapeLayer({ name: 'C' }));
  doc.layers = [a, b, c];
  const h = createHarness(doc);

  assert.equal(h.controller.moveLayerRelative(doc, a.id, b.id, true), true);
  assert.deepEqual(doc.layers.map(layer => layer.id), [b.id, a.id, c.id]);
  assert.deepEqual(h.commits, ['Изменить порядок слоёв']);

  assert.equal(h.controller.moveLayerRelative(doc, a.id, b.id, true), false);
  assert.deepEqual(h.commits, ['Изменить порядок слоёв']);

  b.locked = true;
  assert.equal(h.controller.moveLayerRelative(doc, c.id, b.id, false), false);
  assert.deepEqual(h.commits, ['Изменить порядок слоёв']);
});

test('layer/group move commands publish only successful state changes', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createShapeLayer({ name: 'Layer' }));
  const root = addLayerGroup(doc, createLayerGroup({ name: 'Root' }));
  const child = addLayerGroup(doc, createLayerGroup({ name: 'Child', parentGroupId: root.id }));
  const h = createHarness(doc);

  assert.equal(h.controller.moveLayerIntoGroup(doc, layer.id, child.id), true);
  assert.equal(layer.groupId, child.id);
  assert.equal(child.collapsed, false);
  assert.deepEqual(h.commits, ['Переместить слой в группу']);

  assert.equal(h.controller.moveLayerIntoGroup(doc, layer.id, child.id), false);
  assert.deepEqual(h.commits, ['Переместить слой в группу']);

  assert.equal(h.controller.moveGroupIntoGroup(doc, root.id, child.id), false);
  assert.deepEqual(h.commits, ['Переместить слой в группу']);

  assert.equal(h.controller.moveLayerToRoot(doc, layer.id), true);
  assert.equal(layer.groupId, null);
  assert.deepEqual(h.commits, ['Переместить слой в группу', 'Вынести слой из группы']);

  assert.equal(h.controller.moveGroupToRoot(doc, child.id), true);
  assert.equal(child.parentGroupId, null);
  assert.deepEqual(h.commits, [
    'Переместить слой в группу',
    'Вынести слой из группы',
    'Вынести группу на верхний уровень',
  ]);

  assert.equal(h.controller.moveGroupToRoot(doc, child.id), false);
  assert.equal(h.controller.moveLayerToRoot(doc, layer.id), false);
  assert.equal(h.commits.length, 3);
});

test('step moves share the command owner and selected wrapper', () => {
  const doc = createDocument();
  const low = addLayer(doc, createShapeLayer({ name: 'Low' }));
  const high = addLayer(doc, createShapeLayer({ name: 'High' }));
  doc.layers = [low, high];
  doc.selectedLayerId = low.id;
  const h = createHarness(doc);

  assert.equal(h.controller.moveSelectedLayer(1), true);
  assert.deepEqual(doc.layers.map(layer => layer.id), [high.id, low.id]);
  assert.deepEqual(h.commits, ['Поднять слой']);

  assert.equal(h.controller.moveSelectedLayer(1), false);
  assert.deepEqual(h.commits, ['Поднять слой']);
});
