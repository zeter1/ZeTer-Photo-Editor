import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOCUMENT_CROP_COMMAND_RESULT,
  DOCUMENT_CROP_GEOMETRY_ERROR,
  DOCUMENT_CROP_POSITION_ERROR,
  createDocumentCropCommandController,
} from '../src/document/crop-command-controller.js';
import { MAX_LAYER_POSITION } from '../src/core/state.js';

const clone = value => JSON.parse(JSON.stringify(value));

function createDocument(overrides = {}) {
  return {
    width: 100,
    height: 80,
    layers: [
      { id:'shape-1', type:'shape', x:10, y:20 },
      { id:'shape-2', type:'shape', x:70, y:60 },
    ],
    ...overrides,
  };
}

function createHarness(initialDocument) {
  let activeDocument = initialDocument;
  const commits = [];
  const runtime = { completions:0, fits:0 };
  const controller = createDocumentCropCommandController({
    state: { getDocument: () => activeDocument },
    transaction: { commit: label => commits.push(label) },
    runtime: {
      completeCropTransientState: () => { runtime.completions += 1; },
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
  assert.throws(() => createDocumentCropCommandController(), /state bridge/);
  assert.throws(
    () => createDocumentCropCommandController({ state:{ getDocument() {} } }),
    /transaction bridge/,
  );
  assert.throws(
    () => createDocumentCropCommandController({
      state:{ getDocument() {} },
      transaction:{ commit() {} },
      runtime:{ fitToView() {} },
    }),
    /transient completion bridge/,
  );
  assert.throws(
    () => createDocumentCropCommandController({
      state:{ getDocument() {} },
      transaction:{ commit() {} },
      runtime:{ completeCropTransientState() {} },
    }),
    /fit-to-view bridge/,
  );
});

test('real crop shifts every layer, updates canvas and publishes exactly once', () => {
  const doc = createDocument();
  const h = createHarness(doc);
  const outcome = h.controller.crop(doc, { x:10, y:5, width:60, height:50 });
  assert.equal(outcome.result, DOCUMENT_CROP_COMMAND_RESULT.COMMITTED);
  assert.deepEqual(doc.layers.map(layer => ({ x:layer.x, y:layer.y })), [{ x:0, y:15 }, { x:60, y:55 }]);
  assert.deepEqual({ width:doc.width, height:doc.height }, { width:60, height:50 });
  assert.deepEqual(h.commits, ['Кадрирование']);
  assert.deepEqual(h.runtime, { completions:1, fits:1 });
});

test('crop preserves legacy rounding before persisted geometry is applied', () => {
  const doc = createDocument();
  const h = createHarness(doc);
  const outcome = h.controller.crop(doc, { x:1.6, y:2.4, width:50.6, height:40.4 });
  assert.equal(outcome.result, DOCUMENT_CROP_COMMAND_RESULT.COMMITTED);
  assert.deepEqual(doc.layers.map(layer => ({ x:layer.x, y:layer.y })), [{ x:8, y:18 }, { x:68, y:58 }]);
  assert.deepEqual({ width:doc.width, height:doc.height }, { width:51, height:40 });
  assert.deepEqual(h.commits, ['Кадрирование']);
  assert.deepEqual(h.runtime, { completions:1, fits:1 });
});

test('full-document crop is a history no-op but still completes transient crop UI once', () => {
  const doc = createDocument();
  const before = clone(doc);
  const h = createHarness(doc);
  const outcome = h.controller.crop(doc, { x:0, y:0, width:100, height:80 });
  assert.equal(outcome.result, DOCUMENT_CROP_COMMAND_RESULT.NOOP);
  assert.deepEqual(doc, before);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.runtime, { completions:1, fits:1 });
});

test('stale and structurally equal replacement owners cannot mutate or publish', () => {
  const origin = createDocument();
  const active = createDocument({ width:200, height:160 });
  const originBefore = clone(origin);
  const activeBefore = clone(active);
  const h = createHarness(origin);
  h.setDocument(active);
  assert.equal(h.controller.crop(origin, { x:5, y:5, width:50, height:40 }).result, DOCUMENT_CROP_COMMAND_RESULT.REJECTED);
  const replacement = clone(origin);
  h.setDocument(replacement);
  assert.equal(h.controller.crop(origin, { x:5, y:5, width:50, height:40 }).result, DOCUMENT_CROP_COMMAND_RESULT.REJECTED);
  assert.deepEqual(origin, originBefore);
  assert.deepEqual(active, activeBefore);
  assert.deepEqual(replacement, originBefore);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.runtime, { completions:0, fits:0 });
});

