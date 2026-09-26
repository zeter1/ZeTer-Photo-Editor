const RECOVERY_DB_NAME = 'zeter-photo-editor';
const RECOVERY_STORE_NAME = 'recovery';
const RECOVERY_KEY = 'latest';
export const RECOVERY_RECORD_VERSION = 2;

function requestResult(request, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Операция локального хранилища не ответила вовремя'));
    }, timeoutMs);
    request.onsuccess = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(request.error || new Error('Ошибка локального хранилища'));
    };
  });
}

function transactionDone(transaction, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Транзакция локального хранилища не завершилась вовремя'));
    }, timeoutMs);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error); else resolve();
    };
    transaction.oncomplete = () => finish();
    transaction.onabort = () => finish(transaction.error || new Error('Операция локального хранилища отменена'));
    transaction.onerror = () => finish(transaction.error || new Error('Ошибка локального хранилища'));
  });
}

async function openRecoveryDatabase(indexedDBFactory = globalThis.indexedDB) {
  if (!indexedDBFactory?.open) throw new Error('IndexedDB недоступен в этом браузере');
  const request = indexedDBFactory.open(RECOVERY_DB_NAME, 1);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(RECOVERY_STORE_NAME)) database.createObjectStore(RECOVERY_STORE_NAME);
  };
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Локальное хранилище автосохранения не ответило вовремя'));
    }, 750);
    request.onsuccess = () => {
      if (settled) { request.result?.close?.(); return; }
      settled = true;
      clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(request.error || new Error('Ошибка локального хранилища'));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error('Локальное хранилище автосохранения заблокировано другой вкладкой'));
    };
  });
}

export function makeRecoveryRecord(snapshots, doc = {}, savedAt = Date.now()) {
  const input = Array.isArray(snapshots) ? snapshots : [{ snapshot: snapshots, ...doc }];
  if (!input.length || input.some(item => typeof item?.snapshot !== 'string' || !item.snapshot.trim())) {
    throw new Error('Пустой снимок автосохранения');
  }
  return {
    version: RECOVERY_RECORD_VERSION,
    savedAt: Number.isFinite(Number(savedAt)) ? Number(savedAt) : Date.now(),
    activeIndex: Math.min(Math.max(0, Number(doc?.activeIndex) || 0), input.length - 1),
    documents: input.map(item => ({
      docName: String(item?.docName || item?.name || 'Без имени').slice(0, 240),
      modifiedAt: typeof item?.modifiedAt === 'string' ? item.modifiedAt : '',
      snapshot: item.snapshot,
    })),
  };
}

export function normalizeRecoveryRecord(value) {
  if (!value || ![1, RECOVERY_RECORD_VERSION].includes(value.version)) return null;
  const savedAt = Number(value.savedAt);
  if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
  const documents = value.version === 1 ? [value] : value.documents;
  if (!Array.isArray(documents) || !documents.length) return null;
  const validDocuments = documents.map((item, index) => ({ item, index }))
    .filter(({ item }) => typeof item?.snapshot === 'string' && item.snapshot.trim());
  if (!validDocuments.length) return null;
  const originalActiveIndex = Number(value.activeIndex);
  const activeIndex = Number.isInteger(originalActiveIndex)
    ? Math.max(0, validDocuments.findIndex(({ index }) => index === originalActiveIndex)) : 0;
  return {
    version: RECOVERY_RECORD_VERSION, savedAt,
    activeIndex,
    documents: validDocuments.map(({ item }) => ({
      docName: String(item.docName || 'Без имени').slice(0, 240),
      modifiedAt: typeof item.modifiedAt === 'string' ? item.modifiedAt : '',
      snapshot: item.snapshot,
    })),
  };
}

export async function saveRecoverySnapshot(snapshot, doc, {
  indexedDBFactory = globalThis.indexedDB,
  key = RECOVERY_KEY,
  savedAt = Date.now(),
} = {}) {
  const database = await openRecoveryDatabase(indexedDBFactory);
  try {
    const transaction = database.transaction(RECOVERY_STORE_NAME, 'readwrite');
    transaction.objectStore(RECOVERY_STORE_NAME).put(makeRecoveryRecord(snapshot, doc, savedAt), key);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function loadRecoverySnapshot({ indexedDBFactory = globalThis.indexedDB } = {}) {
  const database = await openRecoveryDatabase(indexedDBFactory);
  try {
    const transaction = database.transaction(RECOVERY_STORE_NAME, 'readonly');
    const request = transaction.objectStore(RECOVERY_STORE_NAME).get(RECOVERY_KEY);
    const [value] = await Promise.all([requestResult(request), transactionDone(transaction)]);
    return normalizeRecoveryRecord(value);
  } finally {
    database.close();
  }
}

export async function loadRecoverySnapshots({ indexedDBFactory = globalThis.indexedDB, includeInvalid = false } = {}) {
  const database = await openRecoveryDatabase(indexedDBFactory);
  try {
    const transaction = database.transaction(RECOVERY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(RECOVERY_STORE_NAME);
    const keysRequest = store.getAllKeys();
    const recordsRequest = store.getAll();
    const [[keys, records]] = await Promise.all([
      Promise.all([requestResult(keysRequest), requestResult(recordsRequest)]),
      transactionDone(transaction),
    ]);
    const entries = keys.map((key, index) => ({ key, record: normalizeRecoveryRecord(records[index]) }));
    return includeInvalid ? entries : entries.filter(item => item.record);
  } finally {
    database.close();
  }
}

export async function clearRecoverySnapshot({ indexedDBFactory = globalThis.indexedDB, key = RECOVERY_KEY } = {}) {
  const database = await openRecoveryDatabase(indexedDBFactory);
  try {
    const transaction = database.transaction(RECOVERY_STORE_NAME, 'readwrite');
    transaction.objectStore(RECOVERY_STORE_NAME).delete(key);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}