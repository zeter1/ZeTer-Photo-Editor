import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createSelectionClipboardController } from '../src/selection/clipboard-controller.js';
import { createSelectionRasterMutationController } from '../src/selection/raster-mutation-controller.js';
import { createDocumentImportController } from '../src/document/import-controller.js';

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

function importControllerForTest({state,readFileAsDataURL,dimensionsFromDataUrl,commits}) {
  return createDocumentImportController({
    getDocument:()=>state.doc,
    getActiveSessionId:()=>state.activeSessionId,
    isPsdFile:()=>false,
    readFileAsDataURL,
    dimensionsFromDataUrl,
    checkedCanvasSize:()=>{},
    createRasterLayer:options=>options,
    addLayer:(documentValue,layer)=>documentValue.layers.push(layer),
    blockPendingDocumentEdit:()=>false,
    commit:label=>commits.push(label),
    setStatus:()=>{},
    toast:()=>{},
    fitToView:()=>{},
    visibleCanvasCenter:()=>({x:50,y:50}),
    openPsd:async()=>{},
    openProject:async()=>{},
    resetBrushBuffer:()=>{},
    DateClass:Date,
  });
}

test('an image decoded after switching tabs never lands in the new document', async () => {
  const read=deferred();
  const original={name:'Без имени',width:100,height:100,layers:[]};
  const other={name:'Другой',width:100,height:100,layers:[]};
  const state={doc:original,activeSessionId:'first'};
  const commits=[];
  const controller=importControllerForTest({
    state,commits,
    readFileAsDataURL:()=>read.promise,
    dimensionsFromDataUrl:async()=>({width:20,height:20}),
  });

  const importing=controller.importImages([{name:'photo.png',type:'image/png'}]);
  state.doc=other;
  state.activeSessionId='second';
  read.resolve('data:image/png;base64,AAAA');
  assert.equal(await importing,0);
  assert.equal(original.layers.length,0);
  assert.equal(other.layers.length,0);
  assert.deepEqual(commits,[]);
});

test('an image still imports into its original active document', async () => {
  const documentValue={name:'Без имени',width:100,height:100,layers:[]};
  const state={doc:documentValue,activeSessionId:'first'};
  const commits=[];
  const controller=importControllerForTest({
    state,commits,
    readFileAsDataURL:async()=> 'data:image/png;base64,AAAA',
    dimensionsFromDataUrl:async()=>({width:20,height:30}),
  });

  assert.equal(await controller.importImages([{name:'photo.png',type:'image/png'}]),1);
  assert.equal(documentValue.layers.length,1);
  assert.equal(documentValue.width,20);
  assert.equal(documentValue.height,30);
  assert.deepEqual(commits,['Импорт изображения']);
});

function rasterMutationHarness({ state, rasterizeLayerForPixelEditing, commits }) {
  let persisting = false;
  const controller = createSelectionRasterMutationController({
    rasterEdit:{ clearBrushBuffer:() => {} },
    state:{
      getDocument:() => state.doc,
      getActiveSessionId:() => state.activeSessionId,
      getSelectedLayer:() => state.doc.layers.find(layer => layer.id === state.doc.selectedLayerId) || null,
      isPersisting:() => persisting,
      beginPersist:() => {
        if (persisting) return false;
        persisting = true;
        return true;
      },
      endPersist:() => { persisting = false; },
      blockPendingDocumentEdit:() => false,
    },
    selection:{ hasActive:() => false, intersectsLayer:() => false, predicate:() => null, clipContext:() => {} },
    ui:{ setStatus:() => {}, toast:() => {}, render:() => {}, commit:label => commits.push(label) },
    operations:{ rasterizeLayerForPixelEditing },
  });
  return { controller, isPersisting:() => persisting };
}

test('late rasterization cannot replace the last layer of another tab', async () => {
  const rasterizing = deferred();
  const sourceLayer = { id:'source', type:'text', name:'Текст' };
  const otherLayer = { id:'other', type:'raster', name:'Другой слой' };
  const original = { layers:[sourceLayer], groups:[], selectedLayerId:'source' };
  const other = { layers:[otherLayer], groups:[], selectedLayerId:'other' };
  const state = { doc:original, activeSessionId:'first' };
  const commits = [];
  const harness = rasterMutationHarness({ state, rasterizeLayerForPixelEditing:() => rasterizing.promise, commits });

  const operation = harness.controller.rasterizeSelectedLayer();
  state.doc = other;
  state.activeSessionId = 'second';
  rasterizing.resolve({ id:'source', type:'raster', name:'Текст — растр', width:20, height:30 });
  await operation;

  assert.equal(original.layers[0], sourceLayer);
  assert.equal(other.layers[0], otherLayer);
  assert.deepEqual(commits, []);
  assert.equal(harness.isPersisting(), false);
});

