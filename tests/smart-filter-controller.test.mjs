import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  addLayer,
  createDocument,
  createSmartFilter,
  createSmartFilterMask,
  createSmartObjectLayer,
  MAX_SMART_FILTERS,
} from '../src/core/state.js';
import { createSmartFilterController } from '../src/ui/smart-filter-controller.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function smartObject(overrides = {}) {
  return createSmartObjectLayer({
    width:32,
    height:32,
    smartFilters:[createSmartFilter({ id:'filter-a', name:'A' })],
    ...overrides,
  });
}

function harness(layer = smartObject(), overrides = {}) {
  const documentValue = createDocument({ name:'smart-filter-controller', width:64, height:64 });
  addLayer(documentValue, layer);
  let activeDocument = documentValue;
  let selectedLayer = layer;
  let selectionShape = null;
  let pending = false;
  let selectionMaskFactory = overrides.selectionMaskDataUrl || (async () => 'data:image/png;base64,MASK');
  const commits = [];
  const statuses = [];
  const toasts = [];
  const renders = [];
  const dirties = [];
  const inspectorRefreshes = [];

  const controller = createSmartFilterController({
    state:{
      getDocument:() => activeDocument,
      getSelectedLayer:() => selectedLayer,
      commit:label => commits.push(label),
      markDirty:value => dirties.push(value),
      blockPendingDocumentEdit:() => pending,
    },
    selection:{
      getSelectionShape:() => selectionShape,
      selectionMaskDataUrl:layerValue => selectionMaskFactory(layerValue),
    },
    renderApi:{
      render:() => renders.push(true),
      refreshInspectorPanels:() => inspectorRefreshes.push(true),
    },
    ui:{
      setStatus:value => statuses.push(value),
      toast:(message, tone) => toasts.push([message, tone]),
      escapeHtml,
      formatFilterValue:(_key, value) => String(value),
      ...overrides.ui,
    },
  });

  return {
    controller,
    documentValue,
    layer,
    commits,
    statuses,
    toasts,
    renders,
    dirties,
    inspectorRefreshes,
    setActiveDocument:value => { activeDocument = value; },
    setSelectedLayer:value => { selectedLayer = value; },
    setSelectionShape:value => { selectionShape = value; },
    setPending:value => { pending = value; },
    setSelectionMaskFactory:value => { selectionMaskFactory = value; },
  };
}

test('stack commands preserve order, enable state, labels and locked-target guards', () => {
  const layer = smartObject({
    smartFilters:[
      createSmartFilter({ id:'one', name:'One' }),
      createSmartFilter({ id:'two', name:'Two' }),
    ],
  });
  const h = harness(layer);

  assert.equal(h.controller.moveSmartFilter(layer, 1, -1), true);
  assert.deepEqual(layer.smartFilters.map(item => item.id), ['two', 'one']);
  assert.equal(h.commits.at(-1), 'Поднять смарт-фильтр');

  assert.equal(h.controller.toggleSmartFilter(layer, 0), true);
  assert.equal(layer.smartFilters[0].enabled, false);
  assert.equal(h.commits.at(-1), 'Отключить смарт-фильтр');

  assert.equal(h.controller.removeSmartFilter(layer, 0), true);
  assert.deepEqual(layer.smartFilters.map(item => item.id), ['one']);
  assert.equal(h.commits.at(-1), 'Удалить смарт-фильтр');

  assert.equal(h.controller.clearSmartFilters(layer), true);
  assert.deepEqual(layer.smartFilters, []);
  assert.equal(layer.smartFilterMask, null);
  assert.equal(h.commits.at(-1), 'Очистить смарт-фильтры');

  const before = h.commits.length;
  layer.locked = true;
  layer.smartFilters = [createSmartFilter({ id:'locked' })];
  assert.equal(h.controller.moveSmartFilter(layer, 0, 1), false);
  assert.equal(h.controller.toggleSmartFilter(layer, 0), false);
  assert.equal(h.controller.removeSmartFilter(layer, 0), false);
  assert.equal(h.controller.clearSmartFilters(layer), false);
  assert.equal(h.commits.length, before);
});

test('removing the last Smart Filter clears its shared mask', () => {
  const layer = smartObject({
    smartFilters:[createSmartFilter({ id:'only' })],
    smartFilterMask:createSmartFilterMask({ dataUrl:'data:image/png;base64,MASK' }),
  });
  const h = harness(layer);

  assert.equal(h.controller.removeSmartFilter(layer, 0), true);
  assert.deepEqual(layer.smartFilters, []);
  assert.equal(layer.smartFilterMask, null);
  assert.equal(h.commits.at(-1), 'Удалить смарт-фильтр');
});

test('show-all and selection masks publish through the originating document owner', async () => {
  const h = harness();
  assert.equal(await h.controller.setSmartFilterMask(h.layer, false), true);
  assert.equal(h.layer.smartFilterMask.dataUrl, null);
  assert.equal(h.commits.at(-1), 'Маска смарт-фильтров: показать всё');

  h.setSelectionShape({ type:'rect', x:0, y:0, width:4, height:4 });
  assert.equal(await h.controller.setSmartFilterMask(h.layer, true), true);
  assert.equal(h.layer.smartFilterMask.dataUrl, 'data:image/png;base64,MASK');
  assert.equal(h.commits.at(-1), 'Маска смарт-фильтров из выделения');
});

