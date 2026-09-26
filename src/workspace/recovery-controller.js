export const RECOVERY_DEBOUNCE_MS = 1500;
const RECOVERY_WINDOW_STORAGE_KEY = 'zeter-photo-editor.recovery-window.v1';

export function createRecoveryWindowKey({
  forceNew = false,
  cryptoRef,
  sessionStorageRef,
  performanceRef,
  now = Date.now,
  random = Math.random,
  consoleRef = globalThis.console,
} = {}) {
  let randomId = '';
  try {
    const cryptoApi = cryptoRef ?? globalThis.crypto;
    randomId = cryptoApi?.randomUUID?.() || '';
  } catch {}
  if (!randomId) randomId = `${now().toString(36)}-${random().toString(36).slice(2)}`;
  const key = `workspace:${randomId}`;

  try {
    const storage = sessionStorageRef ?? globalThis.sessionStorage;
    const performanceApi = performanceRef ?? globalThis.performance;
    const previous = storage?.getItem?.(RECOVERY_WINDOW_STORAGE_KEY);
    const navigation = performanceApi?.getEntriesByType?.('navigation')?.[0]?.type;
    if (!forceNew && navigation === 'reload' && previous?.startsWith('workspace:')) return previous;
    storage?.setItem?.(RECOVERY_WINDOW_STORAGE_KEY, key);
  } catch (error) {
    consoleRef?.warn?.('Recovery window identity is not persistent', error);
  }
  return key;
}

function requirePort(value, name) {
  if (typeof value !== 'function') throw new TypeError(`Recovery controller requires ${name}`);
  return value;
}

