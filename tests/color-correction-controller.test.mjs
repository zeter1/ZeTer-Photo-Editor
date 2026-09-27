import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDocument, createRasterLayer, createTextLayer, addLayer, DEFAULT_LAYER_FILTERS } from '../src/core/state.js';
import {
  createColorCorrectionController,
  createColorCorrectionModalFinalizer,
  createColorCorrectionSession,
} from '../src/ui/color-correction-controller.js';

function colorCorrectionHarness() {
  const owner = createDocument({ name:'owner', width:320, height:240 });
  const layer = createRasterLayer({
    id:'color-layer',
    name:'Color layer',
    width:64,
    height:48,
    filters:{ ...DEFAULT_LAYER_FILTERS, exposure:0.25, contrast:110, blur:4 },
  });
  addLayer(owner, layer);
  let activeDocument = owner;
  const commits = [];
  const transientChanges = [];
  const renders = [];
  const inspectorRefreshes = [];
  const session = createColorCorrectionSession({
    owner,
    layerId:layer.id,
    getDocument:() => activeDocument,
    markTransientChange:() => transientChanges.push(true),
    render:() => renders.push(true),
    refreshInspectorPanels:() => inspectorRefreshes.push(true),
    commit:label => commits.push(label),
  });
  return {
    owner,
    layer,
    session,
    commits,
    transientChanges,
    renders,
    inspectorRefreshes,
    setActiveDocument:value => { activeDocument = value; },
  };
}

test('controller rejects non-raster and effectively locked targets before DOM work', () => {
  const owner = createDocument({ name:'owner', width:100, height:100 });
  const textLayer = createTextLayer({ id:'text-layer' });
  addLayer(owner, textLayer);
  const messages = [];
  const controller = createColorCorrectionController({
    state:{ getDocument:() => owner },
    ui:{ toast:(message,kind) => messages.push(['toast', message, kind]), setStatus:message => messages.push(['status', message]) },
  });
  assert.equal(controller.open(textLayer), false);
  assert.match(messages.flat().join(' '), /растрового слоя/);

  const raster = createRasterLayer({ id:'locked-layer', groupId:'locked-group' });
  owner.layers.push(raster);
  owner.groups.push({ id:'locked-group', name:'Locked', locked:true, visible:true, parentGroupId:null });
  assert.equal(controller.open(raster), false);
  assert.match(messages.flat().join(' '), /заблокированы/);
});

test('live preview clamps to modal ranges, renders without history and repeated input is a no-op', () => {
  const h = colorCorrectionHarness();
  const first = h.session.preview('exposure', 99);
  assert.deepEqual(first, { valid:true, changed:true, reason:null, value:2 });
  assert.equal(h.layer.filters.exposure, 2);
  assert.deepEqual(h.commits, []);
  assert.equal(h.transientChanges.length, 1);
  assert.equal(h.renders.length, 1);

  const repeated = h.session.preview('exposure', '2');
  assert.deepEqual(repeated, { valid:true, changed:false, reason:null, value:2 });
  assert.equal(h.transientChanges.length, 1);
  assert.equal(h.renders.length, 1);

  const invalid = h.session.preview('exposure', 'not-a-number');
  assert.equal(invalid.valid, false);
  assert.equal(invalid.reason, 'invalid-value');
  assert.equal(h.layer.filters.exposure, 2);
});

test('Reset previews canonical defaults in one transient publication and never commits', () => {
  const h = colorCorrectionHarness();
  h.session.preview('exposure', 1.5);
  h.session.preview('saturate', 175);
  const beforeReset = h.transientChanges.length;
  const result = h.session.reset();
  assert.equal(result.valid, true);
  assert.equal(result.changed, true);
  assert.equal(h.layer.filters.exposure, DEFAULT_LAYER_FILTERS.exposure);
  assert.equal(h.layer.filters.saturate, DEFAULT_LAYER_FILTERS.saturate);
  assert.equal(h.transientChanges.length, beforeReset + 1);
  assert.deepEqual(h.commits, []);
});

test('Apply publishes one real history entry and unchanged Apply publishes none', () => {
  const changed = colorCorrectionHarness();
  changed.session.preview('temperature', 40);
  const applied = changed.session.apply();
  assert.deepEqual(applied, { valid:true, changed:true, committed:true, restored:false, reason:null });
  assert.deepEqual(changed.commits, ['Цветокоррекция слоя']);
  assert.equal(changed.layer.filters.temperature, 40);

  const unchanged = colorCorrectionHarness();
  const noOp = unchanged.session.apply();
  assert.equal(noOp.valid, true);
  assert.equal(noOp.changed, false);
  assert.equal(noOp.committed, false);
  assert.deepEqual(unchanged.commits, []);
});

test('Cancel restores the exact originating layer without history', () => {
  const h = colorCorrectionHarness();
  h.session.preview('contrast', 180);
  assert.equal(h.layer.filters.contrast, 180);
  const result = h.session.cancel();
  assert.equal(result.restored, true);
  assert.equal(h.layer.filters.contrast, 110);
  assert.deepEqual(h.commits, []);
  assert.equal(h.inspectorRefreshes.length, 1);
});

