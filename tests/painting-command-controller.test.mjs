import test from 'node:test';
import assert from 'node:assert/strict';
import { addLayer, createDocument, createRasterLayer } from '../src/core/state.js';
import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { createRasterCommandController } from '../src/painting/command-controller.js';

function canvasHarness(width = 4, height = 1, pixels = new Uint8ClampedArray(width * height * 4)) {
  const calls = { save:0, restore:0, stroke:0, clearRect:0, putImageData:0 };
  const context = {
    lineCap:'butt',
    lineJoin:'miter',
    lineWidth:1,
    globalAlpha:1,
    globalCompositeOperation:'source-over',
    strokeStyle:'#000000',
    save() { calls.save += 1; },
    restore() { calls.restore += 1; },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() { calls.stroke += 1; },
    clearRect() { calls.clearRect += 1; },
    getImageData() { return { data:pixels }; },
    putImageData() { calls.putImageData += 1; },
  };
  return { canvas:{ width, height }, context, calls, pixels };
}

function makeHarness({
  doc = createDocument({ width:4, height:1 }),
  selected = () => doc.layers.find(layer => layer.id === doc.selectedLayerId) || null,
  atPoint = point => selected(point),
  isEditableRasterLayer = layer => Boolean(layer) && layer.type === 'raster',
  selectionActive = false,
  selectionContains = () => true,
  selectionPredicate = () => null,
  selectionIntersects = () => true,
  pixels,
} = {}) {
  let persisting = false;
  let persistCalls = 0;
  let resetPaintStateCalls = 0;
  let highDepthMutation = null;
  const commits = [];
  const statuses = [];
  const clips = [];
  const canvas = canvasHarness(4, 1, pixels);

  const rasterEdit = {
    brushCanvas:null,
    brushContext:null,
    editableHighDepthBuffer() { return null; },
    async prepareHighDepthMutation(layer, buffer) { return { layerId:layer.id, buffer }; },
    applyHighDepthMutation(layer, mutation) { highDepthMutation = { layer, mutation }; },
    async ensureRasterBuffer(layer) {
      this.brushCanvas = { ...canvas.canvas, width:layer.width, height:layer.height };
      this.brushContext = canvas.context;
      return { canvas:this.brushCanvas, ctx:this.brushContext };
    },
    async persistPaintLayer() { persistCalls += 1; return true; },
    clearBrushBuffer() {
      this.brushCanvas = null;
      this.brushContext = null;
    },
  };

  const controller = createRasterCommandController({
    rasterEdit,
    state:{
      getDocument:() => doc,
      isPersisting:() => persisting,
      beginPersist:() => {
        if (persisting) return false;
        persisting = true;
        return true;
      },
      endPersist:() => { persisting = false; },
      resetPaintState:() => { resetPaintStateCalls += 1; },
    },
    target:{
      selected,
      atPoint,
      isEditableRasterLayer,
      toLocal:point => ({ ...point }),
    },
    selection:{
      hasActive:() => selectionActive,
      containsPoint:selectionContains,
      intersectsLayer:selectionIntersects,
      predicate:selectionPredicate,
      clipContext:(context, layer) => clips.push([context, layer]),
    },
    tools:{
      primaryColor:() => '#ff0000',
      brushSize:() => 6,
      opacity:() => 1,
      fillTolerance:() => 0,
      rgbToCmyk:() => [.1,.2,.3,.4],
    },
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
    canvas,
    commits,
    statuses,
    clips,
    getPersisting:() => persisting,
    getPersistCalls:() => persistCalls,
    getResetPaintStateCalls:() => resetPaintStateCalls,
    getHighDepthMutation:() => highDepthMutation,
  };
}

test('line command creates one sparse raster target and keeps persistence/history outside main.js', async () => {
  const doc = createDocument({ width:8, height:6 });
  const harness = makeHarness({
    doc,
    selected:() => null,
    atPoint:() => null,
    isEditableRasterLayer:layer => Boolean(layer) && layer.type === 'raster',
  });

  assert.equal(await harness.controller.drawLine({ x:1, y:2 }, { x:6, y:4 }), true);
  assert.equal(doc.layers.length, 1);
  assert.equal(doc.layers[0].type, 'raster');
  assert.equal(doc.layers[0].name, 'Линии');
  assert.equal(doc.layers[0].dataUrl, null);
  assert.equal(doc.selectedLayerId, doc.layers[0].id);
  assert.equal(harness.canvas.calls.stroke, 1);
  assert.equal(harness.clips.length, 1);
  assert.equal(harness.getPersistCalls(), 1);
  assert.equal(harness.getPersisting(), false);
  assert.deepEqual(harness.commits, ['Нарисовать линию']);
});

test('fill command owns Canvas8 flood fill while honoring the injected selection predicate', async () => {
  const doc = createDocument({ width:4, height:1 });
  const layer = createRasterLayer({ name:'Pixels', width:4, height:1, dataUrl:null });
  addLayer(doc, layer);
  const pixels = new Uint8ClampedArray([
    255,255,255,255,
    255,255,255,255,
    255,255,255,255,
    255,255,255,255,
  ]);
  const harness = makeHarness({
    doc,
    pixels,
    selectionActive:true,
    selectionContains:() => true,
    selectionPredicate:() => x => x < 2,
  });

  assert.equal(await harness.controller.fillAt({ x:0, y:0 }), true);
  assert.deepEqual([...pixels.slice(0,4)], [255,0,0,255]);
  assert.deepEqual([...pixels.slice(4,8)], [255,0,0,255]);
  assert.deepEqual([...pixels.slice(8,12)], [255,255,255,255]);
  assert.equal(harness.canvas.calls.putImageData, 1);
  assert.equal(harness.getPersistCalls(), 1);
  assert.equal(harness.getPersisting(), false);
  assert.deepEqual(harness.commits, ['Заливка']);
});

test('selection clear keeps native high-depth samples and uses the shared reset bridge', async () => {
  const doc = createDocument({ width:2, height:1 });
  const layer = createRasterLayer({ name:'HDR', width:2, height:1, dataUrl:null });
  layer.highDepthSource = { model:'rgb' };
  addLayer(doc, layer);

  const buffer = createPixelBuffer({
    width:2,
    height:1,
    model:'rgb',
    channels:4,
    bitsPerChannel:32,
    colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([1,0,0,1, 0,1,0,1]),
  });
  const harness = makeHarness({
    doc,
    selectionActive:true,
    selectionPredicate:() => x => x === 1,
    selectionIntersects:() => true,
  });
  harness.rasterEdit.editableHighDepthBuffer = () => buffer;

  assert.equal(await harness.controller.clearSelection(), true);
  assert.equal(buffer.data[3], 1);
  assert.equal(buffer.data[7], 0);
  assert.ok(harness.getHighDepthMutation());
  assert.equal(harness.getResetPaintStateCalls(), 1);
  assert.equal(harness.getPersistCalls(), 0);
  assert.equal(harness.getPersisting(), false);
  assert.deepEqual(harness.commits, ['Очистить выделение']);
});

test('fill raises the shared pending-edit guard before asynchronous raster preparation', async () => {
  const doc = createDocument({ width:4, height:1 });
  const layer = createRasterLayer({ name:'Async', width:4, height:1, dataUrl:null });
  addLayer(doc, layer);
  let releaseDecode;
  const harness = makeHarness({ doc });
  harness.rasterEdit.ensureRasterBuffer = function ensureRasterBuffer() {
    return new Promise(resolve => {
      releaseDecode = () => {
        this.brushCanvas = harness.canvas.canvas;
        this.brushContext = harness.canvas.context;
        resolve();
      };
    });
  };

  const pending = harness.controller.fillAt({ x:0, y:0 });
  assert.equal(harness.getPersisting(), true);
  assert.equal(typeof releaseDecode, 'function');
  releaseDecode();
  await pending;
  assert.equal(harness.getPersisting(), false);
});
