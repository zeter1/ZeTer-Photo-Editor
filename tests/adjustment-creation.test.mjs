import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyAdjustmentPixels } from '../src/core/adjustments.js';
import { createAdjustmentLayerCommandController, ADJUSTMENT_COMMAND_RESULT, NEW_ADJUSTMENT_KINDS } from '../src/layers/adjustment-command-controller.js';
import { createDocument, sanitizeProject, snapshotDocument } from '../src/core/state.js';

function harness(doc = createDocument({ width: 160, height: 90 })) {
  let active = doc;
  const commits = [];
  const controller = createAdjustmentLayerCommandController({
    state: { getDocument: () => active },
    transaction: { commit: label => commits.push(label) },
  });
  return { doc, commits, controller, setActive: next => { active = next; } };
}

test('new Adjustment menu exposes eight real editable kinds and creates only typed models', () => {
  assert.equal(NEW_ADJUSTMENT_KINDS.length, 8);
  for (const [kind] of NEW_ADJUSTMENT_KINDS) {
    const h = harness();
    assert.equal(h.controller.createLayer(h.doc, kind), ADJUSTMENT_COMMAND_RESULT.COMMITTED, kind);
    assert.equal(h.doc.layers.length, 1, kind);
    const layer = h.doc.layers[0];
    assert.equal(layer.type, 'adjustment');
    assert.equal(layer.adjustment?.kind, kind);
    assert.equal(layer.width, 160);
    assert.equal(layer.height, 90);
    assert.equal(layer.psdAdjustment, null, 'do not invent Photoshop native metadata');
    assert.equal(h.doc.selectedLayerId, layer.id);
    assert.equal(h.commits.length, 1);
    const reopened = sanitizeProject(JSON.parse(snapshotDocument(h.doc)));
    assert.deepEqual(reopened.layers[0].adjustment, layer.adjustment, kind);
  }
});

test('new Curves and Levels are editable and persist after a canonical document roundtrip', () => {
  const h = harness();
  assert.equal(h.controller.createLayer(h.doc, 'curves'), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  const curves = h.doc.layers[0];
  assert.equal(h.controller.updateCurveChannel(h.doc, curves.id, 0, '0:0, 128:176, 255:255'), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  assert.equal(h.controller.createLayer(h.doc, 'levels'), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  const levels = h.doc.layers[1];
  assert.equal(h.controller.updateProperty(h.doc, levels.id, 'master.gamma', '1.6'), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  const reopened = sanitizeProject(JSON.parse(snapshotDocument(h.doc)));
  assert.equal(reopened.layers[0].adjustment.channels[0].points[1].output, 176);
  assert.equal(reopened.layers[1].adjustment.master.gamma, 1.6);
  assert.equal(h.commits.length, 4);
});

test('new Invert layer applies real alpha-preserving color math without changing source', () => {
  const h = harness();
  assert.equal(h.controller.createLayer(h.doc, 'invert'), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  const original = new Uint8ClampedArray([32, 64, 128, 255, 10, 20, 30, 0]);
  const image = { data: new Uint8ClampedArray(original) };
  applyAdjustmentPixels(image, h.doc.layers[0].adjustment);
  assert.deepEqual(Array.from(image.data), [223, 191, 127, 255, 10, 20, 30, 0]);
  assert.deepEqual(Array.from(original), [32, 64, 128, 255, 10, 20, 30, 0]);
});

test('invalid kind, switched document and 500-layer cap cannot mutate or commit', () => {
  const h = harness();
  assert.equal(h.controller.createLayer(h.doc, '__proto__'), ADJUSTMENT_COMMAND_RESULT.INVALID);
  assert.equal(h.controller.createLayer(h.doc, 'unknown'), ADJUSTMENT_COMMAND_RESULT.INVALID);
  assert.equal(h.doc.layers.length, 0);
  h.setActive(createDocument());
  assert.equal(h.controller.createLayer(h.doc, 'levels'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  h.setActive(h.doc);
  h.doc.layers = Array.from({ length: 500 }, () => ({ id:'occupied' }));
  assert.equal(h.controller.createLayer(h.doc, 'levels'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(h.doc.layers.length, 500);
  assert.deepEqual(h.commits, []);
});

test('Layer menu creation is modal-driven and bound to the originating document', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /function addAdjustmentLayer\(\)\{\s*const owner=doc;\s*showModal\(/);
  assert.match(main, /type:'select',value:'levels',options:NEW_ADJUSTMENT_KINDS/);
  assert.match(main, /adjustmentLayerCommandController\.createLayer\(owner,values\.kind\)/);
  assert.match(main, /\['Новый корректирующий слой','',addAdjustmentLayer\]/);
});
