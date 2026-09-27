import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOCUMENT_RESIZE_ANCHORS,
  DOCUMENT_RESIZE_COMMAND_RESULT,
  DOCUMENT_RESIZE_POSITION_ERROR,
  createDocumentResizeCommandController,
} from '../src/document/resize-command-controller.js';
import { MAX_LAYER_POSITION } from '../src/core/state.js';

const clone = value => JSON.parse(JSON.stringify(value));

function createDocument(overrides = {}) {
  return {
    width: 100,
    height: 80,
    layers: [
      { id:'shape-1', type:'shape', x:10, y:20, width:20, height:10, scaleX:1, scaleY:1, rotation:0 },
    ],
    ...overrides,
  };
}

function createHarness(initialDocument) {
  let activeDocument = initialDocument;
  const commits = [];
  const runtime = { resets:0, fits:0 };
  const controller = createDocumentResizeCommandController({
    state: { getDocument: () => activeDocument },
    transaction: { commit: label => commits.push(label) },
    runtime: {
      resetGeometryTransientState: () => { runtime.resets += 1; },
      fitToView: () => { runtime.fits += 1; },
    },
  });
  return {
    controller,
    commits,
    runtime,
    setDocument(value) { activeDocument = value; },
  };
}

test('controller requires explicit state, transaction and runtime bridges', () => {
  assert.throws(() => createDocumentResizeCommandController(), /state bridge/);
  assert.throws(
    () => createDocumentResizeCommandController({ state:{ getDocument() {} } }),
    /transaction bridge/,
  );
  assert.throws(
    () => createDocumentResizeCommandController({
      state:{ getDocument() {} },
      transaction:{ commit() {} },
      runtime:{ fitToView() {} },
    }),
    /transient reset bridge/,
  );
  assert.throws(
    () => createDocumentResizeCommandController({
      state:{ getDocument() {} },
      transaction:{ commit() {} },
      runtime:{ resetGeometryTransientState() {} },
    }),
    /fit-to-view bridge/,
  );
});

test('image resize applies the canonical layer plan atomically and publishes once', () => {
  const doc = createDocument({
    width:100,
    height:50,
    layers:[
      { id:'shape', type:'shape', x:10, y:5, width:20, height:10, scaleX:1, scaleY:1, rotation:0 },
      { id:'adjustment', type:'adjustment', x:40, y:30, width:100, height:50, scaleX:3, scaleY:2, rotation:0 },
    ],
  });
  const h = createHarness(doc);

  const outcome = h.controller.resizeImage(doc, { width:'200', height:'100' });

  assert.equal(outcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.COMMITTED);
  assert.deepEqual(
    doc.layers.map(layer => ({ x:layer.x, y:layer.y, scaleX:layer.scaleX, scaleY:layer.scaleY })),
    [
      { x:20, y:10, scaleX:2, scaleY:2 },
      { x:0, y:0, scaleX:1, scaleY:1 },
    ],
  );
  assert.deepEqual({ width:doc.width, height:doc.height }, { width:200, height:100 });
  assert.deepEqual(h.commits, ['Размер изображения']);
  assert.deepEqual(h.runtime, { resets:1, fits:1 });
});

test('image resize same dimensions is a semantic no-op with zero cleanup and history', () => {
  const doc = createDocument();
  const before = clone(doc);
  const h = createHarness(doc);

  const outcome = h.controller.resizeImage(doc, { width:'100', height:'80' });

  assert.equal(outcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.NOOP);
  assert.deepEqual(doc, before);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.runtime, { resets:0, fits:0 });
});

test('image resize rejects invalid transform plans without partial mutation', () => {
  const rotated = createDocument({
    layers:[
      { id:'rotated', type:'shape', x:10, y:20, width:20, height:10, scaleX:1, scaleY:1, rotation:45 },
    ],
  });
  const rotatedBefore = clone(rotated);
  const rotatedHarness = createHarness(rotated);
  const rotatedOutcome = rotatedHarness.controller.resizeImage(rotated, { width:200, height:80 });

  assert.equal(rotatedOutcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.INVALID);
  assert.match(rotatedOutcome.error.message, /Непропорциональный размер изображения/);
  assert.deepEqual(rotated, rotatedBefore);
  assert.deepEqual(rotatedHarness.commits, []);
  assert.deepEqual(rotatedHarness.runtime, { resets:0, fits:0 });

  const overflow = createDocument({
    layers:[
      { id:'far', type:'shape', x:70000, y:0, width:20, height:10, scaleX:1, scaleY:1, rotation:0 },
    ],
  });
  const overflowBefore = clone(overflow);
  const overflowHarness = createHarness(overflow);
  const overflowOutcome = overflowHarness.controller.resizeImage(overflow, { width:200, height:160 });

  assert.equal(overflowOutcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.INVALID);
  assert.match(overflowOutcome.error.message, /допустимые пределы/);
  assert.deepEqual(overflow, overflowBefore);
  assert.deepEqual(overflowHarness.commits, []);
  assert.deepEqual(overflowHarness.runtime, { resets:0, fits:0 });
});

