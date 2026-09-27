import { clamp } from '../core/geometry.js';
import {
  checkedCanvasSize,
  DEFAULT_LAYER_FILTERS,
  FILTER_RANGES,
  sanitizeFilters,
  sanitizeHighDepthPreview,
  isLayerLocked,
} from '../core/state.js';

const LAYER_PROPERTY_STRING_PROPS = new Set([
  'name', 'text', 'color', 'fill', 'stroke',
  'fontFamily', 'fontWeight', 'fontStyle', 'align',
  'underline', 'strikeThrough',
]);
const LAYER_PROPERTY_BLEND_MODES = new Set([
  'source-over', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light',
  'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion',
]);

export function createLayerPropertyCommandController({
  state,
  transaction,
  rendering,
  ui,
  text,
  effects,
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('layer property state bridge is required');
  }
  if (typeof transaction?.commit !== 'function') {
    throw new TypeError('layer property transaction bridge is required');
  }
  if (typeof rendering?.render !== 'function') {
    throw new TypeError('layer property render bridge is required');
  }

  const previewBaselines = new WeakMap();

  function activeDocument(owner) {
    return Boolean(owner) && state.getDocument() === owner;
  }

  function exactLayer(owner, layerId) {
    if (!activeDocument(owner) || !layerId) return null;
    return owner.layers?.find(layer => layer.id === layerId) ?? null;
  }

  function status(message) {
    ui?.setStatus?.(message);
  }

  function baselineMap(owner) {
    let map = previewBaselines.get(owner);
    if (!map) {
      map = new Map();
      previewBaselines.set(owner, map);
    }
    return map;
  }

  function rememberBaseline(owner, key, value) {
    const map = baselineMap(owner);
    if (!map.has(key)) map.set(key, value);
  }

  function takeBaseline(owner, key, fallback) {
    const map = previewBaselines.get(owner);
    if (!map?.has(key)) return fallback;
    const value = map.get(key);
    map.delete(key);
    return value;
  }

  function clearBaseline(owner, key) {
    previewBaselines.get(owner)?.delete(key);
  }

  function sameValue(left, right) {
    return typeof left === 'number' && typeof right === 'number'
      ? Math.abs(left - right) < 1e-9
      : Object.is(left, right);
  }

  function publishPreview({ overlay = false } = {}) {
    transaction.markTransientChange?.();
    rendering.render();
    if (overlay) rendering.drawOverlay?.();
  }

  function publishCommit(owner, label) {
    if (!activeDocument(owner)) return false;
    transaction.commit(label);
    return true;
  }

  function rejectNumber() {
    rendering.refreshInspectorPanels?.();
    status('Некорректное числовое значение');
    return null;
  }

  function normalizeProperty(layer, path, raw) {
    const stringProperty = LAYER_PROPERTY_STRING_PROPS.has(path);
    let value = stringProperty ? raw : Number(raw);
    if (!stringProperty && !Number.isFinite(value)) return rejectNumber();

    if (path === 'width' || path === 'height') {
      value = clamp(value, 1, 12000);
      if (layer.type === 'raster') {
        try {
          checkedCanvasSize(
            path === 'width' ? value : layer.width,
            path === 'height' ? value : layer.height,
            `Растровый слой «${layer.name || 'Без имени'}»`,
          );
        } catch (error) {
          rendering.refreshInspectorPanels?.();
          status(error.message);
          ui?.toast?.(error.message, 'warn');
          return null;
        }
      }
    }
    if (path === 'scaleX' || path === 'scaleY') value = clamp(value, 0.01, 100);
    if (path === 'x' || path === 'y') value = clamp(value, -120000, 120000);
    if (path === 'rotation') value = ((value % 360) + 360) % 360;
    if (path === 'fontSize') value = clamp(value, 6, 500);
    if (path === 'fontWeight' && !text?.isWeight?.(value)) return null;
    if (path === 'fontStyle' && !text?.isStyle?.(value)) return null;
    if (path === 'align' && !text?.isAlign?.(value)) return null;
    if (
      path === 'fontFamily' &&
      !text?.fontOptions?.(layer.fontFamily, layer.fontLabel)
        ?.some(([option]) => option === value)
    ) return null;
    if (path === 'lineHeight') value = clamp(value, 0.8, 3);
    if (path === 'letterSpacing') value = clamp(value, -5, 20);
    if (path === 'underline' || path === 'strikeThrough') value = value === 'yes';
    if (path === 'strokeWidth') value = clamp(value, 0, 1000);
    return value;
  }

  function commandApplyProperty(owner, layerId, path, raw, { commit = true } = {}) {
    const previewKey = `property:${layerId}:${path}`;
    const layer = exactLayer(owner, layerId);
    if (!layer) {
      if (commit) clearBaseline(owner, previewKey);
      return false;
    }
    if (isLayerLocked(owner, layer)) {
      if (commit) clearBaseline(owner, previewKey);
      return false;
    }

    if (path.startsWith('filters.')) {
      const filterKey = path.split('.')[1];
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return rejectNumber() !== null;
      const [min, max] = FILTER_RANGES[filterKey] || [0, 400];
      const value = clamp(numeric, min, max);
      const currentFilters = sanitizeFilters(layer.filters);
      const current = currentFilters[filterKey];
      const baseline = commit
        ? takeBaseline(owner, previewKey, current)
        : (rememberBaseline(owner, previewKey, current), current);

      if (!sameValue(current, value)) {
        layer.filters = { ...currentFilters, [filterKey]: value };
      }

      if (!commit) {
        if (sameValue(current, value)) return false;
        publishPreview();
        return true;
      }
      if (sameValue(baseline, value)) {
        if (!sameValue(current, value)) publishPreview();
        return !sameValue(current, value);
      }
      return publishCommit(owner, 'Изменить фильтр слоя');
    }

    const value = normalizeProperty(layer, path, raw);
    if (value === null) return false;
    const current = layer[path];
    const baseline = commit
      ? takeBaseline(owner, previewKey, current)
      : (rememberBaseline(owner, previewKey, current), current);

    if (!sameValue(current, value)) {
      if (path === 'fontFamily') {
        layer.fontData = null;
        layer.fontLabel = '';
      }
      layer[path] = value;
    }

    if (!commit) {
      if (sameValue(current, value)) return false;
      publishPreview({ overlay: true });
      return true;
    }
    if (sameValue(baseline, value)) {
      if (!sameValue(current, value)) publishPreview({ overlay: true });
      return !sameValue(current, value);
    }
    return publishCommit(owner, `Изменить ${path}`);
  }

  function resetFilterKeys(owner, layerId, {
    keysForLayer,
    label,
    noOpStatus = '',
    requireRaster = false,
    dropUnknown = false,
  } = {}) {
    const layer = exactLayer(owner, layerId);
    if (!layer || (requireRaster && layer.type !== 'raster') || isLayerLocked(owner, layer)) return false;

    const source = layer.filters;
    const current = sanitizeFilters(source);
    const keys = [...new Set(keysForLayer?.(layer) ?? [])]
      .filter(key => key in DEFAULT_LAYER_FILTERS);
    if (!keys.length) return false;

    let changed = dropUnknown && (
      !source ||
      typeof source !== 'object' ||
      Array.isArray(source) ||
      Object.keys(source).some(key => !(key in DEFAULT_LAYER_FILTERS))
    );
    const next = { ...current };
    for (const key of keys) {
      clearBaseline(owner, `property:${layerId}:filters.${key}`);
      const sourceIsCanonical = Boolean(source) &&
        typeof source === 'object' &&
        !Array.isArray(source) &&
        Object.prototype.hasOwnProperty.call(source, key) &&
        typeof source[key] === 'number' &&
        Number.isFinite(source[key]) &&
        sameValue(source[key], current[key]);
      if (!sourceIsCanonical || !sameValue(current[key], DEFAULT_LAYER_FILTERS[key])) changed = true;
      next[key] = DEFAULT_LAYER_FILTERS[key];
    }

    if (!changed) {
      if (noOpStatus) status(noOpStatus);
      return false;
    }
    layer.filters = next;
    return publishCommit(owner, label);
  }

  function commandResetEffects(owner, layerId) {
    return resetFilterKeys(owner, layerId, {
      keysForLayer: layer => effects?.filterKeysForLayer?.(layer) ?? Object.keys(DEFAULT_LAYER_FILTERS),
      label: 'Сбросить цвет и эффекты',
      noOpStatus: 'Цвет и эффекты уже сброшены',
    });
  }

  function commandResetColorCorrection(owner, layerId) {
    return resetFilterKeys(owner, layerId, {
      keysForLayer: () => effects?.colorCorrectionKeys ?? [],
      label: 'Сбросить цветокоррекцию',
      requireRaster: true,
    });
  }

  function commandResetFilters(owner, layerId) {
    return resetFilterKeys(owner, layerId, {
      keysForLayer: () => Object.keys(DEFAULT_LAYER_FILTERS),
      label: 'Сбросить фильтры',
      dropUnknown: true,
    });
  }

  function commandSetBlendMode(owner, layerId, raw) {
    const layer = exactLayer(owner, layerId);
    if (!layer || isLayerLocked(owner, layer)) return false;
    const value = String(raw || '');
    if (!LAYER_PROPERTY_BLEND_MODES.has(value) || layer.blendMode === value) return false;
    layer.blendMode = value;
    return publishCommit(owner, 'Режим наложения');
  }

  function commandSetOpacity(owner, layerId, rawPercent, { commit = true } = {}) {
    const previewKey = `opacity:${layerId}`;
    const layer = exactLayer(owner, layerId);
    if (!layer) {
      if (commit) clearBaseline(owner, previewKey);
      return false;
    }
    if (isLayerLocked(owner, layer)) {
      if (commit) clearBaseline(owner, previewKey);
      return false;
    }

    const raw = Number(rawPercent);
    if (!Number.isFinite(raw)) return false;
    const value = clamp(raw / 100, 0, 1);
    const current = Number(layer.opacity ?? 1);
    const baseline = commit
      ? takeBaseline(owner, previewKey, current)
      : (rememberBaseline(owner, previewKey, current), current);

    if (!sameValue(current, value)) layer.opacity = value;

    if (!commit) {
      if (sameValue(current, value)) return false;
      publishPreview();
      return true;
    }
    if (sameValue(baseline, value)) {
      if (!sameValue(current, value)) publishPreview();
      return !sameValue(current, value);
    }
    return publishCommit(owner, 'Непрозрачность слоя');
  }

  function commandUpdateHighDepthPreview(owner, layerId, key, raw, { commit = true } = {}) {
    const previewKey = `hdr:${layerId}:${key}`;
    const layer = exactLayer(owner, layerId);
    if (!layer) {
      if (commit) clearBaseline(owner, previewKey);
      return false;
    }
    if (layer.type !== 'raster' || !layer.highDepthSource || isLayerLocked(owner, layer)) {
      if (commit) clearBaseline(owner, previewKey);
      return false;
    }
    if (key !== 'toneMap' && key !== 'displayExposure') return false;

    const currentPreview = sanitizeHighDepthPreview(layer.highDepthPreview);
    const candidate = sanitizeHighDepthPreview({
      ...currentPreview,
      [key]: key === 'displayExposure' ? Number(raw) : raw,
    });
    const current = currentPreview[key];
    const value = candidate[key];
    const baseline = commit
      ? takeBaseline(owner, previewKey, current)
      : (rememberBaseline(owner, previewKey, current), current);

    if (!sameValue(current, value)) layer.highDepthPreview = candidate;

    if (!commit) {
      if (sameValue(current, value)) return false;
      publishPreview();
      return true;
    }
    if (sameValue(baseline, value)) {
      if (!sameValue(current, value)) publishPreview();
      return !sameValue(current, value);
    }
    return publishCommit(
      owner,
      key === 'toneMap' ? 'Изменить HDR tone mapping' : 'Изменить HDR display exposure',
    );
  }

  function commandResetHighDepthPreview(owner, layerId) {
    const layer = exactLayer(owner, layerId);
    if (!layer || layer.type !== 'raster' || !layer.highDepthSource || isLayerLocked(owner, layer)) return false;
    clearBaseline(owner, `hdr:${layerId}:toneMap`);
    clearBaseline(owner, `hdr:${layerId}:displayExposure`);
    const current = sanitizeHighDepthPreview(layer.highDepthPreview);
    const defaults = sanitizeHighDepthPreview();
    if (
      sameValue(current.toneMap, defaults.toneMap) &&
      sameValue(current.displayExposure, defaults.displayExposure)
    ) {
      status('HDR preview уже сброшен');
      return false;
    }
    layer.highDepthPreview = defaults;
    return publishCommit(owner, 'Сбросить HDR preview');
  }

  function commandApplyCustomFont(owner, layerId, custom) {
    const layer = exactLayer(owner, layerId);
    if (!layer || layer.type !== 'text' || isLayerLocked(owner, layer) || !custom) return false;
    const nextFamily = String(custom.fontFamily || '');
    const nextData = custom.fontData ?? null;
    const nextLabel = String(custom.fontLabel || '');
    if (!nextFamily) return false;
    if (
      layer.fontFamily === nextFamily &&
      layer.fontData === nextData &&
      layer.fontLabel === nextLabel
    ) return false;
    layer.fontFamily = nextFamily;
    layer.fontData = nextData;
    layer.fontLabel = nextLabel;
    return publishCommit(owner, 'Изменить шрифт текста');
  }

  function selectedTarget() {
    const owner = state.getDocument();
    return { owner, layerId: owner?.selectedLayerId ?? null };
  }

  return {
    applyProperty: commandApplyProperty,
    resetEffects: commandResetEffects,
    resetColorCorrection: commandResetColorCorrection,
    resetFilters: commandResetFilters,
    setBlendMode: commandSetBlendMode,
    setOpacity: commandSetOpacity,
    updateHighDepthPreview: commandUpdateHighDepthPreview,
    resetHighDepthPreview: commandResetHighDepthPreview,
    applyCustomFont: commandApplyCustomFont,
    resetSelectedEffects: () => {
      const { owner, layerId } = selectedTarget();
      return owner && layerId ? commandResetEffects(owner, layerId) : false;
    },
    resetSelectedColorCorrection: () => {
      const { owner, layerId } = selectedTarget();
      return owner && layerId ? commandResetColorCorrection(owner, layerId) : false;
    },
    resetSelectedFilters: () => {
      const { owner, layerId } = selectedTarget();
      return owner && layerId ? commandResetFilters(owner, layerId) : false;
    },
    setSelectedBlendMode: value => {
      const { owner, layerId } = selectedTarget();
      return owner && layerId ? commandSetBlendMode(owner, layerId, value) : false;
    },
    setSelectedOpacity: (value, options) => {
      const { owner, layerId } = selectedTarget();
      return owner && layerId ? commandSetOpacity(owner, layerId, value, options) : false;
    },
  };
}
