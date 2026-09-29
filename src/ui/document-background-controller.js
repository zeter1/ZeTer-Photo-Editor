import { DOCUMENT_BACKGROUND_COMMAND_RESULT } from '../document/background-command-controller.js';

function requirePort(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`document background UI ${label} bridge is required`);
  }
  return value;
}

/**
 * Owns Image > Document Background modal orchestration only.
 *
 * Persisted mutation, exact-owner validation, semantic no-op suppression and
 * history publication remain in document/background-command-controller.js.
 * Volatile UI inputs such as the primary color are sampled at dialog-open time.
 */
export function createDocumentBackgroundController({
  documentState: {
    getDocument,
    getPrimaryColor,
  } = {},
  commands: {
    setBackground,
  } = {},
  ui: {
    showModal,
    setStatus,
  } = {},
} = {}) {
  requirePort(getDocument, 'document state');
  requirePort(getPrimaryColor, 'primary-color');
  requirePort(setBackground, 'set-background command');
  requirePort(showModal, 'modal');
  requirePort(setStatus, 'status');

  function showDocumentBackgroundDialog() {
    const owner = getDocument();
    const primaryColor = getPrimaryColor();

    showModal({
      title: 'Фон документа',
      fields: [{
        name: 'background',
        label: 'Фон',
        type: 'select',
        value: owner.background,
        options: [
          ['transparent', 'Прозрачный'],
          ['#ffffff', 'Белый'],
          ['#000000', 'Чёрный'],
          [primaryColor, 'Основной цвет'],
        ],
      }],
      submitLabel: 'Применить',
      onSubmit: values => {
        const outcome = setBackground(owner, values.background);
        if (outcome?.result === DOCUMENT_BACKGROUND_COMMAND_RESULT.REJECTED) {
          setStatus('Документ изменился — фон не применён');
          return false;
        }
        return undefined;
      },
    });
  }

  return { showDocumentBackgroundDialog };
}
