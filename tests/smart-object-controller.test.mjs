import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDocument,
  createRasterLayer,
  createSmartObjectLayer,
} from '../src/core/state.js';
import { createSmartObjectController } from '../src/document/smart-object-controller.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function makeState(documentValue) {
  return {
    doc: documentValue,
    activeSessionId: 'parent',
    dirty: false,
    sessions: [],
    statuses: [],
    toasts: [],
    commits: [],
    invalidated: [],
    recoveries: [],
    tabsRendered: 0,
    updates: 0,
    fits: 0,
  };
}

function makeController(state, {
  renderPreview = async () => 'data:image/png;base64,AA==',
  photoshop = {},
} = {}) {
  let sessionCounter = 0;
  return createSmartObjectController({
    runtime: {
      getDocument: () => state.doc,
      getActiveSessionId: () => state.activeSessionId,
      setActiveSessionId: value => { state.activeSessionId = value; },
      getSelectedLayer: () => state.doc.layers.find(layer => layer.id === state.doc.selectedLayerId) || null,
      getZoom: () => 0.75,
      blockPendingDocumentEdit: () => false,
      isLayerLocked: () => false,
      commit: label => state.commits.push(label),
      updateAll: () => { state.updates += 1; },
      fitToView: () => { state.fits += 1; },
      queueRecovery: options => state.recoveries.push(options),
      invalidateImageCache: value => state.invalidated.push(value),
      setActiveDocument: value => { state.doc = value; },
      setDirty: value => { state.dirty = value; },
    },
    sessions: {
      getAll: () => state.sessions,
      current: () => state.sessions.find(session => session.id === state.activeSessionId) || null,
      syncCurrent: () => {},
      build: (documentValue, options) => ({
        id: 'content-' + (++sessionCounter),
        doc: documentValue,
        history: { push() {} },
        zoom: options.zoomLevel,
        dirty: options.dirtyState,
        smartObjectLink: options.smartObjectLink,
      }),
      load: session => { state.doc = session.doc; },
      activate: () => {},
      renderTabs: () => { state.tabsRendered += 1; },
    },
    rendering: { renderPreview },
    photoshop,
    ui: {
      setStatus: message => state.statuses.push(message),
      toast: (message, tone) => state.toasts.push([message, tone]),
      consoleRef: { error() {}, warn() {} },
    },
  });
}

test('linked copy and unlink lifecycle is owned by the controller', () => {
  const embedded = createDocument({ name:'inside', width:20, height:20 });
  const source = createSmartObjectLayer({
    name:'Source',
    width:20,
    height:20,
    embeddedDocument:embedded,
  });
  const doc = createDocument({ name:'parent', width:100, height:100 });
  doc.layers = [source];
  doc.selectedLayerId = source.id;
  const state = makeState(doc);
  state.sessions = [{ id:'parent', doc, history:{ push() {} }, dirty:false, smartObjectLink:null }];
  const controller = makeController(state);

  const copy = controller.createLinkedCopy(source);
  assert.ok(copy);
  assert.equal(doc.layers.length, 2);
  assert.ok(source.linkedSourceId);
  assert.equal(copy.linkedSourceId, source.linkedSourceId);
  assert.equal(controller.smartObjectLinkedCount(copy, doc), 2);
  assert.deepEqual(state.commits, ['Создать связанную копию смарт-объекта']);

  assert.equal(controller.unlink(copy), true);
  assert.equal(copy.linkedSourceId, null);
  assert.deepEqual(state.commits, [
    'Создать связанную копию смарт-объекта',
    'Разорвать связь смарт-объекта',
  ]);
});

test('conversion preserves layer identity and cancels after the originating tab changes', async () => {
  const source = createRasterLayer({
    name:'Pixels',
    x:12,
    y:14,
    width:10,
    height:8,
    dataUrl:'data:image/png;base64,AA==',
  });
  const doc = createDocument({ name:'parent', width:100, height:100 });
  doc.layers = [source];
  doc.selectedLayerId = source.id;
  const state = makeState(doc);
  state.sessions = [{ id:'parent', doc, history:{ push() {} }, dirty:false, smartObjectLink:null }];

  const controller = makeController(state);
  await controller.convertSelected();
  assert.equal(doc.layers.length, 1);
  assert.equal(doc.layers[0].type, 'smart-object');
  assert.equal(doc.layers[0].id, source.id);
  assert.equal(doc.layers[0].previewDataUrl, 'data:image/png;base64,AA==');
  assert.ok(doc.layers[0].embeddedDocument);
  assert.deepEqual(state.commits, ['Преобразовать в смарт-объект']);

  const staleSource = createRasterLayer({ name:'Stale', width:5, height:5 });
  const staleDoc = createDocument({ name:'stale-parent', width:50, height:50 });
  staleDoc.layers = [staleSource];
  staleDoc.selectedLayerId = staleSource.id;
  const staleState = makeState(staleDoc);
  staleState.sessions = [{ id:'parent', doc:staleDoc, history:{ push() {} }, dirty:false, smartObjectLink:null }];
  const pending = deferred();
  const staleController = makeController(staleState, { renderPreview:() => pending.promise });
  const conversion = staleController.convertSelected();
  staleState.activeSessionId = 'other';
  pending.resolve('data:image/png;base64,AA==');
  await conversion;
  assert.equal(staleDoc.layers[0], staleSource);
  assert.deepEqual(staleState.commits, []);
  assert.match(staleState.statuses.at(-1), /отменено: слой изменился/);
});

