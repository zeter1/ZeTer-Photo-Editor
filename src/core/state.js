import { clamp } from './geometry.js';
import { sanitizeLayerStyles } from './layer-styles.js';

let layerCounter = 0;
const uid = (prefix = 'layer') => `${prefix}-${Date.now().toString(36)}-${(++layerCounter).toString(36)}`;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bounded = (value, fallback, min, max) => clamp(finite(value, fallback), min, max);
const shortText = (value, fallback = '', max = 500) => String(value ?? fallback).slice(0, max);
const BLEND_MODES = new Set(['source-over','multiply','screen','overlay','darken','lighten','color-dodge','color-burn']);
const GROUP_BLEND_MODES = new Set(['pass-through', ...BLEND_MODES]);
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
export const MAX_ICC_PROFILE_DATA_URL = 5_700_000;

export function imageResizeTransforms(layers, sx, sy) {
  return layers.map(layer => {
    if (layer?.type === 'adjustment') return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
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
    colorProfile: null,
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
    name: type === 'raster' ? 'Растровый слой' : type === 'text' ? 'Текст' : type === 'adjustment' ? 'Корректирующий слой' : type === 'smart-object' ? 'Смарт-объект' : 'Фигура',
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
    mask: null,
    vectorMask: null,
    groupId: null,
    ...overrides,
  };
}

export function createRasterLayer(overrides = {}) {
  return baseLayer('raster', { dataUrl: null, ...overrides });
}

export function createSmartObjectLayer(overrides = {}) {
  return baseLayer('smart-object', {
    name: 'Смарт-объект',
    previewDataUrl: null,
    embeddedDocument: null,
    ...overrides,
  });
}

export function createAdjustmentLayer(overrides = {}) {
  return baseLayer('adjustment', {
    name: 'Корректирующий слой',
    width: 1,
    height: 1,
    ...overrides,
  });
}

export function createLayerMask(overrides = {}) {
  return {
    enabled: true,
    dataUrl: null,
    ...overrides,
  };
}

export function createVectorMask(overrides = {}) {
  return {
    enabled: true,
    invert: false,
    subpaths: [],
    ...overrides,
  };
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
    opacity: 1,
    blendMode: 'pass-through',
    parentGroupId: null,
    ...overrides,
  };
}

function normalizeGroupParents(groups) {
  if (!Array.isArray(groups)) return groups;
  const byId = new Map(groups.map(group => [group?.id, group]).filter(([id]) => Boolean(id)));
  for (const group of groups) {
    const parentId = typeof group?.parentGroupId === 'string' ? group.parentGroupId : null;
    group.parentGroupId = parentId && parentId !== group.id && byId.has(parentId) ? parentId : null;
  }
  for (const group of groups) {
    const seen = new Set([group.id]);
    let current = group;
    while (current?.parentGroupId) {
      const parent = byId.get(current.parentGroupId);
      if (!parent) {
        current.parentGroupId = null;
        break;
      }
      if (seen.has(parent.id)) {
        group.parentGroupId = null;
        break;
      }
      seen.add(parent.id);
      current = parent;
    }
  }
  return groups;
}

export function layerGroup(doc, layer) {
  if (!layer?.groupId || !Array.isArray(doc?.groups)) return null;
  return doc.groups.find(group => group.id === layer.groupId) ?? null;
}

function groupChain(doc, group) {
  if (!group || !Array.isArray(doc?.groups)) return [];
  const byId = new Map(doc.groups.map(item => [item.id, item]));
  const chain = [];
  const seen = new Set();
  let current = typeof group === 'string' ? byId.get(group) : group;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentGroupId ? byId.get(current.parentGroupId) : null;
  }
  return chain;
}

export function groupDepth(doc, group) {
  return Math.max(0, groupChain(doc, group).length - 1);
}

export function isGroupVisible(doc, group) {
  const chain = groupChain(doc, group);
  return chain.length ? chain.every(item => item.visible !== false) : true;
}

export function isGroupLocked(doc, group) {
  return groupChain(doc, group).some(item => Boolean(item.locked));
}

