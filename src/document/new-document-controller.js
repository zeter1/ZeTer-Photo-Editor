const DISCARD_CONFIRM_MESSAGE = 'В документе есть несохранённые изменения. Продолжить без сохранения?';
const STALE_DOCUMENT_MESSAGE = 'Новый документ не создан: активный документ изменился';

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
    getDocument,
    getActiveSessionId,
    getDocumentChangeSerial,
    blockPendingDocumentEdit,
    canCancelPendingContentAwareFill = () => false,
    cancelPendingContentAwareFill = () => false,
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
  requirePort(getDocument, 'document-owner');
  requirePort(getActiveSessionId, 'session-owner');
  requirePort(getDocumentChangeSerial, 'change-serial');
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

  // In-flight content-aware Fill is revocable, unlike a painting gesture or
  // another persistence operation. Do not revoke it before user approval.
  function blockUncancellableEdit() {
    return canCancelPendingContentAwareFill() ? false : blockPendingDocumentEdit();
  }

  function canReplaceDocument() {
    return !isDirty() || confirmDiscard(DISCARD_CONFIRM_MESSAGE);
  }

  function captureReplacementAuthority() {
    return {
      documentValue: getDocument(),
      sessionId: getActiveSessionId(),
      changeSerial: getDocumentChangeSerial(),
      dirty: isDirty(),
    };
  }

  function replacementOwnerIsCurrent(authority) {
    return getDocument() === authority.documentValue && getActiveSessionId() === authority.sessionId;
  }

  function needsFreshDiscardConfirmation(authority) {
    return isDirty() && (!authority.dirty || getDocumentChangeSerial() !== authority.changeSerial);
  }

  function rejectStaleReplacementOwner() {
    setStatus(STALE_DOCUMENT_MESSAGE);
    toast(STALE_DOCUMENT_MESSAGE, 'warn');
    return false;
  }

  async function open() {
    if (blockUncancellableEdit()) return;
    if (!canReplaceDocument()) return;
    const authority = captureReplacementAuthority();
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
        if (blockUncancellableEdit()) return false;
        if (!replacementOwnerIsCurrent(authority)) return rejectStaleReplacementOwner();
        if (needsFreshDiscardConfirmation(authority) && !confirmDiscard(DISCARD_CONFIRM_MESSAGE)) return false;
        try {
          const next = createDocument({
            name: values.name || 'Без имени',
            width: Number(values.width),
            height: Number(values.height),
            background: values.background,
          });
          // Validation and the latest discard decision must succeed before
          // cancelling a running Worker. Recheck the lease before publication.
          if (canCancelPendingContentAwareFill() && !cancelPendingContentAwareFill()) return false;
          if (blockPendingDocumentEdit()) return false;
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
