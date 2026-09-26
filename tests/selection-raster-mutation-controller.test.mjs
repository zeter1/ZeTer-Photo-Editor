import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { createSelectionRasterMutationController } from '../src/selection/raster-mutation-controller.js';

function createHarness({ documentValue, operations = {}, rasterEdit = {}, selection = {} } = {}) {
  const stateValue = { documentValue, sessionId:'first' };
  let persisting = false;
  const commits = [];
  const statuses = [];
  let clears = 0;
  const edit = {
    editableHighDepthBuffer:() => null,
    prepareHighDepthMutation:async() => null,
    applyHighDepthMutation:() => {},
    drawHighDepthRasterBase:() => false,
    clearBrushBuffer:() => { clears += 1; },
    ...rasterEdit,
  };
  const controller = createSelectionRasterMutationController({
    rasterEdit:edit,
    state:{
      getDocument:() => stateValue.documentValue,
      getActiveSessionId:() => stateValue.sessionId,
      getSelectedLayer:() => stateValue.documentValue?.layers?.find(layer => layer.id === stateValue.documentValue.selectedLayerId) || null,
      isPersisting:() => persisting,
      beginPersist:() => {
        if (persisting) return false;
        persisting = true;
        return true;
      },
      endPersist:() => { persisting = false; },
      blockPendingDocumentEdit:() => false,
    },
    selection:{
      hasActive:() => true,
      intersectsLayer:() => true,
      predicate:() => null,
      clipContext:() => {},
      ...selection,
    },
    ui:{
      setStatus:value => statuses.push(value),
      toast:() => {},
      render:() => {},
      commit:value => commits.push(value),
    },
    operations,
  });
  return { controller, stateValue, edit, commits, statuses, getPersisting:() => persisting, getClearCount:() => clears };
}

test('merged selection clear mutates only visible unlocked pixel targets and rasterizes non-raster layers', async () => {
  const raster = { id:'raster', type:'raster', name:'Raster', visible:true, locked:false, dataUrl:'old-raster' };
  const text = { id:'text', type:'text', name:'Text', visible:true, locked:false };
  const locked = { id:'locked', type:'raster', name:'Locked', visible:true, locked:true, dataUrl:'locked' };
  const adjustment = { id:'adjustment', type:'adjustment', name:'Adjustment', visible:true, locked:false };
  const hidden = { id:'hidden', type:'raster', name:'Hidden', visible:false, locked:false, dataUrl:'hidden' };
  const documentValue = { layers:[raster, text, locked, adjustment, hidden], groups:[], selectedLayerId:'raster' };
  const harness = createHarness({
    documentValue,
    operations:{
      rasterizeLayerForPixelEditing:async layer => ({ ...layer, type:'raster', width:10, height:10, dataUrl:'rendered-' + layer.id }),
      prepareClearedRasterDataUrl:async layer => 'cleared-' + layer.id,
    },
  });

  const result = await harness.controller.clearAcrossVisibleLayers();

  assert.deepEqual(result, { cleared:2, locked:1, rasterized:1 });
  assert.equal(documentValue.layers.find(layer => layer.id === 'raster').dataUrl, 'cleared-raster');
  assert.equal(documentValue.layers.find(layer => layer.id === 'text').type, 'raster');
  assert.equal(documentValue.layers.find(layer => layer.id === 'text').dataUrl, 'cleared-text');
  assert.equal(documentValue.layers.find(layer => layer.id === 'locked').dataUrl, 'locked');
  assert.equal(documentValue.layers.find(layer => layer.id === 'adjustment').type, 'adjustment');
  assert.equal(documentValue.layers.find(layer => layer.id === 'hidden').dataUrl, 'hidden');
  assert.deepEqual(harness.commits, ['Вырезать выделение']);
  assert.equal(harness.getPersisting(), false);
  assert.equal(harness.getClearCount(), 1);
});

test('merged selection clear cancels before mutation when the active document changes during async preparation', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const layer = { id:'raster', type:'raster', name:'Raster', visible:true, locked:false, dataUrl:'original' };
  const original = { layers:[layer], groups:[], selectedLayerId:'raster' };
  const other = { layers:[{ id:'other', type:'raster', visible:true, dataUrl:'other' }], groups:[], selectedLayerId:'other' };
  const harness = createHarness({
    documentValue:original,
    operations:{ prepareClearedRasterDataUrl:async() => pending },
  });

  const clearing = harness.controller.clearAcrossVisibleLayers();
  assert.equal(harness.getPersisting(), true);
  harness.stateValue.documentValue = other;
  harness.stateValue.sessionId = 'second';
  release('cleared');
  const result = await clearing;

  assert.equal(result, null);
  assert.equal(layer.dataUrl, 'original');
  assert.equal(other.layers[0].dataUrl, 'other');
  assert.deepEqual(harness.commits, []);
  assert.equal(harness.getPersisting(), false);
  assert.match(harness.statuses.at(-1), /активный документ изменился/);
});

test('merged high-depth clear keeps typed samples and publishes through the raster edit bridge', async () => {
  const layer = { id:'hdr', type:'raster', name:'HDR', visible:true, locked:false, dataUrl:'preview', highDepthSource:{ model:'rgb' } };
  const documentValue = { layers:[layer], groups:[], selectedLayerId:'hdr' };
  const buffer = createPixelBuffer({
    width:2,
    height:1,
    model:'rgb',
    channels:4,
    bitsPerChannel:32,
    colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([1,0,0,1, 0,1,0,1]),
  });
  let applied = null;
  const harness = createHarness({
    documentValue,
    selection:{ predicate:() => x => x === 1 },
    rasterEdit:{
      editableHighDepthBuffer:() => buffer,
      prepareHighDepthMutation:async() => ({ dataUrl:'next-preview', highDepthSource:{ model:'rgb' } }),
      applyHighDepthMutation:(target, mutation) => { applied = { target, mutation }; },
    },
    operations:{
      prepareClearedRasterDataUrl:async() => { throw new Error('Canvas fallback must not run for editable high-depth source'); },
    },
  });

  const result = await harness.controller.clearAcrossVisibleLayers();

  assert.deepEqual(result, { cleared:1, locked:0, rasterized:0 });
  assert.equal(buffer.data[3], 1);
  assert.equal(buffer.data[7], 0);
  assert.equal(applied.target, layer);
  assert.equal(applied.mutation.dataUrl, 'next-preview');
  assert.deepEqual(harness.commits, ['Вырезать выделение']);
  assert.equal(harness.getPersisting(), false);
});
