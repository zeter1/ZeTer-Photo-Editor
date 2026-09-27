import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOCUMENT_BACKGROUND_COMMAND_RESULT,
  createDocumentBackgroundCommandController,
} from '../src/document/background-command-controller.js';

function createDocument(background = 'transparent') {
  return { background };
}

function createHarness(initialDocument) {
  let activeDocument = initialDocument;
  const commits = [];
  const controller = createDocumentBackgroundCommandController({
    state: { getDocument: () => activeDocument },
    transaction: { commit: label => commits.push(label) },
  });
  return {
    controller,
    commits,
    setDocument(value) { activeDocument = value; },
  };
}

test('controller requires explicit state and transaction bridges', () => {
  assert.throws(
    () => createDocumentBackgroundCommandController(),
    /state bridge/,
  );
  assert.throws(
    () => createDocumentBackgroundCommandController({
      state:{ getDocument() {} },
    }),
    /transaction bridge/,
  );
});

test('real background change mutates the exact owner and publishes once', () => {
  const doc = createDocument('transparent');
  const h = createHarness(doc);

  const outcome = h.controller.setBackground(doc, '#ffffff');

  assert.equal(outcome.result, DOCUMENT_BACKGROUND_COMMAND_RESULT.COMMITTED);
  assert.equal(doc.background, '#ffffff');
  assert.deepEqual(h.commits, ['Фон документа']);
});

test('same background is a semantic no-op with zero history', () => {
  const doc = createDocument('#ffffff');
  const h = createHarness(doc);

  const outcome = h.controller.setBackground(doc, '#ffffff');

  assert.equal(outcome.result, DOCUMENT_BACKGROUND_COMMAND_RESULT.NOOP);
  assert.equal(doc.background, '#ffffff');
  assert.deepEqual(h.commits, []);
});

test('existing transparent, black and dynamic primary-color values stay supported', () => {
  const doc = createDocument('#ffffff');
  const h = createHarness(doc);

  for (const value of ['transparent', '#000000', '#123456']) {
    const outcome = h.controller.setBackground(doc, value);
    assert.equal(outcome.result, DOCUMENT_BACKGROUND_COMMAND_RESULT.COMMITTED, value);
    assert.equal(doc.background, value, value);
  }

  assert.deepEqual(h.commits, ['Фон документа', 'Фон документа', 'Фон документа']);
});

test('stale document switch rejects Apply without touching either document', () => {
  const origin = createDocument('transparent');
  const active = createDocument('#000000');
  const h = createHarness(origin);
  h.setDocument(active);

  const outcome = h.controller.setBackground(origin, '#ffffff');

  assert.equal(outcome.result, DOCUMENT_BACKGROUND_COMMAND_RESULT.REJECTED);
  assert.equal(origin.background, 'transparent');
  assert.equal(active.background, '#000000');
  assert.deepEqual(h.commits, []);
});

test('structurally equal replacement document is not the originating owner', () => {
  const origin = createDocument('transparent');
  const replacement = createDocument('transparent');
  const h = createHarness(origin);
  h.setDocument(replacement);

  const outcome = h.controller.setBackground(origin, '#ffffff');

  assert.equal(outcome.result, DOCUMENT_BACKGROUND_COMMAND_RESULT.REJECTED);
  assert.equal(origin.background, 'transparent');
  assert.equal(replacement.background, 'transparent');
  assert.deepEqual(h.commits, []);
});

test('controller revalidates owner immediately before the persisted write', () => {
  const origin = createDocument('transparent');
  const other = createDocument('#000000');
  const commits = [];
  let reads = 0;
  const controller = createDocumentBackgroundCommandController({
    state: {
      getDocument: () => {
        reads += 1;
        return reads === 1 ? origin : other;
      },
    },
    transaction: { commit: label => commits.push(label) },
  });

  const outcome = controller.setBackground(origin, '#ffffff');

  assert.equal(outcome.result, DOCUMENT_BACKGROUND_COMMAND_RESULT.REJECTED);
  assert.equal(reads, 2);
  assert.equal(origin.background, 'transparent');
  assert.equal(other.background, '#000000');
  assert.deepEqual(commits, []);
});
