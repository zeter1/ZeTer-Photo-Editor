import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, serializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { createRasterEditController } from '../src/painting/controller.js';

function canvasHarness({ toDataURL = () => 'data:image/png;base64,paint' } = {}) {
  const canvases = [];
  const documentRef = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const context = {
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        filter: 'none',
        createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        setTransform() {},
        clearRect() {},
        putImageData() {},
        drawImage() {},
      };
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => context,
        toDataURL,
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  return { documentRef, canvases };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function highDepthSource() {
  return serializePixelBufferSource(createPixelBuffer({
    width:2,
    height:1,
    model:'rgb',
    channels:4,
    bitsPerChannel:16,
    colorSpace:'srgb',
    data:new Uint16Array([10001,20003,30007,65535,40009,50021,60013,65535]),
  }));
}

function rasterLayer(overrides = {}) {
  return {
    id: 'layer',
    type: 'raster',
    name: 'Raster',
    width: 2,
    height: 1,
    dataUrl: null,
    highDepthSource: null,
    highDepthPreview: null,
    filters: {},
    locked: false,
    groupId: null,
    ...overrides,
  };
}

test('raster edit controller owns the reusable Canvas8 buffer and live preview override', async () => {
  const layer = rasterLayer();
  const doc = { width: 2, height: 1, layers: [layer], groups: [] };
  const { documentRef } = canvasHarness();
  const controller = createRasterEditController({ getDocument: () => doc, documentRef });

  const first = await controller.ensureRasterBuffer(doc, layer);
  assert.equal(first.canvas, controller.brushCanvas);
  assert.equal(first.ctx, controller.brushContext);
  assert.equal(controller.brushLayerId, layer.id);

  const second = await controller.ensureRasterBuffer(doc, layer);
  assert.equal(second.canvas, first.canvas, 'same layer and dimensions should reuse the paint canvas');

  const overrides = controller.paintPreviewOverrides();
  assert.equal(overrides.get(layer.id), first.canvas);

  controller.clearBrushBuffer();
  assert.equal(controller.brushCanvas, null);
  assert.equal(controller.brushContext, null);
  assert.equal(controller.brushLayerId, null);
});

test('native high-depth paint state is cloned from persisted source and reset independently', async () => {
  const source = createPixelBuffer({
    width: 2,
    height: 1,
    model: 'rgb',
    channels: 4,
    bitsPerChannel: 16,
    colorSpace: 'srgb',
    data: new Uint16Array([10001, 20003, 30007, 65535, 40009, 50021, 60013, 65535]),
  });
  const layer = rasterLayer({ highDepthSource: serializePixelBufferSource(source) });
  const doc = { width: 2, height: 1, layers: [layer], groups: [] };
  const { documentRef } = canvasHarness();
  const controller = createRasterEditController({ getDocument: () => doc, documentRef });

  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(doc, layer), true);
  assert.equal(controller.highDepthPaintLayerId, layer.id);
  assert.notEqual(controller.highDepthPaintBuffer.data, source.data);
  controller.highDepthPaintBuffer.data[0] = 12345;
  assert.equal(source.data[0], 10001);

  const override = controller.paintPreviewOverrides().get(layer.id);
  assert.equal(override.source, controller.brushCanvas);
  assert.equal(override.skipAdjustments, true);

  controller.clearHighDepthPaintState();
  assert.equal(controller.highDepthPaintBuffer, null);
  assert.equal(controller.highDepthPaintLayerId, null);
});

test('native high-depth cache is bound to exact document and layer identity, not reusable IDs', async () => {
  const originLayer = rasterLayer({ id:'shared-layer-id', highDepthSource:highDepthSource() });
  const origin = { id:'shared-document-id', width:2, height:1, layers:[originLayer], groups:[] };
  const replacementLayer = rasterLayer({ id:'shared-layer-id', highDepthSource:highDepthSource() });
  const replacement = { id:'shared-document-id', width:2, height:1, layers:[replacementLayer], groups:[] };
  let activeDocument = origin;
  const { documentRef } = canvasHarness();
  const controller = createRasterEditController({ getDocument:() => activeDocument, documentRef });

  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(origin, originLayer), true);
  const firstBuffer = controller.highDepthPaintBuffer;
  assert.equal(controller.isNativeHighDepthPaintTarget(origin, originLayer), true);

  activeDocument = replacement;
  assert.equal(controller.paintPreviewOverrides(), null);
  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(replacement, replacementLayer), true);

  assert.notEqual(controller.highDepthPaintBuffer, firstBuffer);
  assert.equal(controller.isNativeHighDepthPaintTarget(replacement, replacementLayer), true);
  assert.equal(controller.isNativeHighDepthPaintTarget(origin, originLayer), false);
});

