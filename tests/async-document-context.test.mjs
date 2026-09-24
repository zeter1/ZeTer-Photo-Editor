import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

function functionSource(start, end) {
  const from = main.indexOf(start);
  const to = main.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'Cannot locate function source');
  return main.slice(from, to);
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('an image decoded after switching tabs never lands in the new document', async () => {
  const read = deferred();
  const original = { name: 'Без имени', width: 100, height: 100, layers: [] };
  const other = { name: 'Другой', width: 100, height: 100, layers: [] };
  const commits = [];
  const context = {
    doc: original,
    activeSessionId: 'first',
    isImageFile: () => true,
    readFileAsDataURL: () => read.promise,
    dimensionsFromDataUrl: async () => ({ width: 20, height: 20 }),
    checkedCanvasSize: () => {},
    createRasterLayer: options => options,
    addLayer: (documentValue, layer) => documentValue.layers.push(layer),
    commit: label => commits.push(label),
    blockPendingDocumentEdit: () => false,
    setStatus: () => {},
    toast: () => {},
    fitToView: () => {},
    visibleCanvasCenter: () => ({ x: 50, y: 50 }),
    brushCanvas: null,
    Date,
  };
  runInNewContext(functionSource('async function importImages(', 'async function handleIncomingFiles(')
    + '\nglobalThis.importImages = importImages;', context);

  const importing = context.importImages([{ name: 'photo.png', type: 'image/png' }]);
  context.doc = other;
  context.activeSessionId = 'second';
  read.resolve('data:image/png;base64,AAAA');
  assert.equal(await importing, 0);
  assert.equal(original.layers.length, 0);
  assert.equal(other.layers.length, 0);
  assert.deepEqual(commits, []);
});

test('an image still imports into its original active document', async () => {
  const documentValue = { name: 'Без имени', width: 100, height: 100, layers: [] };
  const commits = [];
  const context = {
    doc: documentValue,
    activeSessionId: 'first',
    isImageFile: () => true,
    readFileAsDataURL: async () => 'data:image/png;base64,AAAA',
    dimensionsFromDataUrl: async () => ({ width: 20, height: 30 }),
    checkedCanvasSize: () => {},
    createRasterLayer: options => options,
    addLayer: (target, layer) => target.layers.push(layer),
    commit: label => commits.push(label),
    blockPendingDocumentEdit: () => false,
    setStatus: () => {},
    toast: () => {},
    fitToView: () => {},
    brushCanvas: null,
    Date,
  };
  runInNewContext(functionSource('async function importImages(', 'async function handleIncomingFiles(')
    + '\nglobalThis.importImages = importImages;', context);

  assert.equal(await context.importImages([{ name: 'photo.png', type: 'image/png' }]), 1);
  assert.equal(documentValue.layers.length, 1);
  assert.equal(documentValue.width, 20);
  assert.equal(documentValue.height, 30);
  assert.deepEqual(commits, ['Импорт изображения']);
});

test('late rasterization cannot replace the last layer of another tab', async () => {
  const rasterizing = deferred();
  const sourceLayer = { id: 'source', type: 'text', name: 'Текст' };
  const otherLayer = { id: 'other', type: 'raster', name: 'Другой слой' };
  const original = { layers: [sourceLayer], selectedLayerId: 'source' };
  const other = { layers: [otherLayer], selectedLayerId: 'other' };
  const commits = [];
  const context = {
    doc: original,
    activeSessionId: 'first',
    selected: () => context.doc.layers.find(layer => layer.id === context.doc.selectedLayerId),
    isLayerLocked: () => false,
    rasterizeLayerForPixelEditing: () => rasterizing.promise,
    blockPendingDocumentEdit: () => false,
    setStatus: () => {},
    toast: () => {},
    commit: label => commits.push(label),
    console,
    brushCanvas: null,
    brushCtx: null,
    brushLayerId: null,
    paintPersisting: false,
  };
  runInNewContext(functionSource('async function rasterizeSelectedLayer()', 'function resizeImageDialog()')
    + '\nglobalThis.rasterizeSelectedLayer = rasterizeSelectedLayer;', context);

  const operation = context.rasterizeSelectedLayer();
  context.doc = other;
  context.activeSessionId = 'second';
  rasterizing.resolve({ id: 'source', type: 'raster', name: 'Текст — растр' });
  await operation;
  assert.equal(original.layers[0], sourceLayer);
  assert.equal(other.layers[0], otherLayer);
  assert.deepEqual(commits, []);
});