export function isGroupWithin(doc, groupId, ancestorGroupId) {
  if (!groupId || !ancestorGroupId) return false;
  return groupChain(doc, groupId).some(group => group.id === ancestorGroupId);
}

export function isLayerVisible(doc, layer) {
  if (!layer || layer.visible === false) return false;
  const group = layerGroup(doc, layer);
  return group ? isGroupVisible(doc, group) : true;
}

export function isLayerLocked(doc, layer) {
  if (!layer) return false;
  if (layer.locked) return true;
  const group = layerGroup(doc, layer);
  return group ? isGroupLocked(doc, group) : false;
}

export function addLayerGroup(doc, group = createLayerGroup()) {
  if (!Array.isArray(doc.groups)) doc.groups = [];
  if (group.parentGroupId && !doc.groups.some(item => item.id === group.parentGroupId)) group.parentGroupId = null;
  doc.groups.push(group);
  normalizeGroupParents(doc.groups);
  touch(doc);
  return group;
}

export function moveLayerGroupIntoGroup(doc, groupId, parentGroupId) {
  if (!Array.isArray(doc?.groups)) return false;
  const group = doc.groups.find(item => item.id === groupId);
  const parent = parentGroupId != null ? doc.groups.find(item => item.id === parentGroupId) : null;
  if (!group || (parentGroupId != null && !parent)) return false;
  if (isGroupLocked(doc, group) || (parent && isGroupLocked(doc, parent))) return false;
  if (parent?.id === group.id || (parent && isGroupWithin(doc, parent.id, group.id))) return false;
  const nextParentId = parent?.id ?? null;
  if ((group.parentGroupId ?? null) === nextParentId) return false;
  group.parentGroupId = nextParentId;
  normalizeGroupParents(doc.groups);
  touch(doc);
  return true;
}

export function removeLayerGroup(doc, groupId) {
  if (!Array.isArray(doc.groups)) return null;
  const index = doc.groups.findIndex(group => group.id === groupId);
  if (index < 0) return null;
  const target = doc.groups[index];
  if (isGroupLocked(doc, target)) return null;
  const parentGroupId = target.parentGroupId ?? null;
  const [removed] = doc.groups.splice(index, 1);
  for (const layer of doc.layers) {
    if (layer.groupId === groupId) layer.groupId = parentGroupId;
  }
  for (const group of doc.groups) {
    if (group.parentGroupId === groupId) group.parentGroupId = parentGroupId;
  }
  normalizeGroupParents(doc.groups);
  touch(doc);
  return removed;
}

export function moveLayerIntoGroup(doc, layerId, groupId) {
  const layer = doc.layers.find(item => item.id === layerId);
  if (!layer || isLayerLocked(doc, layer)) return false;
  const targetGroup = groupId != null ? doc.groups?.find(group => group.id === groupId) : null;
  if (groupId != null && !targetGroup) return false;
  if (targetGroup && isGroupLocked(doc, targetGroup)) return false;
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
      if (isGroupWithin(doc, doc.layers[i].groupId, groupId)) lastMemberIndex = i;
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
  if (copy.type === 'adjustment') {
    copy.x = 0; copy.y = 0; copy.scaleX = 1; copy.scaleY = 1; copy.rotation = 0;
  } else {
    copy.x += 18;
    copy.y += 18;
  }
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
  for (const group of doc.groups) if (!('parentGroupId' in group)) group.parentGroupId = null;
  normalizeGroupParents(doc.groups);
  doc.colorProfile = sanitizeColorProfile(doc.colorProfile);
  const validGroupIds = new Set(doc.groups.map(group => group?.id).filter(Boolean));
  for (const layer of doc.layers) {
    if (!validGroupIds.has(layer?.groupId)) layer.groupId = null;
  }
  return doc;
}


