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
      captureSnapshot:() => ({ type:'rect', rect:{ x:0, y:0, width:10, height:10 } }),
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

test('merged selection clear rejects a same-id raster replacement before publication', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const originalLayer = { id:'raster', type:'raster', name:'Raster', visible:true, locked:false, dataUrl:'original' };
  const replacement = { id:'raster', type:'raster', name:'Replacement', visible:true, locked:false, dataUrl:'replacement' };
  const documentValue = { layers:[originalLayer], groups:[], selectedLayerId:'raster' };
  const harness = createHarness({
    documentValue,
    operations:{ prepareClearedRasterDataUrl:async() => pending },
  });

  const clearing = harness.controller.clearAcrossVisibleLayers();
  documentValue.layers[0] = replacement;
  release('cleared');
  const result = await clearing;

  assert.equal(result, null);
  assert.equal(originalLayer.dataUrl, 'original');
  assert.equal(replacement.dataUrl, 'replacement');
  assert.deepEqual(harness.commits, []);
  assert.equal(harness.getPersisting(), false);
  assert.match(harness.statuses.at(-1), /целевой слой изменился или заблокирован/);
});

test('merged selection clear rejects a same-id non-raster replacement instead of redirecting rasterized splice', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const source = { id:'text', type:'text', name:'Text', visible:true, locked:false };
  const replacement = { id:'text', type:'text', name:'Replacement', visible:true, locked:false, marker:'keep' };
  const documentValue = { layers:[source], groups:[], selectedLayerId:'text' };
  const harness = createHarness({
    documentValue,
    operations:{
      rasterizeLayerForPixelEditing:async layer => ({
        ...layer,
        type:'raster',
        width:10,
        height:10,
        dataUrl:'rendered-' + layer.id,
      }),
      prepareClearedRasterDataUrl:async() => pending,
    },
  });

  const clearing = harness.controller.clearAcrossVisibleLayers();
  documentValue.layers[0] = replacement;
  release('cleared-text');
  const result = await clearing;

  assert.equal(result, null);
  assert.equal(documentValue.layers[0], replacement);
  assert.equal(replacement.type, 'text');
  assert.equal(replacement.marker, 'keep');
  assert.deepEqual(harness.commits, []);
  assert.equal(harness.getPersisting(), false);
});

test('merged selection clear publishes none of a prepared batch when one exact target is removed', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const first = { id:'first', type:'raster', name:'First', visible:true, locked:false, dataUrl:'first-original' };
  const second = { id:'second', type:'raster', name:'Second', visible:true, locked:false, dataUrl:'second-original' };
  const documentValue = { layers:[first, second], groups:[], selectedLayerId:'first' };
  const harness = createHarness({
    documentValue,
    operations:{
      prepareClearedRasterDataUrl:async layer => layer === first ? 'first-cleared' : pending,
    },
  });

  const clearing = harness.controller.clearAcrossVisibleLayers();
  documentValue.layers.splice(documentValue.layers.indexOf(first), 1);
  release('second-cleared');
  const result = await clearing;

  assert.equal(result, null);
  assert.equal(first.dataUrl, 'first-original');
  assert.equal(second.dataUrl, 'second-original');
  assert.deepEqual(harness.commits, []);
  assert.equal(harness.getPersisting(), false);
});

test('merged selection clear aborts the whole batch when a target becomes effectively locked', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const layer = {
    id:'grouped',
    type:'raster',
    name:'Grouped',
    visible:true,
    locked:false,
    groupId:'group',
    dataUrl:'original',
  };
  const group = { id:'group', name:'Group', visible:true, locked:false, parentGroupId:null };
  const documentValue = { layers:[layer], groups:[group], selectedLayerId:'grouped' };
  const harness = createHarness({
    documentValue,
    operations:{ prepareClearedRasterDataUrl:async() => pending },
  });

  const clearing = harness.controller.clearAcrossVisibleLayers();
  group.locked = true;
  release('cleared');
  const result = await clearing;

  assert.equal(result, null);
  assert.equal(layer.dataUrl, 'original');
  assert.deepEqual(harness.commits, []);
  assert.equal(harness.getPersisting(), false);
  assert.match(harness.statuses.at(-1), /целевой слой изменился или заблокирован/);
});

