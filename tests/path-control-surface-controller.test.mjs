import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathControlSurfaceController } from '../src/interaction/path-control-surface-controller.js';

function pathNode(overrides = {}) {
  return {
    x: 10,
    y: 20,
    handleIn: { x: 8, y: 20 },
    handleOut: { x: 12, y: 20 },
    kind: 'smooth',
    ...overrides,
  };
}

function createRecordingContext() {
  const calls = [];
  const context = {
    calls,
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    setLineDash: value => calls.push(['setLineDash', ...value]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    bezierCurveTo: (...args) => calls.push(['bezierCurveTo', ...args]),
    closePath: () => calls.push(['closePath']),
    stroke: () => calls.push(['stroke']),
    fill: () => calls.push(['fill']),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    strokeRect: (...args) => calls.push(['strokeRect', ...args]),
    arc: (...args) => calls.push(['arc', ...args]),
  };
  for (const property of ['lineWidth', 'fillStyle', 'strokeStyle']) {
    Object.defineProperty(context, property, {
      set: value => calls.push(['set', property, value]),
      get: () => undefined,
    });
  }
  return context;
}

function createHarness() {
  const node = pathNode();
  const layer = {
    id: 'shape-1',
    type: 'shape',
    shape: 'path',
    pathPoints: [node],
    pathClosed: true,
    vectorMask: null,
    visible: true,
    locked: false,
    groupId: null,
    x: 100,
    y: 50,
  };
  const documentValue = {
    selectedLayerId: layer.id,
    layers: [layer],
    groups: [],
    paths: [],
  };
  let documentPathEditIndex = -1;
  let vectorMaskEditLayerId = null;
  let currentTool = 'pen';
  let zoom = 2;
  let penDraft = false;
  let activeInteraction = false;
  const cursors = [];

  const controller = createPathControlSurfaceController({
    state: {
      getDocument: () => documentValue,
      getDocumentPathEditIndex: () => documentPathEditIndex,
      setDocumentPathEditIndex: value => { documentPathEditIndex = value; },
      getVectorMaskEditLayerId: () => vectorMaskEditLayerId,
    },
    runtime: {
      getCurrentTool: () => currentTool,
      getZoom: () => zoom,
      hasPenDraft: () => penDraft,
      hasActiveInteraction: () => activeInteraction,
      setCursor: value => cursors.push(value),
    },
    geometry: {
      layerToDocument: (point, targetLayer) => ({
        x: point.x + targetLayer.x,
        y: point.y + targetLayer.y,
      }),
    },
  });

  return {
    controller,
    documentValue,
    layer,
    node,
    cursors,
    setDocumentPathEditIndex: value => { documentPathEditIndex = value; },
    getDocumentPathEditIndex: () => documentPathEditIndex,
    setVectorMaskEditLayerId: value => { vectorMaskEditLayerId = value; },
    setCurrentTool: value => { currentTool = value; },
    setZoom: value => { zoom = value; },
    setPenDraft: value => { penDraft = value; },
    setActiveInteraction: value => { activeInteraction = value; },
  };
}

test('Saved Path edit mode has precedence over the selected layer and preserves open subpaths', () => {
  const h = createHarness();
  h.documentValue.paths = [{
    id: 2007,
    subpaths: [{ closed: false, operation: 'subtract', points: [pathNode({ x: 3, y: 4 })] }],
  }];
  h.setDocumentPathEditIndex(0);

  const targets = h.controller.selectedTargets();
  assert.equal(targets.length, 1);
  assert.equal(targets[0].source, 'document-path');
  assert.equal(targets[0].layer, null);
  assert.equal(targets[0].closed, false);
  assert.equal(targets[0].operation, 'subtract');
  assert.equal(targets[0].documentPathIndex, 0);
});

test('invalid Saved Path edit index is cleared before falling back to the selected Shape path', () => {
  const h = createHarness();
  h.setDocumentPathEditIndex(5);

  const targets = h.controller.selectedTargets();
  assert.equal(h.getDocumentPathEditIndex(), -1);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].source, 'shape');
  assert.equal(targets[0].closed, true);
});

test('Vector Mask discovery requires the selected matching layer and respects inherited visibility', () => {
  const h = createHarness();
  h.layer.vectorMask = {
    subpaths: [{ closed: true, operation: 'exclude', points: [pathNode({ x: 1, y: 2 })] }],
  };
  h.setVectorMaskEditLayerId(h.layer.id);

  assert.equal(h.controller.selectedTargets()[0].source, 'vector-mask');
  assert.equal(h.controller.selectedTargets()[0].operation, 'exclude');

  h.setVectorMaskEditLayerId('other-layer');
  assert.equal(h.controller.selectedTargets()[0].source, 'shape');

  h.layer.groupId = 'group-1';
  h.documentValue.groups = [{ id: 'group-1', visible: false, locked: false, parentGroupId: null }];
  assert.deepEqual(h.controller.selectedTargets(), []);
});

