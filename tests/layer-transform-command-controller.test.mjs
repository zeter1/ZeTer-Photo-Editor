import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { alignLayerToCanvas, frameBounds, layerFrame } from '../src/core/geometry.js';
import {
  LAYER_ALIGNMENT_LABELS,
  LAYER_TRANSFORM_COMMAND_RESULT,
  createLayerTransformCommandController,
} from '../src/layers/transform-command-controller.js';
import {
  addLayer,
  addLayerGroup,
  createAdjustmentLayer,
  createDocument,
  createLayerGroup,
  createShapeLayer,
} from '../src/core/state.js';

function createHarness(initialDocument) {
  let activeDocument = initialDocument;
  const commits = [];
  const controller = createLayerTransformCommandController({
    state: { getDocument: () => activeDocument },
    transaction: { commit: label => commits.push(label) },
  });
  return {
    controller,
    commits,
    setDocument(value) { activeDocument = value; },
  };
}

function addShape(doc, overrides = {}) {
  const layer = addLayer(doc, createShapeLayer({
    x: 20, y: 30, width: 80, height: 40,
    scaleX: 1, scaleY: 1, rotation: 0, ...overrides,
  }));
  doc.selectedLayerId = layer.id;
  return layer;
}

test('nudge validates finite deltas, suppresses zero movement and commits a real move once', () => {
  const doc = createDocument({ width: 320, height: 240 });
  const layer = addShape(doc);
  const h = createHarness(doc);

  assert.equal(h.controller.nudge(doc, layer.id, 5, -3), LAYER_TRANSFORM_COMMAND_RESULT.COMMITTED);
  assert.deepEqual({ x: layer.x, y: layer.y }, { x: 25, y: 27 });
  assert.deepEqual(h.commits, ['Сдвинуть слой']);

  assert.equal(h.controller.nudge(doc, layer.id, 0, 0), LAYER_TRANSFORM_COMMAND_RESULT.NOOP);
  assert.equal(h.controller.nudge(doc, layer.id, Number.NaN, 1), LAYER_TRANSFORM_COMMAND_RESULT.INVALID);
  assert.equal(h.controller.nudge(doc, layer.id, 1, Number.POSITIVE_INFINITY), LAYER_TRANSFORM_COMMAND_RESULT.INVALID);
  assert.deepEqual({ x: layer.x, y: layer.y }, { x: 25, y: 27 });
  assert.deepEqual(h.commits, ['Сдвинуть слой']);
});

test('center uses canonical frame geometry and suppresses already-centered history', () => {
  const doc = createDocument({ width: 400, height: 300 });
  const layer = addShape(doc, { x: 41, y: 63, scaleX: 1.7, scaleY: 0.8, rotation: 31 });
  const h = createHarness(doc);
  const before = layerFrame(layer);
  const expected = {
    x: layer.x + doc.width / 2 - before.center.x,
    y: layer.y + doc.height / 2 - before.center.y,
  };

  assert.equal(h.controller.center(doc, layer.id), LAYER_TRANSFORM_COMMAND_RESULT.COMMITTED);
  assert.ok(Math.abs(layer.x - expected.x) < 1e-9);
  assert.ok(Math.abs(layer.y - expected.y) < 1e-9);
  assert.deepEqual(h.commits, ['Центрировать слой']);

  assert.equal(h.controller.center(doc, layer.id), LAYER_TRANSFORM_COMMAND_RESULT.NOOP);
  assert.deepEqual(h.commits, ['Центрировать слой']);
});

test('all supported alignments match canonical geometry and publish the preserved labels', () => {
  for (const mode of Object.keys(LAYER_ALIGNMENT_LABELS)) {
    const doc = createDocument({ width: 420, height: 260 });
    const layer = addShape(doc, { x: 53, y: 47, scaleX: 1.4, scaleY: 0.75, rotation: 23 });
    const h = createHarness(doc);
    const expected = alignLayerToCanvas(layer, mode, doc.width, doc.height);

    assert.equal(h.controller.align(doc, layer.id, mode), LAYER_TRANSFORM_COMMAND_RESULT.COMMITTED);
    assert.ok(Math.abs(layer.x - expected.x) < 1e-9, mode);
    assert.ok(Math.abs(layer.y - expected.y) < 1e-9, mode);
    assert.deepEqual(h.commits, [`Выровнять слой ${LAYER_ALIGNMENT_LABELS[mode]}`]);
  }
});

test('alignment rejects unknown modes and suppresses an already-aligned target', () => {
  const doc = createDocument({ width: 360, height: 240 });
  const layer = addShape(doc);
  const h = createHarness(doc);

  assert.equal(h.controller.align(doc, layer.id, 'diagonal'), LAYER_TRANSFORM_COMMAND_RESULT.INVALID);
  assert.deepEqual(h.commits, []);

  const aligned = alignLayerToCanvas(layer, 'left', doc.width, doc.height);
  layer.x = aligned.x;
  layer.y = aligned.y;
  assert.equal(h.controller.align(doc, layer.id, 'left'), LAYER_TRANSFORM_COMMAND_RESULT.NOOP);
  assert.deepEqual(h.commits, []);
});

