import { isLayerLocked } from '../core/state.js';

export const PATH_CONTROL_GESTURE_RESULT = Object.freeze({
  UPDATED: 'updated',
  COMMITTED: 'committed',
  NOOP: 'noop',
  CANCELED: 'canceled',
  INVALID: 'invalid',
  REJECTED: 'rejected',
});

const PATH_CONTROL_GESTURE_EPSILON = 1e-9;
const PATH_CONTROL_GESTURE_SOURCES = new Set(['shape', 'vector-mask', 'document-path']);
const PATH_CONTROL_GESTURE_CONTROLS = new Set(['anchor', 'handleIn', 'handleOut']);
const PATH_CONTROL_GESTURE_LABELS = Object.freeze({
  shape: Object.freeze({
    anchor: 'Переместить Bézier-узел',
    handle: 'Изменить Bézier-ручку',
  }),
  'vector-mask': Object.freeze({
    anchor: 'Переместить узел векторной маски',
    handle: 'Изменить ручку векторной маски',
  }),
  'document-path': Object.freeze({
    anchor: 'Переместить узел сохранённого контура',
    handle: 'Изменить ручку сохранённого контура',
  }),
});

export function createPathControlGestureController({
  state,
  transaction,
  runtime,
  geometry,
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('path control gesture state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('path control gesture transaction bridge is required');
  }
  for (const name of ['getZoom', 'refreshPreview', 'redrawOverlay']) {
    if (typeof runtime?.[name] !== 'function') {
      throw new TypeError('path control gesture runtime.' + name + ' bridge is required');
    }
  }
  if (typeof geometry?.documentPointToLayer !== 'function') {
    throw new TypeError('path control gesture geometry.documentPointToLayer bridge is required');
  }

  const gestureToken = Symbol('path-control-gesture');

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
    const a = finiteNumber(left);
    const b = finiteNumber(right);
    return a !== null && b !== null && Math.abs(a - b) <= PATH_CONTROL_GESTURE_EPSILON;
  }

  function sameOptionalHandle(left, right) {
    if (!left && !right) return true;
    if (!left || !right) return false;
    return sameNumber(left.x, right.x) && sameNumber(left.y, right.y);
  }

  function sameNodeGeometry(node, baseline) {
    return Boolean(
      node &&
      baseline &&
      sameNumber(node.x, baseline.x) &&
      sameNumber(node.y, baseline.y) &&
      sameOptionalHandle(node.handleIn, baseline.handleIn) &&
      sameOptionalHandle(node.handleOut, baseline.handleOut) &&
      (node.kind === 'smooth' ? 'smooth' : 'corner') ===
        (baseline.kind === 'smooth' ? 'smooth' : 'corner')
    );
  }

  function restoreNode(node, baseline) {
    const restored = structuredClone(baseline);
    for (const key of Object.keys(node)) {
      if (!Object.prototype.hasOwnProperty.call(restored, key)) delete node[key];
    }
    Object.assign(node, restored);
  }

  function cloneHandle(handle) {
    return handle ? { x: handle.x, y: handle.y } : null;
  }

  function activeOwner(owner) {
    return Boolean(owner && state.getDocument() === owner);
  }

  function captureLayerTarget(owner, target) {
    const layerId = target?.layer?.id ?? null;
    if (!layerId || !Array.isArray(owner.layers)) return null;
    const layer = owner.layers.find(item => item.id === layerId) ?? null;
    if (!layer || layer !== target.layer || isLayerLocked(owner, layer)) return null;

    if (target.source === 'shape') {
      if (layer.type !== 'shape' || layer.shape !== 'path' || !Array.isArray(layer.pathPoints)) return null;
      return {
        layer,
        layerId,
        vectorMask: null,
        subpath: null,
        points: layer.pathPoints,
      };
    }

    const subpathIndex = Number.isInteger(target.subpathIndex) ? target.subpathIndex : -1;
    const vectorMask = layer.vectorMask;
    const subpath = vectorMask?.subpaths?.[subpathIndex] ?? null;
    if (!vectorMask || !subpath || !Array.isArray(subpath.points)) return null;
    return {
      layer,
      layerId,
      vectorMask,
      subpath,
      points: subpath.points,
    };
  }

  function captureDocumentPathTarget(owner, target) {
    const pathIndex = Number.isInteger(target?.documentPathIndex) ? target.documentPathIndex : -1;
    const subpathIndex = Number.isInteger(target?.subpathIndex) ? target.subpathIndex : -1;
    const path = owner.paths?.[pathIndex] ?? null;
    const subpath = path?.subpaths?.[subpathIndex] ?? null;
    if (!path || !subpath || !Array.isArray(subpath.points)) return null;
    return {
      path,
      pathId: Number.isInteger(path.id) ? path.id : null,
      subpath,
      points: subpath.points,
    };
  }

  function captureTarget(owner, target) {
    if (!activeOwner(owner) || !PATH_CONTROL_GESTURE_SOURCES.has(target?.source)) return null;
    if (!PATH_CONTROL_GESTURE_CONTROLS.has(target?.control)) return null;
    const nodeIndex = Number.isInteger(target.nodeIndex) ? target.nodeIndex : -1;

    if (target.source === 'document-path') {
      const captured = captureDocumentPathTarget(owner, target);
      const node = captured?.points?.[nodeIndex] ?? null;
      return captured && node ? { ...captured, node, nodeIndex, layer:null, layerId:null, vectorMask:null } : null;
    }

    const captured = captureLayerTarget(owner, target);
    const node = captured?.points?.[nodeIndex] ?? null;
    return captured && node
      ? { ...captured, node, nodeIndex, path:null, pathId:null }
      : null;
  }

  function resolveSavedPath(gesture) {
    if (!Array.isArray(gesture.owner.paths)) return null;
    if (gesture.pathId !== null) {
      const path = gesture.owner.paths.find(item => item?.id === gesture.pathId) ?? null;
      return path === gesture.pathTarget ? path : null;
    }
    return gesture.owner.paths.find(item => item === gesture.pathTarget) ?? null;
  }

  function resolveExactTarget(gesture) {
    if (!activeOwner(gesture.owner)) return null;

    if (gesture.source === 'document-path') {
      const path = resolveSavedPath(gesture);
      if (!path || !Array.isArray(path.subpaths) || !path.subpaths.includes(gesture.subpathTarget)) return null;
      const points = gesture.subpathTarget.points;
      if (points !== gesture.pointsTarget || !Array.isArray(points)) return null;
      const nodeIndex = points.indexOf(gesture.nodeTarget);
      if (nodeIndex < 0) return null;
      return { layer:null, path, subpath:gesture.subpathTarget, points, node:gesture.nodeTarget, nodeIndex };
    }

    if (!Array.isArray(gesture.owner.layers)) return null;
    const layer = gesture.owner.layers.find(item => item.id === gesture.layerId) ?? null;
    if (!layer || layer !== gesture.layerTarget || isLayerLocked(gesture.owner, layer)) return null;

    let points = null;
    let subpath = null;
    if (gesture.source === 'shape') {
      if (layer.type !== 'shape' || layer.shape !== 'path' || layer.pathPoints !== gesture.pointsTarget) return null;
      points = layer.pathPoints;
    } else {
      if (layer.vectorMask !== gesture.vectorMaskTarget) return null;
      if (!Array.isArray(layer.vectorMask?.subpaths) || !layer.vectorMask.subpaths.includes(gesture.subpathTarget)) return null;
      subpath = gesture.subpathTarget;
      points = subpath.points;
      if (points !== gesture.pointsTarget) return null;
    }

    if (!Array.isArray(points)) return null;
    const nodeIndex = points.indexOf(gesture.nodeTarget);
    if (nodeIndex < 0) return null;
    return { layer, path:null, subpath, points, node:gesture.nodeTarget, nodeIndex };
  }

  function isGesture(value) {
    return Boolean(value && value.token === gestureToken && value.kind === 'path-control');
  }

  function begin(owner, target, point, modifiers = {}) {
    const startDocument = finitePoint(point);
    if (!startDocument) return null;
    const captured = captureTarget(owner, target);
    if (!captured) return null;

    const startLocal = captured.layer
      ? finitePoint(geometry.documentPointToLayer(startDocument, captured.layer))
      : startDocument;
    if (!startLocal) return null;

    const control = target.control === 'anchor' && modifiers.shiftKey ? 'handleOut' : target.control;
    return {
      token: gestureToken,
      active: true,
      kind: 'path-control',
      owner,
      source: target.source,
      control,
      layerId: captured.layerId,
      layerTarget: captured.layer,
      vectorMaskTarget: captured.vectorMask,
      pathId: captured.pathId,
      pathTarget: captured.path,
      subpathTarget: captured.subpath,
      pointsTarget: captured.points,
      nodeTarget: captured.node,
      nodeIndex: captured.nodeIndex,
      startLocal,
      lastPointer: startDocument,
      baseline: structuredClone(captured.node),
      moved: false,
    };
  }

  function applyAnchor(gesture, node, local) {
    const dx = local.x - gesture.startLocal.x;
    const dy = local.y - gesture.startLocal.y;
    node.x = gesture.baseline.x + dx;
    node.y = gesture.baseline.y + dy;
    node.handleIn = gesture.baseline.handleIn
      ? { x: gesture.baseline.handleIn.x + dx, y: gesture.baseline.handleIn.y + dy }
      : null;
    node.handleOut = gesture.baseline.handleOut
      ? { x: gesture.baseline.handleOut.x + dx, y: gesture.baseline.handleOut.y + dy }
      : null;
    node.kind = gesture.baseline.kind === 'smooth' ? 'smooth' : 'corner';
  }

  function applyHandle(gesture, node, local, modifiers) {
    node[gesture.control] = { x: local.x, y: local.y };
    const opposite = gesture.control === 'handleIn' ? 'handleOut' : 'handleIn';
    if (modifiers.altKey) {
      node.kind = 'corner';
      node[opposite] = cloneHandle(gesture.baseline[opposite]);
      return;
    }
    node.kind = 'smooth';
    node[opposite] = {
      x: node.x - (local.x - node.x),
      y: node.y - (local.y - node.y),
    };
  }

  function update(gesture, point, modifiers = {}) {
    if (!isGesture(gesture) || !gesture.active) return PATH_CONTROL_GESTURE_RESULT.REJECTED;
    const documentPoint = finitePoint(point);
    if (!documentPoint) return PATH_CONTROL_GESTURE_RESULT.INVALID;
    const resolved = resolveExactTarget(gesture);
    if (!resolved) return PATH_CONTROL_GESTURE_RESULT.REJECTED;

    const local = resolved.layer
      ? finitePoint(geometry.documentPointToLayer(documentPoint, resolved.layer))
      : documentPoint;
    if (!local) return PATH_CONTROL_GESTURE_RESULT.INVALID;
    gesture.lastPointer = documentPoint;

    const zoom = Math.max(PATH_CONTROL_GESTURE_EPSILON, finiteNumber(runtime.getZoom()) ?? 1);
    const distance = Math.hypot(local.x - gesture.startLocal.x, local.y - gesture.startLocal.y);
    if (distance <= 1 / zoom) {
      const changed = !sameNodeGeometry(resolved.node, gesture.baseline);
      if (changed) {
        restoreNode(resolved.node, gesture.baseline);
        runtime.refreshPreview(resolved);
      } else {
        runtime.redrawOverlay();
      }
      gesture.moved = false;
      return PATH_CONTROL_GESTURE_RESULT.NOOP;
    }

    if (gesture.control === 'anchor') applyAnchor(gesture, resolved.node, local);
    else applyHandle(gesture, resolved.node, local, modifiers);

    gesture.moved = !sameNodeGeometry(resolved.node, gesture.baseline);
    if (gesture.moved) runtime.refreshPreview(resolved);
    else runtime.redrawOverlay();
    return gesture.moved ? PATH_CONTROL_GESTURE_RESULT.UPDATED : PATH_CONTROL_GESTURE_RESULT.NOOP;
  }

  function historyLabel(gesture) {
    const labels = PATH_CONTROL_GESTURE_LABELS[gesture.source];
    return gesture.control === 'anchor' ? labels.anchor : labels.handle;
  }

  function finish(gesture, point, modifiers = {}) {
    if (!isGesture(gesture) || !gesture.active) return PATH_CONTROL_GESTURE_RESULT.REJECTED;
    const finalPoint = finitePoint(point);
    if (!finalPoint) {
      gesture.active = false;
      return PATH_CONTROL_GESTURE_RESULT.INVALID;
    }

    if (Math.hypot(finalPoint.x - gesture.lastPointer.x, finalPoint.y - gesture.lastPointer.y) > PATH_CONTROL_GESTURE_EPSILON) {
      const updateResult = update(gesture, finalPoint, modifiers);
      if (
        updateResult === PATH_CONTROL_GESTURE_RESULT.REJECTED ||
        updateResult === PATH_CONTROL_GESTURE_RESULT.INVALID
      ) {
        gesture.active = false;
        return updateResult;
      }
    }

    const resolved = resolveExactTarget(gesture);
    gesture.active = false;
    if (!resolved) return PATH_CONTROL_GESTURE_RESULT.REJECTED;
    gesture.moved = !sameNodeGeometry(resolved.node, gesture.baseline);
    if (!gesture.moved) {
      runtime.redrawOverlay();
      return PATH_CONTROL_GESTURE_RESULT.NOOP;
    }

    transaction.commit(historyLabel(gesture));
    return PATH_CONTROL_GESTURE_RESULT.COMMITTED;
  }

  function cancel(gesture) {
    if (!isGesture(gesture) || !gesture.active) return PATH_CONTROL_GESTURE_RESULT.REJECTED;
    const resolved = resolveExactTarget(gesture);
    gesture.active = false;
    if (!resolved) return PATH_CONTROL_GESTURE_RESULT.REJECTED;

    const changed = !sameNodeGeometry(resolved.node, gesture.baseline);
    if (changed) {
      restoreNode(resolved.node, gesture.baseline);
      runtime.refreshPreview(resolved);
    } else {
      runtime.redrawOverlay();
    }
    gesture.moved = false;
    return PATH_CONTROL_GESTURE_RESULT.CANCELED;
  }

  return {
    isGesture,
    begin,
    update,
    finish,
    cancel,
  };
}
