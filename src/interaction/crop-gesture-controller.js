import { normalizeRect } from '../core/geometry.js';

export const CROP_GESTURE_KIND = 'crop';
export const CROP_GESTURE_MIN_SIZE = 10;

function finitePoint(value, label = 'crop point') {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`${label} must contain finite coordinates`);
  }
  return { x, y };
}

function safeDraftRect(value) {
  if (value == null) return null;
  const x = Number(value?.x);
  const y = Number(value?.y);
  const width = Number(value?.width);
  const height = Number(value?.height);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 0 ||
    height < 0
  ) {
    throw new TypeError('crop draft rectangle must contain finite non-negative geometry');
  }
  return { x, y, width, height };
}

function immutableRect(rect) {
  return rect ? Object.freeze({ ...rect }) : null;
}

export function createCropGestureController({ state } = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('crop gesture state bridge is required');
  }

  let activeGesture = null;
  let draftRect = null;

  function isGesture(value) {
    return value?.kind === CROP_GESTURE_KIND;
  }

  function activeOwner(gesture) {
    return gesture === activeGesture && state.getDocument() === gesture?.owner;
  }

  function begin(owner, point) {
    if (!owner || typeof owner !== 'object') {
      throw new TypeError('crop gesture owner is required');
    }
    const start = finitePoint(point, 'crop start point');
    const gesture = {
      kind: CROP_GESTURE_KIND,
      owner,
      start,
      current: { ...start },
    };
    activeGesture = gesture;
    draftRect = { x:start.x, y:start.y, width:0, height:0 };
    return gesture;
  }

  function update(gesture, point) {
    if (!activeOwner(gesture)) {
      if (gesture === activeGesture) reset();
      return null;
    }
    const current = finitePoint(point, 'crop current point');
    gesture.current = current;
    draftRect = normalizeRect(gesture.start, current);
    return immutableRect(draftRect);
  }

  function finish(gesture, releasePoint) {
    if (!activeOwner(gesture)) {
      if (gesture === activeGesture) reset();
      return { accepted:false, reason:'stale' };
    }

    const current = finitePoint(releasePoint, 'crop release point');
    gesture.current = current;
    const rect = normalizeRect(gesture.start, current);
    activeGesture = null;
    draftRect = rect;

    if (rect.width < CROP_GESTURE_MIN_SIZE || rect.height < CROP_GESTURE_MIN_SIZE) {
      draftRect = null;
      return { accepted:false, reason:'too-small' };
    }

    return {
      accepted:true,
      owner:gesture.owner,
      rect:immutableRect(rect),
    };
  }

  function cancel(gesture = null) {
    if (gesture && gesture !== activeGesture) return false;
    activeGesture = null;
    draftRect = null;
    return true;
  }

  function reset() {
    activeGesture = null;
    draftRect = null;
  }

  function snapshot() {
    return immutableRect(draftRect);
  }

  function restore(snapshotValue) {
    activeGesture = null;
    draftRect = safeDraftRect(snapshotValue);
    return snapshot();
  }

  function hasDraft() {
    return Boolean(draftRect);
  }

  function draw(ctx, { zoom, width, height } = {}) {
    if (!draftRect) return false;
    const scale = Number(zoom);
    const documentWidth = Number(width);
    const documentHeight = Number(height);
    if (
      !ctx ||
      typeof ctx.save !== 'function' ||
      typeof ctx.restore !== 'function' ||
      typeof ctx.fillRect !== 'function' ||
      typeof ctx.clearRect !== 'function' ||
      typeof ctx.strokeRect !== 'function' ||
      typeof ctx.setLineDash !== 'function' ||
      typeof ctx.beginPath !== 'function' ||
      typeof ctx.moveTo !== 'function' ||
      typeof ctx.lineTo !== 'function' ||
      typeof ctx.stroke !== 'function'
    ) {
      throw new TypeError('crop overlay canvas context is required');
    }
    if (
      !Number.isFinite(scale) ||
      scale <= 0 ||
      !Number.isFinite(documentWidth) ||
      documentWidth < 0 ||
      !Number.isFinite(documentHeight) ||
      documentHeight < 0
    ) {
      throw new TypeError('crop overlay viewport is invalid');
    }

    const rect = draftRect;
    ctx.save();
    try {
      ctx.fillStyle = '#0008';
      ctx.fillRect(0, 0, documentWidth, documentHeight);
      ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / scale;
      ctx.setLineDash([8 / scale, 5 / scale]);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.globalAlpha = .72;
      ctx.setLineDash([4 / scale, 5 / scale]);
      for (const fraction of [1 / 3, 2 / 3]) {
        const x = rect.x + rect.width * fraction;
        const y = rect.y + rect.height * fraction;
        ctx.beginPath();
        ctx.moveTo(x, rect.y);
        ctx.lineTo(x, rect.y + rect.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rect.x, y);
        ctx.lineTo(rect.x + rect.width, y);
        ctx.stroke();
      }
    } finally {
      ctx.restore();
    }
    return true;
  }

  return {
    begin,
    isGesture,
    update,
    finish,
    cancel,
    reset,
    snapshot,
    restore,
    hasDraft,
    draw,
  };
}