test('fit-to-canvas uses rotated frame bounds, centers the result and suppresses canonical no-op', () => {
  const doc = createDocument({ width: 500, height: 320 });
  const layer = addShape(doc, { x: 37, y: 52, width: 120, height: 70, scaleX: 1.3, scaleY: 0.65, rotation: 29 });
  const h = createHarness(doc);
  const before = frameBounds(layer);
  const expectedRatio = Math.min(doc.width / before.width, doc.height / before.height);

  assert.equal(h.controller.fitToCanvas(doc, layer.id), LAYER_TRANSFORM_COMMAND_RESULT.COMMITTED);
  assert.ok(Math.abs(layer.scaleX - 1.3 * expectedRatio) < 1e-9);
  assert.ok(Math.abs(layer.scaleY - 0.65 * expectedRatio) < 1e-9);
  const afterBounds = frameBounds(layer);
  const afterFrame = layerFrame(layer);
  assert.ok(Math.abs(afterBounds.width - doc.width) < 1e-7 || Math.abs(afterBounds.height - doc.height) < 1e-7);
  assert.ok(Math.abs(afterFrame.center.x - doc.width / 2) < 1e-7);
  assert.ok(Math.abs(afterFrame.center.y - doc.height / 2) < 1e-7);
  assert.deepEqual(h.commits, ['Вписать слой в холст']);

  assert.equal(h.controller.fitToCanvas(doc, layer.id), LAYER_TRANSFORM_COMMAND_RESULT.NOOP);
  assert.deepEqual(h.commits, ['Вписать слой в холст']);
});

test('own and recursive ancestor locks reject every transform command without history', () => {
  for (const lockedAncestor of [false, true]) {
    const doc = createDocument({ width: 320, height: 240 });
    const root = addLayerGroup(doc, createLayerGroup({ locked: lockedAncestor }));
    const child = addLayerGroup(doc, createLayerGroup({ parentGroupId: root.id }));
    const layer = addShape(doc, { locked: !lockedAncestor });
    layer.groupId = child.id;
    const h = createHarness(doc);
    const snapshot = { x: layer.x, y: layer.y, scaleX: layer.scaleX, scaleY: layer.scaleY };

    assert.equal(h.controller.nudge(doc, layer.id, 1, 1), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
    assert.equal(h.controller.center(doc, layer.id), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
    assert.equal(h.controller.align(doc, layer.id, 'left'), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
    assert.equal(h.controller.fitToCanvas(doc, layer.id), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
    assert.deepEqual({ x: layer.x, y: layer.y, scaleX: layer.scaleX, scaleY: layer.scaleY }, snapshot);
    assert.deepEqual(h.commits, []);
  }
});

test('Adjustment layers, stale owners and missing stable IDs are rejected without publication', () => {
  const doc = createDocument({ width: 320, height: 240 });
  const adjustment = addLayer(doc, createAdjustmentLayer());
  const shape = addShape(doc);
  const h = createHarness(doc);

  for (const call of [
    () => h.controller.nudge(doc, adjustment.id, 1, 1),
    () => h.controller.center(doc, adjustment.id),
    () => h.controller.align(doc, adjustment.id, 'left'),
    () => h.controller.fitToCanvas(doc, adjustment.id),
  ]) assert.equal(call(), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);

  const other = createDocument({ width: 320, height: 240 });
  h.setDocument(other);
  assert.equal(h.controller.nudge(doc, shape.id, 3, 4), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.center(doc, shape.id), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.align(doc, shape.id, 'right'), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.fitToCanvas(doc, shape.id), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);

  h.setDocument(doc);
  doc.layers = doc.layers.filter(layer => layer.id !== shape.id);
  assert.equal(h.controller.nudge(doc, shape.id, 3, 4), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.center(doc, shape.id), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.align(doc, shape.id, 'right'), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
  assert.equal(h.controller.fitToCanvas(doc, shape.id), LAYER_TRANSFORM_COMMAND_RESULT.REJECTED);
  assert.deepEqual(h.commits, []);
});

test('composition root delegates discrete transforms and build/docs pin the canonical owner', async () => {
  const root = new URL('../', import.meta.url);
  const [main, controller, build, agents, project, boundaries, codemap, matrix] = await Promise.all([
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/layers/transform-command-controller.js', root), 'utf8'),
    readFile(new URL('tools/build-bundle.mjs', root), 'utf8'),
    readFile(new URL('AGENTS.md', root), 'utf8'),
    readFile(new URL('docs/PROJECT.md', root), 'utf8'),
    readFile(new URL('docs/architecture/BOUNDARIES.md', root), 'utf8'),
    readFile(new URL('docs/architecture/CODEMAP.md', root), 'utf8'),
    readFile(new URL('docs/testing/TEST_MATRIX.md', root), 'utf8'),
  ]);

  assert.match(controller, /alignLayerToCanvas/);
  assert.match(controller, /frameBounds/);
  assert.match(controller, /layerFrame/);
  assert.match(controller, /isLayerLocked/);
  assert.match(main, /createLayerTransformCommandController\(\{/);
  assert.match(main, /layerTransformCommandController\.nudge\(doc,l\.id,dx,dy\)/);
  assert.match(main, /layerTransformCommandController\.center\(doc,l\.id\)/);
  assert.match(main, /layerTransformCommandController\.align\(doc,l\.id,mode\)/);
  assert.match(main, /layerTransformCommandController\.fitToCanvas\(doc,l\.id\)/);

  const start = main.indexOf('function nudgeSelected(dx,dy)');
  const end = main.indexOf('function setDocumentBackground()', start);
  assert.ok(start >= 0 && end > start);
  const wrappers = main.slice(start, end);
  assert.doesNotMatch(wrappers, /\.(?:x|y|scaleX|scaleY)\s*(?:\+=|-=|\*=|\/=|=)/);

  assert.match(build, /'src\/layers\/transform-command-controller\.js'/);
  for (const doc of [agents, project, boundaries, codemap]) assert.match(doc, /src\/layers\/transform-command-controller\.js/);
  assert.match(matrix, /tests\/layer-transform-command-controller\.test\.mjs/);
});
