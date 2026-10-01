export function createProjectController({
  documentState = {},
  io = {},
  smartObjects = {},
  recovery = {},
  view = {},
  ui = {},
} = {}) {
  const {
    getDocument,
    getActiveSessionId,
    getHistoryEntry,
    getDocumentChangeSerial,
    canReplaceDocument,
    blockPendingDocumentEdit,
    sanitizeProject,
    replaceHistory,
    setDocument,
    markDirty,
    getCurrentSession,
  } = documentState;
  const { readFileAsText, downloadText, safeFilename } = io;
  const { saveContent: saveSmartObjectContent } = smartObjects;
  const { queueRecovery } = recovery;
  const { fitToView } = view;
  const { setStatus, toast, alertUser, consoleRef = console } = ui;
  let openProjectGeneration = 0;

  function captureOpenOwner() {
    return {
      document: getDocument(),
      sessionId: getActiveSessionId(),
      historyEntry: getHistoryEntry(),
      changeSerial: getDocumentChangeSerial(),
    };
  }

  function openOwnerIsCurrent(owner) {
    return getDocument() === owner.document &&
      getActiveSessionId() === owner.sessionId &&
      getHistoryEntry() === owner.historyEntry &&
      getDocumentChangeSerial() === owner.changeSerial;
  }

  async function openProject(file) {
    if (blockPendingDocumentEdit()) return;
    if (!canReplaceDocument()) return;
    const owner = captureOpenOwner();
    const generation = ++openProjectGeneration;
    try {
      const raw = await readFileAsText(file);
      if (generation !== openProjectGeneration) return;
      const data = sanitizeProject(JSON.parse(raw));
      if (!openOwnerIsCurrent(owner)) {
        setStatus('Открытие отменено: документ изменился во время чтения файла');
        toast('Повторите открытие проекта в нужной вкладке', 'warn');
        return;
      }
      if (blockPendingDocumentEdit()) return;
      replaceHistory();
      setDocument(data, { resetHistory:true, label:'Открыть проект' });
      markDirty(false);
      queueRecovery({ immediate:true });
      fitToView();
      setStatus('Проект открыт');
      toast('Открыт проект: ' + file.name, 'success');
    } catch (error) {
      if (generation !== openProjectGeneration) return;
      consoleRef.error(error);
      alertUser('Не удалось открыть проект: ' + error.message);
      setStatus('Ошибка открытия проекта');
    }
  }

  function saveProject() {
    if (blockPendingDocumentEdit()) return;
    const session = getCurrentSession();
    if (session?.smartObjectLink) {
      saveSmartObjectContent(session);
      return;
    }
    const documentValue = getDocument();
    const name = `${safeFilename(documentValue.name)}.zpe`;
    downloadText(JSON.stringify(documentValue, null, 2), name, 'application/json');
    queueRecovery({ immediate:true });
    setStatus(`Скачивание ${name} запущено. Проверьте файл перед закрытием вкладки`);
  }

  return { openProject, saveProject };
}
