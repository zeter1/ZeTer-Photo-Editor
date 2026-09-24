import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { makeRecoveryRecord, normalizeRecoveryRecord, RECOVERY_RECORD_VERSION, saveRecoverySnapshot, loadRecoverySnapshot, loadRecoverySnapshots, clearRecoverySnapshot } from '../src/core/recovery.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
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
              put(value, key) {
                schedule(() => values.set(key, structuredClone(value)));
              },
              get(key) {
                const getRequest = {};
                schedule(() => {
                  getRequest.result = structuredClone(values.get(key));
                  getRequest.onsuccess?.();
                });
                return getRequest;
              },
              getAllKeys() {
                const request = {};
                schedule(() => { request.result = [...values.keys()]; request.onsuccess?.(); });
                return request;
              },
              getAll() {
                const request = {};
                schedule(() => { request.result = [...values.values()].map(value => structuredClone(value)); request.onsuccess?.(); });
                return request;
              },
              delete(key) {
                schedule(() => values.delete(key));
              },
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
  const record = makeRecoveryRecord('{"version":1}', { name: 'Проект', modifiedAt: '2026-09-21T12:00:00.000Z' }, 12345);
  assert.equal(record.version, RECOVERY_RECORD_VERSION);
  assert.equal(record.documents[0].docName, 'Проект');
  assert.equal(record.savedAt, 12345);
  assert.equal(normalizeRecoveryRecord(record)?.documents[0].snapshot, '{"version":1}');
  assert.deepEqual(normalizeRecoveryRecord({ version:1, savedAt:12345, docName:'Старый', snapshot:'{"version":1}' }).documents, [
    { docName:'Старый', modifiedAt:'', snapshot:'{"version":1}' },
  ]);
  assert.equal(normalizeRecoveryRecord({ ...record, version: 999 }), null);
  assert.equal(normalizeRecoveryRecord({ ...record, documents:[{ snapshot:'' }] }), null);
  assert.equal(normalizeRecoveryRecord({ ...record, savedAt: 0 }), null);
  const filtered=normalizeRecoveryRecord({ ...record, activeIndex:1, documents:[{snapshot:''},{docName:'A',snapshot:'a'},{docName:'B',snapshot:'b'}] });
  assert.equal(filtered?.activeIndex,0);
  assert.deepEqual(filtered?.documents.map(item=>item.docName),['A','B']);
});



test('IndexedDB recovery adapter round-trips and clears the latest snapshot', async () => {
  const { factory, values } = createFakeIndexedDB();
  await saveRecoverySnapshot('{"version":1,"layers":[]}', { name: 'Demo', modifiedAt: '2026-09-21T12:00:00.000Z' }, { indexedDBFactory: factory });
  assert.equal(values.size, 1);
  const loaded = await loadRecoverySnapshot({ indexedDBFactory: factory });
  assert.equal(loaded?.documents[0].docName, 'Demo');
  assert.equal(loaded?.documents[0].snapshot, '{"version":1,"layers":[]}');
  assert.equal((await loadRecoverySnapshots({ indexedDBFactory:factory }))[0].key,'latest');
  await clearRecoverySnapshot({ indexedDBFactory: factory });
  assert.equal(values.size, 0);
  assert.equal(await loadRecoverySnapshot({ indexedDBFactory: factory }), null);
});

test('deferring recovery rotates a reused window key before later edits', () => {
  const saved=new Map([['zeter-photo-editor.recovery-window.v1','workspace:previous']]);
  const context={
    crypto:{randomUUID:()=> 'new-id'},
    sessionStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
    performance:{getEntriesByType:()=>[{type:'reload'}]},
    console,
  };
  const source=main.slice(main.indexOf('function createRecoveryKey('),main.indexOf('let recoveryKey = createRecoveryKey();'));
  runInNewContext(`${source}\nglobalThis.createRecoveryKey=createRecoveryKey;`,context);
  assert.equal(context.createRecoveryKey(),'workspace:previous');
  assert.equal(context.createRecoveryKey(true),'workspace:new-id');
  assert.equal(saved.get('zeter-photo-editor.recovery-window.v1'),'workspace:new-id');
  assert.match(main,/if\(key===recoveryKey\)recoveryKey=createRecoveryKey\(true\)/);
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
  assert.deepEqual(afterSaveB.documents.map(item=>item.docName), ['A']);
  assert.equal(afterSaveB.documents[0].snapshot, a.snapshot);
});

test('separate editor windows cannot overwrite or clear each other’s recovery records', async () => {
  const { factory } = createFakeIndexedDB();
  await saveRecoverySnapshot('A', { name:'A' }, { indexedDBFactory:factory, key:'workspace:a' });
  await saveRecoverySnapshot('B', { name:'B' }, { indexedDBFactory:factory, key:'workspace:b' });
  assert.deepEqual((await loadRecoverySnapshots({ indexedDBFactory:factory })).map(item=>item.record.documents[0].docName),['A','B']);
  await clearRecoverySnapshot({ indexedDBFactory:factory, key:'workspace:b' });
  const remaining=await loadRecoverySnapshots({ indexedDBFactory:factory });
  assert.equal(remaining.length,1);
  assert.equal(remaining[0].record.documents[0].docName,'A');
});

