import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYER_TRANSFORM_GESTURE_RESULT,
  createLayerTransformGestureController,
} from '../src/interaction/layer-transform-gesture-controller.js';

function createHarness({
  layer: layerOverrides = {},
  document: documentOverrides = {},
  smartSnap = false,
  zoom = 2,
  geometry: geometryOverrides = {},
} = {}) {
  const layer = {
    id: 'layer-1',
    type: 'raster',
    x: 10,
    y: 20,
    width: 40,
    height: 20,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    visible: true,
    ...layerOverrides,
  };
  const documentValue = {
    width: 200,
    height: 120,
    groups: [],
    layers: [layer],
    ...documentOverrides,
  };
  let activeDocument = documentValue;
  let smartSnapEnabled = smartSnap;
  let zoomValue = zoom;
  const commits = [];
  const guides = [];
  const refreshes = [];
  const snapCalls = [];
  const resizeCalls = [];
  const rotateCalls = [];
  let redraws = 0;

  const geometry = {
    snapLayerMove(source, x, y, options) {
      snapCalls.push({ source, x, y, options });
      if (geometryOverrides.snapLayerMove) return geometryOverrides.snapLayerMove(source, x, y, options);
      return { x, y, guides:{ x:null, y:null } };
    },
    resizeLayerFromPoint(source, handle, point, options) {
      resizeCalls.push({ source, handle, point, options });
      if (geometryOverrides.resizeLayerFromPoint) return geometryOverrides.resizeLayerFromPoint(source, handle, point, options);
      return { ...source };
    },
    rotationFromDrag(initialRotation, center, start, point, snapDegrees) {
      rotateCalls.push({ initialRotation, center, start, point, snapDegrees });
      if (geometryOverrides.rotationFromDrag) {
        return geometryOverrides.rotationFromDrag(initialRotation, center, start, point, snapDegrees);
      }
      return initialRotation;
    },
  };

  const controller = createLayerTransformGestureController({
    state: { getDocument: () => activeDocument },
    transaction: { commit: label => commits.push(label) },
    runtime: {
      getZoom: () => zoomValue,
      isSmartSnapEnabled: () => smartSnapEnabled,
      visibleSnapTargetRects: (owner, layerId) => [{ x:1, y:2, width:3, height:4, owner, layerId }],
      setSmartGuides: value => guides.push(['set', value]),
      clearSmartGuides: () => guides.push(['clear']),
      refreshLayerPreview: current => refreshes.push({
        x: current.x,
        y: current.y,
        scaleX: current.scaleX,
        scaleY: current.scaleY,
        rotation: current.rotation,
      }),
      redrawOverlay: () => { redraws += 1; },
    },
    geometry,
  });

  return {
    controller,
    layer,
    documentValue,
    commits,
    guides,
    refreshes,
    snapCalls,
    resizeCalls,
    rotateCalls,
    redraws: () => redraws,
    setActiveDocument: value => { activeDocument = value; },
    setSmartSnap: value => { smartSnapEnabled = value; },
    setZoom: value => { zoomValue = value; },
  };
}

