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

function makeHarness({ doc = createDocument({ width:8, height:8 }), atPoint = () => null, ensureRasterBuffer } = {}) {
  let drag = null;
  let persisting = false;
  let persistCalls = 0;
  let previewSawPaintDrag = false;
  const commits = [];
  const statuses = [];
  const { context, calls } = paintContext();

  const rasterEdit = {
    brushCanvas:null,
    brushContext:null,
    brushLayerId:null,
    highDepthPaintBuffer:null,
    highDepthPaintLayerId:null,
    async ensureNativeHighDepthPaintBuffer() { return false; },
    async ensureRasterBuffer(layer) {
      if (ensureRasterBuffer) return ensureRasterBuffer.call(this, layer, context);
      this.brushCanvas = { width:layer.width, height:layer.height };
      this.brushContext = context;
      this.brushLayerId = layer.id;
      return { canvas:this.brushCanvas, ctx:context };
    },
    schedulePaintPreview() { previewSawPaintDrag ||= drag?.kind === 'paint'; },
    cancelPaintPreview() {},
    async persistPaintLayer() { persistCalls += 1; return true; },
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
      getDocument:() => doc,
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
      selected:() => doc.layers.find(layer => layer.id === doc.selectedLayerId) || null,
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
      toast() {},
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
    getDrag:() => drag,
    setDrag:value => { drag = value; },
    getPersistCalls:() => persistCalls,
    getPersisting:() => persisting,
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
  assert.equal(harness.calls.restore, 1);
  assert.deepEqual(harness.commits, ['Кисть']);
  assert.equal(harness.statuses.at(-1), 'Готово');
});

test('paint begin re-checks the caller-owned pointer guard after async raster preparation', async () => {
  const doc = createDocument({ width:8, height:8 });
  const layer = createRasterLayer({ name:'Existing', width:8, height:8, dataUrl:null });
  addLayer(doc, layer);

  let releaseDecode;
  const harness = makeHarness({
    doc,
    atPoint:() => layer,
    ensureRasterBuffer(layerValue, context) {
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
