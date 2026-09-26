import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { constrainedRect, normalizeRect } from '../src/core/geometry.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf("els.overlay.addEventListener('pointerup', async (e) => {");
const end = main.indexOf("els.overlay.addEventListener('pointerleave'", start);
assert.ok(start >= 0 && end > start);
const pointerUpSource = main.slice(start, end);
const pointerMoveStart = main.indexOf('function onOverlayPointerMove(e) {');
assert.ok(pointerMoveStart >= 0 && pointerMoveStart < start);
const pointerMoveSource = main.slice(pointerMoveStart, start);

function release(drag, point, pointerId = 1, shiftKey = false) {
  const calls = [];
  let handler;
  const context = {
    drag,
    activePrimaryPointerId: 1,
    doc: { layers: [{ id:'paint-layer' }] },
    els: { overlay: { style:{}, addEventListener: (_, callback) => { handler = callback; } } },
    canvasPoint: event => event.point,
    documentPointToLayerPixel: p => p,
    paintGesture: {
      move: p => calls.push(['paint', p.x, p.y]),
      end: async () => {},
    },
    clearSmartGuides: () => {},
    updateMoveCursor: () => {},
    onOverlayPointerMove: event => {
      calls.push(['transform', event.point.x, event.point.y]);
      drag.moved = true;
    },
    drawLineOnCurrentRaster: (from, to) => calls.push(['line', from.x, from.y, to.x, to.y]),
    constrainedRect,
    normalizeRect,
    createShapeLayer: props => props,
    addLayer: (_, layer) => calls.push(['shape', layer.width, layer.height]),
    commit: label => {
      if (['Перемещение слоя', 'Изменить размер слоя', 'Повернуть слой'].includes(label)) calls.push(['commit', label]);
    },
    applyCrop: rect => calls.push(['crop', rect.width, rect.height]),
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
  runInNewContext(pointerUpSource, context);
  return handler({ pointerId, point, shiftKey }).then(() => calls);
}

test('drawing tools use the release position even without a final pointermove', async () => {
  const start = { x:10, y:10 };
  const current = { x:20, y:20 };
  const end = { x:40, y:50 };
  assert.deepEqual(await release({ kind:'line', start, current }, end), [['line',10,10,40,50]]);
  assert.deepEqual(await release({ kind:'shape', start, current, lockAspect:false }, end), [['shape',30,40]]);
  assert.deepEqual(await release({ kind:'crop', start, current }, end), [['crop',30,40]]);
  assert.deepEqual(await release({ kind:'gradient', start, current }, end), [['gradient',40,50]]);
});

test('paint draws the final segment once and ignores an unchanged release point', async () => {
  assert.deepEqual(await release({ kind:'paint', tool:'brush', layerId:'paint-layer', last:{ x:20, y:20 } }, { x:25, y:30 }), [['paint',25,30]]);
  assert.deepEqual(await release({ kind:'paint', tool:'brush', layerId:'paint-layer', last:{ x:20, y:20 } }, { x:20, y:20 }), []);
});

test('another pointer cannot finish the active drawing gesture', async () => {
  assert.deepEqual(await release({ kind:'line', start:{x:10,y:10}, current:{x:20,y:20} }, {x:40,y:50}, 2), []);
});

test('transform tools apply the release position before committing', async () => {
  for (const [kind, label] of [
    ['move', 'Перемещение слоя'],
    ['resize', 'Изменить размер слоя'],
    ['rotate', 'Повернуть слой'],
  ]) {
    assert.deepEqual(await release({ kind, moved:false, lastPointer:{x:10,y:10} }, {x:40,y:50 }), [
      ['transform',40,50],
      ['commit',label],
    ]);
    assert.deepEqual(await release({ kind, moved:false, lastPointer:{x:10,y:10} }, {x:40,y:50 }, 2), []);
    assert.deepEqual(await release({ kind, moved:false, lastPointer:{x:40,y:50} }, {x:40,y:50 }), []);
  }
});

test('hand tool uses the release position for the final pan', async () => {
  assert.deepEqual(await release({kind:'pan'}, {x:40,y:50}), [['transform',40,50]]);
});

test('shape honors Shift pressed at the release point', async () => {
  assert.deepEqual(await release({kind:'shape', start:{x:10,y:10}, current:{x:20,y:20}, lockAspect:false}, {x:40,y:50}, 1, true), [['shape',40,40]]);
});

test('real move and hand handlers apply a release with no intermediate move event', async () => {
  for (const kind of ['move', 'pan']) {
    const handlers = {};
    const layer = {id:'layer', x:10, y:20};
    const drag = kind === 'move'
      ? {kind, layerId:'layer', px:5, py:5, x:10, y:20, moved:false, lastPointer:{x:5,y:5}}
      : {kind, x:100, y:100, left:30, top:40};
    const commits = [];
    const viewport = {scrollLeft:30, scrollTop:40};
    const context = {
      drag, activePrimaryPointerId:1, doc:{layers:[layer]},
      els:{overlay:{style:{},addEventListener:(name,handler)=>{handlers[name]=handler;}},pointer:{},viewport},
      canvasPoint:event=>event.point, isLayerLocked:()=>false, smartSnapEnabled:false,
      clearSmartGuides:()=>{}, render:()=>{}, updateTransformPropertyValues:()=>{},
      drawOverlay:()=>{}, updateMoveCursor:()=>{}, defaultToolCursor:()=> 'default',
      commit:label=>commits.push(label), currentTool:'move', spaceHeld:false,
    };
    runInNewContext(pointerMoveSource + pointerUpSource, context);
    await handlers.pointerup({pointerId:1,point:{x:15,y:25},clientX:115,clientY:125});
    if (kind === 'move') {
      assert.deepEqual([layer.x,layer.y], [20,40]);
      assert.deepEqual(commits, ['Перемещение слоя']);
    } else {
      assert.deepEqual([viewport.scrollLeft,viewport.scrollTop], [15,15]);
      assert.deepEqual(commits, []);
    }
  }
});