test('unsupported records remain visible to key ownership checks without being restored', async () => {
  const { factory, values } = createFakeIndexedDB();
  values.set('workspace:old',{version:999,savedAt:100,snapshot:'future data'});
  assert.equal((await loadRecoverySnapshots({indexedDBFactory:factory})).length,0);
  const entries=await loadRecoverySnapshots({indexedDBFactory:factory,includeInvalid:true});
  assert.equal(entries.length,1);
  assert.equal(entries[0].key,'workspace:old');
  assert.equal(entries[0].record,null);
  assert.equal(values.has('workspace:old'),true);
});

test('startup rotates away from an unsupported record under its reused key', async () => {
  const source=main.slice(main.indexOf('async function restoreRecoveryIfAvailable()'),main.indexOf('function canReplaceDocument()'));
  const context={
    recoveryStorageAvailable:true,recoveryKey:'workspace:old',
    loadRecoverySnapshots:async()=>[{key:'workspace:old',record:null}],
    createRecoveryKey:()=> 'workspace:new',
    reportRecoveryFailure:error=>{throw error;},
  };
  runInNewContext(`${source}\nglobalThis.restoreRecoveryIfAvailable=restoreRecoveryIfAvailable;`,context);
  assert.equal(await context.restoreRecoveryIfAvailable(),false);
  assert.equal(context.recoveryKey,'workspace:new');
});

test('controller refresh keeps other dirty tabs and an unrecoverable sibling', async () => {
  const writes=[];
  const a={ id:'a', dirty:true, doc:{ name:'A', modifiedAt:'', value:1 } };
  const b={ id:'b', dirty:true, doc:{ name:'B', modifiedAt:'', value:2 } };
  const context={
    recoveryStorageAvailable:true, recoveryGeneration:0, recoveryTimer:0,
    recoveryKey:'workspace:test',
    recoveryWritePromise:Promise.resolve(), documentSessions:[a,b], activeSessionId:'b',
    unrestoredRecoveryDocuments:[{ docName:'Повреждённый', snapshot:'{broken' }],
    cancelRecoveryTimer:()=>{context.recoveryGeneration++;},
    syncCurrentSession:()=>{}, snapshotDocument:JSON.stringify,
    saveRecoverySnapshot:async (docs, options)=>{writes.push({ names:Array.from(docs,item=>item.name||item.docName), activeIndex:options.activeIndex });},
    clearRecoverySnapshot:async ()=>{writes.push({ names:[] });},
    reportRecoveryFailure:error=>{throw error;},
  };
  const source=main.slice(main.indexOf('function queueRecovery('),main.indexOf('function discardRecovery('));
  runInNewContext(`${source}\nglobalThis.queueRecovery=queueRecovery;`,context);
  context.queueRecovery({immediate:true});
  await context.recoveryWritePromise;
  assert.deepEqual(writes.at(-1),{names:['Повреждённый','A','B'],activeIndex:2});
  b.dirty=false;
  context.queueRecovery({immediate:true});
  await context.recoveryWritePromise;
  assert.deepEqual(writes.at(-1),{names:['Повреждённый','A'],activeIndex:1});
});

test('recovery controller opens one window copy at a time and cannot discard another window', async () => {
  const source=main.slice(main.indexOf('async function restoreRecoveryIfAvailable()'),main.indexOf('function canReplaceDocument()'));
  const stored=[
    {key:'workspace:own',record:{savedAt:100,activeIndex:0,documents:[{docName:'A',snapshot:'{"name":"A"}'}]}},
    {key:'workspace:other',record:{savedAt:200,activeIndex:0,documents:[{docName:'B',snapshot:'{"name":"B"}'}]}},
  ];
  const shown=[];
  const deleted=[];
  const context={
    recoveryStorageAvailable:true, recoveryKey:'workspace:own', unrestoredRecoveryDocuments:[],
    loadRecoverySnapshots:async()=>[...stored], sanitizeProject:value=>value,
    showRecoveryModal:async (record,options)=>{shown.push([record.documents[0].docName,options.canDiscard]);return shown.length===1?'later':'discard';},
    discardRecovery:async key=>{deleted.push(key);return true;},
    createRecoveryKey:()=> 'workspace:fresh', console, toast:()=>{}, setStatus:()=>{},
  };
  runInNewContext(`${source}\nglobalThis.restoreRecoveryIfAvailable=restoreRecoveryIfAvailable;`,context);
  assert.equal(await context.restoreRecoveryIfAvailable(),false);
  assert.deepEqual(shown,[['B',false],['A',true]]);
  assert.deepEqual(deleted,['workspace:own']);

  const restored=[];
  const restoreContext={
    ...context, recoveryKey:'workspace:fresh',
    showRecoveryModal:async record=>{restored.push(record.documents.map(item=>item.docName));return 'restore';},
    buildSession:(doc)=>({id:`session-${doc.name}`,doc}),
    loadSession:()=>{}, updateAll:()=>{}, markDirty:()=>{},
    documentSessions:[],activeSessionId:'',
  };
  runInNewContext(`${source}\nglobalThis.restoreRecoveryIfAvailable=restoreRecoveryIfAvailable;`,restoreContext);
  assert.equal(await restoreContext.restoreRecoveryIfAvailable(),true);
  assert.deepEqual(restored,[['B']]);
  assert.deepEqual(Array.from(restoreContext.documentSessions,item=>item.doc.name),['B']);
});

