export const PEN_DRAFT_BEGIN_RESULT = Object.freeze({
  STARTED: 'started',
  FINISH_REQUESTED: 'finish-requested',
  TOO_SHORT: 'too-short',
  INVALID: 'invalid',
});

export const PEN_DRAFT_GESTURE_RESULT = Object.freeze({
  UPDATED: 'updated',
  NOOP: 'noop',
  FINISHED: 'finished',
  CANCELED: 'canceled',
  REJECTED: 'rejected',
  INVALID: 'invalid',
});

const PEN_DRAFT_STATUS = Object.freeze({
  BEGIN: 'Перо: клик — угловая точка, тяните — гладкая, Alt+drag — независимая ручка',
  TOO_SHORT: 'Перо: для контура нужно минимум 2 точки',
  CORNER: 'Перо: угловая точка',
  SMOOTH: 'Перо: гладкая точка с симметричными ручками',
  INDEPENDENT: 'Перо: угловая точка с независимой ручкой',
});

const PEN_DRAFT_EPSILON = 1e-9;

export function createPenDraftGestureController({ runtime } = {}) {
  if (typeof runtime?.getZoom !== 'function') {
    throw new TypeError('pen draft gesture runtime.getZoom bridge is required');
  }

  const gestureToken = Symbol('pen-draft-handle-gesture');
  let draft = null;

  function finiteNumber(value) {
    try {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    } catch {
      return null;
    }
  }

  function finitePoint(value) {
    const x = finiteNumber(value?.x);
    const y = finiteNumber(value?.y);
    return x === null || y === null ? null : { x, y };
  }

  function currentZoom() {
    const value = finiteNumber(runtime.getZoom());
    return value !== null && value > PEN_DRAFT_EPSILON ? value : 1;
  }

  function hasDraft() {
    return Boolean(draft);
  }

  function snapshot() {
    return draft ? structuredClone(draft) : null;
  }

  function reset() {
    draft = null;
  }

  function updateIdleHover(point) {
    if (!draft) return false;
    const hover = finitePoint(point);
    if (!hover) return false;
    draft.hover = hover;
    return true;
  }

  function isGesture(value) {
    return Boolean(value && value.token === gestureToken && value.kind === 'pen-draft-handle');
  }

  function resolveGesture(gesture) {
    if (!isGesture(gesture) || !gesture.active || draft !== gesture.draftTarget) return null;
    const node = draft?.points?.[gesture.nodeIndex] ?? null;
    if (!node || node !== gesture.nodeTarget) return null;
    return { draft, node };
  }

  function beginPoint(point, { finish = false } = {}) {
    const anchor = finitePoint(point);
    if (!anchor) {
      return { result: PEN_DRAFT_BEGIN_RESULT.INVALID, gesture: null, status: null };
    }
    if (!draft) draft = { points: [], hover: anchor };

    const last = draft.points.at(-1) ?? null;
    const nearLast = Boolean(
      last && Math.hypot(anchor.x - last.x, anchor.y - last.y) <= 4 / currentZoom()
    );
    if (finish && nearLast) {
      return draft.points.length >= 2
        ? { result: PEN_DRAFT_BEGIN_RESULT.FINISH_REQUESTED, gesture: null, status: null }
        : { result: PEN_DRAFT_BEGIN_RESULT.TOO_SHORT, gesture: null, status: PEN_DRAFT_STATUS.TOO_SHORT };
    }

    const node = {
      x: anchor.x,
      y: anchor.y,
      handleIn: null,
      handleOut: null,
      kind: 'corner',
    };
    draft.points.push(node);
    draft.hover = anchor;
    const gesture = {
      token: gestureToken,
      active: true,
      kind: 'pen-draft-handle',
      draftTarget: draft,
      nodeTarget: node,
      nodeIndex: draft.points.length - 1,
      anchor: { ...anchor },
      lastPointer: { ...anchor },
      moved: false,
    };
    return {
      result: PEN_DRAFT_BEGIN_RESULT.STARTED,
      gesture,
      status: PEN_DRAFT_STATUS.BEGIN,
    };
  }

  function update(gesture, point, modifiers = {}) {
    const resolved = resolveGesture(gesture);
    if (!resolved) return PEN_DRAFT_GESTURE_RESULT.REJECTED;
    const pointer = finitePoint(point);
    if (!pointer) return PEN_DRAFT_GESTURE_RESULT.INVALID;

    const dx = pointer.x - gesture.anchor.x;
    const dy = pointer.y - gesture.anchor.y;
    const moved = Math.hypot(dx, dy) > 1 / currentZoom();
    gesture.lastPointer = pointer;
    gesture.moved = moved;
    resolved.draft.hover = pointer;

    if (!moved) {
      resolved.node.handleIn = null;
      resolved.node.handleOut = null;
      resolved.node.kind = 'corner';
      return PEN_DRAFT_GESTURE_RESULT.NOOP;
    }

    resolved.node.handleOut = { ...pointer };
    if (modifiers.altKey) {
      resolved.node.handleIn = null;
      resolved.node.kind = 'corner';
    } else {
      resolved.node.handleIn = {
        x: gesture.anchor.x - dx,
        y: gesture.anchor.y - dy,
      };
      resolved.node.kind = 'smooth';
    }
    return PEN_DRAFT_GESTURE_RESULT.UPDATED;
  }

  function finish(gesture, point, modifiers = {}) {
    if (!isGesture(gesture) || !gesture.active) {
      return { result: PEN_DRAFT_GESTURE_RESULT.REJECTED, status: null };
    }
    const updateResult = update(gesture, point, modifiers);
    if (
      updateResult === PEN_DRAFT_GESTURE_RESULT.REJECTED ||
      updateResult === PEN_DRAFT_GESTURE_RESULT.INVALID
    ) {
      gesture.active = false;
      return { result: updateResult, status: null };
    }

    const resolved = resolveGesture(gesture);
    if (!resolved) {
      gesture.active = false;
      return { result: PEN_DRAFT_GESTURE_RESULT.REJECTED, status: null };
    }
    const status = gesture.moved
      ? (resolved.node.kind === 'smooth' ? PEN_DRAFT_STATUS.SMOOTH : PEN_DRAFT_STATUS.INDEPENDENT)
      : PEN_DRAFT_STATUS.CORNER;
    gesture.active = false;
    return { result: PEN_DRAFT_GESTURE_RESULT.FINISHED, status };
  }

  function cancelPoint(gesture) {
    const resolved = resolveGesture(gesture);
    if (!resolved) return PEN_DRAFT_GESTURE_RESULT.REJECTED;
    gesture.active = false;
    resolved.draft.points.splice(gesture.nodeIndex, 1);
    if (!resolved.draft.points.length) draft = null;
    return PEN_DRAFT_GESTURE_RESULT.CANCELED;
  }

  function cancelDraft() {
    if (!draft) return false;
    draft = null;
    return true;
  }

  function consumePoints() {
    const points = draft?.points ? structuredClone(draft.points) : [];
    draft = null;
    return points;
  }

  return {
    hasDraft,
    snapshot,
    reset,
    updateIdleHover,
    isGesture,
    beginPoint,
    update,
    finish,
    cancelPoint,
    cancelDraft,
    consumePoints,
  };
}