test('rasterization finishes on the selected layer and releases the edit guard', async () => {
  const rasterizing = deferred();
  const sourceLayer = { id:'source', type:'text', name:'Текст' };
  const rasterLayer = { id:'source', type:'raster', name:'Текст — растр', width:20, height:30 };
  const documentValue = { layers:[sourceLayer], groups:[], selectedLayerId:'source' };
  const state = { doc:documentValue, activeSessionId:'first' };
  const commits = [];
  const harness = rasterMutationHarness({ state, rasterizeLayerForPixelEditing:() => rasterizing.promise, commits });

  const operation = harness.controller.rasterizeSelectedLayer();
  assert.equal(harness.isPersisting(), true);
  rasterizing.resolve(rasterLayer);
  assert.equal(await operation, true);

  assert.equal(documentValue.layers[0], rasterLayer);
  assert.equal(harness.isPersisting(), false);
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
  runInNewContext(functionSource('async function createNewDialog()', 'function visibleCanvasCenter()')
    + '\nglobalThis.createNewDialog = createNewDialog;', context);

  await context.createNewDialog();
  await modal.onSubmit({ name: 'Новый документ', width: '100', height: '100' });
  assert.equal(context.doc, replacement);
  assert.equal(queuedDocument, replacement);
  context.doc = other;
  context.activeSessionId = 'second';
  assert.equal(context.doc, other);
});

class TestClipboardFile {
  constructor(parts,name,{type}={}) { this.parts=parts;this.name=name;this.type=type; }
}

function clipboardImageItem() {
  return { types:['image/png'], getType:async()=>({type:'image/png'}) };
}

function asyncClipboardController({state,read,importImages,setTimeoutFn=globalThis.setTimeout,clearTimeoutFn=globalThis.clearTimeout}) {
  return createSelectionClipboardController({
    getDocument:()=>state.doc,
    getActiveSessionId:()=>state.activeSessionId,
    getSelectionRect:()=>null,
    getCopyMode:()=> 'merged',
    getSelectedLayer:()=>null,
    isEditableRasterLayer:()=>false,
    clipContextToDocumentSelection:()=>{},
    clearSelectionAcrossVisibleLayers:async()=>null,
    clearSelectedPixels:async()=>false,
    clearSelectionState:()=>{},
    setTool:()=>{},
    setStatus:()=>{},
    toast:()=>{},
    importImages,
    visibleCanvasCenter:()=>({x:0,y:0}),
    isImageFile:()=>true,
    navigatorTarget:{clipboard:{read:()=>read.promise}},
    FileClass:TestClipboardFile,
    setTimeoutFn,
    clearTimeoutFn,
  });
}

test('clipboard menu paste does not follow a tab switch while reading', async () => {
  const read=deferred();
  const original={name:'Первый'};
  const other={name:'Второй'};
  const state={doc:original,activeSessionId:'first'};
  let imports=0;
  const controller=asyncClipboardController({
    state,read,
    importImages:()=>{imports+=1;return Promise.resolve();},
  });

  const pasting=controller.pasteFromClipboard();
  state.doc=other;
  state.activeSessionId='second';
  read.resolve([clipboardImageItem()]);
  await pasting;
  assert.equal(imports,0);
});

test('shortcut clipboard fallback does not paste into a later active tab', async () => {
  const read=deferred();
  const timers=[];
  const state={doc:{name:'Первый'},activeSessionId:'first'};
  let imports=0;
  const controller=asyncClipboardController({
    state,read,
    importImages:()=>{imports+=1;return Promise.resolve();},
    setTimeoutFn:callback=>{timers.push(callback);return timers.length;},
    clearTimeoutFn:()=>{},
  });

  controller.armPasteShortcutFallback();
  state.doc={name:'Второй'};
  state.activeSessionId='second';
  read.resolve([clipboardImageItem()]);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  timers.forEach(callback=>callback());
  await Promise.resolve();
  assert.equal(imports,0);
});
