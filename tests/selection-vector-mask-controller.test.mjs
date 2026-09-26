import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createVectorMask } from '../src/core/state.js';
import { createSelectionVectorMaskController } from '../src/selection/vector-mask-controller.js';

function defaultLayer() {
  return {
    id:'layer-1', type:'raster', name:'Layer', locked:false, groupId:null,
    x:0, y:0, width:100, height:80, scaleX:1, scaleY:1, rotation:0, vectorMask:null,
  };
}

function harness({
  layer = defaultLayer(),
  shape = { type:'rect', rect:{ x:10, y:20, width:30, height:40 } },
  geometry = {},
} = {}) {
  let selectedLayer = layer;
  let selectionShape = shape;
  const documentValue = { groups:[], layers:[layer], selectedLayerId:layer.id };
  const commits = [];
  const statuses = [];
  const toasts = [];
  const beginEditCalls = [];
  const clearEditCalls = [];

  const controller = createSelectionVectorMaskController({
    state:{
      getDocument:() => documentValue,
      getSelectedLayer:() => selectedLayer,
      commit:label => commits.push(label),
    },
    selection:{ getSelectionShape:() => selectionShape },
    geometry:{ documentPointToLayer:point => ({ ...point }), ...geometry },
    edit:{
      beginVectorMaskEdit:layerId => beginEditCalls.push(layerId),
      clearVectorMaskEdit:layerId => clearEditCalls.push(layerId),
    },
    ui:{
      setStatus:message => statuses.push(message),
      toast:(message, tone) => toasts.push([message, tone]),
    },
  });

  return {
    controller, documentValue, layer, commits, statuses, toasts, beginEditCalls, clearEditCalls,
    setSelectedLayer:value => { selectedLayer = value; },
    setSelectionShape:value => { selectionShape = value; },
  };
}

test('rectangle selection preserves clockwise document-space nodes', () => {
  const h = harness();
  assert.deepEqual(h.controller.selectionVectorMaskDocumentNodes(), [
    { x:10, y:20 }, { x:40, y:20 }, { x:40, y:60 }, { x:10, y:60 },
  ]);
});

test('ellipse selection preserves cubic Bezier anchors, handles and smooth semantics', () => {
  const h = harness({ shape:{ type:'ellipse', rect:{ x:10, y:20, width:40, height:20 } } });
  const k = .5522847498307936;
  assert.deepEqual(h.controller.selectionVectorMaskDocumentNodes(), [
    { x:50, y:30, handleIn:{ x:50, y:30-k*10 }, handleOut:{ x:50, y:30+k*10 }, kind:'smooth' },
    { x:30, y:40, handleIn:{ x:30+k*20, y:40 }, handleOut:{ x:30-k*20, y:40 }, kind:'smooth' },
    { x:10, y:30, handleIn:{ x:10, y:30+k*10 }, handleOut:{ x:10, y:30-k*10 }, kind:'smooth' },
    { x:30, y:20, handleIn:{ x:30-k*20, y:20 }, handleOut:{ x:30+k*20, y:20 }, kind:'smooth' },
  ]);
});

test('non-rectangular selection uses the bounded 72-point path bridge', () => {
  const calls = [];
  const points = [{ x:1, y:2 }, { x:5, y:2 }, { x:3, y:8 }];
  const shape = { type:'polygon', points };
  const h = harness({
    shape,
    geometry:{
      selectionPathPoints:(value, segments) => {
        calls.push([value, segments]);
        return points;
      },
    },
  });
  assert.deepEqual(h.controller.selectionVectorMaskDocumentNodes(), points);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], shape);
  assert.equal(calls[0][1], 72);
});

test('subpath localizes anchors and Bezier handles through the document-to-layer port', () => {
  const calls = [];
  const h = harness({
    shape:{ type:'ellipse', rect:{ x:10, y:20, width:40, height:20 } },
    geometry:{
      documentPointToLayer:(point, layer) => {
        calls.push([point, layer.id]);
        return { x:point.x-10, y:point.y-20 };
      },
    },
  });
  const path = h.controller.selectionVectorMaskSubpath(h.layer, 'subtract');
  assert.equal(path.operation, 'subtract');
  assert.equal(path.closed, true);
  const first = path.points[0];
  const k = .5522847498307936;
  assert.equal(first.x, 40);
  assert.equal(first.y, 10);
  assert.equal(first.kind, 'smooth');
  assert.equal(first.handleIn.x, 40);
  assert.equal(first.handleOut.x, 40);
  assert.ok(Math.abs(first.handleIn.y - (10-k*10)) < 1e-12);
  assert.ok(Math.abs(first.handleOut.y - (10+k*10)) < 1e-12);
  assert.equal(calls.length, 12);
  assert.ok(calls.every(([, layerId]) => layerId === h.layer.id));
});

