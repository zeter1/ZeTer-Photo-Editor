import test from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENT_RESIZE_COMMAND_RESULT } from '../src/document/resize-command-controller.js';
import { createDocumentResizeController } from '../src/ui/document-resize-controller.js';

const ANCHOR_OPTIONS = [
  ['top-left', '↖ Слева сверху'],
  ['top', '↑ Сверху'],
  ['top-right', '↗ Справа сверху'],
  ['left', '← Слева'],
  ['center', '● По центру'],
  ['right', '→ Справа'],
  ['bottom-left', '↙ Слева снизу'],
  ['bottom', '↓ Снизу'],
  ['bottom-right', '↘ Справа снизу'],
];

function makeHarness({
  documentValue = { width: 640, height: 480 },
  pendingChecks = [],
  imageOutcome = { result: DOCUMENT_RESIZE_COMMAND_RESULT.COMMITTED },
  canvasOutcome = { result: DOCUMENT_RESIZE_COMMAND_RESULT.COMMITTED },
} = {}) {
  const state = { documentValue };
  const calls = {
    image: [],
    canvas: [],
    statuses: [],
    toasts: [],
  };
  let pendingIndex = 0;
  let modal = null;

  const controller = createDocumentResizeController({
    documentState: {
      getDocument: () => state.documentValue,
      blockPendingDocumentEdit: () => Boolean(pendingChecks[pendingIndex++]),
    },
    commands: {
      resizeImage: (owner, values) => {
        calls.image.push({ owner, values });
        return imageOutcome;
      },
      resizeCanvas: (owner, values) => {
        calls.canvas.push({ owner, values });
        return canvasOutcome;
      },
    },
    ui: {
      showModal: options => { modal = options; },
      setStatus: message => calls.statuses.push(message),
      toast: (message, tone) => calls.toasts.push([message, tone]),
    },
  });

  return {
    controller,
    state,
    calls,
    getModal: () => modal,
  };
}

test('pending persisted edit blocks opening both resize dialogs', () => {
  const image = makeHarness({ pendingChecks: [true] });
  image.controller.showImageSizeDialog();
  assert.equal(image.getModal(), null);
  assert.deepEqual(image.calls.image, []);

  const canvas = makeHarness({ pendingChecks: [true] });
  canvas.controller.showCanvasSizeDialog();
  assert.equal(canvas.getModal(), null);
  assert.deepEqual(canvas.calls.canvas, []);
});

test('Image Size modal preserves the exact field schema and owner defaults', () => {
  const owner = { width: 1024, height: 768 };
  const harness = makeHarness({ documentValue: owner, pendingChecks: [false] });
  harness.controller.showImageSizeDialog();

  const modal = harness.getModal();
  assert.equal(modal.title, 'Размер изображения');
  assert.equal(modal.submitLabel, 'Изменить');
  assert.deepEqual(modal.fields, [
    { name: 'width', label: 'Ширина', type: 'number', value: 1024, min: '1', max: '12000', required: true },
    { name: 'height', label: 'Высота', type: 'number', value: 768, min: '1', max: '12000', required: true },
  ]);
});

test('Canvas Size modal preserves dimensions plus all nine anchor choices', () => {
  const harness = makeHarness({
    documentValue: { width: 320, height: 200 },
    pendingChecks: [false],
  });
  harness.controller.showCanvasSizeDialog();

  const modal = harness.getModal();
  assert.equal(modal.title, 'Размер холста');
  assert.equal(modal.submitLabel, 'Изменить');
  assert.deepEqual(modal.fields.slice(0, 2), [
    { name: 'width', label: 'Ширина', type: 'number', value: 320, min: '1', max: '12000', required: true },
    { name: 'height', label: 'Высота', type: 'number', value: 200, min: '1', max: '12000', required: true },
  ]);
  assert.deepEqual(modal.fields[2], {
    name: 'anchor',
    label: 'Якорь',
    type: 'select',
    value: 'center',
    options: ANCHOR_OPTIONS,
  });
});

