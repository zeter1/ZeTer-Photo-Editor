import { checkedCanvasSize, isLayerLocked, sanitizeHighDepthPreview } from '../core/state.js';
import { getImage, invalidateImageCache } from '../core/render.js';
import { canvasToDataURL } from '../core/io.js';
import {
  applyPixelBufferBrushDab,
  applyPixelBufferStrokeSegment,
  applyCmykPixelBufferBrushDab,
  applyCmykPixelBufferStrokeSegment,
  clonePixelBuffer,
  createSerializedPixelBufferTileWorkingSet,
  inpaintTiledPixelBufferSourceCooperative,
  deserializePixelBufferSource,
  forEachSerializedPixelBufferTile,
  mutateSerializedPixelBufferTiles,
  pixelBufferByteLength,
  pixelBufferToToneMappedRgba8Preview,
  pixelBufferWithStraightAlpha,
  serializePixelBufferSourceAdaptive,
  PIXEL_BUFFER_TILED_SOURCE_KIND,
  MAX_PIXEL_BUFFER_SOURCE_BYTES,
} from '../core/pixel-buffer.js';
import { cmykPixelBufferToRgba8Preview } from '../core/color-management.js';
import { prepareTiledInpaintWithWorker } from './tiled-inpaint-dispatch.js';

