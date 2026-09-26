import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createDocumentSessionController } from '../src/workspace/session-controller.js';
import { createRasterCommandController } from '../src/painting/command-controller.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const boundary = main.slice(main.indexOf('function documentEditPending()'), main.indexOf('function reportRecoveryFailure('));
const fileCommands = main.slice(main.indexOf('function saveProject()'), main.indexOf('function toggleSelectedVisibility()'));
const jumpHistory = main.slice(main.indexOf('function jumpToHistory('), main.indexOf('function updateLayerControls('));
const deleteCommand = main.slice(main.indexOf('function deleteSelected()'), main.indexOf('function duplicateSelected()'));

test('save and tab switch wait for a pending document edit', () => {
  const calls = [];
  const context = {
    paintPersisting: true, drag: null, pointerActive: false,
    pointerLifecycle: { hasActivePointer: () => context.pointerActive },
    RASTER_BRUSH_TOOLS: new Set(['brush']), currentTool: 'brush',
    doc: { name: 'Тест', layers: [] }, dirty: true,
    safeFilename: value => value,
    downloadText: () => calls.push('download'),
    markDirty: value => { context.dirty = value; calls.push('markDirty'); },
    queueRecovery: () => calls.push('queueRecovery'),
    currentSession: () => null,
    saveSmartObjectContent: () => calls.push('saveSmartObjectContent'),
    setStatus: value => calls.push(`status:${value}`),
    toast: () => calls.push('toast'),
    activeSessionId: 'first', documentSessions: [{ id: 'second' }],
    history: { jump: () => { calls.push('jump'); return { snapshot: '{}' }; } },
    syncCurrentSession: () => calls.push('sync'),
    loadSession: () => calls.push('load'),
    updateAll: () => calls.push('update'),
    requestAnimationFrame: () => {}, els: { viewport: { focus: () => {} } },
  };
  runInNewContext(`${boundary}\n${fileCommands}\n${jumpHistory}\nglobalThis.commands={saveProject,jumpToHistory};`, context);
  const tabController = createDocumentSessionController({
    getSessions:()=>context.documentSessions,
    getActiveSessionId:()=>context.activeSessionId,
    setActiveSessionId:value=>{context.activeSessionId=value;},
    getRuntimeState:()=>({doc:context.doc,history:context.history,zoom:.75,dirty:context.dirty,cropRect:null,selectionRect:null,selectionShape:null,selectedDocumentPathIndex:-1}),
    applyRuntimeState:()=>context.loadSession(),
    cloneSelectionShape:shape=>shape?structuredClone(shape):null,
    blockPendingDocumentEdit:()=>context.blockPendingDocumentEdit(),
    updateAll:()=>context.updateAll(),
  });
  context.commands.activateDocumentTab=id=>tabController.activateDocumentTab(id);
  context.commands.saveProject();
  context.commands.activateDocumentTab('second');
  context.commands.jumpToHistory(0);
  assert.equal(context.dirty, true);
  assert.equal(context.activeSessionId, 'first');
  assert.equal(calls.includes('download'), false);
  assert.equal(calls.includes('queueRecovery'), false);
  assert.equal(calls.includes('load'), false);
  assert.equal(calls.includes('jump'), false);

  context.paintPersisting = false;
  context.drag = { kind: 'move' };
  context.commands.saveProject();
  assert.equal(calls.includes('download'), false);
  context.drag = null;
  context.currentTool = 'fill';
  context.pointerActive = true;
  context.commands.saveProject();
  assert.equal(calls.includes('download'), false);
  context.pointerActive = false;
  context.commands.saveProject();
  assert.equal(context.dirty, true);
  assert.ok(calls.includes('download'));
  assert.ok(calls.includes('queueRecovery'));
  assert.equal(calls.includes('markDirty'), false);
});

test('export submits one document snapshot and blocks while raster data is pending', async () => {
  let modal;
  const downloads = [];
  const context = {
    paintPersisting: false, drag: null,
    pointerLifecycle: { hasActivePointer: () => false },
    RASTER_BRUSH_TOOLS: new Set(['brush']), currentTool: 'brush',
    doc: { name: 'До', layers: [{ id: 'one' }] },
    showModal: options => { modal = options; },
    snapshotDocument: value => JSON.stringify(value),
    restoreDocument: value => JSON.parse(value),
    compositeToBlob: async value => { await Promise.resolve(); return JSON.stringify(value); },
    downloadBlob: (blob, name) => downloads.push({ blob, name }),
    safeFilename: value => value,
    MIME_EXT: { 'image/png': 'png' },
    clamp: value => value,
    setStatus: () => {}, toast: () => {}, alert: () => {},
  };
  runInNewContext(`${boundary}\n${fileCommands}\nglobalThis.commands={exportDialog};`, context);
  await context.commands.exportDialog();
  context.paintPersisting = true;
  assert.equal(await modal.onSubmit({ format: 'image/png', quality: '92' }), false);
  assert.equal(downloads.length, 0);

  context.paintPersisting = false;
  const exporting = modal.onSubmit({ format: 'image/png', quality: '92' });
  context.doc.name = 'После';
  context.doc.layers.push({ id: 'two' });
  await exporting;
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, 'До.png');
  assert.deepEqual(JSON.parse(downloads[0].blob).layers, [{ id: 'one' }]);
});