test('rasterization finishes on the selected layer and releases the edit guard', async () => {
  const rasterizing = deferred();
  const sourceLayer = { id: 'source', type: 'text', name: 'Текст' };
  const rasterLayer = { id: 'source', type: 'raster', name: 'Текст — растр', width: 20, height: 30 };
  const documentValue = { layers: [sourceLayer], selectedLayerId: 'source' };
  const commits = [];
  const context = {
    doc: documentValue,
    activeSessionId: 'first',
    selected: () => context.doc.layers.find(layer => layer.id === context.doc.selectedLayerId),
    isLayerLocked: () => false,
    rasterizeLayerForPixelEditing: () => rasterizing.promise,
    blockPendingDocumentEdit: () => false,
    setStatus: () => {},
    toast: () => {},
    commit: label => commits.push(label),
    console,
    brushCanvas: null,
    brushCtx: null,
    brushLayerId: null,
    paintPersisting: false,
  };
  runInNewContext(functionSource('async function rasterizeSelectedLayer()', 'function resizeImageDialog()')
    + '\nglobalThis.rasterizeSelectedLayer = rasterizeSelectedLayer;', context);

  const operation = context.rasterizeSelectedLayer();
  assert.equal(context.paintPersisting, true);
  rasterizing.resolve(rasterLayer);
  await operation;
  assert.equal(documentValue.layers[0], rasterLayer);
  assert.equal(context.paintPersisting, false);
  assert.deepEqual(commits, ['Растеризовать слой']);
});

test('a project read for one tab never replaces another tab after a switch', async () => {
  const read = deferred();
  const original = { name: 'Первый', layers: [] };
  const other = { name: 'Второй', layers: [] };
  const actions = [];
  const historyEntry = {};
  const context = {
    doc: original,
    activeSessionId: 'first',
    documentChangeSerial: 0,
    history: { current: () => historyEntry },
    canReplaceDocument: () => true,
    blockPendingDocumentEdit: () => false,
    readFileAsText: () => read.promise,
    sanitizeProject: value => value,
    discardRecovery: () => { actions.push('discard'); return Promise.resolve(); },
    HistoryStack: class {},
    setDoc: value => { actions.push('replace'); context.doc = value; },
    markDirty: () => {},
    fitToView: () => {},
    setStatus: () => {},
    toast: () => {},
    alert: () => {},
    console,
  };
  runInNewContext(functionSource('async function openProject(file)', 'function saveProject()')
    + '\nglobalThis.openProject = openProject;', context);

  const opening = context.openProject({ name: 'another.zpe' });
  context.doc = other;
  context.activeSessionId = 'second';
  read.resolve('{"name":"Загруженный","layers":[]}');
  await opening;
  assert.equal(context.doc, other);
  assert.deepEqual(actions, []);
});

test('project open aborts after a live opacity edit with no history entry yet', async () => {
  const read = deferred();
  const original = { name: 'Исходный', layers: [{ opacity: 1 }] };
  const historyEntry = {};
  let replacements = 0;
  const context = {
    doc: original,
    activeSessionId: 'first',
    documentChangeSerial: 0,
    history: { current: () => historyEntry },
    canReplaceDocument: () => true,
    blockPendingDocumentEdit: () => false,
    readFileAsText: () => read.promise,
    sanitizeProject: value => value,
    discardRecovery: () => Promise.resolve(),
    queueRecovery: () => {},
    HistoryStack: class {},
    setDoc: () => { replacements += 1; },
    dirty: false,
    currentSession: () => null,
    renderDocumentTabs: () => {},
    fitToView: () => {},
    setStatus: () => {},
    toast: () => {},
    alert: () => {},
    console,
  };
  runInNewContext(functionSource('function markDirty(', 'function documentEditPending()')
    + '\nglobalThis.markDirty = markDirty;', context);
  runInNewContext(functionSource('async function openProject(file)', 'function saveProject()')
    + '\nglobalThis.openProject = openProject;', context);

  const opening = context.openProject({ name: 'other.zpe' });
  original.layers[0].opacity = 0.4;
  context.markDirty(true);
  read.resolve('{"name":"Загруженный","layers":[]}');
  await opening;
  assert.equal(replacements, 0);
  assert.equal(original.layers[0].opacity, 0.4);
});

