import { adjustmentModelEqual, sanitizeAdjustmentModel } from '../core/adjustments.js';
import { addLayer, createAdjustmentLayer, isLayerLocked } from '../core/state.js';

export const ADJUSTMENT_COMMAND_RESULT = Object.freeze({
  COMMITTED: 'committed',
  NOOP: 'noop',
  INVALID: 'invalid',
  REJECTED: 'rejected',
});

// Only these kinds can be created by the editor; native PSD-only metadata is not fabricated.
export const NEW_ADJUSTMENT_KINDS = Object.freeze([
  ['brightness-contrast', 'Яркость / контраст'],
  ['levels', 'Уровни (Levels)'],
  ['curves', 'Кривые (Curves)'],
  ['exposure', 'Экспозиция'],
  ['hue-saturation', 'Цветовой тон / насыщенность'],
  ['invert', 'Инверсия'],
  ['posterize', 'Постеризация'],
  ['threshold', 'Порог'],
]);

const ADJUSTMENT_INITIAL_MODELS = Object.freeze({
  'brightness-contrast': { kind:'brightness-contrast', brightness:0, contrast:0 },
  levels: { kind:'levels', master:{ inputBlack:0, inputWhite:255, gamma:1, outputBlack:0, outputWhite:255 }, channels:[] },
  curves: { kind:'curves', channels:[{ id:0, points:[{ input:0, output:0 }, { input:255, output:255 }] }] },
  exposure: { kind:'exposure', exposure:0, offset:0, gamma:1 },
  'hue-saturation': { kind:'hue-saturation', hue:0, saturation:0, lightness:0, colorize:false },
  invert: { kind:'invert' },
  posterize: { kind:'posterize', levels:4 },
  threshold: { kind:'threshold', level:128 },
});

const ADJUSTMENT_LEVEL_KEYS = new Set([
  'inputBlack', 'inputWhite', 'gamma', 'outputBlack', 'outputWhite',
]);
const ADJUSTMENT_SCALAR_PATHS = Object.freeze({
  'brightness-contrast': new Set(['brightness', 'contrast']),
  exposure: new Set(['exposure', 'offset', 'gamma']),
  'hue-saturation': new Set(['hue', 'saturation', 'lightness']),
  posterize: new Set(['levels']),
  threshold: new Set(['level']),
});

function defaultLevelChannel(id) {
  return { id, inputBlack: 0, inputWhite: 255, gamma: 1, outputBlack: 0, outputWhite: 255 };
}

