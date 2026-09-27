import { addLayer, createRasterLayer } from '../core/state.js';

export const GRADIENT_COMMAND_RESULT = Object.freeze({
  COMMITTED: 'committed',
  NOOP: 'noop',
  REJECTED: 'rejected',
  FAILED: 'failed',
});

export const GRADIENT_COMMAND_REASON = Object.freeze({
  TOO_SHORT: 'too-short',
  BUSY: 'busy',
  STALE_OWNER: 'stale-owner',
});

function commandResult(result, reason = null, error = null) {
  const outcome = { result };
  if (reason) outcome.reason = reason;
  if (error) outcome.error = error;
  return outcome;
}

export function createGradientCommandController({
  rasterEdit,
  state,
  runtime,
  selection,
  tools,
  io,
  transaction,
  ui = {},
} = {}) {
  if (typeof rasterEdit?.clearBrushBuffer !== 'function') {
    throw new TypeError('gradient command raster-edit bridge is required');
  }
  if (
    typeof state?.getDocument !== 'function' ||
    typeof state?.isPersisting !== 'function' ||
    typeof state?.beginPersist !== 'function' ||
    typeof state?.endPersist !== 'function'
  ) {
    throw new TypeError('gradient command state bridge is required');
  }
  if (typeof runtime?.createCanvas !== 'function') {
    throw new TypeError('gradient command canvas bridge is required');
  }
  if (typeof selection?.clipContext !== 'function') {
    throw new TypeError('gradient command selection bridge is required');
  }
  if (
    typeof tools?.type !== 'function' ||
    typeof tools?.primaryColor !== 'function' ||
    typeof tools?.secondaryColor !== 'function' ||
    typeof tools?.opacity !== 'function'
  ) {
    throw new TypeError('gradient command tool bridge is required');
  }
  if (typeof io?.canvasToDataURL !== 'function') {
    throw new TypeError('gradient command IO bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('gradient command transaction bridge is required');
  }

  const status = message => ui.setStatus?.(message);
  const activeOwner = owner => Boolean(owner) && state.getDocument() === owner;
  const stale = () => commandResult(
    GRADIENT_COMMAND_RESULT.REJECTED,
    GRADIENT_COMMAND_REASON.STALE_OWNER,
  );
  const busy = () => {
    status('Сохраняется предыдущая растровая операция…');
    return commandResult(
      GRADIENT_COMMAND_RESULT.REJECTED,
      GRADIENT_COMMAND_REASON.BUSY,
    );
  };

  async function apply(owner, start, end) {
    const distance = Math.hypot(
      Number(end?.x) - Number(start?.x),
      Number(end?.y) - Number(start?.y),
    );
    if (!Number.isFinite(distance) || distance < 2) {
      status('Градиент: протяните линию по холсту');
      return commandResult(
        GRADIENT_COMMAND_RESULT.NOOP,
        GRADIENT_COMMAND_REASON.TOO_SHORT,
      );
    }
    if (!activeOwner(owner)) return stale();
    if (state.isPersisting()) return busy();
    if (!state.beginPersist()) return busy();

    try {
      if (!activeOwner(owner)) return stale();

      const canvas = runtime.createCanvas();
      canvas.width = owner.width;
      canvas.height = owner.height;
      const context = canvas.getContext?.('2d', { alpha:true });
      if (!context) throw new Error('Canvas 2D context is unavailable');

      const type = tools.type() === 'radial' ? 'radial' : 'linear';
      const primaryColor = tools.primaryColor();
      const secondaryColor = tools.secondaryColor() || '#ffffff';
      const opacity = tools.opacity();
      const gradient = type === 'radial'
        ? context.createRadialGradient(start.x, start.y, 0, start.x, start.y, distance)
        : context.createLinearGradient(start.x, start.y, end.x, end.y);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, secondaryColor);
      context.fillStyle = gradient;
      context.globalAlpha = opacity;

      if (!activeOwner(owner)) return stale();
      context.save();
      try {
        selection.clipContext(context, owner);
        context.fillRect(0, 0, canvas.width, canvas.height);
      } finally {
        context.restore();
      }

      const dataUrl = await io.canvasToDataURL(canvas, 'image/png');
      if (!activeOwner(owner)) return stale();

      addLayer(owner, createRasterLayer({
        name:'Градиент',
        x:0,
        y:0,
        width:owner.width,
        height:owner.height,
        dataUrl,
      }));
      rasterEdit.clearBrushBuffer();
      transaction.commit('Добавить градиент');
      status('Градиент добавлен на новый слой');
      return commandResult(GRADIENT_COMMAND_RESULT.COMMITTED);
    } catch (error) {
      ui.consoleRef?.error?.(error);
      ui.toast?.('Не удалось создать градиент', 'error');
      return commandResult(GRADIENT_COMMAND_RESULT.FAILED, null, error);
    } finally {
      state.endPersist();
    }
  }

  return { apply };
}