test('merged selection clear does not apply a prepared high-depth mutation when another batch target is stale', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const hdr = {
    id:'hdr',
    type:'raster',
    name:'HDR',
    visible:true,
    locked:false,
    dataUrl:'hdr-original',
    highDepthSource:{ model:'rgb' },
  };
  const other = { id:'other', type:'raster', name:'Other', visible:true, locked:false, dataUrl:'other-original' };
  const replacement = { ...other, dataUrl:'replacement' };
  const documentValue = { layers:[hdr, other], groups:[], selectedLayerId:'hdr' };
  let applied = 0;
  const harness = createHarness({
    documentValue,
    rasterEdit:{
      applyHighDepthMutation:() => { applied += 1; },
    },
    operations:{
      prepareClearedHighDepthMutation:async layer => (
        layer === hdr
          ? { cleared:1, mutation:{ dataUrl:'hdr-cleared', highDepthSource:{ model:'rgb' } } }
          : null
      ),
      prepareClearedRasterDataUrl:async layer => layer === other ? pending : 'unused',
    },
  });

  const clearing = harness.controller.clearAcrossVisibleLayers();
  documentValue.layers[1] = replacement;
  release('other-cleared');
  const result = await clearing;

  assert.equal(result, null);
  assert.equal(applied, 0);
  assert.equal(hdr.dataUrl, 'hdr-original');
  assert.equal(replacement.dataUrl, 'replacement');
  assert.deepEqual(harness.commits, []);
  assert.equal(harness.getPersisting(), false);
});

test('merged selection clear keeps every persisted target unchanged when preparation fails', async () => {
  const first = { id:'first', type:'raster', name:'First', visible:true, locked:false, dataUrl:'first-original' };
  const second = { id:'second', type:'raster', name:'Second', visible:true, locked:false, dataUrl:'second-original' };
  const documentValue = { layers:[first, second], groups:[], selectedLayerId:'first' };
  const harness = createHarness({
    documentValue,
    operations:{
      prepareClearedRasterDataUrl:async layer => {
        if (layer === first) return 'first-cleared';
        throw new Error('prepare failed');
      },
    },
  });
  const previousError = console.error;
  console.error = () => {};
  let result;
  try {
    result = await harness.controller.clearAcrossVisibleLayers();
  } finally {
    console.error = previousError;
  }

  assert.equal(result, null);
  assert.equal(first.dataUrl, 'first-original');
  assert.equal(second.dataUrl, 'second-original');
  assert.deepEqual(harness.commits, []);
  assert.equal(harness.getPersisting(), false);
  assert.equal(harness.getClearCount(), 1);
  assert.match(harness.statuses.at(-1), /prepare failed/);
});

test('merged selection clear freezes one selection snapshot across async Canvas target preparation', async () => {
  let releaseFirst;
  const firstPending = new Promise(resolve => { releaseFirst = resolve; });
  const first = { id:'first', type:'raster', name:'First', visible:true, locked:false, dataUrl:'first-original' };
  const second = { id:'second', type:'raster', name:'Second', visible:true, locked:false, dataUrl:'second-original' };
  const documentValue = { layers:[first, second], groups:[], selectedLayerId:'first' };
  let liveSelection = { type:'ellipse', rect:{ x:0, y:0, width:4, height:4 } };
  const intersections = [];
  const preparations = [];
  let captures = 0;
  const harness = createHarness({
    documentValue,
    selection:{
      captureSnapshot:() => {
        captures += 1;
        return liveSelection?.rect
          ? { ...liveSelection, rect:{ ...liveSelection.rect } }
          : { ...liveSelection, points:liveSelection.points.map(point => ({ ...point })) };
      },
      intersectsLayer:(layer, snapshot) => {
        intersections.push({ layer, snapshot });
        return true;
      },
    },
    operations:{
      prepareClearedRasterDataUrl:async(layer, snapshot) => {
        preparations.push({ layer, snapshot });
        if (layer === first) await firstPending;
        return `cleared-${layer.id}-${snapshot.type}`;
      },
    },
  });

  const clearing = harness.controller.clearAcrossVisibleLayers();
  assert.equal(harness.getPersisting(), true);
  liveSelection = {
    type:'polygon',
    points:[{ x:0, y:0 }, { x:4, y:0 }, { x:0, y:4 }],
  };
  releaseFirst();
  const result = await clearing;

  assert.deepEqual(result, { cleared:2, locked:0, rasterized:0 });
  assert.equal(captures, 1);
  assert.equal(intersections.length, 2);
  assert.equal(preparations.length, 2);
  assert.equal(intersections[0].snapshot, intersections[1].snapshot);
  assert.equal(preparations[0].snapshot, preparations[1].snapshot);
  assert.equal(intersections[0].snapshot, preparations[0].snapshot);
  assert.deepEqual(preparations[0].snapshot, { type:'ellipse', rect:{ x:0, y:0, width:4, height:4 } });
  assert.equal(first.dataUrl, 'cleared-first-ellipse');
  assert.equal(second.dataUrl, 'cleared-second-ellipse');
  assert.deepEqual(liveSelection, {
    type:'polygon',
    points:[{ x:0, y:0 }, { x:4, y:0 }, { x:0, y:4 }],
  });
});

