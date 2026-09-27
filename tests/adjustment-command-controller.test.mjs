import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ADJUSTMENT_COMMAND_RESULT,
  createAdjustmentLayerCommandController,
} from '../src/layers/adjustment-command-controller.js';
import {
  addLayer,
  addLayerGroup,
  createAdjustmentLayer,
  createDocument,
  createLayerGroup,
} from '../src/core/state.js';

function createHarness(initialDocument) {
  let activeDocument = initialDocument;
  const commits = [];
  const controller = createAdjustmentLayerCommandController({
    state: { getDocument: () => activeDocument },
    transaction: { commit: label => commits.push(label) },
  });
  return {
    controller,
    commits,
    setDocument(value) { activeDocument = value; },
  };
}

function addAdjustment(doc, adjustment, overrides = {}) {
  return addLayer(doc, createAdjustmentLayer({ adjustment, ...overrides }));
}

test('scalar Adjustment commands sanitize, preserve metadata and publish only real changes', () => {
  const doc = createDocument();
  const psdAdjustment = { kind: 'brit', opaque: { preserved: true } };
  const layer = addAdjustment(doc, {
    kind: 'brightness-contrast', brightness: 10, contrast: 0, legacy: true,
  }, { psdAdjustment });
  const h = createHarness(doc);

  assert.equal(h.controller.updateProperty(doc, layer.id, 'brightness', '25'), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  assert.equal(layer.adjustment.brightness, 25);
  assert.equal(layer.adjustment.legacy, true);
  assert.strictEqual(layer.psdAdjustment, psdAdjustment);
  assert.deepEqual(h.commits, ['Изменить Photoshop adjustment']);

  assert.equal(h.controller.updateProperty(doc, layer.id, 'brightness', '25'), ADJUSTMENT_COMMAND_RESULT.NOOP);
  assert.equal(h.controller.updateProperty(doc, layer.id, 'brightness', '25.4'), ADJUSTMENT_COMMAND_RESULT.NOOP);
  assert.deepEqual(h.commits, ['Изменить Photoshop adjustment']);
});

test('Levels commands create valid missing channels and reject bad values or paths without mutation', () => {
  const doc = createDocument();
  const layer = addAdjustment(doc, { kind: 'levels', master: {}, channels: [] });
  const h = createHarness(doc);

  assert.equal(h.controller.updateProperty(doc, layer.id, 'channels.1.gamma', '1.75'), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  const red = layer.adjustment.channels.find(channel => channel.id === 1);
  assert.ok(red);
  assert.equal(red.gamma, 1.75);
  assert.equal(red.inputBlack, 0);
  assert.equal(red.inputWhite, 255);
  assert.deepEqual(h.commits, ['Изменить Photoshop adjustment']);

  const before = structuredClone(layer.adjustment);
  assert.equal(h.controller.updateProperty(doc, layer.id, 'channels.9.gamma', '2'), ADJUSTMENT_COMMAND_RESULT.INVALID);
  assert.equal(h.controller.updateProperty(doc, layer.id, 'master.notAField', '2'), ADJUSTMENT_COMMAND_RESULT.INVALID);
  assert.equal(h.controller.updateProperty(doc, layer.id, 'master.gamma', 'not-a-number'), ADJUSTMENT_COMMAND_RESULT.INVALID);
  assert.deepEqual(layer.adjustment, before);
  assert.deepEqual(h.commits, ['Изменить Photoshop adjustment']);
});

test('Curves commands canonicalize points, suppress semantic no-op and reject malformed input', () => {
  const doc = createDocument();
  const layer = addAdjustment(doc, {
    kind: 'curves',
    channels: [{ id: 0, points: [{ input: 0, output: 0 }, { input: 255, output: 255 }] }],
  });
  const h = createHarness(doc);

  assert.equal(h.controller.updateCurveChannel(doc, layer.id, 0, '255:255, 0:0'), ADJUSTMENT_COMMAND_RESULT.NOOP);
  assert.deepEqual(h.commits, []);

  assert.equal(h.controller.updateCurveChannel(doc, layer.id, 0, '0:0, 128:160, 255:255'), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  assert.equal(layer.adjustment.channels[0].points.length, 3);
  assert.deepEqual(h.commits, ['Изменить точки Photoshop Curves']);

  const before = structuredClone(layer.adjustment);
  for (const raw of ['0:0', '0:0, 300:20', '0:0, bad', '0:0, 0:10, 255:255']) {
    assert.equal(h.controller.updateCurveChannel(doc, layer.id, 0, raw), ADJUSTMENT_COMMAND_RESULT.INVALID);
  }
  assert.equal(h.controller.updateCurveChannel(doc, layer.id, 7, '0:0, 255:255'), ADJUSTMENT_COMMAND_RESULT.INVALID);
  assert.deepEqual(layer.adjustment, before);
  assert.deepEqual(h.commits, ['Изменить точки Photoshop Curves']);
});

test('clipping command commits once and suppresses same-value history', () => {
  const doc = createDocument();
  const layer = addAdjustment(doc, { kind: 'invert' }, { clipping: false });
  const h = createHarness(doc);

  assert.equal(h.controller.setClipping(doc, layer.id, true), ADJUSTMENT_COMMAND_RESULT.COMMITTED);
  assert.equal(layer.clipping, true);
  assert.equal(h.controller.setClipping(doc, layer.id, true), ADJUSTMENT_COMMAND_RESULT.NOOP);
  assert.deepEqual(h.commits, ['Изменить clipping adjustment layer']);
});

test('own lock blocks scalar, Curves and clipping command families', () => {
  const doc = createDocument();
  const scalar = addAdjustment(doc, { kind: 'threshold', level: 128 }, { locked: true });
  const curves = addAdjustment(doc, { kind: 'curves', channels: [{ id: 0, points: [{ input: 0, output: 0 }, { input: 255, output: 255 }] }] }, { locked: true });
  const h = createHarness(doc);

  assert.equal(h.controller.updateProperty(doc, scalar.id, 'level', '150'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.updateCurveChannel(doc, curves.id, 0, '0:0, 128:140, 255:255'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.setClipping(doc, scalar.id, true), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(scalar.adjustment.level, 128);
  assert.equal(scalar.clipping, false);
  assert.deepEqual(h.commits, []);
});

test('recursive ancestor lock blocks all Adjustment persisted commands', () => {
  const doc = createDocument();
  const parent = addLayerGroup(doc, createLayerGroup({ name: 'Locked parent', locked: true }));
  const child = addLayerGroup(doc, createLayerGroup({ name: 'Child', parentGroupId: parent.id }));
  const scalar = addAdjustment(doc, { kind: 'posterize', levels: 4 }, { groupId: child.id });
  const curves = addAdjustment(doc, { kind: 'curves', channels: [{ id: 0, points: [{ input: 0, output: 0 }, { input: 255, output: 255 }] }] }, { groupId: child.id });
  const h = createHarness(doc);

  assert.equal(h.controller.updateProperty(doc, scalar.id, 'levels', '8'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.updateCurveChannel(doc, curves.id, 0, '0:0, 128:140, 255:255'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.setClipping(doc, scalar.id, true), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(scalar.adjustment.levels, 4);
  assert.deepEqual(h.commits, []);
});

test('stale documents and missing/replaced target IDs publish nothing', () => {
  const doc = createDocument();
  const layer = addAdjustment(doc, { kind: 'exposure', exposure: 0, offset: 0, gamma: 1 });
  const h = createHarness(doc);
  const other = createDocument();

  h.setDocument(other);
  assert.equal(h.controller.updateProperty(doc, layer.id, 'exposure', '2'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.setClipping(doc, layer.id, true), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(layer.adjustment.exposure, 0);
  assert.deepEqual(h.commits, []);

  h.setDocument(doc);
  doc.layers = [];
  assert.equal(h.controller.updateProperty(doc, layer.id, 'exposure', '2'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  const replacement = createAdjustmentLayer({ adjustment: { kind: 'exposure', exposure: 0, offset: 0, gamma: 1 } });
  doc.layers = [replacement];
  assert.notEqual(replacement.id, layer.id);
  assert.equal(h.controller.updateProperty(doc, layer.id, 'exposure', '2'), ADJUSTMENT_COMMAND_RESULT.REJECTED);
  assert.equal(replacement.adjustment.exposure, 0);
  assert.deepEqual(h.commits, []);
});

test('main binds Adjustment controls to originating owner plus stable ID and contains no duplicate mutation owner', async () => {
  const root = new URL('../', import.meta.url);
  const main = await readFile(new URL('src/main.js', root), 'utf8');
  assert.match(main, /bindAdjustmentControls\(els\.props,\s*doc,\s*l\.id\)/);
  assert.match(main, /function bindAdjustmentControls\(root,owner,layerId\)/);
  assert.match(main, /adjustmentLayerCommandController\.updateProperty\(owner,layerId/);
  assert.match(main, /adjustmentLayerCommandController\.updateCurveChannel\(owner,layerId/);
  assert.match(main, /adjustmentLayerCommandController\.setClipping\(owner,layerId/);
  assert.doesNotMatch(main, /function updateAdjustmentProperty\(/);
  assert.doesNotMatch(main, /function updateAdjustmentCurveChannel\(/);
  assert.doesNotMatch(main, /function parseCurvePointsInput\(/);
  const start = main.indexOf('function bindAdjustmentControls(root,owner,layerId)');
  const end = main.indexOf('async function openProject', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(main.slice(start, end), /markDirty\(true\)/);
});
