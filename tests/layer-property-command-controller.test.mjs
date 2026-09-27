import test from 'node:test';
import assert from 'node:assert/strict';

import { createLayerPropertyCommandController } from '../src/layers/property-command-controller.js';
import {
  createDocument,
  createRasterLayer,
  createShapeLayer,
  createTextLayer,
  createLayerGroup,
  addLayer,
  addLayerGroup,
  DEFAULT_LAYER_FILTERS,
} from '../src/core/state.js';

function createHarness(initialDocument) {
  let activeDocument = initialDocument;
  const commits = [];
  const statuses = [];
  const toasts = [];
  let renders = 0;
  let overlays = 0;
  let refreshes = 0;
  let transientChanges = 0;

  const controller = createLayerPropertyCommandController({
    state: { getDocument: () => activeDocument },
    transaction: {
      commit: label => commits.push(label),
      markTransientChange: () => { transientChanges += 1; },
    },
    rendering: {
      render: () => { renders += 1; },
      drawOverlay: () => { overlays += 1; },
      refreshInspectorPanels: () => { refreshes += 1; },
    },
    ui: {
      setStatus: message => statuses.push(message),
      toast: (...args) => toasts.push(args),
    },
    text: {
      isWeight: value => ['400', '700'].includes(value),
      isStyle: value => ['normal', 'italic'].includes(value),
      isAlign: value => ['left', 'center', 'right'].includes(value),
      fontOptions: value => [[value, value], ['"Segoe UI"', 'Segoe UI']],
    },
    effects: {
      filterKeysForLayer: layer => layer.type === 'raster'
        ? ['brightness', 'contrast', 'saturate', 'exposure', 'blur']
        : ['brightness', 'contrast', 'saturate'],
    },
  });

  return {
    controller,
    commits,
    statuses,
    toasts,
    get renders() { return renders; },
    get overlays() { return overlays; },
    get refreshes() { return refreshes; },
    get transientChanges() { return transientChanges; },
    setDocument(value) { activeDocument = value; },
  };
}

test('generic property command publishes one real change and suppresses no-op/stale writes', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createShapeLayer({ name: 'Before', x: 10 }));
  const h = createHarness(doc);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'x', '25'), true);
  assert.equal(layer.x, 25);
  assert.deepEqual(h.commits, ['Изменить x']);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'x', '25'), false);
  assert.deepEqual(h.commits, ['Изменить x']);

  const other = createDocument();
  h.setDocument(other);
  assert.equal(h.controller.applyProperty(doc, layer.id, 'x', '30'), false);
  assert.equal(layer.x, 25);

  h.setDocument(doc);
  doc.layers = [];
  assert.equal(h.controller.applyProperty(doc, layer.id, 'x', '30'), false);
  assert.deepEqual(h.commits, ['Изменить x']);
});

test('effective ancestor lock blocks persisted layer property mutations', () => {
  const doc = createDocument();
  const group = addLayerGroup(doc, createLayerGroup({ name: 'Locked', locked: true }));
  const layer = addLayer(doc, createShapeLayer({ x: 3, groupId: group.id }));
  const h = createHarness(doc);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'x', '9'), false);
  assert.equal(h.controller.setBlendMode(doc, layer.id, 'multiply'), false);
  assert.equal(h.controller.setOpacity(doc, layer.id, '40'), false);
  assert.equal(layer.x, 3);
  assert.equal(layer.blendMode, 'source-over');
  assert.equal(layer.opacity, 1);
  assert.deepEqual(h.commits, []);
});

test('numeric property validation preserves clamps and raster canvas safety', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createRasterLayer({ name: 'Raster', width: 1000, height: 5000 }));
  const h = createHarness(doc);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'x', 'not-a-number'), false);
  assert.equal(layer.x, 0);
  assert.equal(h.refreshes, 1);
  assert.ok(h.statuses.includes('Некорректное числовое значение'));

  assert.equal(h.controller.applyProperty(doc, layer.id, 'scaleX', '1000'), true);
  assert.equal(layer.scaleX, 100);
  assert.equal(h.controller.applyProperty(doc, layer.id, 'rotation', '-30'), true);
  assert.equal(layer.rotation, 330);
  assert.equal(h.controller.applyProperty(doc, layer.id, 'x', '-999999'), true);
  assert.equal(layer.x, -120000);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'width', '12000'), false);
  assert.equal(layer.width, 1000);
  assert.ok(h.toasts.some(([message]) => String(message).includes('безопасный лимит')));
});

test('text enums reject invalid values and changing font family clears embedded bytes once', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createTextLayer({
    fontFamily: '"Old"',
    fontData: 'data:font/woff2;base64,AA==',
    fontLabel: 'old.woff2',
    fontWeight: '400',
  }));
  const h = createHarness(doc);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'fontWeight', '900'), false);
  assert.equal(layer.fontWeight, '400');

  assert.equal(h.controller.applyProperty(doc, layer.id, 'fontFamily', '"Segoe UI"'), true);
  assert.equal(layer.fontFamily, '"Segoe UI"');
  assert.equal(layer.fontData, null);
  assert.equal(layer.fontLabel, '');
  assert.deepEqual(h.commits, ['Изменить fontFamily']);

  assert.equal(h.controller.applyCustomFont(doc, layer.id, {
    fontFamily: 'ZPE-custom',
    fontData: 'data:font/woff2;base64,BB==',
    fontLabel: 'custom.woff2',
  }), true);
  assert.equal(layer.fontFamily, 'ZPE-custom');
  assert.equal(layer.fontLabel, 'custom.woff2');
  assert.deepEqual(h.commits, ['Изменить fontFamily', 'Изменить шрифт текста']);
});

