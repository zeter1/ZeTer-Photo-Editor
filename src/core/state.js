import { clamp } from './geometry.js';
import { sanitizeLayerStyles } from './layer-styles.js';

let layerCounter = 0;
const uid = (prefix = 'layer') => `${prefix}-${Date.now().toString(36)}-${(++layerCounter).toString(36)}`;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bounded = (value, fallback, min, max) => clamp(finite(value, fallback), min, max);
const shortText = (value, fallback = '', max = 500) => String(value ?? fallback).slice(0, max);
const BLEND_MODES = new Set(['source-over','multiply','screen','overlay','darken','lighten','color-dodge','color-burn']);
export const PROJECT_VERSION = 1;
export const DEFAULT_LAYER_FILTERS = Object.freeze({
  brightness: 100, contrast: 100, saturate: 100, exposure: 0, highlights: 0, shadows: 0,
  temperature: 0, tint: 0, vibrance: 0, gamma: 1, hue: 0,
  grayscale: 0, sepia: 0, invert: 0, blur: 0,
});
export const FILTER_RANGES = Object.freeze({
  brightness: [0, 400], contrast: [0, 400], saturate: [0, 400], exposure: [-4, 4],
  highlights: [-100, 100], shadows: [-100, 100], temperature: [-100, 100], tint: [-100, 100],
  vibrance: [-100, 100], gamma: [0.1, 5], hue: [-180, 180], grayscale: [0, 100], sepia: [0, 100],
  invert: [0, 100], blur: [0, 100],
});
export const MAX_CANVAS_DIMENSION = 12000;
export const MAX_CANVAS_PIXELS = 48_000_000;
export const MIN_LAYER_SCALE = 0.01;
export const MAX_LAYER_SCALE = 100;
export const MAX_LAYER_POSITION = 120000;

export function imageResizeTransforms(layers, sx, sy) {
  return layers.map(layer => {
    const rotation = ((Number(layer.rotation) || 0) % 180 + 180) % 180;
    if (Math.abs(sx - sy) > 1e-9 && rotation > 1e-9) {
      throw new Error('Непропорциональный размер изображения нельзя применить к повёрнутому слою без искажения.');
    }
    const next = {
      x: layer.x * sx,
      y: layer.y * sy,
      scaleX: (layer.scaleX ?? 1) * sx,
      scaleY: (layer.scaleY ?? 1) * sy,
    };
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y) ||
        Math.abs(next.x) > MAX_LAYER_POSITION || Math.abs(next.y) > MAX_LAYER_POSITION ||
        !Number.isFinite(next.scaleX) || !Number.isFinite(next.scaleY) ||
        next.scaleX < MIN_LAYER_SCALE || next.scaleX > MAX_LAYER_SCALE ||
        next.scaleY < MIN_LAYER_SCALE || next.scaleY > MAX_LAYER_SCALE) {
      throw new Error('Размер изображения выведет слой за допустимые пределы. Уменьшите изменение размера.');
    }
    return next;
  });
}

export function checkedCanvasSize(width, height, label = 'Холст') {
  const w = clamp(Math.round(finite(width, 1)), 1, MAX_CANVAS_DIMENSION);
  const h = clamp(Math.round(finite(height, 1)), 1, MAX_CANVAS_DIMENSION);
  const pixels = w * h;
  if (pixels > MAX_CANVAS_PIXELS) {
    const megapixels = (pixels / 1_000_000).toFixed(1);
    const limit = (MAX_CANVAS_PIXELS / 1_000_000).toFixed(0);
    throw new Error(`${label}: ${w} × ${h} (${megapixels} МП) превышает безопасный лимит ${limit} МП`);
  }
  return { width: w, height: h, pixels };
}

export function createDocument({ name = 'Без имени', width = 1200, height = 800, background = 'transparent' } = {}) {
  const size = checkedCanvasSize(width, height, 'Документ');
  return {
    version: PROJECT_VERSION,
    name,
    width: size.width,
    height: size.height,
    background,
    layers: [],
    groups: [],
    selectedLayerId: null,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };
}