test('opening shared contents reports the parent linked-instance count after child load', () => {
  const embedded = createDocument({ name:'inside', width:20, height:20 });
  const first = createSmartObjectLayer({
    name:'Shared',
    width:20,
    height:20,
    embeddedDocument:embedded,
    linkedSourceId:'shared-source',
  });
  const second = createSmartObjectLayer({
    name:'Shared copy',
    width:20,
    height:20,
    embeddedDocument:embedded,
    linkedSourceId:'shared-source',
  });
  const parentDoc = createDocument({ name:'parent', width:100, height:100 });
  parentDoc.layers = [first, second];
  parentDoc.selectedLayerId = first.id;
  const state = makeState(parentDoc);
  state.sessions = [{ id:'parent', doc:parentDoc, history:{ push() {} }, dirty:false, smartObjectLink:null }];
  const controller = makeController(state);

  controller.openContents(first);
  assert.equal(state.sessions.length, 2);
  assert.equal(state.activeSessionId, state.sessions[1].id);
  assert.notEqual(state.doc, parentDoc);
  assert.match(state.statuses.at(-1), /Ctrl\+S обновит 2 экземпляр/);
});

test('save propagates a linked source to every instance', async () => {
  const oldEmbedded = createDocument({ name:'old', width:10, height:10 });
  const first = createSmartObjectLayer({
    name:'A',
    width:10,
    height:10,
    previewDataUrl:'data:image/png;base64,OLD1',
    embeddedDocument:oldEmbedded,
    linkedSourceId:'shared',
  });
  const second = createSmartObjectLayer({
    name:'B',
    width:10,
    height:10,
    previewDataUrl:'data:image/png;base64,OLD2',
    embeddedDocument:oldEmbedded,
    linkedSourceId:'shared',
  });
  const parentDoc = createDocument({ name:'parent', width:100, height:100 });
  parentDoc.layers = [first, second];
  const childDoc = createDocument({ name:'inside', width:18, height:16 });
  childDoc.layers = [createRasterLayer({ name:'edit', width:18, height:16 })];

  const historyCalls = [];
  const parent = {
    id:'parent',
    doc:parentDoc,
    history:{ push:(label, snapshot) => historyCalls.push([label, snapshot]) },
    dirty:false,
    smartObjectLink:null,
  };
  const child = {
    id:'child',
    doc:childDoc,
    history:{ push() {} },
    dirty:true,
    smartObjectLink:{ parentSessionId:'parent', layerId:first.id, linkedSourceId:'shared', photoshopSourceId:null },
  };
  const state = makeState(childDoc);
  state.activeSessionId = 'child';
  state.dirty = true;
  state.sessions = [parent, child];

  const controller = makeController(state, {
    renderPreview: async () => 'data:image/png;base64,NEW',
  });
  assert.equal(await controller.saveContent(child), true);
  assert.equal(first.previewDataUrl, 'data:image/png;base64,NEW');
  assert.equal(second.previewDataUrl, 'data:image/png;base64,NEW');
  assert.equal(first.width, 18);
  assert.equal(second.height, 16);
  assert.equal(parent.dirty, true);
  assert.equal(child.dirty, false);
  assert.equal(state.dirty, false);
  assert.equal(historyCalls[0][0], 'Обновить общий источник смарт-объектов');
  assert.deepEqual(new Set(state.invalidated), new Set([
    'data:image/png;base64,OLD1',
    'data:image/png;base64,OLD2',
  ]));
  assert.deepEqual(state.recoveries, [{ immediate:true }]);
});