test('restoring a newer foreign copy does not overwrite an unseen own copy', async () => {
  const queueSource=main.slice(main.indexOf('function queueRecovery('),main.indexOf('function discardRecovery('));
  const restoreSource=main.slice(main.indexOf('async function restoreRecoveryIfAvailable()'),main.indexOf('function canReplaceDocument()'));
  const stored=[
    {key:'workspace:own',record:{savedAt:100,activeIndex:0,documents:[{docName:'A',snapshot:'{"name":"A"}'}]}},
    {key:'workspace:other',record:{savedAt:200,activeIndex:0,documents:[{docName:'B',snapshot:'{"name":"B"}'}]}},
  ];
  const writes=new Map([['workspace:own','A'],['workspace:other','B']]);
  const context={
    recoveryStorageAvailable:true,recoveryKey:'workspace:own',unrestoredRecoveryDocuments:[],
    recoveryGeneration:0,recoveryTimer:0,recoveryWritePromise:Promise.resolve(),
    loadRecoverySnapshots:async()=>[...stored],sanitizeProject:value=>value,
    showRecoveryModal:async()=> 'restore',createRecoveryKey:()=> 'workspace:new',
    buildSession:doc=>({id:`session-${doc.name}`,doc,dirty:true}),
    loadSession:()=>{},updateAll:()=>{},setStatus:()=>{},toast:()=>{},console,
    documentSessions:[],activeSessionId:'',
    markDirty:()=>context.queueRecovery({immediate:true}),
    cancelRecoveryTimer:()=>{context.recoveryGeneration++;},
    syncCurrentSession:()=>{},snapshotDocument:JSON.stringify,
    saveRecoverySnapshot:async (docs,options,config)=>{writes.set(config.key,Array.from(docs,item=>item.name).join(','));},
    clearRecoverySnapshot:async()=>{throw new Error('Unexpected clear');},
    reportRecoveryFailure:error=>{throw error;},
  };
  runInNewContext(`${queueSource}\n${restoreSource}\nglobalThis.queueRecovery=queueRecovery;globalThis.restoreRecoveryIfAvailable=restoreRecoveryIfAvailable;`,context);
  assert.equal(await context.restoreRecoveryIfAvailable(),true);
  await context.recoveryWritePromise;
  assert.equal(context.recoveryKey,'workspace:new');
  assert.equal(writes.get('workspace:own'),'A');
  assert.equal(writes.get('workspace:new'),'B');
});

test('autosave is debounce-driven, uses IndexedDB recovery, and serializes discard after pending writes', () => {
  assert.match(main, /const RECOVERY_DEBOUNCE_MS = 1500/);
  assert.match(main, /documentSessions\.filter\(session => session\.dirty\)/);
  assert.match(main, /saveRecoverySnapshot\(snapshots, \{ activeIndex \}, \{ key: recoveryKey \}\)/);
  assert.match(main, /loadRecoverySnapshots\(\{includeInvalid:true\}\)/);
  assert.match(main, /if \(value\) queueRecovery\(\)/);
  assert.match(main, /queueRecovery\(\{ immediate: true \}\)/);
  assert.match(main, /visibilitychange/);
  assert.doesNotMatch(main, /localStorage\.setItem\([^\n]*snapshot/);
  assert.match(build, /src\/core\/recovery\.js/);
  assert.match(recovery, /setTimeout\(\(\) => \{[\s\S]*?не ответило вовремя[\s\S]*?\}, 750\)/);
});

test('recovery UI restores a sanitized project but keeps it dirty until an explicit save', () => {
  const restore = main.match(/async function restoreRecoveryIfAvailable\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(restore, /sanitizeProject\(JSON\.parse\(item\.snapshot\)\)/);
  assert.match(restore, /label:'Автовосстановление'/);
  assert.match(restore, /markDirty\(true\)/);
  assert.match(main, /function saveProject\(\)[^\n]*downloadText\([^\n]*queueRecovery\(\{immediate:true\}\)/);
  assert.doesNotMatch(main, /function saveProject\(\)[^\n]*markDirty\(false\)/);
});

test('new text and shape layers inherit the tool opacity like brush, fill, and line tools', () => {
  assert.match(main, /createShapeLayer\(\{[^}]*opacity:Number\(els\.toolOpacity\.value\)\/100/);
  assert.match(main, /createTextLayer\(\{[^}]*opacity:Number\(els\.toolOpacity\.value\)\/100/);
  assert.match(main, /name:'Линия'[\s\S]*?opacity:Number\(els\.toolOpacity\.value\)\/100/);
  assert.match(main, /function previewRect[\s\S]*?const opacity=Number\(els\.toolOpacity\.value\)\/100/);
  assert.match(css, /\.toast\.warn/);
  assert.match(main, /data-later/);
});