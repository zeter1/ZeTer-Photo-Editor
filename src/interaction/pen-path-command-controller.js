import { addLayer, createShapeLayer } from '../core/state.js';

export const PEN_PATH_COMMAND_RESULT = Object.freeze({
  COMMITTED: 'committed',
  NOOP: 'noop',
  REJECTED: 'rejected',
});

export const PEN_PATH_NOOP_REASON = Object.freeze({
  TOO_SHORT: 'too-short',
  INVALID_POINT: 'invalid-point',
  DEGENERATE: 'degenerate',
});

function commandResult(result, reason = null, layer = null) {
  const outcome = { result };
  if (reason) outcome.reason = reason;
  if (layer) outcome.layer = layer;
  return outcome;
}

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

function normalizeNode(value) {
  const anchor = finitePoint(value);
  if (!anchor) return null;
  const handleIn = value?.handleIn == null ? null : finitePoint(value.handleIn);
  const handleOut = value?.handleOut == null ? null : finitePoint(value.handleOut);
  if ((value?.handleIn != null && !handleIn) || (value?.handleOut != null && !handleOut)) return null;
  return {
    ...anchor,
    handleIn,
    handleOut,
    kind: value?.kind === 'smooth' ? 'smooth' : 'corner',
  };
}

function penPathBounds(points) {
  const coordinates = [];
  for (const point of points) {
    coordinates.push(point);
    if (point.handleIn) coordinates.push(point.handleIn);
    if (point.handleOut) coordinates.push(point.handleOut);
  }
  if (!coordinates.length) return null;
  const xs = coordinates.map(point => point.x);
  const ys = coordinates.map(point => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { x, y, width:right - x, height:bottom - y };
}

function localizeNode(point, bounds) {
  const localize = position => position
    ? { x:position.x - bounds.x, y:position.y - bounds.y }
    : null;
  return {
    x: point.x - bounds.x,
    y: point.y - bounds.y,
    handleIn: localize(point.handleIn),
    handleOut: localize(point.handleOut),
    kind: point.kind,
  };
}

export function createPenPathCommandController({ state, transaction } = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('pen path command state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('pen path command transaction bridge is required');
  }

  function activeOwner(owner) {
    return Boolean(owner) && state.getDocument() === owner;
  }

  function publish(owner, points, options = {}) {
    if (!activeOwner(owner)) return commandResult(PEN_PATH_COMMAND_RESULT.REJECTED);
    if (!Array.isArray(points) || points.length < 2) {
      return commandResult(PEN_PATH_COMMAND_RESULT.NOOP, PEN_PATH_NOOP_REASON.TOO_SHORT);
    }
    const normalizedPoints = points.map(normalizeNode);
    if (normalizedPoints.some(point => !point)) {
      return commandResult(PEN_PATH_COMMAND_RESULT.NOOP, PEN_PATH_NOOP_REASON.INVALID_POINT);
    }
    const bounds = penPathBounds(normalizedPoints);
    if (!bounds || Math.max(bounds.width, bounds.height) < 1) {
      return commandResult(PEN_PATH_COMMAND_RESULT.NOOP, PEN_PATH_NOOP_REASON.DEGENERATE);
    }
    const layer = createShapeLayer({
      name:'Контур',
      shape:'path',
      x:bounds.x,
      y:bounds.y,
      width:Math.max(1, bounds.width),
      height:Math.max(1, bounds.height),
      pathPoints:normalizedPoints.map(point => localizeNode(point, bounds)),
      pathClosed:Boolean(options.pathClosed),
      fill:'transparent',
      stroke:options.stroke,
      strokeWidth:Math.max(1, Number(options.strokeWidth) || 1),
      opacity:Number(options.opacity),
    });
    if (!activeOwner(owner)) return commandResult(PEN_PATH_COMMAND_RESULT.REJECTED);
    addLayer(owner, layer);
    transaction.commit('Добавить Bézier-контур');
    return commandResult(PEN_PATH_COMMAND_RESULT.COMMITTED, null, layer);
  }

  return { publish };
}
