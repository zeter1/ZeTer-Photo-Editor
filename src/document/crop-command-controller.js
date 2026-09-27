import { checkedCanvasSize, MAX_LAYER_POSITION } from '../core/state.js';

export const DOCUMENT_CROP_COMMAND_RESULT = Object.freeze({
  COMMITTED: 'committed',
  NOOP: 'noop',
  INVALID: 'invalid',
  REJECTED: 'rejected',
});

export const DOCUMENT_CROP_GEOMETRY_ERROR = 'Некорректная область кадрирования';
export const DOCUMENT_CROP_POSITION_ERROR = 'Кадрирование выведет слой за допустимые пределы';

function commandResult(result, error = null) {
  return error ? { result, error } : { result };
}

function normalizedCropRect(rect) {
  const xValue = Number(rect?.x);
  const yValue = Number(rect?.y);
  const widthValue = Number(rect?.width);
  const heightValue = Number(rect?.height);
  if (
    !Number.isFinite(xValue) ||
    !Number.isFinite(yValue) ||
    !Number.isFinite(widthValue) ||
    !Number.isFinite(heightValue) ||
    widthValue <= 0 ||
    heightValue <= 0
  ) {
    throw new Error(DOCUMENT_CROP_GEOMETRY_ERROR);
  }

  const x = Math.round(xValue);
  const y = Math.round(yValue);
  const width = Math.max(1, Math.round(widthValue));
  const height = Math.max(1, Math.round(heightValue));
  const size = checkedCanvasSize(width, height, 'Кадрирование');
  if (size.width !== width || size.height !== height) {
    throw new Error(DOCUMENT_CROP_GEOMETRY_ERROR);
  }
  return { x, y, width:size.width, height:size.height };
}

export function createDocumentCropCommandController({
  state,
  transaction,
  runtime,
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('document crop command state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('document crop command transaction bridge is required');
  }
  if (typeof runtime?.completeCropTransientState !== 'function') {
    throw new TypeError('document crop command transient completion bridge is required');
  }
  if (typeof runtime?.fitToView !== 'function') {
    throw new TypeError('document crop command fit-to-view bridge is required');
  }

  function activeOwner(owner) {
    return Boolean(owner) && state.getDocument() === owner;
  }

  function complete(result) {
    runtime.completeCropTransientState();
    if (result === DOCUMENT_CROP_COMMAND_RESULT.COMMITTED) {
      transaction.commit('Кадрирование');
    }
    runtime.fitToView();
    return commandResult(result);
  }

  function crop(owner, rect) {
    if (!activeOwner(owner)) return commandResult(DOCUMENT_CROP_COMMAND_RESULT.REJECTED);

    let cropRect;
    let updates;
    try {
      cropRect = normalizedCropRect(rect);
      if (
        cropRect.x === 0 &&
        cropRect.y === 0 &&
        cropRect.width === owner.width &&
        cropRect.height === owner.height
      ) {
        if (!activeOwner(owner)) return commandResult(DOCUMENT_CROP_COMMAND_RESULT.REJECTED);
        return complete(DOCUMENT_CROP_COMMAND_RESULT.NOOP);
      }

      if (!Array.isArray(owner.layers)) throw new Error(DOCUMENT_CROP_GEOMETRY_ERROR);
      updates = owner.layers.map(layer => {
        const x = Number(layer?.x) - cropRect.x;
        const y = Number(layer?.y) - cropRect.y;
        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          Math.abs(x) > MAX_LAYER_POSITION ||
          Math.abs(y) > MAX_LAYER_POSITION
        ) {
          throw new Error(DOCUMENT_CROP_POSITION_ERROR);
        }
        return { x, y };
      });
    } catch (error) {
      return commandResult(DOCUMENT_CROP_COMMAND_RESULT.INVALID, error);
    }

    if (!activeOwner(owner)) return commandResult(DOCUMENT_CROP_COMMAND_RESULT.REJECTED);

    owner.layers.forEach((layer, index) => Object.assign(layer, updates[index]));
    owner.width = cropRect.width;
    owner.height = cropRect.height;
    return complete(DOCUMENT_CROP_COMMAND_RESULT.COMMITTED);
  }

  return { crop };
}
