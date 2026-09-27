import { isLayerLocked, isLayerVisible, selectedLayer } from '../core/state.js';

const PATH_CONTROL_HANDLE_NAMES = Object.freeze(['handleIn', 'handleOut']);
const PATH_CONTROL_COLORS = Object.freeze({
  shape: '#8fc0ff',
  'vector-mask': '#ff78cf',
  'document-path': '#77e3b1',
  locked: '#aeb6c4',
  fill: '#f8fbff',
});

export function createPathControlSurfaceController({
  state,
  runtime,
  geometry,
} = {}) {
  for (const name of [
    'getDocument',
    'getDocumentPathEditIndex',
    'setDocumentPathEditIndex',
    'getVectorMaskEditLayerId',
  ]) {
    if (typeof state?.[name] !== 'function') {
      throw new TypeError('path control surface state.' + name + ' bridge is required');
    }
  }
  for (const name of [
    'getCurrentTool',
    'getZoom',
    'hasPenDraft',
    'hasActiveInteraction',
    'setCursor',
  ]) {
    if (typeof runtime?.[name] !== 'function') {
      throw new TypeError('path control surface runtime.' + name + ' bridge is required');
    }
  }
  if (typeof geometry?.layerToDocument !== 'function') {
    throw new TypeError('path control surface geometry.layerToDocument bridge is required');
  }

  function currentZoom() {
    const value = Number(runtime.getZoom());
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function selectedTargets() {
    const owner = state.getDocument();
    if (!owner) return [];

    const documentPathEditIndex = state.getDocumentPathEditIndex();
    if (documentPathEditIndex >= 0) {
      const path = owner.paths?.[documentPathEditIndex];
      if (path?.subpaths?.length) {
        return path.subpaths
          .map((subpath, subpathIndex) => ({
            layer: null,
            points: Array.isArray(subpath?.points) ? subpath.points : [],
            source: 'document-path',
            documentPathIndex: documentPathEditIndex,
            subpathIndex,
            closed: subpath?.closed !== false,
            operation: subpath?.operation || 'add',
          }))
          .filter(target => target.points.length);
      }
      state.setDocumentPathEditIndex(-1);
    }

    const layer = selectedLayer(owner);
    if (!layer || !isLayerVisible(owner, layer)) return [];

    if (
      state.getVectorMaskEditLayerId() === layer.id &&
      layer.vectorMask?.subpaths?.length
    ) {
      return layer.vectorMask.subpaths
        .map((subpath, subpathIndex) => ({
          layer,
          points: Array.isArray(subpath?.points) ? subpath.points : [],
          source: 'vector-mask',
          documentPathIndex: null,
          subpathIndex,
          closed: subpath?.closed !== false,
          operation: subpath?.operation || 'add',
        }))
        .filter(target => target.points.length);
    }

    if (layer.type === 'shape' && layer.shape === 'path' && Array.isArray(layer.pathPoints)) {
      return [{
        layer,
        points: layer.pathPoints,
        source: 'shape',
        documentPathIndex: null,
        subpathIndex: null,
        closed: Boolean(layer.pathClosed),
        operation: 'add',
      }];
    }
    return [];
  }

  function targetPoints(target) {
    const owner = state.getDocument();
    if (!owner || !target) return null;
    if (target.source === 'document-path') {
      return owner.paths?.[target.documentPathIndex]?.subpaths?.[target.subpathIndex]?.points ?? null;
    }
    if (target.source === 'vector-mask') {
      return target.layer?.vectorMask?.subpaths?.[target.subpathIndex]?.points ?? null;
    }
    return target.layer?.pathPoints ?? null;
  }

  function sameTargetIdentity(candidate, target) {
    if (!candidate || candidate.source !== target?.source || candidate.points !== target?.points) {
      return false;
    }
    if (candidate.source === 'document-path') {
      return (
        candidate.documentPathIndex === target.documentPathIndex &&
        candidate.subpathIndex === target.subpathIndex
      );
    }
    if (candidate.layer !== target.layer) return false;
    return candidate.source !== 'vector-mask' || candidate.subpathIndex === target.subpathIndex;
  }

  function resolveTarget(target) {
    const nodeIndex = Number.isInteger(target?.nodeIndex) ? target.nodeIndex : -1;
    if (nodeIndex < 0) return null;
    const current = selectedTargets().find(candidate => sameTargetIdentity(candidate, target)) ?? null;
    const node = current?.points?.[nodeIndex] ?? null;
    return current && node
      ? { ...current, node, nodeIndex, control: target.control }
      : null;
  }

  function documentPoint(target, node, control = 'anchor') {
    const local = control === 'anchor' ? node : node?.[control];
    if (!local) return null;
    return target?.layer
      ? geometry.layerToDocument(local, target.layer)
      : { x: local.x, y: local.y };
  }

  function hit(point, radius = null) {
    const px = Number(point?.x);
    const py = Number(point?.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
    const requestedRadius = radius === null ? 8 / currentZoom() : Number(radius);
    const hitRadius = Number.isFinite(requestedRadius) && requestedRadius >= 0
      ? requestedRadius
      : 8 / currentZoom();
    const owner = state.getDocument();

    for (const target of selectedTargets()) {
      if (target.layer && isLayerLocked(owner, target.layer)) continue;
      for (let nodeIndex = 0; nodeIndex < target.points.length; nodeIndex += 1) {
        const node = target.points[nodeIndex];
        for (const control of PATH_CONTROL_HANDLE_NAMES) {
          const controlPoint = documentPoint(target, node, control);
          if (
            controlPoint &&
            Math.hypot(px - controlPoint.x, py - controlPoint.y) <= hitRadius
          ) {
            return { ...target, nodeIndex, control };
          }
        }
      }
      for (let nodeIndex = 0; nodeIndex < target.points.length; nodeIndex += 1) {
        const node = target.points[nodeIndex];
        const anchor = documentPoint(target, node, 'anchor');
        if (anchor && Math.hypot(px - anchor.x, py - anchor.y) <= hitRadius) {
          return { ...target, nodeIndex, control: 'anchor' };
        }
      }
    }
    return null;
  }

  function trace(context, target) {
    const points = target?.points ?? [];
    if (!points.length) return false;
    const documentNodes = points.map(node => ({
      ...documentPoint(target, node, 'anchor'),
      handleIn: documentPoint(target, node, 'handleIn'),
      handleOut: documentPoint(target, node, 'handleOut'),
    }));
    context.moveTo(documentNodes[0].x, documentNodes[0].y);
    const segment = (from, to) => {
      if (from.handleOut || to.handleIn) {
        const control1 = from.handleOut || from;
        const control2 = to.handleIn || to;
        context.bezierCurveTo(
          control1.x,
          control1.y,
          control2.x,
          control2.y,
          to.x,
          to.y,
        );
      } else {
        context.lineTo(to.x, to.y);
      }
    };
    for (let index = 1; index < documentNodes.length; index += 1) {
      segment(documentNodes[index - 1], documentNodes[index]);
    }
    if (target.closed && documentNodes.length > 1) {
      segment(documentNodes.at(-1), documentNodes[0]);
      context.closePath();
    }
    return true;
  }

  function draw(context) {
    if (runtime.getCurrentTool() !== 'pen' || runtime.hasPenDraft()) return false;
    const targets = selectedTargets();
    if (!targets.length) return false;
    const zoom = currentZoom();

    context.save();
    try {
      context.setLineDash([]);
      context.lineWidth = 1 / zoom;
      context.fillStyle = PATH_CONTROL_COLORS.fill;
      for (const target of targets) {
        const locked = target.layer ? isLayerLocked(state.getDocument(), target.layer) : false;
        const vector = target.source === 'vector-mask';
        const saved = target.source === 'document-path';
        context.strokeStyle = locked
          ? PATH_CONTROL_COLORS.locked
          : PATH_CONTROL_COLORS[target.source] ?? PATH_CONTROL_COLORS.shape;

        if (vector || saved) {
          context.save();
          try {
            context.setLineDash([5 / zoom, 3 / zoom]);
            context.beginPath();
            trace(context, target);
            context.stroke();
          } finally {
            context.restore();
          }
        }

        for (const node of target.points) {
          const anchor = documentPoint(target, node, 'anchor');
          if (!anchor) continue;
          for (const control of PATH_CONTROL_HANDLE_NAMES) {
            const handle = documentPoint(target, node, control);
            if (!handle) continue;
            context.beginPath();
            context.moveTo(anchor.x, anchor.y);
            context.lineTo(handle.x, handle.y);
            context.stroke();
            const size = 5 / zoom;
            context.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
            context.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
          }
          context.beginPath();
          context.arc(anchor.x, anchor.y, 4 / zoom, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        }
      }
    } finally {
      context.restore();
    }
    return true;
  }

  function updateCursor(point) {
    if (
      runtime.getCurrentTool() !== 'pen' ||
      runtime.hasActiveInteraction() ||
      runtime.hasPenDraft()
    ) {
      return null;
    }
    const cursor = hit(point) ? 'pointer' : 'crosshair';
    runtime.setCursor(cursor);
    return cursor;
  }

  return {
    selectedTargets,
    targetPoints,
    resolveTarget,
    hit,
    trace,
    draw,
    updateCursor,
  };
}
