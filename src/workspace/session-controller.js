import { HistoryStack } from '../core/history.js';
import { createDocument, snapshotDocument, restoreDocument, touch } from '../core/state.js';

export function createDocumentSessionController({
  getSessions,
  getActiveSessionId,
  setActiveSessionId,
  getRuntimeState,
  applyRuntimeState,
  cloneSelectionShape,
  tabs = null,
  viewport = null,
  blockPendingDocumentEdit = () => false,
  updateAll = () => {},
  fitToView = () => {},
  setStatus = () => {},
  toast = () => {},
  queueRecovery = () => {},
  showModal = () => {},
  commit = () => {},
  openContextMenu = () => {},
} = {}) {
  let nextSessionNumber = 1;
  const sessions = () => getSessions?.() || [];
  const activeId = () => getActiveSessionId?.() || '';
  const cloneRect = rect => rect ? { ...rect } : null;

  function createSessionId() {
    return `doc-session-${nextSessionNumber++}`;
  }

  function createUntitledName() {
    const used = new Set(sessions().map(session => String(session.doc?.name || '').trim()).filter(Boolean));
    if (!used.has('Без имени')) return 'Без имени';
    let index = 2;
    while (used.has(`Без имени ${index}`)) index += 1;
    return `Без имени ${index}`;
  }

  function currentSession() {
    return sessions().find(session => session.id === activeId()) || null;
  }

  function syncCurrentSession() {
    const session = currentSession();
    const runtime = getRuntimeState?.();
    if (!session || !runtime) return;
    session.doc = runtime.doc;
    session.history = runtime.history;
    session.zoom = runtime.zoom;
    session.dirty = runtime.dirty;
    session.cropRect = cloneRect(runtime.cropRect);
    session.selectionRect = cloneRect(runtime.selectionRect);
    session.selectionShape = cloneSelectionShape?.(runtime.selectionShape) || null;
    session.selectedPathIndex = runtime.selectedDocumentPathIndex;
  }

  function loadSession(session) {
    if (!session) return;
    const selectionRect = cloneRect(session.selectionRect);
    applyRuntimeState?.({
      doc: session.doc,
      history: session.history,
      zoom: session.zoom,
      dirty: session.dirty,
      cropRect: cloneRect(session.cropRect),
      selectionRect,
      selectionShape: cloneSelectionShape?.(session.selectionShape)
        || (selectionRect ? { type:'rect', rect:cloneRect(selectionRect) } : null),
      selectedPathIndex: Number.isInteger(session.selectedPathIndex) ? session.selectedPathIndex : -1,
    });
  }

  function buildSession(documentValue, {
    label = 'Новый документ',
    zoomLevel = 0.75,
    dirtyState = false,
    smartObjectLink = null,
  } = {}) {
    const sessionHistory = new HistoryStack(80);
    sessionHistory.reset(label, snapshotDocument(documentValue));
    return {
      id: createSessionId(),
      doc: documentValue,
      history: sessionHistory,
      zoom: zoomLevel,
      dirty: dirtyState,
      smartObjectLink: smartObjectLink ? { ...smartObjectLink } : null,
      cropRect: null,
      selectionRect: null,
      selectionShape: null,
      selectedPathIndex: -1,
    };
  }

  function renderDocumentTabs() {
    if (!tabs) return;
    const allSessions = sessions();
    tabs.replaceChildren();
    allSessions.forEach(session => {
      const shell = document.createElement('div');
      shell.className = `doc-tab-shell${session.id === activeId() ? ' active' : ''}`;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'doc-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(session.id === activeId()));
      button.title = session.smartObjectLink
        ? `Содержимое смарт-объекта · ${session.doc?.name || 'Без имени'}`
        : (session.doc?.name || 'Без имени');

      const title = document.createElement('span');
      title.className = 'doc-tab-title';
      title.textContent = `${session.smartObjectLink ? '◇ ' : ''}${session.doc?.name || 'Без имени'}`;
      button.append(title);

      const dot = document.createElement('span');
      dot.className = 'dirty-dot';
      dot.textContent = '●';
      dot.hidden = !session.dirty;
      button.append(dot);

      button.addEventListener('click', () => activateDocumentTab(session.id, { focusViewport:true }));

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'doc-tab-close';
      close.textContent = '×';
      close.title = `Закрыть вкладку «${session.doc?.name || 'Без имени'}»`;
      close.hidden = allSessions.length <= 1;
      close.addEventListener('click', event => {
        event.stopPropagation();
        closeDocumentTab(session.id);
      });

      shell.append(button, close);
      shell.addEventListener('contextmenu', event => {
        event.preventDefault();
        openContextMenu(`tab:${session.id}`, documentTabMenu(session.id), event, button);
      });
      tabs.append(shell);
    });
  }

  function activateDocumentTab(id, { focusViewport = false } = {}) {
    if (!id || id === activeId()) {
      if (focusViewport) requestAnimationFrame(() => viewport?.focus());
      return;
    }
    if (blockPendingDocumentEdit()) return;
    syncCurrentSession();
    const session = sessions().find(item => item.id === id);
    if (!session) return;
    setActiveSessionId(session.id);
    loadSession(session);
    updateAll();
    if (focusViewport) requestAnimationFrame(() => viewport?.focus());
    setStatus(`Вкладка: ${session.doc?.name || 'Без имени'}`);
  }

  function addDocumentTab({
    name = createUntitledName(),
    width = 1200,
    height = 800,
    background = 'transparent',
  } = {}) {
    if (blockPendingDocumentEdit()) return;
    syncCurrentSession();
    const sessionDoc = createDocument({ name, width, height, background });
    const session = buildSession(sessionDoc);
    sessions().push(session);
    setActiveSessionId(session.id);
    loadSession(session);
    updateAll();
    fitToView();
    setStatus(`Создана вкладка «${session.doc.name}»`);
    toast('Новая вкладка создана', 'success');
  }

  function closeDocumentTab(id) {
    if (blockPendingDocumentEdit()) return;
    const allSessions = sessions();
    const index = allSessions.findIndex(session => session.id === id);
    if (index === -1) return;
    syncCurrentSession();
    const session = allSessions[index];
    const childSessions = allSessions.filter(item => item.smartObjectLink?.parentSessionId === session.id);
    if (childSessions.length) {
      const message = 'Сначала закройте вкладки содержимого смарт-объектов этого документа';
      setStatus(message);
      toast(message, 'warn');
      return;
    }
    if (session.dirty && !window.confirm(`Во вкладке «${session.doc?.name || 'Без имени'}» есть несохранённые изменения. Закрыть её?`)) return;
    allSessions.splice(index, 1);
    if (!allSessions.length) allSessions.push(buildSession(createDocument({ name:'Без имени' })));
    const nextIndex = Math.max(0, Math.min(index, allSessions.length - 1));
    setActiveSessionId(allSessions[nextIndex].id);
    loadSession(allSessions[nextIndex]);
    updateAll();
    queueRecovery({ immediate:true });
    setStatus(`Закрыта вкладка «${session.doc?.name || 'Без имени'}»`);
  }

  function renameDocumentTab(id) {
    if (blockPendingDocumentEdit()) return;
    const session = sessions().find(item => item.id === id);
    if (!session) return;
    showModal({
      title:'Переименовать вкладку',
      fields:[{name:'name',label:'Имя',value:session.doc.name,required:true}],
      submitLabel:'Переименовать',
      onSubmit:values => {
        if (blockPendingDocumentEdit()) return false;
        const target = sessions().find(item => item.id === id);
        const name = String(values.name || '').trim();
        if (!target || !name || name === target.doc.name) return;
        target.doc.name = name;
        if (id === activeId()) commit('Переименовать вкладку');
        else {
          touch(target.doc);
          target.history.push('Переименовать вкладку', snapshotDocument(target.doc));
          target.dirty = true;
          renderDocumentTabs();
          queueRecovery();
        }
        setStatus(`Вкладка переименована: ${name}`);
      },
    });
  }

  function duplicateDocumentTab(id) {
    if (blockPendingDocumentEdit()) return;
    syncCurrentSession();
    const allSessions = sessions();
    const index = allSessions.findIndex(item => item.id === id);
    if (index < 0) return;
    const copy = restoreDocument(snapshotDocument(allSessions[index].doc));
    copy.name = `${copy.name} — копия`;
    const session = buildSession(copy, {
      label:'Копия вкладки',
      zoomLevel:allSessions[index].zoom,
      dirtyState:true,
    });
    allSessions.splice(index + 1, 0, session);
    renderDocumentTabs();
    queueRecovery();
    setStatus(`Создана копия вкладки «${copy.name}»`);
  }

  function documentTabMenu(id) {
    const exists = () => sessions().some(item => item.id === id);
    return [
      ['Открыть вкладку','',() => activateDocumentTab(id, { focusViewport:true }),exists],
      ['Переименовать…','',() => renameDocumentTab(id),exists],
      ['Дублировать','',() => duplicateDocumentTab(id),exists],
      ['sep'],
      ['Новая вкладка','',() => addDocumentTab()],
      ['Закрыть вкладку','',() => closeDocumentTab(id),exists],
    ];
  }

  return {
    currentSession,
    syncCurrentSession,
    loadSession,
    buildSession,
    renderDocumentTabs,
    activateDocumentTab,
    addDocumentTab,
    closeDocumentTab,
    renameDocumentTab,
    duplicateDocumentTab,
    documentTabMenu,
  };
}
