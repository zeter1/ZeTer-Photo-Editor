import { isLayerLocked } from '../core/state.js';

export const PATH_CONTROL_COMMAND_RESULT = Object.freeze({
  COMMITTED: 'committed',
  NOOP: 'noop',
  IGNORED: 'ignored',
  REJECTED: 'rejected',
});

const PATH_CONTROL_CORNER_LABELS = Object.freeze({
  shape: 'Преобразовать Bézier-узел в угловой',
  'vector-mask': 'Преобразовать узел векторной маски',
  'document-path': 'Преобразовать узел сохранённого контура',
});


const PATH_CONTROL_SMOOTH_LABELS = Object.freeze({
  shape: 'Сгладить Bézier-узел',
  'vector-mask': 'Сгладить узел векторной маски',
  'document-path': 'Сгладить узел сохранённого контура',
});

function finitePoint(node) {
  const x = Number(node?.x);
  const y = Number(node?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function smoothNodeHandles(points, index, closed) {
  if (!Array.isArray(points) || points.length < 2 || !Number.isInteger(index)) return null;
  const current = finitePoint(points[index]);
  const previousIndex = index > 0 ? index - 1 : closed ? points.length - 1 : -1;
  const nextIndex = index < points.length - 1 ? index + 1 : closed ? 0 : -1;
  const previous = previousIndex < 0 ? null : finitePoint(points[previousIndex]);
  const next = nextIndex < 0 ? null : finitePoint(points[nextIndex]);
  if (!current || (previousIndex >= 0 && !previous) || (nextIndex >= 0 && !next)) return null;
  if (!previous && !next) return null;

  // The neighbour chord gives an aligned tangent; open end-points use the
  // single adjacent segment. Keep each handle at most 1/3 of its segment.
  let dx = (next ?? current).x - (previous ?? current).x;
  let dy = (next ?? current).y - (previous ?? current).y;
  let length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-9) {
    dx = next ? next.x - current.x : current.x - previous.x;
    dy = next ? next.y - current.y : current.y - previous.y;
    length = Math.hypot(dx, dy);
  }
  if (!Number.isFinite(length) || length < 1e-9) return null;
  const inLength = previous ? Math.hypot(current.x - previous.x, current.y - previous.y) / 3 : 0;
  const outLength = next ? Math.hypot(next.x - current.x, next.y - current.y) / 3 : 0;
  if (!Number.isFinite(inLength) || !Number.isFinite(outLength)) return null;
  const ux = dx / length;
  const uy = dy / length;
  const handleIn = previous ? { x:current.x - ux * inLength, y:current.y - uy * inLength } : null;
  const handleOut = next ? { x:current.x + ux * outLength, y:current.y + uy * outLength } : null;
  if ([handleIn, handleOut].some(point => point && !finitePoint(point))) return null;
  return { handleIn, handleOut };
}

export function createPathControlCommandController({
  state,
  targets,
  transaction,
  ui,
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('path control command state bridge is required');
  }
  if (typeof targets?.resolve !== 'function') {
    throw new TypeError('path control command targets.resolve bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('path control command transaction bridge is required');
  }
  if (typeof ui?.setStatus !== 'function') {
    throw new TypeError('path control command ui.setStatus bridge is required');
  }

  function convertAnchorToCorner(owner, target, modifiers = {}) {
    if (target?.control !== 'anchor' || !modifiers.altKey) {
      return PATH_CONTROL_COMMAND_RESULT.IGNORED;
    }
    if (!owner || state.getDocument() !== owner) {
      return PATH_CONTROL_COMMAND_RESULT.REJECTED;
    }

    const resolved = targets.resolve(target);
    const label = PATH_CONTROL_CORNER_LABELS[resolved?.source];
    if (
      !resolved?.node ||
      !label ||
      (resolved.layer && isLayerLocked(owner, resolved.layer))
    ) {
      return PATH_CONTROL_COMMAND_RESULT.REJECTED;
    }

    const node = resolved.node;
    const changed = Boolean(node.handleIn || node.handleOut || node.kind === 'smooth');
    node.handleIn = null;
    node.handleOut = null;
    node.kind = 'corner';

    if (!changed) {
      ui.setStatus('Bézier-узел уже угловой');
      return PATH_CONTROL_COMMAND_RESULT.NOOP;
    }

    transaction.commit(label);
    return PATH_CONTROL_COMMAND_RESULT.COMMITTED;
  }


  function convertAnchorToSmooth(owner, target, modifiers = {}) {
    if (target?.control !== 'anchor' || !modifiers.altKey || !modifiers.shiftKey) {
      return PATH_CONTROL_COMMAND_RESULT.IGNORED;
    }
    if (!owner || state.getDocument() !== owner) {
      return PATH_CONTROL_COMMAND_RESULT.REJECTED;
    }
    const resolved = targets.resolve(target);
    const label = PATH_CONTROL_SMOOTH_LABELS[resolved?.source];
    if (!resolved?.node || !label || (resolved.layer && isLayerLocked(owner, resolved.layer))) {
      return PATH_CONTROL_COMMAND_RESULT.REJECTED;
    }
    const node = resolved.node;
    if (node.kind === 'smooth') {
      ui.setStatus('Bézier-узел уже сглажен');
      return PATH_CONTROL_COMMAND_RESULT.NOOP;
    }
    const handles = smoothNodeHandles(resolved.points, resolved.nodeIndex, resolved.closed);
    if (!handles) {
      ui.setStatus('Для сглаживания нужны соседние узлы с разными координатами');
      return PATH_CONTROL_COMMAND_RESULT.NOOP;
    }
    node.handleIn = handles.handleIn;
    node.handleOut = handles.handleOut;
    node.kind = 'smooth';
    transaction.commit(label);
    return PATH_CONTROL_COMMAND_RESULT.COMMITTED;
  }

  return { convertAnchorToCorner, convertAnchorToSmooth };
}
