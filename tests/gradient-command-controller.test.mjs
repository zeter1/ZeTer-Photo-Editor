import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/core/state.js';
import {
  GRADIENT_COMMAND_REASON,
  GRADIENT_COMMAND_RESULT,
  createGradientCommandController,
} from '../src/painting/gradient-command-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeCanvasHarness() {
  const calls = {
    linear:[],
    radial:[],
    stops:[],
    save:0,
    restore:0,
    fillRect:[],
  };
  const context = {
    globalAlpha:1,
    fillStyle:null,
    createLinearGradient(...args) {
      calls.linear.push(args);
      return { addColorStop:(offset, color) => calls.stops.push([offset, color]) };
    },
    createRadialGradient(...args) {
      calls.radial.push(args);
      return { addColorStop:(offset, color) => calls.stops.push([offset, color]) };
    },
    save() { calls.save += 1; },
    restore() { calls.restore += 1; },
    fillRect(...args) { calls.fillRect.push(args); },
  };
  const canvas = {
    width:0,
    height:0,
    getContext:(type, options) => {
      assert.equal(type, '2d');
      assert.deepEqual(options, { alpha:true });
      return context;
    },
  };
  return { canvas, context, calls };
}

function makeHarness({
  doc = createDocument({ width:100, height:80 }),
  activeDoc = doc,
  persisting = false,
  type = 'linear',
  primaryColor = '#112233',
  secondaryColor = '#ddeeff',
  opacity = 0.65,
  serialize = async () => 'data:image/png;base64,gradient',
} = {}) {
  let currentDocument = activeDoc;
  let busy = persisting;
  let beginCalls = 0;
  let endCalls = 0;
  let clearCalls = 0;
  let canvasCreates = 0;
  const canvasHarness = makeCanvasHarness();
  const clips = [];
  const commits = [];
  const statuses = [];
  const toasts = [];
  const errors = [];

  const controller = createGradientCommandController({
    rasterEdit:{
      clearBrushBuffer:() => { clearCalls += 1; },
    },
    state:{
      getDocument:() => currentDocument,
      isPersisting:() => busy,
      beginPersist:() => {
        beginCalls += 1;
        if (busy) return false;
        busy = true;
        return true;
      },
      endPersist:() => {
        endCalls += 1;
        busy = false;
      },
    },
    runtime:{
      createCanvas:() => {
        canvasCreates += 1;
        return canvasHarness.canvas;
      },
    },
    selection:{
      clipContext:(context, owner) => clips.push([context, owner]),
    },
    tools:{
      type:() => type,
      primaryColor:() => primaryColor,
      secondaryColor:() => secondaryColor,
      opacity:() => opacity,
    },
    io:{ canvasToDataURL:serialize },
    transaction:{ commit:label => commits.push(label) },
    ui:{
      setStatus:value => statuses.push(value),
      toast:(message, tone) => toasts.push([message, tone]),
      consoleRef:{ error:value => errors.push(value) },
    },
  });

  return {
    controller,
    doc,
    canvasHarness,
    clips,
    commits,
    statuses,
    toasts,
    errors,
    setDocument:value => { currentDocument = value; },
    setPersisting:value => { busy = value; },
    getPersisting:() => busy,
    getBeginCalls:() => beginCalls,
    getEndCalls:() => endCalls,
    getClearCalls:() => clearCalls,
    getCanvasCreates:() => canvasCreates,
  };
}

test('Gradient command validates every effectful bridge group', () => {
  const base = {
    rasterEdit:{ clearBrushBuffer() {} },
    state:{
      getDocument() {},
      isPersisting() { return false; },
      beginPersist() { return true; },
      endPersist() {},
    },
    runtime:{ createCanvas() {} },
    selection:{ clipContext() {} },
    tools:{
      type() { return 'linear'; },
      primaryColor() { return '#000'; },
      secondaryColor() { return '#fff'; },
      opacity() { return 1; },
    },
    io:{ canvasToDataURL() {} },
    transaction:{ commit() {} },
  };
  for (const key of ['rasterEdit','state','runtime','selection','tools','io','transaction']) {
    assert.throws(
      () => createGradientCommandController({ ...base, [key]:{} }),
      TypeError,
    );
  }
});