test('fill protects the document while its raster buffer is decoding', async () => {
  let finishDecode;
  let paintPersisting = false;
  const pixels = new Uint8ClampedArray(10 * 10 * 4);
  for (let index = 0; index < 100; index += 1) pixels.set([255,255,255,255], index * 4);
  const layer = { id:'raster', type:'raster', width:10, height:10, highDepthSource:null };
  const rasterEdit = {
    brushCanvas:{ width:10, height:10 },
    brushContext:{
      getImageData:() => ({ data:pixels }),
      putImageData:() => {},
    },
    ensureRasterBuffer:() => new Promise(resolve => { finishDecode = resolve; }),
    persistPaintLayer:async() => true,
    clearBrushBuffer:() => {},
  };
  const controller = createRasterCommandController({
    rasterEdit,
    state:{
      getDocument:() => ({ selectedLayerId:null }),
      isPersisting:() => paintPersisting,
      beginPersist:() => {
        if (paintPersisting) return false;
        paintPersisting = true;
        return true;
      },
      endPersist:() => { paintPersisting = false; },
    },
    target:{
      selected:() => layer,
      atPoint:() => layer,
      isEditableRasterLayer:() => true,
      toLocal:() => ({ x:1, y:1 }),
    },
    selection:{
      hasActive:() => false,
      containsPoint:() => true,
      intersectsLayer:() => true,
      predicate:() => () => true,
      clipContext:() => {},
    },
    tools:{
      primaryColor:() => '#ff0000',
      brushSize:() => 1,
      opacity:() => 1,
      fillTolerance:() => 0,
      rgbToCmyk:() => [0,1,1,0],
    },
    ui:{ setStatus:() => {}, toast:() => {}, render:() => {}, commit:() => {} },
  });

  const fill = controller.fillAt({ x:1, y:1 });
  assert.equal(paintPersisting, true);
  finishDecode();
  await fill;
  assert.equal(paintPersisting, false);
});

test('selected raster layer cannot be deleted before its stroke is committed', () => {
  let removals = 0;
  const context = {
    paintPersisting: true, drag: null,
    pointerLifecycle: { hasActivePointer: () => false },
    RASTER_BRUSH_TOOLS: new Set(['brush']), currentTool: 'brush',
    doc: { layers: [{ id: 'painted' }] },
    selected: () => ({ id: 'painted' }),
    isLayerLocked: () => false,
    removeLayer: () => { removals += 1; },
    commit: () => {}, setStatus: () => {}, toast: () => {},
  };
  runInNewContext(`${boundary}\n${deleteCommand}\nglobalThis.deleteSelected=deleteSelected;`, context);
  context.deleteSelected();
  assert.equal(removals, 0);
  context.paintPersisting = false;
  context.deleteSelected();
  assert.equal(removals, 1);
});