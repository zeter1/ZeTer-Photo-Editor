import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { constrainedRect, normalizeRect } from '../src/core/geometry.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf('async function onOverlayPointerUp(e) {');
const end = main.indexOf("els.overlay.addEventListener('pointerleave'", start);
assert.ok(start >= 0 && end > start);
const pointerUpSource = main.slice(start, end);
const pointerMoveStart = main.indexOf('function onOverlayPointerMove(e) {');
assert.ok(pointerMoveStart >= 0 && pointerMoveStart < start);
const pointerMoveSource = main.slice(pointerMoveStart, start);

function release(drag, point, pointerId = 1, shiftKey = false) {
  const calls = [];
  const context = {
    drag,
    doc: { layers: [{ id:'paint-layer' }] },
    els: { overlay: { style:{} } },
    canvasPoint: event => event.point,
    documentPointToLayerPixel: p => p,
    paintGesture: {
      move: p => calls.push(['paint', p.x, p.y]),
      end: async () => {},
    },
    clearSmartGuides: () => {},
    updateMoveCursor: () => {},
    layerTransformGestures: {
      isGesture: value => ['move','resize','rotate'].includes(value?.kind),
      finish: (value, releasePoint, modifiers) => calls.push(['finish', value.kind, releasePoint.x, releasePoint.y, Boolean(modifiers.shiftKey)]),
    },
    pathControlGestures: {
      isGesture: value => value?.kind === 'path-control',
      finish: (value, releasePoint, modifiers) => calls.push(['path-finish', releasePoint.x, releasePoint.y, Boolean(modifiers.altKey)]),
    },
    onOverlayPointerMove: event => {
      calls.push(['transform', event.point.x, event.point.y]);
    },
    drawLineOnCurrentRaster: (from, to) => calls.push(['line', from.x, from.y, to.x, to.y]),
    constrainedRect,
    normalizeRect,
    createShapeLayer: props => props,
    addLayer: (_, layer) => calls.push(['shape', layer.width, layer.height]),
    commit: label => {
      if (['Перемещение слоя', 'Изменить размер слоя', 'Повернуть слой'].includes(label)) calls.push(['commit', label]);
    },
    applyCrop: (owner, rect) => calls.push(['crop', owner?.id, rect.width, rect.height]),
    applyGradient: (from, to) => calls.push(['gradient', to.x, to.y]),
    setSelectionShape: () => {},
    drawOverlay: () => {},
    setStatus: () => {},
    render: () => {},
    defaultToolCursor: () => 'default',
    currentTool: 'move',
    spaceHeld: false,
  };
  context.els.shapeKind = { value:'rect' };
  context.els.primaryColor = { value:'#123456' };
  context.els.toolOpacity = { value:'100' };
  runInNewContext(`${pointerUpSource}\nglobalThis.__pointerUp = onOverlayPointerUp;`, context);
  return context.__pointerUp({ pointerId, point, shiftKey }).then(() => calls);
}

test('drawing tools use the release position even without a final pointermove', async () => {
  const start = { x:10, y:10 };
  const current = { x:20, y:20 };
  const end = { x:40, y:50 };
  assert.deepEqual(await release({ kind:'line', start, current }, end), [['line',10,10,40,50]]);
  assert.deepEqual(await release({ kind:'shape', start, current, lockAspect:false }, end), [['shape',30,40]]);
  assert.deepEqual(await release({ kind:'crop', start, current, owner:{id:'crop-owner'} }, end), [['crop','crop-owner',30,40]]);
  assert.deepEqual(await release({ kind:'gradient', start, current }, end), [['gradient',40,50]]);
});

test('paint draws the final segment once and ignores an unchanged release point', async () => {
  assert.deepEqual(await release({ kind:'paint', tool:'brush', layerId:'paint-layer', last:{ x:20, y:20 } }, { x:25, y:30 }), [['paint',25,30]]);
  assert.deepEqual(await release({ kind:'paint', tool:'brush', layerId:'paint-layer', last:{ x:20, y:20 } }, { x:20, y:20 }), []);
});

test('transform tools delegate final release geometry to the canonical gesture owner', async () => {
  for (const kind of ['move', 'resize', 'rotate']) {
    assert.deepEqual(await release({ kind }, {x:40,y:50}), [
      ['finish',kind,40,50,false],
    ]);
    assert.deepEqual(await release({ kind }, {x:40,y:50}, 1, true), [
      ['finish',kind,40,50,true],
    ]);
  }
});

test('path-control gesture delegates final release point and Alt state to the canonical owner', async () => {
  assert.deepEqual(await release({kind:'path-control'}, {x:40,y:50}), [
    ['path-finish',40,50,false],
  ]);
});

test('hand tool uses the release position for the final pan', async () => {
  assert.deepEqual(await release({kind:'pan'}, {x:40,y:50}), [['transform',40,50]]);
});

test('shape honors Shift pressed at the release point', async () => {
  assert.deepEqual(await release({kind:'shape', start:{x:10,y:10}, current:{x:20,y:20}, lockAspect:false}, {x:40,y:50}, 1, true), [['shape',40,40]]);
});

test('real transform pointermove delegates point and modifiers to the canonical gesture owner', () => {
  const transformDrag = {kind:'move'};
  const calls = [];
  const context = {
    drag: transformDrag,
    els:{pointer:{}},
    canvasPoint:event=>event.point,
    hoverPoint:null,
    layerTransformGestures:{
      isGesture:value=>value===transformDrag,
      update:(value,point,modifiers)=>calls.push([value.kind,point.x,point.y,Boolean(modifiers.shiftKey),Boolean(modifiers.altKey),Boolean(modifiers.ctrlKey),Boolean(modifiers.metaKey)]),
    },
    pathControlGestures:{isGesture:()=>false},
  };
  runInNewContext(pointerMoveSource + '\nglobalThis.__pointerMove = onOverlayPointerMove;', context);
  context.__pointerMove({point:{x:15,y:25},shiftKey:true,altKey:true,ctrlKey:true,metaKey:false});
  assert.deepEqual(calls, [[
    'move',
    15,
    25,
    true,
    true,
    true,
    false,
  ]]);
});


test('real path-control pointermove delegates the point and Alt modifier to the canonical gesture owner', () => {
  const pathDrag = {kind:'path-control'};
  const calls = [];
  const context = {
    drag:pathDrag,
    els:{pointer:{}},
    canvasPoint:event=>event.point,
    hoverPoint:null,
    layerTransformGestures:{isGesture:()=>false},
    pathControlGestures:{
      isGesture:value=>value===pathDrag,
      update:(value,point,modifiers)=>calls.push([value.kind,point.x,point.y,Boolean(modifiers.altKey)]),
    },
  };
  runInNewContext(pointerMoveSource + '\nglobalThis.__pointerMove = onOverlayPointerMove;', context);
  context.__pointerMove({point:{x:15,y:25},altKey:true});
  assert.deepEqual(calls, [['path-control',15,25,true]]);
});
