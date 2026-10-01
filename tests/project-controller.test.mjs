import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProjectController } from '../src/document/project-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function makeHarness({
  readFileAsText = async () => '{"name":"Loaded","layers":[]}',
  sanitizeProject = value => value,
  canReplaceDocument = true,
  pendingChecks = [],
  session = null,
} = {}) {
  const original = { name:'Original', layers:[] };
  const state = {
    doc: original,
    sessionId: 'session-a',
    historyEntry: { id:'history-a' },
    changeSerial: 0,
    session,
  };
  const calls = {
    reads: 0,
    historyResets: 0,
    documents: [],
    dirty: [],
    recoveries: [],
    fits: 0,
    statuses: [],
    toasts: [],
    alerts: [],
    errors: [],
    downloads: [],
    smartSaves: [],
    publicationOrder: [],
  };
  let pendingIndex = 0;
  const controller = createProjectController({
    documentState: {
      getDocument: () => state.doc,
      getActiveSessionId: () => state.sessionId,
      getHistoryEntry: () => state.historyEntry,
      getDocumentChangeSerial: () => state.changeSerial,
      canReplaceDocument: () => canReplaceDocument,
      blockPendingDocumentEdit: () => Boolean(pendingChecks[pendingIndex++]),
      sanitizeProject,
      replaceHistory: () => {
        calls.historyResets += 1;
        calls.publicationOrder.push('replaceHistory');
      },
      setDocument: (documentValue, options) => {
        calls.documents.push([documentValue, options]);
        calls.publicationOrder.push('setDocument');
        state.doc = documentValue;
      },
      markDirty: value => {
        calls.dirty.push(value);
        calls.publicationOrder.push('markDirty');
      },
      getCurrentSession: () => state.session,
    },
    io: {
      readFileAsText: file => { calls.reads += 1; return readFileAsText(file); },
      downloadText: (text, name, type) => calls.downloads.push({ text, name, type }),
      safeFilename: value => String(value || 'image').replace(/\s+/g, '_'),
    },
    smartObjects: { saveContent: value => calls.smartSaves.push(value) },
    recovery: {
      queueRecovery: options => {
        calls.recoveries.push(options);
        calls.publicationOrder.push('queueRecovery');
      },
    },
    view: {
      fitToView: () => {
        calls.fits += 1;
        calls.publicationOrder.push('fitToView');
      },
    },
    ui: {
      setStatus: message => {
        calls.statuses.push(message);
        calls.publicationOrder.push('setStatus');
      },
      toast: (message, tone) => {
        calls.toasts.push([message, tone]);
        calls.publicationOrder.push('toast');
      },
      alertUser: message => calls.alerts.push(message),
      consoleRef: { error: error => calls.errors.push(error) },
    },
  });
  return { controller, state, calls, original };
}

function assertNoOpenPublication(calls) {
  assert.equal(calls.historyResets, 0);
  assert.deepEqual(calls.documents, []);
  assert.deepEqual(calls.dirty, []);
  assert.deepEqual(calls.recoveries, []);
  assert.equal(calls.fits, 0);
}

test('open prepares and sanitizes before one successful publication', async () => {
  const read = deferred();
  let sanitized = 0;
  const harness = makeHarness({
    readFileAsText: () => read.promise,
    sanitizeProject: value => { sanitized += 1; return { ...value, sanitized:true }; },
  });
  const opening = harness.controller.openProject({ name:'demo.zpe' });
  assertNoOpenPublication(harness.calls);
  read.resolve('{"name":"Loaded","layers":[]}');
  await opening;

  assert.equal(sanitized, 1);
  assert.equal(harness.calls.historyResets, 1);
  assert.equal(harness.calls.documents.length, 1);
  assert.deepEqual(harness.calls.documents[0][1], { resetHistory:true, label:'Открыть проект' });
  assert.equal(harness.calls.documents[0][0].sanitized, true);
  assert.deepEqual(harness.calls.dirty, [false]);
  assert.deepEqual(harness.calls.recoveries, [{ immediate:true }]);
  assert.equal(harness.calls.fits, 1);
  assert.deepEqual(harness.calls.statuses, ['Проект открыт']);
  assert.deepEqual(harness.calls.toasts, [['Открыт проект: demo.zpe', 'success']]);
  assert.deepEqual(harness.calls.publicationOrder, [
    'replaceHistory',
    'setDocument',
    'markDirty',
    'queueRecovery',
    'fitToView',
    'setStatus',
    'toast',
  ]);
});

