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

  return { convertAnchorToCorner };
}
