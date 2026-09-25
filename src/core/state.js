import { clamp } from './geometry.js';
import { sanitizeLayerStyles } from './layer-styles.js';
import { sanitizeSerializedPixelBufferSource } from './pixel-buffer.js';
import { sanitizeAdjustmentModel } from './adjustments.js';

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
export const MAX_SMART_FILTERS = 24;
const MAX_PSD_TEXT_DATA_URL_CHARS = 22_500_000;

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
    proofProfile: null,
    displayProfile: null,
    colorManagement: sanitizeColorManagement(),
    psdLinkedLayerBlocks: [],
    psdSmartObjectSourceCount: 0,
    paths: [],
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
    clipping: false,
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
  return baseLayer('raster', { dataUrl: null, highDepthSource: null, highDepthPreview: null, ...overrides });
}

export function createSmartObjectLayer(overrides = {}) {
  return baseLayer('smart-object', {
    name: 'Смарт-объект',
    previewDataUrl: null,
    embeddedDocument: null,
    smartFilters: [],
    smartFilterMask: null,
    linkedSourceId: null,
    psdSmartObject: null,
    ...overrides,
  });
}

export function createSmartObjectLinkId() {
  return uid('smart-link');
}

export function linkedSmartObjectLayers(doc, linkedSourceId) {
  const sourceId = shortText(linkedSourceId, '', 160).trim();
  if (!sourceId) return [];
  return (Array.isArray(doc?.layers) ? doc.layers : []).filter(layer => layer?.type === 'smart-object' && layer.linkedSourceId === sourceId);
}

export function createSmartFilter(overrides = {}) {
  return {
    id: uid('smart-filter'),
    name: 'Смарт-фильтр',
    enabled: true,
    filters: { ...DEFAULT_LAYER_FILTERS },
    ...overrides,
  };
}

export function createSmartFilterMask(overrides = {}) {
  return {
    enabled: true,
    dataUrl: null,
    invert: false,
    density: 1,
    feather: 0,
    ...overrides,
  };
}