for (const [name, mutate] of [
  ['document', state => { state.doc = { name:'Other', layers:[] }; }],
  ['session', state => { state.sessionId = 'session-b'; }],
  ['history entry', state => { state.historyEntry = { id:'history-b' }; }],
  ['document serial', state => { state.changeSerial += 1; }],
]) {
  test('open rejects stale ' + name + ' after async read', async () => {
    const read = deferred();
    const harness = makeHarness({ readFileAsText: () => read.promise });
    const opening = harness.controller.openProject({ name:'stale.zpe' });
    mutate(harness.state);
    read.resolve('{"name":"Loaded","layers":[]}');
    await opening;
    assertNoOpenPublication(harness.calls);
    assert.equal(harness.calls.statuses.at(-1), 'Открытие отменено: документ изменился во время чтения файла');
    assert.deepEqual(harness.calls.toasts.at(-1), ['Повторите открытие проекта в нужной вкладке', 'warn']);
  });
}


test('newer authorized open supersedes an older open before older parsing or publication', async () => {
  const reads = new Map([
    ['old.zpe', deferred()],
    ['new.zpe', deferred()],
  ]);
  let sanitized = 0;
  const harness = makeHarness({
    readFileAsText: file => reads.get(file.name).promise,
    sanitizeProject: value => { sanitized += 1; return value; },
  });

  const oldOpen = harness.controller.openProject({ name:'old.zpe' });
  const newOpen = harness.controller.openProject({ name:'new.zpe' });
  reads.get('old.zpe').resolve('{"name":"Old","layers":[]}');
  await oldOpen;

  assert.equal(sanitized, 0);
  assertNoOpenPublication(harness.calls);
  assert.deepEqual(harness.calls.statuses, []);
  assert.deepEqual(harness.calls.toasts, []);

  reads.get('new.zpe').resolve('{"name":"New","layers":[]}');
  await newOpen;

  assert.equal(sanitized, 1);
  assert.equal(harness.state.doc.name, 'New');
  assert.equal(harness.calls.documents.length, 1);
  assert.deepEqual(harness.calls.statuses, ['Проект открыт']);
  assert.deepEqual(harness.calls.toasts, [['Открыт проект: new.zpe', 'success']]);
});

test('older open stays silent when it resolves after newer open already published', async () => {
  const reads = new Map([
    ['old.zpe', deferred()],
    ['new.zpe', deferred()],
  ]);
  const harness = makeHarness({ readFileAsText: file => reads.get(file.name).promise });

  const oldOpen = harness.controller.openProject({ name:'old.zpe' });
  const newOpen = harness.controller.openProject({ name:'new.zpe' });
  reads.get('new.zpe').resolve('{"name":"New","layers":[]}');
  await newOpen;

  const published = {
    doc: harness.state.doc,
    historyResets: harness.calls.historyResets,
    documents: harness.calls.documents.length,
    dirty: [...harness.calls.dirty],
    recoveries: [...harness.calls.recoveries],
    fits: harness.calls.fits,
    statuses: [...harness.calls.statuses],
    toasts: [...harness.calls.toasts],
  };

  reads.get('old.zpe').resolve('{"name":"Old","layers":[]}');
  await oldOpen;

  assert.equal(harness.state.doc, published.doc);
  assert.equal(harness.calls.historyResets, published.historyResets);
  assert.equal(harness.calls.documents.length, published.documents);
  assert.deepEqual(harness.calls.dirty, published.dirty);
  assert.deepEqual(harness.calls.recoveries, published.recoveries);
  assert.equal(harness.calls.fits, published.fits);
  assert.deepEqual(harness.calls.statuses, published.statuses);
  assert.deepEqual(harness.calls.toasts, published.toasts);
});

test('superseded open read failure stays silent after a newer open claims authority', async () => {
  const reads = new Map([
    ['old.zpe', deferred()],
    ['new.zpe', deferred()],
  ]);
  const harness = makeHarness({ readFileAsText: file => reads.get(file.name).promise });

  const oldOpen = harness.controller.openProject({ name:'old.zpe' });
  const newOpen = harness.controller.openProject({ name:'new.zpe' });
  reads.get('old.zpe').reject(new Error('old read failed'));
  await oldOpen;

  assertNoOpenPublication(harness.calls);
  assert.deepEqual(harness.calls.alerts, []);
  assert.deepEqual(harness.calls.errors, []);
  assert.deepEqual(harness.calls.statuses, []);
  assert.deepEqual(harness.calls.toasts, []);

  reads.get('new.zpe').resolve('{"name":"New","layers":[]}');
  await newOpen;
  assert.equal(harness.state.doc.name, 'New');
  assert.deepEqual(harness.calls.statuses, ['Проект открыт']);
});

