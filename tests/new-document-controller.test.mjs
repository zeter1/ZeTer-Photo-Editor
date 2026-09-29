import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewDocumentController } from '../src/document/new-document-controller.js';

const CONFIRM_TEXT = 'В документе есть несохранённые изменения. Продолжить без сохранения?';

function makeHarness({
  dirty = false,
  pendingChecks = [],
  confirmResult = true,
  factory = values => ({ id: 'new-doc', ...values }),
} = {}) {
  const state = { dirty };
  const calls = { confirms: [], factory: [], toasts: [], statuses: [] };
  const events = [];
  let pendingIndex = 0;
  let modal = null;
  const controller = createNewDocumentController({
    documentState: {
      isDirty: () => state.dirty,
      blockPendingDocumentEdit: () => Boolean(pendingChecks[pendingIndex++]),
      replaceHistory: () => events.push('history'),
      setDocument: (documentValue, options) => events.push(['document', documentValue, options]),
      markDirty: value => events.push(['dirty', value]),
    },
    documentFactory: {
      createDocument: values => {
        calls.factory.push(values);
        events.push('factory');
        return factory(values);
      },
    },
    recovery: { queueRecovery: options => events.push(['recovery', options]) },
    view: { fitToView: () => events.push('fit') },
    ui: {
      showModal: options => { modal = options; },
      confirmDiscard: message => { calls.confirms.push(message); return confirmResult; },
      setStatus: message => calls.statuses.push(message),
      toast: (message, tone) => calls.toasts.push([message, tone]),
    },
  });
  return { controller, state, calls, events, getModal: () => modal };
}

test('required bridges fail fast', () => {
  assert.throws(() => createNewDocumentController(), /new document dirty-state bridge is required/);
});

test('pending edit blocks opening before dirty confirmation', async () => {
  const h = makeHarness({ dirty: true, pendingChecks: [true] });
  await h.controller.open();
  assert.equal(h.getModal(), null);
  assert.deepEqual(h.calls.confirms, []);
});

test('dirty replacement uses exact confirmation text and cancel opens nothing', async () => {
  const h = makeHarness({ dirty: true, pendingChecks: [false], confirmResult: false });
  await h.controller.open();
  assert.deepEqual(h.calls.confirms, [CONFIRM_TEXT]);
  assert.equal(h.getModal(), null);
  assert.deepEqual(h.events, []);
});

test('clean document skips confirmation and opens modal', async () => {
  const h = makeHarness({ dirty: false, pendingChecks: [false] });
  await h.controller.open();
  assert.deepEqual(h.calls.confirms, []);
  assert.ok(h.getModal());
});

test('modal schema preserves exact defaults and choices', async () => {
  const h = makeHarness({ pendingChecks: [false] });
  await h.controller.open();
  const modal = h.getModal();
  assert.equal(modal.title, 'Новый документ');
  assert.equal(modal.submitLabel, 'Создать');
  assert.deepEqual(modal.fields, [
    { name: 'name', label: 'Название', value: 'Без имени' },
    { name: 'width', label: 'Ширина', type: 'number', value: '1200', min: '1', max: '12000', required: true },
    { name: 'height', label: 'Высота', type: 'number', value: '800', min: '1', max: '12000', required: true },
    { name: 'background', label: 'Фон', type: 'select', value: 'transparent', options: [
      ['transparent', 'Прозрачный'],
      ['#ffffff', 'Белый'],
      ['#000000', 'Чёрный'],
    ] },
  ]);
});

test('submit repeats pending guard and publishes nothing when blocked', async () => {
  const h = makeHarness({ pendingChecks: [false, true] });
  await h.controller.open();
  assert.equal(await h.getModal().onSubmit({ name: 'X', width: '100', height: '100', background: 'transparent' }), false);
  assert.deepEqual(h.calls.factory, []);
  assert.deepEqual(h.events, []);
});

test('success forwards canonical values, name fallback and ordered publication', async () => {
  const h = makeHarness({ pendingChecks: [false, false] });
  await h.controller.open();
  assert.equal(await h.getModal().onSubmit({ name: '', width: '640', height: '480', background: '#ffffff' }), undefined);
  assert.deepEqual(h.calls.factory, [{ name: 'Без имени', width: 640, height: 480, background: '#ffffff' }]);
  assert.equal(h.events[0], 'factory');
  assert.equal(h.events[1], 'history');
  assert.deepEqual(h.events[2], [
    'document',
    { id: 'new-doc', name: 'Без имени', width: 640, height: 480, background: '#ffffff' },
    { resetHistory: true, label: 'Новый документ' },
  ]);
  assert.deepEqual(h.events[3], ['dirty', false]);
  assert.deepEqual(h.events[4], ['recovery', { immediate: true }]);
  assert.equal(h.events[5], 'fit');
});

test('factory failure keeps modal open and causes zero partial publication', async () => {
  const error = new Error('Документ слишком большой');
  const h = makeHarness({
    pendingChecks: [false, false],
    factory: () => { throw error; },
  });
  await h.controller.open();
  assert.equal(
    await h.getModal().onSubmit({ name: 'X', width: '99999', height: '99999', background: 'transparent' }),
    false,
  );
  assert.deepEqual(h.events, ['factory']);
  assert.deepEqual(h.calls.toasts, [['Документ слишком большой', 'error']]);
  assert.deepEqual(h.calls.statuses, ['Документ слишком большой']);
  assert.ok(h.getModal());
});

test('canReplaceDocument is reusable by other document-open owners', () => {
  const clean = makeHarness({ dirty: false });
  assert.equal(clean.controller.canReplaceDocument(), true);
  assert.deepEqual(clean.calls.confirms, []);

  const dirty = makeHarness({ dirty: true, confirmResult: true });
  assert.equal(dirty.controller.canReplaceDocument(), true);
  assert.deepEqual(dirty.calls.confirms, [CONFIRM_TEXT]);
});