test('move gesture owns Shift axis lock and publishes one history entry', () => {
  const h = createHarness();
  const gesture = h.controller.beginMove(h.documentValue, h.layer.id, { x:5, y:5 });
  assert.ok(gesture);

  assert.equal(
    h.controller.update(gesture, { x:25, y:9 }, { shiftKey:true }),
    LAYER_TRANSFORM_GESTURE_RESULT.UPDATED,
  );
  assert.deepEqual([h.layer.x, h.layer.y], [30, 20]);
  assert.deepEqual(h.commits, []);

  assert.equal(
    h.controller.finish(gesture, { x:25, y:9 }, { shiftKey:true }),
    LAYER_TRANSFORM_GESTURE_RESULT.COMMITTED,
  );
  assert.deepEqual(h.commits, ['Перемещение слоя']);
  assert.equal(
    h.controller.finish(gesture, { x:25, y:9 }, { shiftKey:true }),
    LAYER_TRANSFORM_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual(h.commits, ['Перемещение слоя']);
});

test('move Smart Snap uses originating owner targets and zoom-stable threshold; Ctrl bypasses it', () => {
  const h = createHarness({
    smartSnap: true,
    geometry: {
      snapLayerMove: () => ({ x:42, y:43, guides:{ x:50, y:60 } }),
    },
  });
  const gesture = h.controller.beginMove(h.documentValue, h.layer.id, { x:0, y:0 });

  assert.equal(
    h.controller.update(gesture, { x:3, y:4 }),
    LAYER_TRANSFORM_GESTURE_RESULT.UPDATED,
  );
  assert.deepEqual([h.layer.x, h.layer.y], [42, 43]);
  assert.equal(h.snapCalls.length, 1);
  assert.equal(h.snapCalls[0].options.threshold, 4);
  assert.equal(h.snapCalls[0].options.targetRects[0].owner, h.documentValue);
  assert.equal(h.snapCalls[0].options.targetRects[0].layerId, h.layer.id);
  assert.deepEqual(h.guides.at(-1), ['set', { x:50, y:60 }]);

  assert.equal(
    h.controller.update(gesture, { x:5, y:6 }, { ctrlKey:true }),
    LAYER_TRANSFORM_GESTURE_RESULT.UPDATED,
  );
  assert.equal(h.snapCalls.length, 1);
  assert.deepEqual([h.layer.x, h.layer.y], [15, 26]);
  assert.deepEqual(h.guides.at(-1), ['clear']);
});

test('resize forwards Shift/Alt modifiers and zoom-aware min size, while a semantic no-op creates no history', () => {
  const changed = createHarness({
    geometry: {
      resizeLayerFromPoint: source => ({ ...source, x:14, y:18, scaleX:2, scaleY:3 }),
    },
  });
  const gesture = changed.controller.beginResize(changed.documentValue, changed.layer.id, 'se', { x:40, y:40 });
  assert.equal(
    changed.controller.update(gesture, { x:60, y:70 }, { shiftKey:true, altKey:true }),
    LAYER_TRANSFORM_GESTURE_RESULT.UPDATED,
  );
  assert.deepEqual(changed.resizeCalls[0].options, {
    minSize: 3,
    lockAspect: true,
    fromCenter: true,
  });
  assert.deepEqual([changed.layer.x, changed.layer.y, changed.layer.scaleX, changed.layer.scaleY], [14, 18, 2, 3]);
  assert.equal(
    changed.controller.finish(gesture, { x:60, y:70 }, { shiftKey:true, altKey:true }),
    LAYER_TRANSFORM_GESTURE_RESULT.COMMITTED,
  );
  assert.deepEqual(changed.commits, ['Изменить размер слоя']);

  const noop = createHarness();
  const noopGesture = noop.controller.beginResize(noop.documentValue, noop.layer.id, 'se', { x:40, y:40 });
  assert.equal(
    noop.controller.finish(noopGesture, { x:60, y:70 }, { shiftKey:true, altKey:true }),
    LAYER_TRANSFORM_GESTURE_RESULT.NOOP,
  );
  assert.deepEqual(noop.commits, []);
  assert.deepEqual([noop.layer.x, noop.layer.y, noop.layer.scaleX, noop.layer.scaleY], [10, 20, 1, 1]);
});

test('rotate uses 15 degree Shift snapping and applies the final release point without a prior move event', () => {
  const h = createHarness({
    geometry: {
      rotationFromDrag: () => 30,
    },
  });
  const gesture = h.controller.beginRotate(
    h.documentValue,
    h.layer.id,
    { x:30, y:0 },
    { x:30, y:30 },
  );

  assert.equal(
    h.controller.finish(gesture, { x:60, y:30 }, { shiftKey:true }),
    LAYER_TRANSFORM_GESTURE_RESULT.COMMITTED,
  );
  assert.equal(h.rotateCalls.length, 1);
  assert.equal(h.rotateCalls[0].snapDegrees, 15);
  assert.equal(h.layer.rotation, 30);
  assert.deepEqual(h.commits, ['Повернуть слой']);
});

test('returning to the captured move baseline is a semantic no-op with zero history', () => {
  const h = createHarness();
  const gesture = h.controller.beginMove(h.documentValue, h.layer.id, { x:0, y:0 });
  h.controller.update(gesture, { x:20, y:10 });
  assert.deepEqual([h.layer.x, h.layer.y], [30, 30]);
  h.controller.update(gesture, { x:0, y:0 });
  assert.deepEqual([h.layer.x, h.layer.y], [10, 20]);
  assert.equal(
    h.controller.finish(gesture, { x:0, y:0 }),
    LAYER_TRANSFORM_GESTURE_RESULT.NOOP,
  );
  assert.deepEqual(h.commits, []);
});

test('cancel restores captured move, resize and rotate baselines without history', () => {
  const cases = [
    {
      begin: h => h.controller.beginMove(h.documentValue, h.layer.id, { x:0, y:0 }),
      update: (h, gesture) => h.controller.update(gesture, { x:10, y:10 }),
      assertRestored: h => assert.deepEqual([h.layer.x, h.layer.y], [10, 20]),
      options: {},
    },
    {
      begin: h => h.controller.beginResize(h.documentValue, h.layer.id, 'se', { x:0, y:0 }),
      update: (h, gesture) => h.controller.update(gesture, { x:10, y:10 }),
      assertRestored: h => assert.deepEqual([h.layer.x, h.layer.y, h.layer.scaleX, h.layer.scaleY], [10, 20, 1, 1]),
      options: {
        geometry: {
          resizeLayerFromPoint: source => ({ ...source, x:12, y:22, scaleX:2, scaleY:2 }),
        },
      },
    },
    {
      begin: h => h.controller.beginRotate(h.documentValue, h.layer.id, { x:0, y:0 }, { x:10, y:10 }),
      update: (h, gesture) => h.controller.update(gesture, { x:20, y:10 }),
      assertRestored: h => assert.equal(h.layer.rotation, 0),
      options: {
        geometry: {
          rotationFromDrag: () => 45,
        },
      },
    },
  ];

  for (const item of cases) {
    const h = createHarness(item.options);
    const gesture = item.begin(h);
    assert.equal(item.update(h, gesture), LAYER_TRANSFORM_GESTURE_RESULT.UPDATED);
    assert.equal(h.controller.cancel(gesture), LAYER_TRANSFORM_GESTURE_RESULT.CANCELED);
    item.assertRestored(h);
    assert.deepEqual(h.commits, []);
  }
});

test('stale documents, missing targets and same-id replacement objects are rejected', () => {
  const stale = createHarness();
  const staleGesture = stale.controller.beginMove(stale.documentValue, stale.layer.id, { x:0, y:0 });
  const replacementDocument = {
    ...stale.documentValue,
    layers: [{ ...stale.layer }],
  };
  stale.setActiveDocument(replacementDocument);
  assert.equal(
    stale.controller.update(staleGesture, { x:10, y:10 }),
    LAYER_TRANSFORM_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual([stale.layer.x, stale.layer.y], [10, 20]);

  const replaced = createHarness();
  const replacedGesture = replaced.controller.beginMove(replaced.documentValue, replaced.layer.id, { x:0, y:0 });
  const impostor = { ...replaced.layer };
  replaced.documentValue.layers[0] = impostor;
  assert.equal(
    replaced.controller.update(replacedGesture, { x:10, y:10 }),
    LAYER_TRANSFORM_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual([impostor.x, impostor.y], [10, 20]);

  const missing = createHarness();
  const missingGesture = missing.controller.beginMove(missing.documentValue, missing.layer.id, { x:0, y:0 });
  missing.documentValue.layers.length = 0;
  assert.equal(
    missing.controller.finish(missingGesture, { x:10, y:10 }),
    LAYER_TRANSFORM_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual(missing.commits, []);
});

test('recursive lock acquired mid-gesture stops further writes and final history publication', () => {
  const h = createHarness({
    layer: { groupId:'group-1' },
    document: { groups:[{ id:'group-1', locked:false }] },
  });
  const gesture = h.controller.beginMove(h.documentValue, h.layer.id, { x:0, y:0 });
  assert.equal(
    h.controller.update(gesture, { x:10, y:10 }),
    LAYER_TRANSFORM_GESTURE_RESULT.UPDATED,
  );
  assert.deepEqual([h.layer.x, h.layer.y], [20, 30]);

  h.documentValue.groups[0].locked = true;
  assert.equal(
    h.controller.update(gesture, { x:20, y:20 }),
    LAYER_TRANSFORM_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual([h.layer.x, h.layer.y], [20, 30]);
  assert.equal(
    h.controller.finish(gesture, { x:20, y:20 }),
    LAYER_TRANSFORM_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual(h.commits, []);
});

test('cancel after a document switch never restores geometry into the new document', () => {
  const h = createHarness();
  const gesture = h.controller.beginMove(h.documentValue, h.layer.id, { x:0, y:0 });
  h.controller.update(gesture, { x:10, y:10 });
  assert.deepEqual([h.layer.x, h.layer.y], [20, 30]);

  const newLayer = { ...h.layer, x:100, y:200 };
  const newDocument = { ...h.documentValue, layers:[newLayer] };
  h.setActiveDocument(newDocument);
  assert.equal(
    h.controller.cancel(gesture),
    LAYER_TRANSFORM_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual([newLayer.x, newLayer.y], [100, 200]);
  assert.deepEqual([h.layer.x, h.layer.y], [20, 30]);
  assert.deepEqual(h.commits, []);
});
