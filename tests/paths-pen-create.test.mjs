import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathsController } from '../src/ui/paths-controller.js';

function setup({ paths = [], locked = false } = {}) {
  const doc = { paths: structuredClone(paths) };
  const layer = { type: 'shape', shape: 'rect', vectorMask: null };
  const commits = [], edits = [], statuses = [];
  const controls = {
    new: { disabled: true, onclick: null },
    applyMask: { disabled: true, onclick: null },
  };
  const controller = createPathsController({
    state: {
      getDocument: () => doc,
      getSelectedLayer: () => layer,
      isLayerLocked: () => locked,
      commit: text => commits.push(text),
    },
    vectors: { importVectorMask: value => structuredClone(value) },
    edit: { beginPathEdit: index => edits.push(index) },
    ui: { controls, setStatus: text => statuses.push(text) },
  });
  controller.bindControls();
  return { doc, layer, commits, edits, statuses, controls, controller };
}

const points = [
  { x: 2, y: 2, kind: 'corner' },
  { x: 40, y: 2, kind: 'corner' },
  { x: 40, y: 40, kind: 'corner' },
  { x: 2, y: 40, kind: 'corner' },
];

test('new Paths UI control creates an editable empty Saved Path without shape/selection fixture', () => {
  const { doc, layer, commits, edits, controls, controller } = setup();
  assert.equal(controls.new.disabled, true);
  controller.updatePathsPanel();
  assert.equal(controls.new.disabled, false);
  assert.equal(typeof controls.new.onclick, 'function');
  assert.equal(controls.new.onclick(), true);
  assert.equal(doc.paths.length, 1);
  assert.equal(doc.paths[0].id, 2000);
  assert.equal(doc.paths[0].fillStartsWithAllPixels, false);
  assert.deepEqual(doc.paths[0].subpaths, []);
  assert.equal(controller.getSelectedIndex(), 0);
  assert.deepEqual(edits, [0]);
  assert.equal(commits.length, 1);
  controller.updatePathsPanel();
  assert.equal(controls.applyMask.disabled, true, 'empty path cannot be applied as a mask');
  assert.equal(controller.applySelectedDocumentPathAsVectorMask(), false);
  assert.equal(layer.vectorMask, null);
  assert.equal(controller.appendPenSubpath(points, { index: 0, expectedDocument: doc, closed: true }), true);
  controller.updatePathsPanel();
  assert.equal(controls.applyMask.disabled, false);
  assert.equal(controller.applySelectedDocumentPathAsVectorMask(), true);
  assert.equal(layer.vectorMask.subpaths[0].points.length, 4);
  assert.equal(commits.length, 3, 'create, draw and apply are separate undoable transactions');
});

test('new empty Saved Path consumes an unused PSD resource ID and never overwrites existing paths', () => {
  const original = { id: 2000, name: 'Kept', subpaths: [] };
  const { doc, controller, commits } = setup({ paths: [original] });
  assert.equal(controller.createEmptyDocumentPath(), true);
  assert.equal(doc.paths[0].name, original.name);
  assert.equal(doc.paths[1].id, 2001);
  assert.equal(controller.getSelectedIndex(), 1);
  assert.equal(commits.length, 1);
});

test('new empty path fails closed at Photoshop 998-path limit', () => {
  const paths = Array.from({ length: 998 }, (_, i) => ({ id: 2000 + i, subpaths: [] }));
  const { doc, controller, commits, controls, edits } = setup({ paths });
  controller.updatePathsPanel();
  assert.equal(controls.new.disabled, true);
  assert.equal(controller.createEmptyDocumentPath(), false);
  assert.equal(doc.paths.length, 998);
  assert.deepEqual(commits, []);
  assert.deepEqual(edits, []);
});