test('merged mixed high-depth and Canvas clear keeps the captured selection after live selection is cleared', async () => {
  let releaseHighDepth;
  const highDepthPending = new Promise(resolve => { releaseHighDepth = resolve; });
  const hdr = {
    id:'hdr',
    type:'raster',
    name:'HDR',
    visible:true,
    locked:false,
    dataUrl:'hdr-original',
    highDepthSource:{ model:'rgb' },
  };
  const canvas = { id:'canvas', type:'raster', name:'Canvas', visible:true, locked:false, dataUrl:'canvas-original' };
  const documentValue = { layers:[hdr, canvas], groups:[], selectedLayerId:'hdr' };
  const buffer = createPixelBuffer({
    width:1,
    height:1,
    model:'rgb',
    channels:4,
    bitsPerChannel:32,
    colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([1,0,0,1]),
  });
  let liveSelection = { type:'polygon', points:[{ x:0, y:0 }, { x:2, y:0 }, { x:0, y:2 }] };
  const predicateSnapshots = [];
  const canvasSnapshots = [];
  let applied = 0;
  const harness = createHarness({
    documentValue,
    selection:{
      captureSnapshot:() => ({
        ...liveSelection,
        points:liveSelection.points.map(point => ({ ...point })),
      }),
      predicate:(layer, snapshot) => {
        predicateSnapshots.push({ layer, snapshot });
        return () => true;
      },
    },
    rasterEdit:{
      editableHighDepthBuffer:layer => layer === hdr ? buffer : null,
      prepareHighDepthMutation:async() => {
        await highDepthPending;
        return { dataUrl:'hdr-cleared', highDepthSource:{ model:'rgb' } };
      },
      applyHighDepthMutation:() => { applied += 1; },
    },
    operations:{
      prepareClearedRasterDataUrl:async(layer, snapshot) => {
        canvasSnapshots.push({ layer, snapshot });
        return 'canvas-cleared';
      },
    },
  });

  const clearing = harness.controller.clearAcrossVisibleLayers();
  liveSelection = null;
  releaseHighDepth();
  const result = await clearing;

  assert.deepEqual(result, { cleared:2, locked:0, rasterized:0 });
  assert.equal(applied, 1);
  assert.equal(predicateSnapshots.length, 1);
  assert.equal(canvasSnapshots.length, 1);
  assert.equal(predicateSnapshots[0].snapshot, canvasSnapshots[0].snapshot);
  assert.deepEqual(canvasSnapshots[0].snapshot, {
    type:'polygon',
    points:[{ x:0, y:0 }, { x:2, y:0 }, { x:0, y:2 }],
  });
  assert.equal(canvas.dataUrl, 'canvas-cleared');
  assert.equal(liveSelection, null);
  assert.deepEqual(harness.commits, ['Вырезать выделение']);
});

test('merged selection clear accepts caller-owned context and frozen selection without live recapture',async()=>{
  const layer={id:'r',type:'raster',name:'R',visible:true,locked:false,dataUrl:'old'},doc={layers:[layer],groups:[],selectedLayerId:'r'},snapshot={type:'ellipse',rect:{x:1,y:1,width:4,height:4}};let captures=0;const seen=[];
  const h=createHarness({documentValue:doc,selection:{hasActive:()=>false,captureSnapshot:()=>{captures+=1;return null;},intersectsLayer:(l,s)=>{seen.push(s);return true;}},operations:{prepareClearedRasterDataUrl:async(l,s)=>{seen.push(s);return'new';}}});
  assert.deepEqual(await h.controller.clearAcrossVisibleLayers({ownerDocument:doc,ownerSessionId:'first',selectionSnapshot:snapshot,historyLabel:'Caller cut'}),{cleared:1,locked:0,rasterized:0});
  assert.equal(captures,0);assert.deepEqual(seen,[snapshot,snapshot]);assert.equal(layer.dataUrl,'new');assert.deepEqual(h.commits,['Caller cut']);
});
test('merged selection clear rejects stale caller-owned context before preparation',async()=>{
  const layer={id:'r',type:'raster',name:'R',visible:true,locked:false,dataUrl:'old'},doc={layers:[layer],groups:[],selectedLayerId:'r'};let prepares=0;
  const h=createHarness({documentValue:doc,operations:{prepareClearedRasterDataUrl:async()=>{prepares+=1;return'new';}}});h.stateValue.documentValue={layers:[{...layer}],groups:[],selectedLayerId:'r'};
  assert.equal(await h.controller.clearAcrossVisibleLayers({ownerDocument:doc,ownerSessionId:'first',selectionSnapshot:{type:'rect',rect:{x:0,y:0,width:2,height:2}}}),null);assert.equal(prepares,0);assert.equal(layer.dataUrl,'old');assert.deepEqual(h.commits,[]);
});