test('short Gradient drag is a no-op before touching the shared persistence guard', async () => {
  const h = makeHarness();
  const outcome = await h.controller.apply(h.doc, { x:1, y:1 }, { x:2, y:2 });
  assert.deepEqual(outcome, {
    result:GRADIENT_COMMAND_RESULT.NOOP,
    reason:GRADIENT_COMMAND_REASON.TOO_SHORT,
  });
  assert.deepEqual(h.statuses, ['Градиент: протяните линию по холсту']);
  assert.equal(h.getBeginCalls(), 0);
  assert.equal(h.getEndCalls(), 0);
  assert.equal(h.getCanvasCreates(), 0);
  assert.equal(h.doc.layers.length, 0);
});

test('busy Gradient command preserves the shared raster persistence exclusion', async () => {
  const h = makeHarness({ persisting:true });
  const outcome = await h.controller.apply(h.doc, { x:1, y:1 }, { x:20, y:10 });
  assert.equal(outcome.result, GRADIENT_COMMAND_RESULT.REJECTED);
  assert.equal(outcome.reason, GRADIENT_COMMAND_REASON.BUSY);
  assert.deepEqual(h.statuses, ['Сохраняется предыдущая растровая операция…']);
  assert.equal(h.getBeginCalls(), 0);
  assert.equal(h.getEndCalls(), 0);
  assert.equal(h.doc.layers.length, 0);
});

test('linear Gradient preserves geometry, colors, opacity, selection clip and one publication', async () => {
  const h = makeHarness();
  const start = { x:4, y:6 };
  const end = { x:44, y:26 };
  const outcome = await h.controller.apply(h.doc, start, end);

  assert.equal(outcome.result, GRADIENT_COMMAND_RESULT.COMMITTED);
  assert.deepEqual(h.canvasHarness.calls.linear, [[4,6,44,26]]);
  assert.deepEqual(h.canvasHarness.calls.radial, []);
  assert.deepEqual(h.canvasHarness.calls.stops, [[0,'#112233'],[1,'#ddeeff']]);
  assert.equal(h.canvasHarness.context.globalAlpha, 0.65);
  assert.deepEqual(h.canvasHarness.calls.fillRect, [[0,0,100,80]]);
  assert.equal(h.canvasHarness.calls.save, 1);
  assert.equal(h.canvasHarness.calls.restore, 1);
  assert.equal(h.clips.length, 1);
  assert.equal(h.clips[0][1], h.doc);
  assert.equal(h.doc.layers.length, 1);
  assert.equal(h.doc.layers[0].type, 'raster');
  assert.equal(h.doc.layers[0].name, 'Градиент');
  assert.deepEqual(
    { x:h.doc.layers[0].x, y:h.doc.layers[0].y, width:h.doc.layers[0].width, height:h.doc.layers[0].height },
    { x:0, y:0, width:100, height:80 },
  );
  assert.equal(h.doc.layers[0].dataUrl, 'data:image/png;base64,gradient');
  assert.deepEqual(h.commits, ['Добавить градиент']);
  assert.equal(h.getClearCalls(), 1);
  assert.equal(h.getPersisting(), false);
  assert.equal(h.getEndCalls(), 1);
  assert.equal(h.statuses.at(-1), 'Градиент добавлен на новый слой');
});

test('radial Gradient uses drag distance and secondary-color fallback', async () => {
  const h = makeHarness({ type:'radial', secondaryColor:'' });
  const outcome = await h.controller.apply(h.doc, { x:10, y:15 }, { x:13, y:19 });
  assert.equal(outcome.result, GRADIENT_COMMAND_RESULT.COMMITTED);
  assert.deepEqual(h.canvasHarness.calls.linear, []);
  assert.deepEqual(h.canvasHarness.calls.radial, [[10,15,0,10,15,5]]);
  assert.deepEqual(h.canvasHarness.calls.stops, [[0,'#112233'],[1,'#ffffff']]);
});

