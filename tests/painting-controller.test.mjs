import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, serializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { createRasterEditController } from '../src/painting/controller.js';

function canvasHarness() {
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
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  return { documentRef, canvases };
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

  const first = await controller.ensureRasterBuffer(layer);
  assert.equal(first.canvas, controller.brushCanvas);
  assert.equal(first.ctx, controller.brushContext);
  assert.equal(controller.brushLayerId, layer.id);

  const second = await controller.ensureRasterBuffer(layer);
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

  assert.equal(await controller.ensureNativeHighDepthPaintBuffer(layer), true);
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

  await controller.ensureRasterBuffer(layer);
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
