import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOVERY_DEBOUNCE_MS,
  createRecoveryController,
  createRecoveryWindowKey,
} from '../src/workspace/recovery-controller.js';

function makeRecord(documents, { savedAt = 100, activeIndex = 0 } = {}) {
  return { savedAt, activeIndex, documents };
}

function createHarness({
  records = [],
  sessions: initialSessions = [],
  activeId = initialSessions[0]?.id || '',
  modal = async () => 'later',
  createKey = forceNew => forceNew ? 'workspace:new' : 'workspace:own',
  save,
  clear,
  sanitize = value => value,
  snapshot = value => JSON.stringify(value),
  setTimeoutFn,
  clearTimeoutFn,
} = {}) {
  let allSessions = initialSessions;
  let currentActiveId = activeId;
  const calls = { saves:[], clears:[], loaded:[], statuses:[], toasts:[], warnings:[], dirty:0, updates:0, syncs:0 };
  const controller = createRecoveryController({
    storage: {
      save: save || (async (documents, options, config) => { calls.saves.push({ documents, options, config }); }),
      loadAll: async () => records,
      clear: clear || (async config => { calls.clears.push(config); }),
    },
    projects: { snapshot, sanitize },
    sessions: {
      getAll: () => allSessions,
      replaceAll: value => { allSessions = value; },
      getActiveId: () => currentActiveId,
      setActiveId: value => { currentActiveId = value; },
      syncCurrent: () => { calls.syncs += 1; },
      build: (doc, options) => ({ id:`session-${doc.name}`, doc, dirty:options?.dirtyState ?? false }),
      load: session => { calls.loaded.push(session.id); },
    },
    runtime: {
      updateAll: () => { calls.updates += 1; },
      markDirty: () => { calls.dirty += 1; },
    },
    ui: {
      showRecoveryModal: modal,
      setStatus: value => calls.statuses.push(value),
      toast: (message, type) => calls.toasts.push([message, type]),
    },
    createKey,
    setTimeoutFn,
    clearTimeoutFn,
    consoleRef: { warn: (...args) => calls.warnings.push(args) },
  });
  return {
    controller,
    calls,
    sessions: () => allSessions,
    activeId: () => currentActiveId,
  };
}

test('recovery window key reuses reload identity and rotates when forced', () => {
  const saved = new Map([['zeter-photo-editor.recovery-window.v1', 'workspace:previous']]);
  const options = {
    cryptoRef: { randomUUID: () => 'new-id' },
    sessionStorageRef: {
      getItem: key => saved.get(key),
      setItem: (key, value) => saved.set(key, value),
    },
    performanceRef: { getEntriesByType: () => [{ type:'reload' }] },
  };
  assert.equal(createRecoveryWindowKey(options), 'workspace:previous');
  assert.equal(createRecoveryWindowKey({ ...options, forceNew:true }), 'workspace:new-id');
  assert.equal(saved.get('zeter-photo-editor.recovery-window.v1'), 'workspace:new-id');
});

test('recovery queue debounces stale writes and snapshots all dirty tabs atomically', async () => {
  const timers = new Map();
  let timerId = 0;
  const a = { id:'a', dirty:true, doc:{ name:'A', modifiedAt:'1', value:1 } };
  const b = { id:'b', dirty:true, doc:{ name:'B', modifiedAt:'2', value:2 } };
  const { controller, calls } = createHarness({
    sessions:[a,b],
    activeId:'b',
    setTimeoutFn: handler => { const id=++timerId; timers.set(id,handler); return id; },
    clearTimeoutFn: id => timers.delete(id),
  });

  controller.queueRecovery();
  controller.queueRecovery();
  assert.equal(timers.size, 1);
  const [handler] = timers.values();
  handler();
  await controller.whenIdle();

  assert.equal(calls.syncs, 1);
  assert.equal(calls.saves.length, 1);
  assert.deepEqual(calls.saves[0].documents.map(item => item.name), ['A','B']);
  assert.deepEqual(calls.saves[0].options, { activeIndex:1 });
  assert.deepEqual(calls.saves[0].config, { key:'workspace:own' });
});

test('restore preserves malformed siblings in the next workspace snapshot', async () => {
  const record = makeRecord([
    { docName:'Broken', modifiedAt:'', snapshot:'{broken' },
    { docName:'Good', modifiedAt:'', snapshot:'{"name":"Good","value":2}' },
  ], { activeIndex:1 });
  const harness = createHarness({
    records:[{ key:'workspace:own', record }],
    modal: async () => 'restore',
    sanitize: value => value,
  });

  assert.equal(await harness.controller.restoreRecoveryIfAvailable(), true);
  harness.controller.queueRecovery({ immediate:true });
  await harness.controller.whenIdle();

  assert.deepEqual(harness.sessions().map(session => session.doc.name), ['Good']);
  assert.equal(harness.calls.dirty, 1);
  assert.deepEqual(harness.calls.saves.at(-1).documents.map(item => item.docName || item.name), ['Broken','Good']);
  assert.equal(harness.calls.saves.at(-1).options.activeIndex, 1);
});