test('paint preview scheduling is frame-throttled and reset cancels queued work', async () => {
  const layer = rasterLayer();
  const doc = { width: 2, height: 1, layers: [layer], groups: [] };
  const { documentRef } = canvasHarness();
  let frameId = 0;
  const frames = new Map();
  const cancelled = [];
  let previews = 0;
  const controller = createRasterEditController({
    getDocument: () => doc,
    getDrag: () => ({ kind: 'paint' }),
    renderPaintPreview: () => { previews += 1; },
    documentRef,
    requestFrame: callback => {
      frameId += 1;
      frames.set(frameId, callback);
      return frameId;
    },
    cancelFrame: id => { cancelled.push(id); frames.delete(id); },
  });

  await controller.ensureRasterBuffer(doc, layer);
  controller.schedulePaintPreview();
  controller.schedulePaintPreview();
  assert.equal(frames.size, 1);
  const firstId = [...frames.keys()][0];
  const callback = frames.get(firstId);
  frames.delete(firstId);
  callback();
  assert.equal(previews, 1);

  controller.schedulePaintPreview();
  const pendingId = [...frames.keys()][0];
  controller.reset();
  assert.deepEqual(cancelled, [pendingId]);
  assert.equal(controller.brushCanvas, null);
  assert.equal(controller.highDepthPaintBuffer, null);
});


test('Canvas8 buffer cache is bound to exact document and layer identity, not reusable IDs', async () => {
  const originLayer = rasterLayer({ id:'shared-layer-id' });
  const origin = { id:'shared-document-id', width:2, height:1, layers:[originLayer], groups:[] };
  const replacementLayer = rasterLayer({ id:'shared-layer-id' });
  const replacement = { id:'shared-document-id', width:2, height:1, layers:[replacementLayer], groups:[] };
  let activeDocument = origin;
  const { documentRef, canvases } = canvasHarness();
  const controller = createRasterEditController({ getDocument:() => activeDocument, documentRef });

  const first = await controller.ensureRasterBuffer(origin, originLayer);
  assert.ok(first);
  assert.equal(controller.paintPreviewOverrides().get(originLayer.id), first.canvas);

  activeDocument = replacement;
  assert.equal(controller.paintPreviewOverrides(), null, 'stale Canvas8 preview must not leak into a same-ID replacement document');
  const second = await controller.ensureRasterBuffer(replacement, replacementLayer);

  assert.ok(second);
  assert.notEqual(second.canvas, first.canvas);
  assert.equal(canvases.length, 2, 'same IDs must not cause cross-owner Canvas reuse');
});

test('Canvas8 persistence writes only to the exact captured owner and target', async () => {
  const layer = rasterLayer();
  const doc = { width:2, height:1, layers:[layer], groups:[] };
  const { documentRef } = canvasHarness({ toDataURL:() => 'data:image/png;base64,new' });
  const controller = createRasterEditController({ getDocument:() => doc, documentRef });

  await controller.ensureRasterBuffer(doc, layer);
  layer.dataUrl = 'data:image/png;base64,old';
  assert.equal(await controller.persistPaintLayer(doc, layer), true);
  assert.equal(layer.dataUrl, 'data:image/png;base64,new');
  assert.equal(layer.highDepthSource, null);
  assert.equal(layer.highDepthPreview, null);
});

test('Canvas8 persistence rejects an active-document switch during PNG encoding', async () => {
  const originLayer = rasterLayer({ id:'shared-layer-id' });
  const origin = { id:'shared-document-id', width:2, height:1, layers:[originLayer], groups:[] };
  const replacementLayer = rasterLayer({ id:'shared-layer-id', dataUrl:'data:image/png;base64,replacement' });
  const replacement = { id:'shared-document-id', width:2, height:1, layers:[replacementLayer], groups:[] };
  let activeDocument = origin;
  const { documentRef } = canvasHarness({ toDataURL:() => 'data:image/png;base64,late' });
  const controller = createRasterEditController({ getDocument:() => activeDocument, documentRef });

  await controller.ensureRasterBuffer(origin, originLayer);
  originLayer.dataUrl = 'data:image/png;base64,origin';
  const pending = controller.persistPaintLayer(origin, originLayer);
  activeDocument = replacement;

  assert.equal(await pending, false);
  assert.equal(originLayer.dataUrl, 'data:image/png;base64,origin');
  assert.equal(replacementLayer.dataUrl, 'data:image/png;base64,replacement');
});