export function sanitizeColorProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  const untagged = profile.untagged === true;
  if (profile.kind === 'untagged') return { kind:'untagged', untagged:true };
  if (profile.kind !== 'icc') return untagged ? { kind:'untagged', untagged:true } : null;
  const dataUrl = typeof profile.dataUrl === 'string' &&
    profile.dataUrl.length <= MAX_ICC_PROFILE_DATA_URL &&
    /^data:application\/(?:vnd\.iccprofile|octet-stream);base64,[a-z\d+/=]+$/i.test(profile.dataUrl)
      ? profile.dataUrl
      : null;
  if (!dataUrl) return untagged ? { kind:'untagged', untagged:true } : null;
  return {
    kind:'icc',
    untagged,
    dataUrl,
    name:shortText(profile.name,'',240),
    version:shortText(profile.version,'',32),
    deviceClass:shortText(profile.deviceClass,'',16),
    colorSpace:shortText(profile.colorSpace,'',16),
    pcs:shortText(profile.pcs,'',16),
    signatureValid:profile.signatureValid === true,
  };
}

export function sanitizeFilters(filters = {}) {
  const result = {};
  for (const [key, fallback] of Object.entries(DEFAULT_LAYER_FILTERS)) {
    const [min, max] = FILTER_RANGES[key];
    result[key] = bounded(filters?.[key], fallback, min, max);
  }
  return result;
}

export function sanitizeLayerMask(mask) {
  if (!mask || typeof mask !== 'object' || Array.isArray(mask)) return null;
  const dataUrl = typeof mask.dataUrl === 'string' && /^data:image\//i.test(mask.dataUrl) ? mask.dataUrl : null;
  return createLayerMask({
    enabled: mask.enabled !== false,
    dataUrl,
  });
}

function sanitizePathHandle(handle) {
  if (!handle || typeof handle !== 'object' || Array.isArray(handle)) return null;
  return {
    x: bounded(handle.x, 0, -MAX_LAYER_POSITION, MAX_LAYER_POSITION),
    y: bounded(handle.y, 0, -MAX_LAYER_POSITION, MAX_LAYER_POSITION),
  };
}

export function sanitizePathPoint(point) {
  return {
    x: bounded(point?.x, 0, -MAX_LAYER_POSITION, MAX_LAYER_POSITION),
    y: bounded(point?.y, 0, -MAX_LAYER_POSITION, MAX_LAYER_POSITION),
    handleIn: sanitizePathHandle(point?.handleIn),
    handleOut: sanitizePathHandle(point?.handleOut),
    kind: point?.kind === 'smooth' ? 'smooth' : 'corner',
  };
}

const VECTOR_MASK_OPERATIONS = new Set(['add','subtract','intersect','exclude']);

export function sanitizeVectorMask(mask) {
  if (!mask || typeof mask !== 'object' || Array.isArray(mask)) return null;
  const subpaths = (Array.isArray(mask.subpaths) ? mask.subpaths : [])
    .slice(0, 128)
    .map(subpath => {
      const points = (Array.isArray(subpath?.points) ? subpath.points : [])
        .slice(0, 2000)
        .map(sanitizePathPoint);
      if (points.length < 3) return null;
      return {
        operation: VECTOR_MASK_OPERATIONS.has(subpath?.operation) ? subpath.operation : 'add',
        closed: true,
        points,
      };
    })
    .filter(Boolean);
  if (!subpaths.length) return null;
  return createVectorMask({
    enabled: mask.enabled !== false,
    invert: mask.invert === true,
    subpaths,
  });
}

const MAX_EMBEDDED_DOCUMENT_DEPTH = 3;

