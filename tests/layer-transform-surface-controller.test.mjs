import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayerTransformSurfaceController } from '../src/interaction/layer-transform-surface-controller.js';

function layer(overrides = {}) {
  return {
    id: 'layer-1',
    type: 'raster',
    name: '',
    visible: true,
    locked: false,
    groupId: null,
    x: 20,
    y: 30,
    width: 40,
    height: 30,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    ...overrides,
  };
}

function recordingContext() {
  const calls = [];
  const context = {
    calls,
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    setLineDash: values => calls.push(['setLineDash', ...values]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    closePath: () => calls.push(['closePath']),
    stroke: () => calls.push(['stroke']),
    fill: () => calls.push(['fill']),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    strokeRect: (...args) => calls.push(['strokeRect', ...args]),
    arc: (...args) => calls.push(['arc', ...args]),
    roundRect: (...args) => calls.push(['roundRect', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    measureText: text => {
      calls.push(['measureText', text]);
      return { width: String(text).length * 6 };
    },
  };
  for (const property of ['strokeStyle', 'fillStyle', 'lineWidth', 'font', 'textBaseline']) {
    Object.defineProperty(context, property, {
      set: value => calls.push(['set', property, value]),
      get: () => undefined,
    });
  }
  return context;
}

function harness({ selected = layer() } = {}) {
  const documentValue = {
    width: 200,
    height: 160,
    selectedLayerId: selected.id,
    layers: [selected],
    groups: [],
  };
  let currentTool = 'move';
  let zoom = 2;
  let activeInteraction = false;
  let displayLayer = null;
  const controller = createLayerTransformSurfaceController({
    state: { getDocument: () => documentValue },
    runtime: {
      getCurrentTool: () => currentTool,
      getZoom: () => zoom,
      hasActiveInteraction: () => activeInteraction,
      getDisplayLayer: () => displayLayer,
    },
  });
  return {
    controller,
    documentValue,
    selected,
    setCurrentTool: value => { currentTool = value; },
    setZoom: value => { zoom = value; },
    setActiveInteraction: value => { activeInteraction = value; },
    setDisplayLayer: value => { displayLayer = value; },
  };
}

test('surface eligibility excludes Adjustment layers and draws selected frame outside Move mode', () => {
  const h = harness();
  h.setCurrentTool('brush');
  const context = recordingContext();

  assert.equal(h.controller.isTransformableLayer(h.selected), true);
  assert.equal(h.controller.isTransformableLayer(layer({ type:'adjustment' })), false);
  assert.equal(h.controller.draw(context), true);
  assert.ok(context.calls.some(call => call[0] === 'set' && call[1] === 'strokeStyle' && call[2] === '#5ee7ff'));
  assert.equal(context.calls.filter(call => call[0] === 'arc').length, 4);
  assert.ok(context.calls.some(call => call[0] === 'fillText' && call[1] === 'Слой'));
  assert.equal(context.calls.filter(call => call[0] === 'save').length, context.calls.filter(call => call[0] === 'restore').length);

  h.selected.type = 'adjustment';
  assert.equal(h.controller.draw(recordingContext()), false);
});

test('locked selected layers remain visible but expose no interactive Move controls', () => {
  const h = harness();
  h.selected.groupId = 'group-1';
  h.documentValue.groups = [{ id:'group-1', parentGroupId:null, visible:true, locked:true }];
  const context = recordingContext();

  assert.equal(h.controller.draw(context), true);
  assert.ok(context.calls.some(call => call[0] === 'set' && call[1] === 'strokeStyle' && call[2] === '#aeb6c4'));
  assert.equal(context.calls.some(call => call[0] === 'fillRect'), false);
  assert.equal(h.controller.selectedControlHit({ x:40, y:15 }), null);
});

test('unlocked Move presentation keeps resize handles, rotate control and zoom-stable metrics', () => {
  const h = harness();
  const context = recordingContext();

  assert.equal(h.controller.draw(context), true);
  assert.ok(context.calls.some(call => call[0] === 'set' && call[1] === 'strokeStyle' && call[2] === '#69a0ff'));
  assert.ok(context.calls.some(call => call[0] === 'setLineDash' && call[1] === 3 && call[2] === 2));
  assert.equal(context.calls.filter(call => call[0] === 'fillRect' && call[3] === 4 && call[4] === 4).length, 8);
  assert.ok(context.calls.some(call => call[0] === 'arc' && call[3] === 2.5));
  assert.ok(context.calls.some(call => call[0] === 'set' && call[1] === 'font' && call[2] === '600 6px Inter, Arial, sans-serif'));
});

test('rotate projection clamps into canvas and rotate hit keeps exact 10 / zoom boundary', () => {
  const selected = layer({ x:0, y:0, width:20, height:20 });
  const h = harness({ selected });
  h.documentValue.width = 60;
  h.documentValue.height = 50;

  assert.deepEqual(h.controller.interactiveRotationHandlePoint(selected), { x:10, y:4 });
  assert.equal(h.controller.selectedControlHit({ x:15, y:4 })?.kind, 'rotate');
  assert.equal(h.controller.selectedControlHit({ x:15.01, y:4 }), null);
});

test('resize hits share canonical 10 / zoom tolerance and rotated cursor buckets', () => {
  const h = harness();
  assert.equal(h.controller.selectedControlHit({ x:60, y:60 })?.handle, 'se');
  assert.equal(h.controller.selectedControlHit({ x:65, y:60 })?.handle, 'se');
  assert.equal(h.controller.selectedControlHit({ x:65.01, y:60 }), null);

  h.selected.rotation = 45;
  assert.equal(h.controller.cursorForHandle('e', h.selected), 'nwse-resize');
  assert.equal(h.controller.cursorForHandle('n', h.selected), 'nesw-resize');
});

test('idle Move cursor precedence is rotate, resize, selected body, then default', () => {
  const h = harness();

  assert.equal(h.controller.idleCursor({ x:40, y:15 }), 'grab');
  assert.equal(h.controller.idleCursor({ x:60, y:60 }), 'nwse-resize');
  assert.equal(h.controller.idleCursor({ x:40, y:45 }), 'move');
  assert.equal(h.controller.idleCursor({ x:150, y:120 }), 'default');

  h.setActiveInteraction(true);
  assert.equal(h.controller.idleCursor({ x:40, y:45 }), null);
  h.setActiveInteraction(false);
  h.setCurrentTool('brush');
  assert.equal(h.controller.idleCursor({ x:40, y:45 }), null);
});

test('topmost Move target excludes hidden, locked, Adjustment and recursively locked layers', () => {
  const bottom = layer({ id:'bottom', x:0, y:0, width:100, height:100 });
  const hidden = layer({ id:'hidden', x:0, y:0, width:100, height:100, visible:false });
  const adjustment = layer({ id:'adjustment', type:'adjustment', x:0, y:0, width:100, height:100 });
  const recursivelyLocked = layer({ id:'grouped', groupId:'locked-group', x:0, y:0, width:100, height:100 });
  const top = layer({ id:'top', x:0, y:0, width:100, height:100 });
  const h = harness({ selected: adjustment });
  h.documentValue.layers = [bottom, hidden, adjustment, recursivelyLocked, top];
  h.documentValue.groups = [{ id:'locked-group', parentGroupId:null, visible:true, locked:true }];

  assert.equal(h.controller.topLayerAt({ x:50, y:50 }), top);
  assert.equal(h.controller.movePointerIntent({ x:50, y:50 })?.layer, top);
  top.locked = true;
  assert.equal(h.controller.topLayerAt({ x:50, y:50 }), bottom);
});

test('semantic pointer intents preserve control precedence without mutating document state', () => {
  const h = harness();
  const before = JSON.stringify(h.documentValue);

  const rotateIntent = h.controller.movePointerIntent({ x:40, y:15 });
  assert.equal(rotateIntent.kind, 'rotate');
  assert.equal(rotateIntent.layer, h.selected);
  assert.deepEqual(rotateIntent.center, { x:40, y:45 });

  const resizeIntent = h.controller.movePointerIntent({ x:60, y:60 });
  assert.equal(resizeIntent.kind, 'resize');
  assert.equal(resizeIntent.handle, 'se');
  assert.equal(resizeIntent.cursor, 'nwse-resize');

  const moveIntent = h.controller.movePointerIntent({ x:40, y:45 });
  assert.equal(moveIntent.kind, 'move');
  assert.equal(moveIntent.layer, h.selected);
  assert.equal(JSON.stringify(h.documentValue), before);
});

test('draw uses injected text-preview display layer and clamps name badge inside document', () => {
  const h = harness();
  const preview = layer({ id:'preview', name:'Preview', x:-20, y:-10, width:30, height:20 });
  h.setDisplayLayer(preview);
  h.setCurrentTool('brush');
  const context = recordingContext();

  assert.equal(h.controller.draw(context), true);
  const labelCall = context.calls.find(call => call[0] === 'fillText');
  assert.equal(labelCall[1], 'Preview');
  assert.ok(labelCall[2] >= 1);
  assert.ok(labelCall[3] >= 1);
});