test('new-document submission replaces the document before scheduling recovery refresh', async () => {
  const other = { name: 'Вторая вкладка' };
  const replacement = { name: 'Новый документ' };
  let modal;
  let queuedDocument;
  const context = {
    doc: { name: 'Первая вкладка' },
    activeSessionId: 'first',
    blockPendingDocumentEdit: () => false,
    canReplaceDocument: () => true,
    showModal: options => { modal = options; },
    createDocument: () => replacement,
    queueRecovery: () => { queuedDocument = context.doc; },
    HistoryStack: class {},
    setDoc: value => { context.doc = value; },
    markDirty: () => {},
    fitToView: () => {},
    setStatus: () => {},
    toast: () => {},
  };
  runInNewContext(functionSource('async function createNewDialog()', 'function isImageFile(file)')
    + '\nglobalThis.createNewDialog = createNewDialog;', context);

  await context.createNewDialog();
  await modal.onSubmit({ name: 'Новый документ', width: '100', height: '100' });
  assert.equal(context.doc, replacement);
  assert.equal(queuedDocument, replacement);
  context.doc = other;
  context.activeSessionId = 'second';
  assert.equal(context.doc, other);
});

test('clipboard menu paste does not follow a tab switch while reading', async () => {
  const read = deferred();
  const original = { name: 'Первый' };
  const other = { name: 'Второй' };
  let imports = 0;
  const context = {
    doc: original,
    activeSessionId: 'first',
    navigator: { clipboard: { read: () => {} } },
    readClipboardImageFiles: () => read.promise,
    importImages: () => { imports += 1; },
    visibleCanvasCenter: () => ({ x: 0, y: 0 }),
    toast: () => {},
    setStatus: () => {},
    console,
    pasteGeneration: 0,
  };
  runInNewContext(functionSource('async function pasteFromClipboard()', 'function armPasteShortcutFallback()')
    + '\nglobalThis.pasteFromClipboard = pasteFromClipboard;', context);

  const pasting = context.pasteFromClipboard();
  context.doc = other;
  context.activeSessionId = 'second';
  read.resolve([{ name: 'clipboard.png' }]);
  await pasting;
  assert.equal(imports, 0);
});

test('shortcut clipboard fallback does not paste into a later active tab', async () => {
  const read = deferred();
  const timers = [];
  let imports = 0;
  const context = {
    doc: { name: 'Первый' },
    activeSessionId: 'first',
    navigator: { clipboard: { read: () => {} } },
    readClipboardImageFiles: () => read.promise,
    importImages: () => { imports += 1; return Promise.resolve(); },
    visibleCanvasCenter: () => ({ x: 0, y: 0 }),
    setTimeout: callback => { timers.push(callback); return timers.length; },
    clearTimeout: () => {},
    setStatus: () => {},
    toast: () => {},
    console,
    pasteGeneration: 0,
    pasteFallbackTimer: null,
  };
  runInNewContext(functionSource('function armPasteShortcutFallback()', 'function toggleSelectedVisibility()')
    + '\nglobalThis.armPasteShortcutFallback = armPasteShortcutFallback;', context);

  context.armPasteShortcutFallback();
  context.doc = { name: 'Второй' };
  context.activeSessionId = 'second';
  read.resolve([{ name: 'clipboard.png' }]);
  await Promise.resolve();
  await Promise.resolve();
  timers.forEach(callback => callback());
  assert.equal(imports, 0);
});