test('blocked newer open does not supersede an already-authorized older open', async () => {
  const oldRead = deferred();
  const harness = makeHarness({
    readFileAsText: () => oldRead.promise,
    pendingChecks: [false, true, false],
  });

  const oldOpen = harness.controller.openProject({ name:'old.zpe' });
  await harness.controller.openProject({ name:'blocked-new.zpe' });
  assert.equal(harness.calls.reads, 1);

  oldRead.resolve('{"name":"Old","layers":[]}');
  await oldOpen;

  assert.equal(harness.state.doc.name, 'Old');
  assert.equal(harness.calls.documents.length, 1);
  assert.deepEqual(harness.calls.statuses, ['Проект открыт']);
  assert.deepEqual(harness.calls.toasts, [['Открыт проект: old.zpe', 'success']]);
});

test('open is blocked before reading when an edit is pending', async () => {
  const harness = makeHarness({ pendingChecks:[true] });
  await harness.controller.openProject({ name:'blocked.zpe' });
  assert.equal(harness.calls.reads, 0);
  assertNoOpenPublication(harness.calls);
});

test('open rechecks pending edit after async preparation', async () => {
  const read = deferred();
  const harness = makeHarness({ readFileAsText: () => read.promise, pendingChecks:[false, true] });
  const opening = harness.controller.openProject({ name:'blocked-late.zpe' });
  read.resolve('{"name":"Loaded","layers":[]}');
  await opening;
  assert.equal(harness.calls.reads, 1);
  assertNoOpenPublication(harness.calls);
});

test('open respects replace-document preflight before reading', async () => {
  const harness = makeHarness({ canReplaceDocument:false });
  await harness.controller.openProject({ name:'blocked.zpe' });
  assert.equal(harness.calls.reads, 0);
  assertNoOpenPublication(harness.calls);
});

for (const [name, options] of [
  ['invalid JSON', { readFileAsText:async () => '{broken' }],
  ['sanitizer failure', { sanitizeProject:() => { throw new Error('bad project'); } }],
]) {
  test(name + ' publishes no partial project state', async () => {
    const harness = makeHarness(options);
    await harness.controller.openProject({ name:'bad.zpe' });
    assertNoOpenPublication(harness.calls);
    assert.equal(harness.calls.alerts.length, 1);
    assert.equal(harness.calls.statuses.at(-1), 'Ошибка открытия проекта');
    assert.equal(harness.calls.errors.length, 1);
  });
}

test('regular save downloads formatted zpe and refreshes recovery without marking clean', () => {
  const harness = makeHarness();
  harness.state.doc = { name:'My Project', layers:[{ id:'one' }] };
  harness.controller.saveProject();
  assert.equal(harness.calls.downloads.length, 1);
  assert.equal(harness.calls.downloads[0].name, 'My_Project.zpe');
  assert.equal(harness.calls.downloads[0].type, 'application/json');
  assert.deepEqual(JSON.parse(harness.calls.downloads[0].text), harness.state.doc);
  assert.match(harness.calls.downloads[0].text, /\n  "name"/);
  assert.deepEqual(harness.calls.recoveries, [{ immediate:true }]);
  assert.deepEqual(harness.calls.dirty, []);
  assert.match(harness.calls.statuses[0], /My_Project\.zpe/);
});

test('Smart Object child save delegates without regular project download', () => {
  const linkedSession = { id:'child', smartObjectLink:{ parentSessionId:'parent' } };
  const harness = makeHarness({ session:linkedSession });
  harness.controller.saveProject();
  assert.deepEqual(harness.calls.smartSaves, [linkedSession]);
  assert.deepEqual(harness.calls.downloads, []);
  assert.deepEqual(harness.calls.recoveries, []);
  assert.deepEqual(harness.calls.statuses, []);
});

test('save is blocked while a document edit is pending', () => {
  const harness = makeHarness({ pendingChecks:[true] });
  harness.controller.saveProject();
  assert.deepEqual(harness.calls.downloads, []);
  assert.deepEqual(harness.calls.smartSaves, []);
  assert.deepEqual(harness.calls.recoveries, []);
});

test('native project ownership and build routing stay separated from import policy', async () => {
  const [main, source, importController, build] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/document/project-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/document/import-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../tools/build-bundle.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(main, /from '\.\/document\/project-controller\.js'/);
  assert.match(main, /createProjectController\(\{/);
  assert.match(main, /getCurrentSession:\s*\(\) => currentSession\(\)/);
  assert.match(main, /saveContent:\s*session => saveSmartObjectContent\(session\)/);
  assert.doesNotMatch(main, /async function openProject\(/);
  assert.doesNotMatch(main, /function saveProject\(/);
  assert.match(importController, /openProject/);
  assert.doesNotMatch(source, /openPsd|isPsdFile|importImages|readFileAsDataURL/);
  const ownerIndex = build.indexOf("'src/document/project-controller.js'");
  const mainIndex = build.indexOf("'src/main.js'");
  assert.ok(ownerIndex >= 0 && mainIndex > ownerIndex, 'project controller must load before main.js');
});
