import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDocument, createRasterLayer, addLayer } from '../src/core/state.js';
import { createLayerBlendingController, createLayerBlendingSession } from '../src/ui/layer-blending-controller.js';

function harness({ styles = null } = {}) {
  const owner = createDocument({ name:'owner', width:320, height:240 });
  const layer = createRasterLayer({ name:'Layer', width:64, height:48, opacity:0.8, blendMode:'source-over', styles });
  addLayer(owner, layer);
  let activeDocument = owner;
  const commits = [], transientChanges = [], renders = [], controlUpdates = [];
  const session = createLayerBlendingSession({
    owner, layer, getDocument:() => activeDocument,
    markTransientChange:() => transientChanges.push(true),
    updateLayerControls:() => controlUpdates.push(true),
    render:() => renders.push(true), commit:label => commits.push(label),
  });
  return { owner, layer, session, commits, transientChanges, renders, controlUpdates,
    setActiveDocument:value => { activeDocument = value; } };
}

test('live preview assigns draft/original state without history', () => {
  const h = harness();
  h.session.draft.blendMode = 'multiply'; h.session.draft.opacity = 55; h.session.draft.styles.fillOpacity = 42;
  assert.equal(h.session.preview(true), true);
  assert.equal(h.layer.blendMode, 'multiply'); assert.equal(h.layer.opacity, 0.55); assert.equal(h.layer.styles.fillOpacity, 42);
  assert.deepEqual(h.commits, []);
  assert.equal(h.session.preview(false), true);
  assert.equal(h.layer.blendMode, 'source-over'); assert.equal(h.layer.opacity, 0.8); assert.equal(h.layer.styles, null);
  assert.deepEqual(h.commits, []);
  assert.equal(h.transientChanges.length, 2); assert.equal(h.renders.length, 2); assert.equal(h.controlUpdates.length, 2);
});

test('Apply commits one real change and keeps null styles null for a no-op', () => {
  const changed = harness(); changed.session.draft.opacity = 60;
  assert.deepEqual(changed.session.apply(), { valid:true, changed:true, committed:true, restored:false });
  assert.equal(changed.layer.opacity, 0.6); assert.equal(changed.layer.styles, null);
  assert.deepEqual(changed.commits, ['Параметры наложения слоя']);
  const noOp = harness(); const result = noOp.session.apply();
  assert.equal(result.valid, true); assert.equal(result.changed, false); assert.equal(result.committed, false);
  assert.equal(noOp.layer.styles, null); assert.deepEqual(noOp.commits, []);
});

test('Cancel rolls preview back and stale document Apply cannot leak draft state', () => {
  const cancelled = harness(); cancelled.session.draft.blendMode = 'screen'; cancelled.session.preview(true);
  assert.equal(cancelled.layer.blendMode, 'screen'); assert.equal(cancelled.session.cancel().restored, true);
  assert.equal(cancelled.layer.blendMode, 'source-over'); assert.deepEqual(cancelled.commits, []);
  const stale = harness(); stale.session.draft.opacity = 25; stale.session.draft.styles.dropShadow.enabled = true;
  stale.session.preview(true);
  stale.setActiveDocument(createDocument({ name:'replacement', width:100, height:100 }));
  const result = stale.session.apply();
  assert.equal(result.valid, false); assert.equal(result.committed, false); assert.equal(result.restored, true);
  assert.equal(stale.layer.opacity, 0.8); assert.equal(stale.layer.styles, null); assert.deepEqual(stale.commits, []);
});

test('lock-after-preview invalidates Apply but still restores original state', () => {
  const h = harness(); h.session.draft.opacity = 30; h.session.preview(true); h.layer.locked = true;
  const result = h.session.apply();
  assert.equal(result.valid, false); assert.equal(result.committed, false); assert.equal(h.layer.opacity, 0.8);
});

test('controller open guard rejects pending edits and locked layers before DOM work', () => {
  const h = harness();
  const pending = createLayerBlendingController({ state:{ getDocument:() => h.owner, blockPendingDocumentEdit:() => true } });
  assert.equal(pending.openBlendingOptions(h.layer), false);
  const locked = createLayerBlendingController({ state:{ getDocument:() => h.owner, blockPendingDocumentEdit:() => false } });
  h.layer.locked = true;
  assert.equal(locked.openBlendingOptions(h.layer), false);
});

test('Layer Blending policy has one controller owner and canonical bundle dependency', async () => {
  const [main, controller, build] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/layer-blending-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../tools/build-bundle.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(main, /createLayerBlendingController/);
  assert.match(main, /layerBlendingController\.syncPreviewCanvas\(\)/);
  assert.match(build, /'src\/ui\/layer-blending-controller\.js'/);
  assert.match(controller, /from '\.\/modal-controller\.js'/);
  assert.match(controller, /makeModalDraggable\(modal,/);
  assert.doesNotMatch(main, /from '\.\/core\/layer-styles\.js'/);
  assert.doesNotMatch(main, /let blendingPreview\s*=/);
  for (const definition of ['function blendingPreviewCrop','function syncBlendingPreviewCanvas','function openBlendingOptions']) {
    assert.equal(main.includes(definition), false, definition + ' must not drift back into main.js');
    assert.equal(controller.includes(definition), true, definition + ' must stay in the controller');
  }
});