test('unknown subpath boolean operation normalizes to add', () => {
  const h = harness();
  assert.equal(h.controller.selectionVectorMaskSubpath(h.layer, 'mystery').operation, 'add');
});

test('replace publishes one canonical Vector Mask and exact history/status', () => {
  const h = harness();
  assert.equal(h.controller.applySelectionToVectorMask('replace'), true);
  assert.equal(h.layer.vectorMask.enabled, true);
  assert.equal(h.layer.vectorMask.invert, false);
  assert.equal(h.layer.vectorMask.subpaths.length, 1);
  assert.equal(h.layer.vectorMask.subpaths[0].operation, 'add');
  assert.deepEqual(h.commits, ['Создать векторную маску']);
  assert.equal(h.statuses.at(-1), 'Векторная маска: 1 контур(ов)');
});

test('add/subtract/intersect/exclude append exact operations and history labels', () => {
  const labels = new Map([
    ['add', 'Добавить контур к векторной маске'],
    ['subtract', 'Вычесть контур из векторной маски'],
    ['intersect', 'Пересечь контуры векторной маски'],
    ['exclude', 'Исключить пересечение векторной маски'],
  ]);
  for (const [operation, label] of labels) {
    const h = harness();
    h.layer.vectorMask = createVectorMask({
      enabled:false,
      subpaths:[{ operation:'add', closed:true, points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}] }],
    });
    assert.equal(h.controller.applySelectionToVectorMask(operation), true);
    assert.equal(h.layer.vectorMask.subpaths.length, 2, operation);
    assert.equal(h.layer.vectorMask.subpaths[1].operation, operation);
    assert.equal(h.layer.vectorMask.enabled, true);
    assert.deepEqual(h.commits, [label]);
  }
});

test('128-subpath guard performs no mutation/history and surfaces the existing warning', () => {
  const h = harness();
  h.layer.vectorMask = createVectorMask({
    enabled:false,
    subpaths:Array.from({ length:128 }, (_, index) => ({
      operation:'add', closed:true, points:[{x:index,y:0},{x:index+1,y:0},{x:index,y:1}],
    })),
  });
  const before = h.layer.vectorMask.subpaths.slice();
  assert.equal(h.controller.applySelectionToVectorMask('add'), false);
  assert.deepEqual(h.layer.vectorMask.subpaths, before);
  assert.equal(h.layer.vectorMask.enabled, false);
  assert.deepEqual(h.commits, []);
  assert.equal(h.statuses.at(-1), 'Векторная маска ограничена 128 контурами');
  assert.deepEqual(h.toasts, [['Векторная маска ограничена 128 контурами', 'warn']]);
});

test('no-layer, no-selection, locked and too-small guards do not publish history', () => {
  const h = harness();
  h.setSelectedLayer(null);
  assert.equal(h.controller.applySelectionToVectorMask('replace'), false);
  assert.equal(h.statuses.at(-1), 'Сначала выберите слой');

  h.setSelectedLayer(h.layer);
  h.setSelectionShape(null);
  assert.equal(h.controller.applySelectionToVectorMask('replace'), false);
  assert.equal(h.statuses.at(-1), 'Сначала создайте выделение');

  h.setSelectionShape({ type:'rect', rect:{ x:0, y:0, width:5, height:5 } });
  h.layer.locked = true;
  assert.equal(h.controller.applySelectionToVectorMask('replace'), false);
  assert.equal(h.statuses.at(-1), 'Слой или его группа заблокированы');

  h.layer.locked = false;
  h.layer.groupId = 'locked-group';
  h.documentValue.groups.push({ id:'locked-group', locked:true, parentGroupId:null });
  assert.equal(h.controller.applySelectionToVectorMask('replace'), false);
  assert.equal(h.statuses.at(-1), 'Слой или его группа заблокированы');

  h.layer.groupId = null;
  h.setSelectionShape({ type:'polygon', points:[{x:0,y:0},{x:1,y:1}] });
  assert.equal(h.controller.applySelectionToVectorMask('replace'), false);
  assert.equal(h.statuses.at(-1), 'Выделение слишком мало для векторной маски');

  assert.deepEqual(h.commits, []);
  assert.equal(h.layer.vectorMask, null);
});

