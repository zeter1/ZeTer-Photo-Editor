import test from 'node:test';
import assert from 'node:assert/strict';

import { DOCUMENT_BACKGROUND_COMMAND_RESULT } from '../src/document/background-command-controller.js';
import { createDocumentBackgroundController } from '../src/ui/document-background-controller.js';

function makeHarness({
  documentValue = { background: 'transparent' },
  primaryColor = '#123456',
  outcome = { result: DOCUMENT_BACKGROUND_COMMAND_RESULT.COMMITTED },
} = {}) {
  const state = { documentValue, primaryColor };
  const calls = { commands: [], statuses: [] };
  let modal = null;

  const controller = createDocumentBackgroundController({
    documentState: {
      getDocument: () => state.documentValue,
      getPrimaryColor: () => state.primaryColor,
    },
    commands: {
      setBackground: (owner, value) => {
        calls.commands.push({ owner, value });
        return outcome;
      },
    },
    ui: {
      showModal: options => { modal = options; },
      setStatus: message => calls.statuses.push(message),
    },
  });

  return { controller, state, calls, getModal: () => modal };
}

function completePorts() {
  return {
    documentState: {
      getDocument() {},
      getPrimaryColor() {},
    },
    commands: {
      setBackground() {},
    },
    ui: {
      showModal() {},
      setStatus() {},
    },
  };
}

test('controller fails fast when any required bridge is missing', () => {
  const cases = [
    value => { delete value.documentState.getDocument; },
    value => { delete value.documentState.getPrimaryColor; },
    value => { delete value.commands.setBackground; },
    value => { delete value.ui.showModal; },
    value => { delete value.ui.setStatus; },
  ];

  for (const mutate of cases) {
    const value = completePorts();
    mutate(value);
    assert.throws(() => createDocumentBackgroundController(value), /bridge is required/);
  }
});

test('modal preserves exact schema, owner default and option order', () => {
  const owner = { background: '#ffffff' };
  const h = makeHarness({ documentValue: owner, primaryColor: '#a1b2c3' });
  h.controller.showDocumentBackgroundDialog();

  const modal = h.getModal();
  assert.equal(modal.title, 'Фон документа');
  assert.equal(modal.submitLabel, 'Применить');
  assert.deepEqual(modal.fields, [{
    name: 'background',
    label: 'Фон',
    type: 'select',
    value: '#ffffff',
    options: [
      ['transparent', 'Прозрачный'],
      ['#ffffff', 'Белый'],
      ['#000000', 'Чёрный'],
      ['#a1b2c3', 'Основной цвет'],
    ],
  }]);
});

test('primary color is sampled independently on every dialog open', () => {
  const h = makeHarness({ primaryColor: '#111111' });
  h.controller.showDocumentBackgroundDialog();
  assert.deepEqual(h.getModal().fields[0].options.at(-1), ['#111111', 'Основной цвет']);

  h.state.primaryColor = '#abcdef';
  h.controller.showDocumentBackgroundDialog();
  assert.deepEqual(h.getModal().fields[0].options.at(-1), ['#abcdef', 'Основной цвет']);
});

test('submit keeps the exact owner captured at open after active document switch', () => {
  const original = { background: 'transparent', id: 'original' };
  const replacement = { background: '#000000', id: 'replacement' };
  const h = makeHarness({ documentValue: original });
  h.controller.showDocumentBackgroundDialog();
  h.state.documentValue = replacement;

  h.getModal().onSubmit({ background: '#ffffff' });

  assert.strictEqual(h.calls.commands[0].owner, original);
});

test('submit forwards the exact selected background value', () => {
  const h = makeHarness();
  h.controller.showDocumentBackgroundDialog();

  h.getModal().onSubmit({ background: '#fedcba' });

  assert.equal(h.calls.commands[0].value, '#fedcba');
});

test('REJECTED keeps the modal open and reports the stale-document status', () => {
  const h = makeHarness({ outcome: { result: DOCUMENT_BACKGROUND_COMMAND_RESULT.REJECTED } });
  h.controller.showDocumentBackgroundDialog();

  assert.equal(h.getModal().onSubmit({ background: '#ffffff' }), false);
  assert.deepEqual(h.calls.statuses, ['Документ изменился — фон не применён']);
});

for (const result of [
  DOCUMENT_BACKGROUND_COMMAND_RESULT.COMMITTED,
  DOCUMENT_BACKGROUND_COMMAND_RESULT.NOOP,
]) {
  test(`${result} preserves normal modal-close semantics without duplicate UI publication`, () => {
    const h = makeHarness({ outcome: { result } });
    h.controller.showDocumentBackgroundDialog();

    assert.equal(h.getModal().onSubmit({ background: '#ffffff' }), undefined);
    assert.deepEqual(h.calls.statuses, []);
    assert.equal(h.calls.commands.length, 1);
  });
}
