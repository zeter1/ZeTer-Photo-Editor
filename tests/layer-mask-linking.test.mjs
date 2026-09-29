import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  layerLocalTransform,
  multiplyAffineTransforms,
  normalizeAffineTransform,
  preserveRelativeLayerTransform,
} from '../src/core/geometry.js';
import {
  addLayer,
  createDocument,
  createLayerMask,
  createRasterLayer,
  sanitizeLayerMask,
} from '../src/core/state.js';
import {
  LAYER_TRANSFORM_COMMAND_RESULT,
  createLayerTransformCommandController,
} from '../src/layers/transform-command-controller.js';
import {
  LAYER_TRANSFORM_GESTURE_RESULT,
  createLayerTransformGestureController,
} from '../src/interaction/layer-transform-gesture-controller.js';

function worldMaskTransform(layer) {
  return multiplyAffineTransforms(layerLocalTransform(layer), normalizeAffineTransform(layer.mask?.transform));
}

function assertMatrixClose(actual, expected, epsilon = 1e-8) {
  for (const key of ['a','b','c','d','e','f']) {
    assert.ok(Math.abs(actual[key] - expected[key]) <= epsilon, `${key}: ${actual[key]} != ${expected[key]}`);
  }
}

function makeLayer(doc, mask = createLayerMask({ dataUrl:'data:image/png;base64,AA==', linked:false })) {
  const layer = addLayer(doc, createRasterLayer({
    name:'Masked',
    x:18, y:24, width:80, height:50,
    scaleX:1.2, scaleY:.8, rotation:17,
    dataUrl:'data:image/png;base64,AA==',
    mask,
  }));
  doc.selectedLayerId = layer.id;
  return layer;
}

test('mask affine preservation keeps document-space coverage invariant across arbitrary layer transforms', () => {
  const before = { x:10, y:20, width:100, height:60, scaleX:1.3, scaleY:.75, rotation:23 };
  const after = { ...before, x:44, y:-7, scaleX:2.1, scaleY:1.4, rotation:-31 };
  const relative = { a:1, b:0, c:0, d:1, e:7, f:-5 };
  const expected = multiplyAffineTransforms(layerLocalTransform(before), relative);
  const preserved = preserveRelativeLayerTransform(before, after, relative);
  const actual = multiplyAffineTransforms(layerLocalTransform(after), normalizeAffineTransform(preserved));
  assertMatrixClose(actual, expected);
});

test('layer-mask sanitizer is backward compatible and preserves bounded unlink transforms', () => {
  assert.equal(sanitizeLayerMask({ enabled:true })?.linked, true);
  assert.equal(sanitizeLayerMask({ enabled:true })?.transform, null);
  assert.deepEqual(sanitizeLayerMask({
    enabled:true,
    linked:false,
    transform:{ a:.5, b:.2, c:-.1, d:2, e:30, f:-12 },
  })?.transform, { a:.5, b:.2, c:-.1, d:2, e:30, f:-12 });
  assert.equal(sanitizeLayerMask({
    enabled:true,
    linked:false,
    transform:{ a:0, b:0, c:0, d:0, e:1, f:1 },
  })?.transform, null);
});

test('discrete transforms keep an unlinked mask fixed but linked masks follow layer content', () => {
  const doc = createDocument({ width:640, height:480 });
  const layer = makeLayer(doc);
  const commits = [];
  const controller = createLayerTransformCommandController({
    state:{ getDocument:() => doc },
    transaction:{ commit:label => commits.push(label) },
  });
  const before = worldMaskTransform(layer);

  assert.equal(controller.nudge(doc, layer.id, 37, -19), LAYER_TRANSFORM_COMMAND_RESULT.COMMITTED);
  assertMatrixClose(worldMaskTransform(layer), before);
  assert.ok(layer.mask.transform);

  layer.mask.linked = true;
  const relative = structuredClone(layer.mask.transform);
  const linkedBefore = worldMaskTransform(layer);
  assert.equal(controller.nudge(doc, layer.id, 11, 6), LAYER_TRANSFORM_COMMAND_RESULT.COMMITTED);
  assert.deepEqual(layer.mask.transform, relative);
  const linkedAfter = worldMaskTransform(layer);
  assert.ok(Math.abs(linkedAfter.e - linkedBefore.e) > 1 || Math.abs(linkedAfter.f - linkedBefore.f) > 1);
  assert.deepEqual(commits, ['Сдвинуть слой', 'Сдвинуть слой']);
});

test('interactive move compensates from the gesture baseline and cancel restores both layer and mask', () => {
  const doc = createDocument({ width:400, height:300 });
  const layer = makeLayer(doc);
  const commits = [];
  const controller = createLayerTransformGestureController({
    state:{ getDocument:() => doc },
    transaction:{ commit:label => commits.push(label) },
    runtime:{
      getZoom:() => 1,
      isSmartSnapEnabled:() => false,
      visibleSnapTargetRects:() => [],
      setSmartGuides:() => {},
      clearSmartGuides:() => {},
      refreshLayerPreview:() => {},
      redrawOverlay:() => {},
    },
  });

  const baseline = { x:layer.x, y:layer.y, transform:layer.mask.transform };
  const worldBefore = worldMaskTransform(layer);
  const gesture = controller.beginMove(doc, layer.id, { x:0, y:0 });
  assert.ok(gesture);
  assert.equal(controller.update(gesture, { x:30, y:12 }), LAYER_TRANSFORM_GESTURE_RESULT.UPDATED);
  assertMatrixClose(worldMaskTransform(layer), worldBefore);
  assert.ok(layer.mask.transform);

  assert.equal(controller.cancel(gesture), LAYER_TRANSFORM_GESTURE_RESULT.CANCELED);
  assert.equal(layer.x, baseline.x);
  assert.equal(layer.y, baseline.y);
  assert.equal(layer.mask.transform, baseline.transform);
  assert.deepEqual(commits, []);
});

test('runtime, PSD export and composition root all consume the mask-link transform contract', async () => {
  const root = new URL('../', import.meta.url);
  const [render, exportController, main, maskController, commandController, gestureController, agents, spec] = await Promise.all([
    readFile(new URL('src/core/render.js', root), 'utf8'),
    readFile(new URL('src/document/psd-export-controller.js', root), 'utf8'),
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/selection/mask-controller.js', root), 'utf8'),
    readFile(new URL('src/layers/transform-command-controller.js', root), 'utf8'),
    readFile(new URL('src/interaction/layer-transform-gesture-controller.js', root), 'utf8'),
    readFile(new URL('AGENTS.md', root), 'utf8'),
    readFile(new URL('docs/architecture/LAYER_MASKS.md', root), 'utf8'),
  ]);
  assert.match(render, /positionLayerMaskCoverage/);
  assert.match(render, /mask\.transform/);
  assert.match(exportController, /layerLocalTransform/);
  assert.match(exportController, /multiplyAffineTransforms/);
  assert.match(main, /Связать \/ отвязать растровую маску/);
  assert.match(maskController, /toggleSelectedLayerMaskLink/);
  assert.match(commandController, /preserveRelativeLayerTransform/);
  assert.match(gestureController, /preserveRelativeLayerTransform/);
  assert.match(agents, /link\/unlink|linked\/unlinked/i);
  assert.match(spec, /inverse\(new layer transform\)/i);
});
