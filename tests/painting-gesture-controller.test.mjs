import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createRasterLayer, addLayer } from '../src/core/state.js';
import { createPaintGestureController } from '../src/painting/gesture-controller.js';

function paintContext() {
  const calls = { save:0, restore:0, beginPath:0, moveTo:0, lineTo:0, stroke:0 };
  const context = {
    lineCap:'butt',
    lineJoin:'miter',
    lineWidth:1,
    globalAlpha:1,
    globalCompositeOperation:'source-over',
    strokeStyle:'#000000',
    save() { calls.save += 1; },
    restore() { calls.restore += 1; },
    beginPath() { calls.beginPath += 1; },
    moveTo() { calls.moveTo += 1; },
    lineTo() { calls.lineTo += 1; },
    stroke() { calls.stroke += 1; },
  };
  return { context, calls };
}

function makeHarness({
  doc = createDocument({ width:8, height:8 }),
  atPoint = () => null,
  ensureRasterBuffer,
  persistResult = true,
} = {}) {
  let activeDocument = doc;
  let drag = null;
  let persisting = false;
  let persistCalls = 0;
  const ensureCalls = [];
  const persistArgs = [];
  let previewSawPaintDrag = false;
  const commits = [];
  const statuses = [];
  const toasts = [];
  const { context, calls } = paintContext();

  const rasterEdit = {
    brushCanvas:null,
    brushContext:null,
    brushLayerId:null,
    highDepthPaintBuffer:null,
    highDepthPaintLayerId:null,
    async ensureNativeHighDepthPaintBuffer() { return false; },
    async ensureRasterBuffer(owner, layer) {
      ensureCalls.push([owner, layer]);
      if (ensureRasterBuffer) return ensureRasterBuffer.call(this, owner, layer, context);
      this.brushCanvas = { width:layer.width, height:layer.height };
      this.brushContext = context;
      this.brushLayerId = layer.id;
      return { canvas:this.brushCanvas, ctx:context };
    },
    schedulePaintPreview() { previewSawPaintDrag ||= drag?.kind === 'paint'; },
    cancelPaintPreview() {},
    async persistPaintLayer(owner, layer) {
      persistCalls += 1;
      persistArgs.push([owner, layer]);
      return typeof persistResult === 'function' ? persistResult(owner, layer) : persistResult;
    },
    async persistNativeHighDepthPaintLayer() { throw new Error('native path should not run'); },
    clearBrushBuffer() {
      this.brushCanvas = null;
      this.brushContext = null;
      this.brushLayerId = null;
    },
    clearHighDepthPaintState() {
      this.highDepthPaintBuffer = null;
      this.highDepthPaintLayerId = null;
    },
  };
  const retouch = {
    getCloneSource:() => null,
    resetStroke() {},
  };

  const controller = createPaintGestureController({
    rasterEdit,
    retouch,
    state:{
      getDocument:() => activeDocument,
      getDrag:() => drag,
      setDrag:value => { drag = value; },
      beginPersist:() => {
        if (persisting) return false;
        persisting = true;
        return true;
      },
      endPersist:() => { persisting = false; },
    },
    target:{
      selected:() => activeDocument.layers.find(layer => layer.id === activeDocument.selectedLayerId) || null,
      atPoint,
      toLocal:point => ({ ...point }),
    },
    selection:{
      containsPoint:() => true,
      clipContext:() => {},
    },
    tools:{
      brushWidth:() => 12,
      primaryColor:() => '#123456',
      opacity:() => .75,
    },
    nativePaint:{},
    ui:{
      setStatus:value => statuses.push(value),
      toast:(message, tone) => toasts.push([message, tone]),
      render() {},
      commit:value => commits.push(value),
    },
  });

  return {
    controller,
    rasterEdit,
    context,
    calls,
    commits,
    statuses,
    toasts,
    getDrag:() => drag,
    setDrag:value => { drag = value; },
    getPersistCalls:() => persistCalls,
    getEnsureCalls:() => ensureCalls,
    getPersistArgs:() => persistArgs,
    getPersisting:() => persisting,
    setDocument:value => { activeDocument = value; },
    previewSawPaintDrag:() => previewSawPaintDrag,
  };
}

