import { addLayer, createRasterLayer } from '../core/state.js';
import { floodFillPixels, hexToRgb } from '../core/pixels.js';
import { inpaintSelectedSamples } from '../core/inpaint.js';
import {
  applyPixelBufferStrokeSegment,
  applyCmykPixelBufferStrokeSegment,
  floodFillPixelBuffer,
  floodFillCmykPixelBuffer,
  clearPixelBufferPixels,
  inpaintPixelBuffer,
} from '../core/pixel-buffer.js';

export function createRasterCommandController({
  rasterEdit,
  state,
  target,
  selection,
  tools,
  ui,
} = {}) {
  if (!rasterEdit) throw new TypeError('rasterEdit is required');
  if (
    typeof state?.getDocument !== 'function' ||
    typeof state?.isPersisting !== 'function' ||
    typeof state?.beginPersist !== 'function' ||
    typeof state?.endPersist !== 'function'
  ) {
    throw new TypeError('raster command state bridge is required');
  }
  if (
    typeof target?.isEditableRasterLayer !== 'function' ||
    typeof target?.atPoint !== 'function' ||
    typeof target?.toLocal !== 'function'
  ) {
    throw new TypeError('raster command target bridge is required');
  }
  if (
    typeof tools?.primaryColor !== 'function' ||
    typeof tools?.brushSize !== 'function' ||
    typeof tools?.opacity !== 'function' ||
    typeof tools?.fillTolerance !== 'function' ||
    typeof tools?.rgbToCmyk !== 'function'
  ) {
    throw new TypeError('raster command tool bridge is required');
  }

  function currentDocument() {
    const documentValue = state.getDocument();
    if (!documentValue) throw new Error('Raster command controller has no active document');
    return documentValue;
  }

  function status(message) {
    ui?.setStatus?.(message);
  }

  function busy() {
    if (!state.isPersisting()) return false;
    status('Сохраняется предыдущая растровая операция…');
    return true;
  }

  function beginPersist() {
    if (state.beginPersist()) return true;
    status('Сохраняется предыдущая растровая операция…');
    return false;
  }

  function selectionPredicate(layer, selectionSnapshot) {
    return selection?.predicate?.(layer, selectionSnapshot) ?? null;
  }

  function offsetPredicate(predicate, offsetX, offsetY) {
    if (typeof predicate !== 'function') return null;
    return (x, y) => predicate(x + offsetX, y + offsetY);
  }

  function resetNativeState() {
    rasterEdit.clearBrushBuffer();
    state.resetPaintState?.();
  }

  function editRadius() {
    return Math.max(.5, tools.brushSize() / 2);
  }

  function editOpacity() {
    return tools.opacity();
  }

  async function drawLine(start, end) {
    if (busy()) return false;
    const doc = currentDocument();
    let layer = target.selected?.() ?? null;
    if (!target.isEditableRasterLayer(layer)) {
      layer = createRasterLayer({
        name:'Линии',
        x:0,
        y:0,
        width:doc.width,
        height:doc.height,
        dataUrl:null,
      });
      addLayer(doc, layer);
    }
    if (!beginPersist()) return false;

    try {
      const from = target.toLocal(start, layer);
      const to = target.toLocal(end, layer);
      if (layer.highDepthSource) {
        const rgb = hexToRgb(tools.primaryColor());
        const basePredicate = selectionPredicate(layer);
        const tiled = typeof rasterEdit.persistTiledHighDepthMutation === 'function'
          ? await rasterEdit.persistTiledHighDepthMutation(doc, layer, ({ x, y, buffer }) => {
              const localFrom = { x:from.x - x, y:from.y - y };
              const localTo = { x:to.x - x, y:to.y - y };
              const isAllowed = offsetPredicate(basePredicate, x, y);
              return buffer.model === 'cmyk'
                ? applyCmykPixelBufferStrokeSegment(
                    buffer, localFrom, localTo, editRadius(), tools.rgbToCmyk(rgb),
                    { opacity:editOpacity(), isAllowed },
                  )
                : applyPixelBufferStrokeSegment(
                    buffer, localFrom, localTo, editRadius(), rgb,
                    { opacity:editOpacity(), isAllowed },
                  );
            })
          : null;
        if (tiled != null) {
          if (tiled.stale) return false;
          if (!tiled.changed) {
            status('Линия не изменила high-depth слой');
            return false;
          }
          if (!tiled.applied) return false;
          resetNativeState();
          doc.selectedLayerId = layer.id;
          ui?.commit?.('Нарисовать линию');
          status(`Линия добавлена в tiled high-depth слой «${layer.name}» · ${tiled.changedTiles} tiles`);
          return true;
        }
        const buffer = rasterEdit.editableHighDepthBuffer(layer);
        if (buffer) {
          const changed = buffer.model === 'cmyk'
            ? applyCmykPixelBufferStrokeSegment(
                buffer, from, to, editRadius(), tools.rgbToCmyk(rgb),
                { opacity:editOpacity(), isAllowed:basePredicate },
              )
            : applyPixelBufferStrokeSegment(
                buffer, from, to, editRadius(), rgb,
                { opacity:editOpacity(), isAllowed:basePredicate },
              );
          if (!changed) {
            status('Линия не изменила high-depth слой');
            return false;
          }
          if (!await rasterEdit.persistHighDepthMutation(doc, layer, buffer)) return false;
          resetNativeState();
          doc.selectedLayerId = layer.id;
          ui?.commit?.('Нарисовать линию');
          status(`Линия добавлена в high-depth слой «${layer.name}»`);
          return true;
        }
      }

      const prepared = await rasterEdit.ensureRasterBuffer(doc, layer);
      if (!prepared) return false;
      const context = prepared.ctx;
      context.save();
      selection?.clipContext?.(context, layer);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = Math.max(1, tools.brushSize());
      context.globalAlpha = editOpacity();
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = tools.primaryColor();
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.restore();
      doc.selectedLayerId = layer.id;
      if (!await rasterEdit.persistPaintLayer(doc, layer)) return false;
      ui?.commit?.('Нарисовать линию');
      status(`Линия добавлена в слой «${layer.name}»`);
      return true;
    } catch (error) {
      console.error(error);
      rasterEdit.clearBrushBuffer();
      ui?.render?.();
      status(`Ошибка линии: ${error.message}`);
      ui?.toast?.('Не удалось нарисовать линию', 'error');
      return false;
    } finally {
      state.endPersist();
    }
  }

  async function fillAt(point) {
    if (busy()) return false;
    if (selection?.hasActive?.() && selection?.containsPoint && !selection.containsPoint(point)) {
      status('Заливка: щёлкните внутри активного выделения');
      return false;
    }

    const doc = currentDocument();
    const layer = target.atPoint(point);
    if (!layer) {
      status('Заливка работает по растровому слою');
      ui?.toast?.('Выберите растровый слой или щёлкните по изображению', 'warn');
      return false;
    }
    if (!beginPersist()) return false;

    try {
      const local = target.toLocal(point, layer);
      if (layer.highDepthSource) {
        const buffer = rasterEdit.editableHighDepthBuffer(layer);
        if (buffer) {
          const x = Math.floor(local.x);
          const y = Math.floor(local.y);
          if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) {
            status('Точка заливки вне растрового слоя');
            return false;
          }
          status('High-depth заливка области…');
          const rgb = hexToRgb(tools.primaryColor());
          const filled = buffer.model === 'cmyk'
            ? floodFillCmykPixelBuffer(
                buffer,
                x,
                y,
                tools.rgbToCmyk(rgb),
                { tolerance:tools.fillTolerance(), opacity:editOpacity(), isAllowed:selectionPredicate(layer) },
              )
            : floodFillPixelBuffer(
                buffer,
                x,
                y,
                rgb,
                { tolerance:tools.fillTolerance(), opacity:editOpacity(), isAllowed:selectionPredicate(layer) },
              );
          if (!filled) {
            status('Заливка: подходящая область не найдена');
            return false;
          }
          if (!await rasterEdit.persistHighDepthMutation(doc, layer, buffer)) return false;
          resetNativeState();
          doc.selectedLayerId = layer.id;
          ui?.commit?.('Заливка');
          status(`High-depth заливка: ${filled.toLocaleString('ru-RU')} px`);
          return true;
        }
      }

      const prepared = await rasterEdit.ensureRasterBuffer(doc, layer);
      if (!prepared) return false;
      const x = Math.floor(local.x);
      const y = Math.floor(local.y);
      if (x < 0 || y < 0 || x >= prepared.canvas.width || y >= prepared.canvas.height) {
        status('Точка заливки вне растрового слоя');
        return false;
      }
      status('Заливка области…');
      const imageData = prepared.ctx.getImageData(
        0,
        0,
        prepared.canvas.width,
        prepared.canvas.height,
      );
      const filled = floodFillPixels(
        imageData.data,
        prepared.canvas.width,
        prepared.canvas.height,
        x,
        y,
        hexToRgb(tools.primaryColor()),
        {
          tolerance:tools.fillTolerance(),
          opacity:editOpacity(),
          isAllowed:selectionPredicate(layer),
        },
      );
      if (!filled) {
        status('Заливка: подходящая область не найдена');
        return false;
      }
      prepared.ctx.putImageData(imageData, 0, 0);
      doc.selectedLayerId = layer.id;
      if (!await rasterEdit.persistPaintLayer(doc, layer)) return false;
      ui?.commit?.('Заливка');
      status(`Заливка: ${filled.toLocaleString('ru-RU')} px`);
      return true;
    } catch (error) {
      console.error(error);
      rasterEdit.clearBrushBuffer();
      ui?.render?.();
      status(`Ошибка заливки: ${error.message}`);
      ui?.toast?.('Не удалось выполнить заливку', 'error');
      return false;
    } finally {
      state.endPersist();
    }
  }


  async function contentAwareFill({ ownerDocument, ownerLayer, isAllowed: maskPredicate, historyLabel = 'Контент-заливка' } = {}) {
    if (busy()) return false;
    const selectionSnapshot = selection?.captureSnapshot?.() ?? null;
    if (!selectionSnapshot && typeof maskPredicate !== 'function') {
      status('Контент-заливка: сначала создайте выделение');
      return false;
    }

    const doc = currentDocument();
    const layer = target.selected?.() ?? null;
    if ((ownerDocument && ownerDocument !== doc) || (ownerLayer && ownerLayer !== layer)) return false;
    if (!Array.isArray(doc?.layers) || !doc.layers.includes(layer) || !target.isEditableRasterLayer(layer)) {
      status('Контент-заливка работает по выбранному незаблокированному растровому слою');
      ui?.toast?.('Выберите растровый слой для контент-заливки', 'warn');
      return false;
    }
    if (!maskPredicate && selection?.intersectsLayer && !selection.intersectsLayer(layer, selectionSnapshot)) {
      status('Контент-заливка: выделение не пересекает выбранный слой');
      return false;
    }

    const isAllowed = maskPredicate ?? selectionPredicate(layer, selectionSnapshot);
    if (typeof isAllowed !== 'function') {
      status('Контент-заливка: не удалось зафиксировать геометрию выделения');
      return false;
    }
    if (!beginPersist()) return false;

    try {
      status('Контент-заливка: анализ окружения…');

      if (layer.highDepthSource) {
        const buffer = rasterEdit.editableHighDepthBuffer(layer);
        if (!buffer) {
          resetNativeState();
          status('Контент-заливка: native high-depth buffer недоступен; precision сохранён без raster fallback');
          return false;
        }
        const filled = inpaintPixelBuffer(buffer, { isAllowed });
        if (!filled) {
          resetNativeState();
          status('Контент-заливка: нужны исходные пиксели за пределами выделения');
          return false;
        }
        if (!await rasterEdit.persistHighDepthMutation(doc, layer, buffer)) {
          resetNativeState();
          return false;
        }
        resetNativeState();
        ui?.commit?.(historyLabel);
        status(`Контент-заливка: восстановлено ${filled.toLocaleString('ru-RU')} px · ${buffer.bitsPerChannel}-bit ${String(buffer.model).toUpperCase()}`);
        return true;
      }

      const prepared = await rasterEdit.ensureRasterBuffer(doc, layer);
      if (!prepared) return false;
      if (state.getDocument() !== doc || !doc.layers.includes(layer) || !target.isEditableRasterLayer(layer)) {
        rasterEdit.clearBrushBuffer();
        status('Контент-заливка отменена: документ или слой изменился');
        return false;
      }

      const imageData = prepared.ctx.getImageData(0, 0, prepared.canvas.width, prepared.canvas.height);
      const filled = inpaintSelectedSamples(imageData.data, prepared.canvas.width, prepared.canvas.height, 4, { isAllowed });
      if (!filled) {
        rasterEdit.clearBrushBuffer();
        status('Контент-заливка: нужны исходные пиксели за пределами выделения');
        return false;
      }
      prepared.ctx.putImageData(imageData, 0, 0);
      if (!await rasterEdit.persistPaintLayer(doc, layer)) {
        rasterEdit.clearBrushBuffer();
        return false;
      }
      ui?.commit?.(historyLabel);
      status(`Контент-заливка: восстановлено ${filled.toLocaleString('ru-RU')} px`);
      return true;
    } catch (error) {
      resetNativeState();
      ui?.render?.();
      if (error instanceof RangeError && String(error.message).startsWith('Контент-заливка:')) {
        status(error.message);
        ui?.toast?.(error.message, 'warn');
        return false;
      }
      console.error(error);
      status(`Ошибка контент-заливки: ${error.message}`);
      ui?.toast?.('Не удалось выполнить контент-заливку', 'error');
      return false;
    } finally {
      state.endPersist();
    }
  }

  async function clearSelection({
    historyLabel = 'Очистить выделение',
    successStatus = 'Пиксели внутри выделения очищены',
    ownerDocument,
    targetLayer,
    selectionSnapshot,
    isContinuationCurrent,
  } = {}) {
    const continuationCurrent = typeof isContinuationCurrent === 'function' ? isContinuationCurrent : () => true;
    if (!continuationCurrent()) return false;
    const hasExplicitSelection = selectionSnapshot !== undefined;
    if (!hasExplicitSelection && !selection?.hasActive?.()) return false;
    if (hasExplicitSelection && !selectionSnapshot) return false;
    if (busy()) return false;

    const doc = ownerDocument === undefined ? currentDocument() : ownerDocument;
    if (state.getDocument() !== doc) {
      status('Очистка выделения отменена: активный документ изменился');
      return false;
    }
    const layer = targetLayer === undefined ? (target.selected?.() ?? null) : targetLayer;
    if (!Array.isArray(doc?.layers) || !doc.layers.includes(layer) || !target.isEditableRasterLayer(layer)) {
      status('Для очистки выделения выберите незаблокированный растровый слой');
      ui?.toast?.('Выделение очищает пиксели только на растровом слое', 'warn');
      return false;
    }
    if (selection?.intersectsLayer && !selection.intersectsLayer(layer, selectionSnapshot)) {
      status('Выделение не пересекает выбранный слой');
      return false;
    }
    if (!beginPersist()) return false;

    try {
      if (layer.highDepthSource) {
        const basePredicate = selectionPredicate(layer, selectionSnapshot);
        const tiled = typeof rasterEdit.persistTiledHighDepthMutation === 'function'
          ? await rasterEdit.persistTiledHighDepthMutation(
              doc, layer,
              ({ x, y, buffer }) => clearPixelBufferPixels(
                buffer, { isAllowed:offsetPredicate(basePredicate, x, y) },
              ),
              { requireAlpha:true, isContinuationCurrent:continuationCurrent },
            )
          : null;
        if (tiled != null) {
          if (tiled.stale) {
            resetNativeState();
            return false;
          }
          if (!tiled.changed) {
            status('В выделении нет непрозрачных high-depth пикселей');
            return false;
          }
          if (!tiled.applied) return false;
          resetNativeState();
          ui?.commit?.(historyLabel);
          status(`${successStatus} · tiled high-depth: ${tiled.changed.toLocaleString('ru-RU')} px`);
          return true;
        }
        const buffer = rasterEdit.editableHighDepthBuffer(layer, { requireAlpha:true });
        if (buffer) {
          const cleared = clearPixelBufferPixels(buffer, { isAllowed:basePredicate });
          if (!cleared) {
            status('В выделении нет непрозрачных high-depth пикселей');
            return false;
          }
          if (!await rasterEdit.persistHighDepthMutation(doc, layer, buffer, { isContinuationCurrent:continuationCurrent })) {
            if (!continuationCurrent()) resetNativeState();
            return false;
          }
          resetNativeState();
          ui?.commit?.(historyLabel);
          status(`${successStatus} · high-depth: ${cleared.toLocaleString('ru-RU')} px`);
          return true;
        }
      }

      const prepared = await rasterEdit.ensureRasterBuffer(doc, layer);
      if (!prepared) return false;
      if (!continuationCurrent()) {
        rasterEdit.clearBrushBuffer();
        return false;
      }
      const context = prepared.ctx;
      context.save();
      selection?.clipContext?.(context, layer, selectionSnapshot);
      context.clearRect(0, 0, prepared.canvas.width, prepared.canvas.height);
      context.restore();
      if (!await rasterEdit.persistPaintLayer(doc, layer, { isContinuationCurrent:continuationCurrent })) {
        if (!continuationCurrent()) rasterEdit.clearBrushBuffer();
        return false;
      }
      ui?.commit?.(historyLabel);
      status(successStatus);
      return true;
    } catch (error) {
      if (!continuationCurrent()) {
        rasterEdit.clearBrushBuffer();
        return false;
      }
      console.error(error);
      rasterEdit.clearBrushBuffer();
      ui?.render?.();
      status(`Ошибка очистки выделения: ${error.message}`);
      ui?.toast?.('Не удалось очистить выделение', 'error');
      return false;
    } finally {
      state.endPersist();
    }
  }

  return { drawLine, fillAt, contentAwareFill, clearSelection };
}