export function baseLayer(type, overrides = {}) {
  return {
    id: uid(type),
    type,
    name: type === 'raster' ? 'Растровый слой' : type === 'text' ? 'Текст' : 'Фигура',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    filters: { ...DEFAULT_LAYER_FILTERS },
    styles: null,
    groupId: null,
    ...overrides,
  };
}

export function createRasterLayer(overrides = {}) {
  return baseLayer('raster', { dataUrl: null, ...overrides });
}

export function createTextLayer(overrides = {}) {
  return baseLayer('text', {
    name: 'Текст', text: 'Текст', color: '#ffffff', fontSize: 48, fontFamily: 'Inter, Arial, sans-serif',
    fontWeight: '400', fontStyle: 'normal', align: 'left', lineHeight: 1.18,
    letterSpacing: 0, underline: false, strikeThrough: false,
    fontData: null, fontLabel: '',
    width: 240, height: 60, ...overrides,
  });
}

export function documentWithTextPreview(doc, draft) {
  if (!draft || draft.document !== doc) return doc;
  if (draft.originalId && !doc.layers.some(layer => layer.id === draft.originalId)) return doc;
  return {
    ...doc,
    layers: draft.originalId
      ? doc.layers.map(layer => layer.id === draft.originalId ? draft.layer : layer)
      : [...doc.layers, draft.layer],
  };
}

export function createShapeLayer(overrides = {}) {
  return baseLayer('shape', {
    name: 'Фигура', shape: 'rect', fill: '#4f8cff', stroke: 'transparent', strokeWidth: 0, lineFlip: false, lineMode: 'diag', pathPoints: [], pathClosed: false,
    width: 180, height: 120, radius: 0, ...overrides,
  });
}


export function createLayerGroup(overrides = {}) {
  return {
    id: uid('group'),
    name: 'Новая группа',
    visible: true,
    locked: false,
    collapsed: false,
    ...overrides,
  };
}

export function layerGroup(doc, layer) {
  if (!layer?.groupId || !Array.isArray(doc?.groups)) return null;
  return doc.groups.find(group => group.id === layer.groupId) ?? null;
}

export function isLayerVisible(doc, layer) {
  if (!layer || layer.visible === false) return false;
  const group = layerGroup(doc, layer);
  return group ? group.visible !== false : true;
}

export function isLayerLocked(doc, layer) {
  if (!layer) return false;
  if (layer.locked) return true;
  return Boolean(layerGroup(doc, layer)?.locked);
}

export function addLayerGroup(doc, group = createLayerGroup()) {
  if (!Array.isArray(doc.groups)) doc.groups = [];
  doc.groups.push(group);
  touch(doc);
  return group;
}

export function removeLayerGroup(doc, groupId) {
  if (!Array.isArray(doc.groups)) return null;
  const index = doc.groups.findIndex(group => group.id === groupId);
  if (index < 0) return null;
  if (doc.groups[index]?.locked) return null;
  const [removed] = doc.groups.splice(index, 1);
  for (const layer of doc.layers) {
    if (layer.groupId === groupId) layer.groupId = null;
  }
  touch(doc);
  return removed;
}

export function moveLayerIntoGroup(doc, layerId, groupId) {
  const layer = doc.layers.find(item => item.id === layerId);
  if (!layer || isLayerLocked(doc, layer)) return false;
  const targetGroup = groupId != null ? doc.groups?.find(group => group.id === groupId) : null;
  if (groupId != null && !targetGroup) return false;
  if (targetGroup?.locked) return false;
  const oldGroupId = layer.groupId ?? null;
  if (oldGroupId === (groupId ?? null)) return false;

  const sourceIndex = doc.layers.findIndex(item => item.id === layerId);
  doc.layers.splice(sourceIndex, 1);
  layer.groupId = groupId ?? null;

  if (groupId == null) {
    doc.layers.splice(Math.min(sourceIndex, doc.layers.length), 0, layer);
  } else {
    let lastMemberIndex = -1;
    for (let i = 0; i < doc.layers.length; i += 1) {
      if (doc.layers[i].groupId === groupId) lastMemberIndex = i;
    }
    const insertIndex = lastMemberIndex >= 0 ? lastMemberIndex + 1 : doc.layers.length;
    doc.layers.splice(insertIndex, 0, layer);
  }
  touch(doc);
  return true;
}