test('Canvas8 persistence rejects a same-ID layer replacement inside the captured owner', async () => {
  const originLayer = rasterLayer({ id:'shared-layer-id' });
  const replacementLayer = rasterLayer({ id:'shared-layer-id', dataUrl:'data:image/png;base64,replacement' });
  const doc = { width:2, height:1, layers:[originLayer], groups:[] };
  const { documentRef } = canvasHarness({ toDataURL:() => 'data:image/png;base64,late' });
  const controller = createRasterEditController({ getDocument:() => doc, documentRef });

  await controller.ensureRasterBuffer(doc, originLayer);
  originLayer.dataUrl = 'data:image/png;base64,origin';
  const pending = controller.persistPaintLayer(doc, originLayer);
  doc.layers[0] = replacementLayer;

  assert.equal(await pending, false);
  assert.equal(originLayer.dataUrl, 'data:image/png;base64,origin');
  assert.equal(replacementLayer.dataUrl, 'data:image/png;base64,replacement');
});

test('Canvas8 serialization errors propagate without mutating the captured layer', async () => {
  const failure = new Error('encode failed');
  const layer = rasterLayer();
  const doc = { width:2, height:1, layers:[layer], groups:[] };
  const { documentRef } = canvasHarness({ toDataURL:() => { throw failure; } });
  const controller = createRasterEditController({ getDocument:() => doc, documentRef });

  await controller.ensureRasterBuffer(doc, layer);
  layer.dataUrl = 'data:image/png;base64,origin';
  await assert.rejects(controller.persistPaintLayer(doc, layer), failure);
  assert.equal(layer.dataUrl, 'data:image/png;base64,origin');
});


test('native high-depth persistence publishes only to the exact owner and target', async () => {
  const layer = rasterLayer({ highDepthSource:highDepthSource(), dataUrl:'data:image/png;base64,old' });
  const doc = { width:2, height:1, layers:[layer], groups:[] };
  const { documentRef } = canvasHarness({ toDataURL:() => 'data:image/png;base64,native-next' });
  const controller = createRasterEditController({ getDocument:() => doc, documentRef });

  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(doc, layer), true);
  controller.highDepthPaintBuffer.data[0] = 12345;
  assert.equal(await controller.persistNativeHighDepthPaintLayer(doc, layer), true);
  assert.equal(layer.dataUrl, 'data:image/png;base64,native-next');
  assert.equal(layer.highDepthSource.dataUrl.includes('data:application/x-zeter-pixel-buffer;base64,'), true);
  assert.equal(controller.highDepthPaintBuffer, null);
});

test('native high-depth persistence rejects same-ID document replacement during preview encoding', async () => {
  const encode = deferred();
  const originLayer = rasterLayer({ id:'shared-layer-id', highDepthSource:highDepthSource(), dataUrl:'data:image/png;base64,origin' });
  const origin = { id:'shared-document-id', width:2, height:1, layers:[originLayer], groups:[] };
  const replacementLayer = rasterLayer({ id:'shared-layer-id', highDepthSource:highDepthSource(), dataUrl:'data:image/png;base64,replacement' });
  const replacement = { id:'shared-document-id', width:2, height:1, layers:[replacementLayer], groups:[] };
  let activeDocument = origin;
  const { documentRef } = canvasHarness({ toDataURL:() => encode.promise });
  const controller = createRasterEditController({ getDocument:() => activeDocument, documentRef });

  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(origin, originLayer), true);
  const originalSource = originLayer.highDepthSource;
  const replacementSource = replacementLayer.highDepthSource;
  const pending = controller.persistNativeHighDepthPaintLayer(origin, originLayer);
  activeDocument = replacement;
  encode.resolve('data:image/png;base64,late');

  assert.equal(await pending, false);
  assert.equal(controller.highDepthPaintBuffer, null);
  assert.equal(controller.paintPreviewOverrides(), null);
  assert.equal(originLayer.dataUrl, 'data:image/png;base64,origin');
  assert.equal(originLayer.highDepthSource, originalSource);
  assert.equal(replacementLayer.dataUrl, 'data:image/png;base64,replacement');
  assert.equal(replacementLayer.highDepthSource, replacementSource);
});