test('document switch blocks preview and Apply, restores origin and never touches the new document', () => {
  const h = colorCorrectionHarness();
  h.session.preview('temperature', 60);
  const replacement = createDocument({ name:'replacement', width:100, height:100 });
  const replacementLayer = createRasterLayer({ id:'color-layer', filters:{ ...DEFAULT_LAYER_FILTERS, temperature:-20 } });
  addLayer(replacement, replacementLayer);
  h.setActiveDocument(replacement);

  const preview = h.session.preview('temperature', -80);
  assert.equal(preview.valid, false);
  assert.equal(preview.reason, 'stale-document');
  assert.equal(replacementLayer.filters.temperature, -20);

  const result = h.session.apply();
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'stale-document');
  assert.equal(result.committed, false);
  assert.equal(h.layer.filters.temperature, DEFAULT_LAYER_FILTERS.temperature);
  assert.equal(replacementLayer.filters.temperature, -20);
  assert.deepEqual(h.commits, []);
});

test('missing or replaced target cannot receive stale publication', () => {
  const missing = colorCorrectionHarness();
  missing.session.preview('tint', 35);
  missing.owner.layers = [];
  const missingApply = missing.session.apply();
  assert.equal(missingApply.valid, false);
  assert.equal(missingApply.reason, 'missing-target');
  assert.deepEqual(missing.commits, []);

  const replaced = colorCorrectionHarness();
  const impostor = createRasterLayer({ id:replaced.layer.id, filters:{ ...DEFAULT_LAYER_FILTERS, tint:-15 } });
  replaced.owner.layers = [impostor];
  const stalePreview = replaced.session.preview('tint', 70);
  assert.equal(stalePreview.valid, false);
  assert.equal(stalePreview.reason, 'missing-target');
  assert.equal(impostor.filters.tint, -15);
  assert.deepEqual(replaced.commits, []);
});

test('lock-after-preview blocks Apply, restores the transient state and publishes no history', () => {
  const h = colorCorrectionHarness();
  h.session.preview('vibrance', 55);
  h.layer.locked = true;
  const result = h.session.apply();
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'locked');
  assert.equal(result.committed, false);
  assert.equal(h.layer.filters.vibrance, DEFAULT_LAYER_FILTERS.vibrance);
  assert.deepEqual(h.commits, []);
  assert.equal(h.inspectorRefreshes.length, 1);
});

test('stale Cancel rolls origin back without rendering into the newly active document', () => {
  const h = colorCorrectionHarness();
  h.session.preview('highlights', 45);
  const rendersBeforeSwitch = h.renders.length;
  h.setActiveDocument(createDocument({ name:'replacement', width:100, height:100 }));
  const result = h.session.cancel();
  assert.equal(result.restored, true);
  assert.equal(h.layer.filters.highlights, DEFAULT_LAYER_FILTERS.highlights);
  assert.equal(h.renders.length, rendersBeforeSwitch);
  assert.deepEqual(h.commits, []);
});

test('modal finalization is idempotent and Cancel restores through the same transaction path once', () => {
  const h = colorCorrectionHarness();
  h.session.preview('shadows', -45);
  let closes = 0;
  let focusRestores = 0;
  const statuses = [];
  const finalizer = createColorCorrectionModalFinalizer({
    session:h.session,
    closeModal:() => { closes += 1; },
    restoreFocus:() => { focusRestores += 1; },
    setStatus:message => statuses.push(message),
  });
  const first = finalizer.cancel();
  const second = finalizer.cancel();
  assert.equal(first.restored, true);
  assert.equal(second, null);
  assert.equal(h.layer.filters.shadows, DEFAULT_LAYER_FILTERS.shadows);
  assert.equal(closes, 1);
  assert.equal(focusRestores, 1);
  assert.equal(finalizer.isClosed(), true);
  assert.deepEqual(statuses, ['Цветокоррекция отменена']);
});

test('Color Correction policy has one controller owner and canonical build dependency', async () => {
  const [main, controller, build] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/color-correction-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../tools/build-bundle.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(main, /from '\.\/ui\/color-correction-controller\.js'/);
  assert.match(main, /createColorCorrectionController\(\{/);
  assert.match(main, /colorCorrectionController\.open\(selected\(\)\)/);
  assert.doesNotMatch(main, /function openColorCorrectionDialog\(/);
  assert.doesNotMatch(main, /COLOR_CORRECTION_CONTROLS/);
  assert.match(controller, /export function createColorCorrectionSession/);
  assert.match(controller, /export function createColorCorrectionController/);
  assert.match(controller, /if \(event\.key === 'Escape'\)[\s\S]*finalizer\.cancel\(\)/);
  assert.match(controller, /event\.target === back\)[\s\S]*finalizer\.cancel\(\)/);
  assert.match(build, /'src\/ui\/color-correction-controller\.js'/);
});