export function selectedLayer(doc) {
  return doc.layers.find(layer => layer.id === doc.selectedLayerId) ?? null;
}

export function addLayer(doc, layer, { select = true } = {}) {
  doc.layers.push(layer);
  if (select) doc.selectedLayerId = layer.id;
  touch(doc);
  return layer;
}

export function removeLayer(doc, id = doc.selectedLayerId) {
  const index = doc.layers.findIndex(layer => layer.id === id);
  if (index < 0) return null;
  const layer = doc.layers[index];
  if (isLayerLocked(doc, layer)) return null;
  const [removed] = doc.layers.splice(index, 1);
  if (doc.selectedLayerId === id) {
    doc.selectedLayerId = doc.layers[Math.min(index, doc.layers.length - 1)]?.id ?? null;
  }
  touch(doc);
  return removed;
}

export function duplicateLayer(doc, id = doc.selectedLayerId) {
  const source = doc.layers.find(layer => layer.id === id);
  if (!source || isLayerLocked(doc, source)) return null;
  const copy = structuredClone(source);
  copy.id = uid(source.type);
  copy.name = `${source.name} копия`;
  copy.x += 18;
  copy.y += 18;
  const index = doc.layers.findIndex(layer => layer.id === id);
  doc.layers.splice(index + 1, 0, copy);
  doc.selectedLayerId = copy.id;
  touch(doc);
  return copy;
}

export function moveLayer(doc, id, direction) {
  const index = doc.layers.findIndex(layer => layer.id === id);
  if (index < 0 || !direction) return false;
  const layer = doc.layers[index];
  if (isLayerLocked(doc, layer)) return false;
  const groupId = layer.groupId ?? null;
  const step = direction < 0 ? -1 : 1;

  if (groupId) {
    let siblingIndex = index + step;
    while (siblingIndex >= 0 && siblingIndex < doc.layers.length && (doc.layers[siblingIndex].groupId ?? null) !== groupId) {
      siblingIndex += step;
    }
    if (siblingIndex < 0 || siblingIndex >= doc.layers.length) return false;
    [doc.layers[index], doc.layers[siblingIndex]] = [doc.layers[siblingIndex], doc.layers[index]];
    touch(doc);
    return true;
  }

  const adjacentIndex = index + step;
  if (adjacentIndex < 0 || adjacentIndex >= doc.layers.length) return false;
  const adjacentGroupId = doc.layers[adjacentIndex].groupId ?? null;
  if (!adjacentGroupId) {
    [doc.layers[index], doc.layers[adjacentIndex]] = [doc.layers[adjacentIndex], doc.layers[index]];
    touch(doc);
    return true;
  }

  doc.layers.splice(index, 1);
  if (step > 0) {
    let blockEnd = index;
    while (blockEnd < doc.layers.length && (doc.layers[blockEnd].groupId ?? null) === adjacentGroupId) blockEnd += 1;
    doc.layers.splice(blockEnd, 0, layer);
  } else {
    let blockStart = adjacentIndex;
    while (blockStart > 0 && (doc.layers[blockStart - 1].groupId ?? null) === adjacentGroupId) blockStart -= 1;
    doc.layers.splice(blockStart, 0, layer);
  }
  touch(doc);
  return true;
}

export function moveLayerToIndex(doc, id, targetIndex) {
  const index = doc.layers.findIndex(layer => layer.id === id);
  if (index < 0 || !doc.layers.length) return false;
  if (isLayerLocked(doc, doc.layers[index])) return false;
  const boundedIndex = clamp(Math.trunc(targetIndex), 0, doc.layers.length - 1);
  if (index === boundedIndex) return false;
  const [layer] = doc.layers.splice(index, 1);
  doc.layers.splice(clamp(boundedIndex, 0, doc.layers.length), 0, layer);
  touch(doc);
  return true;
}

