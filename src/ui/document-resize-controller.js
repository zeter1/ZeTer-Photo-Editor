import {
  DOCUMENT_RESIZE_ANCHORS,
  DOCUMENT_RESIZE_COMMAND_RESULT,
} from '../document/resize-command-controller.js';

const DOCUMENT_RESIZE_ANCHOR_LABELS = Object.freeze({
  'top-left': '↖ Слева сверху',
  top: '↑ Сверху',
  'top-right': '↗ Справа сверху',
  left: '← Слева',
  center: '● По центру',
  right: '→ Справа',
  'bottom-left': '↙ Слева снизу',
  bottom: '↓ Снизу',
  'bottom-right': '↘ Справа снизу',
});

function documentSizeFields(owner) {
  return [
    {
      name: 'width',
      label: 'Ширина',
      type: 'number',
      value: owner.width,
      min: '1',
      max: '12000',
      required: true,
    },
    {
      name: 'height',
      label: 'Высота',
      type: 'number',
      value: owner.height,
      min: '1',
      max: '12000',
      required: true,
    },
  ];
}

function requirePort(value, label) {
  if (typeof value !== 'function') throw new TypeError(`document resize UI ${label} bridge is required`);
  return value;
}

/**
 * Owns Image Size / Canvas Size modal orchestration only.
 *
 * Persisted resize math, validation, history and fit-to-view remain in
 * document/resize-command-controller.js. This UI owner captures the exact
 * document at modal-open time and repeats the pending-edit guard on submit.
 */
export function createDocumentResizeController({
  documentState: {
    getDocument,
    blockPendingDocumentEdit,
  } = {},
  commands: {
    resizeImage,
    resizeCanvas,
  } = {},
  ui: {
    showModal,
    setStatus = () => {},
    toast = () => {},
  } = {},
} = {}) {
  requirePort(getDocument, 'document state');
  requirePort(blockPendingDocumentEdit, 'pending-edit');
  requirePort(resizeImage, 'resize-image command');
  requirePort(resizeCanvas, 'resize-canvas command');
  requirePort(showModal, 'modal');
  requirePort(setStatus, 'status');
  requirePort(toast, 'toast');

  function handleCommandResult(outcome) {
    if (outcome?.result === DOCUMENT_RESIZE_COMMAND_RESULT.INVALID) {
      const message = outcome.error?.message || 'Не удалось изменить размер документа';
      toast(message, 'error');
      setStatus(message);
      return false;
    }
    if (outcome?.result === DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED) {
      setStatus('Документ изменился — размер не применён');
      return false;
    }
    return undefined;
  }

  function showImageSizeDialog() {
    if (blockPendingDocumentEdit()) return;
    const owner = getDocument();
    showModal({
      title: 'Размер изображения',
      fields: documentSizeFields(owner),
      submitLabel: 'Изменить',
      onSubmit: values => {
        if (blockPendingDocumentEdit()) return false;
        return handleCommandResult(resizeImage(owner, values));
      },
    });
  }

  function showCanvasSizeDialog() {
    if (blockPendingDocumentEdit()) return;
    const owner = getDocument();
    showModal({
      title: 'Размер холста',
      fields: [
        ...documentSizeFields(owner),
        {
          name: 'anchor',
          label: 'Якорь',
          type: 'select',
          value: 'center',
          options: DOCUMENT_RESIZE_ANCHORS.map(anchor => [
            anchor,
            DOCUMENT_RESIZE_ANCHOR_LABELS[anchor],
          ]),
        },
      ],
      submitLabel: 'Изменить',
      onSubmit: values => {
        if (blockPendingDocumentEdit()) return false;
        return handleCommandResult(resizeCanvas(owner, values));
      },
    });
  }

  return {
    showImageSizeDialog,
    showCanvasSizeDialog,
  };
}
