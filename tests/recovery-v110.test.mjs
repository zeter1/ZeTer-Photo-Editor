import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  makeRecoveryRecord,
  normalizeRecoveryRecord,
  RECOVERY_RECORD_VERSION,
  saveRecoverySnapshot,
  loadRecoverySnapshot,
  loadRecoverySnapshots,
  clearRecoverySnapshot,
} from '../src/core/recovery.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const modalController = await readFile(new URL('../src/ui/modal-controller.js', import.meta.url), 'utf8');
const textEditController = await readFile(new URL('../src/ui/text-edit-controller.js', import.meta.url), 'utf8');
const sessions = await readFile(new URL('../src/workspace/session-controller.js', import.meta.url), 'utf8');
const workspaceRecovery = await readFile(new URL('../src/workspace/recovery-controller.js', import.meta.url), 'utf8');
const build = await readFile(new URL('../tools/build-bundle.mjs', import.meta.url), 'utf8');
const recovery = await readFile(new URL('../src/core/recovery.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

function createFakeIndexedDB() {
  const values = new Map();
  const factory = {
    open() {
      const request = {};
      queueMicrotask(() => {
        const database = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          close() {},
          transaction() {
            const transaction = {};
            let pending = 0;
            const schedule = work => {
              pending++;
              queueMicrotask(() => {
                work();
                pending--;
                if (!pending) queueMicrotask(() => transaction.oncomplete?.());
              });
            };
            transaction.objectStore = () => ({
              put(value, key) { schedule(() => values.set(key, structuredClone(value))); },
              get(key) {
                const getRequest = {};
                schedule(() => {
                  getRequest.result = structuredClone(values.get(key));
                  getRequest.onsuccess?.();
                });
                return getRequest;
              },
              getAllKeys() {
                const getRequest = {};
                schedule(() => { getRequest.result = [...values.keys()]; getRequest.onsuccess?.(); });
                return getRequest;
              },
              getAll() {
                const getRequest = {};
                schedule(() => {
                  getRequest.result = [...values.values()].map(value => structuredClone(value));
                  getRequest.onsuccess?.();
                });
                return getRequest;
              },
              delete(key) { schedule(() => values.delete(key)); },
            });
            return transaction;
          },
        };
        request.result = database;
        request.onsuccess?.();
      });
      return request;
    },
  };
  return { factory, values };
}

test('recovery records reject malformed or unsupported payloads', () => {
  const record = makeRecoveryRecord('{"version":1}', { name:'Проект', modifiedAt:'2026-09-21T12:00:00.000Z' }, 12345);
  assert.equal(record.version, RECOVERY_RECORD_VERSION);
  assert.equal(record.documents[0].docName, 'Проект');
  assert.equal(record.savedAt, 12345);
  assert.equal(normalizeRecoveryRecord(record)?.documents[0].snapshot, '{"version":1}');
  assert.deepEqual(normalizeRecoveryRecord({ version:1, savedAt:12345, docName:'Старый', snapshot:'{"version":1}' }).documents, [
    { docName:'Старый', modifiedAt:'', snapshot:'{"version":1}' },
  ]);
  assert.equal(normalizeRecoveryRecord({ ...record, version:999 }), null);
  assert.equal(normalizeRecoveryRecord({ ...record, documents:[{ snapshot:'' }] }), null);
  assert.equal(normalizeRecoveryRecord({ ...record, savedAt:0 }), null);
  const filtered = normalizeRecoveryRecord({
    ...record,
    activeIndex:1,
    documents:[{ snapshot:'' }, { docName:'A', snapshot:'a' }, { docName:'B', snapshot:'b' }],
  });
  assert.equal(filtered?.activeIndex, 0);
  assert.deepEqual(filtered?.documents.map(item => item.docName), ['A','B']);
});

test('IndexedDB recovery adapter round-trips and clears the latest snapshot', async () => {
  const { factory, values } = createFakeIndexedDB();
  await saveRecoverySnapshot('{"version":1,"layers":[]}', { name:'Demo', modifiedAt:'2026-09-21T12:00:00.000Z' }, { indexedDBFactory:factory, savedAt:777 });
  assert.equal(values.size, 1);
  const loaded = await loadRecoverySnapshot({ indexedDBFactory:factory });
  assert.equal(loaded?.documents[0].docName, 'Demo');
  assert.equal(loaded?.savedAt, 777);
  assert.equal(loaded?.documents[0].snapshot, '{"version":1,"layers":[]}');
  assert.equal((await loadRecoverySnapshots({ indexedDBFactory:factory }))[0].key, 'latest');
  await clearRecoverySnapshot({ indexedDBFactory:factory });
  assert.equal(values.size, 0);
  assert.equal(await loadRecoverySnapshot({ indexedDBFactory:factory }), null);
});

test('saving one document retains another dirty document in atomic workspace recovery', async () => {
  const { factory, values } = createFakeIndexedDB();
  const a = { name:'A', snapshot:'{"name":"A"}' };
  const b = { name:'B', snapshot:'{"name":"B"}' };
  await saveRecoverySnapshot([a,b], { activeIndex:1 }, { indexedDBFactory:factory });
  assert.equal((await loadRecoverySnapshot({ indexedDBFactory:factory })).documents.length, 2);
  await saveRecoverySnapshot([a], { activeIndex:0 }, { indexedDBFactory:factory });
  const afterSaveB = await loadRecoverySnapshot({ indexedDBFactory:factory });
  assert.equal(values.size, 1);
  assert.deepEqual(afterSaveB.documents.map(item => item.docName), ['A']);
  assert.equal(afterSaveB.documents[0].snapshot, a.snapshot);
});

test('separate editor windows cannot overwrite or clear each other recovery records', async () => {
  const { factory } = createFakeIndexedDB();
  await saveRecoverySnapshot('A', { name:'A' }, { indexedDBFactory:factory, key:'workspace:a' });
  await saveRecoverySnapshot('B', { name:'B' }, { indexedDBFactory:factory, key:'workspace:b' });
  assert.deepEqual((await loadRecoverySnapshots({ indexedDBFactory:factory })).map(item => item.record.documents[0].docName), ['A','B']);
  await clearRecoverySnapshot({ indexedDBFactory:factory, key:'workspace:b' });
  const remaining = await loadRecoverySnapshots({ indexedDBFactory:factory });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].record.documents[0].docName, 'A');
});