export function touch(doc) { doc.modifiedAt = new Date().toISOString(); }

export function snapshotDocument(doc) {
  return JSON.stringify(doc);
}

function validateProjectVersion(input, { allowMissing = false } = {}) {
  const rawVersion = input?.version;
  if (allowMissing && rawVersion == null) return PROJECT_VERSION;
  const version = Number(rawVersion);
  if (!Number.isInteger(version) || version !== PROJECT_VERSION) {
    const label = rawVersion == null ? 'не указана' : String(rawVersion).slice(0, 40);
    throw new Error(`Неподдерживаемая версия проекта: ${label}. Ожидается версия ${PROJECT_VERSION}.`);
  }
  return version;
}

export function restoreDocument(snapshot) {
  const doc = JSON.parse(snapshot);
  if (!doc || !Array.isArray(doc.layers)) throw new Error('Неподдерживаемый файл проекта');
  validateProjectVersion(doc);
  if (!Array.isArray(doc.groups)) doc.groups = [];
  const validGroupIds = new Set(doc.groups.map(group => group?.id).filter(Boolean));
  for (const layer of doc.layers) {
    if (!validGroupIds.has(layer?.groupId)) layer.groupId = null;
  }
  return doc;
}

export function sanitizeFilters(filters = {}) {
  const result = {};
  for (const [key, fallback] of Object.entries(DEFAULT_LAYER_FILTERS)) {
    const [min, max] = FILTER_RANGES[key];
    result[key] = bounded(filters?.[key], fallback, min, max);
  }
  return result;
}

function sanitizeLayer(layer, usedIds, validGroupIds = new Set()) {
  const type = ['raster', 'text', 'shape'].includes(layer?.type) ? layer.type : 'shape';
  const defaults = baseLayer(type);
  let id = shortText(layer?.id, defaults.id, 160).trim() || defaults.id;
  if (usedIds.has(id)) id = uid(type);
  usedIds.add(id);
  const result = {
    ...defaults,
    ...layer,
    id,
    type,
    name: shortText(layer?.name, defaults.name, 240),
    visible: layer?.visible !== false,
    locked: Boolean(layer?.locked),
    opacity: bounded(layer?.opacity, 1, 0, 1),
    blendMode: BLEND_MODES.has(layer?.blendMode) ? layer.blendMode : 'source-over',
    x: bounded(layer?.x, 0, -MAX_LAYER_POSITION, MAX_LAYER_POSITION),
    y: bounded(layer?.y, 0, -MAX_LAYER_POSITION, MAX_LAYER_POSITION),
    width: bounded(layer?.width, 1, 1, 12000),
    height: bounded(layer?.height, 1, 1, 12000),
    scaleX: bounded(layer?.scaleX, 1, MIN_LAYER_SCALE, MAX_LAYER_SCALE),
    scaleY: bounded(layer?.scaleY, 1, MIN_LAYER_SCALE, MAX_LAYER_SCALE),
    rotation: ((finite(layer?.rotation, 0) % 360) + 360) % 360,
    filters: sanitizeFilters(layer?.filters),
    styles: sanitizeLayerStyles(layer?.styles),
    groupId: validGroupIds.has(layer?.groupId) ? layer.groupId : null,
  };
  if (type === 'raster') {
    checkedCanvasSize(result.width, result.height, `Растровый слой «${result.name || 'Без имени'}»`);
    const dataUrl = typeof layer?.dataUrl === 'string' && /^data:image\//i.test(layer.dataUrl) ? layer.dataUrl : null;
    result.dataUrl = dataUrl;
  } else if (type === 'text') {
    result.text = shortText(layer?.text, 'Текст', 100000);
    result.color = shortText(layer?.color, '#ffffff', 64);
    result.fontSize = bounded(layer?.fontSize, 48, 6, 500);
    result.fontFamily = shortText(layer?.fontFamily, 'Inter, Arial, sans-serif', 240);
    result.fontData = typeof layer?.fontData === 'string' && layer.fontData.length <= 7_000_000 && /^data:font\/(woff2?|ttf|otf);base64,[a-z\d+/=]+$/i.test(layer.fontData) ? layer.fontData : null;
    result.fontLabel = result.fontData ? shortText(layer?.fontLabel, '', 160) : '';
    result.fontWeight = ['400', '700'].includes(String(layer?.fontWeight)) ? String(layer.fontWeight) : '400';
    result.fontStyle = layer?.fontStyle === 'italic' ? 'italic' : 'normal';
    result.align = ['left', 'center', 'right'].includes(layer?.align) ? layer.align : 'left';
    result.lineHeight = bounded(layer?.lineHeight, 1.18, 0.8, 3);
    result.letterSpacing = bounded(layer?.letterSpacing, 0, -5, 20);
    result.underline = layer?.underline === true;
    result.strikeThrough = layer?.strikeThrough === true;
  } else {
    result.shape = ['rect', 'ellipse', 'line', 'path'].includes(layer?.shape) ? layer.shape : 'rect';
    result.fill = shortText(layer?.fill, '#4f8cff', 64);
    result.stroke = shortText(layer?.stroke, 'transparent', 64);
    result.strokeWidth = bounded(layer?.strokeWidth, 0, 0, 1000);
    result.radius = bounded(layer?.radius, 0, 0, 6000);
    result.lineFlip = Boolean(layer?.lineFlip);
    result.lineMode = ['diag','horizontal','vertical'].includes(layer?.lineMode) ? layer.lineMode : 'diag';
    result.pathPoints = result.shape === 'path' && Array.isArray(layer?.pathPoints)
      ? layer.pathPoints.slice(0,5000).map(point=>({x:bounded(point?.x,0,-120000,120000),y:bounded(point?.y,0,-120000,120000)}))
      : [];
    result.pathClosed = result.shape === 'path' && Boolean(layer?.pathClosed);
  }
  return result;
}