test('document switch while selection-mask preparation awaits publishes nothing', async () => {
  let resolveMask;
  const maskReady = new Promise(resolve => { resolveMask = resolve; });
  const h = harness(undefined, { selectionMaskDataUrl:async () => maskReady });
  h.setSelectionShape({ type:'rect', x:0, y:0, width:4, height:4 });

  const pending = h.controller.setSmartFilterMask(h.layer, true);
  const replacement = createDocument({ name:'replacement', width:10, height:10 });
  h.setActiveDocument(replacement);
  resolveMask('data:image/png;base64,STALE');

  assert.equal(await pending, false);
  assert.equal(h.layer.smartFilterMask, null);
  assert.deepEqual(h.commits, []);
});

test('mask commands preserve toggle, invert, remove and live-preview commit semantics', () => {
  const layer = smartObject({
    smartFilterMask:createSmartFilterMask({ density:1, feather:0 }),
  });
  const h = harness(layer);

  assert.equal(h.controller.toggleSmartFilterMask(layer), true);
  assert.equal(layer.smartFilterMask.enabled, false);
  assert.equal(h.commits.at(-1), 'Отключить маску смарт-фильтров');

  assert.equal(h.controller.invertSmartFilterMask(layer), true);
  assert.equal(layer.smartFilterMask.invert, true);
  assert.equal(h.commits.at(-1), 'Инвертировать маску смарт-фильтров');

  const commitsBeforePreview = h.commits.length;
  assert.equal(h.controller.updateSmartFilterMaskSetting(layer, 'density', -5, false), true);
  assert.equal(layer.smartFilterMask.density, 0);
  assert.equal(h.commits.length, commitsBeforePreview);
  assert.equal(h.dirties.at(-1), true);
  assert.equal(h.renders.length, 1);

  assert.equal(h.controller.updateSmartFilterMaskSetting(layer, 'feather', 999, true), true);
  assert.equal(layer.smartFilterMask.feather, 250);
  assert.equal(h.commits.at(-1), 'Изменить растушёвку маски смарт-фильтров');

  assert.equal(h.controller.removeSmartFilterMask(layer), true);
  assert.equal(layer.smartFilterMask, null);
  assert.equal(h.commits.at(-1), 'Удалить маску смарт-фильтров');
});

test('mask creation keeps pending-edit and selection-required guards intact', async () => {
  const h = harness();
  h.setPending(true);
  assert.equal(await h.controller.setSmartFilterMask(h.layer, false), false);
  assert.deepEqual(h.commits, []);

  h.setPending(false);
  assert.equal(await h.controller.setSmartFilterMask(h.layer, true), false);
  assert.equal(h.statuses.at(-1), 'Сначала создайте выделение');
  assert.equal(h.layer.smartFilterMask, null);
});

test('stack markup reflects selection availability and escapes filter names', () => {
  const layer = smartObject({
    smartFilters:[createSmartFilter({ name:'<unsafe>' })],
  });
  const h = harness(layer);

  const withoutSelection = h.controller.smartFilterStackMarkup(layer);
  assert.match(withoutSelection, /data-smart-filter-mask-selection disabled/);
  assert.match(withoutSelection, /&lt;unsafe&gt;/);

  h.setSelectionShape({ type:'rect' });
  const withSelection = h.controller.smartFilterStackMarkup(layer);
  assert.doesNotMatch(withSelection, /data-smart-filter-mask-selection disabled/);
});

test('max-filter guard uses the canonical state limit before opening the modal', () => {
  const layer = smartObject({
    smartFilters:Array.from({ length:MAX_SMART_FILTERS }, (_, index) =>
      createSmartFilter({ id:'filter-' + index, name:'Filter ' + index })
    ),
  });
  const h = harness(layer);
  const before = structuredClone(layer.smartFilters);

  assert.equal(h.controller.hasSmartFilterCapacity(layer), false);
  assert.equal(h.controller.openSmartFilterDialog(layer), undefined);
  assert.deepEqual(layer.smartFilters, before);
  assert.equal(h.statuses.at(-1), 'Достигнут лимит: ' + MAX_SMART_FILTERS + ' смарт-фильтра');
  assert.deepEqual(h.toasts.at(-1), ['Достигнут лимит: ' + MAX_SMART_FILTERS + ' смарт-фильтра', 'warn']);
  assert.deepEqual(h.commits, []);
});

test('Smart Filter policy has one controller owner while state/render mechanisms stay canonical', async () => {
  const [main, controller, state, render] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/smart-filter-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/core/state.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/core/render.js', import.meta.url), 'utf8'),
  ]);

  assert.match(main, /createSmartFilterController/);
  for (const definition of [
    'function smartFilterMaskMarkup',
    'function smartFilterStackMarkup',
    'function smartFilterTarget',
    'function moveSmartFilter',
    'function toggleSmartFilter',
    'function removeSmartFilter',
    'function clearSmartFilters',
    'async function setSmartFilterMask',
    'function toggleSmartFilterMask',
    'function invertSmartFilterMask',
    'function removeSmartFilterMask',
    'function updateSmartFilterMaskSetting',
    'function bindSmartFilterControls',
    'function openSmartFilterDialog',
  ]) {
    assert.equal(main.includes(definition), false, definition + ' must not drift back into main.js');
    assert.equal(controller.includes(definition), true, definition + ' must stay in the controller');
  }
  assert.match(state, /export const MAX_SMART_FILTERS = 24;/);
  assert.match(state, /export function createSmartFilter\(/);
  assert.match(state, /export function createSmartFilterMask\(/);
  assert.match(render, /async function applySmartFilterMask\(/);
});