function sanitizeLayer(layer, usedIds, validGroupIds = new Set(), embeddedDepth = 0) {
  const type = ['raster', 'text', 'shape', 'adjustment', 'smart-object'].includes(layer?.type) ? layer.type : 'shape';
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
    styles: type === 'adjustment' ? null : sanitizeLayerStyles(layer?.styles),
    mask: sanitizeLayerMask(layer?.mask),
    vectorMask: sanitizeVectorMask(layer?.vectorMask),
    groupId: validGroupIds.has(layer?.groupId) ? layer.groupId : null,
  };
  if (type === 'raster') {
    checkedCanvasSize(result.width, result.height, `Растровый слой «${result.name || 'Без имени'}»`);
    const dataUrl = typeof layer?.dataUrl === 'string' && /^data:image\//i.test(layer.dataUrl) ? layer.dataUrl : null;
    result.dataUrl = dataUrl;
  } else if (type === 'smart-object') {
    checkedCanvasSize(result.width, result.height, `Смарт-объект «${result.name || 'Без имени'}»`);
    result.previewDataUrl = typeof layer?.previewDataUrl === 'string' && /^data:image\//i.test(layer.previewDataUrl) ? layer.previewDataUrl : null;
    if (embeddedDepth >= MAX_EMBEDDED_DOCUMENT_DEPTH) {
      result.embeddedDocument = null;
    } else if (layer?.embeddedDocument && typeof layer.embeddedDocument === 'object' && !Array.isArray(layer.embeddedDocument)) {
      result.embeddedDocument = sanitizeProjectInternal(layer.embeddedDocument, { allowMissingVersion: true, embeddedDepth: embeddedDepth + 1 });
    } else {
      result.embeddedDocument = null;
    }
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
  } else if (type === 'adjustment') {
    result.x = 0;
    result.y = 0;
    result.scaleX = 1;
    result.scaleY = 1;
    result.rotation = 0;
  } else {
    result.shape = ['rect', 'ellipse', 'line', 'path'].includes(layer?.shape) ? layer.shape : 'rect';
    result.fill = shortText(layer?.fill, '#4f8cff', 64);
    result.stroke = shortText(layer?.stroke, 'transparent', 64);
    result.strokeWidth = bounded(layer?.strokeWidth, 0, 0, 1000);
    result.radius = bounded(layer?.radius, 0, 0, 6000);
    result.lineFlip = Boolean(layer?.lineFlip);
    result.lineMode = ['diag','horizontal','vertical'].includes(layer?.lineMode) ? layer.lineMode : 'diag';
    result.pathPoints = result.shape === 'path' && Array.isArray(layer?.pathPoints)
      ? layer.pathPoints.slice(0,5000).map(sanitizePathPoint)
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
    opacity: bounded(group?.opacity, 1, 0, 1),
    blendMode: GROUP_BLEND_MODES.has(group?.blendMode) ? group.blendMode : 'pass-through',
    parentGroupId: typeof group?.parentGroupId === 'string' ? shortText(group.parentGroupId, '', 160).trim() || null : null,
  };
}

function sanitizeProjectInternal(input, { allowMissingVersion = true, embeddedDepth = 0 } = {}) {
  if (!input || typeof input !== 'object') throw new Error('Некорректный проект');
  validateProjectVersion(input, { allowMissing: allowMissingVersion });
  if (!Number.isFinite(Number(input.width)) || !Number.isFinite(Number(input.height))) throw new Error('Некорректный размер документа');
  const doc = structuredClone(input);
  doc.version = PROJECT_VERSION;
  doc.name = shortText(doc.name, 'Без имени', 240);
  const size = checkedCanvasSize(Number(doc.width), Number(doc.height), embeddedDepth ? 'Встроенный документ' : 'Проект');
  doc.width = size.width;
  doc.height = size.height;
  doc.background = shortText(doc.background, 'transparent', 64) || 'transparent';
  doc.colorProfile = sanitizeColorProfile(doc.colorProfile);
  const usedGroupIds = new Set();
  doc.groups = Array.isArray(doc.groups) ? doc.groups.slice(0, 100).map(group => sanitizeGroup(group, usedGroupIds)) : [];
  normalizeGroupParents(doc.groups);
  const validGroupIds = new Set(doc.groups.map(group => group.id));
  const usedIds = new Set();
  doc.layers = Array.isArray(doc.layers)
    ? doc.layers.slice(0, 500).map(layer => sanitizeLayer(layer, usedIds, validGroupIds, embeddedDepth))
    : [];
  if (!doc.layers.some(l => l.id === doc.selectedLayerId)) doc.selectedLayerId = doc.layers.at(-1)?.id ?? null;
  doc.createdAt = typeof doc.createdAt === 'string' ? doc.createdAt : new Date().toISOString();
  doc.modifiedAt = typeof doc.modifiedAt === 'string' ? doc.modifiedAt : new Date().toISOString();
  return doc;
}

export function sanitizeProject(input) {
  return sanitizeProjectInternal(input, { allowMissingVersion: true, embeddedDepth: 0 });
}