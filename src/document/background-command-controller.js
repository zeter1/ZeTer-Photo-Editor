export const DOCUMENT_BACKGROUND_COMMAND_RESULT = Object.freeze({
  COMMITTED: 'committed',
  NOOP: 'noop',
  REJECTED: 'rejected',
});

function commandResult(result) {
  return { result };
}

export function createDocumentBackgroundCommandController({
  state,
  transaction,
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('document background command state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('document background command transaction bridge is required');
  }

  function activeOwner(owner) {
    return Boolean(owner) && state.getDocument() === owner;
  }

  function setBackground(owner, value) {
    if (!activeOwner(owner)) {
      return commandResult(DOCUMENT_BACKGROUND_COMMAND_RESULT.REJECTED);
    }
    if (owner.background === value) {
      return commandResult(DOCUMENT_BACKGROUND_COMMAND_RESULT.NOOP);
    }
    if (!activeOwner(owner)) {
      return commandResult(DOCUMENT_BACKGROUND_COMMAND_RESULT.REJECTED);
    }

    owner.background = value;
    transaction.commit('Фон документа');
    return commandResult(DOCUMENT_BACKGROUND_COMMAND_RESULT.COMMITTED);
  }

  return { setBackground };
}
