import { checkedCanvasSize, imageResizeTransforms, MAX_LAYER_POSITION } from '../core/state.js';

export const DOCUMENT_RESIZE_COMMAND_RESULT = Object.freeze({
  COMMITTED: 'committed',
  NOOP: 'noop',
  INVALID: 'invalid',
  REJECTED: 'rejected',
});

export const DOCUMENT_RESIZE_ANCHORS = Object.freeze([
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
]);

const DOCUMENT_RESIZE_ANCHOR_POINTS = Object.freeze({
  'top-left': [0, 0],
  top: [0.5, 0],
  'top-right': [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  'bottom-left': [0, 1],
  bottom: [0.5, 1],
  'bottom-right': [1, 1],
});

export const DOCUMENT_RESIZE_POSITION_ERROR = 'Размер холста выведет слой за допустимые пределы';

function commandResult(result, error = null) {
  return error ? { result, error } : { result };
}

export function createDocumentResizeCommandController({
  state,
  transaction,
  runtime,
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('document resize command state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('document resize command transaction bridge is required');
  }
  if (typeof runtime?.resetGeometryTransientState !== 'function') {
    throw new TypeError('document resize command transient reset bridge is required');
  }
  if (typeof runtime?.fitToView !== 'function') {
    throw new TypeError('document resize command fit-to-view bridge is required');
  }

  function activeOwner(owner) {
    return Boolean(owner) && state.getDocument() === owner;
  }

  function requestedSize(owner, request, label) {
    return checkedCanvasSize(
      Number(request?.width) || owner.width,
      Number(request?.height) || owner.height,
      label,
    );
  }

  function publish(label) {
    runtime.resetGeometryTransientState();
    transaction.commit(label);
    runtime.fitToView();
    return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.COMMITTED);
  }

  function resizeImage(owner, request = {}) {
    if (!activeOwner(owner)) return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED);

    let size;
    let transforms;
    try {
      size = requestedSize(owner, request, 'Размер изображения');
      if (size.width === owner.width && size.height === owner.height) {
        return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.NOOP);
      }
      const scaleX = size.width / owner.width;
      const scaleY = size.height / owner.height;
      transforms = imageResizeTransforms(owner.layers, scaleX, scaleY);
    } catch (error) {
      return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.INVALID, error);
    }

    if (!activeOwner(owner)) return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED);

    owner.layers.forEach((layer, index) => Object.assign(layer, transforms[index]));
    owner.width = size.width;
    owner.height = size.height;
    return publish('Размер изображения');
  }

  function resizeCanvas(owner, request = {}) {
    if (!activeOwner(owner)) return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED);

    let size;
    let updates;
    try {
      size = requestedSize(owner, request, 'Размер холста');
      if (size.width === owner.width && size.height === owner.height) {
        return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.NOOP);
      }

      const anchor = Object.hasOwn(DOCUMENT_RESIZE_ANCHOR_POINTS, request?.anchor)
        ? request.anchor
        : 'center';
      const [anchorX, anchorY] = DOCUMENT_RESIZE_ANCHOR_POINTS[anchor];
      const shiftX = (size.width - owner.width) * anchorX;
      const shiftY = (size.height - owner.height) * anchorY;

      updates = owner.layers.map(layer => {
        const x = layer.x + shiftX;
        const y = layer.y + shiftY;
        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          Math.abs(x) > MAX_LAYER_POSITION ||
          Math.abs(y) > MAX_LAYER_POSITION
        ) {
          throw new Error(DOCUMENT_RESIZE_POSITION_ERROR);
        }
        return { x, y };
      });
    } catch (error) {
      return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.INVALID, error);
    }

    if (!activeOwner(owner)) return commandResult(DOCUMENT_RESIZE_COMMAND_RESULT.REJECTED);

    owner.layers.forEach((layer, index) => Object.assign(layer, updates[index]));
    owner.width = size.width;
    owner.height = size.height;
    return publish('Размер холста');
  }

  return { resizeImage, resizeCanvas };
}