test('paint gesture controller owns brush begin/move/end while main state remains bridged', async () => {
  const doc = createDocument({ width:8, height:8 });
  const harness = makeHarness({ doc });

  const started = await harness.controller.begin({
    point:{ x:1, y:2 },
    tool:'brush',
    canContinue:() => true,
  });

  assert.equal(started, true);
  assert.equal(doc.layers.length, 1, 'brush should lazily create one sparse raster layer');
  assert.equal(harness.getDrag()?.kind, 'paint');
  assert.equal(harness.getDrag()?.tool, 'brush');
  assert.equal(harness.getDrag()?.owner, doc);
  assert.equal(harness.getDrag()?.layer, doc.layers[0]);
  assert.equal(harness.previewSawPaintDrag(), true, 'preview scheduling must see the live paint drag');
  assert.equal(harness.context.globalAlpha, .75);
  assert.equal(harness.context.strokeStyle, '#123456');

  assert.equal(harness.controller.move({ x:4, y:5 }), true);
  assert.ok(harness.calls.beginPath >= 2);
  assert.ok(harness.calls.stroke >= 2);
  assert.deepEqual(harness.getDrag().last, { x:4, y:5 });

  const finishedDrag = harness.getDrag();
  harness.setDrag(null);
  assert.equal(await harness.controller.end(finishedDrag), true);
  assert.equal(harness.getPersistCalls(), 1);
  assert.equal(harness.getPersisting(), false);
  assert.equal(harness.getEnsureCalls()[0][0], doc);
  assert.equal(harness.getEnsureCalls()[0][1], doc.layers[0]);
  assert.equal(harness.getPersistArgs()[0][0], doc);
  assert.equal(harness.getPersistArgs()[0][1], doc.layers[0]);
  assert.equal(harness.calls.restore, 1);
  assert.deepEqual(harness.commits, ['Кисть']);
  assert.equal(harness.statuses.at(-1), 'Готово');
});

test('existing-raster-only tools preserve the unavailable-target warning', async () => {
  const doc = createDocument({ width:8, height:8 });
  const harness = makeHarness({ doc, atPoint:() => null });

  assert.equal(await harness.controller.begin({
    point:{ x:2, y:2 },
    tool:'eraser',
    canContinue:() => true,
  }), false);
  assert.equal(
    harness.statuses.at(-1),
    'Ластик работает только по растровому слою. Выберите слой с изображением или рисунком.',
  );
  assert.deepEqual(
    harness.toasts.at(-1),
    ['Ластик работает только по растровому слою. Выберите слой с изображением или рисунком.', 'warn'],
  );
  assert.equal(harness.getDrag(), null);
});

test('paint begin re-checks the caller-owned pointer guard after async raster preparation', async () => {
  const doc = createDocument({ width:8, height:8 });
  const layer = createRasterLayer({ name:'Existing', width:8, height:8, dataUrl:null });
  addLayer(doc, layer);

  let releaseDecode;
  const harness = makeHarness({
    doc,
    atPoint:() => layer,
    ensureRasterBuffer(owner, layerValue, context) {
      assert.equal(owner, doc);
      return new Promise(resolve => {
        releaseDecode = () => {
          this.brushCanvas = { width:layerValue.width, height:layerValue.height };
          this.brushContext = context;
          this.brushLayerId = layerValue.id;
          resolve({ canvas:this.brushCanvas, ctx:context });
        };
      });
    },
  });

  let pointerActive = true;
  const pending = harness.controller.begin({
    point:{ x:2, y:2 },
    tool:'brush',
    canContinue:() => pointerActive,
  });
  assert.equal(typeof releaseDecode, 'function');

  pointerActive = false;
  releaseDecode();
  assert.equal(await pending, false);
  assert.equal(harness.getDrag(), null);
  assert.equal(harness.getPersistCalls(), 0);
});


test('paint gesture suppresses Canvas8 history and success when persistence is stale', async () => {
  const doc = createDocument({ width:8, height:8 });
  const harness = makeHarness({ doc, persistResult:false });

  assert.equal(await harness.controller.begin({
    point:{ x:1, y:2 },
    tool:'brush',
    canContinue:() => true,
  }), true);

  const finishedDrag = harness.getDrag();
  harness.setDrag(null);
  assert.equal(await harness.controller.end(finishedDrag), false);
  assert.equal(harness.getPersistCalls(), 1);
  assert.equal(harness.getPersisting(), false);
  assert.deepEqual(harness.commits, []);
  assert.notEqual(harness.statuses.at(-1), 'Готово');
});

test('paint move rejects a same-ID replacement document instead of redirecting the stroke', async () => {
  const origin = createDocument({ width:8, height:8 });
  const harness = makeHarness({ doc:origin });

  assert.equal(await harness.controller.begin({
    point:{ x:1, y:2 },
    tool:'brush',
    canContinue:() => true,
  }), true);
  const originLayer = harness.getDrag().layer;
  const replacement = createDocument({ width:8, height:8 });
  replacement.id = origin.id;
  const replacementLayer = createRasterLayer({
    id:originLayer.id,
    name:'Replacement',
    width:8,
    height:8,
    dataUrl:null,
  });
  addLayer(replacement, replacementLayer);
  harness.setDocument(replacement);

  const strokesBefore = harness.calls.stroke;
  assert.equal(harness.controller.move({ x:4, y:5 }), false);
  assert.equal(harness.calls.stroke, strokesBefore);
  assert.equal(harness.getDrag().layer, originLayer);
  assert.notEqual(harness.getDrag().layer, replacementLayer);
});