test('filter live preview renders transiently and final change commits from the original baseline', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createRasterLayer());
  const h = createHarness(doc);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'filters.brightness', '130', { commit: false }), true);
  assert.equal(layer.filters.brightness, 130);
  assert.equal(h.renders, 1);
  assert.equal(h.transientChanges, 1);
  assert.deepEqual(h.commits, []);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'filters.brightness', '130', { commit: true }), true);
  assert.deepEqual(h.commits, ['Изменить фильтр слоя']);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'filters.brightness', '130', { commit: true }), false);
  assert.deepEqual(h.commits, ['Изменить фильтр слоя']);

  assert.equal(h.controller.applyProperty(doc, layer.id, 'filters.brightness', '150', { commit: false }), true);
  assert.equal(h.controller.applyProperty(doc, layer.id, 'filters.brightness', '130', { commit: true }), true);
  assert.equal(layer.filters.brightness, 130);
  assert.deepEqual(h.commits, ['Изменить фильтр слоя']);
});

test('effect reset commits only when a controlled filter differs from defaults', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createRasterLayer({
    filters: { ...DEFAULT_LAYER_FILTERS, brightness: 140, hue: 25 },
  }));
  const h = createHarness(doc);

  assert.equal(h.controller.resetEffects(doc, layer.id), true);
  assert.equal(layer.filters.brightness, 100);
  assert.equal(layer.filters.hue, 25);
  assert.deepEqual(h.commits, ['Сбросить цвет и эффекты']);

  assert.equal(h.controller.resetEffects(doc, layer.id), false);
  assert.deepEqual(h.commits, ['Сбросить цвет и эффекты']);
  assert.ok(h.statuses.includes('Цвет и эффекты уже сброшены'));
});

test('blend and opacity controls share no-op-aware publication with live-preview baseline', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createShapeLayer());
  const h = createHarness(doc);

  assert.equal(h.controller.setBlendMode(doc, layer.id, 'source-over'), false);
  assert.equal(h.controller.setBlendMode(doc, layer.id, 'multiply'), true);
  assert.deepEqual(h.commits, ['Режим наложения']);

  assert.equal(h.controller.setOpacity(doc, layer.id, '65', { commit: false }), true);
  assert.equal(layer.opacity, 0.65);
  assert.equal(h.renders, 1);
  assert.deepEqual(h.commits, ['Режим наложения']);

  assert.equal(h.controller.setOpacity(doc, layer.id, '65', { commit: true }), true);
  assert.deepEqual(h.commits, ['Режим наложения', 'Непрозрачность слоя']);

  assert.equal(h.controller.setOpacity(doc, layer.id, '65', { commit: true }), false);
  assert.deepEqual(h.commits, ['Режим наложения', 'Непрозрачность слоя']);
});

test('HDR preview is exact-owner guarded, no-op aware and reset does not create synthetic history', () => {
  const doc = createDocument();
  const layer = addLayer(doc, createRasterLayer({
    highDepthSource: { bitsPerChannel: 32, model: 'rgb' },
    highDepthPreview: { toneMap: 'auto', displayExposure: 0 },
  }));
  const h = createHarness(doc);

  assert.equal(h.controller.updateHighDepthPreview(doc, layer.id, 'displayExposure', '2.5', { commit: false }), true);
  assert.equal(layer.highDepthPreview.displayExposure, 2.5);
  assert.deepEqual(h.commits, []);

  assert.equal(h.controller.updateHighDepthPreview(doc, layer.id, 'displayExposure', '2.5', { commit: true }), true);
  assert.deepEqual(h.commits, ['Изменить HDR display exposure']);

  const other = createDocument();
  h.setDocument(other);
  assert.equal(h.controller.updateHighDepthPreview(doc, layer.id, 'toneMap', 'aces', { commit: true }), false);
  assert.equal(layer.highDepthPreview.toneMap, 'auto');
  assert.deepEqual(h.commits, ['Изменить HDR display exposure']);

  h.setDocument(doc);
  assert.equal(h.controller.resetHighDepthPreview(doc, layer.id), true);
  assert.deepEqual(layer.highDepthPreview, { toneMap: 'auto', displayExposure: 0 });
  assert.deepEqual(h.commits, ['Изменить HDR display exposure', 'Сбросить HDR preview']);

  assert.equal(h.controller.resetHighDepthPreview(doc, layer.id), false);
  assert.deepEqual(h.commits, ['Изменить HDR display exposure', 'Сбросить HDR preview']);
  assert.ok(h.statuses.includes('HDR preview уже сброшен'));
});
