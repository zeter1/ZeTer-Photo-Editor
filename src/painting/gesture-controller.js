import { addLayer, createRasterLayer } from '../core/state.js';
import { NATIVE_CMYK_PAINT_TOOLS, NATIVE_HIGH_DEPTH_PAINT_TOOLS, TOOL_LABELS } from '../ui/tool-config.js';

const EXISTING_RASTER_ONLY_TOOLS = new Set(['eraser','blur','clone','heal','smudge','dodge','burn']);
const PAINT_HISTORY_LABELS = {
  eraser:'Ластик',
  blur:'Размытие кистью',
  clone:'Штамп',
  heal:'Лечебная кисть',
  smudge:'Палец / смазывание',
  dodge:'Осветлитель',
  burn:'Затемнитель',
  brush:'Кисть',
};

export function createPaintGestureController({
  rasterEdit,
  retouch,
  state,
  target,
  selection,
  tools,
  nativePaint,
  ui,
} = {}) {
  if (!rasterEdit) throw new TypeError('rasterEdit is required');
  if (!retouch) throw new TypeError('retouch is required');
  if (typeof state?.getDocument !== 'function' || typeof state?.getDrag !== 'function' || typeof state?.setDrag !== 'function') {
    throw new TypeError('paint gesture state bridge is required');
  }
  if (typeof target?.atPoint !== 'function' || typeof target?.toLocal !== 'function') {
    throw new TypeError('paint gesture target bridge is required');
  }
  if (typeof state?.beginPersist !== 'function' || typeof state?.endPersist !== 'function') {
    throw new TypeError('paint persistence bridge is required');
  }

  function currentDocument() {
    const documentValue = state.getDocument();
    if (!documentValue) throw new Error('Paint gesture controller has no active document');
    return documentValue;
  }

  function status(message) {
    ui?.setStatus?.(message);
  }

  function warn(message) {
    status(message);
    ui?.toast?.(message, 'warn');
  }

  function nativeToolSupported(layer, tool) {
    const model = layer?.highDepthSource?.model;
    if (!model) return false;
    return model === 'cmyk'
      ? NATIVE_CMYK_PAINT_TOOLS.has(tool)
      : NATIVE_HIGH_DEPTH_PAINT_TOOLS.has(tool);
  }

  async function ensurePaintLayer(point, tool, canContinue = () => true) {
    const doc = currentDocument();
    let layer = target.selected?.() ?? null;
    const rasterAtPoint = target.atPoint(point);

    if (EXISTING_RASTER_ONLY_TOOLS.has(tool)) {
      layer = rasterAtPoint;
      if (!layer) return null;
    } else if (rasterAtPoint) {
      layer = rasterAtPoint;
    } else {
      if (!canContinue()) return null;
      layer = createRasterLayer({
        name:'Рисование',
        x:0,
        y:0,
        width:doc.width,
        height:doc.height,
        dataUrl:null,
      });
      addLayer(doc, layer);
    }

    const nativeHighDepth = layer.highDepthSource && nativeToolSupported(layer, tool)
      ? await rasterEdit.ensureNativeHighDepthPaintBuffer(layer, { requireAlpha:tool === 'eraser' })
      : false;
    if (!nativeHighDepth) await rasterEdit.ensureRasterBuffer(layer);
    doc.selectedLayerId = layer.id;
    return layer;
  }

  function unavailableMessage(tool, cloneSource) {
    if (tool === 'eraser') return 'Ластик работает только по растровому слою. Выберите слой с изображением или рисунком.';
    if (tool === 'blur') return 'Размытие работает только по растровому слою. Выберите слой с изображением или рисунком.';
    if (tool === 'clone' || tool === 'heal') {
      return cloneSource
        ? `${TOOL_LABELS[tool]} работает по слою заданного источника.`
        : `${TOOL_LABELS[tool]}: сначала задайте источник через Alt+клик.`;
    }
    if (tool === 'smudge') return 'Палец работает только по существующему растровому слою.';
    if (tool === 'dodge' || tool === 'burn') return 'Инструмент ретуши работает только по существующему растровому слою.';
    return 'Не удалось подготовить растровый слой для рисования.';
  }

  function resetNativeStrokeState() {
    rasterEdit.clearHighDepthPaintState();
    retouch.resetStroke();
  }

  async function begin({
    point,
    pointerEvent = null,
    tool,
    canContinue = () => true,
  } = {}) {
    if (!point || !tool) return false;
    if (selection?.containsPoint && !selection.containsPoint(point)) {
      status('Рисование ограничено выделением');
      return false;
    }

    const layer = await ensurePaintLayer(point, tool, canContinue);
    if (!canContinue()) return false;

    const cloneSource = retouch.getCloneSource();
    if (!layer) {
      warn(unavailableMessage(tool, cloneSource));
      return false;
    }

    const localPoint = target.toLocal(point, layer);
    const drag = {
      kind:'paint',
      tool,
      layerId:layer.id,
      last:localPoint,
      nativeHighDepth:rasterEdit.highDepthPaintLayerId === layer.id && NATIVE_HIGH_DEPTH_PAINT_TOOLS.has(tool),
    };
    state.setDrag(drag);

    if (tool === 'dodge' || tool === 'burn') {
      drag.toneCoverage = {
        width:drag.nativeHighDepth ? rasterEdit.highDepthPaintBuffer.width : rasterEdit.brushCanvas.width,
        tiles:new Map(),
      };
    }
    if (tool === 'blur') {
      drag.blurCoverage = {
        width:drag.nativeHighDepth ? rasterEdit.highDepthPaintBuffer.width : rasterEdit.brushCanvas.width,
        tiles:new Map(),
      };
    }

    if (drag.nativeHighDepth) {
      if (tool === 'clone' || tool === 'heal') {
        drag.cloneOffset = retouch.prepareNativeHighDepthCloneStroke(layer, localPoint);
        if (!drag.cloneOffset) {
          resetNativeStrokeState();
          rasterEdit.clearBrushBuffer();
          state.setDrag(null);
          status(cloneSource ? `${TOOL_LABELS[tool]}: рисуйте по слою источника` : `${TOOL_LABELS[tool]}: Alt+клик задаёт источник`);
          ui?.toast?.('Сначала задайте источник на этом слое', 'warn');
          return false;
        }
        retouch.applyNativeHighDepthCloneDab(layer, localPoint, drag.cloneOffset, pointerEvent, tool === 'heal');
        return true;
      }
      if (tool === 'smudge') {
        drag.smudgeStarted = true;
        return true;
      }
      if (tool === 'dodge' || tool === 'burn') {
        retouch.applyNativeHighDepthToneDab(layer, localPoint, pointerEvent, tool === 'dodge');
        return true;
      }
      if (tool === 'blur') {
        retouch.applyNativeHighDepthBlurDab(layer, localPoint, pointerEvent);
        return true;
      }
      nativePaint?.dab?.(layer, localPoint, pointerEvent, tool === 'eraser');
      return true;
    }

    const context = rasterEdit.brushContext;
    context.save();
    selection?.clipContext?.(context, layer);

    if (tool === 'clone' || tool === 'heal') {
      drag.cloneOffset = retouch.prepareCloneStroke(layer, localPoint);
      if (!drag.cloneOffset) {
        context.restore();
        state.setDrag(null);
        status(cloneSource ? `${TOOL_LABELS[tool]}: рисуйте по слою источника` : `${TOOL_LABELS[tool]}: Alt+клик задаёт источник`);
        ui?.toast?.('Сначала задайте источник на этом слое', 'warn');
        return false;
      }
      retouch.applyCloneDab(localPoint, drag.cloneOffset, pointerEvent, tool === 'heal');
      rasterEdit.schedulePaintPreview();
      return true;
    }
    if (tool === 'smudge') {
      drag.smudgeStarted = true;
      rasterEdit.schedulePaintPreview();
      return true;
    }
    if (tool === 'dodge' || tool === 'burn') {
      retouch.applyToneDab(layer, localPoint, pointerEvent, tool === 'dodge');
      rasterEdit.schedulePaintPreview();
      return true;
    }
    if (tool === 'blur') {
      retouch.applyBlurDab(layer, localPoint, pointerEvent);
      rasterEdit.schedulePaintPreview();
      return true;
    }

    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = tools.brushWidth(pointerEvent);
    context.globalAlpha = tools.opacity();
    if (tool === 'eraser') context.globalCompositeOperation = 'destination-out';
    else {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = tools.primaryColor();
    }

    context.beginPath();
    context.moveTo(localPoint.x, localPoint.y);
    context.lineTo(localPoint.x + .01, localPoint.y + .01);
    context.stroke();
    rasterEdit.schedulePaintPreview();
    return true;
  }

  function move(point, pointerEvent = null) {
    const drag = state.getDrag();
    if (!drag || drag.kind !== 'paint') return false;
    const layer = currentDocument().layers.find(item => item.id === drag.layerId);
    if (!layer) return false;

    const next = target.toLocal(point, layer);
    const last = drag.last;

    if (drag.nativeHighDepth) {
      if (drag.tool === 'blur') retouch.nativeHighDepthBlurSegment(layer, last, next, pointerEvent);
      else if (drag.tool === 'clone' || drag.tool === 'heal') retouch.nativeHighDepthCloneSegment(layer, last, next, drag.cloneOffset, pointerEvent, drag.tool === 'heal');
      else if (drag.tool === 'smudge') retouch.nativeHighDepthSmudgeSegment(layer, last, next, pointerEvent);
      else if (drag.tool === 'dodge' || drag.tool === 'burn') retouch.nativeHighDepthToneSegment(layer, last, next, pointerEvent, drag.tool === 'dodge');
      else nativePaint?.segment?.(layer, last, next, pointerEvent, drag.tool === 'eraser');
      drag.last = next;
      return true;
    }

    if (drag.tool === 'blur') retouch.blurStrokeSegment(layer, last, next, pointerEvent);
    else if (drag.tool === 'clone' || drag.tool === 'heal') retouch.cloneStrokeSegment(last, next, drag.cloneOffset, pointerEvent, drag.tool === 'heal');
    else if (drag.tool === 'smudge') retouch.smudgeStrokeSegment(last, next, pointerEvent);
    else if (drag.tool === 'dodge' || drag.tool === 'burn') retouch.toneStrokeSegment(layer, last, next, pointerEvent, drag.tool === 'dodge');
    else {
      const context = rasterEdit.brushContext;
      context.lineWidth = tools.brushWidth(pointerEvent);
      context.beginPath();
      context.moveTo(last.x, last.y);
      context.lineTo(next.x, next.y);
      context.stroke();
    }
    drag.last = next;
    return true;
  }

  async function end(drag = state.getDrag()) {
    rasterEdit.cancelPaintPreview();
    const paintTool = drag?.tool;
    const nativeHighDepth = Boolean(
      rasterEdit.highDepthPaintBuffer &&
      rasterEdit.highDepthPaintLayerId === rasterEdit.brushLayerId &&
      NATIVE_HIGH_DEPTH_PAINT_TOOLS.has(paintTool),
    );
    if ((!rasterEdit.brushContext && !nativeHighDepth) || !state.beginPersist()) return false;

    const label = PAINT_HISTORY_LABELS[paintTool] || 'Кисть';
    if (!nativeHighDepth) rasterEdit.brushContext.restore();
    retouch.resetStroke();
    status('Сохранение штриха…');

    try {
      const persisted = nativeHighDepth
        ? await rasterEdit.persistNativeHighDepthPaintLayer()
        : await rasterEdit.persistPaintLayer();
      if (persisted) {
        ui?.commit?.(label);
        status('Готово');
        return true;
      }
      return false;
    } catch (error) {
      console.error(error);
      rasterEdit.clearBrushBuffer();
      ui?.render?.();
      status(`Ошибка сохранения штриха: ${error.message}`);
      ui?.toast?.('Не удалось сохранить штрих', 'error');
      return false;
    } finally {
      state.endPersist();
    }
  }

  return { begin, move, end };
}