test('non-finite, non-positive and unsafe crop requests are rejected atomically', () => {
  for (const rect of [
    { x:NaN, y:0, width:50, height:40 },
    { x:0, y:0, width:Infinity, height:40 },
    { x:0, y:0, width:0, height:40 },
    { x:0, y:0, width:12001, height:1 },
    { x:0, y:0, width:12000, height:12000 },
  ]) {
    const doc = createDocument();
    const before = clone(doc);
    const h = createHarness(doc);
    const outcome = h.controller.crop(doc, rect);
    assert.equal(outcome.result, DOCUMENT_CROP_COMMAND_RESULT.INVALID);
    assert.ok(outcome.error instanceof Error);
    assert.deepEqual(doc, before);
    assert.deepEqual(h.commits, []);
    assert.deepEqual(h.runtime, { completions:0, fits:0 });
  }
});

test('layer-position overflow rejects the whole plan before any layer or document write', () => {
  const doc = createDocument({
    layers:[
      { id:'safe-first', type:'shape', x:10, y:20 },
      { id:'overflow-second', type:'shape', x:-MAX_LAYER_POSITION, y:0 },
    ],
  });
  const before = clone(doc);
  const h = createHarness(doc);
  const outcome = h.controller.crop(doc, { x:1, y:0, width:50, height:40 });
  assert.equal(outcome.result, DOCUMENT_CROP_COMMAND_RESULT.INVALID);
  assert.equal(outcome.error.message, DOCUMENT_CROP_POSITION_ERROR);
  assert.deepEqual(doc, before);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.runtime, { completions:0, fits:0 });
});

test('invalid geometry exposes the canonical crop error without side effects', () => {
  const doc = createDocument();
  const h = createHarness(doc);
  const outcome = h.controller.crop(doc, { x:0, y:0, width:-5, height:20 });
  assert.equal(outcome.result, DOCUMENT_CROP_COMMAND_RESULT.INVALID);
  assert.equal(outcome.error.message, DOCUMENT_CROP_GEOMETRY_ERROR);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.runtime, { completions:0, fits:0 });
});

test('controller revalidates the owner after planning and before the first persisted write', () => {
  const origin = createDocument();
  const other = createDocument({ width:300, height:200 });
  const before = clone(origin);
  const commits = [];
  const runtime = { completions:0, fits:0 };
  let reads = 0;
  const controller = createDocumentCropCommandController({
    state: { getDocument: () => { reads += 1; return reads === 1 ? origin : other; } },
    transaction: { commit: label => commits.push(label) },
    runtime: {
      completeCropTransientState: () => { runtime.completions += 1; },
      fitToView: () => { runtime.fits += 1; },
    },
  });
  const outcome = controller.crop(origin, { x:5, y:5, width:50, height:40 });
  assert.equal(outcome.result, DOCUMENT_CROP_COMMAND_RESULT.REJECTED);
  assert.equal(reads, 2);
  assert.deepEqual(origin, before);
  assert.deepEqual(commits, []);
  assert.deepEqual(runtime, { completions:0, fits:0 });
});

test('full-document no-op also revalidates ownership before transient completion', () => {
  const origin = createDocument();
  const other = createDocument({ width:300, height:200 });
  const before = clone(origin);
  const commits = [];
  const runtime = { completions:0, fits:0 };
  let reads = 0;
  const controller = createDocumentCropCommandController({
    state: { getDocument: () => { reads += 1; return reads === 1 ? origin : other; } },
    transaction: { commit: label => commits.push(label) },
    runtime: {
      completeCropTransientState: () => { runtime.completions += 1; },
      fitToView: () => { runtime.fits += 1; },
    },
  });
  const outcome = controller.crop(origin, { x:0, y:0, width:100, height:80 });
  assert.equal(outcome.result, DOCUMENT_CROP_COMMAND_RESULT.REJECTED);
  assert.equal(reads, 2);
  assert.deepEqual(origin, before);
  assert.deepEqual(commits, []);
  assert.deepEqual(runtime, { completions:0, fits:0 });
});
