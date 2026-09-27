import { alignLayerToCanvas, frameBounds, layerFrame } from '../core/geometry.js';
import { isLayerLocked } from '../core/state.js';

export const LAYER_TRANSFORM_COMMAND_RESULT = Object.freeze({
  COMMITTED: 'committed',
  NOOP: 'noop',
  INVALID: 'invalid',
  REJECTED: 'rejected',
});

export const LAYER_ALIGNMENT_LABELS = Object.freeze({
  left: 'по левому краю',
  hcenter: 'по центру горизонтально',
  right: 'по правому краю',
  top: 'по верхнему краю',
  vcenter: 'по центру вертикально',
  bottom: 'по нижнему краю',
});

const LAYER_ALIGNMENT_MODES = new Set(Object.keys(LAYER_ALIGNMENT_LABELS));
const LAYER_TRANSFORM_EPSILON = 1e-9;

export function createLayerTransformCommandController({ state, transaction } = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('layer transform command state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('layer transform command transaction bridge is required');
  }

  function activeDocument(owner) {
    return Boolean(owner) && state.getDocument() === owner;
  }

  function exactEditableLayer(owner, layerId) {
    if (!activeDocument(owner) || !layerId) return null;
    const layer = owner.layers?.find(item => item.id === layerId) ?? null;
    if (!layer || layer.type === 'adjustment' || isLayerLocked(owner, layer)) return null;
    return layer;
  }

  function finiteNumber(value) {
    try {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    } catch {
      return null;
    }
  }

  function documentSize(owner) {
    const width = finiteNumber(owner?.width);
    const height = finiteNumber(owner?.height);
    return width !== null && height !== null && width > 0 && height > 0
      ? { width, height }
      : null;
  }

  function sameNumber(left, right) {
    return Math.abs(left - right) <= LAYER_TRANSFORM_EPSILON;
  }

  function publish(label) {
    transaction.commit(label);
    return LAYER_TRANSFORM_COMMAND_RESULT.COMMITTED;
  }

  function nudge(owner, layerId, dx, dy) {
    const layer = exactEditableLayer(owner, layerId);
    if (!layer) return LAYER_TRANSFORM_COMMAND_RESULT.REJECTED;
    const deltaX = finiteNumber(dx);
    const deltaY = finiteNumber(dy);
    if (deltaX === null || deltaY === null) return LAYER_TRANSFORM_COMMAND_RESULT.INVALID;
    if (sameNumber(deltaX, 0) && sameNumber(deltaY, 0)) return LAYER_TRANSFORM_COMMAND_RESULT.NOOP;

    const currentX = finiteNumber(layer.x) ?? 0;
    const currentY = finiteNumber(layer.y) ?? 0;
    layer.x = currentX + deltaX;
    layer.y = currentY + deltaY;
    return publish('Сдвинуть слой');
  }

  function center(owner, layerId) {
    const layer = exactEditableLayer(owner, layerId);
    if (!layer) return LAYER_TRANSFORM_COMMAND_RESULT.REJECTED;
    const size = documentSize(owner);
    if (!size) return LAYER_TRANSFORM_COMMAND_RESULT.INVALID;

    const frame = layerFrame(layer);
    const currentX = finiteNumber(layer.x) ?? 0;
    const currentY = finiteNumber(layer.y) ?? 0;
    const nextX = currentX + size.width / 2 - frame.center.x;
    const nextY = currentY + size.height / 2 - frame.center.y;
    if (sameNumber(currentX, nextX) && sameNumber(currentY, nextY)) {
      return LAYER_TRANSFORM_COMMAND_RESULT.NOOP;
    }

    layer.x = nextX;
    layer.y = nextY;
    return publish('Центрировать слой');
  }

  function align(owner, layerId, mode) {
    const layer = exactEditableLayer(owner, layerId);
    if (!layer) return LAYER_TRANSFORM_COMMAND_RESULT.REJECTED;
    if (!LAYER_ALIGNMENT_MODES.has(mode)) return LAYER_TRANSFORM_COMMAND_RESULT.INVALID;
    const size = documentSize(owner);
    if (!size) return LAYER_TRANSFORM_COMMAND_RESULT.INVALID;

    const next = alignLayerToCanvas(layer, mode, size.width, size.height);
    if (!next.changed) return LAYER_TRANSFORM_COMMAND_RESULT.NOOP;
    layer.x = next.x;
    layer.y = next.y;
    return publish(`Выровнять слой ${LAYER_ALIGNMENT_LABELS[mode]}`);
  }

  function fitToCanvas(owner, layerId) {
    const layer = exactEditableLayer(owner, layerId);
    if (!layer) return LAYER_TRANSFORM_COMMAND_RESULT.REJECTED;
    const size = documentSize(owner);
    if (!size) return LAYER_TRANSFORM_COMMAND_RESULT.INVALID;

    const bounds = frameBounds(layer);
    if (
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) return LAYER_TRANSFORM_COMMAND_RESULT.INVALID;

    const ratio = Math.min(size.width / bounds.width, size.height / bounds.height);
    const currentScaleX = finiteNumber(layer.scaleX ?? 1);
    const currentScaleY = finiteNumber(layer.scaleY ?? 1);
    if (
      !Number.isFinite(ratio) ||
      ratio <= 0 ||
      currentScaleX === null ||
      currentScaleY === null ||
      currentScaleX <= 0 ||
      currentScaleY <= 0
    ) return LAYER_TRANSFORM_COMMAND_RESULT.INVALID;

    const nextScaleX = currentScaleX * ratio;
    const nextScaleY = currentScaleY * ratio;
    const candidate = { ...layer, scaleX: nextScaleX, scaleY: nextScaleY };
    const frame = layerFrame(candidate);
    const currentX = finiteNumber(layer.x) ?? 0;
    const currentY = finiteNumber(layer.y) ?? 0;
    const nextX = currentX + size.width / 2 - frame.center.x;
    const nextY = currentY + size.height / 2 - frame.center.y;

    if (
      sameNumber(currentScaleX, nextScaleX) &&
      sameNumber(currentScaleY, nextScaleY) &&
      sameNumber(currentX, nextX) &&
      sameNumber(currentY, nextY)
    ) return LAYER_TRANSFORM_COMMAND_RESULT.NOOP;

    layer.scaleX = nextScaleX;
    layer.scaleY = nextScaleY;
    layer.x = nextX;
    layer.y = nextY;
    return publish('Вписать слой в холст');
  }

  return { nudge, center, align, fitToCanvas };
}
