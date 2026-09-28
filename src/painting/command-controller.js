import { addLayer, createRasterLayer } from '../core/state.js';
import { floodFillPixels, hexToRgb } from '../core/pixels.js';
import {
  applyPixelBufferStrokeSegment,
  applyCmykPixelBufferStrokeSegment,
  floodFillPixelBuffer,
  floodFillCmykPixelBuffer,
  clearPixelBufferPixels,
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
        const buffer = rasterEdit.editableHighDepthBuffer(layer);
        if (buffer) {
          const rgb = hexToRgb(tools.primaryColor());
          const changed = buffer.model === 'cmyk'
            ? applyCmykPixelBufferStrokeSegment(
                buffer,
                from,
                to,
                editRadius(),
                tools.rgbToCmyk(rgb),
                { opacity:editOpacity(), isAllowed:selectionPredicate(layer) },
              )
            : applyPixelBufferStrokeSegment(
                buffer,
                from,
                to,
                editRadius(),
                rgb,
                { opacity:editOpacity(), isAllowed:selectionPredicate(layer) },
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

  async function clearSelection({
    historyLabel = 'Очистить выделение',
    successStatus = 'Пиксели внутри выделения очищены',
    ownerDocument,
    targetLayer,
    selectionSnapshot,
  } = {}) {
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
        const buffer = rasterEdit.editableHighDepthBuffer(layer, { requireAlpha:true });
        if (buffer) {
          const cleared = clearPixelBufferPixels(buffer, { isAllowed:selectionPredicate(layer, selectionSnapshot) });
          if (!cleared) {
            status('В выделении нет непрозрачных high-depth пикселей');
            return false;
          }
          if (!await rasterEdit.persistHighDepthMutation(doc, layer, buffer)) return false;
          resetNativeState();
          ui?.commit?.(historyLabel);
          status(`${successStatus} · high-depth: ${cleared.toLocaleString('ru-RU')} px`);
          return true;
        }
      }

      const prepared = await rasterEdit.ensureRasterBuffer(doc, layer);
      if (!prepared) return false;
      const context = prepared.ctx;
      context.save();
      selection?.clipContext?.(context, layer, selectionSnapshot);
      context.clearRect(0, 0, prepared.canvas.width, prepared.canvas.height);
      context.restore();
      if (!await rasterEdit.persistPaintLayer(doc, layer)) return false;
      ui?.commit?.(historyLabel);
      status(successStatus);
      return true;
    } catch (error) {
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

  return { drawLine, fillAt, clearSelection };
}
