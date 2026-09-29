function requireHistoryNavigationPort(value, label) {
  if (typeof value !== 'function') throw new TypeError(`history navigation ${label} bridge is required`);
  return value;
}

function requireHistoryNavigationMethod(history, method) {
  if (!history || typeof history[method] !== 'function') {
    throw new TypeError(`history navigation history.${method} bridge is required`);
  }
  return history[method].bind(history);
}

/**
 * Owns runtime Undo / Redo / history-jump transactions.
 *
 * HistoryStack mechanics and snapshots stay in core owners. The controller
 * resolves the live history binding at command time so session switches cannot
 * route navigation into a stale stack captured during composition.
 */
export function createHistoryNavigationController({
  state: {
    getHistory,
    setDocument,
  } = {},
  guard: {
    blockPendingDocumentEdit,
  } = {},
  restore: {
    restoreDocument,
  } = {},
  transient: {
    clearSelection,
    clearRasterEdit,
    resetCrop,
  } = {},
  runtime: {
    updateAll,
    markDirty,
    setStatus,
  } = {},
} = {}) {
  requireHistoryNavigationPort(getHistory, 'history');
  requireHistoryNavigationPort(setDocument, 'document-publication');
  requireHistoryNavigationPort(blockPendingDocumentEdit, 'pending-edit');
  requireHistoryNavigationPort(restoreDocument, 'restore');
  requireHistoryNavigationPort(clearSelection, 'selection-cleanup');
  requireHistoryNavigationPort(clearRasterEdit, 'raster-cleanup');
  requireHistoryNavigationPort(resetCrop, 'crop-cleanup');
  requireHistoryNavigationPort(updateAll, 'runtime-refresh');
  requireHistoryNavigationPort(markDirty, 'dirty-publication');
  requireHistoryNavigationPort(setStatus, 'status');

  function undo() {
    if (blockPendingDocumentEdit()) return false;
    const entry = requireHistoryNavigationMethod(getHistory(), 'undo')();
    if (!entry) return false;

    setDocument(restoreDocument(entry.snapshot));
    clearSelection();
    clearRasterEdit();
    updateAll();
    markDirty(true);
    setStatus(`Отменено → ${entry.label}`);
    return true;
  }

  function redo() {
    if (blockPendingDocumentEdit()) return false;
    const entry = requireHistoryNavigationMethod(getHistory(), 'redo')();
    if (!entry) return false;

    setDocument(restoreDocument(entry.snapshot));
    clearSelection();
    clearRasterEdit();
    updateAll();
    markDirty(true);
    setStatus(`Повторено → ${entry.label}`);
    return true;
  }

  function jumpToHistory(index) {
    if (blockPendingDocumentEdit()) return false;
    const entry = requireHistoryNavigationMethod(getHistory(), 'jump')(index);
    if (!entry) return false;

    setDocument(restoreDocument(entry.snapshot));
    clearRasterEdit();
    resetCrop();
    clearSelection();
    updateAll();
    markDirty(true);
    setStatus(`История → ${entry.label}`);
    return true;
  }

  return { undo, redo, jumpToHistory };
}