test('recursively locked controls remain discoverable for rendering but are rejected by hit testing', () => {
  const h = createHarness();
  h.layer.groupId = 'group-1';
  h.documentValue.groups = [{ id: 'group-1', visible: true, locked: true, parentGroupId: null }];

  assert.equal(h.controller.selectedTargets().length, 1);
  assert.equal(h.controller.hit({ x: 110, y: 70 }), null);

  const context = createRecordingContext();
  assert.equal(h.controller.draw(context), true);
  assert.ok(context.calls.some(call => call[0] === 'set' && call[1] === 'strokeStyle' && call[2] === '#aeb6c4'));
});

test('layer projection is used for controls, handles win anchor overlap, and default radius scales with zoom', () => {
  const h = createHarness();
  h.node.handleIn = { x: 10, y: 20 };
  h.node.handleOut = null;

  assert.equal(h.controller.hit({ x: 110, y: 70 })?.control, 'handleIn');
  assert.equal(h.controller.hit({ x: 114, y: 70 })?.control, 'handleIn');
  assert.equal(h.controller.hit({ x: 114.01, y: 70 }), null);

  const target = h.controller.selectedTargets()[0];
  assert.equal(h.controller.targetPoints(target), h.layer.pathPoints);
});

test('trace uses cubic handles and closes only closed targets', () => {
  const h = createHarness();
  const target = {
    layer: null,
    source: 'document-path',
    points: [
      pathNode({ x: 0, y: 0, handleIn: null, handleOut: { x: 4, y: 0 } }),
      pathNode({ x: 10, y: 10, handleIn: { x: 6, y: 10 }, handleOut: null }),
    ],
    closed: false,
  };
  const openContext = createRecordingContext();
  assert.equal(h.controller.trace(openContext, target), true);
  assert.ok(openContext.calls.some(call => call[0] === 'bezierCurveTo'));
  assert.equal(openContext.calls.some(call => call[0] === 'closePath'), false);

  target.closed = true;
  const closedContext = createRecordingContext();
  h.controller.trace(closedContext, target);
  assert.equal(closedContext.calls.filter(call => call[0] === 'closePath').length, 1);
});

test('draw keeps overlay metrics zoom-stable and uses dashed Vector Mask styling without leaking canvas state', () => {
  const h = createHarness();
  h.layer.vectorMask = {
    subpaths: [{ closed: true, operation: 'add', points: [h.node] }],
  };
  h.setVectorMaskEditLayerId(h.layer.id);
  h.setZoom(2);
  const context = createRecordingContext();

  assert.equal(h.controller.draw(context), true);
  assert.ok(context.calls.some(call => call[0] === 'set' && call[1] === 'lineWidth' && call[2] === 0.5));
  assert.ok(context.calls.some(call => call[0] === 'set' && call[1] === 'strokeStyle' && call[2] === '#ff78cf'));
  assert.ok(context.calls.some(call => call[0] === 'setLineDash' && call[1] === 2.5 && call[2] === 1.5));
  assert.ok(context.calls.some(call => call[0] === 'fillRect' && call[3] === 2.5 && call[4] === 2.5));
  assert.ok(context.calls.some(call => call[0] === 'arc' && call[3] === 2));
  assert.equal(context.calls.filter(call => call[0] === 'save').length, context.calls.filter(call => call[0] === 'restore').length);
});

test('cursor feedback is owned by the surface and only changes for idle Pen interaction', () => {
  const h = createHarness();

  assert.equal(h.controller.updateCursor({ x: 110, y: 70 }), 'pointer');
  assert.equal(h.controller.updateCursor({ x: 200, y: 200 }), 'crosshair');
  assert.deepEqual(h.cursors, ['pointer', 'crosshair']);

  h.setActiveInteraction(true);
  assert.equal(h.controller.updateCursor({ x: 110, y: 70 }), null);
  h.setActiveInteraction(false);
  h.setPenDraft(true);
  assert.equal(h.controller.updateCursor({ x: 110, y: 70 }), null);
  h.setPenDraft(false);
  h.setCurrentTool('move');
  assert.equal(h.controller.updateCursor({ x: 110, y: 70 }), null);
  assert.deepEqual(h.cursors, ['pointer', 'crosshair']);
});


test('live target resolution rejects stale point-array identity instead of mutating a replacement path', () => {
  const h = createHarness();
  h.node.handleIn = null;
  h.node.handleOut = null;
  const hit = h.controller.hit({ x: 110, y: 70 });
  assert.equal(hit?.control, 'anchor');
  assert.equal(h.controller.resolveTarget(hit)?.node, h.node);

  h.layer.pathPoints = [pathNode({ x: 10, y: 20, handleIn: null, handleOut: null })];
  assert.equal(h.controller.resolveTarget(hit), null);
});
