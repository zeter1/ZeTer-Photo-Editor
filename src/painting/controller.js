import { checkedCanvasSize, isLayerLocked, sanitizeHighDepthPreview } from '../core/state.js';
import { getImage, invalidateImageCache } from '../core/render.js';
import { canvasToDataURL } from '../core/io.js';
import {
  clonePixelBuffer,
  deserializePixelBufferSource,
  pixelBufferByteLength,
  pixelBufferToToneMappedRgba8Preview,
  pixelBufferWithStraightAlpha,
  serializePixelBufferSource,
  MAX_PIXEL_BUFFER_SOURCE_BYTES,
} from '../core/pixel-buffer.js';
import { cmykPixelBufferToRgba8Preview } from '../core/color-management.js';

export function createRasterEditController({
  getDocument,
  getDrag = () => null,
  getCmykPreviewTransform = () => null,
  renderPaintPreview = () => {},
  documentRef = globalThis.document,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = frame => globalThis.cancelAnimationFrame(frame),
} = {}) {
  if (typeof getDocument !== 'function') throw new TypeError('getDocument is required');

  let brushCanvas = null;
  let brushContext = null;
  let brushLayerId = null;
  let highDepthPaintBuffer = null;
  let highDepthPaintLayerId = null;
  let highDepthPaintPreviewDirty = false;
  let paintPreviewFrame = 0;
  let paintPreviewQueued = false;

  function currentDocument() {
    const documentValue = getDocument();
    if (!documentValue) throw new Error('Raster edit controller has no active document');
    return documentValue;
  }

  function clearBrushBuffer() {
    brushCanvas = null;
    brushContext = null;
    brushLayerId = null;
  }

  function clearHighDepthPaintState() {
    highDepthPaintBuffer = null;
    highDepthPaintLayerId = null;
    highDepthPaintPreviewDirty = false;
  }

  function markHighDepthPreviewDirty() {
    highDepthPaintPreviewDirty = true;
  }

  function cancelPaintPreview() {
    paintPreviewQueued = false;
    if (paintPreviewFrame) cancelFrame(paintPreviewFrame);
    paintPreviewFrame = 0;
  }

  function reset() {
    cancelPaintPreview();
    clearBrushBuffer();
    clearHighDepthPaintState();
  }

  function isEditableRasterLayer(layer) {
    return Boolean(layer) && layer.type === 'raster' && !isLayerLocked(currentDocument(), layer);
  }

  function highDepthBudgetForLayer(layer) {
    const used = currentDocument().layers.reduce(
      (sum, item) => item.id === layer?.id ? sum : sum + Math.max(0, Number(item?.highDepthSource?.rawBytes) || 0),
      0,
    );
    return Math.max(0, MAX_PIXEL_BUFFER_SOURCE_BYTES - used);
  }

  function editableHighDepthBuffer(layer, { requireAlpha = false } = {}) {
    if (!layer?.highDepthSource) return null;
    const decoded = deserializePixelBufferSource(layer.highDepthSource);
    if (decoded.model !== 'rgb' && decoded.model !== 'cmyk') return null;
    const working = requireAlpha ? pixelBufferWithStraightAlpha(decoded) : clonePixelBuffer(decoded);
    if (pixelBufferByteLength(working) > highDepthBudgetForLayer(layer)) return null;
    return working;
  }

  function refreshHighDepthPaintCanvas(layer, withFilters = true) {
    if (!layer || highDepthPaintLayerId !== layer.id || !highDepthPaintBuffer || !brushCanvas || !brushContext) return false;
    const preview = sanitizeHighDepthPreview(layer.highDepthPreview);
    const rgba = highDepthPaintBuffer.model === 'cmyk'
      ? cmykPixelBufferToRgba8Preview(highDepthPaintBuffer, getCmykPreviewTransform())
      : pixelBufferToToneMappedRgba8Preview(
          highDepthPaintBuffer,
          withFilters ? (layer.filters || {}) : {},
          { toneMap: preview.toneMap, displayExposure: preview.displayExposure },
        );
    const image = brushContext.createImageData(highDepthPaintBuffer.width, highDepthPaintBuffer.height);
    image.data.set(rgba);
    brushContext.setTransform(1, 0, 0, 1, 0, 0);
    brushContext.globalAlpha = 1;
    brushContext.globalCompositeOperation = 'source-over';
    brushContext.filter = 'none';
    brushContext.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    brushContext.putImageData(image, 0, 0);
    highDepthPaintPreviewDirty = false;
    return true;
  }

  async function ensureNativeHighDepthPaintBuffer(layer, { requireAlpha = false } = {}) {
    if (!layer?.highDepthSource) return false;
    const alphaChannels = highDepthPaintBuffer?.model === 'cmyk' ? 5 : 4;
    if (highDepthPaintLayerId === layer.id && highDepthPaintBuffer && (!requireAlpha || highDepthPaintBuffer.channels === alphaChannels)) return true;
    const working = editableHighDepthBuffer(layer, { requireAlpha });
    if (!working) return false;
    const size = checkedCanvasSize(layer.width, layer.height, `High-depth слой «${layer.name || 'Без имени'}»`);
    if (working.width !== size.width || working.height !== size.height) return false;
    brushCanvas = documentRef.createElement('canvas');
    brushCanvas.width = size.width;
    brushCanvas.height = size.height;
    brushContext = brushCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
    brushLayerId = layer.id;
    highDepthPaintBuffer = working;
    highDepthPaintLayerId = layer.id;
    highDepthPaintPreviewDirty = true;
    refreshHighDepthPaintCanvas(layer, true);
    return true;
  }

  async function highDepthPreviewDataUrl(layer, buffer) {
    const preview = sanitizeHighDepthPreview(layer.highDepthPreview);
    const rgba = buffer.model === 'cmyk'
      ? cmykPixelBufferToRgba8Preview(buffer, getCmykPreviewTransform())
      : pixelBufferToToneMappedRgba8Preview(
          buffer,
          {},
          { toneMap: preview.toneMap, displayExposure: preview.displayExposure },
        );
    const canvas = documentRef.createElement('canvas');
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    const image = context.createImageData(buffer.width, buffer.height);
    image.data.set(rgba);
    context.putImageData(image, 0, 0);
    return canvasToDataURL(canvas, 'image/png');
  }

  async function prepareHighDepthMutation(layer, buffer) {
    const highDepthSource = serializePixelBufferSource(buffer, { maxBytes: highDepthBudgetForLayer(layer) });
    const dataUrl = await highDepthPreviewDataUrl(layer, buffer);
    return {
      highDepthSource,
      dataUrl,
      highDepthPreview: buffer.model === 'cmyk' ? null : sanitizeHighDepthPreview(layer.highDepthPreview),
    };
  }

  function applyHighDepthMutation(layer, mutation) {
    const old = layer.dataUrl;
    layer.highDepthSource = mutation.highDepthSource;
    layer.highDepthPreview = mutation.highDepthPreview;
    layer.dataUrl = mutation.dataUrl;
    invalidateImageCache(old);
  }

  async function persistNativeHighDepthPaintLayer() {
    const layer = currentDocument().layers.find(item => item.id === highDepthPaintLayerId);
    if (!layer || !highDepthPaintBuffer) return false;
    const mutation = await prepareHighDepthMutation(layer, highDepthPaintBuffer);
    applyHighDepthMutation(layer, mutation);
    clearBrushBuffer();
    clearHighDepthPaintState();
    return true;
  }

  function drawHighDepthRasterBase(layer, canvas, context) {
    if (!layer?.highDepthSource) return false;
    const buffer = deserializePixelBufferSource(layer.highDepthSource);
    const preview = sanitizeHighDepthPreview(layer.highDepthPreview);
    const rgba = buffer.model === 'cmyk'
      ? cmykPixelBufferToRgba8Preview(buffer, getCmykPreviewTransform())
      : pixelBufferToToneMappedRgba8Preview(
          buffer,
          {},
          { toneMap: preview.toneMap, displayExposure: preview.displayExposure },
        );
    const source = documentRef.createElement('canvas');
    source.width = buffer.width;
    source.height = buffer.height;
    const sourceContext = source.getContext('2d', { alpha: true, willReadFrequently: true });
    const image = sourceContext.createImageData(buffer.width, buffer.height);
    image.data.set(rgba);
    sourceContext.putImageData(image, 0, 0);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return true;
  }

  async function ensureRasterBuffer(layer) {
    if (!isEditableRasterLayer(layer)) return null;
    const paintSize = checkedCanvasSize(layer.width, layer.height, `Растровый слой «${layer.name || 'Без имени'}»`);
    const canvasWidth = paintSize.width;
    const canvasHeight = paintSize.height;
    if (brushLayerId !== layer.id || !brushCanvas || brushCanvas.width !== canvasWidth || brushCanvas.height !== canvasHeight) {
      brushCanvas = documentRef.createElement('canvas');
      brushCanvas.width = canvasWidth;
      brushCanvas.height = canvasHeight;
      brushContext = brushCanvas.getContext('2d', { alpha: true });
      if (!drawHighDepthRasterBase(layer, brushCanvas, brushContext) && layer.dataUrl) {
        const image = await getImage(layer.dataUrl);
        if (image) brushContext.drawImage(image, 0, 0, canvasWidth, canvasHeight);
      }
      brushLayerId = layer.id;
    }
    return { canvas: brushCanvas, ctx: brushContext };
  }

  async function persistPaintLayer() {
    const layerId = brushLayerId;
    const canvas = brushCanvas;
    if (!layerId || !canvas) return false;
    const dataUrl = await canvasToDataURL(canvas, 'image/png');
    const layer = currentDocument().layers.find(item => item.id === layerId);
    if (!layer) return false;
    const old = layer.dataUrl;
    layer.dataUrl = dataUrl;
    layer.highDepthSource = null;
    layer.highDepthPreview = null;
    invalidateImageCache(old);
    return true;
  }

  function paintPreviewOverrides() {
    if (!brushCanvas || !brushLayerId) return null;
    const source = highDepthPaintLayerId === brushLayerId
      ? { source: brushCanvas, skipAdjustments: true }
      : brushCanvas;
    return new Map([[brushLayerId, source]]);
  }

  function schedulePaintPreview() {
    paintPreviewQueued = true;
    if (paintPreviewFrame) return;
    paintPreviewFrame = requestFrame(() => {
      paintPreviewFrame = 0;
      if (!paintPreviewQueued || getDrag()?.kind !== 'paint') return;
      paintPreviewQueued = false;
      if (highDepthPaintPreviewDirty && highDepthPaintLayerId) {
        const layer = currentDocument().layers.find(item => item.id === highDepthPaintLayerId);
        if (layer) refreshHighDepthPaintCanvas(layer, true);
      }
      renderPaintPreview();
    });
  }

  return {
    get brushCanvas() { return brushCanvas; },
    get brushContext() { return brushContext; },
    get brushLayerId() { return brushLayerId; },
    get highDepthPaintBuffer() { return highDepthPaintBuffer; },
    get highDepthPaintLayerId() { return highDepthPaintLayerId; },
    clearBrushBuffer,
    clearHighDepthPaintState,
    reset,
    markHighDepthPreviewDirty,
    highDepthBudgetForLayer,
    editableHighDepthBuffer,
    refreshHighDepthPaintCanvas,
    ensureNativeHighDepthPaintBuffer,
    prepareHighDepthMutation,
    applyHighDepthMutation,
    persistNativeHighDepthPaintLayer,
    drawHighDepthRasterBase,
    ensureRasterBuffer,
    persistPaintLayer,
    paintPreviewOverrides,
    schedulePaintPreview,
    cancelPaintPreview,
  };
}