test('submit repeats the pending-edit guard and never calls a resize command when blocked', () => {
  const image = makeHarness({ pendingChecks: [false, true] });
  image.controller.showImageSizeDialog();
  assert.equal(image.getModal().onSubmit({ width: '800', height: '600' }), false);
  assert.deepEqual(image.calls.image, []);

  const canvas = makeHarness({ pendingChecks: [false, true] });
  canvas.controller.showCanvasSizeDialog();
  assert.equal(canvas.getModal().onSubmit({ width: '800', height: '600', anchor: 'center' }), false);
  assert.deepEqual(canvas.calls.canvas, []);
});

test('modal submit keeps the exact owner captured at open even after the active document changes', () => {
  const original = { width: 640, height: 480, id: 'original' };
  const replacement = { width: 1920, height: 1080, id: 'replacement' };

  const image = makeHarness({ documentValue: original, pendingChecks: [false, false] });
  image.controller.showImageSizeDialog();
  image.state.documentValue = replacement;
  image.getModal().onSubmit({ width: '800', height: '600' });
  assert.strictEqual(image.calls.image[0].owner, original);
  assert.deepEqual(image.calls.image[0].values, { width: '800', height: '600' });

  const canvas = makeHarness({ documentValue: original, pendingChecks: [false, false] });
  canvas.controller.showCanvasSizeDialog();
  canvas.state.documentValue = replacement;
  canvas.getModal().onSubmit({ width: '900', height: '700', anchor: 'bottom-right' });
  assert.strictEqual(canvas.calls.canvas[0].owner, original);
  assert.deepEqual(canvas.calls.canvas[0].values, {
    width: '900',
    height: '700',
    anchor: 'bottom-right',
  });
});

test('INVALID keeps the modal open and publishes the command error through toast and status', () => {
  const error = new Error('Размер недопустим');
  const harness = makeHarness({
    pendingChecks: [false, false],
    imageOutcome: { result: DOCUMENT_RESIZE_COMMAND_RESULT.INVALID, error },
  });
  harness.controller.showImageSizeDialog();

  assert.equal(harness.getModal().onSubmit({ width: '99999', height: '100' }), false);
  assert.deepEqual(harness.calls.toasts, [['Размер недопустим', 'error']]);
  assert.deepEqual(harness.calls.statuses, ['Размер недопустим']);
});

test('INVALID falls back to the existing generic resize error message', () => {
  const harness = makeHarness({
    pendingChecks: [false, false],
    canvasOutcome: { result: DOCUMENT_RESIZE_COMMAND_RESULT.INVALID },
  });
  harness.controller.showCanvasSizeDialog();

  assert.equal(harness.getModal().onSubmit({ width: '0', height: '0', anchor: 'center' }), false);
  assert.deepEqual(harness.calls.toasts, [['Не удалось изменить размер документа', 'error']]);
  assert.deepEqual(harness.calls.statuses, ['Не удалось изменить размер документа']);
});

test('REJECTED keeps the modal open and reports stale-document status without an extra toast', () => {
  const harness = makeHarness({
    pendingChecks: [false, false],
    canvasOutcome: { result: DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED },
  });
  harness.controller.showCanvasSizeDialog();

  assert.equal(harness.getModal().onSubmit({ width: '800', height: '600', anchor: 'center' }), false);
  assert.deepEqual(harness.calls.statuses, ['Документ изменился — размер не применён']);
  assert.deepEqual(harness.calls.toasts, []);
});

for (const result of [
  DOCUMENT_RESIZE_COMMAND_RESULT.COMMITTED,
  DOCUMENT_RESIZE_COMMAND_RESULT.NOOP,
]) {
  test(`${result} preserves normal modal-close semantics without duplicate UI publication`, () => {
    const harness = makeHarness({
      pendingChecks: [false, false],
      imageOutcome: { result },
    });
    harness.controller.showImageSizeDialog();

    assert.equal(harness.getModal().onSubmit({ width: '640', height: '480' }), undefined);
    assert.equal(harness.calls.image.length, 1);
    assert.deepEqual(harness.calls.statuses, []);
    assert.deepEqual(harness.calls.toasts, []);
  });
}