test('canvas resize preserves all nine anchor shift contracts', () => {
  const points = {
    'top-left':[0,0],
    top:[0.5,0],
    'top-right':[1,0],
    left:[0,0.5],
    center:[0.5,0.5],
    right:[1,0.5],
    'bottom-left':[0,1],
    bottom:[0.5,1],
    'bottom-right':[1,1],
  };
  assert.deepEqual([...DOCUMENT_RESIZE_ANCHORS], Object.keys(points));

  for (const anchor of DOCUMENT_RESIZE_ANCHORS) {
    const doc = createDocument();
    const h = createHarness(doc);
    const [ax, ay] = points[anchor];

    const outcome = h.controller.resizeCanvas(doc, { width:200, height:280, anchor });

    assert.equal(outcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.COMMITTED, anchor);
    assert.deepEqual(
      { x:doc.layers[0].x, y:doc.layers[0].y },
      { x:10 + 100 * ax, y:20 + 200 * ay },
      anchor,
    );
    assert.deepEqual({ width:doc.width, height:doc.height }, { width:200, height:280 }, anchor);
    assert.deepEqual(h.commits, ['Размер холста'], anchor);
    assert.deepEqual(h.runtime, { resets:1, fits:1 }, anchor);
  }
});

test('canvas resize keeps legacy unknown-anchor fallback centered and suppresses same-size history', () => {
  const doc = createDocument();
  const h = createHarness(doc);

  const outcome = h.controller.resizeCanvas(doc, { width:200, height:180, anchor:'unknown' });
  assert.equal(outcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.COMMITTED);
  assert.deepEqual({ x:doc.layers[0].x, y:doc.layers[0].y }, { x:60, y:70 });

  const after = clone(doc);
  const repeat = h.controller.resizeCanvas(doc, { width:200, height:180, anchor:'right' });
  assert.equal(repeat.result, DOCUMENT_RESIZE_COMMAND_RESULT.NOOP);
  assert.deepEqual(doc, after);
  assert.deepEqual(h.commits, ['Размер холста']);
  assert.deepEqual(h.runtime, { resets:1, fits:1 });
});

test('canvas resize rejects unsafe size or layer position atomically', () => {
  const huge = createDocument();
  const hugeBefore = clone(huge);
  const hugeHarness = createHarness(huge);
  const hugeOutcome = hugeHarness.controller.resizeCanvas(
    huge,
    { width:12000, height:12000, anchor:'center' },
  );

  assert.equal(hugeOutcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.INVALID);
  assert.match(hugeOutcome.error.message, /превышает безопасный лимит/);
  assert.deepEqual(huge, hugeBefore);
  assert.deepEqual(hugeHarness.commits, []);
  assert.deepEqual(hugeHarness.runtime, { resets:0, fits:0 });

  const overflow = createDocument({
    layers:[
      { id:'edge', type:'shape', x:MAX_LAYER_POSITION, y:0, width:20, height:10, scaleX:1, scaleY:1, rotation:0 },
    ],
  });
  const overflowBefore = clone(overflow);
  const overflowHarness = createHarness(overflow);
  const overflowOutcome = overflowHarness.controller.resizeCanvas(
    overflow,
    { width:200, height:80, anchor:'right' },
  );

  assert.equal(overflowOutcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.INVALID);
  assert.equal(overflowOutcome.error.message, DOCUMENT_RESIZE_POSITION_ERROR);
  assert.deepEqual(overflow, overflowBefore);
  assert.deepEqual(overflowHarness.commits, []);
  assert.deepEqual(overflowHarness.runtime, { resets:0, fits:0 });
});

test('controller revalidates owner after planning and before the first persisted write', () => {
  for (const command of ['image','canvas']) {
    const origin = createDocument();
    const other = createDocument({ width:300, height:200 });
    const before = clone(origin);
    let reads = 0;
    const commits = [];
    const runtime = { resets:0, fits:0 };
    const controller = createDocumentResizeCommandController({
      state: {
        getDocument: () => {
          reads += 1;
          return reads === 1 ? origin : other;
        },
      },
      transaction: { commit: label => commits.push(label) },
      runtime: {
        resetGeometryTransientState: () => { runtime.resets += 1; },
        fitToView: () => { runtime.fits += 1; },
      },
    });

    const outcome = command === 'image'
      ? controller.resizeImage(origin, { width:200, height:160 })
      : controller.resizeCanvas(origin, { width:200, height:180, anchor:'center' });

    assert.equal(outcome.result, DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED, command);
    assert.deepEqual(origin, before, command);
    assert.deepEqual(commits, [], command);
    assert.deepEqual(runtime, { resets:0, fits:0 }, command);
    assert.equal(reads, 2, command);
  }
});

test('stale or replaced document owners cannot mutate or publish either resize command', () => {
  const origin = createDocument();
  const active = createDocument({ width:300, height:200 });
  const originBefore = clone(origin);
  const activeBefore = clone(active);
  const h = createHarness(origin);

  h.setDocument(active);
  assert.equal(
    h.controller.resizeImage(origin, { width:200, height:160 }).result,
    DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED,
  );
  assert.equal(
    h.controller.resizeCanvas(origin, { width:200, height:180, anchor:'center' }).result,
    DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED,
  );

  const replacement = clone(origin);
  h.setDocument(replacement);
  assert.equal(
    h.controller.resizeImage(origin, { width:200, height:160 }).result,
    DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED,
  );
  assert.equal(
    h.controller.resizeCanvas(origin, { width:200, height:180, anchor:'center' }).result,
    DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED,
  );

  assert.deepEqual(origin, originBefore);
  assert.deepEqual(active, activeBefore);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.runtime, { resets:0, fits:0 });
});