test('save cancels when the originating content tab changes during preview preparation', async () => {
  const embedded = createDocument({ name:'old', width:8, height:8 });
  const parentLayer = createSmartObjectLayer({
    name:'Parent',
    width:8,
    height:8,
    previewDataUrl:'data:image/png;base64,OLD',
    embeddedDocument:embedded,
  });
  const parentDoc = createDocument({ name:'parent', width:30, height:30 });
  parentDoc.layers = [parentLayer];
  const childDoc = createDocument({ name:'child', width:12, height:12 });
  let historyPushed = false;
  const parent = {
    id:'parent',
    doc:parentDoc,
    history:{ push() { historyPushed = true; } },
    dirty:false,
    smartObjectLink:null,
  };
  const child = {
    id:'child',
    doc:childDoc,
    history:{ push() {} },
    dirty:true,
    smartObjectLink:{ parentSessionId:'parent', layerId:parentLayer.id, linkedSourceId:null, photoshopSourceId:null },
  };
  const state = makeState(childDoc);
  state.activeSessionId = 'child';
  state.sessions = [parent, child];
  const pending = deferred();
  const controller = makeController(state, { renderPreview:() => pending.promise });

  const save = controller.saveContent(child);
  state.activeSessionId = 'parent';
  state.doc = parentDoc;
  pending.resolve('data:image/png;base64,NEW');
  assert.equal(await save, false);
  assert.equal(parentLayer.previewDataUrl, 'data:image/png;base64,OLD');
  assert.equal(historyPushed, false);
  assert.match(state.statuses.at(-1), /активная вкладка изменились/);
});

test('Photoshop resource rewrite remains an injected narrow port', async () => {
  const embedded = createDocument({ name:'old', width:10, height:10 });
  const makeLayer = (name, width) => createSmartObjectLayer({
    name,
    width,
    height:10,
    previewDataUrl:'data:image/png;base64,OLD',
    embeddedDocument:embedded,
    psdSmartObject:{ uniqueId:'ps-source', asset:{ kind:'data' }, baseline:{} },
  });
  const first = makeLayer('PS A', 22);
  const second = makeLayer('PS B', 33);
  const parentDoc = createDocument({ name:'parent', width:100, height:100 });
  parentDoc.layers = [first, second];
  const childDoc = createDocument({ name:'inside', width:10, height:10 });
  const parent = { id:'parent', doc:parentDoc, history:{ push() {} }, dirty:false, smartObjectLink:null };
  const child = {
    id:'child',
    doc:childDoc,
    history:{ push() {} },
    dirty:true,
    smartObjectLink:{ parentSessionId:'parent', layerId:first.id, linkedSourceId:null, photoshopSourceId:'ps-source' },
  };
  const state = makeState(childDoc);
  state.activeSessionId = 'child';
  state.sessions = [parent, child];
  let rewriteCalls = 0;
  const updated = [];
  const controller = makeController(state, {
    photoshop: {
      isLayer: layer => Boolean(layer?.psdSmartObject),
      sourceId: layer => layer?.psdSmartObject?.uniqueId || null,
      findLayers: (owner, uniqueId) => owner.layers.filter(layer => layer.psdSmartObject?.uniqueId === uniqueId),
      rewriteEmbeddedSource: async () => {
        rewriteCalls += 1;
        return { rewritten:true, newSize:123, sourceKey:'lnk2', type:'psd' };
      },
      updateTargetAfterRewrite: (target, payload) => updated.push([target.id, payload.rewrite.newSize]),
    },
  });

  assert.equal(await controller.saveContent(child), true);
  assert.equal(rewriteCalls, 1);
  assert.equal(updated.length, 2);
  assert.equal(first.width, 22);
  assert.equal(second.width, 33);
  assert.match(state.statuses.at(-1), /native linked resource/);
});

test('architecture guard keeps generic lifecycle out of main and PSD bytes out of the controller', async () => {
  const root = new URL('../', import.meta.url);
  const [main, source, build] = await Promise.all([
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/document/smart-object-controller.js', root), 'utf8'),
    readFile(new URL('tools/build-bundle.mjs', root), 'utf8'),
  ]);

  assert.match(main, /from '\.\/document\/smart-object-controller\.js'/);
  assert.match(source, /export function createSmartObjectController/);
  assert.match(build, /'src\/document\/smart-object-controller\.js'/);
  for (const name of [
    'smartObjectLinkedCount',
    'createLinkedSmartObjectCopy',
    'unlinkSmartObject',
    'smartObjectSessionDepth',
    'smartObjectSourceBounds',
    'smartObjectPreviewDataUrl',
    'convertSelectedToSmartObject',
    'openSmartObjectContents',
    'saveSmartObjectContent',
  ]) {
    assert.doesNotMatch(main, new RegExp('(?:async\\s+)?function ' + name + '\\('));
  }
  assert.match(main, /async function serializePhotoshopEmbeddedAsset\(/);
  assert.match(main, /async function rewritePhotoshopEmbeddedSource\(/);
  assert.doesNotMatch(source, /rewriteEmbeddedLinkedLayerAsset|encodePsdBlob|encodePsbBlob|psdOpaqueBlockFromState/);
});