test('unsupported record under the reused window key rotates identity without restoring', async () => {
  const generated = [];
  const { controller } = createHarness({
    records:[{ key:'workspace:own', record:null }],
    createKey: forceNew => { generated.push(forceNew); return forceNew ? 'workspace:fresh' : 'workspace:own'; },
  });
  assert.equal(await controller.restoreRecoveryIfAvailable(), false);
  assert.equal(controller.getRecoveryKey(), 'workspace:fresh');
  assert.deepEqual(generated, [false, true]);
});

test('foreign recovery cannot be discarded even if the UI returns an invalid discard action', async () => {
  const foreign = makeRecord([{ docName:'Other', snapshot:'{"name":"Other"}' }], { savedAt:200 });
  const { controller, calls } = createHarness({
    records:[{ key:'workspace:other', record:foreign }],
    modal: async () => 'discard',
  });
  assert.equal(await controller.restoreRecoveryIfAvailable(), false);
  assert.deepEqual(calls.clears, []);
  assert.equal(calls.warnings.some(args => String(args[0]).includes('another editor window')), true);
});

test('public discard refuses a foreign recovery key', async () => {
  const { controller, calls } = createHarness();
  assert.equal(await controller.discardRecovery('workspace:other'), false);
  assert.deepEqual(calls.clears, []);
  assert.equal(calls.warnings.some(args => String(args[0]).includes('another editor window')), true);
});

test('newer foreign recovery rotates before publish so an unseen own copy is not overwritten', async () => {
  const own = makeRecord([{ docName:'A', snapshot:'{"name":"A"}' }], { savedAt:100 });
  const foreign = makeRecord([{ docName:'B', snapshot:'{"name":"B"}' }], { savedAt:200 });
  const writes = new Map([['workspace:own','A'], ['workspace:other','B']]);
  let keyCounter = 0;
  const harness = createHarness({
    records:[{ key:'workspace:own', record:own }, { key:'workspace:other', record:foreign }],
    modal: async record => record.documents[0].docName === 'B' ? 'restore' : 'later',
    createKey: forceNew => forceNew ? `workspace:new-${++keyCounter}` : 'workspace:own',
    save: async (documents, options, config) => {
      writes.set(config.key, documents.map(item => item.name || item.docName).join(','));
    },
  });

  assert.equal(await harness.controller.restoreRecoveryIfAvailable(), true);
  harness.controller.queueRecovery({ immediate:true });
  await harness.controller.whenIdle();

  assert.match(harness.controller.getRecoveryKey(), /^workspace:new-/);
  assert.equal(writes.get('workspace:own'), 'A');
  assert.equal(writes.get(harness.controller.getRecoveryKey()), 'B');
});

test('discard is serialized after a pending save', async () => {
  const order = [];
  let releaseSave;
  const saveGate = new Promise(resolve => { releaseSave = resolve; });
  const { controller } = createHarness({
    sessions:[{ id:'a', dirty:true, doc:{ name:'A' } }],
    save: async () => { order.push('save:start'); await saveGate; order.push('save:end'); },
    clear: async () => { order.push('clear'); },
  });

  controller.queueRecovery({ immediate:true });
  const discardPromise = controller.discardRecovery();
  await Promise.resolve();
  assert.deepEqual(order, ['save:start']);
  releaseSave();
  assert.equal(await discardPromise, true);
  assert.deepEqual(order, ['save:start','save:end','clear']);
});

test('storage write failure disables repeated autosave and notifies once', async () => {
  let attempts = 0;
  const { controller, calls } = createHarness({
    sessions:[{ id:'a', dirty:true, doc:{ name:'A' } }],
    save: async () => { attempts += 1; throw new Error('storage blocked'); },
  });
  controller.queueRecovery({ immediate:true });
  await controller.whenIdle();
  controller.queueRecovery({ immediate:true });
  await controller.whenIdle();

  assert.equal(attempts, 1);
  assert.equal(controller.isStorageAvailable(), false);
  assert.equal(calls.toasts.filter(([,type]) => type === 'warn').length, 1);
});

test('default recovery debounce remains intentionally short', () => {
  assert.equal(RECOVERY_DEBOUNCE_MS, 1500);
});
