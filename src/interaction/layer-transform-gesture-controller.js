import { preserveRelativeLayerTransform, resizeLayerFromPoint, rotationFromDrag, snapLayerMove } from '../core/geometry.js';
import { isLayerLocked } from '../core/state.js';

export const LAYER_TRANSFORM_GESTURE_RESULT = Object.freeze({
  UPDATED: 'updated',
  COMMITTED: 'committed',
  NOOP: 'noop',
  CANCELED: 'canceled',
  INVALID: 'invalid',
  REJECTED: 'rejected',
});

const LAYER_TRANSFORM_GESTURE_EPSILON = 1e-9;
const LAYER_TRANSFORM_GESTURE_LABELS = Object.freeze({
  move: 'Перемещение слоя',
  resize: 'Изменить размер слоя',
  rotate: 'Повернуть слой',
});
const LAYER_TRANSFORM_GESTURE_KINDS = new Set(Object.keys(LAYER_TRANSFORM_GESTURE_LABELS));

export function createLayerTransformGestureController({
  state,
  transaction,
  runtime,
  geometry = { resizeLayerFromPoint, rotationFromDrag, snapLayerMove },
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('layer transform gesture state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('layer transform gesture transaction bridge is required');
  }
  for (const name of [
    'getZoom',
    'isSmartSnapEnabled',
    'visibleSnapTargetRects',
    'setSmartGuides',
    'clearSmartGuides',
    'refreshLayerPreview',
    'redrawOverlay',
  ]) {
    if (typeof runtime?.[name] !== 'function') {
      throw new TypeError('layer transform gesture runtime.' + name + ' bridge is required');
    }
  }
  for (const name of ['resizeLayerFromPoint', 'rotationFromDrag', 'snapLayerMove']) {
    if (typeof geometry?.[name] !== 'function') {
      throw new TypeError('layer transform gesture geometry.' + name + ' bridge is required');
    }
  }

  const gestureToken = Symbol('layer-transform-gesture');

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

  function sameNumber(left, right) {
    return Math.abs(Number(left) - Number(right)) <= LAYER_TRANSFORM_GESTURE_EPSILON;
  }

  function exactEditableLayer(owner, layerId, target) {
    if (!owner || state.getDocument() !== owner || !layerId || !Array.isArray(owner.layers)) return null;
    const layer = owner.layers.find(item => item.id === layerId) ?? null;
    if (!layer || layer !== target || layer.type === 'adjustment' || isLayerLocked(owner, layer)) return null;
    return layer;
  }

  function captureLayer(owner, layerId) {
    if (!owner || state.getDocument() !== owner || !layerId || !Array.isArray(owner.layers)) return null;
    const layer = owner.layers.find(item => item.id === layerId) ?? null;
    if (!layer || layer.type === 'adjustment' || isLayerLocked(owner, layer)) return null;
    return layer;
  }

  function numericBaseline(layer) {
    return {
      x: finiteNumber(layer.x) ?? 0,
      y: finiteNumber(layer.y) ?? 0,
      width: finiteNumber(layer.width) ?? 1,
      height: finiteNumber(layer.height) ?? 1,
      scaleX: finiteNumber(layer.scaleX) ?? 1,
      scaleY: finiteNumber(layer.scaleY) ?? 1,
      rotation: finiteNumber(layer.rotation) ?? 0,
    };
  }

  function baseGesture(kind, owner, layer, start) {
    return {
      token: gestureToken,
      active: true,
      kind,
      owner,
      layerId: layer.id,
      target: layer,
      start,
      lastPointer: start,
      baseline: numericBaseline(layer),
      maskTarget:layer.mask?.linked === false ? layer.mask : null,
      maskTransform:layer.mask?.linked === false && layer.mask.transform ? { ...layer.mask.transform } : null,
      moved: false,
    };
  }

  function isGesture(value) {
    return Boolean(
      value &&
      value.token === gestureToken &&
      LAYER_TRANSFORM_GESTURE_KINDS.has(value.kind)
    );
  }

  function beginMove(owner, layerId, point) {
    const start = finitePoint(point);
    const layer = start && captureLayer(owner, layerId);
    return layer ? baseGesture('move', owner, layer, start) : null;
  }

  function beginResize(owner, layerId, handle, point) {
    const start = finitePoint(point);
    const layer = start && typeof handle === 'string' && handle
      ? captureLayer(owner, layerId)
      : null;
    if (!layer) return null;
    return { ...baseGesture('resize', owner, layer, start), handle };
  }

  function beginRotate(owner, layerId, point, centerPoint) {
    const start = finitePoint(point);
    const center = finitePoint(centerPoint);
    const layer = start && center ? captureLayer(owner, layerId) : null;
    if (!layer) return null;
    return { ...baseGesture('rotate', owner, layer, start), center };
  }

  function moveChanged(gesture, layer) {
    return !sameNumber(layer.x, gesture.baseline.x) || !sameNumber(layer.y, gesture.baseline.y);
  }

  function resizeChanged(gesture, layer) {
    return !sameNumber(layer.x, gesture.baseline.x) ||
      !sameNumber(layer.y, gesture.baseline.y) ||
      !sameNumber(layer.scaleX, gesture.baseline.scaleX) ||
      !sameNumber(layer.scaleY, gesture.baseline.scaleY);
  }

  function rotateChanged(gesture, layer) {
    return !sameNumber(layer.rotation, gesture.baseline.rotation);
  }

  function hasSemanticChange(gesture, layer) {
    if (gesture.kind === 'move') return moveChanged(gesture, layer);
    if (gesture.kind === 'resize') return resizeChanged(gesture, layer);
    if (gesture.kind === 'rotate') return rotateChanged(gesture, layer);
    return false;
  }

  function preserveUnlinkedMask(gesture, layer) {
    const mask = gesture.maskTarget;
    if (!mask || layer?.mask !== mask || mask.linked !== false) return;
    mask.transform = preserveRelativeLayerTransform(
      { ...layer, ...gesture.baseline },
      layer,
      gesture.maskTransform,
    );
  }

  function applyMove(gesture, layer, point, modifiers) {
    let dx = point.x - gesture.start.x;
    let dy = point.y - gesture.start.y;
    let lockedAxis = null;
    if (modifiers.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        dy = 0;
        lockedAxis = 'y';
      } else {
        dx = 0;
        lockedAxis = 'x';
      }
    }

    let nextX = gesture.baseline.x + dx;
    let nextY = gesture.baseline.y + dy;
    if (runtime.isSmartSnapEnabled() && !modifiers.ctrlKey && !modifiers.metaKey) {
      const zoom = Math.max(1e-9, finiteNumber(runtime.getZoom()) ?? 1);
      const snapped = geometry.snapLayerMove(layer, nextX, nextY, {
        docWidth: gesture.owner.width,
        docHeight: gesture.owner.height,
        targetRects: runtime.visibleSnapTargetRects(gesture.owner, gesture.layerId),
        threshold: 8 / zoom,
      });
      const snappedX = finiteNumber(snapped?.x);
      const snappedY = finiteNumber(snapped?.y);
      if (snappedX === null || snappedY === null) return LAYER_TRANSFORM_GESTURE_RESULT.INVALID;
      nextX = lockedAxis === 'x' ? gesture.baseline.x : snappedX;
      nextY = lockedAxis === 'y' ? gesture.baseline.y : snappedY;
      runtime.setSmartGuides({
        x: lockedAxis === 'x' ? null : (snapped?.guides?.x ?? null),
        y: lockedAxis === 'y' ? null : (snapped?.guides?.y ?? null),
      });
    } else {
      runtime.clearSmartGuides();
    }

    if (!sameNumber(layer.x, nextX)) layer.x = nextX;
    if (!sameNumber(layer.y, nextY)) layer.y = nextY;
    preserveUnlinkedMask(gesture, layer);
    gesture.moved = moveChanged(gesture, layer);
    runtime.refreshLayerPreview(layer);
    return gesture.moved ? LAYER_TRANSFORM_GESTURE_RESULT.UPDATED : LAYER_TRANSFORM_GESTURE_RESULT.NOOP;
  }

  function applyResize(gesture, layer, point, modifiers) {
    const zoom = Math.max(1e-9, finiteNumber(runtime.getZoom()) ?? 1);
    const next = geometry.resizeLayerFromPoint(
      { ...layer, ...gesture.baseline },
      gesture.handle,
      point,
      {
        minSize: Math.max(2, 6 / zoom),
        lockAspect: Boolean(modifiers.shiftKey),
        fromCenter: Boolean(modifiers.altKey),
      },
    );
    const x = finiteNumber(next?.x);
    const y = finiteNumber(next?.y);
    const scaleX = finiteNumber(next?.scaleX);
    const scaleY = finiteNumber(next?.scaleY);
    if (x === null || y === null || scaleX === null || scaleY === null) {
      return LAYER_TRANSFORM_GESTURE_RESULT.INVALID;
    }

    if (!sameNumber(layer.x, x)) layer.x = x;
    if (!sameNumber(layer.y, y)) layer.y = y;
    if (!sameNumber(layer.scaleX, scaleX)) layer.scaleX = scaleX;
    if (!sameNumber(layer.scaleY, scaleY)) layer.scaleY = scaleY;
    preserveUnlinkedMask(gesture, layer);
    gesture.moved = resizeChanged(gesture, layer);
    runtime.refreshLayerPreview(layer);
    return gesture.moved ? LAYER_TRANSFORM_GESTURE_RESULT.UPDATED : LAYER_TRANSFORM_GESTURE_RESULT.NOOP;
  }

  function applyRotate(gesture, layer, point, modifiers) {
    const rotation = finiteNumber(geometry.rotationFromDrag(
      gesture.baseline.rotation,
      gesture.center,
      gesture.start,
      point,
      modifiers.shiftKey ? 15 : 0,
    ));
    if (rotation === null) return LAYER_TRANSFORM_GESTURE_RESULT.INVALID;
    if (!sameNumber(layer.rotation, rotation)) layer.rotation = rotation;
    preserveUnlinkedMask(gesture, layer);
    gesture.moved = rotateChanged(gesture, layer);
    runtime.refreshLayerPreview(layer);
    return gesture.moved ? LAYER_TRANSFORM_GESTURE_RESULT.UPDATED : LAYER_TRANSFORM_GESTURE_RESULT.NOOP;
  }

  function update(gesture, point, modifiers = {}) {
    if (!isGesture(gesture) || !gesture.active) return LAYER_TRANSFORM_GESTURE_RESULT.REJECTED;
    const currentPoint = finitePoint(point);
    if (!currentPoint) return LAYER_TRANSFORM_GESTURE_RESULT.INVALID;
    const layer = exactEditableLayer(gesture.owner, gesture.layerId, gesture.target);
    if (!layer) return LAYER_TRANSFORM_GESTURE_RESULT.REJECTED;
    gesture.lastPointer = currentPoint;

    if (gesture.kind === 'move') return applyMove(gesture, layer, currentPoint, modifiers);
    if (gesture.kind === 'resize') return applyResize(gesture, layer, currentPoint, modifiers);
    if (gesture.kind === 'rotate') return applyRotate(gesture, layer, currentPoint, modifiers);
    return LAYER_TRANSFORM_GESTURE_RESULT.INVALID;
  }

  function finish(gesture, point, modifiers = {}) {
    if (!isGesture(gesture) || !gesture.active) return LAYER_TRANSFORM_GESTURE_RESULT.REJECTED;
    const finalPoint = finitePoint(point);
    if (!finalPoint) {
      gesture.active = false;
      runtime.clearSmartGuides();
      return LAYER_TRANSFORM_GESTURE_RESULT.INVALID;
    }

    if (Math.hypot(finalPoint.x - gesture.lastPointer.x, finalPoint.y - gesture.lastPointer.y) > 0.01) {
      const updateResult = update(gesture, finalPoint, modifiers);
      if (
        updateResult === LAYER_TRANSFORM_GESTURE_RESULT.REJECTED ||
        updateResult === LAYER_TRANSFORM_GESTURE_RESULT.INVALID
      ) {
        gesture.active = false;
        runtime.clearSmartGuides();
        return updateResult;
      }
    }

    gesture.active = false;
    runtime.clearSmartGuides();
    const layer = exactEditableLayer(gesture.owner, gesture.layerId, gesture.target);
    if (!layer) return LAYER_TRANSFORM_GESTURE_RESULT.REJECTED;
    gesture.moved = hasSemanticChange(gesture, layer);
    runtime.redrawOverlay();
    if (!gesture.moved) return LAYER_TRANSFORM_GESTURE_RESULT.NOOP;
    transaction.commit(LAYER_TRANSFORM_GESTURE_LABELS[gesture.kind]);
    return LAYER_TRANSFORM_GESTURE_RESULT.COMMITTED;
  }

  function restoreBaseline(gesture, layer) {
    if (gesture.kind === 'move') {
      layer.x = gesture.baseline.x;
      layer.y = gesture.baseline.y;
    } else if (gesture.kind === 'resize') {
      layer.x = gesture.baseline.x;
      layer.y = gesture.baseline.y;
      layer.width = gesture.baseline.width;
      layer.height = gesture.baseline.height;
      layer.scaleX = gesture.baseline.scaleX;
      layer.scaleY = gesture.baseline.scaleY;
      layer.rotation = gesture.baseline.rotation;
    } else if (gesture.kind === 'rotate') {
      layer.rotation = gesture.baseline.rotation;
    }
  }

  function cancel(gesture, { refresh = true } = {}) {
    if (!isGesture(gesture) || !gesture.active) return LAYER_TRANSFORM_GESTURE_RESULT.REJECTED;
    gesture.active = false;
    runtime.clearSmartGuides();
    const layer = exactEditableLayer(gesture.owner, gesture.layerId, gesture.target);
    if (!layer) return LAYER_TRANSFORM_GESTURE_RESULT.REJECTED;
    const changed = hasSemanticChange(gesture, layer);
    if (changed) restoreBaseline(gesture, layer);
    if (gesture.maskTarget && layer.mask === gesture.maskTarget && gesture.maskTarget.linked === false) {
      gesture.maskTarget.transform = gesture.maskTransform ? { ...gesture.maskTransform } : null;
    }
    gesture.moved = false;
    if (refresh) {
      if (changed) runtime.refreshLayerPreview(layer);
      else runtime.redrawOverlay();
    }
    return LAYER_TRANSFORM_GESTURE_RESULT.CANCELED;
  }

  return {
    isGesture,
    beginMove,
    beginResize,
    beginRotate,
    update,
    finish,
    cancel,
  };
}