function sanitizeGroup(group, usedIds) {
  const defaults = createLayerGroup();
  let id = shortText(group?.id, defaults.id, 160).trim() || defaults.id;
  if (usedIds.has(id)) id = uid('group');
  usedIds.add(id);
  return {
    id,
    name: shortText(group?.name, defaults.name, 240).trim() || defaults.name,
    visible: group?.visible !== false,
    locked: Boolean(group?.locked),
    collapsed: Boolean(group?.collapsed),
  };
}

export function sanitizeProject(input) {
  if (!input || typeof input !== 'object') throw new Error('Некорректный проект');
  validateProjectVersion(input, { allowMissing: true });
  if (!Number.isFinite(Number(input.width)) || !Number.isFinite(Number(input.height))) throw new Error('Некорректный размер документа');
  const doc = structuredClone(input);
  doc.version = PROJECT_VERSION;
  doc.name = shortText(doc.name, 'Без имени', 240);
  const size = checkedCanvasSize(Number(doc.width), Number(doc.height), 'Проект');
  doc.width = size.width;
  doc.height = size.height;
  doc.background = shortText(doc.background, 'transparent', 64) || 'transparent';
  const usedGroupIds = new Set();
  doc.groups = Array.isArray(doc.groups) ? doc.groups.slice(0, 100).map(group => sanitizeGroup(group, usedGroupIds)) : [];
  const validGroupIds = new Set(doc.groups.map(group => group.id));
  const usedIds = new Set();
  doc.layers = Array.isArray(doc.layers) ? doc.layers.slice(0, 500).map(layer => sanitizeLayer(layer, usedIds, validGroupIds)) : [];
  if (!doc.layers.some(l => l.id === doc.selectedLayerId)) doc.selectedLayerId = doc.layers.at(-1)?.id ?? null;
  doc.createdAt = typeof doc.createdAt === 'string' ? doc.createdAt : new Date().toISOString();
  doc.modifiedAt = typeof doc.modifiedAt === 'string' ? doc.modifiedAt : new Date().toISOString();
  return doc;
}