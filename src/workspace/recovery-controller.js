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
  const showRecoveryModal = ui.showRecoveryModal || (async () => 'later');
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

  function discardRecovery(key = recoveryKey) {
    cancelPendingWrite();
    if (!recoveryStorageAvailable) return Promise.resolve(false);
    recoveryWritePromise = recoveryWritePromise
      .catch(() => {})
      .then(() => clearSnapshot({ key }))
      .then(() => {
        unrestoredRecoveryDocuments = [];
        return true;
      })
      .catch(error => {
        consoleRef?.warn?.('Could not clear recovery snapshot', error);
        return false;
      });
    return recoveryWritePromise;
  }

  async function restoreRecoveryIfAvailable() {
    if (!recoveryStorageAvailable) return false;
    let stored;
    try {
      const entries = await loadSnapshots({ includeInvalid:true });
      if (entries.some(item => item.key === recoveryKey && !item.record)) recoveryKey = createKey(true);
      stored = entries.filter(item => item.record);
    } catch (error) {
      reportRecoveryFailure(error);
      return false;
    }
    if (!stored.length) return false;

    stored.sort((a, b) => b.record.savedAt - a.record.savedAt);
    for (const { key, record } of stored) {
      const recovered = [];
      const invalid = [];
      record.documents.forEach((item, index) => {
        try {
          recovered.push({ doc:sanitizeProject(JSON.parse(item.snapshot)), index });
        } catch (error) {
          invalid.push(item);
          consoleRef?.warn?.('Invalid recovery document was preserved in storage', error);
        }
      });

      const canDiscard = key === recoveryKey || key === 'latest';
      const action = await showRecoveryModal(record, { canRestore:recovered.length > 0, canDiscard });
      if (action === 'later') {
        if (key === recoveryKey) recoveryKey = createKey(true);
        continue;
      }
      if (action === 'discard') {
        if (!canDiscard) {
          consoleRef?.warn?.('Ignored recovery discard request for another editor window', { key });
          continue;
        }
        const removed = await discardRecovery(key);
        toast(removed ? 'Автосохранённая копия удалена' : 'Не удалось удалить автокопию', removed ? 'success' : 'error');
        if (!removed) return false;
        continue;
      }
      if (action !== 'restore' || !recovered.length) continue;

      unrestoredRecoveryDocuments = invalid;
      if (key !== recoveryKey && stored.some(item => item.key === recoveryKey)) recoveryKey = createKey(true);
      const nextSessions = recovered.map(item => buildSession(item.doc, { label:'Автовосстановление', dirtyState:true }));
      const activeIndex = Math.max(0, recovered.findIndex(item => item.index === record.activeIndex));
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
