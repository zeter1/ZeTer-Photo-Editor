import { frameBounds } from '../core/geometry.js';
import { createRasterLayer, checkedCanvasSize, isLayerVisible, isLayerLocked } from '../core/state.js';
import { renderLayer, getImage, invalidateImageCache } from '../core/render.js';
import { canvasToDataURL } from '../core/io.js';
import { clearPixelBufferPixels } from '../core/pixel-buffer.js';
import { layerStyleOutset } from '../core/layer-styles.js';

export function createSelectionRasterMutationController({
  rasterEdit,
  state,
  selection,
  ui,
  documentRef = globalThis.document,
  operations = {},
} = {}) {
  if (!rasterEdit) throw new TypeError('rasterEdit is required');
  if (
    typeof state?.getDocument !== 'function' ||
    typeof state?.getActiveSessionId !== 'function' ||
    typeof state?.getSelectedLayer !== 'function' ||
    typeof state?.isPersisting !== 'function' ||
    typeof state?.beginPersist !== 'function' ||
    typeof state?.endPersist !== 'function' ||
    typeof state?.blockPendingDocumentEdit !== 'function'
  ) {
    throw new TypeError('selection raster mutation state bridge is required');
  }
  if (
    typeof selection?.hasActive !== 'function' ||
    typeof selection?.captureSnapshot !== 'function' ||
    typeof selection?.intersectsLayer !== 'function' ||
    typeof selection?.predicate !== 'function' ||
    typeof selection?.clipContext !== 'function'
  ) {
    throw new TypeError('selection raster mutation selection bridge is required');
  }

  function currentDocument() {
    const documentValue = state.getDocument();
    if (!documentValue) throw new Error('Selection raster mutation controller has no active document');
    return documentValue;
  }

  function status(message) {
    ui?.setStatus?.(message);
  }

  function beginPersist() {
    if (state.beginPersist()) return true;
    status('Сохраняется предыдущая растровая операция…');
    return false;
  }

  async function prepareClearedHighDepthMutation(layer, selectionSnapshot) {
    if (!layer?.highDepthSource) return null;
    const basePredicate = selection.predicate(layer, selectionSnapshot);
    if (typeof rasterEdit.prepareTiledHighDepthMutation === 'function') {
      const tiled = await rasterEdit.prepareTiledHighDepthMutation(
        layer,
        ({ x, y, buffer }) => clearPixelBufferPixels(buffer, {
          isAllowed:typeof basePredicate === 'function'
            ? (localX, localY) => basePredicate(localX + x, localY + y)
            : null,
        }),
        { requireAlpha:true },
      );
      if (tiled) return { cleared:tiled.changed, mutation:tiled.mutation };
    }
    const buffer = rasterEdit.editableHighDepthBuffer(layer, { requireAlpha:true });
    if (!buffer) return null;
    const cleared = clearPixelBufferPixels(buffer, { isAllowed:basePredicate });
    if (!cleared) return { cleared:0, mutation:null };
    return { cleared, mutation:await rasterEdit.prepareHighDepthMutation(layer, buffer) };
  }

  async function prepareClearedRasterDataUrl(layer, selectionSnapshot) {
    if (!documentRef?.createElement) throw new Error('Canvas document is unavailable');
    const size = checkedCanvasSize(layer.width, layer.height, 'Растровый слой «' + (layer.name || 'Без имени') + '»');
    const canvas = documentRef.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha:true });
    if (!rasterEdit.drawHighDepthRasterBase(layer, canvas, context) && layer.dataUrl) {
      const image = await getImage(layer.dataUrl);
      if (image) context.drawImage(image, 0, 0, size.width, size.height);
    }
    context.save();
    selection.clipContext(context, layer, selectionSnapshot);
    context.clearRect(0, 0, size.width, size.height);
    context.restore();
    return canvasToDataURL(canvas, 'image/png');
  }

  async function rasterizeLayerForPixelEditing(layer, { suffixName = true } = {}) {
    if (!layer) return null;
    if (layer.type === 'adjustment') {
      throw new Error('Корректирующий слой нельзя растрировать отдельно от результата нижележащего стека');
    }
    if (layer.type === 'raster') return layer;
    if (!documentRef?.createElement) throw new Error('Canvas document is unavailable');

    const scale = Math.max(Math.abs(Number(layer.scaleX) || 1), Math.abs(Number(layer.scaleY) || 1));
    const blur = Math.max(0, Number(layer.filters?.blur) || 0) * scale * 3;
    const stroke = layer.type === 'shape' ? Math.max(0, Number(layer.strokeWidth) || 0) * scale / 2 : 0;
    const bounds = frameBounds(layer, Math.ceil(blur + stroke + layerStyleOutset(layer.styles) * scale + 2));
    const x = Math.floor(bounds.x);
    const y = Math.floor(bounds.y);
    const width = Math.max(1, Math.ceil(bounds.x + bounds.width) - x);
    const height = Math.max(1, Math.ceil(bounds.y + bounds.height) - y);
    checkedCanvasSize(width, height, 'Растеризация слоя «' + (layer.name || 'Без имени') + '»');

    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha:true });
    context.translate(-x, -y);
    const baked = structuredClone(layer);
    baked.opacity = 1;
    baked.blendMode = 'source-over';
    await renderLayer(context, baked);

    return createRasterLayer({
      id:layer.id,
      name:suffixName ? layer.name + ' — растр' : layer.name,
      visible:layer.visible,
      locked:false,
      opacity:layer.opacity,
      blendMode:layer.blendMode,
      groupId:layer.groupId ?? null,
      x,
      y,
      width,
      height,
      dataUrl:await canvasToDataURL(canvas, 'image/png'),
    });
  }

  const rasterizeLayer = operations.rasterizeLayerForPixelEditing || rasterizeLayerForPixelEditing;
  const prepareRasterDataUrl = operations.prepareClearedRasterDataUrl || prepareClearedRasterDataUrl;
  const prepareHighDepthMutation = operations.prepareClearedHighDepthMutation || prepareClearedHighDepthMutation;

  async function clearAcrossVisibleLayers({
    historyLabel = 'Вырезать выделение',
    ownerDocument,
    ownerSessionId,
    selectionSnapshot,
    isContinuationCurrent,
  } = {}) {
    const continuationCurrent = typeof isContinuationCurrent === 'function' ? isContinuationCurrent : () => true;
    if (!continuationCurrent()) return null;
    const hasExplicitSelection = selectionSnapshot !== undefined;
    if (!hasExplicitSelection && !selection.hasActive()) return { cleared:0, locked:0, rasterized:0 };
    if (hasExplicitSelection && !selectionSnapshot) return { cleared:0, locked:0, rasterized:0 };
    if (state.isPersisting()) {
      status('Сохраняется предыдущая растровая операция…');
      return null;
    }

    const documentValue = ownerDocument === undefined ? currentDocument() : ownerDocument;
    const targetSessionId = ownerSessionId === undefined ? state.getActiveSessionId() : ownerSessionId;
    if (state.getDocument() !== documentValue || state.getActiveSessionId() !== targetSessionId) {
      status('Очистка выделения отменена: активный документ изменился');
      return null;
    }
    const frozenSelection = hasExplicitSelection ? selectionSnapshot : selection.captureSnapshot();
    if (!frozenSelection) return { cleared:0, locked:0, rasterized:0 };
    const intersecting = documentValue.layers.filter(
      layer => isLayerVisible(documentValue, layer) && selection.intersectsLayer(layer, frozenSelection),
    );
    const pixelTargets = intersecting.filter(layer => layer.type !== 'adjustment');
    const targets = pixelTargets.filter(layer => !isLayerLocked(documentValue, layer));
    const locked = pixelTargets.length - targets.length;
    if (!targets.length) return { cleared:0, locked, rasterized:0 };
    if (!beginPersist()) return null;

    try {
      const prepared = [];
      let rasterized = 0;
      for (const layer of targets) {
        const working = layer.type === 'raster' ? layer : await rasterizeLayer(layer);
        if (!continuationCurrent()) return null;
        if (!working) throw new Error('Не удалось подготовить слой к очистке');
        if (layer.type !== 'raster') rasterized += 1;
        if (layer.type === 'raster' && working.highDepthSource) {
          const highDepth = await prepareHighDepthMutation(working, frozenSelection);
          if (!continuationCurrent()) return null;
          if (highDepth) {
            if (highDepth.mutation) {
              prepared.push({ layer, working, dataUrl:highDepth.mutation.dataUrl, highDepthMutation:highDepth.mutation });
            }
            continue;
          }
        }
        const dataUrl = await prepareRasterDataUrl(working, frozenSelection);
        if (!continuationCurrent()) return null;
        prepared.push({ layer, working, dataUrl, highDepthMutation:null });
      }

      if (!continuationCurrent()) return null;
      if (state.getDocument() !== documentValue || state.getActiveSessionId() !== targetSessionId) {
        status('Очистка выделения отменена: активный документ изменился');
        return null;
      }
      if (!prepared.length) return { cleared:0, locked, rasterized };

      const publication = prepared.map(entry => ({
        ...entry,
        index:documentValue.layers.indexOf(entry.layer),
      }));
      if (publication.some(({ layer, index }) => index < 0 || isLayerLocked(documentValue, layer))) {
        status('Очистка выделения отменена: целевой слой изменился или заблокирован');
        return null;
      }

      for (const { layer, working, dataUrl, highDepthMutation, index } of publication) {
        if (layer.type === 'raster') {
          if (highDepthMutation) {
            rasterEdit.applyHighDepthMutation(layer, highDepthMutation);
            continue;
          }
          const oldDataUrl = layer.dataUrl;
          layer.dataUrl = dataUrl;
          layer.highDepthSource = null;
          layer.highDepthPreview = null;
          invalidateImageCache(oldDataUrl);
        } else {
          working.dataUrl = dataUrl;
          documentValue.layers.splice(index, 1, working);
        }
      }

      rasterEdit.clearBrushBuffer();
      ui?.commit?.(historyLabel);
      return { cleared:prepared.length, locked, rasterized };
    } catch (error) {
      if (!continuationCurrent()) return null;
      console.error(error);
      rasterEdit.clearBrushBuffer();
      ui?.render?.();
      status('Ошибка вырезания со всех слоёв: ' + error.message);
      ui?.toast?.('Не удалось очистить выделение на всех слоях', 'error');
      return null;
    } finally {
      state.endPersist();
    }
  }

  async function rasterizeSelectedLayer() {
    if (state.blockPendingDocumentEdit()) return false;
    const layer = state.getSelectedLayer();
    if (!layer) return false;

    const documentValue = currentDocument();
    if (isLayerLocked(documentValue, layer)) {
      status('Слой или его группа заблокированы');
      return false;
    }
    if (layer.type === 'raster') {
      status('Слой уже растровый');
      return false;
    }
    if (layer.type === 'adjustment') {
      status('Корректирующий слой нельзя растрировать отдельно');
      return false;
    }

    const targetSessionId = state.getActiveSessionId();
    const originalLayer = JSON.stringify(layer);
    if (!beginPersist()) return false;
    status('Растеризация слоя…');

    try {
      const raster = await rasterizeLayer(layer);
      const activeDocument = state.getDocument();
      const index = activeDocument?.layers?.indexOf(layer) ?? -1;
      if (
        activeDocument !== documentValue ||
        state.getActiveSessionId() !== targetSessionId ||
        index < 0 ||
        state.getSelectedLayer() !== layer ||
        isLayerLocked(activeDocument, layer) ||
        JSON.stringify(layer) !== originalLayer
      ) {
        status('Растеризация отменена: документ или слой изменился');
        return false;
      }

      activeDocument.layers.splice(index, 1, raster);
      activeDocument.selectedLayerId = raster.id;
      rasterEdit.clearBrushBuffer();
      ui?.commit?.('Растеризовать слой');
      status('Слой растрирован: ' + raster.width + ' × ' + raster.height);
      return true;
    } catch (error) {
      console.error(error);
      status('Ошибка растеризации: ' + error.message);
      ui?.toast?.('Не удалось растрировать слой', 'error');
      return false;
    } finally {
      state.endPersist();
    }
  }

  return { clearAcrossVisibleLayers, rasterizeSelectedLayer };
}