export function createAdjustmentLayer(overrides = {}) {
  return baseLayer('adjustment', {
    name: 'Корректирующий слой',
    adjustment: null,
    psdAdjustment: null,
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
    linked: true,
    fillStartsWithAllPixels: false,
    subpaths: [],
    ...overrides,
  };
}

export function createTextLayer(overrides = {}) {
  return baseLayer('text', {
    name: 'Текст', text: 'Текст', color: '#ffffff', fontSize: 48, fontFamily: 'Inter, Arial, sans-serif',
    fontWeight: '400', fontStyle: 'normal', align: 'left', lineHeight: 1.18,
    letterSpacing: 0, underline: false, strikeThrough: false,
    fontData: null, fontLabel: '', psdText: null,
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
    name: 'Фигура', shape: 'rect', fill: '#4f8cff', stroke: 'transparent', strokeWidth: 0, lineFlip: false, lineMode: 'diag', pathPoints: [], pathClosed: false, psdShape: null,
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
  doc.proofProfile = sanitizeColorProfile(doc.proofProfile);
  doc.displayProfile = sanitizeColorProfile(doc.displayProfile);
  doc.colorManagement = sanitizeColorManagement(doc.colorManagement);
  const validGroupIds = new Set(doc.groups.map(group => group?.id).filter(Boolean));
  for (const layer of doc.layers) {
    if (!validGroupIds.has(layer?.groupId)) layer.groupId = null;
  }
  return doc;
}


export const COLOR_RENDERING_INTENTS = Object.freeze(['perceptual','relative','saturation','absolute']);
export const COLOR_DISPLAY_SPACES = Object.freeze(['srgb']);
export const DEFAULT_COLOR_MANAGEMENT = Object.freeze({
  renderingIntent:'perceptual',
  proofRenderingIntent:'relative',
  displaySpace:'srgb',
  softProofEnabled:false,
  blackPointCompensation:true,
  gamutWarningEnabled:false,
  gamutWarningThreshold:3,
});

export function sanitizeColorManagement(value = {}) {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return {
    renderingIntent:COLOR_RENDERING_INTENTS.includes(source.renderingIntent)?source.renderingIntent:DEFAULT_COLOR_MANAGEMENT.renderingIntent,
    proofRenderingIntent:COLOR_RENDERING_INTENTS.includes(source.proofRenderingIntent)?source.proofRenderingIntent:DEFAULT_COLOR_MANAGEMENT.proofRenderingIntent,
    displaySpace:COLOR_DISPLAY_SPACES.includes(source.displaySpace)?source.displaySpace:DEFAULT_COLOR_MANAGEMENT.displaySpace,
    softProofEnabled:source.softProofEnabled===true,
    blackPointCompensation:source.blackPointCompensation!==false,
    gamutWarningEnabled:source.gamutWarningEnabled===true,
    gamutWarningThreshold:Math.round(bounded(source.gamutWarningThreshold,DEFAULT_COLOR_MANAGEMENT.gamutWarningThreshold,.5,20)*10)/10,
  };
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

const HIGH_DEPTH_TONE_MAPS = new Set(['auto','clip','aces']);

export function sanitizeHighDepthPreview(value = {}) {
  const toneMap = HIGH_DEPTH_TONE_MAPS.has(value?.toneMap) ? value.toneMap : 'auto';
  return {
    toneMap,
    displayExposure: bounded(value?.displayExposure, 0, -6, 6),
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

export function sanitizeSmartFilters(value = []) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, MAX_SMART_FILTERS).map((item,index) => {
    let id = shortText(item?.id, '', 160).trim();
    if (!id || seen.has(id)) id = uid('smart-filter');
    seen.add(id);
    return createSmartFilter({
      id,
      name: shortText(item?.name, `Смарт-фильтр ${index + 1}`, 160).trim() || `Смарт-фильтр ${index + 1}`,
      enabled: item?.enabled !== false,
      filters: sanitizeFilters(item?.filters),
    });
  });
}

export function sanitizeSmartFilterMask(mask) {
  if (!mask || typeof mask !== 'object' || Array.isArray(mask)) return null;
  const dataUrl = typeof mask.dataUrl === 'string' && /^data:image\//i.test(mask.dataUrl) ? mask.dataUrl : null;
  return createSmartFilterMask({
    enabled: mask.enabled !== false,
    dataUrl,
    invert: Boolean(mask.invert),
    density: bounded(mask.density, 1, 0, 1),
    feather: bounded(mask.feather, 0, 0, 250),
  });
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
        closed: subpath?.closed !== false,
        fillRule: subpath?.fillRule === 'even-odd' ? 'even-odd' : 'non-zero',
        points,
      };
    })
    .filter(Boolean);
  if (!subpaths.length) return null;
  return createVectorMask({
    enabled: mask.enabled !== false,
    invert: mask.invert === true,
    linked: mask.linked !== false,
    fillStartsWithAllPixels: mask.fillStartsWithAllPixels === true,
    subpaths,
  });
}

function sanitizeDocumentPath(path, index, usedIds) {
  if (!path || typeof path !== 'object' || Array.isArray(path)) return null;
  let id = Number.isInteger(path.id) && path.id >= 2000 && path.id <= 2997 ? path.id : null;
  if (id !== null && usedIds.has(id)) id = null;
  if (id !== null) usedIds.add(id);
  const subpaths = (Array.isArray(path.subpaths) ? path.subpaths : [])
    .slice(0, 128)
    .map(subpath => {
      const points = (Array.isArray(subpath?.points) ? subpath.points : [])
        .slice(0, 2000)
        .map(sanitizePathPoint);
      if (points.length < 2) return null;
      return {
        operation: VECTOR_MASK_OPERATIONS.has(subpath?.operation) ? subpath.operation : 'add',
        closed: subpath?.closed !== false,
        fillRule: subpath?.fillRule === 'even-odd' ? 'even-odd' : 'non-zero',
        points,
      };
    })
    .filter(Boolean);
  if (!subpaths.length) return null;
  return {
    id,
    name: shortText(path.name, `Path ${index + 1}`, 240).trim() || `Path ${index + 1}`,
    fillStartsWithAllPixels: path.fillStartsWithAllPixels === true,
    subpaths,
  };
}

const PSD_SMART_OBJECT_BLOCK_KEYS = new Set(['PlLd','SoLd','SoLE']);
const PSD_LINKED_LAYER_BLOCK_KEYS = new Set(['lnk2','lnkD','lnkE']);
const MAX_PSD_SMART_OBJECT_DATA_URL_CHARS = 12_000_000;
const MAX_PSD_LINKED_LAYER_DATA_URL_CHARS = 64_000_000;
const MAX_PSD_LINKED_LAYER_TOTAL_CHARS = 70_000_000;

function sanitizePsdOpaqueBlock(block,allowedKeys,maxDataUrlChars) {
  if(!block||typeof block!=='object'||Array.isArray(block))return null;
  const key=shortText(block.key,'',4);
  if(!allowedKeys.has(key))return null;
  const signature=block.signature==='8B64'?'8B64':'8BIM';
  const dataUrl=typeof block.dataUrl==='string'&&block.dataUrl.length<=maxDataUrlChars&&/^data:application\/octet-stream;base64,[a-z\d+/=]*$/i.test(block.dataUrl)
    ? block.dataUrl
    : null;
  if(!dataUrl)return null;
  return{signature,key,dataUrl};
}

export function sanitizePsdSmartObject(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const blocks=(Array.isArray(value.blocks)?value.blocks:[])
    .slice(0,8)
    .map(block=>sanitizePsdOpaqueBlock(block,PSD_SMART_OBJECT_BLOCK_KEYS,MAX_PSD_SMART_OBJECT_DATA_URL_CHARS))
    .filter(Boolean);
  if(!blocks.length)return null;
  const baseline=value.baseline&&typeof value.baseline==='object'&&!Array.isArray(value.baseline)?value.baseline:{};
  const descriptor=value.descriptor&&typeof value.descriptor==='object'&&!Array.isArray(value.descriptor)?value.descriptor:null;
  const asset=value.asset&&typeof value.asset==='object'&&!Array.isArray(value.asset)?value.asset:null;
  const placedTransform=Array.isArray(value.placedTransform)&&value.placedTransform.length===8
    ? value.placedTransform.map(item=>bounded(item,0,-1e9,1e9))
    : null;
  return{
    kind:['embedded','linked','placed'].includes(value.kind)?value.kind:'placed',
    uniqueId:shortText(value.uniqueId,'',160).trim()||null,
    placedVersion:Number.isInteger(value.placedVersion)&&value.placedVersion>=0&&value.placedVersion<=100?value.placedVersion:null,
    placedTransform,
    descriptor:descriptor?{
      smartVersion:Math.trunc(bounded(descriptor.smartVersion,0,0,100)),
      uniqueId:shortText(descriptor.uniqueId,'',160).trim()||null,
      resolution:bounded(descriptor.resolution,72,.01,100000),
      descriptorClass:shortText(descriptor.descriptorClass,'',160).trim()||null,
      descriptorKeys:Array.isArray(descriptor.descriptorKeys)?descriptor.descriptorKeys.slice(0,128).map(key=>shortText(key,'',160)).filter(Boolean):[],
    }:null,
    asset:asset?{
      sourceKey:PSD_LINKED_LAYER_BLOCK_KEYS.has(asset.sourceKey)?asset.sourceKey:null,
      kind:['data','external','alias'].includes(asset.kind)?asset.kind:null,
      uuid:shortText(asset.uuid,'',160).trim()||null,
      filename:shortText(asset.filename,'',500).replace(/\0/g,''),
      filetype:shortText(asset.filetype,'',16).replace(/\0/g,''),
      detectedFileType:shortText(asset.detectedFileType,'',32).toLowerCase().replace(/[^a-z0-9_-]/g,'')||null,
      dataSize:Math.trunc(bounded(asset.dataSize,0,0,128*1024*1024)),
      fileSize:asset.fileSize==null?null:Math.trunc(bounded(asset.fileSize,0,0,2_000_000_000)),
    }:null,
    baseline:{
      x:bounded(baseline.x,0,-MAX_LAYER_POSITION,MAX_LAYER_POSITION),
      y:bounded(baseline.y,0,-MAX_LAYER_POSITION,MAX_LAYER_POSITION),
      width:bounded(baseline.width,1,1,12000),
      height:bounded(baseline.height,1,1,12000),
      scaleX:bounded(baseline.scaleX,1,MIN_LAYER_SCALE,MAX_LAYER_SCALE),
      scaleY:bounded(baseline.scaleY,1,MIN_LAYER_SCALE,MAX_LAYER_SCALE),
      rotation:((finite(baseline.rotation,0)%360)+360)%360,
      previewFingerprint:shortText(baseline.previewFingerprint,'',160).trim()||null,
      embeddedFingerprint:shortText(baseline.embeddedFingerprint,'',160).trim()||null,
      embeddedWidth:Math.trunc(bounded(baseline.embeddedWidth,1,1,12000)),
      embeddedHeight:Math.trunc(bounded(baseline.embeddedHeight,1,1,12000)),
    },
    blocks,
  };
}

export function sanitizePsdLinkedLayerBlocks(value) {
  if(!Array.isArray(value))return[];
  const result=[];
  let totalChars=0;
  for(const item of value.slice(0,32)){
    const block=sanitizePsdOpaqueBlock(item,PSD_LINKED_LAYER_BLOCK_KEYS,MAX_PSD_LINKED_LAYER_DATA_URL_CHARS);
    if(!block)continue;
    totalChars+=block.dataUrl.length;
    if(totalChars>MAX_PSD_LINKED_LAYER_TOTAL_CHARS)break;
    result.push(block);
  }
  return result;
}

function sanitizePsdText(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  if(value.key!=='TySh')return null;
  const dataUrl=typeof value.dataUrl==='string'&&value.dataUrl.length<=MAX_PSD_TEXT_DATA_URL_CHARS&&/^data:application\/octet-stream;base64,[a-z\d+/=]*$/i.test(value.dataUrl)
    ? value.dataUrl:null;
  if(!dataUrl)return null;
  const parsed=value.parsed&&typeof value.parsed==='object'&&!Array.isArray(value.parsed)?value.parsed:{};
  const baseline=value.baseline&&typeof value.baseline==='object'&&!Array.isArray(value.baseline)?value.baseline:{};
  const transform=Array.isArray(parsed.transform)&&parsed.transform.length===6
    ? parsed.transform.map(item=>bounded(item,0,-1e9,1e9))
    : null;
  const bounds=parsed.bounds&&typeof parsed.bounds==='object'&&!Array.isArray(parsed.bounds)?{
    left:Math.trunc(bounded(parsed.bounds.left,0,-MAX_LAYER_POSITION,MAX_LAYER_POSITION)),
    top:Math.trunc(bounded(parsed.bounds.top,0,-MAX_LAYER_POSITION,MAX_LAYER_POSITION)),
    right:Math.trunc(bounded(parsed.bounds.right,0,-MAX_LAYER_POSITION,MAX_LAYER_POSITION)),
    bottom:Math.trunc(bounded(parsed.bounds.bottom,0,-MAX_LAYER_POSITION,MAX_LAYER_POSITION)),
  }:null;
  return{
    signature:value.signature==='8B64'?'8B64':'8BIM',
    key:'TySh',
    dataUrl,
    parsed:{
      version:Math.trunc(bounded(parsed.version,1,0,100)),
      textVersion:Math.trunc(bounded(parsed.textVersion,50,0,1000)),
      warpVersion:Math.trunc(bounded(parsed.warpVersion,1,0,100)),
      transform,bounds,
      text:shortText(parsed.text,'',100000),
      orientation:shortText(parsed.orientation,'',32)||null,
      antiAlias:shortText(parsed.antiAlias,'',32)||null,
      descriptorClass:shortText(parsed.descriptorClass,'',160)||null,
      descriptorKeys:Array.isArray(parsed.descriptorKeys)?parsed.descriptorKeys.slice(0,128).map(key=>shortText(key,'',160)).filter(Boolean):[],
      warpClass:shortText(parsed.warpClass,'',160)||null,
      typography:parsed.typography&&typeof parsed.typography==='object'&&!Array.isArray(parsed.typography)?{
        engineText:shortText(parsed.typography.engineText,'',100000),
        fontName:shortText(parsed.typography.fontName,'',240)||null,
        fontFamily:shortText(parsed.typography.fontFamily,'Arial, sans-serif',320),
        fontSize:bounded(parsed.typography.fontSize,12,6,500),
        fontWeight:['400','700'].includes(String(parsed.typography.fontWeight))?String(parsed.typography.fontWeight):'400',
        fontStyle:parsed.typography.fontStyle==='italic'?'italic':'normal',
        color:shortText(parsed.typography.color,'#000000',64),
        align:['left','center','right'].includes(parsed.typography.align)?parsed.typography.align:'left',
        lineHeight:bounded(parsed.typography.lineHeight,1.2,.8,4),
        tracking:bounded(parsed.typography.tracking,0,-10000,10000),
        letterSpacing:bounded(parsed.typography.letterSpacing,0,-20,100),
        underline:parsed.typography.underline===true,
        strikeThrough:parsed.typography.strikeThrough===true,
        justification:Math.trunc(bounded(parsed.typography.justification,0,0,6)),
        styleRunLengths:Array.isArray(parsed.typography.styleRunLengths)?parsed.typography.styleRunLengths.slice(0,256).map(value=>Math.trunc(bounded(value,0,0,1000000))):[],
        paragraphRunLengths:Array.isArray(parsed.typography.paragraphRunLengths)?parsed.typography.paragraphRunLengths.slice(0,256).map(value=>Math.trunc(bounded(value,0,0,1000000))):[],
        editableSingleStyle:parsed.typography.editableSingleStyle===true,
        fontCount:Math.trunc(bounded(parsed.typography.fontCount,0,0,4096)),
      }:null,
    },
    baseline:{
      x:bounded(baseline.x,0,-MAX_LAYER_POSITION,MAX_LAYER_POSITION),
      y:bounded(baseline.y,0,-MAX_LAYER_POSITION,MAX_LAYER_POSITION),
      width:bounded(baseline.width,1,1,12000),
      height:bounded(baseline.height,1,1,12000),
      scaleX:bounded(baseline.scaleX,1,MIN_LAYER_SCALE,MAX_LAYER_SCALE),
      scaleY:bounded(baseline.scaleY,1,MIN_LAYER_SCALE,MAX_LAYER_SCALE),
      rotation:((finite(baseline.rotation,0)%360)+360)%360,
      text:shortText(baseline.text,'',100000),
      fontFamily:shortText(baseline.fontFamily,'Inter, Arial, sans-serif',240),
      fontSize:bounded(baseline.fontSize,48,6,500),
      fontWeight:['400','700'].includes(String(baseline.fontWeight))?String(baseline.fontWeight):'400',
      fontStyle:baseline.fontStyle==='italic'?'italic':'normal',
      align:['left','center','right'].includes(baseline.align)?baseline.align:'left',
      lineHeight:bounded(baseline.lineHeight,1.18,.8,3),
      letterSpacing:bounded(baseline.letterSpacing,0,-5,20),
      underline:baseline.underline===true,
      strikeThrough:baseline.strikeThrough===true,
      color:shortText(baseline.color,'#ffffff',64),
    },
  };
}

const PSD_SHAPE_BLOCK_KEYS = new Set(['SoCo','GdFl','PtFl','vscg','vstk']);
const MAX_PSD_SHAPE_DATA_URL_CHARS = 6_000_000;

function sanitizePsdShape(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const blocks=(Array.isArray(value.blocks)?value.blocks:[])
    .slice(0,8)
    .map(block=>{
      if(!block||typeof block!=='object'||Array.isArray(block))return null;
      const key=shortText(block.key,'',4);
      if(!PSD_SHAPE_BLOCK_KEYS.has(key))return null;
      const dataUrl=typeof block.dataUrl==='string'&&block.dataUrl.length<=MAX_PSD_SHAPE_DATA_URL_CHARS&&/^data:application\/octet-stream;base64,[a-z\d+/=]*$/i.test(block.dataUrl)
        ? block.dataUrl:null;
      if(!dataUrl)return null;
      return{signature:block.signature==='8B64'?'8B64':'8BIM',key,dataUrl};
    })
    .filter(Boolean);
  if(!blocks.length)return null;
  const baseline=value.baseline&&typeof value.baseline==='object'&&!Array.isArray(value.baseline)?value.baseline:{};
  const strokeStyle=value.strokeStyle&&typeof value.strokeStyle==='object'&&!Array.isArray(value.strokeStyle)?value.strokeStyle:null;
  const gradient=value.gradient&&typeof value.gradient==='object'&&!Array.isArray(value.gradient)?value.gradient:null;
  const pattern=value.pattern&&typeof value.pattern==='object'&&!Array.isArray(value.pattern)?value.pattern:null;
  const sanitizeGradientStops=(items,colorMode)=>Array.isArray(items)?items.slice(0,64).map(stop=>{
    if(!stop||typeof stop!=='object'||Array.isArray(stop))return null;
    const base={location:Math.trunc(bounded(stop.location,0,0,4096)),midpoint:Math.trunc(bounded(stop.midpoint,50,0,100))};
    if(colorMode)return{...base,color:shortText(stop.color,'#000000',64)};
    return{...base,opacity:bounded(stop.opacity,100,0,100)};
  }).filter(Boolean):[];
  return{
    fillType:['solid','gradient','pattern'].includes(value.fillType)?value.fillType:null,
    fill:shortText(value.fill,'#000000',64),
    fillEnabled:value.fillEnabled!==false,
    stroke:shortText(value.stroke,'transparent',64),
    strokeEnabled:value.strokeEnabled===true,
    strokeWidth:bounded(value.strokeWidth,0,0,1000),
    sourceContentKey:['SoCo','GdFl','PtFl','vscg'].includes(value.sourceContentKey)?value.sourceContentKey:null,
    contentSubtype:['SoCo','GdFl','PtFl'].includes(value.contentSubtype)?value.contentSubtype:null,
    gradient:gradient?{
      angle:bounded(gradient.angle,0,-3600,3600),
      type:shortText(gradient.type,'',64)||null,
      name:shortText(gradient.name,'',500)||null,
      form:shortText(gradient.form,'',64)||null,
      smoothness:Math.trunc(bounded(gradient.smoothness,4096,0,65535)),
      scale:bounded(gradient.scale,100,0,10000),
      reverse:gradient.reverse===true,
      dither:gradient.dither===true,
      align:gradient.align!==false,
      colorStops:sanitizeGradientStops(gradient.colorStops,true),
      transparencyStops:sanitizeGradientStops(gradient.transparencyStops,false),
    }:null,
    pattern:pattern?{
      name:shortText(pattern.name,'',500)||null,
      id:shortText(pattern.id,'',240)||null,
      scale:bounded(pattern.scale,100,0,10000),
      linked:pattern.linked!==false,
    }:null,
    strokeStyle:strokeStyle?{
      opacity:bounded(strokeStyle.opacity,100,0,100),
      lineCap:shortText(strokeStyle.lineCap,'',160)||null,
      lineJoin:shortText(strokeStyle.lineJoin,'',160)||null,
      lineAlignment:shortText(strokeStyle.lineAlignment,'',160)||null,
    }:null,
    baseline:{
      fill:shortText(baseline.fill,'transparent',64),
      stroke:shortText(baseline.stroke,'transparent',64),
      strokeWidth:bounded(baseline.strokeWidth,0,0,1000),
      pathClosed:baseline.pathClosed!==false,
      width:bounded(baseline.width,1,1,12000),
      height:bounded(baseline.height,1,1,12000),
      scaleX:bounded(baseline.scaleX,1,MIN_LAYER_SCALE,MAX_LAYER_SCALE),
      scaleY:bounded(baseline.scaleY,1,MIN_LAYER_SCALE,MAX_LAYER_SCALE),
      rotation:((finite(baseline.rotation,0)%360)+360)%360,
    },
    blocks,
  };
}

const PSD_ADJUSTMENT_BLOCK_KEYS = new Set(['brit','CgEd','expA','hue2','hue ','levl','curv','nvrt','post','thrs']);
const MAX_PSD_ADJUSTMENT_DATA_URL_CHARS = 6_000_000;

function sanitizePsdAdjustment(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const kind=['brightness-contrast','exposure','hue-saturation','levels','curves','invert','posterize','threshold'].includes(value.kind)?value.kind:null;
  if(!kind)return null;
  const blocks=(Array.isArray(value.blocks)?value.blocks:[])
    .slice(0,12)
    .map(block=>{
      if(!block||typeof block!=='object'||Array.isArray(block))return null;
      const key=shortText(block.key,'',4);
      if(!PSD_ADJUSTMENT_BLOCK_KEYS.has(key))return null;
      const dataUrl=typeof block.dataUrl==='string'&&block.dataUrl.length<=MAX_PSD_ADJUSTMENT_DATA_URL_CHARS&&/^data:application\/octet-stream;base64,[a-z\d+/=]*$/i.test(block.dataUrl)
        ? block.dataUrl:null;
      if(!dataUrl)return null;
      return{signature:block.signature==='8B64'?'8B64':'8BIM',key,dataUrl};
    })
    .filter(Boolean);
  if(!blocks.length)return null;
  const baseline=sanitizeAdjustmentModel(value.baseline);
  if(!baseline||baseline.kind!==kind)return null;
  const channelIds=Array.isArray(value.channelIds)
    ? value.channelIds.slice(0,16).map(id=>Math.trunc(bounded(id,0,-32768,32767)))
    : [];
  return{kind,blocks,baseline,channelIds};
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
    clipping: layer?.clipping === true,
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
    result.highDepthSource = sanitizeSerializedPixelBufferSource(layer?.highDepthSource);
    const hasRgbHighDepthPreview = result.highDepthSource?.model === 'rgb' && Number(result.highDepthSource.bitsPerChannel) > 8;
    result.highDepthPreview = hasRgbHighDepthPreview ? sanitizeHighDepthPreview(layer?.highDepthPreview) : null;
  } else if (type === 'smart-object') {
    checkedCanvasSize(result.width, result.height, `Смарт-объект «${result.name || 'Без имени'}»`);
    result.previewDataUrl = typeof layer?.previewDataUrl === 'string' && /^data:image\//i.test(layer.previewDataUrl) ? layer.previewDataUrl : null;
    result.smartFilters = sanitizeSmartFilters(layer?.smartFilters);
    result.smartFilterMask = sanitizeSmartFilterMask(layer?.smartFilterMask);
    result.linkedSourceId = shortText(layer?.linkedSourceId, '', 160).trim() || null;
    result.psdSmartObject = sanitizePsdSmartObject(layer?.psdSmartObject);
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
    result.psdText = sanitizePsdText(layer?.psdText);
  } else if (type === 'adjustment') {
    result.x = 0;
    result.y = 0;
    result.scaleX = 1;
    result.scaleY = 1;
    result.rotation = 0;
    result.adjustment = sanitizeAdjustmentModel(layer?.adjustment);
    result.psdAdjustment = sanitizePsdAdjustment(layer?.psdAdjustment);
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
    result.psdShape = sanitizePsdShape(layer?.psdShape);
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
  doc.proofProfile = sanitizeColorProfile(doc.proofProfile);
  doc.displayProfile = sanitizeColorProfile(doc.displayProfile);
  doc.colorManagement = sanitizeColorManagement(doc.colorManagement);
  doc.psdLinkedLayerBlocks = sanitizePsdLinkedLayerBlocks(doc.psdLinkedLayerBlocks);
  doc.psdSmartObjectSourceCount = Math.trunc(bounded(doc.psdSmartObjectSourceCount,0,0,500));
  const usedPathIds = new Set();
  doc.paths = Array.isArray(doc.paths)
    ? doc.paths.slice(0, 998).map((path, index) => sanitizeDocumentPath(path, index, usedPathIds)).filter(Boolean)
    : [];
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