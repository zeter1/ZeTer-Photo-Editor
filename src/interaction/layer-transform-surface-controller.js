import {
  clamp,
  frameBounds,
  hitLayerHandle,
  layerFrame,
  pointInLayer,
  rotationHandlePoint,
} from '../core/geometry.js';
import { isLayerLocked, isLayerVisible, selectedLayer } from '../core/state.js';

const LAYER_TRANSFORM_SURFACE_COLORS = Object.freeze({
  locked: '#aeb6c4',
  move: '#69a0ff',
  selected: '#5ee7ff',
  controlFill: '#f8fbff',
  controlStroke: '#3976ea',
});
const LAYER_TRANSFORM_RESIZE_CURSORS = Object.freeze([
  'ew-resize',
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
]);
const LAYER_TRANSFORM_HANDLE_ANGLES = Object.freeze({
  e: 0,
  se: 45,
  s: 90,
  sw: 135,
  w: 180,
  nw: 225,
  n: 270,
  ne: 315,
});

export function createLayerTransformSurfaceController({
  state,
  runtime,
  geometry = {
    clamp,
    frameBounds,
    hitLayerHandle,
    layerFrame,
    pointInLayer,
    rotationHandlePoint,
  },
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('layer transform surface state.getDocument bridge is required');
  }
  for (const name of ['getCurrentTool', 'getZoom', 'hasActiveInteraction', 'getDisplayLayer']) {
    if (typeof runtime?.[name] !== 'function') {
      throw new TypeError('layer transform surface runtime.' + name + ' bridge is required');
    }
  }
  for (const name of [
    'clamp',
    'frameBounds',
    'hitLayerHandle',
    'layerFrame',
    'pointInLayer',
    'rotationHandlePoint',
  ]) {
    if (typeof geometry?.[name] !== 'function') {
      throw new TypeError('layer transform surface geometry.' + name + ' bridge is required');
    }
  }

  function currentZoom() {
    const value = Number(runtime.getZoom());
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function finitePoint(point) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  function isTransformableLayer(layer) {
    return Boolean(layer) && layer.type !== 'adjustment';
  }

  function interactiveRotationHandlePoint(layer) {
    const owner = state.getDocument();
    if (!owner || !layer) return null;
    const zoom = currentZoom();
    const preferred = geometry.rotationHandlePoint(layer, 30 / zoom);
    const insetX = Math.min(Math.max(8 / zoom, 2), owner.width / 2);
    const insetY = Math.min(Math.max(8 / zoom, 2), owner.height / 2);
    return {
      x: geometry.clamp(preferred.x, insetX, Math.max(insetX, owner.width - insetX)),
      y: geometry.clamp(preferred.y, insetY, Math.max(insetY, owner.height - insetY)),
    };
  }

  function cursorForHandle(handle, layer) {
    const angle = (
      (LAYER_TRANSFORM_HANDLE_ANGLES[handle] ?? 0) +
      (Number(layer?.rotation) || 0) +
      360
    ) % 180;
    const bucket = Math.round(angle / 45) % LAYER_TRANSFORM_RESIZE_CURSORS.length;
    return LAYER_TRANSFORM_RESIZE_CURSORS[bucket];
  }

  function selectedControlHit(point) {
    const owner = state.getDocument();
    const hitPoint = finitePoint(point);
    const layer = owner ? selectedLayer(owner) : null;
    if (
      !owner ||
      !hitPoint ||
      !isTransformableLayer(layer) ||
      !isLayerVisible(owner, layer) ||
      isLayerLocked(owner, layer)
    ) {
      return null;
    }

    const zoom = currentZoom();
    const rotatePoint = interactiveRotationHandlePoint(layer);
    if (
      rotatePoint &&
      Math.hypot(hitPoint.x - rotatePoint.x, hitPoint.y - rotatePoint.y) <= 10 / zoom
    ) {
      return {
        kind: 'rotate',
        layer,
        center: geometry.layerFrame(layer).center,
        cursor: 'grab',
      };
    }

    const handle = geometry.hitLayerHandle(hitPoint, layer, 10 / zoom);
    return handle
      ? {
          kind: 'resize',
          layer,
          handle,
          cursor: cursorForHandle(handle, layer),
        }
      : null;
  }

  function topLayerAt(point) {
    const owner = state.getDocument();
    const hitPoint = finitePoint(point);
    if (!owner || !hitPoint || !Array.isArray(owner.layers)) return null;
    return [...owner.layers].reverse().find(layer => (
      isTransformableLayer(layer) &&
      isLayerVisible(owner, layer) &&
      !isLayerLocked(owner, layer) &&
      geometry.pointInLayer(hitPoint, layer)
    )) ?? null;
  }

  function movePointerIntent(point) {
    const owner = state.getDocument();
    const hitPoint = finitePoint(point);
    if (!owner || !hitPoint) return null;

    const control = selectedControlHit(hitPoint);
    if (control) return control;

    const selected = selectedLayer(owner);
    const target = (
      isTransformableLayer(selected) &&
      isLayerVisible(owner, selected) &&
      !isLayerLocked(owner, selected) &&
      geometry.pointInLayer(hitPoint, selected)
    )
      ? selected
      : topLayerAt(hitPoint);

    return target ? { kind: 'move', layer: target, cursor: 'move' } : null;
  }

  function idleCursor(point) {
    if (runtime.getCurrentTool() !== 'move' || runtime.hasActiveInteraction()) return null;
    const owner = state.getDocument();
    const hitPoint = finitePoint(point);
    if (!owner || !hitPoint) return 'default';

    const control = selectedControlHit(hitPoint);
    if (control) return control.cursor;

    const layer = selectedLayer(owner);
    return (
      layer &&
      isLayerVisible(owner, layer) &&
      !isLayerLocked(owner, layer) &&
      geometry.pointInLayer(hitPoint, layer)
    )
      ? 'move'
      : 'default';
  }

  function draw(context) {
    const owner = state.getDocument();
    if (!owner || !context) return false;
    const layer = runtime.getDisplayLayer(owner) ?? selectedLayer(owner);
    if (!layer || !isLayerVisible(owner, layer) || !isTransformableLayer(layer)) return false;

    const zoom = currentZoom();
    const frame = geometry.layerFrame(layer);
    const moveMode = runtime.getCurrentTool() === 'move';
    const locked = isLayerLocked(owner, layer);
    const accent = locked
      ? LAYER_TRANSFORM_SURFACE_COLORS.locked
      : moveMode
        ? LAYER_TRANSFORM_SURFACE_COLORS.move
        : LAYER_TRANSFORM_SURFACE_COLORS.selected;

    context.save();
    try {
      context.strokeStyle = '#000c';
      context.lineWidth = 4 / zoom;
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(frame.corners[0].x, frame.corners[0].y);
      for (let index = 1; index < frame.corners.length; index += 1) {
        context.lineTo(frame.corners[index].x, frame.corners[index].y);
      }
      context.closePath();
      context.stroke();

      context.strokeStyle = accent;
      context.lineWidth = 1.5 / zoom;
      context.setLineDash(moveMode ? [6 / zoom, 4 / zoom] : []);
      context.stroke();

      if (moveMode && !locked) {
        context.fillStyle = LAYER_TRANSFORM_SURFACE_COLORS.controlFill;
        context.strokeStyle = LAYER_TRANSFORM_SURFACE_COLORS.controlStroke;
        context.setLineDash([]);
        const size = 8 / zoom;
        for (const handlePoint of Object.values(frame.handles)) {
          context.fillRect(handlePoint.x - size / 2, handlePoint.y - size / 2, size, size);
          context.strokeRect(handlePoint.x - size / 2, handlePoint.y - size / 2, size, size);
        }
        const rotatePoint = interactiveRotationHandlePoint(layer);
        context.beginPath();
        context.moveTo(frame.handles.n.x, frame.handles.n.y);
        context.lineTo(rotatePoint.x, rotatePoint.y);
        context.stroke();
        context.beginPath();
        context.arc(rotatePoint.x, rotatePoint.y, 5 / zoom, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      } else {
        context.fillStyle = accent;
        context.strokeStyle = '#071018';
        context.lineWidth = 1 / zoom;
        context.setLineDash([]);
        const radius = 3.5 / zoom;
        for (const corner of frame.corners) {
          context.beginPath();
          context.arc(corner.x, corner.y, radius, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        }
      }

    } finally {
      context.restore();
    }
    return true;
  }

  return {
    isTransformableLayer,
    interactiveRotationHandlePoint,
    cursorForHandle,
    selectedControlHit,
    topLayerAt,
    movePointerIntent,
    idleCursor,
    draw,
  };
}