test('native high-depth persistence rejects same-ID layer replacement inside the owner', async () => {
  const encode = deferred();
  const originLayer = rasterLayer({ id:'shared-layer-id', highDepthSource:highDepthSource(), dataUrl:'data:image/png;base64,origin' });
  const replacementLayer = rasterLayer({ id:'shared-layer-id', highDepthSource:highDepthSource(), dataUrl:'data:image/png;base64,replacement' });
  const doc = { width:2, height:1, layers:[originLayer], groups:[] };
  const { documentRef } = canvasHarness({ toDataURL:() => encode.promise });
  const controller = createRasterEditController({ getDocument:() => doc, documentRef });

  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(doc, originLayer), true);
  const originalSource = originLayer.highDepthSource;
  const replacementSource = replacementLayer.highDepthSource;
  const pending = controller.persistNativeHighDepthPaintLayer(doc, originLayer);
  doc.layers[0] = replacementLayer;
  encode.resolve('data:image/png;base64,late');

  assert.equal(await pending, false);
  assert.equal(controller.highDepthPaintBuffer, null);
  assert.equal(controller.paintPreviewOverrides(), null);
  assert.equal(originLayer.dataUrl, 'data:image/png;base64,origin');
  assert.equal(originLayer.highDepthSource, originalSource);
  assert.equal(replacementLayer.dataUrl, 'data:image/png;base64,replacement');
  assert.equal(replacementLayer.highDepthSource, replacementSource);
});

test('generic native high-depth publication rejects stale ownership after async preparation', async () => {
  const encode = deferred();
  const layer = rasterLayer({ highDepthSource:highDepthSource(), dataUrl:'data:image/png;base64,origin' });
  const doc = { width:2, height:1, layers:[layer], groups:[] };
  const replacement = { width:2, height:1, layers:[], groups:[] };
  let activeDocument = doc;
  const { documentRef } = canvasHarness({ toDataURL:() => encode.promise });
  const controller = createRasterEditController({ getDocument:() => activeDocument, documentRef });
  const buffer = controller.editableHighDepthBuffer(layer);
  const originalSource = layer.highDepthSource;

  const pending = controller.persistHighDepthMutation(doc, layer, buffer);
  activeDocument = replacement;
  encode.resolve('data:image/png;base64,late');

  assert.equal(await pending, false);
  assert.equal(layer.dataUrl, 'data:image/png;base64,origin');
  assert.equal(layer.highDepthSource, originalSource);
});

test('native high-depth serialization failure leaves persisted metadata unchanged', async () => {
  const failure = new Error('native encode failed');
  const layer = rasterLayer({ highDepthSource:highDepthSource(), dataUrl:'data:image/png;base64,origin' });
  const doc = { width:2, height:1, layers:[layer], groups:[] };
  const { documentRef } = canvasHarness({ toDataURL:() => { throw failure; } });
  const controller = createRasterEditController({ getDocument:() => doc, documentRef });

  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(doc, layer), true);
  const originalSource = layer.highDepthSource;
  await assert.rejects(controller.persistNativeHighDepthPaintLayer(doc, layer), failure);
  assert.equal(controller.highDepthPaintBuffer, null);
  assert.equal(controller.paintPreviewOverrides(), null);
  assert.equal(layer.dataUrl, 'data:image/png;base64,origin');
  assert.equal(layer.highDepthSource, originalSource);
});


test('Canvas8 preparation clears stale native working state before publishing its cache', async () => {
  const nativeLayer = rasterLayer({ id:'native', highDepthSource:highDepthSource() });
  const canvasLayer = rasterLayer({ id:'canvas', dataUrl:null });
  const doc = { width:2, height:1, layers:[nativeLayer, canvasLayer], groups:[] };
  const { documentRef } = canvasHarness();
  const controller = createRasterEditController({ getDocument:() => doc, documentRef });

  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(doc, nativeLayer), true);
  assert.ok(controller.highDepthPaintBuffer);
  assert.ok(await controller.ensureRasterBuffer(doc, canvasLayer));
  assert.equal(controller.highDepthPaintBuffer, null);
  assert.equal(controller.paintPreviewOverrides().has(canvasLayer.id), true);
});