test('encoding failure publishes nothing, reports the error and releases the busy guard', async () => {
  const failure = new Error('encode failed');
  const h = makeHarness({ serialize:async () => { throw failure; } });
  const outcome = await h.controller.apply(h.doc, { x:0, y:0 }, { x:20, y:0 });
  assert.equal(outcome.result, GRADIENT_COMMAND_RESULT.FAILED);
  assert.equal(outcome.error, failure);
  assert.equal(h.doc.layers.length, 0);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.toasts, [['Не удалось создать градиент','error']]);
  assert.deepEqual(h.errors, [failure]);
  assert.equal(h.getClearCalls(), 0);
  assert.equal(h.getPersisting(), false);
  assert.equal(h.getEndCalls(), 1);
});

test('document switch during PNG serialization cannot redirect Gradient publication', async () => {
  const gate = deferred();
  const origin = createDocument({ width:64, height:32 });
  const other = createDocument({ width:90, height:70 });
  const h = makeHarness({ doc:origin, serialize:() => gate.promise });

  const pending = h.controller.apply(origin, { x:1, y:2 }, { x:31, y:12 });
  assert.equal(h.getPersisting(), true);
  assert.equal(h.canvasHarness.canvas.width, 64);
  assert.equal(h.canvasHarness.canvas.height, 32);
  h.setDocument(other);
  gate.resolve('data:image/png;base64,late');

  const outcome = await pending;
  assert.equal(outcome.result, GRADIENT_COMMAND_RESULT.REJECTED);
  assert.equal(outcome.reason, GRADIENT_COMMAND_REASON.STALE_OWNER);
  assert.equal(origin.layers.length, 0);
  assert.equal(other.layers.length, 0);
  assert.deepEqual(h.commits, []);
  assert.equal(h.getClearCalls(), 0);
  assert.notEqual(h.statuses.at(-1), 'Градиент добавлен на новый слой');
  assert.equal(h.getPersisting(), false);
  assert.equal(h.getEndCalls(), 1);
});

test('same-id replacement is stale because Gradient ownership uses exact object identity', async () => {
  const gate = deferred();
  const origin = createDocument({ width:64, height:32 });
  origin.id = 'same-document-id';
  const replacement = createDocument({ width:64, height:32 });
  replacement.id = 'same-document-id';
  const h = makeHarness({ doc:origin, serialize:() => gate.promise });

  const pending = h.controller.apply(origin, { x:0, y:0 }, { x:20, y:0 });
  h.setDocument(replacement);
  gate.resolve('data:image/png;base64,late');

  const outcome = await pending;
  assert.equal(outcome.result, GRADIENT_COMMAND_RESULT.REJECTED);
  assert.equal(outcome.reason, GRADIENT_COMMAND_REASON.STALE_OWNER);
  assert.equal(origin.layers.length, 0);
  assert.equal(replacement.layers.length, 0);
  assert.deepEqual(h.commits, []);
  assert.equal(h.getPersisting(), false);
});

test('owner is revalidated before selection state is consumed', async () => {
  const origin = createDocument({ width:64, height:32 });
  const other = createDocument({ width:64, height:32 });
  let reads = 0;
  const clips = [];
  let persisting = false;
  const canvasHarness = makeCanvasHarness();
  const controller = createGradientCommandController({
    rasterEdit:{ clearBrushBuffer() {} },
    state:{
      getDocument:() => {
        reads += 1;
        return reads <= 2 ? origin : other;
      },
      isPersisting:() => false,
      beginPersist:() => { persisting = true; return true; },
      endPersist:() => { persisting = false; },
    },
    runtime:{ createCanvas:() => canvasHarness.canvas },
    selection:{ clipContext:() => clips.push('clip') },
    tools:{
      type:() => 'linear',
      primaryColor:() => '#000000',
      secondaryColor:() => '#ffffff',
      opacity:() => 1,
    },
    io:{ canvasToDataURL:async () => 'data:image/png;base64,x' },
    transaction:{ commit() { throw new Error('must not commit'); } },
  });

  const outcome = await controller.apply(origin, { x:0, y:0 }, { x:20, y:0 });
  assert.equal(outcome.result, GRADIENT_COMMAND_RESULT.REJECTED);
  assert.equal(outcome.reason, GRADIENT_COMMAND_REASON.STALE_OWNER);
  assert.deepEqual(clips, []);
  assert.equal(origin.layers.length, 0);
  assert.equal(persisting, false);
});