test('edit command enters the narrow Pen port exactly once with exact layer identity', () => {
  const h = harness();
  assert.equal(h.controller.editSelectedVectorMask(), false);
  assert.deepEqual(h.beginEditCalls, []);
  assert.equal(h.statuses.at(-1), 'У выбранного слоя нет векторной маски');

  h.layer.vectorMask = createVectorMask({
    subpaths:[{ operation:'add', points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}] }],
  });
  assert.equal(h.controller.editSelectedVectorMask(), true);
  assert.deepEqual(h.beginEditCalls, [h.layer.id]);
  assert.equal(h.statuses.at(-1), 'Перо: редактирование векторной маски — перетаскивайте anchors и Bézier-handles');

  h.layer.locked = true;
  assert.equal(h.controller.editSelectedVectorMask(), false);
  assert.deepEqual(h.beginEditCalls, [h.layer.id]);
  assert.equal(h.statuses.at(-1), 'Слой или его группа заблокированы');
});

test('toggle, invert and remove preserve exact state/history semantics and clear edit target', () => {
  const h = harness();
  h.layer.vectorMask = createVectorMask({
    enabled:true,
    invert:false,
    subpaths:[{ operation:'add', points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}] }],
  });

  h.controller.toggleSelectedVectorMask();
  assert.equal(h.layer.vectorMask.enabled, false);
  h.controller.toggleSelectedVectorMask();
  assert.equal(h.layer.vectorMask.enabled, true);

  h.controller.invertSelectedVectorMask();
  assert.equal(h.layer.vectorMask.invert, true);
  h.controller.invertSelectedVectorMask();
  assert.equal(h.layer.vectorMask.invert, false);

  h.controller.removeSelectedVectorMask();
  assert.equal(h.layer.vectorMask, null);
  assert.deepEqual(h.clearEditCalls, [h.layer.id]);
  assert.deepEqual(h.commits, [
    'Отключить векторную маску',
    'Включить векторную маску',
    'Инвертировать векторную маску',
    'Отменить инверсию векторной маски',
    'Удалить векторную маску',
  ]);
  assert.equal(h.statuses.at(-1), 'Векторная маска удалена');
});

test('selection Vector Mask commands have one owner while Pen geometry and PSD bridges stay in runtime', async () => {
  const [main, owner, build] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/selection/vector-mask-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../tools/build-bundle.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(main, /createSelectionVectorMaskController/);
  assert.match(main, /beginVectorMaskEdit:\s*layerId\s*=>/);
  assert.match(main, /documentPathEditIndex\s*=\s*-1;\s*vectorMaskEditLayerId\s*=\s*layerId;/);
  assert.match(build, /src\/selection\/vector-mask-controller\.js/);

  for (const definition of [
    'function selectionVectorMaskDocumentNodes(',
    'function selectionVectorMaskSubpath(',
    'function applySelectionToVectorMask(',
    'function editSelectedVectorMask(',
    'function toggleSelectedVectorMask(',
    'function invertSelectedVectorMask(',
    'function removeSelectedVectorMask(',
  ]) {
    assert.equal(main.includes(definition), false, definition + ' must not drift back into main.js');
    assert.equal(owner.includes(definition), true, definition + ' must stay in the selection Vector Mask controller');
  }

  for (const runtimeOwner of [
    'let vectorMaskEditLayerId = null',
    'function selectedEditablePathTargets()',
    'function pathTargetPoints(',
    'function importPsdVectorMask(',
    'function exportPsdVectorMask(',
  ]) {
    assert.equal(main.includes(runtimeOwner), true, runtimeOwner + ' must remain on the runtime/PSD boundary');
    assert.equal(owner.includes(runtimeOwner), false, runtimeOwner + ' must not leak into the selection controller');
  }
});