test('unsupported records remain visible to ownership checks without being restored', async () => {
  const { factory, values } = createFakeIndexedDB();
  values.set('workspace:old', { version:999, savedAt:100, snapshot:'future data' });
  assert.equal((await loadRecoverySnapshots({ indexedDBFactory:factory })).length, 0);
  const entries = await loadRecoverySnapshots({ indexedDBFactory:factory, includeInvalid:true });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, 'workspace:old');
  assert.equal(entries[0].record, null);
  assert.equal(values.has('workspace:old'), true);
});

test('autosave orchestration lives in workspace recovery controller', () => {
  assert.match(main, /from '\.\/workspace\/recovery-controller\.js'/);
  assert.match(main, /createRecoveryController\(\{/);
  assert.match(workspaceRecovery, /export const RECOVERY_DEBOUNCE_MS = 1500/);
  assert.match(workspaceRecovery, /getSessions\(\)\.filter\(session => session\?\.dirty\)/);
  assert.match(workspaceRecovery, /loadSnapshots\(\{ includeInvalid:true \}\)/);
  assert.match(workspaceRecovery, /saveSnapshot\(snapshots, \{ activeIndex \}, \{ key: recoveryKey \}\)/);
  assert.match(main, /if \(value\) queueRecovery\(\)/);
  assert.match(sessions, /queueRecovery\(\{ immediate:true \}\)/);
  assert.match(main, /visibilitychange/);
  assert.doesNotMatch(main, /localStorage\.setItem\([^\n]*snapshot/);
  assert.doesNotMatch(main, /function createRecoveryKey\(/);
  assert.doesNotMatch(main, /let recoveryWritePromise\b/);
  assert.match(build, /src\/workspace\/recovery-controller\.js/);
  assert.match(build, /src\/core\/recovery\.js/);
  assert.match(recovery, /setTimeout\(\(\) => \{[\s\S]*?не ответило вовремя[\s\S]*?\}, 750\)/);
});

test('recovery UI restores sanitized project data but keeps it dirty until explicit save', () => {
  assert.match(workspaceRecovery, /sanitizeProject\(JSON\.parse\(item\.snapshot\)\)/);
  assert.match(workspaceRecovery, /label:'Автовосстановление'/);
  assert.match(workspaceRecovery, /markDirty\(true\)/);
  assert.match(workspaceRecovery, /Ignored recovery discard request for another editor window/);
  assert.match(main, /function saveProject\(\)[^\n]*downloadText\([^\n]*queueRecovery\(\{immediate:true\}\)/);
  assert.doesNotMatch(main, /function saveProject\(\)[^\n]*markDirty\(false\)/);
});

test('new text and shape layers inherit the tool opacity like brush, fill, and line tools', () => {
  assert.match(main, /createShapeLayer\(\{[^}]*opacity:Number\(els\.toolOpacity\.value\)\/100/);
  assert.match(main, /getToolOpacity: \(\) => Number\(els\.toolOpacity\.value\) \/ 100/);
  assert.match(textEditController, /opacity: getToolOpacity\(\)/);
  assert.match(main, /name:'Линия'[\s\S]*?opacity:Number\(els\.toolOpacity\.value\)\/100/);
  assert.match(main, /function previewRect[\s\S]*?const opacity=Number\(els\.toolOpacity\.value\)\/100/);
  assert.match(css, /\.toast\.warn/);
  assert.doesNotMatch(modalController, /data-later/);
  assert.match(modalController, /Переименовать проект/);
  assert.match(modalController, /createRapidDoubleClickTracker/);
  assert.match(modalController, /event\.button !== 0/);
  assert.match(modalController, /trigger:'primary-double-click'/);
  assert.doesNotMatch(modalController, /event\.button !== 2|secondary-double-click/);
  assert.match(workspaceRecovery, /action\.action === 'rename'/);
  assert.match(workspaceRecovery, /savedAt:payload\.savedAt/);
  assert.match(modalController, /recovery-project-list/);
  assert.match(modalController, /Загрузить проект/);
  assert.match(modalController, /Начать новый проект/);
  assert.match(modalController, /Удалить проект/);
  assert.match(modalController, /Восстановить выбранный/);
  assert.match(css, /\.recovery-project\.selected/);
});