export function createRecoveryController({
  storage = {},
  projects = {},
  sessions = {},
  runtime = {},
  ui = {},
  createKey = forceNew => createRecoveryWindowKey({ forceNew }),
  setTimeoutFn = (handler, delay) => globalThis.setTimeout(handler, delay),
  clearTimeoutFn = timer => globalThis.clearTimeout(timer),
  debounceMs = RECOVERY_DEBOUNCE_MS,
  consoleRef = globalThis.console,
} = {}) {
  const saveSnapshot = requirePort(storage.save, 'storage.save');
  const loadSnapshots = requirePort(storage.loadAll, 'storage.loadAll');
  const clearSnapshot = requirePort(storage.clear, 'storage.clear');
  const snapshotProject = requirePort(projects.snapshot, 'projects.snapshot');
  const sanitizeProject = requirePort(projects.sanitize, 'projects.sanitize');
  const getSessions = requirePort(sessions.getAll, 'sessions.getAll');
  const setSessions = requirePort(sessions.replaceAll, 'sessions.replaceAll');
  const getActiveSessionId = requirePort(sessions.getActiveId, 'sessions.getActiveId');
  const setActiveSessionId = requirePort(sessions.setActiveId, 'sessions.setActiveId');
  const syncCurrentSession = requirePort(sessions.syncCurrent, 'sessions.syncCurrent');
  const buildSession = requirePort(sessions.build, 'sessions.build');
  const loadSession = requirePort(sessions.load, 'sessions.load');

  const updateAll = runtime.updateAll || (() => {});
  const markDirty = runtime.markDirty || (() => {});
  const startNewProject = runtime.startNewProject || (() => {});
  const showRecoveryModal = ui.showRecoveryModal || (async () => ({ action:'later' }));
  const setStatus = ui.setStatus || (() => {});
  const toast = ui.toast || (() => {});

  let recoveryKey = createKey(false);
  let recoveryTimer = null;
  let recoveryGeneration = 0;
  let recoveryWritePromise = Promise.resolve();
  let recoveryStorageAvailable = true;
  let recoveryFailureNotified = false;
  let unrestoredRecoveryDocuments = [];

  function reportRecoveryFailure(error, { notify = false } = {}) {
    recoveryStorageAvailable = false;
    consoleRef?.warn?.('ZeTer Photo Editor recovery storage unavailable', error);
    if (notify && !recoveryFailureNotified) {
      recoveryFailureNotified = true;
      toast('Автовосстановление недоступно в этом режиме браузера', 'warn');
    }
  }

  function cancelPendingWrite() {
    recoveryGeneration += 1;
    if (recoveryTimer !== null) clearTimeoutFn(recoveryTimer);
    recoveryTimer = null;
  }

  function queueRecovery({ immediate = false } = {}) {
    if (!recoveryStorageAvailable) return recoveryWritePromise;
    cancelPendingWrite();
    const generation = recoveryGeneration;
    const write = () => {
      if (generation !== recoveryGeneration || !recoveryStorageAvailable) return;
      recoveryTimer = null;
      syncCurrentSession();
      const dirtySessions = getSessions().filter(session => session?.dirty);
      const snapshots = [
        ...unrestoredRecoveryDocuments,
        ...dirtySessions.map(session => ({
          name: session.doc?.name || 'Без имени',
          modifiedAt: session.doc?.modifiedAt || '',
          snapshot: snapshotProject(session.doc),
        })),
      ];
      const activeIndex = unrestoredRecoveryDocuments.length
        + Math.max(0, dirtySessions.findIndex(session => session.id === getActiveSessionId()));
      recoveryWritePromise = recoveryWritePromise
        .then(() => snapshots.length
          ? saveSnapshot(snapshots, { activeIndex }, { key: recoveryKey })
          : clearSnapshot({ key: recoveryKey }))
        .catch(error => reportRecoveryFailure(error, { notify: true }));
    };
    if (immediate) write();
    else recoveryTimer = setTimeoutFn(write, debounceMs);
    return recoveryWritePromise;
  }

  function discardRecovery(key = recoveryKey, { allowForeign = false } = {}) {
    const ownsKey = key === recoveryKey || key === 'latest';
    if (!ownsKey && !allowForeign) {
      consoleRef?.warn?.('Ignored recovery discard request for another editor window', { key });
      return Promise.resolve(false);
    }
    cancelPendingWrite();
    if (!recoveryStorageAvailable) return Promise.resolve(false);
    recoveryWritePromise = recoveryWritePromise
      .catch(() => {})
      .then(() => clearSnapshot({ key }))
      .then(() => {
        if (ownsKey) unrestoredRecoveryDocuments = [];
        return true;
      })
      .catch(error => {
        consoleRef?.warn?.('Could not clear recovery snapshot', error);
        return false;
      });
    return recoveryWritePromise;
  }

  function recoveryRenamePayload(entry, requestedName) {
    const name = String(requestedName || '').trim().slice(0, 240);
    const record = entry?.record;
    if (!name || !record?.documents?.length) return null;
    const activeIndex = Math.min(Math.max(0, Number(record.activeIndex) || 0), record.documents.length - 1);
    const documents = record.documents.map((item, index) => {
      let snapshot = item.snapshot;
      let docName = item.docName || 'Без имени';
      if (index === activeIndex) {
        docName = name;
        try {
          const parsed = JSON.parse(snapshot);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            parsed.name = name;
            snapshot = JSON.stringify(parsed);
          }
        } catch (error) {
          consoleRef?.warn?.('Could not rewrite recovery snapshot title', error);
        }
      }
      return { name:docName, modifiedAt:item.modifiedAt || '', snapshot };
    });
    return { name, documents, activeIndex, savedAt:record.savedAt };
  }

  function renameRecovery(entry, requestedName) {
    const payload = recoveryRenamePayload(entry, requestedName);
    if (!payload || !recoveryStorageAvailable) return Promise.resolve(false);
    cancelPendingWrite();
    recoveryWritePromise = recoveryWritePromise
      .catch(() => {})
      .then(() => saveSnapshot(
        payload.documents,
        { activeIndex:payload.activeIndex },
        { key:entry.key, savedAt:payload.savedAt },
      ))
      .then(() => true)
      .catch(error => {
        reportRecoveryFailure(error, { notify:true });
        return false;
      });
    return recoveryWritePromise;
  }

  function parseStoredEntry({ key, record }) {
    const recovered = [];
    const invalid = [];
    for (const [index, item] of (record?.documents || []).entries()) {
      try {
        recovered.push({ doc:sanitizeProject(JSON.parse(item.snapshot)), index });
      } catch (error) {
        invalid.push(item);
        consoleRef?.warn?.('Invalid recovery document was preserved in storage', error);
      }
    }
    return {
      key,
      record,
      recovered,
      invalid,
      canRestore: recovered.length > 0,
      canDiscard: true,
      canRename: Boolean(record?.documents?.length),
      isCurrent: key === recoveryKey || key === 'latest',
      invalidCount: invalid.length,
    };
  }

  function normalizeRecoveryAction(value, fallbackKey = '') {
    if (typeof value === 'string') return { action:value, key:fallbackKey, confirmed:false };
    return {
      action: value?.action || 'later',
      key: value?.key || fallbackKey,
      name: typeof value?.name === 'string' ? value.name : '',
      confirmed: value?.confirmed === true,
    };
  }

  function reserveFreshKeyIfNeeded(entries) {
    if (entries.some(item => item.key === recoveryKey)) recoveryKey = createKey(true);
  }

  async function restoreRecoveryIfAvailable() {
    if (!recoveryStorageAvailable) return false;

    while (recoveryStorageAvailable) {
      let stored;
      try {
        const entries = await loadSnapshots({ includeInvalid:true });
        if (entries.some(item => item.key === recoveryKey && !item.record)) recoveryKey = createKey(true);
        stored = entries.slice().sort((a, b) => (b.record?.savedAt || 0) - (a.record?.savedAt || 0));
      } catch (error) {
        reportRecoveryFailure(error);
        return false;
      }
      if (!stored.length) return false;

      const prepared = stored.map(parseStoredEntry);
      const summaries = prepared.map(({ recovered, invalid, ...entry }) => entry);
      const modalResult = await showRecoveryModal(summaries);
      const action = normalizeRecoveryAction(modalResult, prepared[0]?.key);
      const selected = prepared.find(item => item.key === action.key) || prepared[0];

      if (action.action === 'later' || action.action === 'load-project') {
        reserveFreshKeyIfNeeded(stored);
        return false;
      }

      if (action.action === 'new-project') {
        reserveFreshKeyIfNeeded(stored);
        await startNewProject();
        return false;
      }

      if (action.action === 'rename') {
        const renamed = await renameRecovery(selected, action.name);
        toast(renamed ? 'Проект переименован' : 'Не удалось переименовать проект', renamed ? 'success' : 'error');
        if (!renamed) return false;
        continue;
      }

      if (action.action === 'discard') {
        const removed = await discardRecovery(selected.key, { allowForeign:action.confirmed });
        toast(removed ? 'Автосохранённый проект удалён' : 'Не удалось удалить автосохранённый проект', removed ? 'success' : 'error');
        if (!removed) return false;
        continue;
      }

      if (action.action !== 'restore' || !selected.canRestore) continue;

      unrestoredRecoveryDocuments = selected.invalid;
      if (selected.key !== recoveryKey && stored.some(item => item.key === recoveryKey)) recoveryKey = createKey(true);
      const nextSessions = selected.recovered.map(item => buildSession(item.doc, { label:'Автовосстановление', dirtyState:true }));
      const activeIndex = Math.max(0, selected.recovered.findIndex(item => item.index === selected.record.activeIndex));
      setSessions(nextSessions);
      setActiveSessionId(nextSessions[activeIndex].id);
      loadSession(nextSessions[activeIndex]);
      updateAll();
      markDirty(true);
      setStatus('Проект восстановлен из автосохранения');
      toast('Документы восстановлены. Сохраните каждый через Ctrl+S.', 'success');
      return true;
    }
    return false;
  }

  return {
    queueRecovery,
    discardRecovery,
    restoreRecoveryIfAvailable,
    getRecoveryKey: () => recoveryKey,
    isStorageAvailable: () => recoveryStorageAvailable,
    whenIdle: () => recoveryWritePromise,
  };
}
