const DISCARD_CONFIRM_MESSAGE = 'В документе есть несохранённые изменения. Продолжить без сохранения?';

function requirePort(value, label) {
  if (typeof value !== 'function') throw new TypeError(`new document ${label} bridge is required`);
  return value;
}

/**
 * Owns the File → New / Ctrl+N document replacement transaction.
 *
 * Canonical document validation stays in the injected createDocument factory;
 * generic modal DOM, session internals and recovery storage stay in their owners.
 */
export function createNewDocumentController({
  documentState: {
    isDirty,
    blockPendingDocumentEdit,
    replaceHistory,
    setDocument,
    markDirty,
  } = {},
  documentFactory: { createDocument } = {},
  recovery: { queueRecovery } = {},
  view: { fitToView } = {},
  ui: {
    showModal,
    confirmDiscard,
    setStatus = () => {},
    toast = () => {},
  } = {},
} = {}) {
  requirePort(isDirty, 'dirty-state');
  requirePort(blockPendingDocumentEdit, 'pending-edit');
  requirePort(replaceHistory, 'history-replacement');
  requirePort(setDocument, 'document-publication');
  requirePort(markDirty, 'dirty-publication');
  requirePort(createDocument, 'factory');
  requirePort(queueRecovery, 'recovery');
  requirePort(fitToView, 'viewport');
  requirePort(showModal, 'modal');
  requirePort(confirmDiscard, 'discard-confirmation');
  requirePort(setStatus, 'status');
  requirePort(toast, 'toast');

  function canReplaceDocument() {
    return !isDirty() || confirmDiscard(DISCARD_CONFIRM_MESSAGE);
  }

  async function open() {
    if (blockPendingDocumentEdit()) return;
    if (!canReplaceDocument()) return;
    showModal({
      title: 'Новый документ',
      fields: [
        { name: 'name', label: 'Название', value: 'Без имени' },
        { name: 'width', label: 'Ширина', type: 'number', value: '1200', min: '1', max: '12000', required: true },
        { name: 'height', label: 'Высота', type: 'number', value: '800', min: '1', max: '12000', required: true },
        {
          name: 'background',
          label: 'Фон',
          type: 'select',
          value: 'transparent',
          options: [
            ['transparent', 'Прозрачный'],
            ['#ffffff', 'Белый'],
            ['#000000', 'Чёрный'],
          ],
        },
      ],
      submitLabel: 'Создать',
      onSubmit: async values => {
        if (blockPendingDocumentEdit()) return false;
        try {
          const next = createDocument({
            name: values.name || 'Без имени',
            width: Number(values.width),
            height: Number(values.height),
            background: values.background,
          });
          replaceHistory();
          setDocument(next, { resetHistory: true, label: 'Новый документ' });
          markDirty(false);
          queueRecovery({ immediate: true });
          fitToView();
        } catch (error) {
          toast(error.message, 'error');
          setStatus(error.message);
          return false;
        }
      },
    });
  }

  return { open, canReplaceDocument };
}