export function createRasterEditController({
  getDocument,
  getDrag = () => null,
  getCmykPreviewTransform = () => null,
  renderPaintPreview = () => {},
  documentRef = globalThis.document,
  tiledInpaintWorker = null,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = frame => globalThis.cancelAnimationFrame(frame),
} = {}) {
  if (typeof getDocument !== 'function') throw new TypeError('getDocument is required');

  let brushCanvas = null;
  let brushContext = null;
  let brushLayerId = null;
  let brushOwner = null;
  let brushLayer = null;
  let highDepthPaintBuffer = null;
  let highDepthPaintWorkingSet = null;
  let highDepthPaintLayerId = null;
  let highDepthPaintOwner = null;
  let highDepthPaintLayer = null;
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
    brushOwner = null;
    brushLayer = null;
  }

  function isCurrentRasterTarget(owner, layer) {
    return Boolean(
      owner &&
      layer &&
      getDocument() === owner &&
      Array.isArray(owner.layers) &&
      owner.layers.includes(layer) &&
      layer.type === 'raster' &&
      !isLayerLocked(owner, layer)
    );
  }

  function clearHighDepthPaintState() {
    highDepthPaintBuffer = null;
    highDepthPaintWorkingSet = null;
    highDepthPaintLayerId = null;
    highDepthPaintOwner = null;
    highDepthPaintLayer = null;
    highDepthPaintPreviewDirty = false;
  }

  function isNativeHighDepthPaintTarget(owner, layer) {
    return Boolean(
      (highDepthPaintBuffer || highDepthPaintWorkingSet) &&
      highDepthPaintOwner === owner &&
      highDepthPaintLayer === layer &&
      highDepthPaintLayerId === layer?.id &&
      brushOwner === owner &&
      brushLayer === layer &&
      brushLayerId === layer?.id &&
      isCurrentRasterTarget(owner, layer)
    );
  }

  function clearNativeHighDepthPaintTarget(owner, layer, token = highDepthPaintBuffer || highDepthPaintWorkingSet) {
    if (
      (highDepthPaintBuffer || highDepthPaintWorkingSet) !== token ||
      highDepthPaintOwner !== owner ||
      highDepthPaintLayer !== layer
    ) return false;
    clearBrushBuffer();
    clearHighDepthPaintState();
    return true;
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
    tiledInpaintWorker?.cancel?.();
    cancelPaintPreview();
    clearBrushBuffer();
    clearHighDepthPaintState();
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

  function refreshHighDepthPaintCanvas(owner, layer, withFilters = true, { full = false } = {}) {
    if (!isNativeHighDepthPaintTarget(owner, layer) || !brushCanvas || !brushContext) return false;
    const preview = sanitizeHighDepthPreview(layer.highDepthPreview);
    const renderTile = (x, y, buffer) => {
      const rgba = buffer.model === 'cmyk'
        ? cmykPixelBufferToRgba8Preview(buffer, getCmykPreviewTransform())
        : pixelBufferToToneMappedRgba8Preview(
            buffer,
            withFilters ? (layer.filters || {}) : {},
            { toneMap:preview.toneMap, displayExposure:preview.displayExposure },
          );
      const image = brushContext.createImageData(buffer.width, buffer.height);
      image.data.set(rgba);
      brushContext.putImageData(image, x, y);
    };

    brushContext.setTransform(1, 0, 0, 1, 0, 0);
    brushContext.globalAlpha = 1;
    brushContext.globalCompositeOperation = 'source-over';
    brushContext.filter = 'none';

    if (highDepthPaintWorkingSet) {
      if (full) {
        brushContext.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
        forEachSerializedPixelBufferTile(layer.highDepthSource, ({ x, y, buffer }) => renderTile(x, y, buffer));
      } else {
        highDepthPaintWorkingSet.forEachPreviewDirty(({ x, y, buffer }) => renderTile(x, y, buffer));
      }
      highDepthPaintPreviewDirty = false;
      return true;
    }

    const rgba = highDepthPaintBuffer.model === 'cmyk'
      ? cmykPixelBufferToRgba8Preview(highDepthPaintBuffer, getCmykPreviewTransform())
      : pixelBufferToToneMappedRgba8Preview(
          highDepthPaintBuffer,
          withFilters ? (layer.filters || {}) : {},
          { toneMap:preview.toneMap, displayExposure:preview.displayExposure },
        );
    const image = brushContext.createImageData(highDepthPaintBuffer.width, highDepthPaintBuffer.height);
    image.data.set(rgba);
    brushContext.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    brushContext.putImageData(image, 0, 0);
    highDepthPaintPreviewDirty = false;
    return true;
  }

  async function ensureNativeHighDepthPaintBuffer(owner, layer, {
    requireAlpha = false,
    preferTiled = false,
  } = {}) {
    if (!layer?.highDepthSource || !isCurrentRasterTarget(owner, layer)) return false;
    const wantsTiled = preferTiled && layer.highDepthSource.kind === PIXEL_BUFFER_TILED_SOURCE_KIND;
    const activeChannels = highDepthPaintWorkingSet?.channels ?? highDepthPaintBuffer?.channels ?? 0;
    const activeModel = highDepthPaintWorkingSet?.model ?? highDepthPaintBuffer?.model ?? layer.highDepthSource.model;
    const alphaChannels = activeModel === 'cmyk' ? 5 : 4;
    if (
      isNativeHighDepthPaintTarget(owner, layer) &&
      Boolean(highDepthPaintWorkingSet) === wantsTiled &&
      (!requireAlpha || activeChannels === alphaChannels)
    ) return true;

    const size = checkedCanvasSize(layer.width, layer.height, `High-depth слой «${layer.name || 'Без имени'}»`);
    let working = null;
    let workingSet = null;
    if (wantsTiled) {
      workingSet = createSerializedPixelBufferTileWorkingSet(layer.highDepthSource, {
        maxBytes:highDepthBudgetForLayer(layer),
        requireAlpha,
      });
      if (!workingSet || workingSet.width !== size.width || workingSet.height !== size.height) return false;
    } else {
      working = editableHighDepthBuffer(layer, { requireAlpha });
      if (!working || working.width !== size.width || working.height !== size.height) return false;
    }

    const canvas = documentRef.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!isCurrentRasterTarget(owner, layer)) return false;

    brushCanvas = canvas;
    brushContext = context;
    brushLayerId = layer.id;
    brushOwner = owner;
    brushLayer = layer;
    highDepthPaintBuffer = working;
    highDepthPaintWorkingSet = workingSet;
    highDepthPaintLayerId = layer.id;
    highDepthPaintOwner = owner;
    highDepthPaintLayer = layer;
    highDepthPaintPreviewDirty = true;
    refreshHighDepthPaintCanvas(owner, layer, true, { full:true });
    return true;
  }

  function offsetSelectionPredicate(predicate, offsetX, offsetY) {
    if (typeof predicate !== 'function') return null;
    return (x, y) => predicate(x + offsetX, y + offsetY);
  }

  function brushMutationBounds(from, to, radius) {
    const padding = Math.max(.5, Number(radius) || .5);
    return {
      left:Math.min(from.x, to.x) - padding,
      top:Math.min(from.y, to.y) - padding,
      right:Math.max(from.x, to.x) + padding,
      bottom:Math.max(from.y, to.y) + padding,
    };
  }

  function applyNativeHighDepthBrushDab(owner, layer, point, {
    radius,
    rgb,
    cmyk,
    opacity = 1,
    erase = false,
    isAllowed = null,
  } = {}) {
    if (!isNativeHighDepthPaintTarget(owner, layer)) return 0;
    const editRadius = Math.max(.5, Number(radius) || .5);
    let changed = 0;
    if (highDepthPaintWorkingSet) {
      changed = highDepthPaintWorkingSet.visit(
        brushMutationBounds(point, point, editRadius),
        ({ x, y, buffer }) => buffer.model === 'cmyk'
          ? applyCmykPixelBufferBrushDab(
              buffer, point.x - x, point.y - y, editRadius, cmyk,
              { opacity, erase, isAllowed:offsetSelectionPredicate(isAllowed, x, y) },
            )
          : applyPixelBufferBrushDab(
              buffer, point.x - x, point.y - y, editRadius, rgb,
              { opacity, erase, isAllowed:offsetSelectionPredicate(isAllowed, x, y) },
            ),
      );
    } else if (highDepthPaintBuffer?.model === 'cmyk') {
      changed = applyCmykPixelBufferBrushDab(
        highDepthPaintBuffer, point.x, point.y, editRadius, cmyk,
        { opacity, erase, isAllowed },
      );
    } else if (highDepthPaintBuffer) {
      changed = applyPixelBufferBrushDab(
        highDepthPaintBuffer, point.x, point.y, editRadius, rgb,
        { opacity, erase, isAllowed },
      );
    }
    if (changed > 0) markHighDepthPreviewDirty();
    return changed;
  }

  function applyNativeHighDepthStrokeSegment(owner, layer, from, to, {
    radius,
    rgb,
    cmyk,
    opacity = 1,
    erase = false,
    isAllowed = null,
  } = {}) {
    if (!isNativeHighDepthPaintTarget(owner, layer)) return 0;
    const editRadius = Math.max(.5, Number(radius) || .5);
    let changed = 0;
    if (highDepthPaintWorkingSet) {
      changed = highDepthPaintWorkingSet.visit(
        brushMutationBounds(from, to, editRadius),
        ({ x, y, buffer }) => buffer.model === 'cmyk'
          ? applyCmykPixelBufferStrokeSegment(
              buffer,
              { x:from.x - x, y:from.y - y },
              { x:to.x - x, y:to.y - y },
              editRadius,
              cmyk,
              { opacity, erase, isAllowed:offsetSelectionPredicate(isAllowed, x, y) },
            )
          : applyPixelBufferStrokeSegment(
              buffer,
              { x:from.x - x, y:from.y - y },
              { x:to.x - x, y:to.y - y },
              editRadius,
              rgb,
              { opacity, erase, isAllowed:offsetSelectionPredicate(isAllowed, x, y) },
            ),
      );
    } else if (highDepthPaintBuffer?.model === 'cmyk') {
      changed = applyCmykPixelBufferStrokeSegment(
        highDepthPaintBuffer, from, to, editRadius, cmyk,
        { opacity, erase, isAllowed },
      );
    } else if (highDepthPaintBuffer) {
      changed = applyPixelBufferStrokeSegment(
        highDepthPaintBuffer, from, to, editRadius, rgb,
        { opacity, erase, isAllowed },
      );
    }
    if (changed > 0) markHighDepthPreviewDirty();
    return changed;
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


  async function highDepthPreviewDataUrlFromSource(layer, source) {
    const preview = sanitizeHighDepthPreview(layer.highDepthPreview);
    const canvas = documentRef.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d', { alpha:true, willReadFrequently:true });
    forEachSerializedPixelBufferTile(source, ({ x, y, buffer }) => {
      const rgba = buffer.model === 'cmyk'
        ? cmykPixelBufferToRgba8Preview(buffer, getCmykPreviewTransform())
        : pixelBufferToToneMappedRgba8Preview(buffer, {}, {
            toneMap:preview.toneMap,
            displayExposure:preview.displayExposure,
          });
      const image = context.createImageData(buffer.width, buffer.height);
      image.data.set(rgba);
      context.putImageData(image, x, y);
    });
    return canvasToDataURL(canvas, 'image/png');
  }

  async function prepareTiledHighDepthMutation(layer, visitor, {
    requireAlpha = false,
    maxBytes = null,
  } = {}) {
    if (layer?.highDepthSource?.kind !== PIXEL_BUFFER_TILED_SOURCE_KIND) return null;
    const byteBudget = maxBytes == null
      ? highDepthBudgetForLayer(layer)
      : Math.max(0, Math.trunc(Number(maxBytes) || 0));
    const prepared = mutateSerializedPixelBufferTiles(
      layer.highDepthSource,
      visitor,
      { maxBytes:byteBudget, requireAlpha },
    );
    if (!prepared) return null;
    if (!prepared.changed) {
      return {
        changed:0,
        changedTiles:prepared.changedTiles,
        promotedAlpha:prepared.promotedAlpha,
        mutation:null,
      };
    }
    const dataUrl = await highDepthPreviewDataUrlFromSource(layer, prepared.source);
    return {
      changed:prepared.changed,
      changedTiles:prepared.changedTiles,
      promotedAlpha:prepared.promotedAlpha,
      mutation:{
        highDepthSource:prepared.source,
        dataUrl,
        highDepthPreview:prepared.source.model === 'cmyk'
          ? null
          : sanitizeHighDepthPreview(layer.highDepthPreview),
      },
    };
  }

  async function persistTiledHighDepthMutation(owner, layer, visitor, {
    requireAlpha = false,
    isContinuationCurrent,
  } = {}) {
    if (layer?.highDepthSource?.kind !== PIXEL_BUFFER_TILED_SOURCE_KIND) return null;
    const continuationCurrent = () => (
      typeof isContinuationCurrent !== 'function' || isContinuationCurrent()
    );
    if (!continuationCurrent() || !isCurrentRasterTarget(owner, layer)) {
      return { changed:0, changedTiles:0, applied:false, stale:true };
    }
    const prepared = await prepareTiledHighDepthMutation(layer, visitor, { requireAlpha });
    if (!prepared) return null;
    if (!continuationCurrent() || !isCurrentRasterTarget(owner, layer)) {
      return { changed:prepared.changed, changedTiles:prepared.changedTiles, applied:false, stale:true };
    }
    if (!prepared.mutation) {
      return { changed:0, changedTiles:prepared.changedTiles, applied:false, stale:false };
    }
    applyHighDepthMutation(layer, prepared.mutation);
    return { changed:prepared.changed, changedTiles:prepared.changedTiles, applied:true, stale:false };
  }

  // Keep all ROI tile changes private until the exact document, layer and
  // serialized source are revalidated after the asynchronous preview build.
  async function persistTiledHighDepthInpaint(owner, layer, { isAllowed } = {}) {
    if (layer?.highDepthSource?.kind !== PIXEL_BUFFER_TILED_SOURCE_KIND) return null;
    const originalSource = layer.highDepthSource;
    const stale = () => !isCurrentRasterTarget(owner, layer) || layer.highDepthSource !== originalSource;
    if (stale()) return { changed:0, filled:0, changedTiles:0, applied:false, stale:true };
    const prepared = await prepareTiledInpaintWithWorker(originalSource, {
      isAllowed,
      isCancelled:stale,
      worker:tiledInpaintWorker,
      maxBytes:highDepthBudgetForLayer(layer),
    });
    if (stale() || prepared?.cancelled) return { ...prepared, applied:false, stale:true };
    if (!prepared.changed) return { ...prepared, applied:false, stale:false };
    const dataUrl = await highDepthPreviewDataUrlFromSource(layer, prepared.source);
    if (stale()) return { ...prepared, applied:false, stale:true };
    applyHighDepthMutation(layer, {
      highDepthSource:prepared.source,
      dataUrl,
      highDepthPreview:prepared.source.model === 'cmyk'
        ? null
        : sanitizeHighDepthPreview(layer.highDepthPreview),
    });
    return { ...prepared, applied:true, stale:false };
  }

  async function prepareHighDepthMutation(layer, buffer, { maxBytes = null } = {}) {
    const byteBudget = maxBytes == null
      ? highDepthBudgetForLayer(layer)
      : Math.max(0, Math.trunc(Number(maxBytes) || 0));
    const highDepthSource = serializePixelBufferSourceAdaptive(buffer, { maxBytes: byteBudget });
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

  async function persistHighDepthMutation(owner, layer, buffer, { isContinuationCurrent } = {}) {
    const continuationCurrent = () => typeof isContinuationCurrent !== 'function' || isContinuationCurrent();
    if (!buffer || !continuationCurrent() || !isCurrentRasterTarget(owner, layer)) return false;
    const mutation = await prepareHighDepthMutation(layer, buffer);
    if (!continuationCurrent() || !isCurrentRasterTarget(owner, layer)) return false;
    applyHighDepthMutation(layer, mutation);
    return true;
  }

  async function persistNativeHighDepthPaintLayer(owner, layer) {
    const token = highDepthPaintBuffer || highDepthPaintWorkingSet;
    if (!token) return false;
    if (!isNativeHighDepthPaintTarget(owner, layer)) {
      clearNativeHighDepthPaintTarget(owner, layer, token);
      return false;
    }

    let mutation;
    try {
      if (highDepthPaintWorkingSet) {
        const highDepthSource = highDepthPaintWorkingSet.serialize();
        mutation = {
          highDepthSource,
          dataUrl:await highDepthPreviewDataUrlFromSource(layer, highDepthSource),
          highDepthPreview:highDepthSource.model === 'cmyk'
            ? null
            : sanitizeHighDepthPreview(layer.highDepthPreview),
        };
      } else {
        mutation = await prepareHighDepthMutation(layer, highDepthPaintBuffer);
      }
    } catch (error) {
      clearNativeHighDepthPaintTarget(owner, layer, token);
      throw error;
    }

    if ((highDepthPaintBuffer || highDepthPaintWorkingSet) !== token) return false;
    if (!isNativeHighDepthPaintTarget(owner, layer)) {
      clearNativeHighDepthPaintTarget(owner, layer, token);
      return false;
    }

    applyHighDepthMutation(layer, mutation);
    clearNativeHighDepthPaintTarget(owner, layer, token);
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

  async function ensureRasterBuffer(owner, layer) {
    if (!isCurrentRasterTarget(owner, layer)) return null;
    const paintSize = checkedCanvasSize(layer.width, layer.height, `Растровый слой «${layer.name || 'Без имени'}»`);
    const canvasWidth = paintSize.width;
    const canvasHeight = paintSize.height;
    const canReuse = (
      brushOwner === owner &&
      brushLayer === layer &&
      brushLayerId === layer.id &&
      brushCanvas &&
      brushCanvas.width === canvasWidth &&
      brushCanvas.height === canvasHeight
    );
    if (canReuse) return { canvas: brushCanvas, ctx: brushContext };

    const canvas = documentRef.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext('2d', { alpha: true });
    if (!drawHighDepthRasterBase(layer, canvas, context) && layer.dataUrl) {
      const image = await getImage(layer.dataUrl);
      if (!isCurrentRasterTarget(owner, layer)) return null;
      if (image) context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
    }
    if (!isCurrentRasterTarget(owner, layer)) return null;

    clearHighDepthPaintState();
    brushCanvas = canvas;
    brushContext = context;
    brushLayerId = layer.id;
    brushOwner = owner;
    brushLayer = layer;
    return { canvas, ctx: context };
  }

  async function persistPaintLayer(owner, layer, { isContinuationCurrent } = {}) {
    const canvas = brushCanvas;
    const continuationCurrent = () => typeof isContinuationCurrent !== 'function' || isContinuationCurrent();
    if (
      !continuationCurrent() ||
      !canvas ||
      brushOwner !== owner ||
      brushLayer !== layer ||
      brushLayerId !== layer?.id ||
      !isCurrentRasterTarget(owner, layer)
    ) return false;

    const dataUrl = await canvasToDataURL(canvas, 'image/png');
    if (
      !continuationCurrent() ||
      brushCanvas !== canvas ||
      brushOwner !== owner ||
      brushLayer !== layer ||
      brushLayerId !== layer.id ||
      !isCurrentRasterTarget(owner, layer)
    ) return false;

    const old = layer.dataUrl;
    layer.dataUrl = dataUrl;
    layer.highDepthSource = null;
    layer.highDepthPreview = null;
    invalidateImageCache(old);
    return true;
  }

  function paintPreviewOverrides() {
    if (!brushCanvas || !brushLayerId) return null;
    if (highDepthPaintBuffer || highDepthPaintWorkingSet) {
      if (!isNativeHighDepthPaintTarget(highDepthPaintOwner, highDepthPaintLayer)) return null;
      return new Map([[brushLayerId, { source: brushCanvas, skipAdjustments: true }]]);
    }
    if (
      !brushOwner ||
      !brushLayer ||
      getDocument() !== brushOwner ||
      !Array.isArray(brushOwner.layers) ||
      !brushOwner.layers.includes(brushLayer)
    ) return null;
    return new Map([[brushLayerId, brushCanvas]]);
  }

  function schedulePaintPreview() {
    paintPreviewQueued = true;
    if (paintPreviewFrame) return;
    paintPreviewFrame = requestFrame(() => {
      paintPreviewFrame = 0;
      if (!paintPreviewQueued || getDrag()?.kind !== 'paint') return;
      paintPreviewQueued = false;
      if (highDepthPaintPreviewDirty && highDepthPaintOwner && highDepthPaintLayer) {
        refreshHighDepthPaintCanvas(highDepthPaintOwner, highDepthPaintLayer, true);
      }
      renderPaintPreview();
    });
  }

  return {
    get brushCanvas() { return brushCanvas; },
    get brushContext() { return brushContext; },
    get brushLayerId() { return brushLayerId; },
    get highDepthPaintBuffer() { return highDepthPaintBuffer; },
    get highDepthPaintWorkingSet() { return highDepthPaintWorkingSet; },
    get highDepthPaintLayerId() { return highDepthPaintLayerId; },
    clearBrushBuffer,
    clearHighDepthPaintState,
    reset,
    markHighDepthPreviewDirty,
    isNativeHighDepthPaintTarget,
    highDepthBudgetForLayer,
    editableHighDepthBuffer,
    refreshHighDepthPaintCanvas,
    ensureNativeHighDepthPaintBuffer,
    applyNativeHighDepthBrushDab,
    applyNativeHighDepthStrokeSegment,
    prepareTiledHighDepthMutation,
    persistTiledHighDepthMutation,
    persistTiledHighDepthInpaint,
    prepareHighDepthMutation,
    applyHighDepthMutation,
    persistHighDepthMutation,
    persistNativeHighDepthPaintLayer,
    drawHighDepthRasterBase,
    ensureRasterBuffer,
    persistPaintLayer,
    paintPreviewOverrides,
    schedulePaintPreview,
    cancelPaintPreview,
  };
}