export function createAdjustmentLayerCommandController({ state, transaction } = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('adjustment command state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('adjustment command transaction bridge is required');
  }

  function activeDocument(owner) {
    return Boolean(owner) && state.getDocument() === owner;
  }

  function exactEditableLayer(owner, layerId) {
    if (!activeDocument(owner) || !layerId) return null;
    const layer = owner.layers?.find(item => item.id === layerId) ?? null;
    if (!layer || layer.type !== 'adjustment' || isLayerLocked(owner, layer)) return null;
    return layer;
  }

  function publish(owner, label) {
    if (!activeDocument(owner)) return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    transaction.commit(label);
    return ADJUSTMENT_COMMAND_RESULT.COMMITTED;
  }

  function createLayer(owner, kind) {
    if (!activeDocument(owner) || !Array.isArray(owner.layers) || owner.layers.length >= 500) {
      return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    }
    const preset = Object.hasOwn(ADJUSTMENT_INITIAL_MODELS, kind)
      ? ADJUSTMENT_INITIAL_MODELS[kind] : null;
    if (!preset) return ADJUSTMENT_COMMAND_RESULT.INVALID;
    const adjustment = sanitizeAdjustmentModel(preset);
    if (!adjustment) return ADJUSTMENT_COMMAND_RESULT.INVALID;
    const label = NEW_ADJUSTMENT_KINDS.find(([id]) => id === kind)?.[1] || kind;
    const layer = createAdjustmentLayer({
      name: label,
      width: owner.width,
      height: owner.height,
      adjustment,
    });
    addLayer(owner, layer);
    return publish(owner, `Создать корректирующий слой: ${label}`);
  }

  function parseCurvePointsInput(raw) {
    const tokens = String(raw || '').split(/[;,]+/).map(item => item.trim()).filter(Boolean);
    if (tokens.length < 2 || tokens.length > 19) return null;
    const points = tokens.map(token => {
      const match = token.match(/^(\d{1,3})\s*:\s*(\d{1,3})$/);
      if (!match) return null;
      return { input: Number(match[1]), output: Number(match[2]) };
    });
    if (points.some(point => !point || point.input < 0 || point.input > 255 || point.output < 0 || point.output > 255)) return null;
    points.sort((left, right) => left.input - right.input);
    for (let index = 1; index < points.length; index += 1) {
      if (points[index].input <= points[index - 1].input) return null;
    }
    return points;
  }

  function updateProperty(owner, layerId, path, raw) {
    const layer = exactEditableLayer(owner, layerId);
    if (!layer) return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    const current = sanitizeAdjustmentModel(layer.adjustment);
    if (!current) return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    const value = Number(raw);
    if (!Number.isFinite(value)) return ADJUSTMENT_COMMAND_RESULT.INVALID;

    const candidate = structuredClone(current);
    const propertyPath = String(path || '');
    if (current.kind === 'levels') {
      const masterMatch = propertyPath.match(/^master\.(inputBlack|inputWhite|gamma|outputBlack|outputWhite)$/);
      const channelMatch = propertyPath.match(/^channels\.(\d+)\.(inputBlack|inputWhite|gamma|outputBlack|outputWhite)$/);
      if (masterMatch && ADJUSTMENT_LEVEL_KEYS.has(masterMatch[1])) {
        candidate.master[masterMatch[1]] = value;
      } else if (channelMatch) {
        const channelId = Number(channelMatch[1]);
        const key = channelMatch[2];
        if (![1, 2, 3].includes(channelId) || !ADJUSTMENT_LEVEL_KEYS.has(key)) {
          return ADJUSTMENT_COMMAND_RESULT.INVALID;
        }
        let channel = (candidate.channels || []).find(item => item.id === channelId);
        if (!channel) {
          channel = defaultLevelChannel(channelId);
          candidate.channels = [...(candidate.channels || []), channel];
        }
        channel[key] = value;
      } else {
        return ADJUSTMENT_COMMAND_RESULT.INVALID;
      }
    } else {
      const allowed = ADJUSTMENT_SCALAR_PATHS[current.kind];
      if (!allowed?.has(propertyPath)) return ADJUSTMENT_COMMAND_RESULT.INVALID;
      candidate[propertyPath] = value;
    }

    const next = sanitizeAdjustmentModel(candidate);
    if (!next) return ADJUSTMENT_COMMAND_RESULT.INVALID;
    if (adjustmentModelEqual(layer.adjustment, next)) return ADJUSTMENT_COMMAND_RESULT.NOOP;
    layer.adjustment = next;
    return publish(owner, 'Изменить Photoshop adjustment');
  }

  function updateCurveChannel(owner, layerId, id, raw) {
    const layer = exactEditableLayer(owner, layerId);
    if (!layer) return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    const current = sanitizeAdjustmentModel(layer.adjustment);
    if (current?.kind !== 'curves') return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    const channelId = Number(id);
    if (!Number.isInteger(channelId) || channelId < 0 || channelId > 3) return ADJUSTMENT_COMMAND_RESULT.INVALID;
    const points = parseCurvePointsInput(raw);
    if (!points) return ADJUSTMENT_COMMAND_RESULT.INVALID;

    const candidate = structuredClone(current);
    candidate.channels = (candidate.channels || []).filter(channel => channel.id !== channelId);
    candidate.channels.push({ id: channelId, points });
    candidate.channels.sort((left, right) => left.id - right.id);
    const next = sanitizeAdjustmentModel(candidate);
    if (!next) return ADJUSTMENT_COMMAND_RESULT.INVALID;
    if (adjustmentModelEqual(layer.adjustment, next)) return ADJUSTMENT_COMMAND_RESULT.NOOP;
    layer.adjustment = next;
    return publish(owner, 'Изменить точки Photoshop Curves');
  }

  // Hue/Saturation's colorization flag changes the actual color transform.
  // Persist a normalized model and one history entry, never a view-only checkbox.
  function setColorize(owner, layerId, enabled) {
    const layer = exactEditableLayer(owner, layerId);
    if (!layer) return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    const current = sanitizeAdjustmentModel(layer.adjustment);
    if (current?.kind !== 'hue-saturation') return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    if (typeof enabled !== 'boolean') return ADJUSTMENT_COMMAND_RESULT.INVALID;
    const next = sanitizeAdjustmentModel({ ...current, colorize: enabled });
    if (adjustmentModelEqual(layer.adjustment, next)) return ADJUSTMENT_COMMAND_RESULT.NOOP;
    layer.adjustment = next;
    return publish(owner, 'Изменить режим тонирования Hue/Saturation');
  }

  function setClipping(owner, layerId, checked) {
    const layer = exactEditableLayer(owner, layerId);
    if (!layer) return ADJUSTMENT_COMMAND_RESULT.REJECTED;
    const next = Boolean(checked);
    if (Boolean(layer.clipping) === next) return ADJUSTMENT_COMMAND_RESULT.NOOP;
    layer.clipping = next;
    return publish(owner, 'Изменить clipping adjustment layer');
  }

  return { createLayer, updateProperty, updateCurveChannel, setColorize, setClipping };
}
