import { HistoryStack } from './core/history.js';
import { fitZoom, layerFrame, frameBounds, hitLayerHandle, normalizeRect, constrainedRect, pointInLayer, resizeLayerFromPoint, rotationHandlePoint, rotationFromDrag, snapLineEnd, snapLayerMove, alignLayerToCanvas, selectionPixelBounds, selectionBounds, selectionPathPoints, pointInSelection, clamp } from './core/geometry.js';
import {
  createDocument, createRasterLayer, createTextLayer, createShapeLayer, createSmartObjectLayer, createSmartObjectLinkId, linkedSmartObjectLayers, createSmartFilter, createSmartFilterMask, createAdjustmentLayer, createLayerMask, createVectorMask, createLayerGroup, documentWithTextPreview,
  addLayer, removeLayer, duplicateLayer, moveLayer, addLayerGroup, removeLayerGroup, moveLayerIntoGroup, moveLayerGroupIntoGroup, selectedLayer,
  snapshotDocument, restoreDocument, sanitizeProject, touch, checkedCanvasSize, imageResizeTransforms, MAX_LAYER_POSITION, DEFAULT_LAYER_FILTERS, FILTER_RANGES, sanitizeFilters, sanitizeHighDepthPreview,
  isLayerVisible, isLayerLocked, isGroupVisible, isGroupLocked, groupDepth,
} from './core/state.js';
import { renderDocument, renderLayer, compositeToBlob, invalidateImageCache, clearImageCache, getImage, ensureTextFont } from './core/render.js';
import { readFileAsDataURL, readFileAsText, dimensionsFromDataUrl, canvasToDataURL, downloadBlob, downloadText, safeFilename, bytesToDataUrl, dataUrlToBytes } from './core/io.js';
import { applyBlurBrushPixels, applyToneBrushPixels, floodFillPixels, hexToRgb, refineMaskAlpha, composeMaskPreviewRgba } from './core/pixels.js';
import { pixelBufferToRgba8Preview, serializePixelBufferSource, deserializePixelBufferSource, pixelBufferToToneMappedRgba8Preview, clonePixelBuffer, pixelBufferWithStraightAlpha, pixelBufferByteLength, applyPixelBufferBrushDab, applyPixelBufferStrokeSegment, applyPixelBufferToneDab, applyPixelBufferBlurDab, applyPixelBufferCloneDab, applyPixelBufferSmudgeDab, floodFillPixelBuffer, clearPixelBufferPixels, MAX_PIXEL_BUFFER_SOURCE_BYTES } from './core/pixel-buffer.js';
import { saveRecoverySnapshot, loadRecoverySnapshots, clearRecoverySnapshot } from './core/recovery.js';
import { LAYER_STYLE_FIELDS, createLayerStyles, sanitizeLayerStyles, layerStyleOutset } from './core/layer-styles.js';
import { decodePsd, encodePsdBlob, encodePsbBlob, isPsdFile } from './adapters/psd.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  canvas: $('#editorCanvas'), overlay: $('#overlayCanvas'), shell: $('#canvasShell'), viewport: $('#stageViewport'),
  title: $('#documentTitle'), tabs: $('#docTabs'), addTab: $('#addDocTabBtn'), dimensions: $('#docDimensions'), zoomLabel: $('#zoomLabel'), zoomRange: $('#zoomRange'),
  status: $('#statusText'), pointer: $('#pointerInfo'), layers: $('#layersList'), paths: $('#pathsList'), history: $('#historyList'), props: $('#propertiesContent'), effects: $('#effectsContent'), emptyDrop: $('#emptyDrop'),
  blend: $('#blendMode'), layerOpacity: $('#layerOpacity'), undo: $('#undoBtn'), redo: $('#redoBtn'),
  primaryColor: $('#primaryColor'), colorChip: $('#colorChip'), brushSize: $('#brushSize'), brushSizeValue: $('#brushSizeValue'), selectionType: $('#selectionType'), selectionCopyMode: $('#selectionCopyMode'),
  toolOpacity: $('#toolOpacity'), toolOpacityValue: $('#toolOpacityValue'), dodgeStrength: $('#dodgeStrength'), dodgeStrengthValue: $('#dodgeStrengthValue'), burnStrength: $('#burnStrength'), burnStrengthValue: $('#burnStrengthValue'), blurStrength: $('#blurStrength'), blurStrengthValue: $('#blurStrengthValue'), smudgeStrength: $('#smudgeStrength'), smudgeStrengthValue: $('#smudgeStrengthValue'), fillTolerance: $('#fillTolerance'), fillToleranceValue: $('#fillToleranceValue'), secondaryColor: $('#secondaryColor'), gradientType: $('#gradientType'), penClosed: $('#penClosed'), fontFamily: $('#fontFamily'), fontSize: $('#fontSize'), shapeKind: $('#shapeKind'),
  smartSnapToggle: $('#smartSnapToggle'),
  toolLabel: $('#toolLabel'), menu: $('#menuPopover'), modalRoot: $('#modalRoot'), fileInput: $('#fileInput'), projectInput: $('#projectInput'),
  dropOverlay: $('#dropOverlay'), toastRegion: $('#toastRegion'), workspace: $('.workspace'), toolbar: $('.toolbar'), rightPanel: $('.right-panel'),
};

const TOOL_LABELS = { move: 'Перемещение', marquee: 'Выделение', brush: 'Кисть', clone: 'Штамп', heal: 'Лечебная кисть', smudge: 'Палец / смазывание', dodge: 'Осветлитель', burn: 'Затемнитель', blur: 'Кисть размытия', eraser: 'Ластик', fill: 'Заливка', gradient: 'Градиент', pen: 'Перо / контуры', magnetic: 'Магнитное лассо', wand: 'Волшебная палочка', line: 'Линия', text: 'Текст', shape: 'Фигура', crop: 'Кадрирование', eyedropper: 'Пипетка', hand: 'Рука', zoom: 'Лупа' };
const TOOL_HELP = {
  move:{shortcut:'V',description:'Выбирает и перемещает слои. Тяните рамку для масштаба, круглый маркер — для поворота; Shift ограничивает направление.'},
  marquee:{shortcut:'M / Shift+M',description:'Создаёт прямоугольное, эллиптическое, свободное или многоугольное выделение. Ограничивает рисование и копирование выбранной областью.'},
  brush:{shortcut:'B',description:'Рисует основным цветом на растровом слое. Размер меняется клавишами [ и ], давление пера поддерживается.'},
  clone:{shortcut:'S',description:'Копирует пиксели из одной части изображения в другую. Сначала задайте источник через Alt+клик, затем рисуйте.'},
  heal:{shortcut:'J',description:'Мягко переносит фактуру с выбранного участка для ретуши дефектов. Источник задаётся через Alt+клик.'},
  smudge:{shortcut:'N',description:'Размазывает существующие пиксели по направлению движения кисти. Силу эффекта задаёт отдельный ползунок сверху.'},
  dodge:{shortcut:'O',description:'Осветляет существующие пиксели. Ползунок «Сила осветления» задаёт эффект одного штриха; повторные штрихи усиливают его.'},
  burn:{shortcut:'Shift+O',description:'Затемняет существующие пиксели. Ползунок «Сила затемнения» задаёт эффект одного штриха; повторные штрихи усиливают его.'},
  blur:{shortcut:'R',description:'Локально смягчает детали растрового слоя. Размер задаёт область, а «Сила размытия» — интенсивность одного штриха в процентах.'},
  eraser:{shortcut:'E',description:'Удаляет пиксели с существующего растрового слоя до прозрачности. Активное выделение ограничивает стирание.'},
  fill:{shortcut:'G',description:'Заливает связанную область основным цветом. Ползунок «Допуск» определяет, насколько близкие оттенки захватывать.'},
  gradient:{shortcut:'Shift+G',description:'Создаёт линейный или радиальный переход между двумя цветами на новом слое. Протяните линию по холсту.'},
  pen:{shortcut:'P',description:'Строит редактируемый векторный контур по опорным точкам. Enter или двойной щелчок завершает путь.'},
  magnetic:{shortcut:'A',description:'Создаёт выделение, притягивая поставленные точки к заметным границам изображения. Enter завершает контур.'},
  wand:{shortcut:'W',description:'Одним щелчком выделяет связанную область похожего цвета. Чувствительность регулируется ползунком «Допуск».'},
  line:{shortcut:'L',description:'Рисует линию на текущем растровом слое. Если его нет, создаёт один слой «Линии»; Shift привязывает угол к шагу 45°.'},
  text:{shortcut:'T',description:'Добавляет новый текст или открывает существующий текстовый слой для редактирования.'},
  shape:{shortcut:'U',description:'Создаёт прямоугольник или эллипс на отдельном редактируемом слое. Shift создаёт квадрат или круг.'},
  crop:{shortcut:'C',description:'Обрезает документ по протянутой рамке. Содержимое и размеры холста обновляются одной операцией истории.'},
  eyedropper:{shortcut:'I',description:'Берёт цвет видимого пикселя с холста и делает его основным цветом рисования.'},
  hand:{shortcut:'H / Space',description:'Перемещает область просмотра без изменения слоёв. Пробел временно включает руку из любого инструмента.'},
  zoom:{shortcut:'Z',description:'Увеличивает изображение относительно точки щелчка. Alt+клик уменьшает масштаб.'},
};
const RASTER_BRUSH_TOOLS = new Set(['brush','clone','heal','smudge','dodge','burn','blur','eraser']);
const SELECTION_TYPE_LABELS = { rect:'Прямоугольное выделение', ellipse:'Эллиптическое выделение', lasso:'Свободное лассо', polygon:'Многоугольное лассо' };
const SELECTION_TYPES = Object.keys(SELECTION_TYPE_LABELS);
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/vnd.adobe.photoshop': 'psd' };
const COLOR_CORRECTION_CONTROLS = [
  { key:'exposure', label:'Экспозиция', min:-2, max:2, step:.05, unit:' EV', group:'Свет' },
  { key:'brightness', label:'Яркость', min:0, max:200, step:1, unit:'%', group:'Свет' },
  { key:'contrast', label:'Контраст', min:0, max:200, step:1, unit:'%', group:'Свет' },
  { key:'highlights', label:'Светлые области', min:-100, max:100, step:1, unit:'', group:'Свет' },
  { key:'shadows', label:'Тени', min:-100, max:100, step:1, unit:'', group:'Свет' },
  { key:'temperature', label:'Температура', min:-100, max:100, step:1, unit:'', group:'Цвет' },
  { key:'tint', label:'Оттенок', min:-100, max:100, step:1, unit:'', group:'Цвет' },
  { key:'saturate', label:'Насыщенность', min:0, max:200, step:1, unit:'%', group:'Цвет' },
  { key:'vibrance', label:'Красочность', min:-100, max:100, step:1, unit:'', group:'Цвет' },
  { key:'hue', label:'Тон', min:-180, max:180, step:1, unit:'°', group:'Цвет' },
  { key:'gamma', label:'Гамма', min:.2, max:3, step:.05, unit:'', group:'Тональный диапазон' },
];
const COLOR_CORRECTION_KEYS = new Set(COLOR_CORRECTION_CONTROLS.map(item => item.key));
const BASIC_EFFECT_CONTROLS = [
  { key:'brightness', label:'Яркость', min:0, max:200, step:1, group:'Цвет и эффекты' },
  { key:'contrast', label:'Контраст', min:0, max:200, step:1, group:'Цвет и эффекты' },
  { key:'saturate', label:'Насыщенность', min:0, max:200, step:1, group:'Цвет и эффекты' },
  { key:'hue', label:'Тон', min:-180, max:180, step:1, group:'Цвет и эффекты' },
  { key:'blur', label:'Размытие', min:0, max:30, step:1, group:'Эффекты' },
];
const RASTER_EFFECT_CONTROLS = [
  ...COLOR_CORRECTION_CONTROLS,
  { key:'blur', label:'Размытие', min:0, max:30, step:1, unit:' px', group:'Эффекты' },
];
const UI_COLLAPSE_STORAGE_KEY = 'zeter-photo-editor.ui-collapse.v1';
const SMART_SNAP_STORAGE_KEY = 'zeter-photo-editor.smart-snap.v1';
const NATIVE_HIGH_DEPTH_PAINT_TOOLS = new Set(['brush','eraser','blur','clone','heal','smudge','dodge','burn']);
const collapsedPanelIds = new Set();
let doc = createDocument();
let history = new HistoryStack(80);
let zoom = 0.75;
let documentSessions = [];
let activeSessionId = '';
let nextSessionNumber = 1;
let currentTool = 'move';
let renderVersion = 0;
let renderFrame = 0;
let renderBusy = false;
let textDraft = null;
let blendingPreview = null;
let renderPending = null;
const renderBuffer = document.createElement('canvas');
let dirty = false;
let documentChangeSerial = 0;
let drag = null;
let brushCanvas = null;
let brushCtx = null;
let brushLayerId = null;
let highDepthPaintBuffer = null;
let highDepthPaintLayerId = null;
let highDepthPaintPreviewDirty = false;
let highDepthCloneSnapshotBuffer = null;
let blurScratchCanvas = null;
let blurScratchCtx = null;
let retouchScratchCanvas = null;
let retouchScratchCtx = null;
let cloneSource = null;
let cloneSnapshotCanvas = null;
let penDraft = null;
let vectorMaskEditLayerId = null;
let documentPathEditIndex = -1;
let selectedDocumentPathIndex = -1;
let magneticDraft = null;
let spaceHeld = false;
let cropRect = null;
let selectionRect = null;
let selectionShape = null;
let selectionType = 'rect';
let polygonDraft = null;
let selectionCopyMode = 'merged';
let dragDepth = 0;
let layerDragId = null;
let groupDragId = null;
let openMenuKey = null;
let menuReturnFocus = null;
let panelsVisible = true;
let pasteGeneration = 0;
let pasteFallbackTimer = null;
let paintPreviewFrame = 0;
let paintPreviewQueued = false;
let activePrimaryPointerId = null;
let paintPersisting = false;
let hoverPoint = null;
let recoveryTimer = 0;
let recoveryGeneration = 0;
let recoveryWritePromise = Promise.resolve();
let recoveryStorageAvailable = true;
let recoveryFailureNotified = false;
let unrestoredRecoveryDocuments = [];
function createRecoveryKey(forceNew = false) {
  const key = `workspace:${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  try {
    const storageKey = 'zeter-photo-editor.recovery-window.v1';
    const previous = sessionStorage.getItem(storageKey);
    const navigation = performance.getEntriesByType('navigation')[0]?.type;
    if (!forceNew && navigation === 'reload' && previous?.startsWith('workspace:')) return previous;
    sessionStorage.setItem(storageKey, key);
  } catch (error) { console.warn('Recovery window identity is not persistent', error); }
  return key;
}
let recoveryKey = createRecoveryKey();
let smartSnapEnabled = true;
let smartGuides = { x:null, y:null };
const RECOVERY_DEBOUNCE_MS = 1500;

function setStatus(message) { els.status.textContent = message; }
function initTooltips(){
  const tooltip=document.createElement('div');tooltip.id='toolTooltip';tooltip.className='tool-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
  const hide=()=>{tooltip.hidden=true;};
  for(const button of $$('.tool')){const help=TOOL_HELP[button.dataset.tool];if(!help)continue;button.removeAttribute('title');button.setAttribute('aria-describedby',tooltip.id);const show=()=>{const rect=button.getBoundingClientRect();tooltip.innerHTML=`<strong>${TOOL_LABELS[button.dataset.tool]}</strong><span>${help.description}</span><kbd>${help.shortcut}</kbd>`;tooltip.hidden=false;const width=tooltip.offsetWidth;const height=tooltip.offsetHeight;tooltip.style.left=`${Math.min(window.innerWidth-width-10,rect.right+10)}px`;tooltip.style.top=`${clamp(rect.top+rect.height/2-height/2,8,window.innerHeight-height-8)}px`;};button.addEventListener('pointerenter',show);button.addEventListener('pointerleave',hide);button.addEventListener('focus',show);button.addEventListener('blur',hide);}
}
function toast(message, tone = '') {
  const item = document.createElement('div');
  item.className = `toast${tone ? ` ${tone}` : ''}`;
  item.textContent = message;
  els.toastRegion.append(item);
  setTimeout(() => item.remove(), 3000);
}

function readCollapseState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_COLLAPSE_STORAGE_KEY) || '{}');
    for (const id of Array.isArray(parsed.panels) ? parsed.panels : []) collapsedPanelIds.add(String(id));
    if (Array.isArray(parsed.propertySections) && parsed.propertySections.includes('color-effects')) collapsedPanelIds.add('effects');
  } catch (error) {
    console.warn('Could not restore panel collapse state', error);
  }
}
function persistCollapseState() {
  try {
    localStorage.setItem(UI_COLLAPSE_STORAGE_KEY, JSON.stringify({
      panels: [...collapsedPanelIds],
    }));
  } catch (error) {
    console.warn('Could not persist panel collapse state', error);
  }
}
function readSmartSnapState() {
  try {
    const saved = localStorage.getItem(SMART_SNAP_STORAGE_KEY);
    smartSnapEnabled = saved === null ? true : saved !== 'false';
  } catch (error) {
    console.warn('Could not restore smart snap setting', error);
    smartSnapEnabled = true;
  }
  if (els.smartSnapToggle) els.smartSnapToggle.checked = smartSnapEnabled;
}
function persistSmartSnapState() {
  try { localStorage.setItem(SMART_SNAP_STORAGE_KEY, String(smartSnapEnabled)); }
  catch (error) { console.warn('Could not persist smart snap setting', error); }
}
function clearSmartGuides() { smartGuides = { x:null, y:null }; }
function cloneRect(rect) {
  return rect ? { ...rect } : null;
}
function cloneSelectionShape(shape) {
  if (!shape) return null;
  if (shape.rect) return { ...shape, rect:{...shape.rect} };
  if (Array.isArray(shape.points)) return { ...shape, points:shape.points.map(point=>({...point})) };
  return { ...shape };
}
function createSessionId() {
  return `doc-session-${nextSessionNumber++}`;
}
function createUntitledName() {
  const used = new Set(documentSessions.map(session => String(session.doc?.name || '').trim()).filter(Boolean));
  if (!used.has('Без имени')) return 'Без имени';
  let index = 2;
  while (used.has(`Без имени ${index}`)) index += 1;
  return `Без имени ${index}`;
}
function currentSession() {
  return documentSessions.find(session => session.id === activeSessionId) || null;
}
function syncCurrentSession() {
  const session = currentSession();
  if (!session) return;
  session.doc = doc;
  session.history = history;
  session.zoom = zoom;
  session.dirty = dirty;
  session.cropRect = cloneRect(cropRect);
  session.selectionRect = cloneRect(selectionRect);
  session.selectionShape = cloneSelectionShape(selectionShape);
  session.selectedPathIndex = selectedDocumentPathIndex;
}
function loadSession(session) {
  doc = session.doc;
  history = session.history;
  zoom = session.zoom;
  dirty = session.dirty;
  cropRect = cloneRect(session.cropRect);
  selectionRect = cloneRect(session.selectionRect);
  selectionShape = cloneSelectionShape(session.selectionShape) || (selectionRect ? {type:'rect',rect:cloneRect(selectionRect)} : null);
  selectedDocumentPathIndex = Number.isInteger(session.selectedPathIndex) ? session.selectedPathIndex : -1;
  documentPathEditIndex = -1;
  vectorMaskEditLayerId = null;
  penDraft = null;
  polygonDraft = null;
  drag = null;
  brushCanvas = null;
  brushCtx = null;
  brushLayerId = null;
  highDepthPaintBuffer = null;
  highDepthPaintLayerId = null;
  highDepthPaintPreviewDirty = false;
  hoverPoint = null;
  activePrimaryPointerId = null;
  paintPersisting = false;
}
function buildSession(documentValue, { label = 'Новый документ', zoomLevel = 0.75, dirtyState = false, smartObjectLink = null } = {}) {
  const sessionHistory = new HistoryStack(80);
  sessionHistory.reset(label, snapshotDocument(documentValue));
  return {
    id: createSessionId(),
    doc: documentValue,
    history: sessionHistory,
    zoom: zoomLevel,
    dirty: dirtyState,
    smartObjectLink: smartObjectLink ? { ...smartObjectLink } : null,
    cropRect: null,
    selectionRect: null,
    selectionShape: null,
    selectedPathIndex: -1,
  };
}
function renderDocumentTabs() {
  if (!els.tabs) return;
  els.tabs.replaceChildren();
  documentSessions.forEach(session => {
    const shell = document.createElement('div');
    shell.className = `doc-tab-shell${session.id === activeSessionId ? ' active' : ''}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'doc-tab';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(session.id === activeSessionId));
    button.title = session.smartObjectLink ? `Содержимое смарт-объекта · ${session.doc?.name || 'Без имени'}` : (session.doc?.name || 'Без имени');

    const title = document.createElement('span');
    title.className = 'doc-tab-title';
    title.textContent = `${session.smartObjectLink ? '◇ ' : ''}${session.doc?.name || 'Без имени'}`;
    button.append(title);

    const dot = document.createElement('span');
    dot.className = 'dirty-dot';
    dot.textContent = '●';
    dot.hidden = !session.dirty;
    button.append(dot);

    button.addEventListener('click', () => activateDocumentTab(session.id, { focusViewport: true }));

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'doc-tab-close';
    close.textContent = '×';
    close.title = `Закрыть вкладку «${session.doc?.name || 'Без имени'}»`;
    close.hidden = documentSessions.length <= 1;
    close.addEventListener('click', event => {
      event.stopPropagation();
      closeDocumentTab(session.id);
    });

    shell.append(button, close);
    shell.addEventListener('contextmenu', event => {
      event.preventDefault();
      openContextMenu(`tab:${session.id}`, documentTabMenu(session.id), event, button);
    });
    els.tabs.append(shell);
  });
}
function activateDocumentTab(id, { focusViewport = false } = {}) {
  if (!id || id === activeSessionId) {
    if (focusViewport) requestAnimationFrame(() => els.viewport.focus());
    return;
  }
  if (blockPendingDocumentEdit()) return;
  syncCurrentSession();
  const session = documentSessions.find(item => item.id === id);
  if (!session) return;
  activeSessionId = session.id;
  loadSession(session);
  updateAll();
  if (focusViewport) requestAnimationFrame(() => els.viewport.focus());
  setStatus(`Вкладка: ${doc.name}`);
}
function addDocumentTab({ name = createUntitledName(), width = 1200, height = 800, background = 'transparent' } = {}) {
  if (blockPendingDocumentEdit()) return;
  syncCurrentSession();
  const sessionDoc = createDocument({ name, width, height, background });
  const session = buildSession(sessionDoc);
  documentSessions.push(session);
  activeSessionId = session.id;
  loadSession(session);
  updateAll();
  fitToView();
  setStatus(`Создана вкладка «${doc.name}»`);
  toast('Новая вкладка создана', 'success');
}
function closeDocumentTab(id) {
  if (blockPendingDocumentEdit()) return;
  const index = documentSessions.findIndex(session => session.id === id);
  if (index === -1) return;
  syncCurrentSession();
  const session = documentSessions[index];
  const childSessions=documentSessions.filter(item=>item.smartObjectLink?.parentSessionId===session.id);
  if(childSessions.length){
    const message='Сначала закройте вкладки содержимого смарт-объектов этого документа';
    setStatus(message);toast(message,'warn');return;
  }
  if (session.dirty && !window.confirm(`Во вкладке «${session.doc?.name || 'Без имени'}» есть несохранённые изменения. Закрыть её?`)) return;
  documentSessions.splice(index, 1);
  if (!documentSessions.length) {
    const fallback = buildSession(createDocument({ name: 'Без имени' }));
    documentSessions.push(fallback);
  }
  const nextIndex = Math.max(0, Math.min(index, documentSessions.length - 1));
  activeSessionId = documentSessions[nextIndex].id;
  loadSession(documentSessions[nextIndex]);
  updateAll();
  queueRecovery({ immediate: true });
  setStatus(`Закрыта вкладка «${session.doc?.name || 'Без имени'}»`);
}
function renameDocumentTab(id) {
  if (blockPendingDocumentEdit()) return;
  const session = documentSessions.find(item => item.id === id);
  if (!session) return;
  showModal({title:'Переименовать вкладку',fields:[{name:'name',label:'Имя',value:session.doc.name,required:true}],submitLabel:'Переименовать',onSubmit:values=>{
    if (blockPendingDocumentEdit()) return false;
    const target = documentSessions.find(item => item.id === id);
    const name = String(values.name || '').trim();
    if (!target || !name || name === target.doc.name) return;
    target.doc.name = name;
    if (id === activeSessionId) commit('Переименовать вкладку');
    else {
      touch(target.doc);
      target.history.push('Переименовать вкладку', snapshotDocument(target.doc));
      target.dirty = true;
      renderDocumentTabs();
      queueRecovery();
    }
    setStatus(`Вкладка переименована: ${name}`);
  }});
}
function duplicateDocumentTab(id) {
  if (blockPendingDocumentEdit()) return;
  syncCurrentSession();
  const index = documentSessions.findIndex(item => item.id === id);
  if (index < 0) return;
  const copy = restoreDocument(snapshotDocument(documentSessions[index].doc));
  copy.name = `${copy.name} — копия`;
  const session = buildSession(copy, {label:'Копия вкладки', zoomLevel:documentSessions[index].zoom, dirtyState:true});
  documentSessions.splice(index + 1, 0, session);
  renderDocumentTabs();
  queueRecovery();
  setStatus(`Создана копия вкладки «${copy.name}»`);
}
function documentTabMenu(id) {
  const exists = () => documentSessions.some(item => item.id === id);
  return [
    ['Открыть вкладку','',()=>activateDocumentTab(id, {focusViewport:true}),exists],
    ['Переименовать…','',()=>renameDocumentTab(id),exists],
    ['Дублировать','',()=>duplicateDocumentTab(id),exists],
    ['sep'],
    ['Новая вкладка','',()=>addDocumentTab()],
    ['Закрыть вкладку','',()=>closeDocumentTab(id),exists],
  ];
}
function setPanelCollapsed(panel, collapsed, { persist = true } = {}) {
  const id = panel?.dataset?.panelId;
  if (!panel || !id) return;
  panel.classList.toggle('is-collapsed', collapsed);
  const toggle = panel.querySelector(':scope > header .panel-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const name = toggle.querySelector('strong')?.textContent?.trim() || 'раздел';
    toggle.title = `${collapsed ? 'Развернуть' : 'Свернуть'} раздел «${name}»`;
  }
  if (collapsed) collapsedPanelIds.add(id); else collapsedPanelIds.delete(id);
  if (persist) persistCollapseState();
}
function initCollapsiblePanels() {
  readCollapseState();
  $$('.panel-card[data-panel-id]').forEach(panel => {
    const toggle = panel.querySelector(':scope > header .panel-toggle');
    if (!toggle) return;
    setPanelCollapsed(panel, collapsedPanelIds.has(panel.dataset.panelId), { persist: false });
    toggle.addEventListener('click', () => setPanelCollapsed(panel, !panel.classList.contains('is-collapsed')));
  });
}
function isEditingTarget(target = document.activeElement) {
  const tag = target?.tagName;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target?.isContentEditable;
}
function isInteractiveControlTarget(target = document.activeElement) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a[href], [role=\"button\"], [role=\"menuitem\"], [role=\"option\"]'));
}
function markDirty(value = true) {
  if(value)documentChangeSerial+=1;
  dirty = value;
  const session = currentSession();
  if (session) session.dirty = value;
  renderDocumentTabs();
  if (value) queueRecovery();
}
function documentEditPending() {
  return paintPersisting || Boolean(drag && !['pan','marquee'].includes(drag.kind)) ||
    (activePrimaryPointerId !== null && (RASTER_BRUSH_TOOLS.has(currentTool) || currentTool === 'fill'));
}
function blockPendingDocumentEdit() {
  if (!documentEditPending()) return false;
  const message = 'Дождитесь завершения операции редактирования и повторите команду';
  setStatus(message);
  toast(message, 'warn');
  return true;
}
function reportRecoveryFailure(error, { notify = false } = {}) {
  recoveryStorageAvailable = false;
  console.warn('ZeTer Photo Editor recovery storage unavailable', error);
  if (notify && !recoveryFailureNotified) {
    recoveryFailureNotified = true;
    toast('Автовосстановление недоступно в этом режиме браузера', 'warn');
  }
}
function cancelRecoveryTimer() {
  recoveryGeneration += 1;
  if (recoveryTimer) clearTimeout(recoveryTimer);
  recoveryTimer = 0;
}
function queueRecovery({ immediate = false } = {}) {
  if (!recoveryStorageAvailable) return;
  cancelRecoveryTimer();
  const generation = recoveryGeneration;
  const write = () => {
    if (generation !== recoveryGeneration || !recoveryStorageAvailable) return;
    recoveryTimer = 0;
    syncCurrentSession();
    const sessions = documentSessions.filter(session => session.dirty);
    const snapshots = [...unrestoredRecoveryDocuments, ...sessions.map(session => ({
      name: session.doc.name,
      modifiedAt: session.doc.modifiedAt,
      snapshot: snapshotDocument(session.doc),
    }))];
    const activeIndex = unrestoredRecoveryDocuments.length + Math.max(0, sessions.findIndex(session => session.id === activeSessionId));
    recoveryWritePromise = recoveryWritePromise
      .then(() => snapshots.length ? saveRecoverySnapshot(snapshots, { activeIndex }, { key: recoveryKey }) : clearRecoverySnapshot({ key: recoveryKey }))
      .catch(error => reportRecoveryFailure(error, { notify: true }));
  };
  if (immediate) write();
  else recoveryTimer = setTimeout(write, RECOVERY_DEBOUNCE_MS);
}
function discardRecovery(key = recoveryKey) {
  cancelRecoveryTimer();
  if (!recoveryStorageAvailable) return Promise.resolve(false);
  recoveryWritePromise = recoveryWritePromise
    .catch(() => {})
    .then(() => clearRecoverySnapshot({ key }))
    .then(() => { unrestoredRecoveryDocuments = []; return true; })
    .catch(error => { console.warn('Could not clear recovery snapshot', error); return false; });
  return recoveryWritePromise;
}
function setDoc(next, { resetHistory = false, label = 'Состояние' } = {}) {
  doc = next;
  cropRect = null;
  selectedDocumentPathIndex = -1;
  documentPathEditIndex = -1;
  vectorMaskEditLayerId = null;
  penDraft = null;
  clearSelectionState();
  brushCanvas=null;brushCtx=null;brushLayerId=null;highDepthPaintBuffer=null;highDepthPaintLayerId=null;highDepthPaintPreviewDirty=false;
  if (resetHistory) { clearImageCache(); history.reset(label, snapshotDocument(doc)); }
  updateAll();
}
function commit(label) {
  touch(doc);
  const snapshot = snapshotDocument(doc);
  history.push(label, snapshot);
  markDirty(true);
  updateAll();
}
function selected() { return selectedLayer(doc); }
function isEditableRasterLayer(layer) { return !!layer && layer.type === 'raster' && !isLayerLocked(doc, layer); }
function findTopEditableRasterLayerAt(point) { return [...doc.layers].reverse().find(layer => isLayerVisible(doc, layer) && isEditableRasterLayer(layer) && pointInLayer(point, layer)) ?? null; }
function paintLayerAtPoint(point) {
  const layer = selected();
  return isEditableRasterLayer(layer) && isLayerVisible(doc, layer) && pointInLayer(point, layer) ? layer : null;
}
function documentPointToLayerPixel(point, layer) {
  const width = Math.max(1, Number(layer.width) || 1);
  const height = Math.max(1, Number(layer.height) || 1);
  const scaleX = Number(layer.scaleX) || 1;
  const scaleY = Number(layer.scaleY) || 1;
  const boundsWidth = width * scaleX;
  const boundsHeight = height * scaleY;
  const cx = layer.x + boundsWidth / 2;
  const cy = layer.y + boundsHeight / 2;
  const radians = -((layer.rotation ?? 0) * Math.PI / 180);
  const dx = point.x - cx;
  const dy = point.y - cy;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const unrotatedX = cx + dx * cos - dy * sin;
  const unrotatedY = cy + dx * sin + dy * cos;
  const localScaledX = unrotatedX - layer.x;
  const localScaledY = unrotatedY - layer.y;
  return {
    x: localScaledX / scaleX,
    y: localScaledY / scaleY,
  };
}

function layerPixelToDocumentPoint(point, layer) {
  const width = Math.max(1, Number(layer.width) || 1);
  const height = Math.max(1, Number(layer.height) || 1);
  const scaleX = Number(layer.scaleX) || 1;
  const scaleY = Number(layer.scaleY) || 1;
  const boundsWidth = width * scaleX;
  const boundsHeight = height * scaleY;
  const cx = layer.x + boundsWidth / 2;
  const cy = layer.y + boundsHeight / 2;
  const unrotatedX = layer.x + point.x * scaleX;
  const unrotatedY = layer.y + point.y * scaleY;
  const radians = (layer.rotation ?? 0) * Math.PI / 180;
  const dx = unrotatedX - cx;
  const dy = unrotatedY - cy;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function selectedEditablePathTargets(){
  if(documentPathEditIndex>=0){
    const path=doc.paths?.[documentPathEditIndex];
    if(path?.subpaths?.length){
      return path.subpaths
        .map((subpath,subpathIndex)=>({
          layer:null,points:Array.isArray(subpath?.points)?subpath.points:[],
          source:'document-path',documentPathIndex:documentPathEditIndex,subpathIndex,
          closed:subpath?.closed!==false,operation:subpath?.operation||'add',
        }))
        .filter(target=>target.points.length);
    }
    documentPathEditIndex=-1;
  }
  const layer=selected();
  if(!layer||!isLayerVisible(doc,layer))return[];
  if(vectorMaskEditLayerId===layer.id&&layer.vectorMask?.subpaths?.length){
    return layer.vectorMask.subpaths
      .map((subpath,subpathIndex)=>({
        layer,points:Array.isArray(subpath?.points)?subpath.points:[],
        source:'vector-mask',documentPathIndex:null,subpathIndex,closed:subpath?.closed!==false,operation:subpath?.operation||'add',
      }))
      .filter(target=>target.points.length);
  }
  if(layer.type==='shape'&&layer.shape==='path'&&Array.isArray(layer.pathPoints)){
    return[{layer,points:layer.pathPoints,source:'shape',documentPathIndex:null,subpathIndex:null,closed:Boolean(layer.pathClosed),operation:'add'}];
  }
  return[];
}
function pathTargetPoints(layer,source='shape',subpathIndex=null,documentPathIndex=null){
  if(source==='document-path')return doc.paths?.[documentPathIndex]?.subpaths?.[subpathIndex]?.points??null;
  if(source==='vector-mask')return layer?.vectorMask?.subpaths?.[subpathIndex]?.points??null;
  return layer?.pathPoints??null;
}
function pathControlDocumentPoint(layer,node,control='anchor'){
  const local=control==='anchor'?node:node?.[control];
  if(!local)return null;
  return layer?layerPixelToDocumentPoint(local,layer):{x:local.x,y:local.y};
}
function hitSelectedPathControl(point,radius=8/zoom){
  for(const target of selectedEditablePathTargets()){
    if(target.layer&&isLayerLocked(doc,target.layer))continue;
    for(let index=0;index<target.points.length;index+=1){
      const node=target.points[index];
      for(const control of ['handleIn','handleOut']){
        const p=pathControlDocumentPoint(target.layer,node,control);
        if(p&&Math.hypot(point.x-p.x,point.y-p.y)<=radius)return{...target,nodeIndex:index,control};
      }
    }
    for(let index=0;index<target.points.length;index+=1){
      const node=target.points[index],p=pathControlDocumentPoint(target.layer,node,'anchor');
      if(p&&Math.hypot(point.x-p.x,point.y-p.y)<=radius)return{...target,nodeIndex:index,control:'anchor'};
    }
  }
  return null;
}
function traceEditablePathTarget(ctx,target){
  const points=target?.points||[];
  if(!points.length)return false;
  const documentNodes=points.map(node=>({
    ...pathControlDocumentPoint(target.layer,node,'anchor'),
    handleIn:pathControlDocumentPoint(target.layer,node,'handleIn'),
    handleOut:pathControlDocumentPoint(target.layer,node,'handleOut'),
  }));
  ctx.moveTo(documentNodes[0].x,documentNodes[0].y);
  const segment=(from,to)=>{
    if(from.handleOut||to.handleIn){
      const cp1=from.handleOut||from,cp2=to.handleIn||to;
      ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,to.x,to.y);
    }else ctx.lineTo(to.x,to.y);
  };
  for(let index=1;index<documentNodes.length;index+=1)segment(documentNodes[index-1],documentNodes[index]);
  if(target.closed&&documentNodes.length>1){segment(documentNodes.at(-1),documentNodes[0]);ctx.closePath();}
  return true;
}
function drawSelectedPathControls(ctx){
  if(currentTool!=='pen'||penDraft)return;
  const targets=selectedEditablePathTargets();
  if(!targets.length)return;
  ctx.save();ctx.setLineDash([]);ctx.lineWidth=1/zoom;ctx.fillStyle='#f8fbff';
  for(const target of targets){
    const locked=target.layer?isLayerLocked(doc,target.layer):false;
    const vector=target.source==='vector-mask';
    const saved=target.source==='document-path';
    ctx.strokeStyle=locked?'#aeb6c4':saved?'#77e3b1':vector?'#ff78cf':'#8fc0ff';
    if(vector||saved){
      ctx.save();ctx.setLineDash([5/zoom,3/zoom]);ctx.beginPath();traceEditablePathTarget(ctx,target);ctx.stroke();ctx.restore();
    }
    for(const node of target.points){
      const anchor=pathControlDocumentPoint(target.layer,node,'anchor');
      if(!anchor)continue;
      for(const control of ['handleIn','handleOut']){
        const handle=pathControlDocumentPoint(target.layer,node,control);
        if(!handle)continue;
        ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(handle.x,handle.y);ctx.stroke();
        const size=5/zoom;ctx.fillRect(handle.x-size/2,handle.y-size/2,size,size);ctx.strokeRect(handle.x-size/2,handle.y-size/2,size,size);
      }
      ctx.beginPath();ctx.arc(anchor.x,anchor.y,4/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }
  ctx.restore();
}
function updatePenCursor(point){
  if(currentTool!=='pen'||drag||penDraft)return;
  els.overlay.style.cursor=hitSelectedPathControl(point)?'pointer':'crosshair';
}
function restorePathControlDrag(d){
  const layer=d.pathSource==='document-path'?null:doc.layers.find(item=>item.id===d.layerId);
  const points=pathTargetPoints(layer,d.pathSource,d.subpathIndex,d.documentPathIndex);
  if(!points?.[d.nodeIndex])return false;
  points[d.nodeIndex]=structuredClone(d.initial);
  render();drawOverlay();return true;
}
function beginPathControlDrag(hit,point,event){
  const points=pathTargetPoints(hit.layer,hit.source,hit.subpathIndex,hit.documentPathIndex);
  const node=points?.[hit.nodeIndex];
  if(!node)return false;
  if(hit.control==='anchor'&&event.altKey){
    const changed=Boolean(node.handleIn||node.handleOut||node.kind==='smooth');
    node.handleIn=null;node.handleOut=null;node.kind='corner';
    if(changed)commit(hit.source==='document-path'?'Преобразовать узел сохранённого контура':hit.source==='vector-mask'?'Преобразовать узел векторной маски':'Преобразовать Bézier-узел в угловой');
    else setStatus('Bézier-узел уже угловой');
    return true;
  }
  const control=hit.control==='anchor'&&event.shiftKey?'handleOut':hit.control;
  drag={
    kind:'path-control',layerId:hit.layer?.id??null,nodeIndex:hit.nodeIndex,control,
    pathSource:hit.source,documentPathIndex:hit.documentPathIndex??null,subpathIndex:hit.subpathIndex,
    startLocal:hit.layer?documentPointToLayerPixel(point,hit.layer):{...point},
    initial:structuredClone(node),moved:false,
  };
  setStatus(hit.source==='document-path'
    ? 'Сохранённый контур: перетаскивайте anchors/handles; Alt разрывает симметрию'
    : hit.source==='vector-mask'
      ? 'Векторная маска: перетаскивайте anchors/handles; Alt разрывает симметрию'
      : control==='anchor'
      ? 'Перо: перетаскивайте anchor; Shift+drag создаёт smooth handles'
      : 'Перо: перетаскивайте handle; Alt разрывает симметрию');
  return true;
}

function setSelectionShape(shape) {
  selectionShape = cloneSelectionShape(shape);
  selectionRect = selectionBounds(selectionShape);
  if (!selectionRect || selectionRect.width < 1e-6 || selectionRect.height < 1e-6) {
    selectionShape = null;
    selectionRect = null;
  }
  return selectionShape;
}

function clearSelectionState() {
  selectionShape = null;
  selectionRect = null;
  polygonDraft = null;
}

function pointInsideSelection(point) {
  if (!selectionShape) return true;
  return pointInSelection(point, selectionShape);
}

function selectionPolygonForLayer(layer) {
  if (!selectionShape) return null;
  const points = selectionPathPoints(selectionShape, 72);
  if (points.length < 3) return null;
  return points.map(point => documentPointToLayerPixel(point, layer));
}

function traceDocumentSelectionPath(ctx, shape = selectionShape) {
  if (!shape) return false;
  if (shape.type === 'rect' || shape.type === 'ellipse') {
    const rect = selectionBounds(shape);
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    ctx.beginPath();
    if (shape.type === 'ellipse') ctx.ellipse(rect.x + rect.width/2, rect.y + rect.height/2, rect.width/2, rect.height/2, 0, 0, Math.PI*2);
    else ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.closePath();
    return true;
  }
  const points = selectionPathPoints(shape);
  if (points.length < 2) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i=1;i<points.length;i+=1) ctx.lineTo(points[i].x, points[i].y);
  if (points.length >= 3) ctx.closePath();
  return true;
}

function clipContextToDocumentSelection(ctx) {
  if (!selectionShape) return;
  if (traceDocumentSelectionPath(ctx)) ctx.clip();
}

function clipContextToSelection(ctx, layer) {
  const polygon = selectionPolygonForLayer(layer);
  if (!polygon) return;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i=1;i<polygon.length;i+=1) ctx.lineTo(polygon[i].x, polygon[i].y);
  ctx.closePath();
  ctx.clip();
}

function rasterSelectionPredicate(layer) {
  if (!selectionShape) return null;
  return (x,y) => pointInsideSelection(layerPixelToDocumentPoint({x:x+.5,y:y+.5},layer));
}

function selectionIntersectsLayer(layer) {
  if (!selectionRect) return false;
  const bounds=frameBounds(layer);
  return selectionRect.x < bounds.x+bounds.width && selectionRect.x+selectionRect.width > bounds.x && selectionRect.y < bounds.y+bounds.height && selectionRect.y+selectionRect.height > bounds.y;
}

function render({ paintPreview = false } = {}) {
  const version = ++renderVersion;
  renderPending = { paintPreview, version };
  if (renderBusy || renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    drainRenderQueue();
  });
}

async function drainRenderQueue() {
  if (renderBusy || !renderPending) return;
  const request = renderPending;
  renderPending = null;
  renderBusy = true;
  try {
    const rasterOverrides = request.paintPreview && brushCanvas && brushLayerId
      ? new Map([[brushLayerId, highDepthPaintLayerId===brushLayerId ? {source:brushCanvas,skipAdjustments:true} : brushCanvas]])
      : null;
    const previewDoc = documentWithTextPreview(doc, textDraft);
    await renderDocument(renderBuffer, previewDoc, { checker: false, rasterOverrides });
    if (request.version !== renderVersion) return;
    if (els.canvas.width !== doc.width) els.canvas.width = doc.width;
    if (els.canvas.height !== doc.height) els.canvas.height = doc.height;
    const visibleCtx = els.canvas.getContext('2d', { alpha: true });
    visibleCtx.clearRect(0, 0, doc.width, doc.height);
    visibleCtx.drawImage(renderBuffer, 0, 0);
    if (textDraft?.document === doc) syncTextPreviewCanvas();
    syncBlendingPreviewCanvas();
    if (!request.paintPreview) {
      if (els.overlay.width !== doc.width) els.overlay.width = doc.width;
      if (els.overlay.height !== doc.height) els.overlay.height = doc.height;
      drawOverlay();
    }
  } catch (error) {
    console.error(error);
    setStatus(`Ошибка рендера: ${error.message}`);
  } finally {
    renderBusy = false;
    if (renderPending && !renderFrame) {
      renderFrame = requestAnimationFrame(() => {
        renderFrame = 0;
        drainRenderQueue();
      });
    }
  }
}

function schedulePaintPreview() {
  paintPreviewQueued = true;
  if (paintPreviewFrame) return;
  paintPreviewFrame = requestAnimationFrame(() => {
    paintPreviewFrame = 0;
    if (!paintPreviewQueued || !drag || drag.kind !== 'paint') return;
    paintPreviewQueued = false;
    if(highDepthPaintPreviewDirty&&highDepthPaintLayerId){
      const layer=doc.layers.find(item=>item.id===highDepthPaintLayerId);
      if(layer)refreshHighDepthPaintCanvas(layer,true);
    }
    render({ paintPreview: true });
  });
}

function cancelPaintPreview() {
  paintPreviewQueued = false;
  if (paintPreviewFrame) cancelAnimationFrame(paintPreviewFrame);
  paintPreviewFrame = 0;
}

function drawOverlay() {
  const ctx = els.overlay.getContext('2d');
  ctx.clearRect(0, 0, doc.width, doc.height);
  if (cropRect) {
    ctx.save();
    ctx.fillStyle = '#0008';
    ctx.fillRect(0, 0, doc.width, doc.height);
    ctx.clearRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / zoom; ctx.setLineDash([8 / zoom, 5 / zoom]);
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    ctx.globalAlpha = .72;
    ctx.setLineDash([4 / zoom, 5 / zoom]);
    for (const fraction of [1 / 3, 2 / 3]) {
      const x = cropRect.x + cropRect.width * fraction;
      const y = cropRect.y + cropRect.height * fraction;
      ctx.beginPath(); ctx.moveTo(x, cropRect.y); ctx.lineTo(x, cropRect.y + cropRect.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cropRect.x, y); ctx.lineTo(cropRect.x + cropRect.width, y); ctx.stroke();
    }
    ctx.restore();
  }
  if (selectionShape) {
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = '#000';
    ctx.setLineDash([6 / zoom, 6 / zoom]);
    ctx.lineDashOffset = 3 / zoom;
    if (traceDocumentSelectionPath(ctx)) ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineDashOffset = 0;
    if (traceDocumentSelectionPath(ctx)) ctx.stroke();
    ctx.restore();
  }
  if (polygonDraft?.points?.length) {
    const points=polygonDraft.points;
    ctx.save();
    ctx.lineWidth=1/zoom;
    ctx.setLineDash([5/zoom,4/zoom]);
    ctx.strokeStyle='#79a7ff';
    ctx.fillStyle='#ffffff';
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i+=1)ctx.lineTo(points[i].x,points[i].y);
    if(polygonDraft.hover)ctx.lineTo(polygonDraft.hover.x,polygonDraft.hover.y);
    ctx.stroke();
    const radius=3/zoom;
    for(const point of points){ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.restore();
  }
  if(penDraft?.points?.length){
    const points=penDraft.points;
    ctx.save();ctx.lineWidth=1.5/zoom;ctx.strokeStyle='#72a7ff';ctx.fillStyle='#fff';ctx.setLineDash([]);
    ctx.beginPath();tracePenDraftPath(ctx,points,drag?.kind==='pen-handle'?null:penDraft.hover);ctx.stroke();
    ctx.lineWidth=1/zoom;ctx.strokeStyle='#8fc0ff';
    for(const point of points){
      for(const handle of [point.handleIn,point.handleOut]){
        if(!handle)continue;
        ctx.beginPath();ctx.moveTo(point.x,point.y);ctx.lineTo(handle.x,handle.y);ctx.stroke();
        ctx.beginPath();ctx.arc(handle.x,handle.y,2.5/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }
    ctx.fillStyle='#fff';ctx.strokeStyle='#3976ea';
    for(const point of points){ctx.beginPath();ctx.arc(point.x,point.y,3/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.restore();
  } else if(magneticDraft?.points?.length){
    const points=magneticDraft.points;ctx.save();ctx.lineWidth=1.5/zoom;ctx.strokeStyle='#ff5fa8';ctx.fillStyle='#fff';ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i+=1)ctx.lineTo(points[i].x,points[i].y);if(magneticDraft.hover)ctx.lineTo(magneticDraft.hover.x,magneticDraft.hover.y);ctx.stroke();for(const point of points){ctx.beginPath();ctx.arc(point.x,point.y,2.5/zoom,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
  drawSelectedPathControls(ctx);
  if (RASTER_BRUSH_TOOLS.has(currentTool) && hoverPoint) {
    const paintLayer = paintLayerAtPoint(hoverPoint);
    const radius = Math.max(.5, Number(els.brushSize.value) / 2);
    const scaleX = Math.abs(Number(paintLayer?.scaleX) || 1);
    const scaleY = Math.abs(Number(paintLayer?.scaleY) || 1);
    const rotation = (Number(paintLayer?.rotation) || 0) * Math.PI / 180;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 3 / zoom;
    ctx.strokeStyle = '#000a';
    ctx.beginPath();ctx.ellipse(hoverPoint.x,hoverPoint.y,radius*scaleX,radius*scaleY,rotation,0,Math.PI*2);ctx.stroke();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();ctx.ellipse(hoverPoint.x,hoverPoint.y,radius*scaleX,radius*scaleY,rotation,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  if ((currentTool === 'clone' || currentTool === 'heal') && cloneSource?.documentPoint) {
    const point=cloneSource.documentPoint;
    ctx.save();ctx.strokeStyle='#65d8ff';ctx.lineWidth=1.5/zoom;ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(point.x,point.y,7/zoom,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(point.x-10/zoom,point.y);ctx.lineTo(point.x+10/zoom,point.y);ctx.moveTo(point.x,point.y-10/zoom);ctx.lineTo(point.x,point.y+10/zoom);ctx.stroke();ctx.restore();
  }
  if (currentTool === 'move' && drag?.kind === 'move' && (smartGuides.x !== null || smartGuides.y !== null)) {
    ctx.save();
    ctx.strokeStyle = '#ff61d8';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 3 / zoom]);
    if (smartGuides.x !== null) {
      ctx.beginPath(); ctx.moveTo(smartGuides.x, 0); ctx.lineTo(smartGuides.x, doc.height); ctx.stroke();
    }
    if (smartGuides.y !== null) {
      ctx.beginPath(); ctx.moveTo(0, smartGuides.y); ctx.lineTo(doc.width, smartGuides.y); ctx.stroke();
    }
    ctx.restore();
  }
  const layer = textDraft?.document === doc ? textDraft.layer : selected();
  if (!layer || !isLayerVisible(doc, layer) || !isTransformableLayer(layer)) return;
  const frame = layerFrame(layer);
  const moveMode=currentTool==='move';
  const accent=isLayerLocked(doc,layer)?'#aeb6c4':moveMode?'#69a0ff':'#5ee7ff';
  ctx.save();
  ctx.strokeStyle='#000c';ctx.lineWidth=4/zoom;ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(frame.corners[0].x, frame.corners[0].y);
  for (let i = 1; i < frame.corners.length; i += 1) ctx.lineTo(frame.corners[i].x, frame.corners[i].y);
  ctx.closePath(); ctx.stroke();
  ctx.strokeStyle=accent;ctx.lineWidth=1.5/zoom;ctx.setLineDash(moveMode?[6/zoom,4/zoom]:[]);ctx.stroke();
  if(moveMode&&!isLayerLocked(doc, layer)) {
    ctx.fillStyle = '#f8fbff'; ctx.strokeStyle = '#3976ea'; ctx.setLineDash([]);
    const size = 8 / zoom;
    for (const point of Object.values(frame.handles)) {
      ctx.fillRect(point.x-size/2, point.y-size/2, size, size);
      ctx.strokeRect(point.x-size/2, point.y-size/2, size, size);
    }
    const rotatePoint = interactiveRotationHandlePoint(layer);
    ctx.beginPath(); ctx.moveTo(frame.handles.n.x, frame.handles.n.y); ctx.lineTo(rotatePoint.x, rotatePoint.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(rotatePoint.x, rotatePoint.y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }else{
    ctx.fillStyle=accent;ctx.strokeStyle='#071018';ctx.lineWidth=1/zoom;ctx.setLineDash([]);const radius=3.5/zoom;
    for(const point of frame.corners){ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
  }
  const label=String(layer.name||'Слой');ctx.font=`600 ${12/zoom}px Inter, Arial, sans-serif`;const paddingX=7/zoom,paddingY=5/zoom,labelWidth=ctx.measureText(label).width+paddingX*2,labelHeight=22/zoom;const bounds=frameBounds(layer);const labelX=clamp(bounds.x,2/zoom,Math.max(2/zoom,doc.width-labelWidth-2/zoom));const labelY=clamp(bounds.y-labelHeight-5/zoom,2/zoom,Math.max(2/zoom,doc.height-labelHeight-2/zoom));ctx.fillStyle='#101722ee';ctx.strokeStyle=accent;ctx.lineWidth=1/zoom;ctx.beginPath();ctx.roundRect(labelX,labelY,labelWidth,labelHeight,5/zoom);ctx.fill();ctx.stroke();ctx.fillStyle='#f6fbff';ctx.textBaseline='middle';ctx.fillText(label,labelX+paddingX,labelY+labelHeight/2);
  ctx.restore();
}

function updateCanvasSize() {
  els.shell.style.width = `${doc.width * zoom}px`;
  els.shell.style.height = `${doc.height * zoom}px`;
  els.canvas.style.width = `${doc.width * zoom}px`; els.canvas.style.height = `${doc.height * zoom}px`;
  els.overlay.style.width = `${doc.width * zoom}px`; els.overlay.style.height = `${doc.height * zoom}px`;
  els.canvas.style.imageRendering = zoom >= 4 ? 'pixelated' : 'auto';
  els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  els.zoomRange.value = String(Math.round(zoom * 100));
}

function updateAll() {
  syncCurrentSession();
  els.title.textContent = doc.name;
  els.dimensions.textContent = `${doc.width} × ${doc.height}`;
  els.undo.disabled = !history.canUndo(); els.redo.disabled = !history.canRedo();
  els.emptyDrop.hidden = doc.layers.length > 0;
  updateCanvasSize(); updateLayers(); updatePathsPanel(); updateHistory(); refreshInspectorPanels(); updateLayerControls(); render();
  renderDocumentTabs();
}

function moveLayerRelativeToTarget(layerId, targetId, aboveInDisplay) {
  if (layerId === targetId) return false;
  const sourceIndex = doc.layers.findIndex(item => item.id === layerId);
  const targetLayer = doc.layers.find(item => item.id === targetId);
  if (sourceIndex < 0 || !targetLayer) return false;
  const beforeOrder = doc.layers.map(item => item.id).join('|');
  const source = doc.layers[sourceIndex];
  if (isLayerLocked(doc, source)) return false;
  const targetGroup = targetLayer.groupId ? doc.groups?.find(group => group.id === targetLayer.groupId) : null;
  if (targetGroup && isGroupLocked(doc, targetGroup)) return false;
  const beforeGroupId = source.groupId ?? null;
  doc.layers.splice(sourceIndex, 1);
  const targetIndex = doc.layers.findIndex(item => item.id === targetId);
  if (targetIndex < 0) {
    doc.layers.splice(Math.min(sourceIndex, doc.layers.length), 0, source);
    return false;
  }
  source.groupId = targetLayer.groupId ?? null;
  const insertIndex = aboveInDisplay ? targetIndex + 1 : targetIndex;
  doc.layers.splice(insertIndex, 0, source);
  const changed = beforeOrder !== doc.layers.map(item => item.id).join('|') || beforeGroupId !== (source.groupId ?? null);
  if (changed) touch(doc);
  return changed;
}

function moveLayerToRootTop(layerId) {
  const index = doc.layers.findIndex(item => item.id === layerId);
  if (index < 0) return false;
  const layer = doc.layers[index];
  if (isLayerLocked(doc, layer)) return false;
  const beforeGroupId = layer.groupId ?? null;
  const alreadyTop = index === doc.layers.length - 1;
  if (beforeGroupId == null && alreadyTop) return false;
  doc.layers.splice(index, 1);
  layer.groupId = null;
  doc.layers.push(layer);
  touch(doc);
  return true;
}

function clearLayerDragDecorations() {
  els.layers.classList.remove('drop-root');
  els.layers.querySelectorAll('.layer-row,.layer-group-row').forEach(item => item.classList.remove('dragging','drop-before','drop-after','drop-into'));
}

function updateLayers() {
  els.layers.replaceChildren();
  if (!Array.isArray(doc.groups)) doc.groups = [];
  const groupsById = new Map(doc.groups.map(group => [group.id, group]));
  const displayLayers = [...doc.layers].reverse();
  const displayIndex = new Map(displayLayers.map((layer,index) => [layer.id,index]));
  const membersByGroup = new Map();
  const childrenByParent = new Map();

  for (const group of doc.groups) {
    const parentId = group.parentGroupId && groupsById.has(group.parentGroupId) ? group.parentGroupId : null;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(group);
  }
  for (const layer of displayLayers) {
    const groupId = layer.groupId && groupsById.has(layer.groupId) ? layer.groupId : null;
    if (!membersByGroup.has(groupId)) membersByGroup.set(groupId, []);
    membersByGroup.get(groupId).push(layer);
  }

  const groupRankCache = new Map();
  const groupRank = group => {
    if (groupRankCache.has(group.id)) return groupRankCache.get(group.id);
    let rank = Number.POSITIVE_INFINITY;
    for (const layer of displayLayers) {
      let current = layer.groupId ? groupsById.get(layer.groupId) : null;
      const seen = new Set();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        if (current.id === group.id) {
          rank = Math.min(rank, displayIndex.get(layer.id) ?? Number.POSITIVE_INFINITY);
          break;
        }
        current = current.parentGroupId ? groupsById.get(current.parentGroupId) : null;
      }
    }
    groupRankCache.set(group.id, rank);
    return rank;
  };

  const appendLayerRow = (layer, { depth = 0 } = {}) => {
    const group = layer.groupId ? groupsById.get(layer.groupId) : null;
    const groupHidden = Boolean(group && !isGroupVisible(doc, group));
    const groupLocked = Boolean(group && isGroupLocked(doc, group));
    const effectiveLocked = isLayerLocked(doc, layer);
    const row = document.createElement('div');
    row.className = `layer-row${depth > 0 ? ' in-group' : ''}${groupHidden ? ' group-hidden' : ''}${groupLocked ? ' group-locked' : ''}${layer.id === doc.selectedLayerId ? ' selected' : ''}`;
    row.style.setProperty('--layer-depth', String(depth));
    row.dataset.id = layer.id; row.setAttribute('role','option'); row.setAttribute('aria-selected', String(layer.id === doc.selectedLayerId));
    row.tabIndex = layer.id === doc.selectedLayerId ? 0 : -1;
    const eye = document.createElement('button'); eye.className = 'layer-eye'; eye.textContent = layer.visible ? '◉' : '○';
    eye.title = groupHidden ? 'Родительская группа скрыта; переключить собственную видимость слоя' : layer.visible ? 'Скрыть' : 'Показать';
    eye.setAttribute('aria-label', eye.title);
    eye.onclick = (e) => { e.stopPropagation(); layer.visible = !layer.visible; commit(layer.visible ? 'Показать слой' : 'Скрыть слой'); };
    const thumb = document.createElement('div'); thumb.className = 'layer-thumb';
    if ((layer.type === 'raster' && layer.dataUrl) || (layer.type === 'smart-object' && layer.previewDataUrl)) { const img = new Image(); img.src = layer.type === 'smart-object' ? layer.previewDataUrl : layer.dataUrl; thumb.append(img); }
    else thumb.textContent = layer.type === 'text' ? 'T' : layer.type === 'shape' ? '▭' : layer.type === 'adjustment' ? '◐' : layer.type === 'smart-object' ? '◇' : '▦';
    if (layer.type === 'smart-object') { thumb.title='Двойной клик: редактировать содержимое смарт-объекта'; thumb.ondblclick=e=>{e.stopPropagation();openSmartObjectContents(layer);}; }
    const maskHints=[];
    if(layer.mask)maskHints.push(layer.mask.enabled===false?'Растровая маска отключена':layer.mask.dataUrl?'Есть растровая маска':'Растровая маска: показать всё');
    if(layer.vectorMask)maskHints.push(`Векторная маска: ${layer.vectorMask.subpaths?.length||0} контур(ов)${layer.vectorMask.enabled===false?' · отключена':''}${layer.vectorMask.invert?' · инвертирована':''}`);
    if(layer.smartFilterMask)maskHints.push(`Маска смарт-фильтров${layer.smartFilterMask.enabled===false?' · отключена':''}${layer.smartFilterMask.invert?' · инвертирована':''}`);
    if(maskHints.length)thumb.title=[thumb.title,...maskHints].filter(Boolean).join(' · ');
    const name = document.createElement('div'); name.className = 'layer-name'; name.textContent = layer.name; name.title = layer.name;
    name.ondblclick = (e) => { e.stopPropagation(); renameLayer(layer); };
    const lock = document.createElement('button'); lock.className = 'layer-lock';
    lock.textContent = effectiveLocked ? '🔒' : '·';
    lock.title = groupLocked ? 'Слой заблокирован одной из родительских групп' : layer.locked ? 'Разблокировать' : 'Заблокировать';
    lock.setAttribute('aria-label', lock.title);
    lock.disabled = groupLocked;
    lock.onclick = (e) => { e.stopPropagation(); layer.locked = !layer.locked; commit(layer.locked ? 'Заблокировать слой' : 'Разблокировать слой'); };
    row.append(eye, thumb, name, lock);
    row.onclick = () => { doc.selectedLayerId = layer.id; updateAll(); };
    row.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      if (blockPendingDocumentEdit()) return;
      if (doc.selectedLayerId !== layer.id) { doc.selectedLayerId = layer.id; updateAll(); }
      const focusRow=[...els.layers.querySelectorAll('.layer-row')].find(item=>item.dataset.id===layer.id);
      openContextMenu(`layer:${layer.id}`, layerContextMenu(layer.id), e, focusRow);
    });
    row.addEventListener('keydown', e => {
      if (e.target !== row) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        selectAdjacentLayer(e.key === 'ArrowUp' ? 1 : -1, { focus: true });
        return;
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault(); e.stopPropagation();
        const next = e.key === 'Home' ? doc.layers.at(-1) : doc.layers[0];
        if (next) { doc.selectedLayerId = next.id; updateAll(); requestAnimationFrame(focusSelectedLayerRow); }
        return;
      }
      if (e.key === 'Enter' || e.code === 'F2') {
        e.preventDefault(); e.stopPropagation(); renameLayer(layer); return;
      }
      if (e.key === 'Delete') {
        e.preventDefault(); e.stopPropagation(); deleteSelected(); requestAnimationFrame(focusSelectedLayerRow);
      }
    });
    row.draggable = !effectiveLocked;
    row.addEventListener('dragstart', e => {
      if (isLayerLocked(doc, layer)) { e.preventDefault(); setStatus('Слой или его группа заблокированы'); return; }
      layerDragId = layer.id;
      doc.selectedLayerId = layer.id;
      row.classList.add('dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', layer.id); }
    });
    row.addEventListener('dragover', e => {
      if (!layerDragId || layerDragId === layer.id || groupLocked) return;
      e.preventDefault(); e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const before = e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      row.classList.toggle('drop-before', before);
      row.classList.toggle('drop-after', !before);
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-before','drop-after'));
    row.addEventListener('drop', e => {
      if (!layerDragId || layerDragId === layer.id || groupLocked) return;
      e.preventDefault(); e.stopPropagation();
      const before = e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      if (moveLayerRelativeToTarget(layerDragId, layer.id, before)) commit('Изменить порядок слоёв');
      row.classList.remove('drop-before','drop-after');
    });
    row.addEventListener('dragend', () => {
      layerDragId = null;
      clearLayerDragDecorations();
    });
    els.layers.append(row);
  };

  const appendGroupRow = (group, members, depth) => {
    const effectiveVisible = isGroupVisible(doc, group);
    const effectiveLocked = isGroupLocked(doc, group);
    const parent = group.parentGroupId ? groupsById.get(group.parentGroupId) : null;
    const ancestorLocked = Boolean(parent && isGroupLocked(doc, parent));
    const ancestorHidden = Boolean(parent && !isGroupVisible(doc, parent));
    const row = document.createElement('div');
    row.className = `layer-group-row${!effectiveVisible ? ' group-hidden' : ''}${effectiveLocked ? ' group-locked' : ''}`;
    row.style.setProperty('--group-depth', String(depth));
    row.dataset.groupId = group.id;
    row.tabIndex = 0;
    row.setAttribute('role','group');
    row.setAttribute('aria-label', `${group.name}, уровень ${depth + 1}, ${members.length} прямых слоёв`);

    const eye = document.createElement('button');
    eye.className = 'layer-eye layer-group-eye';
    eye.textContent = group.visible === false ? '○' : '◉';
    eye.title = ancestorHidden ? 'Родительская группа скрыта; переключить собственную видимость' : group.visible === false ? 'Показать группу' : 'Скрыть группу';
    eye.setAttribute('aria-label', eye.title);
    eye.onclick = e => {
      e.stopPropagation();
      group.visible = group.visible === false;
      commit(group.visible ? 'Показать группу слоёв' : 'Скрыть группу слоёв');
    };

    const toggle = document.createElement('button'); toggle.className = 'layer-group-toggle';
    toggle.textContent = group.collapsed ? '▸' : '▾';
    toggle.title = group.collapsed ? 'Развернуть группу' : 'Свернуть группу';
    toggle.setAttribute('aria-expanded', String(!group.collapsed));
    toggle.onclick = e => { e.stopPropagation(); group.collapsed = !group.collapsed; updateLayers(); };

    const thumb = document.createElement('div'); thumb.className = 'layer-thumb layer-group-thumb'; thumb.textContent = '▰';

    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'layer-name layer-group-name';
    name.textContent = group.name;
    const groupMode=group.blendMode==='pass-through'?'Pass Through':(group.blendMode||'source-over');
    name.title = `${group.name} · уровень ${depth + 1} · ${members.length} прямых слоёв · ${Math.round((group.opacity??1)*100)}% · ${groupMode} · клик: свернуть/развернуть · двойной клик: переименовать`;
    name.onclick = e => { e.stopPropagation(); group.collapsed = !group.collapsed; updateLayers(); };
    name.ondblclick = e => { e.preventDefault(); e.stopPropagation(); renameGroup(group); };

    const lock = document.createElement('button');
    lock.className = 'layer-lock layer-group-lock';
    lock.textContent = effectiveLocked ? '🔒' : '·';
    lock.title = ancestorLocked ? 'Группа заблокирована родительской группой' : group.locked ? 'Разблокировать группу' : 'Заблокировать группу';
    lock.setAttribute('aria-label', lock.title);
    lock.disabled = ancestorLocked;
    lock.onclick = e => {
      e.stopPropagation();
      if (ancestorLocked) return;
      group.locked = !group.locked;
      commit(group.locked ? 'Заблокировать группу слоёв' : 'Разблокировать группу слоёв');
    };

    const remove = document.createElement('button'); remove.className = 'layer-group-remove'; remove.textContent = '×';
    remove.title = 'Удалить группу (содержимое останется)';
    remove.setAttribute('aria-label', remove.title);
    remove.disabled = effectiveLocked;
    remove.onclick = e => { e.stopPropagation(); deleteLayerGroup(group); };

    row.append(eye, toggle, thumb, name, lock, remove);
    row.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      openContextMenu(`group:${group.id}`, groupContextMenu(group.id), e, row);
    });
    row.draggable = !effectiveLocked;
    row.addEventListener('dragstart', e => {
      if (effectiveLocked) { e.preventDefault(); setStatus('Группа или её родитель заблокированы'); return; }
      groupDragId = group.id;
      layerDragId = null;
      row.classList.add('dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', `group:${group.id}`); }
    });
    row.addEventListener('dragover', e => {
      const draggingLayer = Boolean(layerDragId);
      const draggingGroup = Boolean(groupDragId && groupDragId !== group.id);
      if ((!draggingLayer && !draggingGroup) || effectiveLocked) return;
      e.preventDefault(); e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      row.classList.add('drop-into');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-into'));
    row.addEventListener('drop', e => {
      if (effectiveLocked) return;
      const draggedLayerId = layerDragId;
      const draggedGroupId = groupDragId;
      if (!draggedLayerId && (!draggedGroupId || draggedGroupId === group.id)) return;
      e.preventDefault(); e.stopPropagation();
      row.classList.remove('drop-into');
      if (draggedLayerId && moveLayerIntoGroup(doc, draggedLayerId, group.id)) {
        group.collapsed = false;
        commit('Переместить слой в группу');
        return;
      }
      if (draggedGroupId) {
        if (moveLayerGroupIntoGroup(doc, draggedGroupId, group.id)) {
          group.collapsed = false;
          commit('Переместить группу в группу');
        } else {
          setStatus('Нельзя вложить группу в саму себя, потомка или заблокированную группу');
        }
      }
    });
    row.addEventListener('dragend', () => {
      groupDragId = null;
      clearLayerDragDecorations();
    });
    els.layers.append(row);
  };

  const renderLevel = (parentGroupId = null, depth = 0) => {
    const entries = [];
    for (const group of childrenByParent.get(parentGroupId) || []) {
      entries.push({ type:'group', group, rank:groupRank(group), order:doc.groups.indexOf(group) });
    }
    for (const layer of membersByGroup.get(parentGroupId) || []) {
      entries.push({ type:'layer', layer, rank:displayIndex.get(layer.id) ?? Number.POSITIVE_INFINITY, order:displayIndex.get(layer.id) ?? 0 });
    }
    entries.sort((a,b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.type !== b.type) return a.type === 'group' ? -1 : 1;
      return a.order - b.order;
    });
    for (const entry of entries) {
      if (entry.type === 'layer') {
        appendLayerRow(entry.layer,{depth});
        continue;
      }
      const group = entry.group;
      appendGroupRow(group,membersByGroup.get(group.id)||[],depth);
      if (!group.collapsed) renderLevel(group.id,depth+1);
    }
  };

  renderLevel(null,0);
}


function normalizeSelectedDocumentPathIndex(){
  const paths=Array.isArray(doc.paths)?doc.paths:[];
  if(!paths.length){selectedDocumentPathIndex=-1;documentPathEditIndex=-1;return -1;}
  if(!Number.isInteger(selectedDocumentPathIndex)||selectedDocumentPathIndex<0||selectedDocumentPathIndex>=paths.length)selectedDocumentPathIndex=0;
  if(documentPathEditIndex>=paths.length)documentPathEditIndex=-1;
  return selectedDocumentPathIndex;
}
function selectedDocumentPath(){
  const index=normalizeSelectedDocumentPathIndex();
  return index>=0?doc.paths[index]:null;
}
function allocateDocumentPathResourceId(){
  const used=new Set((doc.paths||[]).map(path=>path?.id).filter(id=>Number.isInteger(id)&&id>=2000&&id<=2997));
  for(let id=2000;id<=2997;id+=1)if(!used.has(id))return id;
  return null;
}
function uniqueDocumentPathName(base='Контур'){
  const names=new Set((doc.paths||[]).map(path=>String(path?.name||'').trim()).filter(Boolean));
  const root=String(base||'Контур').trim().slice(0,220)||'Контур';
  if(!names.has(root))return root;
  let index=2;
  while(names.has(`${root} ${index}`))index+=1;
  return `${root} ${index}`;
}
function documentizePathNode(node,layer){
  const anchor=layerPixelToDocumentPoint(node,layer);
  return{
    x:anchor.x,y:anchor.y,
    handleIn:node.handleIn?layerPixelToDocumentPoint(node.handleIn,layer):null,
    handleOut:node.handleOut?layerPixelToDocumentPoint(node.handleOut,layer):null,
    kind:node.kind==='smooth'?'smooth':'corner',
  };
}
function pathFromCurrentSource(){
  const layer=selected();
  if(layer?.vectorMask?.subpaths?.length){
    const vector=exportPsdVectorMask(layer);
    return{
      name:uniqueDocumentPathName(`${layer.name||'Слой'} — маска`),
      fillStartsWithAllPixels:vector.fillStartsWithAllPixels===true,
      subpaths:structuredClone(vector.subpaths),
    };
  }
  if(layer?.type==='shape'&&layer.shape==='path'&&Array.isArray(layer.pathPoints)&&layer.pathPoints.length>=2){
    return{
      name:uniqueDocumentPathName(`${layer.name||'Контур'} — путь`),
      fillStartsWithAllPixels:false,
      subpaths:[{
        operation:'add',closed:Boolean(layer.pathClosed),fillRule:'non-zero',
        points:layer.pathPoints.map(node=>documentizePathNode(node,layer)),
      }],
    };
  }
  if(selectionShape){
    const nodes=selectionVectorMaskDocumentNodes();
    if(nodes.length>=3){
      return{
        name:uniqueDocumentPathName('Контур из выделения'),
        fillStartsWithAllPixels:false,
        subpaths:[{operation:'add',closed:true,fillRule:'non-zero',points:nodes.map(node=>structuredClone(node))}],
      };
    }
  }
  return null;
}
function addDocumentPathFromCurrent(){
  if((doc.paths?.length||0)>=998){setStatus('Достигнут лимит 998 сохранённых контуров');toast('Нельзя сохранить больше 998 Photoshop-compatible paths','warn');return false;}
  const path=pathFromCurrentSource();
  if(!path){setStatus('Нужен path-слой, векторная маска или активное выделение');toast('Нечего сохранять как контур','warn');return false;}
  const id=allocateDocumentPathResourceId();
  if(id===null){setStatus('Исчерпан диапазон Photoshop Path Resource ID 2000..2997');return false;}
  doc.paths??=[];
  doc.paths.push({id,...path});
  selectedDocumentPathIndex=doc.paths.length-1;
  commit('Сохранить контур');
  setStatus(`Сохранён контур «${path.name}»`);
  return true;
}
function renameSelectedDocumentPath(){
  const path=selectedDocumentPath();
  if(!path)return;
  const targetIndex=selectedDocumentPathIndex;
  showModal({
    title:'Переименовать контур',
    fields:[{name:'name',label:'Имя',value:path.name||'Контур',required:true}],
    submitLabel:'Переименовать',
    onSubmit:values=>{
      const target=doc.paths?.[targetIndex];
      const name=String(values.name||'').trim().slice(0,240);
      if(!target||!name||name===target.name)return false;
      target.name=name;selectedDocumentPathIndex=targetIndex;commit('Переименовать контур');
    },
  });
}
function duplicateSelectedDocumentPath(){
  const path=selectedDocumentPath();
  if(!path)return false;
  if((doc.paths?.length||0)>=998){setStatus('Достигнут лимит 998 сохранённых контуров');return false;}
  const id=allocateDocumentPathResourceId();
  if(id===null)return false;
  const copy=structuredClone(path);
  copy.id=id;
  copy.name=uniqueDocumentPathName(`${path.name||'Контур'} — копия`);
  doc.paths.push(copy);
  selectedDocumentPathIndex=doc.paths.length-1;
  commit('Дублировать контур');
  return true;
}
function deleteSelectedDocumentPath(){
  const index=normalizeSelectedDocumentPathIndex();
  if(index<0)return false;
  const name=doc.paths[index]?.name||'Контур';
  doc.paths.splice(index,1);
  if(documentPathEditIndex===index)documentPathEditIndex=-1;
  else if(documentPathEditIndex>index)documentPathEditIndex-=1;
  selectedDocumentPathIndex=Math.min(index,doc.paths.length-1);
  commit('Удалить контур');
  setStatus(`Удалён контур «${name}»`);
  return true;
}
function editSelectedDocumentPath(){
  const index=normalizeSelectedDocumentPathIndex();
  if(index<0)return false;
  vectorMaskEditLayerId=null;
  documentPathEditIndex=index;
  setTool('pen');
  documentPathEditIndex=index;
  drawOverlay();
  setStatus(`Перо: редактирование сохранённого контура «${doc.paths[index].name||'Контур'}»`);
  return true;
}
function applySelectedDocumentPathAsVectorMask(){
  const path=selectedDocumentPath();
  const layer=selected();
  if(!path){setStatus('Выберите сохранённый контур');return false;}
  if(!layer){setStatus('Выберите слой для векторной маски');return false;}
  if(layer.type==='adjustment'){setStatus('Сохранённый контур как vector mask пока применяется к обычным слоям, не к adjustment layer');return false;}
  if(isLayerLocked(doc,layer)){setStatus('Слой или его группа заблокированы');return false;}
  const mask=importPsdVectorMask({enabled:true,invert:false,linked:true,fillStartsWithAllPixels:path.fillStartsWithAllPixels===true,subpaths:path.subpaths},layer);
  if(!mask){setStatus('Контур не содержит пригодных subpaths');return false;}
  layer.vectorMask=mask;
  vectorMaskEditLayerId=null;
  commit('Применить контур как векторную маску');
  setStatus(`Контур «${path.name||'Контур'}» применён как векторная маска`);
  return true;
}
function pathContextMenu(index){
  const exists=()=>Boolean(doc.paths?.[index]);
  return[
    ['Редактировать пером','',()=>{selectedDocumentPathIndex=index;editSelectedDocumentPath();},exists],
    ['Применить как векторную маску','',()=>{selectedDocumentPathIndex=index;applySelectedDocumentPathAsVectorMask();},()=>exists()&&Boolean(selected())&&selected().type!=='adjustment'&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Переименовать…','',()=>{selectedDocumentPathIndex=index;renameSelectedDocumentPath();},exists],
    ['Дублировать','',()=>{selectedDocumentPathIndex=index;duplicateSelectedDocumentPath();},exists],
    ['Удалить','',()=>{selectedDocumentPathIndex=index;deleteSelectedDocumentPath();},exists],
  ];
}
function updatePathsPanel(){
  if(!els.paths)return;
  const paths=Array.isArray(doc.paths)?doc.paths:[];
  normalizeSelectedDocumentPathIndex();
  els.paths.replaceChildren();
  if(!paths.length){
    const empty=document.createElement('div');empty.className='paths-empty';empty.textContent='Нет сохранённых контуров';els.paths.append(empty);
  }else{
    paths.forEach((path,index)=>{
      const row=document.createElement('button');row.type='button';row.className=`path-row${index===selectedDocumentPathIndex?' selected':''}`;
      row.setAttribute('role','option');row.setAttribute('aria-selected',String(index===selectedDocumentPathIndex));
      const name=document.createElement('span');name.className='path-row-name';name.textContent=path.name||`Контур ${index+1}`;
      const count=(path.subpaths||[]).reduce((sum,subpath)=>sum+(subpath.points?.length||0),0);
      const meta=document.createElement('span');meta.className='path-row-meta';meta.textContent=`${path.subpaths?.length||0} конт. · ${count} узл. · #${path.id??'auto'}`;
      row.append(name,meta);
      row.onclick=()=>{
        selectedDocumentPathIndex=index;
        if(documentPathEditIndex>=0&&currentTool==='pen')documentPathEditIndex=index;
        updatePathsPanel();drawOverlay();
      };
      row.ondblclick=event=>{event.preventDefault();selectedDocumentPathIndex=index;renameSelectedDocumentPath();};
      row.oncontextmenu=event=>{
        event.preventDefault();event.stopPropagation();selectedDocumentPathIndex=index;updatePathsPanel();
        openContextMenu(`path:${index}`,pathContextMenu(index),event,row);
      };
      row.onkeydown=event=>{
        if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
        event.preventDefault();
        const next=clamp(index+(event.key==='ArrowDown'?1:-1),0,paths.length-1);
        selectedDocumentPathIndex=next;
        updatePathsPanel();
        requestAnimationFrame(()=>els.paths.querySelectorAll('.path-row')[next]?.focus());
        drawOverlay();
      };
      els.paths.append(row);
    });
  }
  const path=selectedDocumentPath();
  const layer=selected();
  const canSave=Boolean(selectionShape||layer?.vectorMask?.subpaths?.length||(layer?.type==='shape'&&layer.shape==='path'&&layer.pathPoints?.length>=2))&&paths.length<998;
  const controls={
    addPathBtn:canSave,
    editPathBtn:Boolean(path),
    applyPathMaskBtn:Boolean(path&&layer&&layer.type!=='adjustment'&&!isLayerLocked(doc,layer)),
    renamePathBtn:Boolean(path),
    duplicatePathBtn:Boolean(path&&paths.length<998),
    deletePathBtn:Boolean(path),
  };
  for(const [id,enabled] of Object.entries(controls)){const button=$(`#${id}`);if(button)button.disabled=!enabled;}
}

function updateHistory() {
  els.history.replaceChildren();
  history.entries.forEach((entry, index) => {
    const row = document.createElement('button'); row.type='button'; row.className = `history-row${index === history.index ? ' current' : ''}`;
    row.textContent = `${index === history.index ? '● ' : ''}${entry.label}`;
    row.title = index === history.index ? 'Текущее состояние' : 'Перейти к этому состоянию';
    row.disabled = index === history.index;
    row.onclick = () => jumpToHistory(index);
    els.history.append(row);
  });
  els.history.scrollTop = els.history.scrollHeight;
}

function jumpToHistory(index) {
  if (blockPendingDocumentEdit()) return;
  const entry = history.jump(index);
  if (!entry) return;
  doc = restoreDocument(entry.snapshot);
  brushCanvas=null; brushCtx=null; brushLayerId=null; cropRect=null; clearSelectionState();
  updateAll(); markDirty(true); setStatus(`История → ${entry.label}`);
}

function updateLayerControls() {
  const layer = selected();
  const editable = Boolean(layer) && !isLayerLocked(doc, layer);
  els.blend.disabled = !editable; els.layerOpacity.disabled = !editable;
  for (const id of ['renameLayerBtn','duplicateLayerBtn','deleteLayerBtn','layerUpBtn','layerDownBtn','resetColorEffectsBtn']) {
    const control = $(`#${id}`);
    if (control) control.disabled = !editable;
  }
  if (layer) { els.blend.value = layer.blendMode || 'source-over'; els.layerOpacity.value = String(Math.round((layer.opacity ?? 1) * 100)); }
}

function propField(label, key, value, type='number', attrs='') {
  return `<label for="prop-${key}">${label}</label><input id="prop-${key}" data-prop="${key}" type="${type}" value="${String(value).replaceAll('"','&quot;')}" ${attrs}>`;
}
const TEXT_WEIGHT_OPTIONS = [['400', 'Обычный'], ['700', 'Жирный']];
const TEXT_STYLE_OPTIONS = [['normal', 'Прямой'], ['italic', 'Курсив']];
const TEXT_ALIGN_OPTIONS = [['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']];
let localTextFonts = [];
const customFontReads = new WeakMap();
function textFontOptions(value, label = '') {
  const options = [...els.fontFamily.options].map(option => [option.value, option.textContent]);
  for (const [font, name] of localTextFonts) if (!options.some(([option]) => option === font)) options.push([font, name]);
  if (value && !options.some(([font]) => font === value)) options.push([value, label ? `Свой: ${label}` : value.replace(/^"(.*)"$/, '$1')]);
  return options;
}
async function loadComputerFonts(select) {
  if (typeof window.queryLocalFonts !== 'function') throw new Error('Этот браузер не показывает список шрифтов компьютера. Можно загрузить файл шрифта ниже.');
  let faces;
  try { faces = await window.queryLocalFonts(); }
  catch { throw new Error('Браузер не разрешил доступ к шрифтам компьютера. Разрешите доступ или загрузите файл шрифта.'); }
  const names = [...new Set(faces.map(face => face.family).filter(name => typeof name === 'string' && name.trim() && name.length <= 160))];
  names.sort((a, b) => a.localeCompare(b, 'ru'));
  localTextFonts = names.slice(0, 1000).map(name => [JSON.stringify(name), name]);
  const current = select.value;
  for (const [value, name] of localTextFonts) {
    if ([...select.options].some(option => option.value === value)) continue;
    const option = document.createElement('option'); option.value = value; option.textContent = name; select.append(option);
  }
  select.value = current;
  return localTextFonts.length;
}
async function readCustomTextFont(file) {
  if (!(file instanceof File) || !file.name) return null;
  if (customFontReads.has(file)) return customFontReads.get(file);
  const loading = loadCustomTextFont(file).catch(error => { customFontReads.delete(file); throw error; });
  customFontReads.set(file, loading);
  return loading;
}
async function loadCustomTextFont(file) {
  const extension = file.name.toLowerCase().match(/\.(woff2?|ttf|otf)$/)?.[1];
  if (!extension || !file.size || file.size > 5_000_000) throw new Error('Выберите файл WOFF, WOFF2, TTF или OTF размером до 5 МБ');
  const fontData = (await readFileAsDataURL(file)).replace(/^data:[^,]*,/, `data:font/${extension};base64,`);
  const fontFamily = `ZPE-font-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  try { await ensureTextFont(fontFamily, fontData); }
  catch { throw new Error('Не удалось открыть файл шрифта'); }
  return { fontFamily, fontData, fontLabel: file.name.slice(0, 160) };
}
function textModalFields(layer, width) {
  const fontFamily = layer?.fontFamily || els.fontFamily.value;
  return [
    {name:'text',label:'Текст',type:'textarea',value:layer?.text || 'Текст'},
    {name:'fontFamily',label:'Шрифт',type:'select',value:fontFamily,options:textFontOptions(fontFamily, layer?.fontLabel)},
    {name:'computerFonts',label:'Шрифты ПК',type:'fontPicker'},
    {name:'systemFontName',label:'Или имя шрифта ПК',type:'text',value:'',placeholder:'Например, Segoe UI'},
    {name:'fontFile',label:'Свой шрифт',type:'file',accept:'.woff,.woff2,.ttf,.otf'},
    {name:'fontSize',label:'Размер, px',type:'number',value:layer?.fontSize || els.fontSize.value,min:'6',max:'500'},
    {name:'fontWeight',label:'Начертание',type:'select',value:layer?.fontWeight || '400',options:TEXT_WEIGHT_OPTIONS},
    {name:'fontStyle',label:'Стиль',type:'select',value:layer?.fontStyle || 'normal',options:TEXT_STYLE_OPTIONS},
    {name:'align',label:'Выравнивание',type:'select',value:layer?.align || 'left',options:TEXT_ALIGN_OPTIONS},
    {name:'lineHeight',label:'Межстрочный',type:'number',value:layer?.lineHeight ?? 1.18,min:'0.8',max:'3',step:'0.01'},
    {name:'letterSpacing',label:'Межбуквенный, px',type:'number',value:layer?.letterSpacing ?? 0,min:'-5',max:'20',step:'0.5'},
    {name:'underline',label:'Подчёркивание',type:'select',value:layer?.underline ? 'yes' : 'no',options:[['no','Нет'],['yes','Да']]},
    {name:'strikeThrough',label:'Зачёркивание',type:'select',value:layer?.strikeThrough ? 'yes' : 'no',options:[['no','Нет'],['yes','Да']]},
    {name:'width',label:'Ширина блока, px',type:'number',value:width,min:'1',max:'12000'},
    {name:'color',label:'Цвет',type:'color',value:layer?.color || els.primaryColor.value},
  ];
}
async function textSettingsFromForm(values, layer = null) {
  const custom = await readCustomTextFont(values.fontFile);
  const systemName=String(values.systemFontName || '').trim().slice(0,120);
  const fontFamily = custom?.fontFamily || (systemName ? JSON.stringify(systemName) : values.fontFamily);
  return {
    text:values.text || 'Текст',
    fontFamily,
    fontData:custom?.fontData || (fontFamily === layer?.fontFamily ? layer.fontData : null),
    fontLabel:custom?.fontLabel || (fontFamily === layer?.fontFamily ? layer.fontLabel : ''),
    fontSize:clamp(Number(values.fontSize) || 48, 6, 500),
    fontWeight:TEXT_WEIGHT_OPTIONS.some(([option]) => option === values.fontWeight) ? values.fontWeight : '400',
    fontStyle:values.fontStyle === 'italic' ? 'italic' : 'normal',
    align:TEXT_ALIGN_OPTIONS.some(([option]) => option === values.align) ? values.align : 'left',
    lineHeight:clamp(Number(values.lineHeight) || 1.18, 0.8, 3),
    letterSpacing:clamp(Number(values.letterSpacing) || 0, -5, 20),
    underline:values.underline === 'yes',
    strikeThrough:values.strikeThrough === 'yes',
    width:clamp(Number(values.width) || layer?.width || 240, 1, 12000),
    color:values.color || layer?.color || els.primaryColor.value,
  };
}
function propSelectField(label, key, value, options) {
  return `<label for="prop-${key}">${label}</label><select id="prop-${key}" data-prop="${key}">${options.map(([option, name]) => `<option value="${escapeAttr(option)}"${option === value ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select>`;
}
function formatFilterValue(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (key === 'exposure') return `${number > 0 ? '+' : ''}${number.toFixed(2)} EV`;
  if (key === 'gamma') return number.toFixed(2);
  if (key === 'hue') return `${Math.round(number)}°`;
  if (key === 'blur') return `${Math.round(number)} px`;
  if (['brightness','contrast','saturate','grayscale','sepia','invert'].includes(key)) return `${Math.round(number)}%`;
  if (['temperature','tint','vibrance','highlights','shadows'].includes(key)) return `${number > 0 ? '+' : ''}${Math.round(number)}`;
  return String(Math.round(number * 100) / 100);
}
function propRangeField(label, key, value, attrs='') {
  const filterKey = key.startsWith('filters.') ? key.split('.')[1] : key;
  return `<label for="prop-${key}">${label}</label><div class="range-with-value"><input id="prop-${key}" data-prop="${key}" type="range" value="${escapeAttr(value)}" ${attrs}><output>${escapeHtml(formatFilterValue(filterKey,value))}</output></div>`;
}
function renderEffectControls(layer) {
  const controls = layer.type === 'raster' || layer.type === 'adjustment' ? RASTER_EFFECT_CONTROLS : BASIC_EFFECT_CONTROLS;
  let currentGroup = null;
  let html = '';
  for (const control of controls) {
    if (control.group && control.group !== currentGroup) {
      currentGroup = control.group;
      html += `<div class="prop-effect-group">${escapeHtml(currentGroup)}</div>`;
    }
    const fallback = DEFAULT_LAYER_FILTERS[control.key] ?? 0;
    const value = layer.filters?.[control.key] ?? fallback;
    html += propRangeField(control.label, `filters.${control.key}`, value, `min="${control.min}" max="${control.max}" step="${control.step}"`);
  }
  return html;
}

function smartFilterMaskMarkup(layer) {
  const stack=Array.isArray(layer?.smartFilters)?layer.smartFilters:[];
  if(!stack.length)return '';
  const mask=layer?.smartFilterMask;
  const selectionDisabled=selectionShape?'':' disabled';
  if(!mask){
    return '<div class="smart-filter-mask"><div class="smart-filter-mask-title"><strong>Маска смарт-фильтров</strong><span>нет</span></div><div class="smart-filter-mask-actions"><button type="button" class="mini-button" data-smart-filter-mask-show>Показать всё</button><button type="button" class="mini-button" data-smart-filter-mask-selection'+selectionDisabled+'>Из выделения</button></div></div>';
  }
  const density=Math.round(Math.max(0,Math.min(1,Number(mask.density??1)))*100);
  const feather=Math.max(0,Math.min(250,Number(mask.feather)||0));
  return '<div class="smart-filter-mask'+(mask.enabled===false?' is-disabled':'')+'"><div class="smart-filter-mask-title"><strong>Маска смарт-фильтров</strong><span>'+(mask.dataUrl?'растровая':'показать всё')+'</span></div><div class="smart-filter-mask-actions"><button type="button" class="mini-button" data-smart-filter-mask-toggle>'+(mask.enabled===false?'Включить':'Отключить')+'</button><button type="button" class="mini-button" data-smart-filter-mask-invert>'+(mask.invert?'Не инвертировать':'Инвертировать')+'</button><button type="button" class="mini-button" data-smart-filter-mask-selection'+selectionDisabled+'>Из выделения</button><button type="button" class="mini-button" data-smart-filter-mask-remove>Удалить</button></div><label class="smart-filter-mask-range"><span>Плотность</span><input type="range" min="0" max="100" step="1" value="'+density+'" data-smart-filter-mask-density><output>'+density+'%</output></label><label class="smart-filter-mask-range"><span>Растушёвка</span><input type="range" min="0" max="250" step="0.5" value="'+feather+'" data-smart-filter-mask-feather><output>'+feather+' px</output></label></div>';
}

function smartFilterStackMarkup(layer) {
  const stack=Array.isArray(layer?.smartFilters)?layer.smartFilters:[];
  const rows=stack.map((item,index)=>`
    <div class="smart-filter-row${item.enabled===false?' is-disabled':''}">
      <button type="button" class="smart-filter-toggle" data-smart-filter-toggle="${index}" title="${item.enabled===false?'Включить':'Отключить'} смарт-фильтр" aria-label="${item.enabled===false?'Включить':'Отключить'} смарт-фильтр">${item.enabled===false?'○':'◉'}</button>
      <button type="button" class="smart-filter-name" data-smart-filter-edit="${index}" title="Редактировать смарт-фильтр">${escapeHtml(item.name||`Смарт-фильтр ${index+1}`)}</button>
      <button type="button" class="smart-filter-order" data-smart-filter-up="${index}" title="Выше" aria-label="Переместить смарт-фильтр выше"${index===0?' disabled':''}>↑</button>
      <button type="button" class="smart-filter-order" data-smart-filter-down="${index}" title="Ниже" aria-label="Переместить смарт-фильтр ниже"${index===stack.length-1?' disabled':''}>↓</button>
      <button type="button" class="smart-filter-remove" data-smart-filter-remove="${index}" title="Удалить" aria-label="Удалить смарт-фильтр">×</button>
    </div>`).join('');
  return `<div class="wide smart-filter-stack">
    <div class="smart-filter-heading"><strong>Смарт-фильтры</strong><span>верхние применяются последними</span></div>
    ${smartFilterMaskMarkup(layer)}
    ${rows||'<div class="smart-filter-empty">Нет смарт-фильтров</div>'}
    <div class="smart-filter-actions">
      <button type="button" class="mini-button" data-smart-filter-add>+ Добавить</button>
      <button type="button" class="mini-button" data-smart-filter-clear${stack.length?'':' disabled'}>Очистить</button>
    </div>
  </div>`;
}

function bindPropertyInputs(root) {
  root?.querySelectorAll('[data-prop]').forEach(input => {
    if (input.type === 'range') {
      input.addEventListener('input', () => {
        const key = input.dataset.prop.startsWith('filters.') ? input.dataset.prop.split('.')[1] : input.dataset.prop;
        const output = input.closest('.range-with-value')?.querySelector('output');
        if (output) output.textContent = formatFilterValue(key, input.value);
        applyProperty(input.dataset.prop, input.value, input, false);
      });
      input.addEventListener('change', () => applyProperty(input.dataset.prop, input.value, input, true));
    } else if(input.type === 'number') {
      input.dataset.initialValue=input.value;
      input.addEventListener('change',()=>{normalizeNumberInput(input);applyProperty(input.dataset.prop,input.value,input,true);});
    } else {
      input.addEventListener('change', () => applyProperty(input.dataset.prop, input.value, input, true));
    }
  });
}
function refreshInspectorPanels() {
  updateProperties();
  updateEffectsPanel();
}
function resetSelectedLayerEffects() {
  const layer = selected();
  if (!layer || isLayerLocked(doc,layer)) return;
  const controls = layer.type === 'raster' || layer.type === 'adjustment' ? RASTER_EFFECT_CONTROLS : BASIC_EFFECT_CONTROLS;
  layer.filters = sanitizeFilters(layer.filters);
  let changed = false;
  for (const control of controls) {
    const fallback = DEFAULT_LAYER_FILTERS[control.key];
    if (layer.filters[control.key] !== fallback) {
      layer.filters[control.key] = fallback;
      changed = true;
    }
  }
  if (changed) commit('Сбросить цвет и эффекты');
  else setStatus('Цвет и эффекты уже сброшены');
}
function formatDisplayExposure(value){
  const ev=Number(value)||0;
  return `${ev>=0?'+':''}${ev.toFixed(1)} EV`;
}

function updateHighDepthPreviewSetting(layer,key,raw,shouldCommit=true){
  if(!layer?.highDepthSource||layer.type!=='raster'||isLayerLocked(doc,layer))return false;
  const current=sanitizeHighDepthPreview(layer.highDepthPreview);
  const candidate={...current,[key]:key==='displayExposure'?Number(raw):raw};
  layer.highDepthPreview=sanitizeHighDepthPreview(candidate);
  markDirty(true);
  if(shouldCommit)commit(key==='toneMap'?'Изменить HDR tone mapping':'Изменить HDR display exposure');
  else render();
  return true;
}

function resetHighDepthPreview(layer=selected()){
  if(!layer?.highDepthSource||layer.type!=='raster'||isLayerLocked(doc,layer))return false;
  layer.highDepthPreview=sanitizeHighDepthPreview();
  commit('Сбросить HDR preview');
  return true;
}

function bindHighDepthPreviewControls(root,layer){
  const toneMap=root?.querySelector('[data-high-depth-tone-map]');
  if(toneMap)toneMap.addEventListener('change',()=>updateHighDepthPreviewSetting(layer,'toneMap',toneMap.value,true));
  const exposure=root?.querySelector('[data-high-depth-display-exposure]');
  if(exposure){
    const output=root.querySelector('[data-high-depth-display-output]');
    exposure.addEventListener('input',()=>{
      if(output)output.textContent=formatDisplayExposure(exposure.value);
      updateHighDepthPreviewSetting(layer,'displayExposure',exposure.value,false);
    });
    exposure.addEventListener('change',()=>updateHighDepthPreviewSetting(layer,'displayExposure',exposure.value,true));
  }
  root?.querySelector('[data-high-depth-preview-reset]')?.addEventListener('click',()=>resetHighDepthPreview(layer));
}

function updateProperties() {
  const l = selected();
  if (!l) { els.props.className = 'panel-content muted'; els.props.textContent = 'Выберите слой'; return; }
  els.props.className = 'panel-content';
  if (l.type === 'adjustment') {
    const maskLabel=layerMaskSummary(l);
    els.props.innerHTML = `<div class="prop-grid">
      <label>Имя</label><input data-prop="name" value="${escapeAttr(l.name)}">
      <label>Тип</label><span>Корректирующий слой</span>
      <label>Область</label><span>Нижележащий стек</span>
      <label>Маски</label><span>${escapeHtml(maskLabel)}</span>
    </div>`;
    bindPropertyInputs(els.props);
    if (isLayerLocked(doc,l)) els.props.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = true; });
    return;
  }
  let extra = '';
  if (l.type === 'text') extra = `<label>Текст</label><textarea data-prop="text">${escapeHtml(l.text || '')}</textarea>${propSelectField('Шрифт', 'fontFamily', l.fontFamily, textFontOptions(l.fontFamily, l.fontLabel))}<label>Шрифты ПК</label><button type="button" class="mini-button" data-local-fonts>Показать список</button><label for="system-font-name">Или имя шрифта ПК</label><input id="system-font-name" type="text" placeholder="Например, Segoe UI"><label for="text-font-file">Свой шрифт</label><input id="text-font-file" type="file" accept=".woff,.woff2,.ttf,.otf" aria-label="Загрузить свой шрифт">${propField('Размер', 'fontSize', l.fontSize, 'number','min="6" max="500"')}${propSelectField('Начертание', 'fontWeight', l.fontWeight, TEXT_WEIGHT_OPTIONS)}${propSelectField('Стиль', 'fontStyle', l.fontStyle ?? 'normal', TEXT_STYLE_OPTIONS)}${propSelectField('Выравнивание', 'align', l.align, TEXT_ALIGN_OPTIONS)}${propField('Межстрочный', 'lineHeight', l.lineHeight ?? 1.18, 'number', 'min="0.8" max="3" step="0.01"')}${propField('Межбуквенный', 'letterSpacing', l.letterSpacing ?? 0, 'number', 'min="-5" max="20" step="0.5"')}${propSelectField('Подчёркивание', 'underline', l.underline ? 'yes' : 'no', [['no','Нет'],['yes','Да']])}${propSelectField('Зачёркивание', 'strikeThrough', l.strikeThrough ? 'yes' : 'no', [['no','Нет'],['yes','Да']])}${propField('Цвет','color',l.color,'color')}`;
  if (l.type === 'shape') extra = l.shape === 'line'
    ? `${propField('Цвет линии','stroke',l.stroke === 'transparent' ? '#000000' : l.stroke,'color')}${propField('Толщина','strokeWidth',l.strokeWidth ?? 1,'number','min="1" max="1000"')}`
    : `${propField('Заливка','fill',l.fill,'color')}${propField('Обводка','stroke',l.stroke === 'transparent' ? '#000000' : l.stroke,'color')}${propField('Толщина','strokeWidth',l.strokeWidth ?? 0,'number','min="0" max="1000"')}`;
  if (l.type === 'raster' && l.highDepthSource) {
    const source=l.highDepthSource;
    const sizeMb=(Number(source.rawBytes||0)/1024/1024).toFixed(1);
    const preview=sanitizeHighDepthPreview(l.highDepthPreview);
    const resolvedAuto=source.bitsPerChannel===32?'ACES':'Clip';
    const displayLabel=formatDisplayExposure(preview.displayExposure);
    extra = `<label>Точность источника</label><span>${source.bitsPerChannel}-bit ${escapeHtml(String(source.model||'RGB').toUpperCase())} · ${sizeMb} МБ</span><label>High-depth</label><span>Exposure/gamma/color работают до tone mapping; Canvas preview/edit — 8-bit</span><label>Tone map</label><select data-high-depth-tone-map><option value="auto"${preview.toneMap==='auto'?' selected':''}>Auto (${resolvedAuto})</option><option value="clip"${preview.toneMap==='clip'?' selected':''}>Clip</option><option value="aces"${preview.toneMap==='aces'?' selected':''}>ACES</option></select><label>Display exposure</label><span class="range-with-value"><input type="range" min="-6" max="6" step="0.1" value="${preview.displayExposure}" data-high-depth-display-exposure><output data-high-depth-display-output>${displayLabel}</output></span><div class="wide"><button type="button" class="mini-button" data-high-depth-preview-reset>Сбросить HDR preview</button></div>`;
  }
  if (l.type === 'smart-object') {
    const linkedCount=l.linkedSourceId?linkedSmartObjectLayers(doc,l.linkedSourceId).length:0;
    const linkSummary=l.linkedSourceId?`Связанный источник · ${linkedCount} экз.`:'Независимый встроенный источник';
    extra = `<label>Содержимое</label><button type="button" class="mini-button" data-smart-object-edit>Редактировать содержимое</button><label>Источник</label><span>${l.embeddedDocument ? `${l.embeddedDocument.width} × ${l.embeddedDocument.height}` : 'недоступен'}</span><label>Связь</label><span>${escapeHtml(linkSummary)}</span><div class="wide smart-object-link-actions"><button type="button" class="mini-button" data-smart-object-link-copy>Создать связанную копию</button>${l.linkedSourceId?'<button type="button" class="mini-button" data-smart-object-unlink>Разорвать связь</button>':''}</div>${smartFilterStackMarkup(l)}`;
  }
  els.props.innerHTML = `<div class="prop-grid">
    <label>Имя</label><input data-prop="name" value="${escapeAttr(l.name)}">
    ${propField('X','x',Math.round(l.x))}${propField('Y','y',Math.round(l.y))}
    ${propField('Ширина','width',Math.round(l.width),'number','min="1" max="12000"')}${propField('Высота','height',Math.round(l.height),'number','min="1" max="12000"')}
    ${propField('Масштаб X','scaleX',Number(l.scaleX ?? 1).toFixed(2),'number','step="0.01" min="0.01" max="100"')}
    ${propField('Масштаб Y','scaleY',Number(l.scaleY ?? 1).toFixed(2),'number','step="0.01" min="0.01" max="100"')}
    ${propField('Поворот','rotation',Math.round(l.rotation ?? 0),'number','step="1"')}
    <label>Маски</label><span>${escapeHtml(layerMaskSummary(l))}</span>
    ${extra}
  </div>`;
  bindPropertyInputs(els.props);
  if(l.type==='raster'&&l.highDepthSource)bindHighDepthPreviewControls(els.props,l);
  const smartObjectEdit=els.props.querySelector('[data-smart-object-edit]');
  if(smartObjectEdit)smartObjectEdit.addEventListener('click',()=>openSmartObjectContents(l));
  const smartObjectLinkCopy=els.props.querySelector('[data-smart-object-link-copy]');
  if(smartObjectLinkCopy)smartObjectLinkCopy.addEventListener('click',()=>createLinkedSmartObjectCopy(l));
  const smartObjectUnlink=els.props.querySelector('[data-smart-object-unlink]');
  if(smartObjectUnlink)smartObjectUnlink.addEventListener('click',()=>unlinkSmartObject(l));
  if(l.type==='smart-object')bindSmartFilterControls(els.props,l);
  const systemFontInput=els.props.querySelector('#system-font-name');
  if(systemFontInput)systemFontInput.addEventListener('change',()=>{
    const name=systemFontInput.value.trim().slice(0,120);
    if(!name)return;
    const value=JSON.stringify(name);
    localTextFonts.push([value,name]);
    applyProperty('fontFamily',value,systemFontInput,true);
  });
  const localFontsButton = els.props.querySelector('[data-local-fonts]');
  if (localFontsButton) localFontsButton.addEventListener('click', async () => {
    localFontsButton.disabled = true;
    try { const count = await loadComputerFonts(els.props.querySelector('[data-prop="fontFamily"]')); setStatus(`Доступно шрифтов компьютера: ${count}`); }
    catch (error) { toast(error.message, 'warn'); setStatus(error.message); }
    finally { if (localFontsButton.isConnected) localFontsButton.disabled = false; }
  });
  const fontInput = els.props.querySelector('#text-font-file');
  if (fontInput) fontInput.addEventListener('change', async () => {
    const targetDoc = doc, targetLayer = l;
    fontInput.disabled = true;
    try {
      const custom = await readCustomTextFont(fontInput.files?.[0]);
      if (!custom || doc !== targetDoc || selected() !== targetLayer || isLayerLocked(doc,targetLayer)) return;
      Object.assign(targetLayer, custom);
      commit('Изменить шрифт текста');
    } catch (error) { toast(error.message, 'error'); setStatus(error.message); }
    finally { if (fontInput.isConnected) fontInput.disabled = false; }
  });
  if (isLayerLocked(doc,l)) els.props.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = true; });
}
function updateEffectsPanel() {
  const l = selected();
  if (!l) {
    els.effects.className = 'panel-content muted';
    els.effects.textContent = 'Выберите слой';
    return;
  }
  els.effects.className = 'panel-content';
  els.effects.innerHTML = `<div class="prop-effects-grid">${renderEffectControls(l)}</div>`;
  bindPropertyInputs(els.effects);
  if (isLayerLocked(doc,l)) els.effects.querySelectorAll('input,textarea,select').forEach(control => { control.disabled = true; });
}
function escapeHtml(v) { const d=document.createElement('div'); d.textContent=v; return d.innerHTML; }
function escapeAttr(v) { return escapeHtml(v).replaceAll('"','&quot;'); }
function applyProperty(path, raw, input, shouldCommit = true) {
  const l = selected(); if (!l || isLayerLocked(doc,l)) return;
  const stringProps = ['name','text','color','fill','stroke','fontFamily','fontWeight','fontStyle','align','underline','strikeThrough'];
  let value = stringProps.includes(path) ? raw : Number(raw);
  if (!stringProps.includes(path) && !Number.isFinite(value)) {
    refreshInspectorPanels();
    setStatus('Некорректное числовое значение');
    return;
  }
  if (path.startsWith('filters.')) {
    const key = path.split('.')[1];
    const [min,max] = FILTER_RANGES[key] || [0,400];
    value = clamp(value, min, max);
    l.filters = sanitizeFilters(l.filters);
    l.filters[key] = value;
    markDirty(true);
    if (shouldCommit) commit('Изменить фильтр слоя'); else render();
    return;
  }
  if (path === 'width' || path === 'height') {
    value = clamp(value, 1, 12000);
    if (l.type === 'raster') {
      try {
        checkedCanvasSize(path === 'width' ? value : l.width, path === 'height' ? value : l.height, `Растровый слой «${l.name || 'Без имени'}»`);
      } catch (error) {
        refreshInspectorPanels();
        setStatus(error.message);
        toast(error.message, 'warn');
        return;
      }
    }
  }
  if (path === 'scaleX' || path === 'scaleY') value = clamp(value, .01, 100);
  if (path === 'x' || path === 'y') value = clamp(value, -120000, 120000);
  if (path === 'rotation') value = ((value % 360) + 360) % 360;
  if (path === 'fontSize') value = clamp(value, 6, 500);
  if (path === 'fontWeight' && !TEXT_WEIGHT_OPTIONS.some(([option]) => option === value)) return;
  if (path === 'fontStyle' && !TEXT_STYLE_OPTIONS.some(([option]) => option === value)) return;
  if (path === 'align' && !TEXT_ALIGN_OPTIONS.some(([option]) => option === value)) return;
  if (path === 'fontFamily' && !textFontOptions(l.fontFamily).some(([option]) => option === value)) return;
  if (path === 'fontFamily' && value !== l.fontFamily) { l.fontData = null; l.fontLabel = ''; }
  if (path === 'lineHeight') value = clamp(value, 0.8, 3);
  if (path === 'letterSpacing') value = clamp(value, -5, 20);
  if (path === 'underline' || path === 'strikeThrough') value = value === 'yes';
  if (path === 'strokeWidth') value = clamp(value, 0, 1000);
  l[path] = value;
  markDirty(true);
  if (shouldCommit) commit(`Изменить ${path}`);
  else { render(); drawOverlay(); }
}

function updateToolLabel() {
  els.toolLabel.textContent = currentTool === 'marquee' ? (SELECTION_TYPE_LABELS[selectionType] || TOOL_LABELS.marquee) : (TOOL_LABELS[currentTool] || currentTool);
}

function cancelPolygonDraft({ restorePrevious = true, announce = false } = {}) {
  if (!polygonDraft) return false;
  const previous = polygonDraft.previousSelection;
  polygonDraft = null;
  if (restorePrevious) setSelectionShape(previous);
  drawOverlay();
  if (announce) setStatus('Многоугольное выделение отменено');
  return true;
}

function finishPolygonSelection() {
  if (!polygonDraft) return false;
  const points = polygonDraft.points || [];
  const previousSelection = polygonDraft.previousSelection;
  polygonDraft = null;
  if (points.length < 3) {
    setSelectionShape(previousSelection);
    drawOverlay();
    setStatus('Для многоугольного выделения нужно минимум 3 точки');
    return false;
  }
  setSelectionShape({type:'polygon',points});
  drawOverlay();
  setStatus(`Многоугольное выделение: ${points.length} точек`);
  return true;
}

function setSelectionType(type, { announce = true } = {}) {
  const next = SELECTION_TYPES.includes(type) ? type : 'rect';
  if (polygonDraft) cancelPolygonDraft({restorePrevious:true});
  selectionType = next;
  if (els.selectionType) els.selectionType.value = next;
  updateToolLabel();
  if (announce && currentTool === 'marquee') setStatus(`Тип выделения: ${SELECTION_TYPE_LABELS[next]}`);
  drawOverlay();
}

function cycleSelectionType() {
  const index = Math.max(0, SELECTION_TYPES.indexOf(selectionType));
  setSelectionType(SELECTION_TYPES[(index + 1) % SELECTION_TYPES.length]);
}

function setTool(tool) {
  if (tool !== currentTool && blockPendingDocumentEdit()) return;
  if (tool !== 'marquee' && polygonDraft) cancelPolygonDraft({restorePrevious:true});
  if(tool!=='pen'){penDraft=null;vectorMaskEditLayerId=null;documentPathEditIndex=-1;}
  if(tool!=='magnetic')magneticDraft=null;
  currentTool = tool;
  $$('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  updateToolLabel();
  $$('.text-only').forEach(x => x.style.display = tool === 'text' ? '' : 'none');
  $$('.shape-only').forEach(x => x.style.display = tool === 'shape' ? '' : 'none');
  $$('.fill-only').forEach(x => x.style.display = tool === 'fill' ? '' : 'none');
  $$('.blur-only').forEach(x => x.style.display = tool === 'blur' ? '' : 'none');
  $$('.smudge-only').forEach(x => x.style.display = tool === 'smudge' ? '' : 'none');
  $$('.dodge-only').forEach(x => x.style.display = tool === 'dodge' ? '' : 'none');
  $$('.burn-only').forEach(x => x.style.display = tool === 'burn' ? '' : 'none');
  $$('.color-option, .opacity-option').forEach(x => x.style.display = ['dodge','burn','blur'].includes(tool) ? 'none' : '');
  $$('.gradient-only').forEach(x => x.style.display = tool === 'gradient' ? '' : 'none');
  $$('.pen-only').forEach(x => x.style.display = tool === 'pen' ? '' : 'none');
  $$('.marquee-only').forEach(x => x.style.display = tool === 'marquee' ? '' : 'none');
  $$('.move-only').forEach(x => x.style.display = tool === 'move' ? '' : 'none');
  els.overlay.style.cursor = defaultToolCursor();
  cropRect = null; hoverPoint = null; clearSmartGuides(); drawOverlay();
  if ((tool === 'clone' || tool === 'heal') && !cloneSource) setStatus(`${TOOL_LABELS[tool]}: Alt+клик по растровому слою задаёт источник`);
}

function canvasPoint(event, { clampToDocument = true } = {}) {
  const r = els.overlay.getBoundingClientRect();
  const x = (event.clientX - r.left) / zoom;
  const y = (event.clientY - r.top) / zoom;
  return clampToDocument ? { x: clamp(x, 0, doc.width), y: clamp(y, 0, doc.height) } : { x, y };
}
function isTransformableLayer(layer) { return Boolean(layer) && layer.type !== 'adjustment'; }
function topLayerAt(point) { return [...doc.layers].reverse().find(l => isTransformableLayer(l) && isLayerVisible(doc,l) && !isLayerLocked(doc,l) && pointInLayer(point,l)) ?? null; }
function topTextLayerAt(point) { return [...doc.layers].reverse().find(l => isLayerVisible(doc,l) && l.type === 'text' && pointInLayer(point,l)) ?? null; }
function updateTransformPropertyValues(layer) {
  const values = {
    x: Math.round(layer.x), y: Math.round(layer.y),
    scaleX: Number(layer.scaleX ?? 1).toFixed(2), scaleY: Number(layer.scaleY ?? 1).toFixed(2),
    rotation: Math.round(layer.rotation ?? 0),
  };
  for (const [key, value] of Object.entries(values)) {
    const input = els.props.querySelector(`[data-prop="${key}"]`);
    if (input) input.value = String(value);
  }
}
function interactiveRotationHandlePoint(layer) {
  const preferred = rotationHandlePoint(layer, 30 / zoom);
  const insetX = Math.min(Math.max(8 / zoom, 2), doc.width / 2);
  const insetY = Math.min(Math.max(8 / zoom, 2), doc.height / 2);
  return {
    x: clamp(preferred.x, insetX, Math.max(insetX, doc.width - insetX)),
    y: clamp(preferred.y, insetY, Math.max(insetY, doc.height - insetY)),
  };
}
function cursorForHandle(handle, layer) {
  const baseAngles = { e:0, se:45, s:90, sw:135, w:180, nw:225, n:270, ne:315 };
  const angle = ((baseAngles[handle] ?? 0) + (Number(layer.rotation) || 0) + 360) % 180;
  const bucket = Math.round(angle / 45) % 4;
  return ['ew-resize','nwse-resize','ns-resize','nesw-resize'][bucket];
}
function defaultToolCursor() {
  return currentTool === 'move' ? 'default' : currentTool === 'text' ? 'text' : currentTool === 'hand' ? 'grab' : currentTool === 'zoom' ? 'zoom-in' : RASTER_BRUSH_TOOLS.has(currentTool) ? 'none' : 'crosshair';
}
function brushWidthForPointer(event) {
  const base = Number(els.brushSize.value) || 1;
  if (event?.pointerType !== 'pen') return base;
  const pressure = clamp(Number(event.pressure) || 0, 0, 1);
  return base * (0.15 + pressure * 0.85);
}
function adjustBrushSize(direction, coarse = false) {
  const current = Number(els.brushSize.value) || 1;
  const step = coarse ? 10 : (current < 20 ? 2 : current < 80 ? 5 : 10);
  const next = clamp(current + Math.sign(direction) * step, Number(els.brushSize.min) || 1, Number(els.brushSize.max) || 160);
  els.brushSize.value = String(next);
  els.brushSizeValue.textContent = String(next);
  setStatus(`Размер кисти: ${next} px`);
}

function updateMoveCursor(point) {
  if (currentTool !== 'move' || drag) return;
  const layer = selected();
  if (isTransformableLayer(layer) && isLayerVisible(doc, layer) && !isLayerLocked(doc, layer)) {
    const rotatePoint = interactiveRotationHandlePoint(layer);
    if (Math.hypot(point.x - rotatePoint.x, point.y - rotatePoint.y) <= 10 / zoom) { els.overlay.style.cursor = 'grab'; return; }
    const handle = hitLayerHandle(point, layer, 10 / zoom);
    if (handle) { els.overlay.style.cursor = cursorForHandle(handle, layer); return; }
  }
  els.overlay.style.cursor = layer && isLayerVisible(doc, layer) && !isLayerLocked(doc, layer) && pointInLayer(point, layer) ? 'move' : 'default';
}

function visibleSnapTargetRects(layerId) {
  return doc.layers
    .filter(layer => layer.id !== layerId && isLayerVisible(doc, layer))
    .map(layer => frameBounds(layer));
}

els.overlay.addEventListener('pointerdown', async (e) => {
  if (!e.isPrimary || ![0, 1].includes(e.button)) return;
  const wantsPan = e.button === 1 || (e.button === 0 && (spaceHeld || currentTool === 'hand'));
  if (e.button === 1) e.preventDefault();
  if (!wantsPan && paintPersisting && (RASTER_BRUSH_TOOLS.has(currentTool) || currentTool === 'fill' || currentTool === 'line' || currentTool === 'gradient')) {
    setStatus('Сохраняется предыдущая растровая операция…');
    return;
  }
  activePrimaryPointerId = e.pointerId;
  els.overlay.setPointerCapture(e.pointerId);
  const p = canvasPoint(e);
  if (wantsPan) {
    drag = { kind:'pan', x:e.clientX, y:e.clientY, left:els.viewport.scrollLeft, top:els.viewport.scrollTop }; els.overlay.style.cursor='grabbing'; return;
  }
  if (e.button !== 0) return;
  if (currentTool === 'move') {
    let l = selected();
    if (isTransformableLayer(l) && isLayerVisible(doc,l) && !isLayerLocked(doc,l)) {
      const rotatePoint = interactiveRotationHandlePoint(l);
      if (Math.hypot(p.x - rotatePoint.x, p.y - rotatePoint.y) <= 10 / zoom) {
        const frame = layerFrame(l);
        drag = { kind:'rotate', layerId:l.id, moved:false, initialRotation:l.rotation ?? 0, center:frame.center, start:p, lastPointer:p };
        els.overlay.style.cursor = 'grabbing';
        return;
      }
      const handle = hitLayerHandle(p, l, 10 / zoom);
      if (handle) {
        drag = { kind:'resize', layerId:l.id, handle, moved:false, lastPointer:p, initial:{x:l.x,y:l.y,width:l.width,height:l.height,scaleX:l.scaleX,scaleY:l.scaleY,rotation:l.rotation} };
        els.overlay.style.cursor = cursorForHandle(handle, l);
        return;
      }
    }
    if (!isTransformableLayer(l) || isLayerLocked(doc,l) || !isLayerVisible(doc,l) || !pointInLayer(p,l)) l = topLayerAt(p);
    if (l) {
      doc.selectedLayerId = l.id;
      drag = { kind:'move', layerId:l.id, px:p.x, py:p.y, x:l.x, y:l.y, moved:false, lastPointer:p };
      els.overlay.style.cursor='move'; updateLayers(); refreshInspectorPanels(); drawOverlay();
    }
    return;
  }
  if ((currentTool === 'clone' || currentTool === 'heal') && e.altKey) { await setCloneSource(p); return; }
  if (RASTER_BRUSH_TOOLS.has(currentTool)) { await beginPaint(p, e.pointerId, e); return; }
  if (currentTool === 'fill') { await fillAtPoint(p); return; }
  if (currentTool === 'gradient') { drag={kind:'gradient',start:p,current:p};drawOverlay();return; }
  if (currentTool === 'wand') { magicWandSelect(p);return; }
  if (currentTool === 'pen') {
    const hit=!penDraft?hitSelectedPathControl(p):null;
    if(hit){beginPathControlDrag(hit,p,e);drawOverlay();return;}
    if(documentPathEditIndex>=0){
      setStatus('Сохранённый контур: перетаскивайте существующие anchors/handles; новые subpaths добавляются через маску/выделение и сохранение');
      return;
    }
    if(vectorMaskEditLayerId===selected()?.id){
      setStatus('Векторная маска: перетаскивайте существующие anchors/handles; новые контуры добавляются через выделение + Add');
      return;
    }
    beginPenPoint(p,e.detail>=2);return;
  }
  if (currentTool === 'magnetic') { addMagneticPoint(p,e.detail>=2);return; }
  if (currentTool === 'marquee') {
    const previousSelection=cloneSelectionShape(selectionShape);
    if (selectionType === 'polygon') {
      e.preventDefault();
      if (!polygonDraft) {
        polygonDraft={points:[p],hover:p,previousSelection};
        selectionShape=null;selectionRect=null;
        setStatus('Многоугольное лассо: ставьте точки, двойной щелчок или Enter — завершить');
      } else {
        const first=polygonDraft.points[0];
        const nearFirst=polygonDraft.points.length>=3&&Math.hypot(p.x-first.x,p.y-first.y)<=10/zoom;
        const last=polygonDraft.points.at(-1);
        if (!last || Math.hypot(p.x-last.x,p.y-last.y)>1/zoom) polygonDraft.points.push(p);
        polygonDraft.hover=p;
        if (nearFirst || e.detail>=2) finishPolygonSelection();
      }
      drawOverlay();return;
    }
    drag={kind:'marquee',selectionType,start:p,current:p,previousSelection,points:selectionType==='lasso'?[p]:null,lockAspect:false};
    selectionShape=selectionType==='lasso'?{type:'lasso',points:[p]}:{type:selectionType,rect:{x:p.x,y:p.y,width:0,height:0}};
    selectionRect={x:p.x,y:p.y,width:0,height:0};
    drawOverlay();return;
  }
  if (currentTool === 'line') { drag = { kind:'line', start:p, current:p }; previewLine(p,p); return; }
  if (currentTool === 'shape') { drag = { kind:'shape', start:p, current:p }; return; }
  if (currentTool === 'crop') { drag = { kind:'crop', start:p, current:p }; cropRect = {x:p.x,y:p.y,width:0,height:0}; drawOverlay(); return; }
  if (currentTool === 'text') { openTextModal(p); return; }
  if (currentTool === 'eyedropper') { pickColor(p); return; }
  if (currentTool === 'zoom') { setZoomAtClientPoint(zoom*(e.altKey ? 1/1.5 : 1.5),e.clientX,e.clientY); return; }
});

function onOverlayPointerMove(e) {
  if (drag && e.pointerId !== activePrimaryPointerId) return;
  const allowOutside = drag && ['move','resize','rotate','paint','path-control'].includes(drag.kind);
  const p = canvasPoint(e, { clampToDocument: !allowOutside });
  if (drag && ['move','resize','rotate'].includes(drag.kind)) drag.lastPointer = p;
  els.pointer.textContent = `x: ${Math.round(p.x)} y: ${Math.round(p.y)}`;
  hoverPoint = p;
  if (!drag) {
    if (polygonDraft && currentTool === 'marquee' && selectionType === 'polygon') polygonDraft.hover=p;
    if(penDraft&&currentTool==='pen')penDraft.hover=p;
    if(magneticDraft&&currentTool==='magnetic')magneticDraft.hover=findMagneticEdgePoint(p);
    if (currentTool === 'zoom') els.overlay.style.cursor=e.altKey?'zoom-out':'zoom-in';
    else if(currentTool==='pen'&&!penDraft)updatePenCursor(p);
    else updateMoveCursor(p);
    drawOverlay(); return;
  }
  if (drag.kind === 'pan') { els.viewport.scrollLeft = drag.left - (e.clientX-drag.x); els.viewport.scrollTop = drag.top - (e.clientY-drag.y); return; }
  if (drag.kind === 'move') {
    const l = doc.layers.find(x=>x.id===drag.layerId); if (!l || isLayerLocked(doc,l)) return;
    let dx = p.x-drag.px;
    let dy = p.y-drag.py;
    let lockedAxis = null;
    if (e.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; lockedAxis = 'y'; }
      else { dx = 0; lockedAxis = 'x'; }
    }
    let nextX = drag.x + dx;
    let nextY = drag.y + dy;
    if (smartSnapEnabled && !e.ctrlKey && !e.metaKey) {
      const snapped = snapLayerMove(l, nextX, nextY, {
        docWidth: doc.width,
        docHeight: doc.height,
        targetRects: visibleSnapTargetRects(l.id),
        threshold: 8 / zoom,
      });
      nextX = lockedAxis === 'x' ? drag.x : snapped.x;
      nextY = lockedAxis === 'y' ? drag.y : snapped.y;
      smartGuides = {
        x: lockedAxis === 'x' ? null : snapped.guides.x,
        y: lockedAxis === 'y' ? null : snapped.guides.y,
      };
    } else clearSmartGuides();
    l.x = nextX; l.y = nextY;
    drag.moved = Math.abs(l.x-drag.x) > 1e-9 || Math.abs(l.y-drag.y) > 1e-9;
    render(); updateTransformPropertyValues(l); drawOverlay(); return;
  }
  if (drag.kind === 'resize') {
    const l = doc.layers.find(x=>x.id===drag.layerId); if (!l || isLayerLocked(doc,l)) return;
    const next = resizeLayerFromPoint({ ...l, ...drag.initial }, drag.handle, p, {
      minSize: Math.max(2, 6 / zoom),
      lockAspect: e.shiftKey,
      fromCenter: e.altKey,
    });
    l.x=next.x; l.y=next.y; l.scaleX=next.scaleX; l.scaleY=next.scaleY; drag.moved=true;
    render(); updateTransformPropertyValues(l); drawOverlay(); return;
  }
  if (drag.kind === 'rotate') {
    const l = doc.layers.find(x=>x.id===drag.layerId); if (!l || isLayerLocked(doc,l)) return;
    l.rotation = rotationFromDrag(drag.initialRotation, drag.center, drag.start, p, e.shiftKey ? 15 : 0);
    drag.moved = true;
    render(); updateTransformPropertyValues(l); drawOverlay(); return;
  }
  if (drag.kind === 'paint') {
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const event of events.length ? events : [e]) paintTo(canvasPoint(event, { clampToDocument:false }), event);
    schedulePaintPreview();
    drawOverlay();
    return;
  }
  if (drag.kind === 'marquee') {
    drag.current=p;
    if (drag.selectionType === 'lasso') {
      const last=drag.points.at(-1);
      const minDistance=Math.max(.5,1.5/zoom);
      if (!last || Math.hypot(p.x-last.x,p.y-last.y)>=minDistance) drag.points.push(p);
      selectionShape={type:'lasso',points:drag.points.map(point=>({...point}))};
      selectionRect=selectionBounds(selectionShape);
    } else {
      drag.lockAspect=e.shiftKey;
      const r=e.shiftKey?constrainedRect(drag.start,p,true):normalizeRect(drag.start,p);
      selectionShape={type:drag.selectionType,rect:r};selectionRect=r;
    }
    drawOverlay();return;
  }
  if (drag.kind === 'line') { drag.current=e.shiftKey?snapLineEnd(drag.start,p,45):p; previewLine(drag.start,drag.current); return; }
  if (drag.kind === 'shape') { drag.current=p; drag.lockAspect=e.shiftKey; const r=constrainedRect(drag.start,p,e.shiftKey); previewRect(r, els.primaryColor.value); return; }
  if (drag.kind === 'crop') { drag.current=p; cropRect=normalizeRect(drag.start,p); drawOverlay(); return; }
  if (drag.kind === 'gradient') { drag.current=p;previewGradient(drag.start,p);return; }
  if (drag.kind === 'path-control') {
    const layer=drag.pathSource==='document-path'?null:doc.layers.find(item=>item.id===drag.layerId);
    const points=pathTargetPoints(layer,drag.pathSource,drag.subpathIndex,drag.documentPathIndex);
    const node=points?.[drag.nodeIndex];
    if(!node||(layer&&isLayerLocked(doc,layer)))return;
    const local=layer?documentPointToLayerPixel(p,layer):p;
    const distance=Math.hypot(local.x-drag.startLocal.x,local.y-drag.startLocal.y);
    drag.moved=distance>1/zoom;
    if(drag.control==='anchor'){
      const dx=local.x-drag.startLocal.x,dy=local.y-drag.startLocal.y;
      node.x=drag.initial.x+dx;node.y=drag.initial.y+dy;
      node.handleIn=drag.initial.handleIn?{x:drag.initial.handleIn.x+dx,y:drag.initial.handleIn.y+dy}:null;
      node.handleOut=drag.initial.handleOut?{x:drag.initial.handleOut.x+dx,y:drag.initial.handleOut.y+dy}:null;
      node.kind=drag.initial.kind==='smooth'?'smooth':'corner';
    }else{
      node[drag.control]={x:local.x,y:local.y};
      const opposite=drag.control==='handleIn'?'handleOut':'handleIn';
      if(e.altKey)node.kind='corner';
      else{
        node.kind='smooth';
        node[opposite]={x:node.x-(local.x-node.x),y:node.y-(local.y-node.y)};
      }
    }
    render();drawOverlay();return;
  }
  if (drag.kind === 'pen-handle') {
    const node=penDraft?.points?.[drag.nodeIndex];
    if(!node)return;
    const dx=p.x-drag.anchor.x,dy=p.y-drag.anchor.y;
    const moved=Math.hypot(dx,dy)>1/zoom;
    drag.moved=moved;
    if(moved){
      node.handleOut={x:p.x,y:p.y};
      if(e.altKey){node.handleIn=null;node.kind='corner';}
      else{node.handleIn={x:drag.anchor.x-dx,y:drag.anchor.y-dy};node.kind='smooth';}
    }else{
      node.handleIn=null;node.handleOut=null;node.kind='corner';
    }
    penDraft.hover=p;drawOverlay();return;
  }
}
els.overlay.addEventListener('pointermove', onOverlayPointerMove);
els.overlay.addEventListener('pointerup', async (e) => {
  if (activePrimaryPointerId !== e.pointerId) return;
  if (drag?.kind === 'pan') onOverlayPointerMove(e);
  else if (drag && ['move','resize','rotate'].includes(drag.kind)) {
    const releasePoint = canvasPoint(e, { clampToDocument:false });
    if (Math.hypot(releasePoint.x-drag.lastPointer.x, releasePoint.y-drag.lastPointer.y) > .01) onOverlayPointerMove(e);
  }
  activePrimaryPointerId = null;
  if (!drag) return;
  if (drag.kind === 'paint') {
    const layer = doc.layers.find(item => item.id === drag.layerId);
    const releasePoint = canvasPoint(e, { clampToDocument:false });
    const localPoint = layer && documentPointToLayerPixel(releasePoint, layer);
    if (localPoint && Math.hypot(localPoint.x-drag.last.x, localPoint.y-drag.last.y) > .01) paintTo(releasePoint, e);
  }
  const d = drag; drag = null;
  if (['marquee','line','shape','crop','gradient'].includes(d.kind)) d.current = canvasPoint(e);
  clearSmartGuides();
  if (d.kind === 'pan') els.overlay.style.cursor = (spaceHeld || currentTool === 'hand') ? 'grab' : defaultToolCursor();
  if (d.kind === 'move' && d.moved) commit('Перемещение слоя');
  if (d.kind === 'resize' && d.moved) commit('Изменить размер слоя');
  if (d.kind === 'rotate' && d.moved) commit('Повернуть слой');
  if (d.kind === 'paint') await endPaint(d.tool);
  if (d.kind === 'marquee') {
    if (d.selectionType === 'lasso') {
      const last=d.points.at(-1);const p=canvasPoint(e);
      if(!last||Math.hypot(p.x-last.x,p.y-last.y)>1/zoom)d.points.push(p);
      const bounds=selectionBounds({type:'lasso',points:d.points});
      if(d.points.length>=3&&bounds&&bounds.width>=1&&bounds.height>=1)setSelectionShape({type:'lasso',points:d.points});
      else setSelectionShape(null);
    } else {
      const r=(e.shiftKey||d.lockAspect)?constrainedRect(d.start,d.current,true):normalizeRect(d.start,d.current);
      if(r.width>=1&&r.height>=1)setSelectionShape({type:d.selectionType,rect:r});else setSelectionShape(null);
    }
    drawOverlay();
    const label=SELECTION_TYPE_LABELS[d.selectionType]||'Выделение';
    setStatus(selectionRect?`${label}: ${Math.round(selectionRect.width)} × ${Math.round(selectionRect.height)} px`:'Выделение снято');
  }
  if (d.kind === 'line') {
    const end=e.shiftKey?snapLineEnd(d.start,d.current,45):d.current;
    if(Math.hypot(end.x-d.start.x,end.y-d.start.y)>2)await drawLineOnCurrentRaster(d.start,end);
    else render();
  }
  if (d.kind === 'shape') {
    const r = constrainedRect(d.start,d.current,e.shiftKey||d.lockAspect);
    if (r.width > 2 && r.height > 2) { addLayer(doc, createShapeLayer({ x:r.x,y:r.y,width:r.width,height:r.height,shape:els.shapeKind.value,fill:els.primaryColor.value,opacity:Number(els.toolOpacity.value)/100 })); commit('Добавить фигуру'); }
    else render();
  }
  if (d.kind === 'crop') {
    const r = normalizeRect(d.start,d.current);
    if (r.width >= 10 && r.height >= 10) applyCrop(r); else { cropRect=null; drawOverlay(); }
  }
  if (d.kind === 'gradient') await applyGradient(d.start,d.current);
  if (d.kind === 'path-control') {
    if(d.moved){
      const vector=d.pathSource==='vector-mask';
      const saved=d.pathSource==='document-path';
      commit(saved
        ? (d.control==='anchor'?'Переместить узел сохранённого контура':'Изменить ручку сохранённого контура')
        : vector
          ? (d.control==='anchor'?'Переместить узел векторной маски':'Изменить ручку векторной маски')
          : (d.control==='anchor'?'Переместить Bézier-узел':'Изменить Bézier-ручку'));
    }else drawOverlay();
  }
  if (d.kind === 'pen-handle') {
    if(penDraft)penDraft.hover=canvasPoint(e);
    setStatus(d.moved
      ? (penDraft?.points?.[d.nodeIndex]?.kind==='smooth'?'Перо: гладкая точка с симметричными ручками':'Перо: угловая точка с независимой ручкой')
      : 'Перо: угловая точка');
    drawOverlay();
  }
  updateMoveCursor(canvasPoint(e));
});
els.overlay.addEventListener('pointerleave', () => { els.pointer.textContent='x: — y: —';hoverPoint=null;drawOverlay(); });
els.overlay.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
els.overlay.addEventListener('pointercancel', async (e) => {
  if (activePrimaryPointerId !== e.pointerId) return;
  activePrimaryPointerId = null;
  if (!drag) return;
  const d=drag; drag=null; clearSmartGuides();
  if (d.kind==='paint') { await endPaint(d.tool); }
  else {
    if (d.kind==='move') {
      const l=doc.layers.find(x=>x.id===d.layerId); if(l){l.x=d.x;l.y=d.y;render();updateTransformPropertyValues(l);}
    }
    if (d.kind==='resize') {
      const l=doc.layers.find(x=>x.id===d.layerId); if(l){Object.assign(l,d.initial);render();updateTransformPropertyValues(l);}
    }
    if (d.kind==='rotate') {
      const l=doc.layers.find(x=>x.id===d.layerId); if(l){l.rotation=d.initialRotation;render();updateTransformPropertyValues(l);}
    }
    if (d.kind==='crop') cropRect=null;
    if (d.kind==='marquee') setSelectionShape(d.previousSelection);
    if (d.kind==='pen-handle'&&penDraft){
      penDraft.points.splice(d.nodeIndex,1);
      if(!penDraft.points.length)penDraft=null;
    }
    if(d.kind==='path-control')restorePathControlDrag(d);
    if (d.kind==='pan') els.overlay.style.cursor=defaultToolCursor();
    cancelPaintPreview(); drawOverlay(); setStatus('Действие отменено');
  }
});

function previewRect(rect, color) {
  drawOverlay(); const ctx=els.overlay.getContext('2d'); ctx.save(); const opacity=Number(els.toolOpacity.value)/100; ctx.fillStyle=color; ctx.strokeStyle=color; ctx.lineWidth=2/zoom;
  if (els.shapeKind.value === 'ellipse') { ctx.beginPath(); ctx.ellipse(rect.x+rect.width/2,rect.y+rect.height/2,rect.width/2,rect.height/2,0,0,Math.PI*2); ctx.globalAlpha=opacity*.25; ctx.fill(); ctx.globalAlpha=opacity; ctx.stroke(); }
  else { ctx.globalAlpha=opacity*.25; ctx.fillRect(rect.x,rect.y,rect.width,rect.height); ctx.globalAlpha=opacity; ctx.strokeRect(rect.x,rect.y,rect.width,rect.height); } ctx.restore();
}

function previewLine(start,end) {
  drawOverlay();
  const ctx=els.overlay.getContext('2d');
  ctx.save();
  ctx.strokeStyle=els.primaryColor.value;
  ctx.globalAlpha=Number(els.toolOpacity.value)/100;
  ctx.lineWidth=Math.max(1,Number(els.brushSize.value)||1);
  ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.restore();
}

function previewGradient(start,end) {
  drawOverlay();
  const ctx=els.overlay.getContext('2d');
  const distance=Math.max(1,Math.hypot(end.x-start.x,end.y-start.y));
  const gradient=els.gradientType?.value==='radial'
    ? ctx.createRadialGradient(start.x,start.y,0,start.x,start.y,distance)
    : ctx.createLinearGradient(start.x,start.y,end.x,end.y);
  gradient.addColorStop(0,els.primaryColor.value);
  gradient.addColorStop(1,els.secondaryColor?.value||'#ffffff');
  ctx.save();
  clipContextToDocumentSelection(ctx);
  ctx.globalAlpha=.48;
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,doc.width,doc.height);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle='#fff';ctx.lineWidth=1.5/zoom;ctx.setLineDash([5/zoom,4/zoom]);
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
  ctx.fillStyle='#fff';ctx.setLineDash([]);
  for(const point of [start,end]){ctx.beginPath();ctx.arc(point.x,point.y,3/zoom,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

async function applyGradient(start,end){
  const distance=Math.hypot(end.x-start.x,end.y-start.y);if(distance<2){setStatus('Градиент: протяните линию по холсту');return false;}
  if(paintPersisting){setStatus('Сохраняется предыдущая растровая операция…');return false;}
  const canvas=document.createElement('canvas');canvas.width=doc.width;canvas.height=doc.height;const ctx=canvas.getContext('2d',{alpha:true});
  const gradient=els.gradientType?.value==='radial'?ctx.createRadialGradient(start.x,start.y,0,start.x,start.y,distance):ctx.createLinearGradient(start.x,start.y,end.x,end.y);
  gradient.addColorStop(0,els.primaryColor.value);gradient.addColorStop(1,els.secondaryColor?.value||'#ffffff');ctx.fillStyle=gradient;ctx.globalAlpha=Number(els.toolOpacity.value)/100;
  ctx.save();clipContextToDocumentSelection(ctx);ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
  paintPersisting=true;
  try{const dataUrl=await canvasToDataURL(canvas,'image/png');addLayer(doc,createRasterLayer({name:'Градиент',x:0,y:0,width:doc.width,height:doc.height,dataUrl}));brushCanvas=null;brushCtx=null;brushLayerId=null;commit('Добавить градиент');setStatus('Градиент добавлен на новый слой');return true;}catch(error){console.error(error);toast('Не удалось создать градиент','error');return false;}
  finally{paintPersisting=false;}
}

function tracePenDraftPath(ctx,points,hover=null){
  if(!Array.isArray(points)||!points.length)return false;
  ctx.moveTo(points[0].x,points[0].y);
  const segment=(from,to)=>{
    const out=from?.handleOut,incoming=to?.handleIn;
    if(out||incoming){
      const cp1=out||from,cp2=incoming||to;
      ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,to.x,to.y);
    }else ctx.lineTo(to.x,to.y);
  };
  for(let index=1;index<points.length;index+=1)segment(points[index-1],points[index]);
  if(hover){
    const last=points.at(-1);
    const cp1=last.handleOut||last;
    ctx.bezierCurveTo(cp1.x,cp1.y,hover.x,hover.y,hover.x,hover.y);
  }
  return true;
}
function beginPenPoint(point,finish=false){
  if(!penDraft)penDraft={points:[],hover:point};
  const last=penDraft.points.at(-1);
  const nearLast=last&&Math.hypot(point.x-last.x,point.y-last.y)<=4/zoom;
  if(finish&&nearLast){
    if(penDraft.points.length>=2)finishPenPath();
    else setStatus('Перо: для контура нужно минимум 2 точки');
    return false;
  }
  const node={x:point.x,y:point.y,handleIn:null,handleOut:null,kind:'corner'};
  penDraft.points.push(node);penDraft.hover=point;
  drag={kind:'pen-handle',nodeIndex:penDraft.points.length-1,anchor:{...point},moved:false};
  setStatus('Перо: клик — угловая точка, тяните — гладкая, Alt+drag — независимая ручка');
  drawOverlay();return true;
}
function penDraftBounds(points){
  const coords=[];
  for(const point of points||[]){
    coords.push({x:point.x,y:point.y});
    if(point.handleIn)coords.push(point.handleIn);
    if(point.handleOut)coords.push(point.handleOut);
  }
  if(!coords.length)return null;
  const xs=coords.map(point=>point.x),ys=coords.map(point=>point.y);
  const x=Math.min(...xs),y=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
  return{x,y,width:right-x,height:bottom-y};
}
function localizePenNode(point,bounds){
  const local=position=>position?{x:position.x-bounds.x,y:position.y-bounds.y}:null;
  return{
    x:point.x-bounds.x,y:point.y-bounds.y,
    handleIn:local(point.handleIn),handleOut:local(point.handleOut),
    kind:point.kind==='smooth'?'smooth':'corner',
  };
}
function finishPenPath(){
  if(!penDraft||penDraft.points.length<2){penDraft=null;drag=null;drawOverlay();return false;}
  const points=penDraft.points;penDraft=null;
  if(drag?.kind==='pen-handle')drag=null;
  const bounds=penDraftBounds(points);
  if(!bounds||Math.max(bounds.width,bounds.height)<1)return false;
  const localPoints=points.map(point=>localizePenNode(point,bounds));
  addLayer(doc,createShapeLayer({
    name:'Контур',shape:'path',x:bounds.x,y:bounds.y,
    width:Math.max(1,bounds.width),height:Math.max(1,bounds.height),
    pathPoints:localPoints,pathClosed:Boolean(els.penClosed?.checked),
    fill:'transparent',stroke:els.primaryColor.value,
    strokeWidth:Math.max(1,Number(els.brushSize.value)||1),
    opacity:Number(els.toolOpacity.value)/100
  }));
  commit('Добавить Bézier-контур');setStatus('Bézier-контур добавлен');drawOverlay();return true;
}

function findMagneticEdgePoint(point){
  const ctx=els.canvas.getContext('2d',{alpha:true});const radius=Math.max(4,Math.round(10/zoom));const cx=Math.round(point.x),cy=Math.round(point.y);const left=clamp(cx-radius,1,Math.max(1,doc.width-2));const top=clamp(cy-radius,1,Math.max(1,doc.height-2));const right=clamp(cx+radius,2,doc.width-1);const bottom=clamp(cy+radius,2,doc.height-1);const width=right-left+1,height=bottom-top+1;if(width<3||height<3)return point;
  const data=ctx.getImageData(left-1,top-1,width+2,height+2).data;const stride=width+2;const lum=(x,y)=>{const i=(y*stride+x)*4;return data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;};let best={x:cx,y:cy,score:-1};for(let y=1;y<=height;y+=1)for(let x=1;x<=width;x+=1){const gx=Math.abs(lum(x+1,y)-lum(x-1,y));const gy=Math.abs(lum(x,y+1)-lum(x,y-1));const score=gx+gy-Math.hypot(left+x-1-point.x,top+y-1-point.y)*1.5;if(score>best.score)best={x:left+x-1,y:top+y-1,score};}return{x:best.x,y:best.y};
}
function magneticSegmentPoints(from,to){
  const distance=Math.hypot(to.x-from.x,to.y-from.y);const step=Math.max(5,12/zoom);const steps=Math.min(256,Math.max(1,Math.ceil(distance/step)));const result=[];
  for(let index=1;index<=steps;index+=1){const t=index/steps;const snapped=findMagneticEdgePoint({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});const previous=result.at(-1)||from;if(Math.hypot(snapped.x-previous.x,snapped.y-previous.y)>1/zoom)result.push(snapped);}
  return result;
}
function addMagneticPoint(point,finish=false){
  const snapped=findMagneticEdgePoint(point);if(!magneticDraft)magneticDraft={points:[],hover:snapped};const last=magneticDraft.points.at(-1);if(last){magneticDraft.points.push(...magneticSegmentPoints(last,snapped));}else{magneticDraft.points.push(snapped);}magneticDraft.hover=snapped;if(finish&&magneticDraft.points.length>=3)finishMagneticSelection();else{setStatus(`Магнитное лассо: ${magneticDraft.points.length} точек • Enter или двойной щелчок — завершить`);drawOverlay();}
}
function finishMagneticSelection(){if(!magneticDraft||magneticDraft.points.length<3)return false;const points=magneticDraft.points;magneticDraft=null;setSelectionShape({type:'polygon',points});drawOverlay();setStatus(`Магнитное выделение: ${points.length} точек`);return true;}

function magicWandSelect(point){
  const width=els.canvas.width,height=els.canvas.height,total=width*height;if(total>8_000_000){toast('Волшебная палочка: изображение слишком большое для безопасного выделения','warn');setStatus('Уменьшите изображение до 8 МП для волшебной палочки');return false;}
  const x0=clamp(Math.floor(point.x),0,width-1),y0=clamp(Math.floor(point.y),0,height-1);const data=els.canvas.getContext('2d',{alpha:true}).getImageData(0,0,width,height).data;const seed=(y0*width+x0)*4;const target=[data[seed],data[seed+1],data[seed+2],data[seed+3]];const tolerance=(Number(els.fillTolerance?.value)||0)*4.42;const selectedMask=new Uint8Array(total);const queue=new Int32Array(total);let head=0,tail=0;queue[tail++]=y0*width+x0;selectedMask[y0*width+x0]=1;
  const similar=index=>{const i=index*4;return Math.abs(data[i]-target[0])+Math.abs(data[i+1]-target[1])+Math.abs(data[i+2]-target[2])+Math.abs(data[i+3]-target[3])<=tolerance;};while(head<tail){const index=queue[head++],x=index%width,y=(index/width)|0;const neighbors=[];if(x>0)neighbors.push(index-1);if(x+1<width)neighbors.push(index+1);if(y>0)neighbors.push(index-width);if(y+1<height)neighbors.push(index+width);for(const next of neighbors)if(!selectedMask[next]&&similar(next)){selectedMask[next]=1;queue[tail++]=next;}}
  const edges=new Map();const addEdge=(ax,ay,bx,by)=>{const key=`${ax},${ay}`;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({x:bx,y:by});};for(let index=0;index<total;index+=1){if(!selectedMask[index])continue;const x=index%width,y=(index/width)|0;if(y===0||!selectedMask[index-width])addEdge(x,y,x+1,y);if(x===width-1||!selectedMask[index+1])addEdge(x+1,y,x+1,y+1);if(y===height-1||!selectedMask[index+width])addEdge(x+1,y+1,x,y+1);if(x===0||!selectedMask[index-1])addEdge(x,y+1,x,y);}
  const first=edges.keys().next().value;if(!first)return false;const [sx,sy]=first.split(',').map(Number);const points=[{x:sx,y:sy}];let key=first;for(let guard=0;guard<edges.size+4;guard+=1){const list=edges.get(key);if(!list?.length)break;const next=list.pop();if(!list.length)edges.delete(key);points.push(next);key=`${next.x},${next.y}`;if(key===first)break;}const simplified=points.filter((point,index,array)=>{if(index===0||index===array.length-1)return true;const a=array[index-1],b=array[index+1];return (point.x-a.x)*(b.y-point.y)!==(point.y-a.y)*(b.x-point.x);});if(simplified.length<3)return false;setSelectionShape({type:'polygon',points:simplified});drawOverlay();setStatus(`Волшебная палочка: выделено ${tail.toLocaleString('ru-RU')} px`);return true;
}

function createLineLayerFromPoints(start,end) {
  const dx=end.x-start.x,dy=end.y-start.y;
  const absX=Math.abs(dx),absY=Math.abs(dy);
  let x=Math.min(start.x,end.x),y=Math.min(start.y,end.y),width=Math.max(1,absX),height=Math.max(1,absY),lineMode='diag';
  if(absY<0.5){lineMode='horizontal';y=start.y-.5;height=1;}
  else if(absX<0.5){lineMode='vertical';x=start.x-.5;width=1;}
  return createShapeLayer({
    name:'Линия',shape:'line',fill:'transparent',stroke:els.primaryColor.value,
    strokeWidth:Math.max(1,Number(els.brushSize.value)||1),opacity:Number(els.toolOpacity.value)/100,
    x,y,width,height,lineMode,lineFlip:lineMode==='diag'&&dx*dy<0,
  });
}

async function drawLineOnCurrentRaster(start,end){
  if(paintPersisting){setStatus('Сохраняется предыдущая растровая операция…');return false;}
  let layer=selected();
  if(!isEditableRasterLayer(layer)){
    layer=createRasterLayer({name:'Линии',x:0,y:0,width:doc.width,height:doc.height,dataUrl:null});
    addLayer(doc,layer);
  }
  paintPersisting=true;
  try{
    const from=documentPointToLayerPixel(start,layer),to=documentPointToLayerPixel(end,layer);
    if(layer.highDepthSource){
      const buffer=editableHighDepthBuffer(layer);
      if(buffer){
        const changed=applyPixelBufferStrokeSegment(buffer,from,to,Math.max(.5,(Number(els.brushSize.value)||1)/2),hexToRgb(els.primaryColor.value),{opacity:Number(els.toolOpacity.value)/100,isAllowed:rasterSelectionPredicate(layer)});
        if(!changed){setStatus('Линия не изменила high-depth слой');return false;}
        applyHighDepthMutation(layer,await prepareHighDepthMutation(layer,buffer));
        brushCanvas=null;brushCtx=null;brushLayerId=null;clearHighDepthPaintState();
        doc.selectedLayerId=layer.id;
        commit('Нарисовать линию');setStatus(`Линия добавлена в high-depth слой «${layer.name}»`);return true;
      }
    }
    await ensureRasterBuffer(layer);
    brushCtx.save();clipContextToSelection(brushCtx,layer);brushCtx.lineCap='round';brushCtx.lineJoin='round';brushCtx.lineWidth=Math.max(1,Number(els.brushSize.value)||1);brushCtx.globalAlpha=Number(els.toolOpacity.value)/100;brushCtx.globalCompositeOperation='source-over';brushCtx.strokeStyle=els.primaryColor.value;brushCtx.beginPath();brushCtx.moveTo(from.x,from.y);brushCtx.lineTo(to.x,to.y);brushCtx.stroke();brushCtx.restore();
    doc.selectedLayerId=layer.id;
    if(!await persistPaintLayer())throw new Error('Не удалось сохранить слой с линиями');
    commit('Нарисовать линию');setStatus(`Линия добавлена в слой «${layer.name}»`);return true;
  }catch(error){console.error(error);brushCanvas=null;brushCtx=null;brushLayerId=null;render();setStatus(`Ошибка линии: ${error.message}`);toast('Не удалось нарисовать линию','error');return false;}
  finally{paintPersisting=false;}
}

function clearHighDepthPaintState(){
  highDepthPaintBuffer=null;highDepthPaintLayerId=null;highDepthPaintPreviewDirty=false;highDepthCloneSnapshotBuffer=null;
}

function highDepthBudgetForLayer(layer){
  const used=doc.layers.reduce((sum,item)=>item.id===layer?.id?sum:sum+Math.max(0,Number(item?.highDepthSource?.rawBytes)||0),0);
  return Math.max(0,MAX_PIXEL_BUFFER_SOURCE_BYTES-used);
}

function editableHighDepthBuffer(layer,{requireAlpha=false}={}){
  if(!layer?.highDepthSource)return null;
  const decoded=deserializePixelBufferSource(layer.highDepthSource);
  const working=requireAlpha?pixelBufferWithStraightAlpha(decoded):clonePixelBuffer(decoded);
  if(pixelBufferByteLength(working)>highDepthBudgetForLayer(layer))return null;
  return working;
}

function refreshHighDepthPaintCanvas(layer,withFilters=true){
  if(!layer||highDepthPaintLayerId!==layer.id||!highDepthPaintBuffer||!brushCanvas||!brushCtx)return false;
  const preview=sanitizeHighDepthPreview(layer.highDepthPreview);
  const rgba=pixelBufferToToneMappedRgba8Preview(highDepthPaintBuffer,withFilters?(layer.filters||{}):{}, {toneMap:preview.toneMap,displayExposure:preview.displayExposure});
  const image=brushCtx.createImageData(highDepthPaintBuffer.width,highDepthPaintBuffer.height);
  image.data.set(rgba);
  brushCtx.setTransform(1,0,0,1,0,0);brushCtx.globalAlpha=1;brushCtx.globalCompositeOperation='source-over';brushCtx.filter='none';
  brushCtx.clearRect(0,0,brushCanvas.width,brushCanvas.height);
  brushCtx.putImageData(image,0,0);
  highDepthPaintPreviewDirty=false;
  return true;
}

async function ensureNativeHighDepthPaintBuffer(layer,{requireAlpha=false}={}){
  if(!layer?.highDepthSource)return false;
  if(highDepthPaintLayerId===layer.id&&highDepthPaintBuffer&&(!requireAlpha||highDepthPaintBuffer.channels===4))return true;
  const working=editableHighDepthBuffer(layer,{requireAlpha});
  if(!working)return false;
  const size=checkedCanvasSize(layer.width,layer.height,`High-depth слой «${layer.name||'Без имени'}»`);
  if(working.width!==size.width||working.height!==size.height)return false;
  brushCanvas=document.createElement('canvas');brushCanvas.width=size.width;brushCanvas.height=size.height;
  brushCtx=brushCanvas.getContext('2d',{alpha:true,willReadFrequently:true});brushLayerId=layer.id;
  highDepthPaintBuffer=working;highDepthPaintLayerId=layer.id;highDepthPaintPreviewDirty=true;
  refreshHighDepthPaintCanvas(layer,true);
  return true;
}

async function highDepthPreviewDataUrl(layer,buffer){
  const preview=sanitizeHighDepthPreview(layer.highDepthPreview);
  const rgba=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:preview.toneMap,displayExposure:preview.displayExposure});
  const canvas=document.createElement('canvas');canvas.width=buffer.width;canvas.height=buffer.height;
  const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
  const image=ctx.createImageData(buffer.width,buffer.height);image.data.set(rgba);ctx.putImageData(image,0,0);
  return canvasToDataURL(canvas,'image/png');
}

async function prepareHighDepthMutation(layer,buffer){
  const highDepthSource=serializePixelBufferSource(buffer,{maxBytes:highDepthBudgetForLayer(layer)});
  const dataUrl=await highDepthPreviewDataUrl(layer,buffer);
  return {highDepthSource,dataUrl,highDepthPreview:sanitizeHighDepthPreview(layer.highDepthPreview)};
}

function applyHighDepthMutation(layer,mutation){
  const old=layer.dataUrl;
  layer.highDepthSource=mutation.highDepthSource;layer.highDepthPreview=mutation.highDepthPreview;layer.dataUrl=mutation.dataUrl;
  invalidateImageCache(old);
}

async function persistNativeHighDepthPaintLayer(){
  const layer=doc.layers.find(item=>item.id===highDepthPaintLayerId);
  if(!layer||!highDepthPaintBuffer)return false;
  const mutation=await prepareHighDepthMutation(layer,highDepthPaintBuffer);
  applyHighDepthMutation(layer,mutation);
  brushCanvas=null;brushCtx=null;brushLayerId=null;
  clearHighDepthPaintState();
  return true;
}

function applyNativeHighDepthDab(layer,point,pointerEvent=null,erase=false){
  if(highDepthPaintLayerId!==layer?.id||!highDepthPaintBuffer)return false;
  const changed=applyPixelBufferBrushDab(highDepthPaintBuffer,point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),hexToRgb(els.primaryColor.value),{opacity:Number(els.toolOpacity.value)/100,erase,isAllowed:rasterSelectionPredicate(layer)});
  if(changed){highDepthPaintPreviewDirty=true;schedulePaintPreview();}
  return changed>0;
}

function nativeHighDepthStrokeSegment(layer,from,to,pointerEvent=null,erase=false){
  if(highDepthPaintLayerId!==layer?.id||!highDepthPaintBuffer)return false;
  const changed=applyPixelBufferStrokeSegment(highDepthPaintBuffer,from,to,Math.max(.5,brushWidthForPointer(pointerEvent)/2),hexToRgb(els.primaryColor.value),{opacity:Number(els.toolOpacity.value)/100,erase,isAllowed:rasterSelectionPredicate(layer)});
  if(changed){highDepthPaintPreviewDirty=true;schedulePaintPreview();}
  return changed>0;
}

function markNativeHighDepthRetouchChanged(changed){
  if(changed>0){highDepthPaintPreviewDirty=true;schedulePaintPreview();return true;}
  return false;
}

function applyNativeHighDepthToneDab(layer,point,pointerEvent=null,brighten=true){
  if(highDepthPaintLayerId!==layer?.id||!highDepthPaintBuffer)return false;
  const strength=Number(brighten?els.dodgeStrength.value:els.burnStrength.value)/100;
  const changed=applyPixelBufferToneDab(highDepthPaintBuffer,point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),strength,{brighten,isAllowed:rasterSelectionPredicate(layer),strokeCoverage:drag?.toneCoverage});
  return markNativeHighDepthRetouchChanged(changed);
}

function nativeHighDepthToneSegment(layer,from,to,pointerEvent=null,brighten=true){
  const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.18);
  const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/spacing));
  for(let index=1;index<=steps;index+=1){const t=index/steps;applyNativeHighDepthToneDab(layer,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},pointerEvent,brighten);}
}

function applyNativeHighDepthBlurDab(layer,point,pointerEvent=null){
  if(highDepthPaintLayerId!==layer?.id||!highDepthPaintBuffer)return false;
  const changed=applyPixelBufferBlurDab(highDepthPaintBuffer,point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),Number(els.blurStrength.value)/100,{sampleRadius:3,isAllowed:rasterSelectionPredicate(layer),strokeCoverage:drag?.blurCoverage});
  return markNativeHighDepthRetouchChanged(changed);
}

function nativeHighDepthBlurSegment(layer,from,to,pointerEvent=null){
  const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.22);
  const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/spacing));
  for(let index=1;index<=steps;index+=1){const t=index/steps;applyNativeHighDepthBlurDab(layer,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},pointerEvent);}
}

function prepareNativeHighDepthCloneStroke(layer,destinationPoint){
  if(!cloneSource||cloneSource.layerId!==layer?.id||!highDepthPaintBuffer)return false;
  highDepthCloneSnapshotBuffer=clonePixelBuffer(highDepthPaintBuffer);
  return{x:cloneSource.localPoint.x-destinationPoint.x,y:cloneSource.localPoint.y-destinationPoint.y};
}

function applyNativeHighDepthCloneDab(layer,point,offset,pointerEvent=null,healing=false){
  if(highDepthPaintLayerId!==layer?.id||!highDepthPaintBuffer||!highDepthCloneSnapshotBuffer||!offset)return false;
  const changed=applyPixelBufferCloneDab(highDepthPaintBuffer,highDepthCloneSnapshotBuffer,point.x,point.y,Math.max(.5,brushWidthForPointer(pointerEvent)/2),offset,{opacity:Number(els.toolOpacity.value)/100,healing,isAllowed:rasterSelectionPredicate(layer)});
  return markNativeHighDepthRetouchChanged(changed);
}

function nativeHighDepthCloneSegment(layer,from,to,offset,pointerEvent=null,healing=false){
  const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.18);
  const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/spacing));
  for(let index=1;index<=steps;index+=1){const t=index/steps;applyNativeHighDepthCloneDab(layer,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},offset,pointerEvent,healing);}
}

function applyNativeHighDepthSmudgeDab(layer,from,to,pointerEvent=null){
  if(highDepthPaintLayerId!==layer?.id||!highDepthPaintBuffer)return false;
  const changed=applyPixelBufferSmudgeDab(highDepthPaintBuffer,from,to,Math.max(.5,brushWidthForPointer(pointerEvent)/2),Number(els.smudgeStrength?.value||45)/100,{isAllowed:rasterSelectionPredicate(layer)});
  return markNativeHighDepthRetouchChanged(changed);
}

function nativeHighDepthSmudgeSegment(layer,from,to,pointerEvent=null){
  const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.14);
  const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/spacing));
  let previous=from;
  for(let index=1;index<=steps;index+=1){
    const t=index/steps,point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
    applyNativeHighDepthSmudgeDab(layer,previous,point,pointerEvent);previous=point;
  }
}

function drawHighDepthRasterBase(layer, canvas, ctx) {
  if(!layer?.highDepthSource)return false;
  const buffer=deserializePixelBufferSource(layer.highDepthSource);
  const preview=sanitizeHighDepthPreview(layer.highDepthPreview);
  const rgba=pixelBufferToToneMappedRgba8Preview(buffer,{}, {toneMap:preview.toneMap,displayExposure:preview.displayExposure});
  const source=document.createElement('canvas');
  source.width=buffer.width;source.height=buffer.height;
  const sourceCtx=source.getContext('2d',{alpha:true,willReadFrequently:true});
  const image=sourceCtx.createImageData(buffer.width,buffer.height);
  image.data.set(rgba);
  sourceCtx.putImageData(image,0,0);
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  return true;
}

async function ensureRasterBuffer(l) {
  if (!isEditableRasterLayer(l)) return null;
  const paintSize = checkedCanvasSize(l.width, l.height, `Растровый слой «${l.name || 'Без имени'}»`);
  const canvasWidth = paintSize.width;
  const canvasHeight = paintSize.height;
  if (brushLayerId !== l.id || !brushCanvas || brushCanvas.width !== canvasWidth || brushCanvas.height !== canvasHeight) {
    brushCanvas = document.createElement('canvas');
    brushCanvas.width = canvasWidth;
    brushCanvas.height = canvasHeight;
    brushCtx = brushCanvas.getContext('2d', { alpha:true });
    if (!drawHighDepthRasterBase(l, brushCanvas, brushCtx) && l.dataUrl) {
      const img = await getImage(l.dataUrl);
      if (img) brushCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    }
    brushLayerId = l.id;
  }
  return { canvas:brushCanvas, ctx:brushCtx };
}

async function fillAtPoint(point) {
  if (paintPersisting) { setStatus('Сохраняется предыдущая растровая операция…'); return false; }
  if (selectionRect && !pointInsideSelection(point)) {
    setStatus('Заливка: щёлкните внутри активного выделения');
    return false;
  }
  const layer=paintLayerAtPoint(point);
  if(!layer){setStatus('Заливка работает по растровому слою');toast('Выберите растровый слой или щёлкните по изображению','warn');return false;}
  paintPersisting=true;
  try {
    const local=documentPointToLayerPixel(point,layer);
    if(layer.highDepthSource){
      const buffer=editableHighDepthBuffer(layer);
      if(buffer){
        const x=Math.floor(local.x),y=Math.floor(local.y);
        if(x<0||y<0||x>=buffer.width||y>=buffer.height){setStatus('Точка заливки вне растрового слоя');return false;}
        setStatus('High-depth заливка области…');
        const filled=floodFillPixelBuffer(buffer,x,y,hexToRgb(els.primaryColor.value),{tolerance:Number(els.fillTolerance?.value)||0,opacity:Number(els.toolOpacity.value)/100,isAllowed:rasterSelectionPredicate(layer)});
        if(!filled){setStatus('Заливка: подходящая область не найдена');return false;}
        applyHighDepthMutation(layer,await prepareHighDepthMutation(layer,buffer));
        brushCanvas=null;brushCtx=null;brushLayerId=null;clearHighDepthPaintState();
        doc.selectedLayerId=layer.id;commit('Заливка');setStatus(`High-depth заливка: ${filled.toLocaleString('ru-RU')} px`);return true;
      }
    }
    await ensureRasterBuffer(layer);
    const x=Math.floor(local.x),y=Math.floor(local.y);
    if(x<0||y<0||x>=brushCanvas.width||y>=brushCanvas.height){setStatus('Точка заливки вне растрового слоя');return false;}
    setStatus('Заливка области…');
    const imageData=brushCtx.getImageData(0,0,brushCanvas.width,brushCanvas.height);
    const filled=floodFillPixels(imageData.data,brushCanvas.width,brushCanvas.height,x,y,hexToRgb(els.primaryColor.value),{
      tolerance:Number(els.fillTolerance?.value)||0,
      opacity:Number(els.toolOpacity.value)/100,
      isAllowed:rasterSelectionPredicate(layer),
    });
    if(!filled){setStatus('Заливка: подходящая область не найдена');return false;}
    brushCtx.putImageData(imageData,0,0);
    doc.selectedLayerId=layer.id;
    if (!await persistPaintLayer()) throw new Error('Не удалось сохранить растровый слой');
    commit('Заливка');
    setStatus(`Заливка: ${filled.toLocaleString('ru-RU')} px`);
    return true;
  } catch (error) {
    console.error(error);
    brushCanvas=null;brushCtx=null;brushLayerId=null;
    render();
    setStatus(`Ошибка заливки: ${error.message}`);
    toast('Не удалось выполнить заливку','error');
    return false;
  } finally {
    paintPersisting=false;
  }
}

async function clearSelectedPixels({ historyLabel = 'Очистить выделение', successStatus = 'Пиксели внутри выделения очищены' } = {}) {
  if(!selectionRect)return false;
  if(paintPersisting){setStatus('Сохраняется предыдущая растровая операция…');return false;}
  const layer=selected();
  if(!isEditableRasterLayer(layer)){setStatus('Для очистки выделения выберите незаблокированный растровый слой');toast('Выделение очищает пиксели только на растровом слое','warn');return false;}
  if(!selectionIntersectsLayer(layer)){setStatus('Выделение не пересекает выбранный слой');return false;}
  paintPersisting=true;
  try {
    if(layer.highDepthSource){
      const buffer=editableHighDepthBuffer(layer,{requireAlpha:true});
      if(buffer){
        const cleared=clearPixelBufferPixels(buffer,{isAllowed:rasterSelectionPredicate(layer)});
        if(!cleared){setStatus('В выделении нет непрозрачных high-depth пикселей');return false;}
        applyHighDepthMutation(layer,await prepareHighDepthMutation(layer,buffer));
        brushCanvas=null;brushCtx=null;brushLayerId=null;clearHighDepthPaintState();
        commit(historyLabel);setStatus(`${successStatus} · high-depth: ${cleared.toLocaleString('ru-RU')} px`);return true;
      }
    }
    await ensureRasterBuffer(layer);
    brushCtx.save();
    clipContextToSelection(brushCtx,layer);
    brushCtx.clearRect(0,0,brushCanvas.width,brushCanvas.height);
    brushCtx.restore();
    if (!await persistPaintLayer()) throw new Error('Не удалось сохранить растровый слой');
    commit(historyLabel);
    setStatus(successStatus);
    return true;
  } catch (error) {
    console.error(error);
    brushCanvas=null;brushCtx=null;brushLayerId=null;
    render();
    setStatus(`Ошибка очистки выделения: ${error.message}`);
    toast('Не удалось очистить выделение','error');
    return false;
  } finally {
    paintPersisting=false;
  }
}

async function ensurePaintLayer(point, canContinue = () => true) {
  let l = selected();
  const rasterAtPoint = paintLayerAtPoint(point);

  if (['eraser','blur','clone','heal','smudge','dodge','burn'].includes(currentTool)) {
    l = rasterAtPoint;
    if (!l) return null;
  } else if (rasterAtPoint) {
    l = rasterAtPoint;
  } else {
    if (!canContinue()) return null;
    // A transparent raster layer does not need to be encoded as a full-size
    // PNG before the first stroke. Keep it sparse until pixels actually exist.
    l = createRasterLayer({
      name:'Рисование',
      x:0, y:0, width:doc.width, height:doc.height,
      dataUrl:null
    });
    addLayer(doc,l);
  }

  const nativeHighDepth=l.highDepthSource&&NATIVE_HIGH_DEPTH_PAINT_TOOLS.has(currentTool)
    ? await ensureNativeHighDepthPaintBuffer(l,{requireAlpha:currentTool==='eraser'})
    : false;
  if(!nativeHighDepth)await ensureRasterBuffer(l);
  doc.selectedLayerId = l.id;
  return l;
}
async function setCloneSource(point) {
  const layer=findTopEditableRasterLayerAt(point);
  if(!layer){setStatus(`${TOOL_LABELS[currentTool]}: источник должен находиться на растровом слое`);toast('Alt+кликните по растровому слою','warn');return false;}
  if(!layer.highDepthSource)await ensureRasterBuffer(layer);
  cloneSource={layerId:layer.id,documentPoint:{...point},localPoint:documentPointToLayerPixel(point,layer)};
  doc.selectedLayerId=layer.id;
  setStatus(`Источник для «${TOOL_LABELS[currentTool]}» задан. Рисуйте по этому же слою.`);
  drawOverlay();
  return true;}
function prepareCloneStroke(layer, destinationPoint) {
  if(!cloneSource || cloneSource.layerId!==layer.id)return false;
  cloneSnapshotCanvas=document.createElement('canvas');
  cloneSnapshotCanvas.width=brushCanvas.width;cloneSnapshotCanvas.height=brushCanvas.height;
  cloneSnapshotCanvas.getContext('2d',{alpha:true}).drawImage(brushCanvas,0,0);
  return {x:cloneSource.localPoint.x-destinationPoint.x,y:cloneSource.localPoint.y-destinationPoint.y};
}
function ensureRetouchScratch(width,height){
  if(!retouchScratchCanvas)retouchScratchCanvas=document.createElement('canvas');
  if(retouchScratchCanvas.width!==width||retouchScratchCanvas.height!==height){retouchScratchCanvas.width=width;retouchScratchCanvas.height=height;retouchScratchCtx=retouchScratchCanvas.getContext('2d',{alpha:true});}
  else if(!retouchScratchCtx)retouchScratchCtx=retouchScratchCanvas.getContext('2d',{alpha:true});
  retouchScratchCtx.setTransform(1,0,0,1,0,0);retouchScratchCtx.globalAlpha=1;retouchScratchCtx.globalCompositeOperation='source-over';retouchScratchCtx.filter='none';retouchScratchCtx.clearRect(0,0,width,height);
  return{canvas:retouchScratchCanvas,ctx:retouchScratchCtx};
}
function applyFeatherMask(ctx,centerX,centerY,radius){
  const gradient=ctx.createRadialGradient(centerX,centerY,Math.max(0,radius*.55),centerX,centerY,Math.max(.5,radius));
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-in';ctx.fillStyle=gradient;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();
}
function applyCloneDab(point, offset, pointerEvent=null, healing=false) {
  if(!cloneSnapshotCanvas || !offset)return false;
  const radius=Math.max(.5,brushWidthForPointer(pointerEvent)/2);const padding=2;const left=Math.floor(point.x-radius-padding),top=Math.floor(point.y-radius-padding);const size=Math.max(2,Math.ceil(radius*2+padding*2));const {canvas:scratch,ctx:scratchCtx}=ensureRetouchScratch(size,size);
  scratchCtx.drawImage(cloneSnapshotCanvas,-left-offset.x,-top-offset.y);applyFeatherMask(scratchCtx,point.x-left,point.y-top,radius);
  brushCtx.save();brushCtx.globalAlpha=clamp(Number(els.toolOpacity.value)/100,0,1)*(healing?.68:1);brushCtx.globalCompositeOperation=healing?'soft-light':'source-over';brushCtx.drawImage(scratch,left,top);brushCtx.restore();return true;
}
function cloneStrokeSegment(from,to,offset,pointerEvent=null,healing=false) {
  const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.18);const distance=Math.hypot(to.x-from.x,to.y-from.y);const steps=Math.max(1,Math.ceil(distance/spacing));
  for(let index=1;index<=steps;index+=1){const t=index/steps;applyCloneDab({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},offset,pointerEvent,healing);}
}
function applySmudgeDab(from,to,pointerEvent=null){
  if(!brushCanvas||!brushCtx)return false;const radius=Math.max(.5,brushWidthForPointer(pointerEvent)/2);const left=Math.max(0,Math.floor(from.x-radius-2));const top=Math.max(0,Math.floor(from.y-radius-2));const right=Math.min(brushCanvas.width,Math.ceil(from.x+radius+2));const bottom=Math.min(brushCanvas.height,Math.ceil(from.y+radius+2));const width=right-left,height=bottom-top;if(width<=0||height<=0)return false;
  const {canvas:scratch,ctx:scratchCtx}=ensureBlurScratch(width,height);scratchCtx.setTransform(1,0,0,1,0,0);scratchCtx.globalCompositeOperation='source-over';scratchCtx.clearRect(0,0,width,height);scratchCtx.drawImage(brushCanvas,left,top,width,height,0,0,width,height);applyFeatherMask(scratchCtx,from.x-left,from.y-top,radius);
  brushCtx.save();brushCtx.globalAlpha=clamp(Number(els.smudgeStrength?.value||45)/100,0.01,1);brushCtx.globalCompositeOperation='source-over';brushCtx.drawImage(scratch,0,0,width,height,to.x-(from.x-left),to.y-(from.y-top),width,height);brushCtx.restore();return true;
}
function smudgeStrokeSegment(from,to,pointerEvent=null){const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.14);const distance=Math.hypot(to.x-from.x,to.y-from.y);const steps=Math.max(1,Math.ceil(distance/spacing));let previous=from;for(let index=1;index<=steps;index+=1){const t=index/steps;const point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};applySmudgeDab(previous,point,pointerEvent);previous=point;}}
function applyToneDab(layer,point,pointerEvent=null,brighten=true){
  if(!brushCanvas||!brushCtx||!layer)return false;const radius=Math.max(.5,brushWidthForPointer(pointerEvent)/2);const left=Math.max(0,Math.floor(point.x-radius));const top=Math.max(0,Math.floor(point.y-radius));const right=Math.min(brushCanvas.width,Math.ceil(point.x+radius));const bottom=Math.min(brushCanvas.height,Math.ceil(point.y+radius));const width=right-left,height=bottom-top;if(width<=0||height<=0)return false;
  const strength=Number(brighten?els.dodgeStrength.value:els.burnStrength.value)/100;
  const imageData=brushCtx.getImageData(left,top,width,height);const selectionAllows=rasterSelectionPredicate(layer);const changed=applyToneBrushPixels(imageData.data,width,height,point.x-left,point.y-top,radius,strength,{brighten,isAllowed:selectionAllows?(x,y)=>selectionAllows(left+x,top+y):null,strokeCoverage:drag?.toneCoverage,originX:left,originY:top});
  if(changed)brushCtx.putImageData(imageData,left,top);return changed>0;
}
function toneStrokeSegment(layer,from,to,pointerEvent=null,brighten=true){const spacing=Math.max(1,brushWidthForPointer(pointerEvent)*.18);const distance=Math.hypot(to.x-from.x,to.y-from.y);const steps=Math.max(1,Math.ceil(distance/spacing));for(let index=1;index<=steps;index+=1){const t=index/steps;applyToneDab(layer,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},pointerEvent,brighten);}}
function ensureBlurScratch(width, height) {
  if (!blurScratchCanvas) blurScratchCanvas = document.createElement('canvas');
  if (blurScratchCanvas.width !== width || blurScratchCanvas.height !== height) {
    blurScratchCanvas.width = width;
    blurScratchCanvas.height = height;
    blurScratchCtx = blurScratchCanvas.getContext('2d', { alpha:true });
  } else if (!blurScratchCtx) {
    blurScratchCtx = blurScratchCanvas.getContext('2d', { alpha:true });
  }
  return { canvas:blurScratchCanvas, ctx:blurScratchCtx };
}

function applyBlurDab(layer, point, pointerEvent = null) {
  if (!brushCanvas || !brushCtx || !layer) return false;
  const diameter = Math.max(1, brushWidthForPointer(pointerEvent));
  const radius = diameter / 2;
  const blurRadius = 5;
  const margin = Math.ceil(blurRadius * 3 + 2);
  const left = Math.max(0, Math.floor(point.x - radius - margin));
  const top = Math.max(0, Math.floor(point.y - radius - margin));
  const right = Math.min(brushCanvas.width, Math.ceil(point.x + radius + margin));
  const bottom = Math.min(brushCanvas.height, Math.ceil(point.y + radius + margin));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return false;

  const { canvas:scratch, ctx:scratchCtx } = ensureBlurScratch(width, height);
  scratchCtx.save();
  scratchCtx.setTransform(1,0,0,1,0,0);
  scratchCtx.globalAlpha = 1;
  scratchCtx.globalCompositeOperation = 'source-over';
  scratchCtx.filter = 'none';
  scratchCtx.clearRect(0,0,width,height);
  scratchCtx.drawImage(brushCanvas,left,top,width,height,0,0,width,height);
  scratchCtx.restore();

  const {ctx:softenedCtx}=ensureRetouchScratch(width,height);
  softenedCtx.save();softenedCtx.filter=`blur(${blurRadius}px)`;softenedCtx.drawImage(scratch,0,0);softenedCtx.restore();
  const imageData=brushCtx.getImageData(left,top,width,height);
  const blurredData=softenedCtx.getImageData(0,0,width,height);
  const selectionAllows=rasterSelectionPredicate(layer);
  const changed=applyBlurBrushPixels(imageData.data,blurredData.data,width,height,point.x-left,point.y-top,radius,Number(els.blurStrength.value)/100,{isAllowed:selectionAllows?(x,y)=>selectionAllows(left+x,top+y):null,strokeCoverage:drag?.blurCoverage,originX:left,originY:top});
  if(changed)brushCtx.putImageData(imageData,left,top);
  return changed>0;
}

function blurStrokeSegment(layer, from, to, pointerEvent = null) {
  const diameter = Math.max(1, brushWidthForPointer(pointerEvent));
  const spacing = Math.max(1, diameter * 0.22);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    applyBlurDab(layer, { x:from.x + (to.x-from.x)*t, y:from.y + (to.y-from.y)*t }, pointerEvent);
  }
}

async function beginPaint(p, pointerId, pointerEvent = null) {
  if(selectionRect&&!pointInsideSelection(p)){setStatus('Рисование ограничено выделением');return false;}
  const canContinue = () => activePrimaryPointerId === pointerId;
  const l = await ensurePaintLayer(p, canContinue);
  if (!canContinue()) return false;
  if (!l) {
    const message = currentTool === 'eraser'
      ? 'Ластик работает только по растровому слою. Выберите слой с изображением или рисунком.'
      : currentTool === 'blur'
        ? 'Размытие работает только по растровому слою. Выберите слой с изображением или рисунком.'
        : currentTool === 'clone' || currentTool === 'heal'
          ? (cloneSource ? `${TOOL_LABELS[currentTool]} работает по слою заданного источника.` : `${TOOL_LABELS[currentTool]}: сначала задайте источник через Alt+клик.`)
          : currentTool === 'smudge'
            ? 'Палец работает только по существующему растровому слою.'
          : currentTool === 'dodge' || currentTool === 'burn'
            ? 'Инструмент ретуши работает только по существующему растровому слою.'
        : 'Не удалось подготовить растровый слой для рисования.';
    setStatus(message);
    toast(message, 'warn');
    return false;
  }
  const localPoint = documentPointToLayerPixel(p, l);
  drag = { kind:'paint', tool:currentTool, layerId:l.id, last:localPoint, nativeHighDepth:highDepthPaintLayerId===l.id&&NATIVE_HIGH_DEPTH_PAINT_TOOLS.has(currentTool) };
  if (currentTool === 'dodge' || currentTool === 'burn') drag.toneCoverage={width:drag.nativeHighDepth?highDepthPaintBuffer.width:brushCanvas.width,tiles:new Map()};
  if (currentTool === 'blur') drag.blurCoverage={width:drag.nativeHighDepth?highDepthPaintBuffer.width:brushCanvas.width,tiles:new Map()};
  if(drag.nativeHighDepth){
    if(currentTool==='clone'||currentTool==='heal'){
      drag.cloneOffset=prepareNativeHighDepthCloneStroke(l,localPoint);
      if(!drag.cloneOffset){clearHighDepthPaintState();brushCanvas=null;brushCtx=null;brushLayerId=null;drag=null;setStatus(cloneSource?`${TOOL_LABELS[currentTool]}: рисуйте по слою источника`:`${TOOL_LABELS[currentTool]}: Alt+клик задаёт источник`);toast('Сначала задайте источник на этом слое','warn');return false;}
      applyNativeHighDepthCloneDab(l,localPoint,drag.cloneOffset,pointerEvent,currentTool==='heal');return true;
    }
    if(currentTool==='smudge'){drag.smudgeStarted=true;return true;}
    if(currentTool==='dodge'||currentTool==='burn'){applyNativeHighDepthToneDab(l,localPoint,pointerEvent,currentTool==='dodge');return true;}
    if(currentTool==='blur'){applyNativeHighDepthBlurDab(l,localPoint,pointerEvent);return true;}
    applyNativeHighDepthDab(l,localPoint,pointerEvent,currentTool==='eraser');return true;
  }
  brushCtx.save();
  clipContextToSelection(brushCtx,l);
  if (currentTool === 'clone' || currentTool === 'heal') {
    drag.cloneOffset=prepareCloneStroke(l,localPoint);
    if(!drag.cloneOffset){brushCtx.restore();drag=null;setStatus(cloneSource?`${TOOL_LABELS[currentTool]}: рисуйте по слою источника`:`${TOOL_LABELS[currentTool]}: Alt+клик задаёт источник`);toast('Сначала задайте источник на этом слое','warn');return false;}
    applyCloneDab(localPoint,drag.cloneOffset,pointerEvent,currentTool==='heal');schedulePaintPreview();return true;
  }
  if(currentTool==='smudge'){drag.smudgeStarted=true;schedulePaintPreview();return true;}
  if(currentTool==='dodge'||currentTool==='burn'){applyToneDab(l,localPoint,pointerEvent,currentTool==='dodge');schedulePaintPreview();return true;}
  if (currentTool === 'blur') {
    applyBlurDab(l, localPoint, pointerEvent);
    schedulePaintPreview();
    return true;
  }
  brushCtx.lineCap='round';
  brushCtx.lineJoin='round';
  brushCtx.lineWidth=brushWidthForPointer(pointerEvent);
  brushCtx.globalAlpha=Number(els.toolOpacity.value)/100;
  if (currentTool==='eraser') brushCtx.globalCompositeOperation='destination-out';
  else { brushCtx.globalCompositeOperation='source-over'; brushCtx.strokeStyle=els.primaryColor.value; }
  // Draw only the new segment. Keeping one ever-growing Canvas path makes each
  // stroke() repaint the whole path again and becomes O(n²) on long strokes.
  brushCtx.beginPath();
  brushCtx.moveTo(localPoint.x,localPoint.y);
  brushCtx.lineTo(localPoint.x+.01,localPoint.y+.01);
  brushCtx.stroke();
  schedulePaintPreview();
  return true;
}
function paintTo(p, pointerEvent = null) {
  if (!drag || drag.kind!=='paint') return;
  const layer = doc.layers.find(x => x.id === drag.layerId);
  if (!layer) return;
  const next = documentPointToLayerPixel(p, layer);
  const last=drag.last;
  if(drag.nativeHighDepth){
    if(drag.tool==='blur')nativeHighDepthBlurSegment(layer,last,next,pointerEvent);
    else if(drag.tool==='clone'||drag.tool==='heal')nativeHighDepthCloneSegment(layer,last,next,drag.cloneOffset,pointerEvent,drag.tool==='heal');
    else if(drag.tool==='smudge')nativeHighDepthSmudgeSegment(layer,last,next,pointerEvent);
    else if(drag.tool==='dodge'||drag.tool==='burn')nativeHighDepthToneSegment(layer,last,next,pointerEvent,drag.tool==='dodge');
    else nativeHighDepthStrokeSegment(layer,last,next,pointerEvent,drag.tool==='eraser');
    drag.last=next;return;
  }
  if (drag.tool === 'blur') {
    blurStrokeSegment(layer,last,next,pointerEvent);
    drag.last=next;
    return;
  }
  if (drag.tool === 'clone' || drag.tool === 'heal') { cloneStrokeSegment(last,next,drag.cloneOffset,pointerEvent,drag.tool==='heal');drag.last=next;return; }
  if (drag.tool === 'smudge') { smudgeStrokeSegment(last,next,pointerEvent);drag.last=next;return; }
  if (drag.tool === 'dodge' || drag.tool === 'burn') { toneStrokeSegment(layer,last,next,pointerEvent,drag.tool==='dodge');drag.last=next;return; }
  brushCtx.lineWidth=brushWidthForPointer(pointerEvent);
  brushCtx.beginPath();
  brushCtx.moveTo(last.x,last.y);
  brushCtx.lineTo(next.x,next.y);
  brushCtx.stroke();
  drag.last=next;
}
async function persistPaintLayer() {
  const layerId=brushLayerId;
  const canvas=brushCanvas;
  if(!layerId || !canvas)return false;
  const dataUrl=await canvasToDataURL(canvas,'image/png');
  const l=doc.layers.find(x=>x.id===layerId);
  if(!l)return false;
  const old=l.dataUrl;
  l.dataUrl=dataUrl;
  l.highDepthSource=null;
  l.highDepthPreview=null;
  invalidateImageCache(old);
  return true;
}
async function endPaint(paintTool = currentTool) {
  cancelPaintPreview();
  const nativeHighDepth=Boolean(highDepthPaintBuffer&&highDepthPaintLayerId===brushLayerId&&NATIVE_HIGH_DEPTH_PAINT_TOOLS.has(paintTool));
  if ((!brushCtx&&!nativeHighDepth) || paintPersisting) return;
  const labels={eraser:'Ластик',blur:'Размытие кистью',clone:'Штамп',heal:'Лечебная кисть',smudge:'Палец / смазывание',dodge:'Осветлитель',burn:'Затемнитель',brush:'Кисть'};
  const label=labels[paintTool]||'Кисть';
  if(!nativeHighDepth)brushCtx.restore();
  cloneSnapshotCanvas=null;
  paintPersisting=true;
  setStatus('Сохранение штриха…');
  try {
    if (nativeHighDepth ? await persistNativeHighDepthPaintLayer() : await persistPaintLayer()) {
      commit(label);
      setStatus('Готово');
    }
  } catch (error) {
    console.error(error);
    brushCanvas=null;brushCtx=null;brushLayerId=null;
    render();
    setStatus(`Ошибка сохранения штриха: ${error.message}`);
    toast('Не удалось сохранить штрих','error');
  } finally {
    paintPersisting=false;
  }
}

function pickColor(p) {
  const ctx=els.canvas.getContext('2d', { alpha:true });
  const x=clamp(Math.floor(p.x),0,Math.max(0,doc.width-1));
  const y=clamp(Math.floor(p.y),0,Math.max(0,doc.height-1));
  const pixel=ctx.getImageData(x,y,1,1).data;
  if(pixel[3]===0){setStatus('Пипетка: прозрачный пиксель');return;}
  const hex='#'+[pixel[0],pixel[1],pixel[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  els.primaryColor.value=hex;els.colorChip.style.background=hex;
  const alpha=pixel[3]===255?'':` • alpha ${Math.round(pixel[3]/255*100)}%`;
  setStatus(`Цвет: ${hex}${alpha}`);
}
function applyCrop(r) {
  const x=Math.round(r.x), y=Math.round(r.y), w=Math.max(1,Math.round(r.width)), h=Math.max(1,Math.round(r.height));
  doc.layers.forEach(l=>{l.x-=x;l.y-=y;}); doc.width=w; doc.height=h; cropRect=null; clearSelectionState(); brushCanvas=null; brushCtx=null; brushLayerId=null; commit('Кадрирование'); fitToView();
}

function selectAllPixels(){setSelectionShape({type:'rect',rect:{x:0,y:0,width:doc.width,height:doc.height}});drawOverlay();setStatus('Выделен весь холст');}
function deselectPixels(){if(!selectionRect&&!polygonDraft)return;clearSelectionState();drawOverlay();setStatus('Выделение снято');}
function cropToSelection(){if(!selectionRect){setStatus('Нет активного выделения');return;}if(selectionRect.width<1||selectionRect.height<1)return;applyCrop({...selectionRect});}

function openTextModal(point) {
  const existing=topTextLayerAt(point);
  if(existing){
    doc.selectedLayerId=existing.id;updateLayers();refreshInspectorPanels();drawOverlay();
    if(isLayerLocked(doc,existing)){setStatus('Текстовый слой заблокирован');toast('Сначала разблокируйте слой или его группу','warn');return;}
    const targetDoc = doc;
    showModal({ title:'Редактировать текст', className:'text-modal', textPreviewLayer:existing, fields:textModalFields(existing,existing.width), submitLabel:'Применить', onSubmit:async(v,isActive)=>{
      const settings = await textSettingsFromForm(v, existing);
      if (!isActive() || doc !== targetDoc || selected() !== existing || isLayerLocked(doc,existing)) return false;
      Object.assign(existing, settings);
      textDraft = null;
      commit('Редактировать текст');
    }});
    return;
  }
  const targetDoc = doc;
  const defaultWidth = Math.max(240,Math.min(doc.width-point.x,600));
  showModal({ title:'Добавить текст', className:'text-modal', textPreviewPoint:point, fields:textModalFields(null,defaultWidth), submitLabel:'Добавить', onSubmit:async(v,isActive)=>{
    const settings = await textSettingsFromForm(v);
    if (!isActive() || doc !== targetDoc) return false;
    textDraft = null;
    addLayer(doc,createTextLayer({x:point.x,y:point.y,...settings,opacity:Number(els.toolOpacity.value)/100,height:Math.min(12000,Math.max(settings.fontSize*2.4,settings.fontSize*settings.lineHeight*2))}));
    commit('Добавить текст');
  } });
}

function normalizeNumberInput(input) {
  const min=input.min==='' ? -Infinity : Number(input.min);
  const max=input.max==='' ? Infinity : Number(input.max);
  let value=input.valueAsNumber;
  if(!Number.isFinite(value))value=Number(input.dataset.initialValue);
  if(!Number.isFinite(value))value=Number.isFinite(min) ? min : 0;
  value=clamp(value,min,max);
  const step=input.step==='' ? 1 : Number(input.step);
  if(input.step!=='any' && Number.isFinite(step) && step>0){
    const base=Number.isFinite(min) ? min : 0;
    const lowest=Number.isFinite(min) ? Math.ceil((min-base)/step) : -Infinity;
    const highest=Number.isFinite(max) ? Math.floor((max-base)/step) : Infinity;
    const index=clamp(Math.round(Number(((value-base)/step).toFixed(10))),lowest,highest);
    value=Number((base+index*step).toFixed(10));
  }
  input.value=String(value);
}

function showModal({title,className='',textPreviewLayer=null,textPreviewPoint=null,fields=[],submitLabel='OK',onSubmit,onMount=null}) {
  const previousFocus=document.activeElement;
  const back=document.createElement('div'); back.className='modal-backdrop';
  const modal=document.createElement('form'); modal.className=`modal ${className}`;modal.noValidate=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',title);
  modal.innerHTML=`<header>${escapeHtml(title)}</header><div class="modal-body"></div><footer><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">${escapeHtml(submitLabel)}</button></footer>`;
  const body=modal.querySelector('.modal-body');
  for(const f of fields){ const row=document.createElement(f.type==='fontPicker'?'div':'label'); row.className='modal-row'; const label=document.createElement('span'); label.textContent=f.label; let input;
    if(f.type==='fontPicker') { input=document.createElement('button');input.type='button';input.className='secondary-button';input.textContent='Показать список';input.addEventListener('click',async()=>{input.disabled=true;try{const count=await loadComputerFonts(modal.elements.fontFamily);setStatus(`Доступно шрифтов компьютера: ${count}`);}catch(error){toast(error.message,'warn');setStatus(error.message);}finally{input.disabled=false;}}); }
    else if(f.type==='textarea'){input=document.createElement('textarea');input.value=f.value??'';} else if(f.type==='select'){input=document.createElement('select'); for(const [value,text] of f.options){const o=document.createElement('option');o.value=value;o.textContent=text;input.append(o);}input.value=f.value??'';} else {input=document.createElement('input');input.type=f.type||'text';if(f.type!=='file')input.value=f.value??'';if(f.accept)input.accept=f.accept;if(f.placeholder)input.placeholder=f.placeholder; if(f.min!=null)input.min=f.min;if(f.max!=null)input.max=f.max;if(f.step!=null)input.step=f.step;}
    if(f.type!=='fontPicker')input.name=f.name; if(f.required)input.required=true; if(f.type==='number')input.dataset.initialValue=input.value;
    if(f.type==='color'){
      const syncColor=()=>{input.style.backgroundColor=input.value;input.title=input.value.toUpperCase();};
      input.addEventListener('input',syncColor);
      input.addEventListener('change',syncColor);
      syncColor();
    }
    row.append(label,input);body.append(row);
  }
  let closed=false;
  const close=()=>{if(closed)return;closed=true;modal.previewCleanup?.();if(textDraft?.owner===modal){textDraft=null;render();}els.modalRoot.replaceChildren();if(previousFocus instanceof HTMLElement)previousFocus.focus();};
  back.append(modal);els.modalRoot.replaceChildren(back);
  try{onMount?.({modal,body,back,close});}catch(error){console.error(error);toast(error?.message||'Ошибка предпросмотра','error');}
  modal.addEventListener('change',event=>{if(event.target.matches('input[type="number"]'))normalizeNumberInput(event.target);});
  if(className==='text-modal') { back.classList.add('text-modal-backdrop'); attachTextPreview(modal, body, textPreviewLayer, textPreviewPoint); makeModalDraggable(modal); }
  modal.querySelector('[data-cancel]').onclick=close;
  back.addEventListener('mousedown',e=>{if(e.target===back)close();});
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
  modal.addEventListener('submit',async e=>{
    e.preventDefault();
    modal.querySelectorAll('input[type="number"]').forEach(normalizeNumberInput);
    if(!modal.checkValidity()){modal.reportValidity();return;}
    const submit=modal.querySelector('button[type="submit"]');
    const data=Object.fromEntries(new FormData(modal));
    submit.disabled=true;
    try{
      const result=await onSubmit?.(data,()=>!closed&&modal.isConnected);
      if(result!==false)close();else submit.disabled=false;
    }catch(error){
      console.error(error);submit.disabled=false;toast(error?.message||'Ошибка команды','error');setStatus(error?.message||'Ошибка команды');
    }
  });
  modal.querySelector('input,textarea,select')?.focus();
}

function makeModalDraggable(modal) {
  const margin=12;
  modal.style.left=`${Math.max(margin,Math.round((window.innerWidth-modal.offsetWidth)/2))}px`;
  modal.style.top=`${Math.max(margin,Math.round((window.innerHeight-modal.offsetHeight)/2))}px`;
  const header=modal.querySelector('header');
  const keepVisible=()=>{
    if(!modal.isConnected)return;
    modal.style.left=`${clamp(modal.offsetLeft,margin,Math.max(margin,window.innerWidth-modal.offsetWidth-margin))}px`;
    modal.style.top=`${clamp(modal.offsetTop,margin,Math.max(margin,window.innerHeight-modal.offsetHeight-margin))}px`;
  };
  const observer=typeof ResizeObserver==='function' ? new ResizeObserver(keepVisible) : null;
  observer?.observe(modal);
  window.addEventListener('resize',keepVisible);
  const priorCleanup=modal.previewCleanup;
  modal.previewCleanup=()=>{priorCleanup?.();observer?.disconnect();window.removeEventListener('resize',keepVisible);};
  let drag=null;
  header.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const bounds=modal.getBoundingClientRect();
    drag={id:event.pointerId,offsetX:event.clientX-bounds.left,offsetY:event.clientY-bounds.top};
    header.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  header.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const maxX=Math.max(margin,window.innerWidth-modal.offsetWidth-margin);
    const maxY=Math.max(margin,window.innerHeight-modal.offsetHeight-margin);
    modal.style.left=`${clamp(event.clientX-drag.offsetX,margin,maxX)}px`;
    modal.style.top=`${clamp(event.clientY-drag.offsetY,margin,maxY)}px`;
  });
  const finish=event=>{if(drag?.id===event.pointerId)drag=null;};
  header.addEventListener('pointerup',finish);
  header.addEventListener('pointercancel',finish);
}

function blendingPreviewCrop(documentValue, layer) {
  const scale=Math.max(Math.abs(layer.scaleX || 1),Math.abs(layer.scaleY || 1));
  const bounds=frameBounds(layer,Math.min(180*scale,Math.max(documentValue.width,documentValue.height)));
  const width=Math.min(documentValue.width,Math.max(160,bounds.width));
  const height=Math.min(documentValue.height,Math.max(120,bounds.height));
  return {
    x:clamp(bounds.x+bounds.width/2-width/2,0,documentValue.width-width),
    y:clamp(bounds.y+bounds.height/2-height/2,0,documentValue.height-height),
    width,height,
  };
}

function syncBlendingPreviewCanvas() {
  const preview=blendingPreview;
  if(!preview || preview.document!==doc || !preview.canvas.isConnected ||
    doc.layers.find(item=>item.id===preview.layer.id)!==preview.layer ||
    els.canvas.width!==doc.width || els.canvas.height!==doc.height)return;
  const canvas=preview.canvas;
  const width=canvas.clientWidth;
  const height=canvas.clientHeight;
  if(width<1 || height<1)return;
  const ratio=Math.min(window.devicePixelRatio || 1,2);
  const pixelWidth=Math.max(1,Math.round(width*ratio));
  const pixelHeight=Math.max(1,Math.round(height*ratio));
  if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
  if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
  const context=canvas.getContext('2d',{alpha:true});
  context.clearRect(0,0,pixelWidth,pixelHeight);
  const crop=preview.crop;
  const fit=Math.min(pixelWidth/crop.width,pixelHeight/crop.height);
  const drawnWidth=crop.width*fit;
  const drawnHeight=crop.height*fit;
  context.imageSmoothingEnabled=true;
  context.imageSmoothingQuality='high';
  context.drawImage(els.canvas,crop.x,crop.y,crop.width,crop.height,
    (pixelWidth-drawnWidth)/2,(pixelHeight-drawnHeight)/2,drawnWidth,drawnHeight);
}

function attachTextPreview(modal, body, layer, point) {
  const sourceDoc=doc;
  const preview=document.createElement('section');preview.className='text-preview';
  const heading=document.createElement('strong');heading.textContent='Предпросмотр';
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Предпросмотр текста на фоне изображения');
  const status=document.createElement('small');status.textContent='Фрагмент холста в месте текста';
  preview.append(heading,canvas,status);body.prepend(preview);
  const observer=typeof ResizeObserver==='function' ? new ResizeObserver(()=>syncTextPreviewCanvas()) : null;
  observer?.observe(canvas);
  modal.previewCleanup=()=>observer?.disconnect();
  let version=0;
  const update=async()=>{
    const current=++version;
    if(doc!==sourceDoc)return;
    try {
      const values=Object.fromEntries(new FormData(modal));
      const settings=await textSettingsFromForm(values,layer);
      if(current!==version||!modal.isConnected||doc!==sourceDoc)return;
      const draftLayer=createTextLayer({
        ...(layer || {}), ...settings,
        x:layer?.x ?? point?.x ?? 0, y:layer?.y ?? point?.y ?? 0,
        height:layer?.height ?? Math.min(12000,Math.max(settings.fontSize*2.4,settings.fontSize*settings.lineHeight*2)),
        opacity:layer?.opacity ?? Number(els.toolOpacity.value)/100,
      });
      textDraft={owner:modal,document:doc,originalId:layer?.id ?? null,layer:draftLayer,previewCanvas:canvas};
      render();
      status.textContent='Фрагмент холста в месте текста';
    } catch(error) { if(current===version)status.textContent=error.message; }
  };
  modal.addEventListener('input',event=>{
    if(event.target.name==='systemFontName' && event.target.value.trim())modal.elements.fontFile.value='';
    if(event.target.matches('input,textarea,select'))update();
  });
  modal.addEventListener('change',event=>{
    if(event.target.name==='fontFamily'){
      modal.elements.systemFontName.value='';
      modal.elements.fontFile.value='';
    }
    if(event.target.name==='fontFile' && event.target.files?.[0]?.name)modal.elements.systemFontName.value='';
    if(event.target.matches('input,textarea,select'))update();
  });
  update();
}

function syncTextPreviewCanvas() {
  const draft=textDraft;
  const canvas=draft?.previewCanvas;
  if (!canvas?.isConnected || draft.document!==doc) return;
  const pixelRatio=window.devicePixelRatio||1;
  const width=Math.max(1,Math.round(canvas.clientWidth*pixelRatio));
  const height=Math.max(1,Math.round(canvas.clientHeight*pixelRatio));
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  const scale=zoom;
  const bounds=frameBounds(draft.layer);
  const visibleWidth=width/(scale*pixelRatio);
  const margin=16/scale;
  const sourceX=draft.layer.align==='right' ? bounds.x+bounds.width-visibleWidth+margin
    : draft.layer.align==='center' ? bounds.x+bounds.width/2-visibleWidth/2
    : bounds.x-margin;
  const sourceY=bounds.y-margin;
  const context=canvas.getContext('2d');
  context.clearRect(0,0,width,height);
  context.setTransform(scale*pixelRatio,0,0,scale*pixelRatio,-sourceX*scale*pixelRatio,-sourceY*scale*pixelRatio);
  context.drawImage(renderBuffer,0,0);
  context.setTransform(1,0,0,1,0,0);
  const offsetX=-sourceX*scale,offsetY=-sourceY*scale;
  canvas.style.setProperty('--preview-bg-x',`${offsetX}px`);
  canvas.style.setProperty('--preview-bg-y',`${offsetY}px`);
}

function showInfoModal(title, html) {
  const previousFocus=document.activeElement;
  const back=document.createElement('div'); back.className='modal-backdrop';
  const modal=document.createElement('div'); modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',title);
  modal.innerHTML=`<header>${escapeHtml(title)}</header><div class="modal-body info-modal">${html}</div><footer><button type="button" class="primary-button" data-close>Закрыть</button></footer>`;
  back.append(modal); els.modalRoot.replaceChildren(back);
  const close=()=>{els.modalRoot.replaceChildren();if(previousFocus instanceof HTMLElement)previousFocus.focus();};
  modal.querySelector('[data-close]').onclick=close;
  back.addEventListener('mousedown',e=>{if(e.target===back)close();});
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
  modal.querySelector('[data-close]').focus();
}

function showRecoveryModal(record, { canRestore = true, canDiscard = false } = {}) {
  return new Promise(resolve => {
    const back=document.createElement('div');back.className='modal-backdrop';
    const modal=document.createElement('div');modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Восстановление проекта');
    const savedAt=new Date(record.savedAt);
    const time=Number.isNaN(savedAt.getTime())?'неизвестно':savedAt.toLocaleString('ru-RU');
    const names=record.documents.map(item=>escapeHtml(item.docName)).join(', ');
    modal.innerHTML=`<header>Восстановление проекта</header><div class="modal-body info-modal"><p>Найдены автоматически сохранённые документы: <b>${names}</b>.</p><p>Последняя копия: ${escapeHtml(time)}.</p><p class="muted">Копия может относиться к другому открытому окну редактора. «Позже» оставит её в хранилище. ${canRestore?'Восстановленные документы останутся несохранёнными до подтверждения файла на диске.':'Копия повреждена и не может быть открыта.'}</p></div><footer>${canDiscard?'<button type="button" class="danger-button" data-discard>Удалить копию</button>':''}<button type="button" data-later>Позже</button>${canRestore?'<button type="button" class="primary-button" data-restore>Восстановить</button>':''}</footer>`;
    back.append(modal);els.modalRoot.replaceChildren(back);
    const close=action=>{els.modalRoot.replaceChildren();resolve(action);};
    if(canDiscard)modal.querySelector('[data-discard]').onclick=()=>close('discard');
    modal.querySelector('[data-later]').onclick=()=>close('later');
    if(canRestore)modal.querySelector('[data-restore]').onclick=()=>close('restore');
    modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close('later');}});
    modal.querySelector(canRestore?'[data-restore]':'[data-later]').focus();
  });
}

async function restoreRecoveryIfAvailable() {
  if (!recoveryStorageAvailable) return false;
  let stored;
  try {
    const entries=await loadRecoverySnapshots({includeInvalid:true});
    if(entries.some(item=>item.key===recoveryKey&&!item.record))recoveryKey=createRecoveryKey(true);
    stored=entries.filter(item=>item.record);
  }
  catch(error){ reportRecoveryFailure(error); return false; }
  if(!stored.length)return false;
  stored.sort((a,b)=>b.record.savedAt-a.record.savedAt);
  for(const {key,record} of stored){
    const recovered=[];
    const invalid=[];
    record.documents.forEach((item,index)=>{
      try { recovered.push({ doc:sanitizeProject(JSON.parse(item.snapshot)), index }); }
      catch(error){ invalid.push(item); console.warn('Invalid recovery document was preserved in storage',error); }
    });
    const canDiscard=key===recoveryKey||key==='latest';
    const action=await showRecoveryModal(record,{canRestore:recovered.length>0,canDiscard});
    if(action==='later'){
      if(key===recoveryKey)recoveryKey=createRecoveryKey(true);
      continue;
    }
    if(action==='discard'){
      const removed=await discardRecovery(key);
      toast(removed?'Автосохранённая копия удалена':'Не удалось удалить автокопию',removed?'success':'error');
      if(!removed)return false;
      continue;
    }
    unrestoredRecoveryDocuments=invalid;
    if(key!==recoveryKey&&stored.some(item=>item.key===recoveryKey))recoveryKey=createRecoveryKey(true);
    documentSessions=recovered.map(item=>buildSession(item.doc,{label:'Автовосстановление',dirtyState:true}));
    const activeIndex=Math.max(0,recovered.findIndex(item=>item.index===record.activeIndex));
    activeSessionId=documentSessions[activeIndex].id;
    loadSession(documentSessions[activeIndex]);
    updateAll();
    markDirty(true);
    setStatus('Проект восстановлен из автосохранения');
    toast('Документы восстановлены. Сохраните каждый через Ctrl+S.','success');
    return true;
  }
  return false;
}

function canReplaceDocument() {
  return !dirty || window.confirm('В документе есть несохранённые изменения. Продолжить без сохранения?');
}

async function createNewDialog() {
  if (blockPendingDocumentEdit()) return;
  if (!canReplaceDocument()) return;
  showModal({title:'Новый документ',fields:[{name:'name',label:'Название',value:'Без имени'},{name:'width',label:'Ширина',type:'number',value:'1200',min:'1',max:'12000',required:true},{name:'height',label:'Высота',type:'number',value:'800',min:'1',max:'12000',required:true},{name:'background',label:'Фон',type:'select',value:'transparent',options:[['transparent','Прозрачный'],['#ffffff','Белый'],['#000000','Чёрный']] }],submitLabel:'Создать',onSubmit:async v=>{if(blockPendingDocumentEdit())return false;try{const next=createDocument({name:v.name||'Без имени',width:Number(v.width),height:Number(v.height),background:v.background});history=new HistoryStack(80);setDoc(next,{resetHistory:true,label:'Новый документ'});markDirty(false);queueRecovery({immediate:true});fitToView();}catch(error){toast(error.message,'error');setStatus(error.message);return false;}}});
}

function isImageFile(file) {
  return Boolean(file) && !isPsdFile(file) && (String(file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name || ''));
}
function isProjectFile(file) { return Boolean(file) && /\.(zpe|pixforge|json)$/i.test(file.name || ''); }
function visibleCanvasCenter() {
  const vr=els.viewport.getBoundingClientRect();
  const cr=els.overlay.getBoundingClientRect();
  return {
    x: clamp((vr.left + vr.width / 2 - cr.left) / zoom, 0, doc.width),
    y: clamp((vr.top + vr.height / 2 - cr.top) / zoom, 0, doc.height),
  };
}
function clientPointToCanvas(clientX, clientY) {
  const r=els.overlay.getBoundingClientRect();
  return {
    x: clamp((clientX-r.left)/zoom, 0, doc.width),
    y: clamp((clientY-r.top)/zoom, 0, doc.height),
  };
}

async function importImages(files, { anchor = null, source = 'Импорт' } = {}) {
  const images=[...files].filter(isImageFile); if(!images.length)return 0;
  const targetDocument=doc;
  const targetSessionId=activeSessionId;
  setStatus(`${source}: чтение изображений…`);

  // Decode and validate everything before mutating the document. If the third
  // file is corrupt or unreasonably large, the first two must not appear as a
  // half-finished import with no matching history entry.
  const prepared=[];
  for(const file of images){
    const dataUrl=await readFileAsDataURL(file);
    const d=await dimensionsFromDataUrl(dataUrl);
    checkedCanvasSize(d.width,d.height,`Изображение «${file.name || 'Без имени'}»`);
    prepared.push({file,dataUrl,width:d.width,height:d.height});
  }

  if(doc!==targetDocument||activeSessionId!==targetSessionId){
    setStatus('Импорт отменён: активный документ изменился');
    toast('Повторите импорт в нужной вкладке','warn');
    return 0;
  }
  if(blockPendingDocumentEdit())return 0;
  const emptyDocument = doc.layers.length===0 && doc.name==='Без имени';
  if(emptyDocument){
    const first=prepared[0];
    doc.width=first.width;doc.height=first.height;doc.name=(first.file.name || 'Изображение').replace(/\.[^.]+$/,'');
  }
  let offset=0;
  for(const item of prepared){
    const target = emptyDocument ? {x:doc.width/2,y:doc.height/2} : (anchor || visibleCanvasCenter());
    addLayer(doc,createRasterLayer({
      name:item.file.name || `Вставка ${new Date().toLocaleTimeString('ru-RU')}`,
      x:target.x-item.width/2+offset,y:target.y-item.height/2+offset,width:item.width,height:item.height,dataUrl:item.dataUrl,
    }));
    offset+=18;
  }
  brushCanvas=null;
  commit(images.length===1?`${source} изображения`:`${source}: ${images.length} изображений`);
  if (emptyDocument) fitToView();
  setStatus(`${source} завершён`);
  toast(images.length===1?'Изображение добавлено как слой':`Добавлено слоёв: ${images.length}`,'success');
  return images.length;
}

async function rgbaPixelsToDataUrl(width,height,pixels,label='PSD слой'){
  const size=checkedCanvasSize(width,height,label);
  if(!(pixels instanceof Uint8Array)&&!(pixels instanceof Uint8ClampedArray))throw new Error(`${label}: отсутствуют RGBA-пиксели`);
  if(pixels.length!==size.width*size.height*4)throw new Error(`${label}: неверный размер RGBA-буфера`);
  const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d',{alpha:true});
  const imageData=ctx.createImageData(size.width,size.height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData,0,0);
  return canvasToDataURL(canvas,'image/png');
}

function importPsdVectorMask(sourceMask, layer) {
  if(!sourceMask?.subpaths?.length)return null;
  const localize=node=>{
    const anchor=documentPointToLayerPixel(node,layer);
    return{
      x:anchor.x,y:anchor.y,
      handleIn:node.handleIn?documentPointToLayerPixel(node.handleIn,layer):null,
      handleOut:node.handleOut?documentPointToLayerPixel(node.handleOut,layer):null,
      kind:node.kind==='smooth'?'smooth':'corner',
    };
  };
  return createVectorMask({
    enabled:sourceMask.enabled!==false,
    invert:sourceMask.invert===true,
    linked:sourceMask.linked!==false,
    fillStartsWithAllPixels:sourceMask.fillStartsWithAllPixels===true,
    subpaths:sourceMask.subpaths.map(subpath=>({
      operation:['add','subtract','intersect','exclude'].includes(subpath.operation)?subpath.operation:'add',
      closed:subpath.closed!==false,
      fillRule:subpath.fillRule==='even-odd'?'even-odd':'non-zero',
      points:(subpath.points||[]).map(localize),
    })).filter(subpath=>subpath.points.length>=2),
  });
}

function exportPsdVectorMask(layer) {
  const source=layer?.vectorMask;
  if(!source?.subpaths?.length)return null;
  const documentize=node=>{
    const anchor=layerPixelToDocumentPoint(node,layer);
    return{
      x:anchor.x,y:anchor.y,
      handleIn:node.handleIn?layerPixelToDocumentPoint(node.handleIn,layer):null,
      handleOut:node.handleOut?layerPixelToDocumentPoint(node.handleOut,layer):null,
      kind:node.kind==='smooth'?'smooth':'corner',
    };
  };
  return{
    enabled:source.enabled!==false,
    invert:source.invert===true,
    linked:source.linked!==false,
    fillStartsWithAllPixels:source.fillStartsWithAllPixels===true,
    subpaths:source.subpaths.map(subpath=>({
      operation:['add','subtract','intersect','exclude'].includes(subpath.operation)?subpath.operation:'add',
      closed:subpath.closed!==false,
      fillRule:subpath.fillRule==='even-odd'?'even-odd':'non-zero',
      points:(subpath.points||[]).map(documentize),
    })).filter(subpath=>subpath.points.length>=2),
  };
}
async function openPsd(file){
  if(blockPendingDocumentEdit())return;
  if(!canReplaceDocument())return;
  if(Number(file?.size)>512*1024*1024){
    const message='PSD/PSB больше 512 МБ пока не импортируется: используйте уменьшенную копию или дождитесь tiled pipeline';
    toast(message,'error');setStatus(message);return;
  }
  const targetDocument=doc;
  const targetSessionId=activeSessionId;
  const targetHistoryEntry=history.current();
  const targetChangeSerial=documentChangeSerial;
  setStatus('PSD/PSB: чтение структуры и каналов…');
  try{
    const parsed=await decodePsd(await file.arrayBuffer(),{maxPixels:48_000_000,maxLayers:500});
    const warnings=[...parsed.warnings];
    if(parsed.iccProfile){
      const profile=parsed.iccProfile;
      warnings.push(`ICC profile обнаружен: ${profile.colorSpace||'unknown'} → ${profile.pcs||'unknown'}, v${profile.version||'?'}${profile.signatureValid?'':' (header signature invalid)'}. Текущий Canvas preview пока не выполняет явное ICC-преобразование`);
    }else if(parsed.iccUntagged){
      warnings.push('PSD/PSB помечен как intentionally untagged ICC; ZPE не назначает профиль автоматически');
    }
    if(parsed.bitsPerChannel===16)warnings.push('RGB 16-bit/channel декодирован без потери точности; Stage 12a сохраняет bounded high-depth source внутри .zpe, а Canvas preview/edit пока остаётся 8-bit');
    if(parsed.bitsPerChannel===32)warnings.push('RGB 32-bit floating-point/HDR декодирован в Float32 PixelBuffer; Stage 12a сохраняет bounded source внутри .zpe, но Canvas preview пока клипует 0..1 и не выполняет HDR tone mapping');
    if(parsed.layers.some(layer=>layer.transparencyProtected))warnings.push('Protect Transparency из PSD/PSB пока не переносится как отдельный lock-режим ZPE');
    const sourceGroups=new Map((parsed.groups||[]).map(group=>[group.key,group]));
    const usedGroupKeys=new Set(parsed.layers.map(layer=>layer.groupKey).filter(Boolean));
    for(const key of [...usedGroupKeys]){
      let current=sourceGroups.get(key);
      const seen=new Set();
      while(current?.parentKey&&!seen.has(current.key)){
        seen.add(current.key);
        usedGroupKeys.add(current.parentKey);
        current=sourceGroups.get(current.parentKey);
      }
    }
    const importedGroups=[];
    const groupIdByKey=new Map();
    for(const sourceGroup of parsed.groups||[]){
      if(!usedGroupKeys.has(sourceGroup.key))continue;
      const group=createLayerGroup({
        name:sourceGroup.name||'PSD Group',
        visible:sourceGroup.visible!==false,
        collapsed:Boolean(sourceGroup.collapsed),
        opacity:clamp(Number(sourceGroup.opacity??1),0,1),
        blendMode:sourceGroup.blendMode||'pass-through',
      });
      importedGroups.push(group);
      groupIdByKey.set(sourceGroup.key,group.id);
    }
    for(const sourceGroup of parsed.groups||[]){
      const groupId=groupIdByKey.get(sourceGroup.key);
      if(!groupId)continue;
      const group=importedGroups.find(item=>item.id===groupId);
      group.parentGroupId=sourceGroup.parentKey?(groupIdByKey.get(sourceGroup.parentKey)??null):null;
    }
    const prepared=[];
    let highDepthBytesUsed=0;
    for(const sourceLayer of [...parsed.layers].reverse()){
      const sourcePixels=sourceLayer.pixelBuffer
        ? pixelBufferToRgba8Preview(sourceLayer.pixelBuffer)
        : sourceLayer.pixels;
      const dataUrl=await rgbaPixelsToDataUrl(sourceLayer.width,sourceLayer.height,sourcePixels,`PSD/PSB слой «${sourceLayer.name}»`);
      let highDepthSource=null;
      if(sourceLayer.pixelBuffer?.bitsPerChannel>8){
        const rawBytes=sourceLayer.pixelBuffer.data?.byteLength||0;
        const remaining=Math.max(0,MAX_PIXEL_BUFFER_SOURCE_BYTES-highDepthBytesUsed);
        if(rawBytes>0&&rawBytes<=remaining){
          highDepthSource=serializePixelBufferSource(sourceLayer.pixelBuffer,{maxBytes:remaining});
          highDepthBytesUsed+=highDepthSource.rawBytes;
        }else{
          warnings.push(`Слой «${sourceLayer.name}»: high-depth source ${Math.ceil(rawBytes/1024/1024)} МБ не помещается в bounded .zpe budget ${Math.round(MAX_PIXEL_BUFFER_SOURCE_BYTES/1024/1024)} МБ; сохранён только 8-bit preview`);
        }
      }
      const maskDataUrl=sourceLayer.mask
        ? await rgbaPixelsToDataUrl(sourceLayer.width,sourceLayer.height,sourceLayer.mask.pixels,`Маска PSD/PSB слоя «${sourceLayer.name}»`)
        : null;
      const importedLayer=createRasterLayer({
        name:sourceLayer.name||'PSD Layer',
        visible:sourceLayer.visible!==false,
        opacity:clamp(Number(sourceLayer.opacity),0,1),
        blendMode:sourceLayer.blendMode||'source-over',
        x:sourceLayer.x,y:sourceLayer.y,width:sourceLayer.width,height:sourceLayer.height,
        groupId:sourceLayer.groupKey?(groupIdByKey.get(sourceLayer.groupKey)??null):null,
        dataUrl,
        highDepthSource,
        mask:maskDataUrl?createLayerMask({enabled:sourceLayer.mask.disabled!==true,dataUrl:maskDataUrl}):null,
      });
      importedLayer.vectorMask=importPsdVectorMask(sourceLayer.vectorMask,importedLayer);
      if(sourceLayer.vectorMask?.linked===false)warnings.push(`Слой «${sourceLayer.name}»: Photoshop vector mask unlinked-флаг сохранён, но ZPE при трансформациях пока перемещает её вместе со слоем`);
      prepared.push(importedLayer);
      sourceLayer.pixelBuffer=null;
      sourceLayer.pixels=null;
      if(sourceLayer.mask)sourceLayer.mask.pixels=null;
    }
    if(!prepared.length&&(parsed.compositePixelBuffer||parsed.composite)){
      const compositePixels=parsed.compositePixelBuffer
        ? pixelBufferToRgba8Preview(parsed.compositePixelBuffer)
        : parsed.composite;
      let highDepthSource=null;
      if(parsed.compositePixelBuffer?.bitsPerChannel>8){
        const rawBytes=parsed.compositePixelBuffer.data?.byteLength||0;
        const remaining=Math.max(0,MAX_PIXEL_BUFFER_SOURCE_BYTES-highDepthBytesUsed);
        if(rawBytes>0&&rawBytes<=remaining){
          highDepthSource=serializePixelBufferSource(parsed.compositePixelBuffer,{maxBytes:remaining});
          highDepthBytesUsed+=highDepthSource.rawBytes;
        }else{
          warnings.push(`PSD/PSB composite: high-depth source ${Math.ceil(rawBytes/1024/1024)} МБ не помещается в bounded .zpe precision budget; сохранён только 8-bit preview`);
        }
      }
      prepared.push(createRasterLayer({
        name:'PSD/PSB Composite',x:0,y:0,width:parsed.width,height:parsed.height,
        dataUrl:await rgbaPixelsToDataUrl(parsed.width,parsed.height,compositePixels,'PSD/PSB composite'),
        highDepthSource,
      }));
    }
    if(!prepared.length)throw new Error('PSD/PSB не содержит bitmap-данных, которые текущий RGB/8-bit pipeline может импортировать');

    if(doc!==targetDocument||activeSessionId!==targetSessionId||
      history.current()!==targetHistoryEntry||documentChangeSerial!==targetChangeSerial){
      setStatus('Импорт PSD/PSB отменён: документ изменился во время декодирования');
      toast('Повторите импорт PSD/PSB в нужной вкладке','warn');
      return;
    }
    if(blockPendingDocumentEdit())return;
    const next=createDocument({
      name:(file.name||'PSD').replace(/\.ps[db]$/i,''),
      width:parsed.width,height:parsed.height,background:'transparent'
    });
    next.layers=prepared;
    next.groups=importedGroups;
    next.paths=structuredClone(parsed.paths||[]);
    next.colorProfile=parsed.iccProfile?{
      kind:'icc',
      untagged:Boolean(parsed.iccUntagged),
      dataUrl:bytesToDataUrl(parsed.iccProfile.bytes,'application/vnd.iccprofile'),
      name:parsed.iccProfile.name||'',
      version:parsed.iccProfile.version||'',
      deviceClass:parsed.iccProfile.deviceClass||'',
      colorSpace:parsed.iccProfile.colorSpace||'',
      pcs:parsed.iccProfile.pcs||'',
      signatureValid:parsed.iccProfile.signatureValid===true,
    }:(parsed.iccUntagged?{kind:'untagged',untagged:true}:null);
    if(parsed.iccProfile)parsed.iccProfile.bytes=null;
    next.selectedLayerId=prepared.at(-1)?.id??null;
    history=new HistoryStack(80);
    setDoc(next,{resetHistory:true,label:'Импорт PSD/PSB'});
    markDirty(true);
    queueRecovery({immediate:true});
    fitToView();
    setStatus(`PSD/PSB импортирован: ${prepared.length} слоёв, групп: ${importedGroups.length}, paths: ${next.paths.length}. Сохраните проект как .zpe`);
    toast(`PSD/PSB открыт: ${prepared.length} слоёв, групп: ${importedGroups.length}, paths: ${next.paths.length}`,'success');
    if(warnings.length){
      console.warn('PSD/PSB import warnings',warnings);
      toast(`PSD/PSB импортирован с ограничениями: ${warnings.length}. Подробности — в консоли`,'warn');
    }
  }catch(error){
    console.error('PSD/PSB import failed',{name:file?.name,size:file?.size,error});
    const message=`Не удалось импортировать PSD/PSB: ${error?.message||error}`;
    alert(message);setStatus('Ошибка импорта PSD/PSB');toast(message,'error');
  }
}

async function handleIncomingFiles(files, anchor = null, source = 'Импорт') {
  const incoming=[...files];
  const psdFiles=incoming.filter(isPsdFile);
  const project=incoming.find(isProjectFile);
  const images=incoming.filter(isImageFile);
  if(psdFiles.length){
    if(psdFiles.length!==1||incoming.length!==1){
      toast('PSD/PSB открывается как отдельный документ: выберите один Photoshop-файл за раз','warn');
      setStatus('Выберите один PSD/PSB-файл');return;
    }
    await openPsd(psdFiles[0]);return;
  }
  if (project && images.length===0) { await openProject(project); return; }
  if (images.length) { await importImages(images,{anchor,source}); return; }
  if (project) { await openProject(project); return; }
  toast('Формат файла не поддерживается','error');
  setStatus('Неподдерживаемый файл');
}

async function openProject(file) {
  if (blockPendingDocumentEdit()) return;
  if (!canReplaceDocument()) return;
  const targetDocument=doc;
  const targetSessionId=activeSessionId;
  const targetHistoryEntry=history.current();
  const targetChangeSerial=documentChangeSerial;
  try {
    const raw=await readFileAsText(file);
    const data=sanitizeProject(JSON.parse(raw));
    if(doc!==targetDocument||activeSessionId!==targetSessionId||
      history.current()!==targetHistoryEntry||documentChangeSerial!==targetChangeSerial){
      setStatus('Открытие отменено: документ изменился во время чтения файла');
      toast('Повторите открытие проекта в нужной вкладке','warn');
      return;
    }
    if(blockPendingDocumentEdit())return;
    history=new HistoryStack(80);
    setDoc(data,{resetHistory:true,label:'Открыть проект'});
    markDirty(false);
    queueRecovery({immediate:true});
    fitToView();
    setStatus('Проект открыт');
    toast('Открыт проект: '+file.name,'success');
  }catch(e){
    console.error(e);
    alert('Не удалось открыть проект: '+e.message);
    setStatus('Ошибка открытия проекта');
  }
}
function saveProject() { if(blockPendingDocumentEdit())return; const session=currentSession(); if(session?.smartObjectLink){saveSmartObjectContent(session);return;} const name=`${safeFilename(doc.name)}.zpe`; downloadText(JSON.stringify(doc,null,2),name,'application/json'); queueRecovery({immediate:true}); setStatus(`Скачивание ${name} запущено. Проверьте файл перед закрытием вкладки`); }

function psdExportBounds(layer){
  const scale=Math.max(Math.abs(Number(layer.scaleX)||1),Math.abs(Number(layer.scaleY)||1));
  const blur=Math.max(0,Number(layer.filters?.blur)||0)*scale*3;
  const stroke=layer.type==='shape'?Math.max(0,Number(layer.strokeWidth)||0)*scale/2:0;
  const bounds=frameBounds(layer,Math.ceil(blur+stroke+layerStyleOutset(layer.styles)*scale+2));
  const x=Math.floor(bounds.x),y=Math.floor(bounds.y);
  const width=Math.max(1,Math.ceil(bounds.x+bounds.width)-x);
  const height=Math.max(1,Math.ceil(bounds.y+bounds.height)-y);
  checkedCanvasSize(width,height,`PSD export слоя «${layer.name||'Без имени'}»`);
  return{x,y,width,height};
}

function canvasRgbaPixels(canvas,label){
  try{
    return canvas.getContext('2d',{alpha:true,willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  }catch(error){
    throw new Error(`${label}: не удалось прочитать пиксели (${error?.message||error})`);
  }
}

async function renderPsdLayerPixels(layer,bounds){
  const canvas=document.createElement('canvas');canvas.width=bounds.width;canvas.height=bounds.height;
  const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
  ctx.translate(-bounds.x,-bounds.y);
  const preview=structuredClone(layer);
  preview.mask=null;
  preview.vectorMask=null;
  preview.opacity=1;
  preview.blendMode='source-over';
  await renderLayer(ctx,preview);
  return canvasRgbaPixels(canvas,`PSD слой «${layer.name||'Без имени'}»`);
}

async function renderPsdMaskPixels(layer,bounds){
  if(!layer.mask?.dataUrl)return null;
  const canvas=document.createElement('canvas');canvas.width=bounds.width;canvas.height=bounds.height;
  const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
  ctx.translate(-bounds.x,-bounds.y);
  const maskLayer=createRasterLayer({
    name:`${layer.name||'Слой'} — mask`,
    x:layer.x,y:layer.y,width:layer.width,height:layer.height,
    scaleX:layer.scaleX,scaleY:layer.scaleY,rotation:layer.rotation,
    opacity:1,blendMode:'source-over',dataUrl:layer.mask.dataUrl,
    filters:{...DEFAULT_LAYER_FILTERS},styles:null,mask:null,
  });
  await renderLayer(ctx,maskLayer);
  return canvasRgbaPixels(canvas,`PSD mask «${layer.name||'Без имени'}»`);
}

function layerNeedsSemanticRasterWarning(layer){
  if(layer.type!=='raster')return true;
  if(layer.styles)return true;
  const filters=sanitizeFilters(layer.filters);
  return Object.keys(DEFAULT_LAYER_FILTERS).some(key=>Math.abs(Number(filters[key])-Number(DEFAULT_LAYER_FILTERS[key]))>1e-9)||
    Math.abs(Number(layer.scaleX??1)-1)>1e-9||Math.abs(Number(layer.scaleY??1)-1)>1e-9||Math.abs(Number(layer.rotation)||0)>1e-9;
}

function nativeHighDepthPsdSource(layer){
  if(!layer?.highDepthSource||layer.type!=='raster'||layerNeedsSemanticRasterWarning(layer))return null;
  if(!Number.isInteger(Number(layer.x))||!Number.isInteger(Number(layer.y)))return null;
  try{
    const buffer=deserializePixelBufferSource(layer.highDepthSource);
    if(buffer.model!=='rgb'||![16,32].includes(buffer.bitsPerChannel))return null;
    if(buffer.width!==Math.trunc(Number(layer.width))||buffer.height!==Math.trunc(Number(layer.height)))return null;
    return buffer;
  }catch(error){
    console.warn(`PSD/PSB high-depth source «${layer.name||'Без имени'}» не прошёл export validation`,error);
    return null;
  }
}

function nativePsdBounds(layer,buffer){
  return{x:Math.trunc(Number(layer.x)||0),y:Math.trunc(Number(layer.y)||0),width:buffer.width,height:buffer.height};
}

function exactHighDepthCompositeCandidate(exportDoc,planned,hasAdjustmentLayers){
  if(hasAdjustmentLayers)return null;
  const visible=planned.filter(item=>isLayerVisible(exportDoc,item.layer));
  if(visible.length!==1)return null;
  const item=visible[0],layer=item.layer,buffer=item.nativePixelBuffer;
  if(!buffer||layer.groupId||layer.mask||layer.vectorMask)return null;
  if(Math.abs(Number(layer.opacity??1)-1)>1e-9||(layer.blendMode||'source-over')!=='source-over')return null;
  if(item.bounds.x!==0||item.bounds.y!==0||item.bounds.width!==exportDoc.width||item.bounds.height!==exportDoc.height)return null;
  return buffer;
}

async function preparePsdExport(exportDoc){
  const warnings=[];
  const sourceLayers=exportDoc.layers.filter(layer=>layer.type!=='adjustment');
  const hasAdjustmentLayers=exportDoc.layers.some(layer=>layer.type==='adjustment'&&isLayerVisible(exportDoc,layer));
  const planned=sourceLayers.map(layer=>{
    const nativePixelBuffer=nativeHighDepthPsdSource(layer);
    return{layer,nativePixelBuffer,bounds:nativePixelBuffer?nativePsdBounds(layer,nativePixelBuffer):psdExportBounds(layer)};
  });
  const nativeDepths=planned.map(item=>item.nativePixelBuffer?.bitsPerChannel||0);
  const bitsPerChannel=nativeDepths.includes(32)?32:nativeDepths.includes(16)?16:8;
  let totalPixels=exportDoc.width*exportDoc.height+planned.reduce((sum,item)=>sum+item.bounds.width*item.bounds.height,0);
  if(hasAdjustmentLayers)totalPixels+=exportDoc.width*exportDoc.height;
  if(totalPixels>48_000_000){
    throw new Error(`PSD export Stage 4 ограничен суммарно 48 МП временных RGBA-буферов; документ требует около ${Math.ceil(totalPixels/1_000_000)} МП. Для больших документов нужен tiled/streaming writer.`);
  }
  const groupsById=new Map((exportDoc.groups||[]).map(group=>[group.id,group]));
  const sourceGroupIds=new Set(sourceLayers.map(layer=>layer.groupId).filter(Boolean));
  for(const id of [...sourceGroupIds]){
    let current=groupsById.get(id);
    const seen=new Set();
    while(current?.parentGroupId&&!seen.has(current.id)){
      seen.add(current.id);
      sourceGroupIds.add(current.parentGroupId);
      current=groupsById.get(current.parentGroupId);
    }
  }
  const exportGroups=(exportDoc.groups||[])
    .filter(group=>sourceGroupIds.has(group.id))
    .map(group=>({
      key:group.id,
      parentKey:group.parentGroupId&&sourceGroupIds.has(group.parentGroupId)?group.parentGroupId:null,
      name:group.name||'Group',
      visible:group.visible!==false,
      collapsed:Boolean(group.collapsed),
      opacity:clamp(Number(group.opacity??1),0,1),
      blendMode:group.blendMode||'pass-through',
    }));
  if(sourceLayers.some(layerNeedsSemanticRasterWarning))warnings.push('Text/shape, transforms, filters и layer styles экспортированы как raster preview соответствующих слоёв');
  const downgradedHighDepth=planned.filter(item=>item.layer.highDepthSource&&!item.nativePixelBuffer);
  if(downgradedHighDepth.length)warnings.push(`${downgradedHighDepth.length} high-depth слой(я) с transform/filter/style или несовместимой геометрией экспортированы через 8-bit raster preview`);
  if(bitsPerChannel>8&&planned.some(item=>!item.nativePixelBuffer))warnings.push(`Документ экспортируется как ${bitsPerChannel}-bit; raster-preview слои без native high-depth source расширены из 8-bit без восстановления утраченной точности`);
  if(sourceLayers.some(layer=>layer.vectorMask?.linked===false))warnings.push('Unlinked vector mask flag записывается в PSD/PSB, но ZPE при трансформациях пока перемещает такую маску вместе со слоем');
  if(exportDoc.layers.some(layer=>layer.mask&&!layer.mask.dataUrl))warnings.push('Пустые маски «показать всё» не создают отдельный PSD mask channel');

  const prepared=[];
  for(const {layer,bounds,nativePixelBuffer} of planned){
    const item={
      name:layer.name||'ZPE Layer',
      x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,
      opacity:clamp(Number(layer.opacity??1),0,1),
      blendMode:layer.blendMode||'source-over',
      groupKey:layer.groupId&&sourceGroupIds.has(layer.groupId)?layer.groupId:null,
      visible:hasAdjustmentLayers?false:(layer.groupId&&sourceGroupIds.has(layer.groupId)?layer.visible!==false:isLayerVisible(exportDoc,layer)),
      mask:layer.mask?.dataUrl?{
        pixels:await renderPsdMaskPixels(layer,bounds),
        disabled:layer.mask.enabled===false,
      }:null,
      vectorMask:exportPsdVectorMask(layer),
    };
    if(nativePixelBuffer)item.pixelBuffer=nativePixelBuffer;
    else item.pixels=await renderPsdLayerPixels(layer,bounds);
    prepared.push(item);
  }

  const compositePixelBuffer=exactHighDepthCompositeCandidate(exportDoc,planned,hasAdjustmentLayers);
  const compositeCanvas=document.createElement('canvas');
  await renderDocument(compositeCanvas,exportDoc,{checker:false});
  const composite=canvasRgbaPixels(compositeCanvas,'PSD/PSB composite');
  if(bitsPerChannel>8&&!compositePixelBuffer)warnings.push(`${bitsPerChannel}-bit layer channels сохранены с native precision, но merged composite построен из текущего 8-bit Canvas renderer и затем расширен до глубины документа`);

  if(hasAdjustmentLayers){
    warnings.push('Adjustment layers Stage 1 не имеют Photoshop-semantic mapping: визуальный результат сохранён через верхний Composite Preview, исходные слои оставлены скрытыми');
    prepared.push({
      name:'ZPE Composite Preview (adjustments baked)',
      x:0,y:0,width:exportDoc.width,height:exportDoc.height,
      pixels:composite,opacity:1,blendMode:'source-over',visible:true,mask:null,
    });
  }else if(!prepared.length){
    prepared.push({
      name:'ZPE Composite Preview',
      x:0,y:0,width:exportDoc.width,height:exportDoc.height,
      pixels:composite,opacity:1,blendMode:'source-over',visible:true,mask:null,
    });
  }

  if(exportDoc.colorProfile?.kind==='icc')warnings.push('ICC profile сохранён как metadata resource без явного color transform; пиксельные операции ZPE пока выполняются в unmanaged Canvas pipeline');
  return{layers:[...prepared].reverse(),groups:exportGroups,paths:structuredClone(exportDoc.paths||[]),composite,compositePixelBuffer,bitsPerChannel,warnings};
}

async function exportPsdDocument(exportDoc,{psb=false}={}){
  const format=psb?'PSB':'PSD';
  setStatus(`${format}: подготовка слоёв…`);
  const prepared=await preparePsdExport(exportDoc);
  setStatus(`${format}: упаковка ${prepared.bitsPerChannel}-bit каналов…`);
  const encodeBlob=psb?encodePsbBlob:encodePsdBlob;
  const profile=exportDoc.colorProfile;
  const iccProfile=profile?.kind==='icc'&&profile.dataUrl
    ? dataUrlToBytes(profile.dataUrl,{maxBytes:4*1024*1024})
    : null;
  const blob=encodeBlob({
    width:exportDoc.width,height:exportDoc.height,
    layers:prepared.layers,groups:prepared.groups,paths:prepared.paths,composite:prepared.composite,
    compositePixelBuffer:prepared.compositePixelBuffer,bitsPerChannel:prepared.bitsPerChannel,
    iccProfile,iccUntagged:Boolean(profile?.untagged),
    maxPixels:48_000_000,maxLayers:500,
  });
  const filename=`${safeFilename(exportDoc.name)}.${psb?'psb':'psd'}`;
  downloadBlob(blob,filename);
  if(prepared.warnings.length){
    console.warn(`${format} export warnings`,prepared.warnings);
    setStatus(`Экспортирован ${filename} с ограничениями: ${prepared.warnings.length}`);
    toast(`${format} экспортирован с ограничениями: ${prepared.warnings.length}. Подробности — в консоли`,'warn');
  }else{
    setStatus(`Экспортирован ${filename}`);
    toast(`${format} экспортирован`,'success');
  }
}

async function exportDialog() { if(blockPendingDocumentEdit())return; showModal({title:'Экспорт изображения',fields:[{name:'format',label:'Формат',type:'select',value:'image/png',options:[['image/png','PNG'],['image/jpeg','JPEG'],['image/webp','WebP'],['image/vnd.adobe.photoshop','PSD — слои 8/16/32-bit'],['psb','PSB — Large Document 8/16/32-bit']]},{name:'quality',label:'Качество',type:'number',value:'92',min:'1',max:'100'}],submitLabel:'Экспорт',onSubmit:async v=>{if(blockPendingDocumentEdit())return false;try{setStatus('Экспорт…');const type=v.format;const exportDoc=restoreDocument(snapshotDocument(doc));if(type==='image/vnd.adobe.photoshop'){await exportPsdDocument(exportDoc);return;}if(type==='psb'){await exportPsdDocument(exportDoc,{psb:true});return;}const blob=await compositeToBlob(exportDoc,type,clamp(Number(v.quality)/100,.01,1));const filename=`${safeFilename(exportDoc.name)}.${MIME_EXT[type]}`;downloadBlob(blob,filename);setStatus(`Экспортирован ${filename}`);}catch(e){console.error(e);alert(e.message);setStatus('Ошибка экспорта');}}}); }

function canvasToPngBlob(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить PNG для буфера обмена')),'image/png'));
}

async function renderSelectionLayerToPng(layer,bounds) {
  const canvas=document.createElement('canvas');
  canvas.width=bounds.width;canvas.height=bounds.height;
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.clearRect(0,0,bounds.width,bounds.height);
  ctx.save();
  ctx.translate(-bounds.x,-bounds.y);
  clipContextToDocumentSelection(ctx);
  const clipboardLayer=structuredClone(layer);
  clipboardLayer.blendMode='source-over';
  await renderLayer(ctx,clipboardLayer);
  ctx.restore();
  return canvasToPngBlob(canvas);
}

async function renderSelectionMergedToPng(bounds) {
  const full=document.createElement('canvas');
  await renderDocument(full,doc,{checker:false});
  const canvas=document.createElement('canvas');
  canvas.width=bounds.width;canvas.height=bounds.height;
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.clearRect(0,0,bounds.width,bounds.height);
  ctx.save();
  ctx.translate(-bounds.x,-bounds.y);
  clipContextToDocumentSelection(ctx);
  ctx.drawImage(full,0,0);
  ctx.restore();
  return canvasToPngBlob(canvas);
}

async function prepareClearedHighDepthMutation(layer){
  if(!layer?.highDepthSource)return null;
  const buffer=editableHighDepthBuffer(layer,{requireAlpha:true});
  if(!buffer)return null;
  const cleared=clearPixelBufferPixels(buffer,{isAllowed:rasterSelectionPredicate(layer)});
  if(!cleared)return {cleared:0,mutation:null};
  return {cleared,mutation:await prepareHighDepthMutation(layer,buffer)};
}

async function prepareClearedRasterDataUrl(layer) {
  const size=checkedCanvasSize(layer.width,layer.height,`Растровый слой «${layer.name||'Без имени'}»`);
  const canvas=document.createElement('canvas');
  canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!drawHighDepthRasterBase(layer,canvas,ctx)&&layer.dataUrl){
    const image=await getImage(layer.dataUrl);
    if(image)ctx.drawImage(image,0,0,size.width,size.height);
  }
  ctx.save();
  clipContextToSelection(ctx,layer);
  ctx.clearRect(0,0,size.width,size.height);
  ctx.restore();
  return canvasToDataURL(canvas,'image/png');
}

async function rasterizeLayerForPixelEditing(layer,{suffixName=true}={}) {
  if(!layer)return null;
  if(layer.type==='adjustment')throw new Error('Корректирующий слой нельзя растрировать отдельно от результата нижележащего стека');
  if(layer.type==='raster')return layer;
  const scale=Math.max(Math.abs(Number(layer.scaleX)||1),Math.abs(Number(layer.scaleY)||1));
  const blur=Math.max(0,Number(layer.filters?.blur)||0) * scale * 3;
  const stroke=layer.type==='shape' ? Math.max(0,Number(layer.strokeWidth)||0) * scale / 2 : 0;
  const bounds=frameBounds(layer,Math.ceil(blur+stroke+layerStyleOutset(layer.styles)*scale+2));
  const x=Math.floor(bounds.x), y=Math.floor(bounds.y);
  const width=Math.max(1,Math.ceil(bounds.x+bounds.width)-x), height=Math.max(1,Math.ceil(bounds.y+bounds.height)-y);
  checkedCanvasSize(width,height,`Растеризация слоя «${layer.name||'Без имени'}»`);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.translate(-x,-y);
  const baked=structuredClone(layer);baked.opacity=1;baked.blendMode='source-over';
  await renderLayer(ctx,baked);
  return createRasterLayer({
    id:layer.id,name:suffixName?`${layer.name} — растр`:layer.name,visible:layer.visible,locked:false,
    opacity:layer.opacity,blendMode:layer.blendMode,groupId:layer.groupId??null,
    x,y,width,height,dataUrl:await canvasToDataURL(canvas,'image/png')
  });
}

async function clearSelectionAcrossVisibleLayers({ historyLabel = 'Вырезать выделение' } = {}) {
  if(!selectionRect)return {cleared:0,locked:0,rasterized:0};
  if(paintPersisting){setStatus('Сохраняется предыдущая растровая операция…');return null;}
  const intersecting=doc.layers.filter(layer=>isLayerVisible(doc,layer)&&selectionIntersectsLayer(layer));
  const pixelTargets=intersecting.filter(layer=>layer.type!=='adjustment');
  const targets=pixelTargets.filter(layer=>!isLayerLocked(doc,layer));
  const locked=pixelTargets.length-targets.length;
  if(!targets.length)return {cleared:0,locked,rasterized:0};
  paintPersisting=true;
  try {
    const prepared=[];
    let rasterized=0;
    for(const layer of targets){
      const working=layer.type==='raster' ? layer : await rasterizeLayerForPixelEditing(layer);
      if(layer.type!=='raster')rasterized+=1;
      if(layer.type==='raster'&&working.highDepthSource){
        const highDepth=await prepareClearedHighDepthMutation(working);
        if(highDepth?.mutation){prepared.push({layer,working,dataUrl:highDepth.mutation.dataUrl,highDepthMutation:highDepth.mutation});continue;}
      }
      prepared.push({layer,working,dataUrl:await prepareClearedRasterDataUrl(working),highDepthMutation:null});
    }
    for(const {layer,working,dataUrl,highDepthMutation} of prepared){
      const index=doc.layers.findIndex(item=>item.id===layer.id);
      if(index<0)continue;
      if(layer.type==='raster'){
        if(highDepthMutation){applyHighDepthMutation(layer,highDepthMutation);continue;}
        const old=layer.dataUrl;
        layer.dataUrl=dataUrl;
        layer.highDepthSource=null;
        layer.highDepthPreview=null;
        invalidateImageCache(old);
      }else{
        working.dataUrl=dataUrl;
        doc.layers.splice(index,1,working);
      }
    }
    brushCanvas=null;brushCtx=null;brushLayerId=null;
    commit(historyLabel);
    return {cleared:prepared.length,locked,rasterized};
  } catch(error) {
    console.error(error);
    brushCanvas=null;brushCtx=null;brushLayerId=null;
    render();
    setStatus(`Ошибка вырезания со всех слоёв: ${error.message}`);
    toast('Не удалось очистить выделение на всех слоях','error');
    return null;
  } finally {
    paintPersisting=false;
  }
}

function finishSelectionClipboardAction(message) {
  clearSelectionState();
  setTool('move');
  setStatus(message);
}

async function copySelectionToClipboard({ cut = false } = {}) {
  if(!selectionRect){setStatus('Сначала выделите область инструментом выделения');toast('Нет активного выделения','warn');return false;}
  const layer=selected();
  if(selectionCopyMode==='selected'&&!layer){setStatus('Нет выбранного слоя');toast('Выберите слой для копирования','warn');return false;}
  if(cut&&selectionCopyMode==='selected'&&!isEditableRasterLayer(layer)){setStatus('Вырезание выбранного слоя доступно только на незаблокированном растровом слое');toast('Для вырезания выберите незаблокированный растровый слой','warn');return false;}
  const bounds=selectionPixelBounds(selectionRect,doc.width,doc.height);
  if(!bounds){setStatus('Выделение пустое');return false;}
  if(!navigator.clipboard?.write||typeof ClipboardItem!=='function'){
    setStatus('Копирование изображения в системный буфер недоступно в этом браузере');
    toast('Браузер не поддерживает запись изображений в буфер обмена','error');
    return false;
  }
  try {
    // ClipboardItem accepts Promise<Blob>, so the clipboard write is initiated
    // while Ctrl+C / Ctrl+X still owns the browser user activation.
    const pngPromise=selectionCopyMode==='merged'
      ? renderSelectionMergedToPng(bounds)
      : renderSelectionLayerToPng(layer,bounds);
    const item=new ClipboardItem({'image/png':pngPromise});
    await navigator.clipboard.write([item]);
    if(cut){
      if(selectionCopyMode==='merged'){
        const result=await clearSelectionAcrossVisibleLayers({historyLabel:'Вырезать выделение со всех слоёв'});
        if(!result)return false;
        const details=[];
        if(result.rasterized)details.push(`растрировано слоёв: ${result.rasterized}`);
        if(result.locked)details.push(`заблокировано и не изменено: ${result.locked}`);
        const message=result.cleared
          ? `Вырезано со всех видимых слоёв: ${bounds.width} × ${bounds.height} px${details.length?` • ${details.join(' • ')}`:''}`
          : `Скопировано объединённое выделение: ${bounds.width} × ${bounds.height} px • очищать нечего`;
        finishSelectionClipboardAction(message);
        toast(result.cleared?'Выделение вырезано со всех доступных видимых слоёв':'Объединённое выделение скопировано; доступных слоёв для очистки нет',result.cleared?'success':'warn');
        return true;
      }
      const cleared=await clearSelectedPixels({
        historyLabel:'Вырезать выделение',
        successStatus:`Вырезано в буфер: ${bounds.width} × ${bounds.height} px`,
      });
      if(!cleared){toast('Область скопирована, но удалить пиксели со слоя не удалось','warn');return false;}
      finishSelectionClipboardAction(`Вырезано в буфер: ${bounds.width} × ${bounds.height} px`);
      toast('Выделенная область вырезана в буфер обмена','success');
      return true;
    }
    const sourceLabel=selectionCopyMode==='merged'?'со всех видимых слоёв':'с выбранного слоя';
    finishSelectionClipboardAction(`Скопировано ${sourceLabel}: ${bounds.width} × ${bounds.height} px`);
    toast(`Выделенная область скопирована ${sourceLabel}`,'success');
    return true;
  } catch(error) {
    console.warn('Clipboard image write failed',error);
    setStatus(`Не удалось записать выделение в буфер: ${error.message||'доступ запрещён'}`);
    toast('Не удалось скопировать изображение в системный буфер','error');
    return false;
  }
}

function copySelection() { return copySelectionToClipboard(); }
function cutSelection() { return copySelectionToClipboard({cut:true}); }

async function readClipboardImageFiles() {
  if (!navigator.clipboard?.read) return [];
  const clipboardItems=await navigator.clipboard.read();
  const files=[];
  for (const item of clipboardItems) {
    const type=item.types.find(t=>t.startsWith('image/'));
    if (!type) continue;
    const blob=await item.getType(type);
    const ext=MIME_EXT[type] || type.split('/')[1] || 'png';
    files.push(new File([blob],`Вставка-${Date.now()}.${ext}`,{type}));
  }
  return files;
}

async function pasteFromClipboard() {
  if (!navigator.clipboard?.read) {
    toast('Для вставки используйте Ctrl+V — прямое чтение буфера недоступно браузеру','error');
    return;
  }
  const targetDocument=doc;
  const targetSessionId=activeSessionId;
  try {
    const files=await readClipboardImageFiles();
    if (!files.length) { toast('В буфере обмена нет изображения','error'); return; }
    if(doc!==targetDocument||activeSessionId!==targetSessionId){
      setStatus('Вставка отменена: активный документ изменился');
      return;
    }
    pasteGeneration+=1;
    await importImages(files,{anchor:visibleCanvasCenter(),source:'Вставка'});
  } catch (error) {
    console.warn('Clipboard read failed',error);
    toast('Браузер не разрешил прямое чтение буфера. Нажмите Ctrl+V','error');
  }
}

function armPasteShortcutFallback() {
  const generation=++pasteGeneration;
  const targetDocument=doc;
  const targetSessionId=activeSessionId;
  setStatus('Вставка из буфера…');
  clearTimeout(pasteFallbackTimer);
  pasteFallbackTimer=setTimeout(()=>{
    if(generation===pasteGeneration&&doc===targetDocument&&activeSessionId===targetSessionId)
      setStatus('Буфер не передал изображение — попробуйте скопировать изображение снова или перетащить файл');
  },900);
  if (!navigator.clipboard?.read) return;
  // Start while the keydown still has user activation. Native `paste` remains enabled and wins when it supplies an image.
  readClipboardImageFiles().then(files=>{
    if(!files.length)return;
    setTimeout(()=>{
      if(generation!==pasteGeneration||doc!==targetDocument||activeSessionId!==targetSessionId)return;
      pasteGeneration+=1;
      clearTimeout(pasteFallbackTimer);
      importImages(files,{anchor:visibleCanvasCenter(),source:'Вставка'}).catch(error=>{
        console.error(error);toast(error.message||'Ошибка вставки','error');
      });
    },80);
  }).catch(error=>{
    // Permission errors are expected in some browsers; the native paste event still gets its chance.
    console.debug('Clipboard fallback unavailable',error);
  });
}

function toggleSelectedVisibility() {
  const l=selected(); if(!l)return;
  l.visible=!l.visible; commit(l.visible?'Показать слой':'Скрыть слой');
}
function toggleSelectedLock() {
  const l=selected(); if(!l)return;
  const group=l.groupId ? doc.groups?.find(item=>item.id===l.groupId) : null;
  if(group?.locked){setStatus('Слой заблокирован группой');return;}
  l.locked=!l.locked; commit(l.locked?'Заблокировать слой':'Разблокировать слой');
}
function nudgeSelected(dx,dy) {
  const l=selected(); if(!l || isLayerLocked(doc,l))return;
  l.x+=dx; l.y+=dy; commit('Сдвинуть слой');
}
function focusSelectedLayerRow() {
  const id = doc.selectedLayerId;
  if (!id) return;
  els.layers.querySelector(`[data-id=\"${id}\"]`)?.focus();
}
function selectAdjacentLayer(direction, { focus = false } = {}) {
  if (!doc.layers.length) return;
  const index=Math.max(0,doc.layers.findIndex(l=>l.id===doc.selectedLayerId));
  const next=clamp(index+direction,0,doc.layers.length-1);
  doc.selectedLayerId=doc.layers[next].id; updateAll();
  if (focus) requestAnimationFrame(focusSelectedLayerRow);
}
function centerSelectedLayer() {
  const l=selected();if(!isTransformableLayer(l)||isLayerLocked(doc,l))return;
  const frame=layerFrame(l);
  l.x += doc.width/2-frame.center.x;
  l.y += doc.height/2-frame.center.y;
  commit('Центрировать слой');
}
function alignSelectedLayer(mode) {
  const l=selected();
  if(!l){setStatus('Сначала выберите слой');return;}
  if(!isTransformableLayer(l)){setStatus('Корректирующий слой не имеет геометрической трансформации');return;}
  if(isLayerLocked(doc,l)){setStatus('Слой или его группа заблокированы');return;}
  const next=alignLayerToCanvas(l,mode,doc.width,doc.height);
  if(!next.changed){setStatus('Слой уже выровнен');return;}
  l.x=next.x;l.y=next.y;
  const labels={left:'по левому краю',hcenter:'по центру горизонтально',right:'по правому краю',top:'по верхнему краю',vcenter:'по центру вертикально',bottom:'по нижнему краю'};
  commit(`Выровнять слой ${labels[mode]||''}`.trim());
  setStatus(`Слой выровнен ${labels[mode]||''}`.trim());
}
function fitSelectedLayerToCanvas() {
  const l=selected();if(!isTransformableLayer(l)||isLayerLocked(doc,l))return;
  const bounds=frameBounds(l);
  if(bounds.width<=0||bounds.height<=0)return;
  const ratio=Math.min(doc.width/bounds.width,doc.height/bounds.height);
  if(!Number.isFinite(ratio)||ratio<=0)return;
  l.scaleX=(l.scaleX??1)*ratio;l.scaleY=(l.scaleY??1)*ratio;
  const frame=layerFrame(l);
  l.x += doc.width/2-frame.center.x;
  l.y += doc.height/2-frame.center.y;
  commit('Вписать слой в холст');
}

function setDocumentBackground() {
  showModal({title:'Фон документа',fields:[{name:'background',label:'Фон',type:'select',value:doc.background,options:[['transparent','Прозрачный'],['#ffffff','Белый'],['#000000','Чёрный'],[els.primaryColor.value,'Основной цвет']]}],submitLabel:'Применить',onSubmit:v=>{doc.background=v.background;commit('Фон документа');}});
}
function togglePanels() {
  const before = els.viewport.getBoundingClientRect();
  const centerPoint = clientPointToCanvas(before.left + before.width / 2, before.top + before.height / 2);
  panelsVisible=!panelsVisible;
  els.workspace.classList.toggle('panels-hidden',!panelsVisible);
  els.toolbar.setAttribute('aria-hidden', String(!panelsVisible));
  els.rightPanel.setAttribute('aria-hidden', String(!panelsVisible));
  requestAnimationFrame(() => {
    const viewportRect = els.viewport.getBoundingClientRect();
    const canvasRect = els.overlay.getBoundingClientRect();
    els.viewport.scrollLeft += canvasRect.left + centerPoint.x * zoom - (viewportRect.left + viewportRect.width / 2);
    els.viewport.scrollTop += canvasRect.top + centerPoint.y * zoom - (viewportRect.top + viewportRect.height / 2);
  });
  setStatus(panelsVisible ? 'Панели показаны' : 'Режим холста: панели скрыты');
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { console.warn(error); toast('Полноэкранный режим недоступен','error'); }
}
function showShortcuts() {
  showInfoModal('Горячие клавиши',`<div class="shortcut-list">
    <b>Ctrl+N</b><span>Новый документ</span><b>Ctrl+O</b><span>Открыть изображение</span>
    <b>Ctrl+S</b><span>Сохранить проект .zpe</span><b>Ctrl+Shift+S</b><span>Экспорт</span>
    <b>Ctrl+C / Ctrl+X</b><span>Копировать / вырезать активное выделение</span><b>Ctrl+V</b><span>Вставить изображение из буфера</span>
    <b>Ctrl+Z / Ctrl+Y</b><span>Отмена / повтор</span><b>Ctrl+A / Ctrl+D</b><span>Выделить всё / снять выделение</span>
    <b>V / M / B / E</b><span>Перемещение / выделение / кисть / ластик</span><b>Shift+M</b><span>Переключить тип выделения</span><b>R</b><span>Кисть размытия</span>
    <b>G / L / T / U</b><span>Заливка / линия / текст / фигура</span>
    <b>C / I / H / Z</b><span>Кадрирование / пипетка / рука / лупа</span><b>Delete</b><span>Очистить активное выделение на растровом слое</span>
    <b>Стрелки</b><span>Сдвинуть выбранный слой на 1 px (Shift — 10 px)</span><b>Shift + перетаскивание</b><span>Перемещать слой строго по горизонтали / вертикали</span>
    <b>Ctrl + перетаскивание</b><span>Временно отключить умную привязку</span><b>Shift + ручка</b><span>Изменить размер с сохранением пропорций</span><b>Alt + ручка</b><span>Масштабировать от центра</span>
    <b>Shift + поворот</b><span>Поворот с шагом 15°</span><b>Shift + выделение / фигура / линия</b><span>Квадрат / круг для прямоугольного/эллиптического выделения и фигур; линия с шагом 45°</span>
    <b>[ / ]</b><span>Уменьшить / увеличить размер кисти (Shift — крупнее шаг)</span><b>Перо</b><span>Нажим пера автоматически влияет на размер кисти/ластика</span>    <b>Space / средняя кнопка</b><span>Временно перемещать холст</span><b>Alt/Ctrl + колесо</b><span>Масштаб холста под курсором (до 1600%)</span>
    <b>Ctrl + / −</b><span>Увеличить / уменьшить масштаб</span><b>Ctrl+0 / Ctrl+1</b><span>Вписать в окно / 100%</span>
    <b>Tab</b><span>Режим холста: скрыть / показать боковые панели</span><b>F2</b><span>Переименовать выбранный слой</span>
    <b>Панель «Слои»</b><span>Кнопка группы создаёт папку; перетащите слой на заголовок группы, чтобы поместить его внутрь</span>
  </div>`);
}
function currentAppVersion(){
  return document.querySelector('meta[name="application-version"]')?.content?.trim() || 'dev';
}
function showAbout() {
  showInfoModal('О ZeTer Photo Editor',`<div class="about-copy"><strong>ZeTer Photo Editor ${escapeHtml(currentAppVersion())}</strong><p>Браузерный графический редактор со слоями, историей, умной привязкой, выделением, кистью, заливкой, линиями, текстом, фигурами и экспортом. Работает онлайн и локально; изображения обрабатываются в браузере.</p><p>Формат проекта: <code>.zpe</code>.</p><div class="developer-card"><span>Разработчик</span><strong>Дмитрий Колесниченко</strong><a href="mailto:zeter11@gmail.com">zeter11@gmail.com</a><a href="https://t.me/zeterchat" target="_blank" rel="noopener noreferrer">Telegram: @zeterchat</a></div></div>`);
}

function undo(){if(blockPendingDocumentEdit())return;const entry=history.undo();if(!entry)return;doc=restoreDocument(entry.snapshot);clearSelectionState();brushCanvas=null;brushCtx=null;brushLayerId=null;updateAll();markDirty(true);setStatus(`Отменено → ${entry.label}`);}
function redo(){if(blockPendingDocumentEdit())return;const entry=history.redo();if(!entry)return;doc=restoreDocument(entry.snapshot);clearSelectionState();brushCanvas=null;brushCtx=null;brushLayerId=null;updateAll();markDirty(true);setStatus(`Повторено → ${entry.label}`);}
function deleteSelected(){if(blockPendingDocumentEdit())return;const l=selected();if(!l)return;if(isLayerLocked(doc,l)){setStatus('Слой или его группа заблокированы');return;}removeLayer(doc,l.id);commit('Удалить слой');}
function duplicateSelected(){const l=selected();if(!l)return;if(isLayerLocked(doc,l)){setStatus('Слой или его группа заблокированы');return;}if(duplicateLayer(doc,l.id))commit('Дублировать слой');}
function renameLayer(layer){if(!layer||isLayerLocked(doc,layer)){setStatus('Слой или его группа заблокированы');return;}showModal({title:'Переименовать слой',fields:[{name:'name',label:'Имя',value:layer.name,required:true}],submitLabel:'Переименовать',onSubmit:v=>{const name=String(v.name||'').trim();if(!name||name===layer.name)return;layer.name=name;commit('Переименовать слой');}});}
function addGroup(parentGroupId=null){
  const parent=parentGroupId?doc.groups?.find(group=>group.id===parentGroupId):null;
  if(parentGroupId&&!parent){setStatus('Родительская группа не найдена');return null;}
  if(parent&&isGroupLocked(doc,parent)){setStatus('Родительская группа заблокирована');return null;}
  const number=(doc.groups?.length||0)+1;
  const group=addLayerGroup(doc,createLayerGroup({name:`Группа ${number}`,parentGroupId:parent?.id??null}));
  if(parent)parent.collapsed=false;
  commit(parent?'Новая подгруппа':'Новая группа слоёв');
  setStatus(parent?`Создана подгруппа «${group.name}» в «${parent.name}»`:`Создана группа «${group.name}». Перетащите на неё нужные слои.`);
  return group;
}
const GROUP_BLEND_OPTIONS=[
  ['pass-through','Пропускать (Pass Through)'],
  ['source-over','Обычный (Normal)'],
  ['multiply','Умножение'],
  ['screen','Экран'],
  ['overlay','Перекрытие'],
  ['darken','Затемнение'],
  ['lighten','Осветление'],
  ['color-dodge','Осветление основы'],
  ['color-burn','Затемнение основы'],
];
function renameGroup(group){if(!group||isGroupLocked(doc,group)){setStatus('Группа или её родитель заблокированы');return;}showModal({title:'Переименовать группу',fields:[{name:'name',label:'Имя',value:group.name,required:true}],submitLabel:'Переименовать',onSubmit:v=>{const name=String(v.name||'').trim();if(!name||name===group.name)return;group.name=name;commit('Переименовать группу');}});}
function editGroupProperties(group){
  if(!group||isGroupLocked(doc,group)){setStatus('Группа или её родитель заблокированы');return;}
  showModal({
    title:'Параметры группы',
    fields:[
      {name:'blendMode',label:'Режим наложения',type:'select',value:group.blendMode||'pass-through',options:GROUP_BLEND_OPTIONS},
      {name:'opacity',label:'Непрозрачность, %',type:'number',value:Math.round(clamp(Number(group.opacity??1),0,1)*100),min:0,max:100,step:1,required:true},
    ],
    submitLabel:'Применить',
    onSubmit:v=>{
      const blendMode=GROUP_BLEND_OPTIONS.some(([value])=>value===v.blendMode)?v.blendMode:'pass-through';
      const opacity=clamp(Number(v.opacity)/100,0,1);
      if(group.blendMode===blendMode&&Math.abs(Number(group.opacity??1)-opacity)<1e-9)return;
      group.blendMode=blendMode;
      group.opacity=opacity;
      commit('Параметры группы');
    },
  });
}
function deleteLayerGroup(group){
  if(!group)return;
  if(isGroupLocked(doc,group)){setStatus('Сначала разблокируйте группу и её родителей');return;}
  if(removeLayerGroup(doc,group.id)){commit('Удалить группу слоёв');setStatus('Группа удалена, содержимое перенесено на уровень выше');}
}
function openBlendingOptions(layer) {
  if (!layer || isLayerLocked(doc, layer) || blockPendingDocumentEdit()) return;
  const owner=doc;
  const original={blendMode:layer.blendMode || 'source-over',opacity:layer.opacity ?? 1,styles:layer.styles ? structuredClone(layer.styles) : null};
  const originalStyles=sanitizeLayerStyles(original.styles) || createLayerStyles();
  const draft={blendMode:original.blendMode,opacity:Math.round(original.opacity*100),styles:structuredClone(originalStyles)};
  const previousFocus=document.activeElement;
  const back=document.createElement('div'); back.className='modal-backdrop';
  const modal=document.createElement('form'); modal.className='modal blending-modal';
  modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-label','Параметры наложения');
  modal.innerHTML=`<header>Параметры наложения</header><div class="blending-layout"><nav class="blending-list" aria-label="Стили слоя"></nav><div class="blending-details"><p class="muted blending-hint">Слой: ${escapeHtml(layer.name)}</p><div class="blending-fields"></div><section class="blending-canvas-preview" aria-label="Предпросмотр слоя на холсте"><strong>На холсте</strong><canvas aria-label="Фрагмент холста вокруг слоя"></canvas></section></div></div><footer><label class="blending-preview"><input type="checkbox" checked> Предпросмотр</label><span class="modal-footer-spacer"></span><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">Применить</button></footer>`;
  const list=modal.querySelector('.blending-list');
  const fields=modal.querySelector('.blending-fields');
  const previewCanvas=modal.querySelector('.blending-canvas-preview canvas');
  const previewToggle=modal.querySelector('.blending-preview input');
  const names={size:'Размер, px',strength:'Сила',angle:'Угол, °',distance:'Смещение, px',blur:'Размытие, px',color:'Цвет',color1:'Начальный цвет',color2:'Конечный цвет',opacity:'Непрозрачность',pattern:'Узор',scale:'Шаг, px'};
  let selectedStyle='general';
  let closed=false;
  const stillCurrent=()=>doc===owner && doc.layers.find(item=>item.id===layer.id)===layer && !isLayerLocked(doc,layer);
  const assign=(useDraft)=>{
    if(!stillCurrent())return;
    layer.blendMode=useDraft?draft.blendMode:original.blendMode;
    layer.opacity=useDraft?draft.opacity/100:original.opacity;
    layer.styles=useDraft?sanitizeLayerStyles(draft.styles):original.styles;
    documentChangeSerial+=1;
    updateLayerControls();
    render();
  };
  const preview=()=>assign(previewToggle.checked);
  const addRange=(parent,label,value,min,max,onChange)=>{
    const row=document.createElement('label');row.className='blending-field';
    const caption=document.createElement('span');caption.textContent=label;
    const control=document.createElement('input');control.type='range';control.min=String(min);control.max=String(max);control.step='1';control.value=String(value);
    const output=document.createElement('output');output.textContent=`${value}${label.includes('px')?' px':label.includes('°')?'°':'%'}`;
    control.addEventListener('input',()=>{output.textContent=`${control.value}${label.includes('px')?' px':label.includes('°')?'°':'%'}`;onChange(Number(control.value));preview();});
    row.append(caption,control,output);parent.append(row);
  };
  const addColor=(parent,label,value,onChange)=>{
    const row=document.createElement('label');row.className='blending-field';
    const caption=document.createElement('span');caption.textContent=label;
    const control=document.createElement('input');control.type='color';control.value=value;
    control.addEventListener('input',()=>{onChange(control.value);preview();});
    row.append(caption,control);parent.append(row);
  };
  const showFields=()=>{
    fields.replaceChildren();
    for(const button of list.querySelectorAll('.blending-style-select'))button.classList.toggle('active',button.dataset.style===selectedStyle);
    if(selectedStyle==='general'){
      const modeRow=document.createElement('label');modeRow.className='blending-field';
      const caption=document.createElement('span');caption.textContent='Режим наложения';
      const mode=document.createElement('select');
      for(const option of els.blend.options)mode.append(option.cloneNode(true));
      mode.value=draft.blendMode;
      mode.addEventListener('change',()=>{draft.blendMode=mode.value;preview();});
      modeRow.append(caption,mode);fields.append(modeRow);
      addRange(fields,'Непрозрачность',draft.opacity,0,100,value=>{draft.opacity=value;});
      addRange(fields,'Непрозрачность заливки',draft.styles.fillOpacity,0,100,value=>{draft.styles.fillOpacity=value;});
      const hint=document.createElement('p');hint.className='muted blending-note';hint.textContent='Непрозрачность заливки меняет содержимое слоя, сохраняя видимость включённых стилей.';fields.append(hint);
      return;
    }
    const item=draft.styles[selectedStyle];
    const title=document.createElement('h3');title.textContent=LAYER_STYLE_FIELDS[selectedStyle].label;fields.append(title);
    for(const [key,rule] of Object.entries(LAYER_STYLE_FIELDS[selectedStyle].fields)){
      if(rule[0]==='range')addRange(fields,names[key],item[key],rule[1],rule[2],value=>{item[key]=value;});
      else if(rule[0]==='color')addColor(fields,names[key],item[key],value=>{item[key]=value;});
      else {
        const row=document.createElement('label');row.className='blending-field';
        const caption=document.createElement('span');caption.textContent=names[key];
        const select=document.createElement('select');
        for(const [value,text] of [['stripes','Полосы'],['dots','Точки'],['checker','Шахматный']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
        select.value=item[key];select.addEventListener('change',()=>{item[key]=select.value;preview();});
        row.append(caption,select);fields.append(row);
      }
    }
  };
  const addChoice=(key,label)=>{
    const row=document.createElement('div');row.className='blending-style-row';
    if(key!=='general'){
      const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=draft.styles[key].enabled;toggle.setAttribute('aria-label',`Включить: ${label}`);
      toggle.addEventListener('change',()=>{draft.styles[key].enabled=toggle.checked;preview();});
      row.append(toggle);
    }
    const button=document.createElement('button');button.type='button';button.className='blending-style-select';button.dataset.style=key;button.textContent=label;
    button.addEventListener('click',()=>{selectedStyle=key;showFields();});
    row.append(button);list.append(row);
  };
  addChoice('general','Общие параметры');
  for(const [key,spec] of Object.entries(LAYER_STYLE_FIELDS))addChoice(key,spec.label);
  showFields();
  const finish=(apply=false)=>{
    if(closed)return;
    closed=true;
    modal.previewCleanup?.();
    if(blendingPreview?.canvas===previewCanvas)blendingPreview=null;
    const valid=stillCurrent();
    const styleChanged=JSON.stringify(draft.styles)!==JSON.stringify(originalStyles);
    const changed=valid && (draft.blendMode!==original.blendMode || draft.opacity!==Math.round(original.opacity*100) || styleChanged);
    els.modalRoot.replaceChildren();
    if(valid){
      if(apply && changed){
        layer.blendMode=draft.blendMode;layer.opacity=draft.opacity/100;
        layer.styles=styleChanged || original.styles ? sanitizeLayerStyles(draft.styles) : null;
        commit('Параметры наложения слоя');
      } else assign(false);
    }
    if(previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    setStatus(apply && changed ? 'Параметры наложения применены' : 'Параметры наложения без изменений');
  };
  previewToggle.addEventListener('change',preview);
  modal.querySelector('[data-cancel]').onclick=()=>finish();
  back.addEventListener('mousedown',e=>{if(e.target===back)finish();});
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish();}});
  modal.addEventListener('submit',e=>{e.preventDefault();finish(true);});
  back.append(modal);els.modalRoot.replaceChildren(back);
  makeModalDraggable(modal);
  blendingPreview={document:owner,layer,canvas:previewCanvas,crop:blendingPreviewCrop(owner,layer)};
  const previewObserver=typeof ResizeObserver==='function' ? new ResizeObserver(syncBlendingPreviewCanvas) : null;
  previewObserver?.observe(previewCanvas);
  const priorCleanup=modal.previewCleanup;
  modal.previewCleanup=()=>{previewObserver?.disconnect();priorCleanup?.();};
  syncBlendingPreviewCanvas();
  list.querySelector('button')?.focus();
}
function layerContextMenu(id) {
  const owner=doc;
  const target = () => doc===owner ? doc.layers.find(item => item.id === id) : null;
  const editable = () => Boolean(target()) && !isLayerLocked(doc, target());
  const selectedTarget = () => selected()?.id===id && Boolean(target());
  return [
    ['Параметры наложения…','',()=>openBlendingOptions(target()),editable],
    ['Редактировать содержимое смарт-объекта','',()=>openSmartObjectContents(target()),()=>Boolean(target())&&target().type==='smart-object'],
    ['Создать связанную копию смарт-объекта','',()=>createLinkedSmartObjectCopy(target()),()=>Boolean(target())&&target().type==='smart-object'&&Boolean(target().embeddedDocument)&&editable()],
    ['Разорвать связь смарт-объекта','',()=>unlinkSmartObject(target()),()=>Boolean(target()?.linkedSourceId)&&editable()],
    ['Добавить смарт-фильтр…','',()=>openSmartFilterDialog(target()),()=>Boolean(target())&&target().type==='smart-object'&&editable()&&(target().smartFilters?.length||0)<24],
    ['Очистить смарт-фильтры','',()=>clearSmartFilters(target()),()=>Boolean(target())&&target().type==='smart-object'&&editable()&&Boolean(target().smartFilters?.length)],
    ['Маска смарт-фильтров: показать всё','',()=>{void setSmartFilterMask(target(),false);},()=>Boolean(target())&&target().type==='smart-object'&&editable()&&Boolean(target().smartFilters?.length)&&!target().smartFilterMask],
    ['Маска смарт-фильтров из выделения','',()=>{void setSmartFilterMask(target(),true);},()=>Boolean(target())&&target().type==='smart-object'&&editable()&&Boolean(target().smartFilters?.length)&&Boolean(selectionShape)],
    ['Инвертировать маску смарт-фильтров','',()=>invertSmartFilterMask(target()),()=>Boolean(target()?.smartFilterMask)&&editable()],
    ['Включить / отключить маску смарт-фильтров','',()=>toggleSmartFilterMask(target()),()=>Boolean(target()?.smartFilterMask)&&editable()],
    ['Удалить маску смарт-фильтров','',()=>removeSmartFilterMask(target()),()=>Boolean(target()?.smartFilterMask)&&editable()],
    ['Преобразовать в смарт-объект','',()=>{if(selectedTarget())convertSelectedToSmartObject();},()=>selectedTarget()&&editable()&&!['smart-object','adjustment'].includes(target().type)],
    ['sep'],
    ['Переименовать…','F2',()=>renameLayer(target()),editable],
    ['Дублировать','Ctrl+J',()=>{if(selectedTarget())duplicateSelected();},()=>selectedTarget() && editable()],
    ['Удалить','Delete',()=>{if(selectedTarget())deleteSelected();},()=>selectedTarget() && editable()],
    ['sep'],
    ['Добавить маску (показать всё)','',()=>addSelectedLayerMask(false),()=>selectedTarget() && editable() && !target().mask],
    ['Добавить маску из выделения','',()=>addSelectedLayerMask(true),()=>selectedTarget() && editable() && !target().mask && Boolean(selectionShape)],
    ['Удалить маску','',removeSelectedLayerMask,()=>selectedTarget() && editable() && Boolean(target().mask)],
    ['sep'],
    ['Создать векторную маску из выделения','',()=>applySelectionToVectorMask('replace'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&!target().vectorMask],
    ['Заменить векторную маску выделением','',()=>applySelectionToVectorMask('replace'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Добавить выделение к векторной маске','',()=>applySelectionToVectorMask('add'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Вычесть выделение из векторной маски','',()=>applySelectionToVectorMask('subtract'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Пересечь векторную маску с выделением','',()=>applySelectionToVectorMask('intersect'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Исключить пересечение из векторной маски','',()=>applySelectionToVectorMask('exclude'),()=>selectedTarget()&&editable()&&Boolean(selectionShape)&&Boolean(target().vectorMask)],
    ['Редактировать векторную маску пером','',editSelectedVectorMask,()=>selectedTarget()&&editable()&&Boolean(target().vectorMask)],
    ['Инвертировать векторную маску','',invertSelectedVectorMask,()=>selectedTarget()&&editable()&&Boolean(target().vectorMask)],
    ['Включить / отключить векторную маску','',toggleSelectedVectorMask,()=>selectedTarget()&&editable()&&Boolean(target().vectorMask)],
    ['Удалить векторную маску','',removeSelectedVectorMask,()=>selectedTarget()&&editable()&&Boolean(target().vectorMask)],
    ['sep'],
    ['Показать / скрыть','',toggleSelectedVisibility,()=>Boolean(target())],
    ['Заблокировать / разблокировать','',toggleSelectedLock,()=>{const layer=target();const group=layer?.groupId?doc.groups?.find(item=>item.id===layer.groupId):null;return Boolean(layer)&&!(group&&isGroupLocked(doc,group));}],
    ['sep'],
    ['Поднять слой','',()=>{if(moveLayer(doc,id,1))commit('Поднять слой');},editable],
    ['Опустить слой','',()=>{if(moveLayer(doc,id,-1))commit('Опустить слой');},editable],
    ['Растеризовать','',rasterizeSelectedLayer,()=>editable() && target().type !== 'raster' && target().type !== 'adjustment'],
  ];
}
function groupContextMenu(id) {
  const owner=doc;
  const target = () => doc===owner ? doc.groups?.find(item => item.id === id) : null;
  return [
    ['Создать подгруппу','',()=>addGroup(id),()=>Boolean(target()) && !isGroupLocked(doc,target())],
    ['Параметры группы…','',()=>editGroupProperties(target()),()=>Boolean(target()) && !isGroupLocked(doc,target())],
    ['Переименовать…','',()=>renameGroup(target()),()=>Boolean(target()) && !isGroupLocked(doc,target())],
    ['Свернуть / развернуть','',()=>{const group=target();if(group){group.collapsed=!group.collapsed;updateLayers();}},()=>Boolean(target())],
    ['Показать / скрыть','',()=>{const group=target();if(group){group.visible=group.visible===false;commit(group.visible?'Показать группу слоёв':'Скрыть группу слоёв');}},()=>Boolean(target())],
    ['Заблокировать / разблокировать','',()=>{const group=target();if(group&&!group.parentGroupId||group&&!isGroupLocked(doc,doc.groups?.find(item=>item.id===group.parentGroupId))){group.locked=!group.locked;commit(group.locked?'Заблокировать группу слоёв':'Разблокировать группу слоёв');}},()=>{const group=target();const parent=group?.parentGroupId?doc.groups?.find(item=>item.id===group.parentGroupId):null;return Boolean(group)&&!(parent&&isGroupLocked(doc,parent));}],
    ['sep'],
    ['Удалить группу (содержимое останется)','',()=>deleteLayerGroup(target()),()=>Boolean(target()) && !isGroupLocked(doc,target())],
  ];
}
function addBlankLayer(){addLayer(doc,createRasterLayer({name:'Новый слой',width:doc.width,height:doc.height,dataUrl:null}));brushCanvas=null;commit('Новый растровый слой');}

function smartFilterTarget(owner,layerId){
  if(doc!==owner)return null;
  return doc.layers.find(item=>item.id===layerId&&item.type==='smart-object')||null;
}

function smartFilterDefaultName(layer){
  const count=Array.isArray(layer?.smartFilters)?layer.smartFilters.length:0;
  return `Смарт-фильтр ${count+1}`;
}

function moveSmartFilter(layer,index,direction){
  if(!layer||layer.type!=='smart-object'||isLayerLocked(doc,layer))return false;
  const stack=Array.isArray(layer.smartFilters)?layer.smartFilters:[];
  const target=index+direction;
  if(index<0||index>=stack.length||target<0||target>=stack.length)return false;
  [stack[index],stack[target]]=[stack[target],stack[index]];
  commit(direction<0?'Поднять смарт-фильтр':'Опустить смарт-фильтр');
  return true;
}

function toggleSmartFilter(layer,index){
  if(!layer||layer.type!=='smart-object'||isLayerLocked(doc,layer))return false;
  const item=layer.smartFilters?.[index];if(!item)return false;
  item.enabled=item.enabled===false;
  commit(item.enabled?'Включить смарт-фильтр':'Отключить смарт-фильтр');
  return true;
}

function removeSmartFilter(layer,index){
  if(!layer||layer.type!=='smart-object'||isLayerLocked(doc,layer))return false;
  if(!Array.isArray(layer.smartFilters)||index<0||index>=layer.smartFilters.length)return false;
  layer.smartFilters.splice(index,1);
  if(!layer.smartFilters.length)layer.smartFilterMask=null;
  commit('Удалить смарт-фильтр');
  return true;
}

function clearSmartFilters(layer=selected()){
  if(!layer||layer.type!=='smart-object'||isLayerLocked(doc,layer)||!layer.smartFilters?.length)return false;
  layer.smartFilters=[];
  layer.smartFilterMask=null;
  commit('Очистить смарт-фильтры');
  return true;
}

async function setSmartFilterMask(layer=selected(),fromSelection=false){
  if(blockPendingDocumentEdit())return false;
  if(!layer||layer.type!=='smart-object'){setStatus('Маска смарт-фильтров доступна только для смарт-объекта');return false;}
  if(isLayerLocked(doc,layer)){setStatus('Смарт-объект или его группа заблокированы');return false;}
  if(!layer.smartFilters?.length){setStatus('Сначала добавьте хотя бы один смарт-фильтр');return false;}
  if(fromSelection&&!selectionShape){setStatus('Сначала создайте выделение');return false;}
  const owner=doc,layerId=layer.id;
  const dataUrl=fromSelection?await selectionMaskDataUrl(layer):null;
  const target=smartFilterTarget(owner,layerId);
  if(!target||isLayerLocked(owner,target))return false;
  target.smartFilterMask=createSmartFilterMask({enabled:true,dataUrl});
  commit(fromSelection?'Маска смарт-фильтров из выделения':'Маска смарт-фильтров: показать всё');
  return true;
}

function toggleSmartFilterMask(layer=selected()){
  if(!layer?.smartFilterMask||layer.type!=='smart-object'||isLayerLocked(doc,layer))return false;
  layer.smartFilterMask.enabled=layer.smartFilterMask.enabled===false;
  commit(layer.smartFilterMask.enabled?'Включить маску смарт-фильтров':'Отключить маску смарт-фильтров');
  return true;
}

function invertSmartFilterMask(layer=selected()){
  if(!layer?.smartFilterMask||layer.type!=='smart-object'||isLayerLocked(doc,layer))return false;
  layer.smartFilterMask.invert=!layer.smartFilterMask.invert;
  commit(layer.smartFilterMask.invert?'Инвертировать маску смарт-фильтров':'Снять инверсию маски смарт-фильтров');
  return true;
}

function removeSmartFilterMask(layer=selected()){
  if(!layer?.smartFilterMask||layer.type!=='smart-object'||isLayerLocked(doc,layer))return false;
  layer.smartFilterMask=null;
  commit('Удалить маску смарт-фильтров');
  return true;
}

function updateSmartFilterMaskSetting(layer,key,raw,shouldCommit=true){
  if(!layer?.smartFilterMask||layer.type!=='smart-object'||isLayerLocked(doc,layer))return false;
  let value=Number(raw);
  if(!Number.isFinite(value))return false;
  if(key==='density')value=clamp(value,0,1);
  else if(key==='feather')value=clamp(value,0,250);
  else return false;
  layer.smartFilterMask[key]=value;
  markDirty(true);
  if(shouldCommit)commit(key==='density'?'Изменить плотность маски смарт-фильтров':'Изменить растушёвку маски смарт-фильтров');
  else render();
  return true;
}

function bindSmartFilterControls(root,layer){
  root?.querySelector('[data-smart-filter-add]')?.addEventListener('click',()=>openSmartFilterDialog(layer));
  root?.querySelector('[data-smart-filter-clear]')?.addEventListener('click',()=>clearSmartFilters(layer));
  root?.querySelector('[data-smart-filter-mask-show]')?.addEventListener('click',()=>{void setSmartFilterMask(layer,false);});
  root?.querySelector('[data-smart-filter-mask-selection]')?.addEventListener('click',()=>{void setSmartFilterMask(layer,true);});
  root?.querySelector('[data-smart-filter-mask-toggle]')?.addEventListener('click',()=>toggleSmartFilterMask(layer));
  root?.querySelector('[data-smart-filter-mask-invert]')?.addEventListener('click',()=>invertSmartFilterMask(layer));
  root?.querySelector('[data-smart-filter-mask-remove]')?.addEventListener('click',()=>removeSmartFilterMask(layer));
  const density=root?.querySelector('[data-smart-filter-mask-density]');
  if(density){
    const output=density.closest('.smart-filter-mask-range')?.querySelector('output');
    density.addEventListener('input',()=>{if(output)output.textContent=density.value+'%';updateSmartFilterMaskSetting(layer,'density',Number(density.value)/100,false);});
    density.addEventListener('change',()=>updateSmartFilterMaskSetting(layer,'density',Number(density.value)/100,true));
  }
  const feather=root?.querySelector('[data-smart-filter-mask-feather]');
  if(feather){
    const output=feather.closest('.smart-filter-mask-range')?.querySelector('output');
    feather.addEventListener('input',()=>{if(output)output.textContent=feather.value+' px';updateSmartFilterMaskSetting(layer,'feather',feather.value,false);});
    feather.addEventListener('change',()=>updateSmartFilterMaskSetting(layer,'feather',feather.value,true));
  }
  root?.querySelectorAll('[data-smart-filter-edit]').forEach(button=>button.addEventListener('click',()=>openSmartFilterDialog(layer,Number(button.dataset.smartFilterEdit))));
  root?.querySelectorAll('[data-smart-filter-toggle]').forEach(button=>button.addEventListener('click',()=>toggleSmartFilter(layer,Number(button.dataset.smartFilterToggle))));
  root?.querySelectorAll('[data-smart-filter-up]').forEach(button=>button.addEventListener('click',()=>moveSmartFilter(layer,Number(button.dataset.smartFilterUp),-1)));
  root?.querySelectorAll('[data-smart-filter-down]').forEach(button=>button.addEventListener('click',()=>moveSmartFilter(layer,Number(button.dataset.smartFilterDown),1)));
  root?.querySelectorAll('[data-smart-filter-remove]').forEach(button=>button.addEventListener('click',()=>removeSmartFilter(layer,Number(button.dataset.smartFilterRemove))));
}

function openSmartFilterDialog(layer=selected(),index=-1){
  if(blockPendingDocumentEdit())return;
  if(!layer||layer.type!=='smart-object'){setStatus('Смарт-фильтры доступны только для смарт-объектов');return;}
  if(isLayerLocked(doc,layer)){setStatus('Смарт-объект или его группа заблокированы');return;}
  const owner=doc,layerId=layer.id,original=structuredClone(layer.smartFilters||[]);
  if(index<0&&original.length>=24){const message='Достигнут лимит: 24 смарт-фильтра';setStatus(message);toast(message,'warn');return;}
  layer.smartFilters=structuredClone(original);
  let targetIndex=index;
  if(targetIndex<0){
    layer.smartFilters.unshift(createSmartFilter({name:smartFilterDefaultName(layer)}));
    targetIndex=0;
  }
  if(!layer.smartFilters[targetIndex])return;
  const filterId=layer.smartFilters[targetIndex].id;
  const isNew=index<0;
  const previousFocus=document.activeElement;
  const back=document.createElement('div');back.className='modal-backdrop';
  const modal=document.createElement('form');modal.className='modal smart-filter-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',isNew?'Добавить смарт-фильтр':'Редактировать смарт-фильтр');
  modal.innerHTML='<header>'+(isNew?'Добавить смарт-фильтр':'Редактировать смарт-фильтр')+'</header><div class="modal-body smart-filter-body"><p class="muted smart-filter-hint">Изменения показываются на холсте сразу. Фильтры в списке применяются снизу вверх; верхний получает результат нижних.</p></div><footer><button type="button" class="secondary-button" data-reset>Сбросить</button><span class="modal-footer-spacer"></span><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">Применить</button></footer>';
  const body=modal.querySelector('.smart-filter-body');
  const nameRow=document.createElement('label');nameRow.className='smart-filter-dialog-name';
  const nameLabel=document.createElement('span');nameLabel.textContent='Название';
  const nameInput=document.createElement('input');nameInput.type='text';nameInput.maxLength=160;nameInput.value=layer.smartFilters[targetIndex].name||smartFilterDefaultName(layer);
  nameRow.append(nameLabel,nameInput);body.append(nameRow);

  let currentGroup='';
  for(const control of RASTER_EFFECT_CONTROLS){
    if(control.group!==currentGroup){
      currentGroup=control.group;
      const heading=document.createElement('div');heading.className='color-correction-group';heading.textContent=currentGroup;body.append(heading);
    }
    const row=document.createElement('label');row.className='color-correction-row';
    const label=document.createElement('span');label.textContent=control.label;
    const input=document.createElement('input');input.type='range';input.name=control.key;input.min=String(control.min);input.max=String(control.max);input.step=String(control.step);
    input.value=String(layer.smartFilters[targetIndex].filters?.[control.key]??DEFAULT_LAYER_FILTERS[control.key]);
    const output=document.createElement('output');output.value=formatFilterValue(control.key,input.value);output.textContent=output.value;
    row.append(label,input,output);body.append(row);
    input.addEventListener('input',()=>{
      const target=smartFilterTarget(owner,layerId),item=target?.smartFilters?.find(entry=>entry.id===filterId);
      if(!item)return;
      const [min,max]=FILTER_RANGES[control.key]||[control.min,control.max];
      const value=clamp(Number(input.value),min,max);
      item.filters[control.key]=value;output.value=formatFilterValue(control.key,value);output.textContent=output.value;render();
    });
  }

  const liveItem=()=>smartFilterTarget(owner,layerId)?.smartFilters?.find(entry=>entry.id===filterId)||null;
  nameInput.addEventListener('input',()=>{const item=liveItem();if(item)item.name=nameInput.value.slice(0,160);});
  const close=()=>{els.modalRoot.replaceChildren();if(previousFocus instanceof HTMLElement)previousFocus.focus();};
  const restore=()=>{
    const target=smartFilterTarget(owner,layerId);
    if(target){target.smartFilters=structuredClone(original);render();refreshInspectorPanels();}
  };
  back.append(modal);els.modalRoot.replaceChildren(back);
  render();

  modal.querySelector('[data-reset]').addEventListener('click',()=>{
    for(const control of RASTER_EFFECT_CONTROLS){
      const input=modal.elements.namedItem(control.key);
      if(!(input instanceof HTMLInputElement))continue;
      input.value=String(DEFAULT_LAYER_FILTERS[control.key]);input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  modal.querySelector('[data-cancel]').addEventListener('click',()=>{restore();close();setStatus('Изменения смарт-фильтра отменены');});
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();restore();close();setStatus('Изменения смарт-фильтра отменены');}
  });
  modal.addEventListener('submit',event=>{
    event.preventDefault();
    const target=smartFilterTarget(owner,layerId),item=liveItem();
    if(!target||!item){close();return;}
    item.name=nameInput.value.trim().slice(0,160)||smartFilterDefaultName(target);
    const changed=JSON.stringify(target.smartFilters)!==JSON.stringify(original);
    close();
    if(changed)commit(isNew?'Добавить смарт-фильтр':'Изменить смарт-фильтр');
    else {target.smartFilters=structuredClone(original);render();refreshInspectorPanels();}
  });
  nameInput.focus();nameInput.select();
}

function smartObjectLinkedCount(layer,owner=doc){
  if(!layer?.linkedSourceId)return 1;
  return Math.max(1,linkedSmartObjectLayers(owner,layer.linkedSourceId).length);
}
function createLinkedSmartObjectCopy(layer=selected()){
  if(blockPendingDocumentEdit())return null;
  if(!layer||layer.type!=='smart-object'||!layer.embeddedDocument){setStatus('Нужен смарт-объект со встроенным содержимым');return null;}
  if(isLayerLocked(doc,layer)){setStatus('Смарт-объект или его группа заблокированы');return null;}
  const linkedSourceId=layer.linkedSourceId||createSmartObjectLinkId();
  const copy=duplicateLayer(doc,layer.id);
  if(!copy)return null;
  layer.linkedSourceId=linkedSourceId;
  copy.linkedSourceId=linkedSourceId;
  copy.name=`${layer.name||'Смарт-объект'} — связанная копия`;
  commit('Создать связанную копию смарт-объекта');
  setStatus(`Создана связанная копия. Экземпляров источника: ${smartObjectLinkedCount(copy)}`);
  return copy;
}
function unlinkSmartObject(layer=selected()){
  if(blockPendingDocumentEdit())return false;
  if(!layer||layer.type!=='smart-object'||isLayerLocked(doc,layer))return false;
  if(!layer.linkedSourceId){setStatus('Смарт-объект уже независимый');return false;}
  layer.linkedSourceId=null;
  commit('Разорвать связь смарт-объекта');
  setStatus('Смарт-объект стал независимым; текущее встроенное содержимое сохранено');
  return true;
}

function smartObjectSessionDepth(session=currentSession()){
  let depth=0,current=session;
  const visited=new Set();
  while(current?.smartObjectLink){
    if(visited.has(current.id))break;
    visited.add(current.id);depth+=1;
    current=documentSessions.find(item=>item.id===current.smartObjectLink.parentSessionId);
  }
  return depth;
}
function smartObjectSourceBounds(layer){
  const scale=Math.max(Math.abs(Number(layer.scaleX)||1),Math.abs(Number(layer.scaleY)||1));
  const blur=Math.max(0,Number(layer.filters?.blur)||0)*scale*3;
  const stroke=layer.type==='shape'?Math.max(0,Number(layer.strokeWidth)||0)*scale/2:0;
  const bounds=frameBounds(layer,Math.ceil(blur+stroke+layerStyleOutset(layer.styles)*scale+2));
  const x=Math.floor(bounds.x),y=Math.floor(bounds.y);
  const width=Math.max(1,Math.ceil(bounds.x+bounds.width)-x);
  const height=Math.max(1,Math.ceil(bounds.y+bounds.height)-y);
  checkedCanvasSize(width,height,`Смарт-объект «${layer.name||'Без имени'}»`);
  return{x,y,width,height};
}
async function smartObjectPreviewDataUrl(embeddedDocument){
  const canvas=document.createElement('canvas');
  await renderDocument(canvas,embeddedDocument,{checker:false});
  return canvasToDataURL(canvas,'image/png');
}
async function convertSelectedToSmartObject(){
  if(blockPendingDocumentEdit())return;
  const source=selected();
  if(!source||source.type==='smart-object'||source.type==='adjustment'||isLayerLocked(doc,source))return;
  if(smartObjectSessionDepth()>=3){
    const message='Достигнут лимит вложенности смарт-объектов: 3 уровня';
    setStatus(message);toast(message,'warn');return;
  }
  const owner=doc,targetSessionId=activeSessionId,index=doc.layers.indexOf(source),original=JSON.stringify(source);
  const bounds=smartObjectSourceBounds(source);
  const embedded=createDocument({
    name:`${source.name||'Слой'} — содержимое`,
    width:bounds.width,height:bounds.height,background:'transparent'
  });
  const inner=structuredClone(source);
  inner.x-=bounds.x;inner.y-=bounds.y;inner.opacity=1;inner.blendMode='source-over';inner.visible=true;inner.locked=false;inner.groupId=null;
  embedded.layers=[inner];embedded.selectedLayerId=inner.id;
  setStatus('Создание смарт-объекта…');
  try{
    const previewDataUrl=await smartObjectPreviewDataUrl(embedded);
    if(doc!==owner||activeSessionId!==targetSessionId||doc.layers[index]!==source||JSON.stringify(source)!==original){
      setStatus('Преобразование в смарт-объект отменено: слой изменился');return;
    }
    const smart=createSmartObjectLayer({
      id:source.id,name:source.name||'Смарт-объект',visible:source.visible,locked:false,
      opacity:source.opacity,blendMode:source.blendMode,groupId:source.groupId??null,
      x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,
      previewDataUrl,embeddedDocument:embedded,
    });
    doc.layers.splice(index,1,smart);doc.selectedLayerId=smart.id;
    commit('Преобразовать в смарт-объект');
    setStatus('Слой преобразован в смарт-объект');
  }catch(error){
    console.error(error);setStatus(`Ошибка создания смарт-объекта: ${error.message}`);toast('Не удалось создать смарт-объект','error');
  }
}
function openSmartObjectContents(layer=selected()){
  if(blockPendingDocumentEdit())return;
  if(!layer||layer.type!=='smart-object'||!layer.embeddedDocument){setStatus('У смарт-объекта нет встроенного содержимого');return;}
  if(isLayerLocked(doc,layer)){setStatus('Смарт-объект или его группа заблокированы');return;}
  syncCurrentSession();
  const parentSessionId=activeSessionId;
  const linkedSourceId=layer.linkedSourceId||null;
  const existing=documentSessions.find(session=>session.smartObjectLink?.parentSessionId===parentSessionId&&(linkedSourceId?session.smartObjectLink?.linkedSourceId===linkedSourceId:session.smartObjectLink?.layerId===layer.id));
  if(existing){activateDocumentTab(existing.id,{focusViewport:true});return;}
  const content=restoreDocument(snapshotDocument(layer.embeddedDocument));
  content.name=`${layer.name||'Смарт-объект'} — содержимое`;
  const session=buildSession(content,{
    label:'Содержимое смарт-объекта',zoomLevel:zoom,dirtyState:false,
    smartObjectLink:{parentSessionId,layerId:layer.id,linkedSourceId},
  });
  const parentIndex=documentSessions.findIndex(item=>item.id===parentSessionId);
  documentSessions.splice(parentIndex+1,0,session);
  activeSessionId=session.id;loadSession(session);updateAll();fitToView();
  setStatus(linkedSourceId?`Содержимое связанного смарт-объекта открыто. Ctrl+S обновит ${smartObjectLinkedCount(layer)} экземпляр(а).`:'Содержимое смарт-объекта открыто. Ctrl+S обновит родительский слой.');
}
async function saveSmartObjectContent(session=currentSession()){
  if(!session?.smartObjectLink)return false;
  if(blockPendingDocumentEdit())return false;
  syncCurrentSession();
  const link=session.smartObjectLink;
  const parentSession=documentSessions.find(item=>item.id===link.parentSessionId);
  let parentLayer=parentSession?.doc?.layers?.find(layer=>layer.id===link.layerId&&layer.type==='smart-object')||null;
  if(!parentLayer&&parentSession&&link.linkedSourceId)parentLayer=linkedSmartObjectLayers(parentSession.doc,link.linkedSourceId)[0]||null;
  if(!parentSession||!parentLayer){
    const message='Родительский смарт-объект больше недоступен';
    setStatus(message);toast(message,'error');return false;
  }
  if(isLayerLocked(parentSession.doc,parentLayer)){
    const message='Родительский смарт-объект заблокирован: разблокируйте его перед сохранением содержимого';
    setStatus(message);toast(message,'warn');return false;
  }
  const linkedSourceId=parentLayer.linkedSourceId||null;
  const initialTargets=linkedSourceId?linkedSmartObjectLayers(parentSession.doc,linkedSourceId):[parentLayer];
  const embedded=restoreDocument(snapshotDocument(session.doc));
  setStatus(linkedSourceId?`Обновление связанных смарт-объектов: ${initialTargets.length}…`:'Обновление смарт-объекта…');
  try{
    const previewDataUrl=await smartObjectPreviewDataUrl(embedded);
    const liveParent=documentSessions.find(item=>item.id===link.parentSessionId);
    let liveLayer=liveParent?.doc?.layers?.find(layer=>layer.id===link.layerId&&layer.type==='smart-object')||null;
    if(!liveLayer&&liveParent&&linkedSourceId)liveLayer=linkedSmartObjectLayers(liveParent.doc,linkedSourceId)[0]||null;
    if(liveParent!==parentSession||!liveLayer||(linkedSourceId&&liveLayer.linkedSourceId!==linkedSourceId)){
      setStatus('Обновление смарт-объекта отменено: родитель изменился');return false;
    }
    const liveTargets=linkedSourceId?linkedSmartObjectLayers(liveParent.doc,linkedSourceId):[liveLayer];
    if(!liveTargets.length){
      setStatus('Обновление смарт-объекта отменено: связанные экземпляры удалены');return false;
    }
    const embeddedSnapshot=snapshotDocument(embedded);
    const oldPreviews=new Set();
    for(const target of liveTargets){
      if(target.previewDataUrl)oldPreviews.add(target.previewDataUrl);
      target.embeddedDocument=restoreDocument(embeddedSnapshot);
      target.previewDataUrl=previewDataUrl;
      target.width=embedded.width;target.height=embedded.height;
    }
    touch(parentSession.doc);
    parentSession.history.push(liveTargets.length>1?'Обновить связанные смарт-объекты':'Обновить смарт-объект',snapshotDocument(parentSession.doc));
    parentSession.dirty=true;
    session.doc=embedded;doc=embedded;session.dirty=false;dirty=false;
    session.smartObjectLink={...link,layerId:liveLayer.id,linkedSourceId};
    for(const oldPreview of oldPreviews)invalidateImageCache(oldPreview);
    renderDocumentTabs();queueRecovery({immediate:true});
    setStatus(liveTargets.length>1?`Связанный источник обновлён: ${liveTargets.length} экземпляр(а)`:'Смарт-объект обновлён в родительском документе');
    toast(liveTargets.length>1?'Связанные смарт-объекты обновлены':'Содержимое смарт-объекта сохранено','success');
    return true;
  }catch(error){
    console.error(error);setStatus(`Ошибка обновления смарт-объекта: ${error.message}`);toast('Не удалось обновить смарт-объект','error');return false;
  }
}
function addAdjustmentLayer(){
  const layer=createAdjustmentLayer({name:'Корректирующий слой',width:doc.width,height:doc.height});
  addLayer(doc,layer);commit('Новый корректирующий слой');
  setStatus('Корректирующий слой применяет цвет и эффекты ко всему нижележащему стеку');
}

async function selectionRefineSourceRgba(layer,sourceWidth,sourceHeight,scale=1){
  const factor=Math.max(.0001,Number(scale)||1);
  const width=Math.max(1,Math.round(sourceWidth*factor));
  const height=Math.max(1,Math.round(sourceHeight*factor));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(layer.type==='adjustment'){
    ctx.imageSmoothingEnabled=true;
    if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';
    ctx.drawImage(els.canvas,0,0,doc.width,doc.height,0,0,width,height);
  }else{
    ctx.scale(factor,factor);
    const plain={
      ...layer,mask:null,styles:null,
      opacity:1,blendMode:'source-over',
      x:0,y:0,scaleX:1,scaleY:1,rotation:0,
      width:sourceWidth,height:sourceHeight,
    };
    await renderLayer(ctx,plain);
    ctx.setTransform(1,0,0,1,0,0);
  }
  return ctx.getImageData(0,0,width,height).data;
}


function selectionVectorMaskDocumentNodes(shape=selectionShape){
  if(!shape)return[];
  if(shape.type==='rect'){
    const rect=selectionBounds(shape);
    if(!rect||rect.width<=0||rect.height<=0)return[];
    return[
      {x:rect.x,y:rect.y},{x:rect.x+rect.width,y:rect.y},
      {x:rect.x+rect.width,y:rect.y+rect.height},{x:rect.x,y:rect.y+rect.height},
    ];
  }
  if(shape.type==='ellipse'){
    const rect=selectionBounds(shape);
    if(!rect||rect.width<=0||rect.height<=0)return[];
    const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2,rx=rect.width/2,ry=rect.height/2,k=.5522847498307936;
    return[
      {x:cx+rx,y:cy,handleIn:{x:cx+rx,y:cy-k*ry},handleOut:{x:cx+rx,y:cy+k*ry},kind:'smooth'},
      {x:cx,y:cy+ry,handleIn:{x:cx+k*rx,y:cy+ry},handleOut:{x:cx-k*rx,y:cy+ry},kind:'smooth'},
      {x:cx-rx,y:cy,handleIn:{x:cx-rx,y:cy+k*ry},handleOut:{x:cx-rx,y:cy-k*ry},kind:'smooth'},
      {x:cx,y:cy-ry,handleIn:{x:cx-k*rx,y:cy-ry},handleOut:{x:cx+k*rx,y:cy-ry},kind:'smooth'},
    ];
  }
  return selectionPathPoints(shape,72).map(point=>({x:point.x,y:point.y}));
}

function selectionVectorMaskSubpath(layer,operation='add'){
  const nodes=selectionVectorMaskDocumentNodes();
  if(nodes.length<3)return null;
  const localize=node=>{
    const anchor=documentPointToLayerPixel(node,layer);
    return{
      x:anchor.x,y:anchor.y,
      handleIn:node.handleIn?documentPointToLayerPixel(node.handleIn,layer):null,
      handleOut:node.handleOut?documentPointToLayerPixel(node.handleOut,layer):null,
      kind:node.kind==='smooth'?'smooth':'corner',
    };
  };
  return{operation:['add','subtract','intersect','exclude'].includes(operation)?operation:'add',closed:true,points:nodes.map(localize)};
}

function applySelectionToVectorMask(operation='replace'){
  const layer=selected();
  if(!layer){setStatus('Сначала выберите слой');return false;}
  if(!selectionShape){setStatus('Сначала создайте выделение');return false;}
  if(isLayerLocked(doc,layer)){setStatus('Слой или его группа заблокированы');return false;}
  const subpath=selectionVectorMaskSubpath(layer,operation==='replace'?'add':operation);
  if(!subpath){setStatus('Выделение слишком мало для векторной маски');return false;}
  if(operation==='replace'||!layer.vectorMask){
    layer.vectorMask=createVectorMask({enabled:true,invert:false,subpaths:[subpath]});
  }else{
    if(layer.vectorMask.subpaths.length>=128){const message='Векторная маска ограничена 128 контурами';setStatus(message);toast(message,'warn');return false;}
    layer.vectorMask.subpaths.push(subpath);layer.vectorMask.enabled=true;
  }
  const labels={
    replace:'Создать векторную маску',add:'Добавить контур к векторной маске',
    subtract:'Вычесть контур из векторной маски',intersect:'Пересечь контуры векторной маски',
    exclude:'Исключить пересечение векторной маски',
  };
  commit(labels[operation]||labels.replace);
  setStatus(`Векторная маска: ${layer.vectorMask.subpaths.length} контур(ов)`);
  return true;
}

function editSelectedVectorMask(){
  const layer=selected();
  if(!layer?.vectorMask){setStatus('У выбранного слоя нет векторной маски');return false;}
  if(isLayerLocked(doc,layer)){setStatus('Слой или его группа заблокированы');return false;}
  vectorMaskEditLayerId=layer.id;
  setTool('pen');
  vectorMaskEditLayerId=layer.id;
  drawOverlay();
  setStatus('Перо: редактирование векторной маски — перетаскивайте anchors и Bézier-handles');
  return true;
}
function toggleSelectedVectorMask(){
  const layer=selected();if(!layer?.vectorMask||isLayerLocked(doc,layer))return;
  layer.vectorMask.enabled=layer.vectorMask.enabled===false;
  commit(layer.vectorMask.enabled?'Включить векторную маску':'Отключить векторную маску');
}
function invertSelectedVectorMask(){
  const layer=selected();if(!layer?.vectorMask||isLayerLocked(doc,layer))return;
  layer.vectorMask.invert=!layer.vectorMask.invert;
  commit(layer.vectorMask.invert?'Инвертировать векторную маску':'Отменить инверсию векторной маски');
}
function removeSelectedVectorMask(){
  const layer=selected();if(!layer?.vectorMask||isLayerLocked(doc,layer))return;
  if(vectorMaskEditLayerId===layer.id)vectorMaskEditLayerId=null;
  layer.vectorMask=null;commit('Удалить векторную маску');setStatus('Векторная маска удалена');
}
function layerMaskSummary(layer){
  const parts=[];
  if(layer?.mask)parts.push(layer.mask.enabled===false?'растровая отключена':layer.mask.dataUrl?'растровая':'растровая: показать всё');
  if(layer?.vectorMask){
    const count=layer.vectorMask.subpaths?.length||0,state=layer.vectorMask.enabled===false?'отключена':layer.vectorMask.invert?'инвертирована':'включена';
    parts.push(`векторная: ${count} контур(ов), ${state}`);
  }
  if(layer?.smartFilterMask){
    const state=layer.smartFilterMask.enabled===false?'отключена':layer.smartFilterMask.invert?'инвертирована':'включена';
    parts.push(`смарт-фильтры: маска ${state}`);
  }
  return parts.join(' + ')||'нет';
}

async function selectionMaskDataUrl(layer,{smooth=0,shift=0,edgeRadius=0,edgeStrength=60,smartRadius=true,feather=0,contrast=0,invert=false}={}){
  if(!selectionShape)return null;
  const width=layer.type==='adjustment'?doc.width:Math.max(1,Math.round(layer.width||1));
  const height=layer.type==='adjustment'?doc.height:Math.max(1,Math.round(layer.height||1));
  checkedCanvasSize(width,height,'Маска слоя');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.fillStyle='#ffffff';
  if(layer.type==='adjustment'){
    if(traceDocumentSelectionPath(ctx))ctx.fill();
  }else{
    const polygon=selectionPolygonForLayer(layer);
    if(polygon?.length>=3){
      ctx.beginPath();ctx.moveTo(polygon[0].x,polygon[0].y);
      for(let i=1;i<polygon.length;i+=1)ctx.lineTo(polygon[i].x,polygon[i].y);
      ctx.closePath();ctx.fill();
    }
  }
  const needsRefine=Number(smooth)>0||Number(shift)!==0||Number(edgeRadius)>0||Number(feather)>0||Number(contrast)>0||Boolean(invert);
  if(needsRefine){
    const pixels=width*height;
    if(pixels>12_000_000)throw new Error('Уточнение края ограничено маской до 12 МП. Уменьшите слой или используйте обычную маску из выделения.');
    const detectionRadius=clamp(Math.round(Number(edgeRadius)||0),0,12);
    if(detectionRadius>0&&pixels*Math.max(1,detectionRadius)>48_000_000){
      throw new Error('Умный радиус слишком тяжёлый для этой маски. Уменьшите радиус или размер слоя.');
    }
    const image=ctx.getImageData(0,0,width,height);
    const alpha=new Uint8ClampedArray(pixels);
    for(let i=0;i<pixels;i+=1)alpha[i]=image.data[i*4+3];
    const sourceRgba=detectionRadius>0?await selectionRefineSourceRgba(layer,width,height,1):null;
    const refined=refineMaskAlpha(alpha,width,height,{smooth,shift,edgeRadius:detectionRadius,edgeStrength,smartRadius,sourceRgba,feather,contrast,invert});
    for(let i=0;i<pixels;i+=1){
      const offset=i*4;
      image.data[offset]=255;image.data[offset+1]=255;image.data[offset+2]=255;image.data[offset+3]=refined[i];
    }
    ctx.clearRect(0,0,width,height);
    ctx.putImageData(image,0,0);
  }
  return canvasToDataURL(canvas,'image/png');
}
async function addSelectedLayerMask(fromSelection=false){
  const layer=selected();
  if(!layer){setStatus('Сначала выберите слой');return;}
  if(isLayerLocked(doc,layer)){setStatus('Слой или его группа заблокированы');return;}
  if(layer.mask){setStatus('У слоя уже есть маска');return;}
  if(fromSelection&&!selectionShape){setStatus('Сначала создайте выделение');return;}
  const dataUrl=fromSelection?await selectionMaskDataUrl(layer):null;
  layer.mask=createLayerMask({enabled:true,dataUrl});
  commit(fromSelection?'Добавить маску из выделения':'Добавить маску слоя');
  setStatus(fromSelection?'Маска слоя создана из текущего выделения':'Добавлена маска «показать всё»');
}


function selectionRefineOptionsFromValues(values, scale = 1) {
  const factor=Math.max(.0001,Number(scale)||1);
  return {
    smooth:clamp(Number(values?.smooth)||0,0,32)/factor,
    shift:clamp(Number(values?.shift)||0,-64,64)/factor,
    edgeRadius:clamp(Number(values?.edgeRadius)||0,0,12)/factor,
    edgeStrength:clamp(Number(values?.edgeStrength)||0,0,100),
    smartRadius:values?.smartRadius!=='no',
    feather:clamp(Number(values?.feather)||0,0,64)/factor,
    contrast:clamp(Number(values?.contrast)||0,0,100),
    invert:values?.invert==='yes',
  };
}

async function buildSelectionRefinePreviewSource(layer,{maxWidth=420,maxHeight=240}={}) {
  if(!selectionShape||!layer)return null;
  const sourceWidth=layer.type==='adjustment'?doc.width:Math.max(1,Math.round(layer.width||1));
  const sourceHeight=layer.type==='adjustment'?doc.height:Math.max(1,Math.round(layer.height||1));
  const previewScale=Math.max(.0001,Math.min(2,maxWidth/sourceWidth,maxHeight/sourceHeight));
  const width=Math.max(1,Math.round(sourceWidth*previewScale));
  const height=Math.max(1,Math.round(sourceHeight*previewScale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.scale(previewScale,previewScale);
  ctx.fillStyle='#fff';
  if(layer.type==='adjustment'){
    if(traceDocumentSelectionPath(ctx))ctx.fill();
  }else{
    const polygon=selectionPolygonForLayer(layer);
    if(polygon?.length>=3){
      ctx.beginPath();ctx.moveTo(polygon[0].x,polygon[0].y);
      for(let index=1;index<polygon.length;index+=1)ctx.lineTo(polygon[index].x,polygon[index].y);
      ctx.closePath();ctx.fill();
    }
  }
  ctx.setTransform(1,0,0,1,0,0);
  const image=ctx.getImageData(0,0,width,height);
  const alpha=new Uint8ClampedArray(width*height);
  for(let index=0;index<alpha.length;index+=1)alpha[index]=image.data[index*4+3];
  const sourceRgba=await selectionRefineSourceRgba(layer,sourceWidth,sourceHeight,previewScale);
  return{alpha,sourceRgba,width,height,scale:previewScale,sourceWidth,sourceHeight};
}

async function attachSelectionRefinePreview(modal,body,layer,layerScale) {
  const section=document.createElement('section');section.className='selection-refine-preview';
  const heading=document.createElement('strong');heading.textContent='Предпросмотр маски';
  const status=document.createElement('small');status.textContent='Подготовка edge-aware preview…';
  const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;canvas.setAttribute('aria-label','Предпросмотр уточнённой маски');
  section.append(heading,canvas,status);body.prepend(section);
  const source=await buildSelectionRefinePreviewSource(layer);
  if(!source||!modal.isConnected)return;
  canvas.width=source.width;canvas.height=source.height;
  const ctx=canvas.getContext('2d',{alpha:false});
  let frame=0;

  const renderPreview=()=>{
    frame=0;
    if(!modal.isConnected)return;
    const values=Object.fromEntries(new FormData(modal));
    const previewOptions=selectionRefineOptionsFromValues(values,layerScale/source.scale);
    const alpha=refineMaskAlpha(source.alpha,source.width,source.height,{...previewOptions,sourceRgba:source.sourceRgba});
    const previewPixels=composeMaskPreviewRgba(source.sourceRgba,alpha,source.width,source.height,{mode:values.viewMode||'mask'});
    const image=ctx.createImageData(source.width,source.height);
    image.data.set(previewPixels);
    ctx.putImageData(image,0,0);
    const viewLabel={mask:'маска',overlay:'наложение',black:'на чёрном',white:'на белом'}[values.viewMode]||'маска';
    status.textContent=`${viewLabel} · маска ${source.sourceWidth}×${source.sourceHeight}px · preview ${source.width}×${source.height}px · документ изменится только после применения`;
  };
  const schedule=()=>{
    if(frame)cancelAnimationFrame(frame);
    frame=requestAnimationFrame(renderPreview);
  };
  modal.addEventListener('input',schedule);
  modal.addEventListener('change',schedule);
  const priorCleanup=modal.previewCleanup;
  modal.previewCleanup=()=>{
    priorCleanup?.();
    if(frame)cancelAnimationFrame(frame);
    modal.removeEventListener('input',schedule);
    modal.removeEventListener('change',schedule);
  };
  renderPreview();
}

async function refineSelectionToLayerMask(){
  const layer=selected();
  if(!layer){setStatus('Сначала выберите слой');return;}
  if(!selectionShape){setStatus('Сначала создайте выделение');return;}
  if(isLayerLocked(doc,layer)){setStatus('Слой или его группа заблокированы');return;}
  const scale=layer.type==='adjustment'?1:Math.max(.01,(Math.abs(Number(layer.scaleX)||1)+Math.abs(Number(layer.scaleY)||1))/2);
  const replacing=Boolean(layer.mask);
  showModal({
    title:'Уточнить выделение → маска слоя',
    className:'selection-refine-modal',
    fields:[
      {name:'viewMode',label:'Режим просмотра',type:'select',value:'mask',options:[['mask','Чёрно-белая маска'],['overlay','Наложение'],['black','На чёрном'],['white','На белом']]},
      {name:'smooth',label:'Сглаживание, px',type:'number',value:2,min:0,max:32,step:1},
      {name:'shift',label:'Расширить / сжать, px',type:'number',value:0,min:-64,max:64,step:1},
      {name:'edgeRadius',label:'Радиус обнаружения края, px',type:'number',value:0,min:0,max:12,step:.5},
      {name:'edgeStrength',label:'Сила уточнения края, %',type:'number',value:60,min:0,max:100,step:1},
      {name:'smartRadius',label:'Умный радиус',type:'select',value:'yes',options:[['yes','Да'],['no','Нет']]},
      {name:'feather',label:'Растушёвка, px',type:'number',value:1,min:0,max:64,step:.5},
      {name:'contrast',label:'Контраст края, %',type:'number',value:0,min:0,max:100,step:1},
      {name:'invert',label:'Инвертировать маску',type:'select',value:'no',options:[['no','Нет'],['yes','Да']]},
    ],
    submitLabel:replacing?'Заменить маску':'Создать маску',
    onMount:({modal,body})=>{void attachSelectionRefinePreview(modal,body,layer,scale).catch(error=>{console.error(error);if(modal.isConnected)toast(error?.message||'Не удалось построить edge-aware preview','warn');});},
    onSubmit:async values=>{
      const options=selectionRefineOptionsFromValues(values,scale);
      const dataUrl=await selectionMaskDataUrl(layer,options);
      layer.mask=createLayerMask({enabled:true,dataUrl});
      commit(replacing?'Уточнить маску слоя':'Создать уточнённую маску слоя');
      setStatus(`Маска уточнена: сглаживание ${Number(values.smooth)||0}px, край ${Number(values.shift)||0}px, радиус ${Number(values.edgeRadius)||0}px, растушёвка ${Number(values.feather)||0}px`);
      return true;
    },
  });
}

function removeSelectedLayerMask(){
  const layer=selected();
  if(!layer?.mask||isLayerLocked(doc,layer))return;
  layer.mask=null;commit('Удалить маску слоя');setStatus('Маска слоя удалена');
}
async function rasterizeSelectedLayer(){
  if(blockPendingDocumentEdit())return;
  const layer=selected();
  if(!layer)return;
  if(isLayerLocked(doc,layer)){setStatus('Слой или его группа заблокированы');return;}
  if(layer.type==='raster'){setStatus('Слой уже растровый');return;}
  if(layer.type==='adjustment'){setStatus('Корректирующий слой нельзя растрировать отдельно');return;}
  const targetDocument=doc;
  const targetSessionId=activeSessionId;
  const originalLayer=JSON.stringify(layer);
  paintPersisting=true;
  setStatus('Растеризация слоя…');
  try{
    const raster=await rasterizeLayerForPixelEditing(layer);
    const index=doc.layers.indexOf(layer);
    if(doc!==targetDocument||activeSessionId!==targetSessionId||index<0||
      selected()!==layer||isLayerLocked(doc,layer)||JSON.stringify(layer)!==originalLayer){
      setStatus('Растеризация отменена: документ или слой изменился');
      return;
    }
    doc.layers.splice(index,1,raster);doc.selectedLayerId=raster.id;
    brushCanvas=null;brushCtx=null;brushLayerId=null;commit('Растеризовать слой');
    setStatus(`Слой растрирован: ${raster.width} × ${raster.height}`);
  }catch(error){
    console.error(error);setStatus(`Ошибка растеризации: ${error.message}`);toast('Не удалось растрировать слой','error');
  }finally{
    paintPersisting=false;
  }
}
function resizeImageDialog(){
  if(blockPendingDocumentEdit())return;
  showModal({title:'Размер изображения',fields:[
    {name:'width',label:'Ширина',type:'number',value:doc.width,min:'1',max:'12000',required:true},
    {name:'height',label:'Высота',type:'number',value:doc.height,min:'1',max:'12000',required:true}
  ],submitLabel:'Изменить',onSubmit:v=>{
    if(blockPendingDocumentEdit())return false;
    let size;try{size=checkedCanvasSize(Number(v.width)||doc.width,Number(v.height)||doc.height,'Размер изображения');}catch(error){toast(error.message,'error');setStatus(error.message);return false;}
    const {width,height}=size;
    if(width===doc.width&&height===doc.height)return;
    const sx=width/doc.width,sy=height/doc.height;
    let transforms;
    try{transforms=imageResizeTransforms(doc.layers,sx,sy);}catch(error){toast(error.message,'error');setStatus(error.message);return false;}
    doc.layers.forEach((layer,index)=>Object.assign(layer,transforms[index]));
    doc.width=width;doc.height=height;cropRect=null;clearSelectionState();brushCanvas=null;brushCtx=null;brushLayerId=null;
    commit('Размер изображения');fitToView();
  }});
}

function setZoom(next, announce=true){
  const value=clamp(next,.1,16);
  if(Math.abs(value-zoom)<1e-6)return;
  zoom=value;const session=currentSession();if(session)session.zoom=zoom;updateCanvasSize();drawOverlay();
  if(announce)setStatus(`Масштаб ${Math.round(zoom*100)}%`);
}
function setZoomAtClientPoint(next, clientX, clientY){
  const point=clientPointToCanvas(clientX,clientY);
  const value=clamp(next,.1,16);
  if(Math.abs(value-zoom)<1e-6)return;
  zoom=value;const session=currentSession();if(session)session.zoom=zoom;updateCanvasSize();drawOverlay();
  requestAnimationFrame(()=>{
    const r=els.overlay.getBoundingClientRect();
    els.viewport.scrollLeft += r.left + point.x*zoom - clientX;
    els.viewport.scrollTop += r.top + point.y*zoom - clientY;
  });
  setStatus(`Масштаб ${Math.round(zoom*100)}%`);
}
function fitToView(){const r=els.viewport.getBoundingClientRect();setZoom(fitZoom(r.width,r.height,doc.width,doc.height,90));els.viewport.scrollTo({left:0,top:0});}

const menus={
  file:[
    ['Новый…','Ctrl+N',createNewDialog],
    ['Открыть изображение / PSD / PSB…','Ctrl+O',()=>els.fileInput.click()],
    ['Открыть проект…','',()=>els.projectInput.click()],
    ['Вставить изображение из буфера','Ctrl+V',pasteFromClipboard],
    ['sep'],
    ['Сохранить проект / обновить смарт-объект','Ctrl+S',saveProject],
    ['Экспорт…','Ctrl+Shift+S',exportDialog],
  ],
  edit:[
    ['Отменить','Ctrl+Z',undo,()=>history.canUndo()],
    ['Повторить','Ctrl+Y',redo,()=>history.canRedo()],
    ['sep'],
    ['Выделить всё','Ctrl+A',selectAllPixels],
    ['Снять выделение','Ctrl+D',deselectPixels,()=>Boolean(selectionRect)],
    ['Копировать выделение','Ctrl+C',copySelection,()=>Boolean(selectionRect)&&(selectionCopyMode==='merged'||Boolean(selected()))],
    ['Вырезать выделение','Ctrl+X',cutSelection,()=>Boolean(selectionRect)&&(selectionCopyMode==='merged'||isEditableRasterLayer(selected()))],
    ['Очистить выделенные пиксели','Delete',()=>clearSelectedPixels(),()=>Boolean(selectionRect)&&isEditableRasterLayer(selected())],
    ['sep'],
    ['Дублировать слой','Ctrl+J',duplicateSelected,()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Удалить слой','Delete',deleteSelected,()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Выбрать слой выше','Alt+↑',()=>selectAdjacentLayer(1),()=>doc.layers.length>1],
    ['Выбрать слой ниже','Alt+↓',()=>selectAdjacentLayer(-1),()=>doc.layers.length>1],
  ],
  layer:[
    ['Новый растровый слой','Ctrl+Shift+N',addBlankLayer],
    ['Новый корректирующий слой','',addAdjustmentLayer],
    ['Новая группа слоёв','',addGroup],
    ['Преобразовать в смарт-объект','',convertSelectedToSmartObject,()=>Boolean(selected())&&!['smart-object','adjustment'].includes(selected().type)&&!isLayerLocked(doc,selected())],
    ['Редактировать содержимое смарт-объекта','',()=>openSmartObjectContents(selected()),()=>selected()?.type==='smart-object'&&Boolean(selected()?.embeddedDocument)],
    ['Создать связанную копию смарт-объекта','',()=>createLinkedSmartObjectCopy(selected()),()=>selected()?.type==='smart-object'&&Boolean(selected()?.embeddedDocument)&&!isLayerLocked(doc,selected())],
    ['Разорвать связь смарт-объекта','',()=>unlinkSmartObject(selected()),()=>Boolean(selected()?.linkedSourceId)&&!isLayerLocked(doc,selected())],
    ['Добавить смарт-фильтр…','',()=>openSmartFilterDialog(selected()),()=>selected()?.type==='smart-object'&&!isLayerLocked(doc,selected())&&(selected()?.smartFilters?.length||0)<24],
    ['Очистить смарт-фильтры','',()=>clearSmartFilters(selected()),()=>selected()?.type==='smart-object'&&!isLayerLocked(doc,selected())&&Boolean(selected()?.smartFilters?.length)],
    ['Маска смарт-фильтров: показать всё','',()=>{void setSmartFilterMask(selected(),false);},()=>selected()?.type==='smart-object'&&!isLayerLocked(doc,selected())&&Boolean(selected()?.smartFilters?.length)&&!selected()?.smartFilterMask],
    ['Маска смарт-фильтров из выделения','',()=>{void setSmartFilterMask(selected(),true);},()=>selected()?.type==='smart-object'&&!isLayerLocked(doc,selected())&&Boolean(selected()?.smartFilters?.length)&&Boolean(selectionShape)],
    ['Инвертировать маску смарт-фильтров','',()=>invertSmartFilterMask(selected()),()=>Boolean(selected()?.smartFilterMask)&&!isLayerLocked(doc,selected())],
    ['Включить / отключить маску смарт-фильтров','',()=>toggleSmartFilterMask(selected()),()=>Boolean(selected()?.smartFilterMask)&&!isLayerLocked(doc,selected())],
    ['Удалить маску смарт-фильтров','',()=>removeSmartFilterMask(selected()),()=>Boolean(selected()?.smartFilterMask)&&!isLayerLocked(doc,selected())],
    ['Переименовать слой','F2',()=>{const layer=selected();if(layer)renameLayer(layer);},()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Дублировать слой','Ctrl+J',duplicateSelected,()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Удалить слой','Delete',deleteSelected,()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Растеризовать слой','',rasterizeSelectedLayer,()=>Boolean(selected())&&selected().type!=='raster'&&selected().type!=='adjustment'&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Добавить маску (показать всё)','',()=>addSelectedLayerMask(false),()=>Boolean(selected())&&!selected().mask&&!isLayerLocked(doc,selected())],
    ['Добавить маску из выделения','',()=>addSelectedLayerMask(true),()=>Boolean(selected())&&!selected().mask&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Уточнить выделение → маска…','',refineSelectionToLayerMask,()=>Boolean(selected())&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Удалить маску','',removeSelectedLayerMask,()=>Boolean(selected()?.mask)&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Создать векторную маску из выделения','',()=>applySelectionToVectorMask('replace'),()=>Boolean(selected())&&Boolean(selectionShape)&&!selected().vectorMask&&!isLayerLocked(doc,selected())],
    ['Заменить векторную маску выделением','',()=>applySelectionToVectorMask('replace'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Добавить выделение к векторной маске','',()=>applySelectionToVectorMask('add'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Вычесть выделение из векторной маски','',()=>applySelectionToVectorMask('subtract'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Пересечь векторную маску с выделением','',()=>applySelectionToVectorMask('intersect'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Исключить пересечение из векторной маски','',()=>applySelectionToVectorMask('exclude'),()=>Boolean(selected()?.vectorMask)&&Boolean(selectionShape)&&!isLayerLocked(doc,selected())],
    ['Редактировать векторную маску пером','',editSelectedVectorMask,()=>Boolean(selected()?.vectorMask)&&!isLayerLocked(doc,selected())],
    ['Инвертировать векторную маску','',invertSelectedVectorMask,()=>Boolean(selected()?.vectorMask)&&!isLayerLocked(doc,selected())],
    ['Включить / отключить векторную маску','',toggleSelectedVectorMask,()=>Boolean(selected()?.vectorMask)&&!isLayerLocked(doc,selected())],
    ['Удалить векторную маску','',removeSelectedVectorMask,()=>Boolean(selected()?.vectorMask)&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Центрировать слой на холсте','',centerSelectedLayer,()=>isTransformableLayer(selected())&&!isLayerLocked(doc,selected())],
    ['Вписать слой в холст','',fitSelectedLayerToCanvas,()=>isTransformableLayer(selected())&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Показать / скрыть слой','',toggleSelectedVisibility,()=>Boolean(selected())],
    ['Заблокировать / разблокировать','',toggleSelectedLock,()=>{const layer=selected();return Boolean(layer)&&!doc.groups?.find(group=>group.id===layer.groupId)?.locked;}],
    ['sep'],
    ['Поднять слой','',()=>{if(moveLayer(doc,doc.selectedLayerId,1))commit('Поднять слой');},()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Опустить слой','',()=>{if(moveLayer(doc,doc.selectedLayerId,-1))commit('Опустить слой');},()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
  ],
  image:[
    ['Цветокоррекция…','',openColorCorrectionDialog,()=>selected()?.type==='raster'&&!isLayerLocked(doc,selected())],
    ['Сбросить цветокоррекцию','',()=>{const l=selected();if(l?.type==='raster'&&!isLayerLocked(doc,l)){const current=sanitizeFilters(l.filters);for(const key of COLOR_CORRECTION_KEYS)current[key]=DEFAULT_LAYER_FILTERS[key];l.filters=current;commit('Сбросить цветокоррекцию');}},()=>selected()?.type==='raster'&&!isLayerLocked(doc,selected())],
    ['sep'],
    ['Размер изображения…','',resizeImageDialog],
    ['Размер холста…','',resizeCanvasDialog],
    ['Фон документа…','',setDocumentBackground],
    ['sep'],
    ['Сбросить все фильтры слоя','',()=>{const l=selected();if(l&&!isLayerLocked(doc,l)){l.filters={...DEFAULT_LAYER_FILTERS};commit('Сбросить фильтры');}},()=>Boolean(selected())&&!isLayerLocked(doc,selected())],
  ],
  select:[
    ['Выделить всё','Ctrl+A',selectAllPixels],
    ['Снять выделение','Ctrl+D',deselectPixels,()=>Boolean(selectionRect)],
    ['Копировать выделение','Ctrl+C',copySelection,()=>Boolean(selectionRect)&&(selectionCopyMode==='merged'||Boolean(selected()))],
    ['Вырезать выделение','Ctrl+X',cutSelection,()=>Boolean(selectionRect)&&(selectionCopyMode==='merged'||isEditableRasterLayer(selected()))],
    ['sep'],
    ['Очистить пиксели выделения','Delete',()=>clearSelectedPixels(),()=>Boolean(selectionRect)&&isEditableRasterLayer(selected())],
    ['Кадрировать по выделению','',cropToSelection,()=>Boolean(selectionRect)],
    ['sep'],
    ['Уточнить выделение → маска…','',refineSelectionToLayerMask,()=>Boolean(selectionShape)&&Boolean(selected())&&!isLayerLocked(doc,selected())],
    ['Создать / заменить векторную маску','',()=>applySelectionToVectorMask('replace'),()=>Boolean(selectionShape)&&Boolean(selected())&&!isLayerLocked(doc,selected())],
  ],
  view:[
    ['Вписать в окно','0',fitToView],
    ['100%','1',()=>setZoom(1)],
    ['Увеличить','+',()=>setZoom(zoom+.1)],
    ['Уменьшить','-',()=>setZoom(zoom-.1)],
    ['sep'],
    ['Режим холста: панели','Tab',togglePanels],
    ['Полноэкранный режим','F11',toggleFullscreen],
  ],
  help:[
    ['Горячие клавиши','?',showShortcuts],
    ['О программе','',showAbout],
  ],
};
function openColorCorrectionDialog(){
  const layer=selected();
  if(!layer||layer.type!=='raster'){toast('Цветокоррекция доступна для растрового слоя','warn');setStatus('Выберите растровый слой');return;}
  if(isLayerLocked(doc,layer)){toast('Слой или его группа заблокированы','warn');return;}
  const layerId=layer.id;
  const original=sanitizeFilters(layer.filters);
  layer.filters={...original};
  const previousFocus=document.activeElement;
  const back=document.createElement('div');back.className='modal-backdrop';
  const modal=document.createElement('form');modal.className='modal color-correction-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Цветокоррекция');
  modal.innerHTML='<header>Цветокоррекция</header><div class="modal-body color-correction-body"><p class="muted color-correction-hint">Настройки применяются неразрушающе к выбранному растровому слою. Изменения сразу видны на холсте.</p></div><footer><button type="button" class="secondary-button" data-reset>Сбросить</button><span class="modal-footer-spacer"></span><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">Применить</button></footer>';
  const body=modal.querySelector('.color-correction-body');
  let currentGroup='';
  for(const control of COLOR_CORRECTION_CONTROLS){
    if(control.group!==currentGroup){currentGroup=control.group;const heading=document.createElement('div');heading.className='color-correction-group';heading.textContent=currentGroup;body.append(heading);}
    const row=document.createElement('label');row.className='color-correction-row';
    const label=document.createElement('span');label.textContent=control.label;
    const input=document.createElement('input');input.type='range';input.name=control.key;input.min=String(control.min);input.max=String(control.max);input.step=String(control.step);input.value=String(layer.filters[control.key] ?? DEFAULT_LAYER_FILTERS[control.key]);
    const output=document.createElement('output');output.value=formatFilterValue(control.key,input.value);output.textContent=output.value;
    row.append(label,input,output);body.append(row);
    input.addEventListener('input',()=>{
      const target=doc.layers.find(item=>item.id===layerId);if(!target)return;
      const [min,max]=FILTER_RANGES[control.key]||[control.min,control.max];
      const value=clamp(Number(input.value),min,max);target.filters[control.key]=value;output.value=formatFilterValue(control.key,value);output.textContent=output.value;render();
    });
  }
  const close=()=>{els.modalRoot.replaceChildren();if(previousFocus instanceof HTMLElement)previousFocus.focus();};
  const restore=()=>{const target=doc.layers.find(item=>item.id===layerId);if(target){target.filters={...original};render();refreshInspectorPanels();}};
  back.append(modal);els.modalRoot.replaceChildren(back);
  modal.querySelector('[data-reset]').addEventListener('click',()=>{
    for(const control of COLOR_CORRECTION_CONTROLS){
      const input=modal.elements.namedItem(control.key);if(!(input instanceof HTMLInputElement))continue;
      input.value=String(DEFAULT_LAYER_FILTERS[control.key]);input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  modal.querySelector('[data-cancel]').addEventListener('click',()=>{restore();close();setStatus('Цветокоррекция отменена');});
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();restore();close();setStatus('Цветокоррекция отменена');}});
  modal.addEventListener('submit',e=>{
    e.preventDefault();const target=doc.layers.find(item=>item.id===layerId);if(!target){close();return;}
    const changed=COLOR_CORRECTION_CONTROLS.some(control=>Math.abs((target.filters[control.key]??DEFAULT_LAYER_FILTERS[control.key])-(original[control.key]??DEFAULT_LAYER_FILTERS[control.key]))>1e-9);
    close();
    if(changed){commit('Цветокоррекция слоя');setStatus('Цветокоррекция применена');}
    else {target.filters={...original};render();setStatus('Цветокоррекция без изменений');}
  });
  modal.querySelector('input[type="range"]')?.focus();
}

function resizeCanvasDialog(){if(blockPendingDocumentEdit())return;showModal({title:'Размер холста',fields:[
  {name:'width',label:'Ширина',type:'number',value:doc.width,min:'1',max:'12000',required:true},
  {name:'height',label:'Высота',type:'number',value:doc.height,min:'1',max:'12000',required:true},
  {name:'anchor',label:'Якорь',type:'select',value:'center',options:[
    ['top-left','↖ Слева сверху'],['top','↑ Сверху'],['top-right','↗ Справа сверху'],
    ['left','← Слева'],['center','● По центру'],['right','→ Справа'],
    ['bottom-left','↙ Слева снизу'],['bottom','↓ Снизу'],['bottom-right','↘ Справа снизу']
  ]}
],submitLabel:'Изменить',onSubmit:v=>{
  if(blockPendingDocumentEdit())return false;
  let size;try{size=checkedCanvasSize(Number(v.width)||doc.width,Number(v.height)||doc.height,'Размер холста');}catch(error){toast(error.message,'error');setStatus(error.message);return false;}
  const {width,height}=size;
  if(width===doc.width&&height===doc.height)return;
  const anchors={
    'top-left':[0,0],top:[.5,0],'top-right':[1,0],left:[0,.5],center:[.5,.5],right:[1,.5],
    'bottom-left':[0,1],bottom:[.5,1],'bottom-right':[1,1]
  };
  const [ax,ay]=anchors[v.anchor]||anchors.center;
  const shiftX=(width-doc.width)*ax, shiftY=(height-doc.height)*ay;
  if(doc.layers.some(layer=>Math.abs(layer.x+shiftX)>MAX_LAYER_POSITION||Math.abs(layer.y+shiftY)>MAX_LAYER_POSITION)){
    const message='Размер холста выведет слой за допустимые пределы';toast(message,'error');setStatus(message);return false;
  }
  for(const layer of doc.layers){layer.x+=shiftX;layer.y+=shiftY;}
  doc.width=width;doc.height=height;cropRect=null;clearSelectionState();brushCanvas=null;brushCtx=null;brushLayerId=null;commit('Размер холста');fitToView();
}});}
function closeMenu({restoreFocus=false}={}) {
  const active=$('.menu-button.active');
  const focusTarget=menuReturnFocus || active;
  openMenuKey=null; menuReturnFocus=null; els.menu.hidden=true; els.menu.replaceChildren();
  $$('.menu-button').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false');});
  if (restoreFocus) (focusTarget?.isConnected ? focusTarget : els.viewport)?.focus();
}
function populateMenu(items){
  els.menu.replaceChildren();
  for(const item of items){
    if(item[0]==='sep'){const sep=document.createElement('div');sep.className='menu-sep';sep.setAttribute('role','separator');els.menu.append(sep);continue;}
    const [label,shortcut,action,enabled]=item;
    const b=document.createElement('button');b.type='button';b.className='menu-item';b.setAttribute('role','menuitem');
    b.disabled=enabled ? !enabled() : false;
    b.innerHTML=`<span>${escapeHtml(label)}</span><span class="menu-shortcut">${escapeHtml(shortcut)}</span>`;
    b.onclick=()=>{if(b.disabled)return;closeMenu();Promise.resolve(action()).catch(error=>{console.error(error);toast(error.message||'Ошибка команды','error');});};
    els.menu.append(b);
  }
}
function positionMenu(x,y,{focusFirst=false}={}){
  els.menu.hidden=false;
  const rect=els.menu.getBoundingClientRect();
  els.menu.style.left=`${Math.max(6,Math.min(x,window.innerWidth-rect.width-6))}px`;
  els.menu.style.top=`${Math.max(6,Math.min(y,window.innerHeight-rect.height-6))}px`;
  if(focusFirst)els.menu.querySelector('.menu-item:not(:disabled)')?.focus();
}
function openMenu(button,key,{focusFirst=false}={}){
  openMenuKey=key; menuReturnFocus=button;
  $$('.menu-button').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-expanded',String(active));});
  populateMenu(menus[key]||[]);
  const r=button.getBoundingClientRect();
  positionMenu(r.left,r.bottom+3,{focusFirst});
}
function openContextMenu(key,items,event,focusTarget=event.target){
  openMenuKey=key; menuReturnFocus=focusTarget;
  $$('.menu-button').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false');});
  populateMenu(items);
  const keyboard=event.clientX===0 && event.clientY===0;
  const rect=focusTarget?.getBoundingClientRect?.();
  positionMenu(keyboard && rect ? rect.left+8 : event.clientX, keyboard && rect ? rect.bottom : event.clientY,{focusFirst:keyboard});
}
const menuButtons=$$('.menu-button');
menuButtons.forEach((b,index)=>{
  b.type='button'; b.setAttribute('aria-haspopup','menu'); b.setAttribute('aria-expanded','false');
  b.addEventListener('click',e=>{e.stopPropagation();if(openMenuKey===b.dataset.menu)closeMenu();else openMenu(b,b.dataset.menu);});
  b.addEventListener('mouseenter',()=>{if(openMenuKey && openMenuKey!==b.dataset.menu)openMenu(b,b.dataset.menu);});
  b.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();openMenu(b,b.dataset.menu,{focusFirst:true});}
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
      e.preventDefault();const delta=e.key==='ArrowRight'?1:-1;const next=menuButtons[(index+delta+menuButtons.length)%menuButtons.length];next.focus();if(openMenuKey)openMenu(next,next.dataset.menu);
    }
  });
});
els.menu.setAttribute('role','menu');
els.menu.addEventListener('keydown',e=>{
  const items=[...els.menu.querySelectorAll('.menu-item:not(:disabled)')]; const index=items.indexOf(document.activeElement);
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu({restoreFocus:true});return;}
  if(e.key==='ArrowDown'&&items.length){e.preventDefault();items[(index+1+items.length)%items.length].focus();}
  if(e.key==='ArrowUp'&&items.length){e.preventDefault();items[(index-1+items.length)%items.length].focus();}
});
document.addEventListener('pointerdown',e=>{if(openMenuKey&&!els.menu.contains(e.target)&&!e.target.closest?.('.menu-button'))closeMenu();});
els.tabs.addEventListener('contextmenu',e=>{
  if(e.target!==els.tabs)return;
  e.preventDefault();
  openContextMenu('tabs-empty',[['Новая вкладка','',()=>addDocumentTab()]],e,els.addTab);
});
els.layers.addEventListener('contextmenu',e=>{
  if(e.target!==els.layers)return;
  e.preventDefault();
  if(blockPendingDocumentEdit())return;
  openContextMenu('layers-empty',[
    ['Новый растровый слой','Ctrl+Shift+N',addBlankLayer],
    ['Новая группа слоёв','',addGroup],
  ],e,els.layers);
});
els.viewport.addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(blockPendingDocumentEdit())return;
  openContextMenu('canvas',[
    ['Отменить','Ctrl+Z',undo,()=>history.canUndo()],
    ['Повторить','Ctrl+Y',redo,()=>history.canRedo()],
    ['sep'],
    ['Вставить изображение','Ctrl+V',pasteFromClipboard],
    ['Снять выделение','Ctrl+D',deselectPixels,()=>Boolean(selectionRect)],
    ['Новый растровый слой','Ctrl+Shift+N',addBlankLayer],
    ['sep'],
    ['Вписать в окно','0',fitToView],
    ['Масштаб 100%','1',()=>setZoom(1)],
  ],e,els.viewport);
});
window.addEventListener('blur',()=>{closeMenu();spaceHeld=false;if(!drag)els.overlay.style.cursor=defaultToolCursor();});

$$('.tool').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
els.primaryColor.oninput=()=>els.colorChip.style.background=els.primaryColor.value;
els.brushSize.oninput=()=>els.brushSizeValue.textContent=els.brushSize.value;
els.toolOpacity.oninput=()=>els.toolOpacityValue.textContent=`${els.toolOpacity.value}%`;
els.dodgeStrength.oninput=()=>els.dodgeStrengthValue.textContent=`${els.dodgeStrength.value}%`;
els.burnStrength.oninput=()=>els.burnStrengthValue.textContent=`${els.burnStrength.value}%`;
if(els.blurStrength)els.blurStrength.oninput=()=>els.blurStrengthValue.textContent=`${els.blurStrength.value}%`;
if(els.smudgeStrength)els.smudgeStrength.oninput=()=>els.smudgeStrengthValue.textContent=`${els.smudgeStrength.value}%`;
if(els.fillTolerance)els.fillTolerance.oninput=()=>els.fillToleranceValue.textContent=els.fillTolerance.value;
if(els.selectionType)els.selectionType.onchange=()=>setSelectionType(els.selectionType.value);
if(els.selectionCopyMode)els.selectionCopyMode.onchange=()=>{selectionCopyMode=els.selectionCopyMode.value==='selected'?'selected':'merged';setStatus(selectionCopyMode==='merged'?'Выделение: копирование со всех видимых слоёв':'Выделение: копирование с выбранного слоя');};
if(els.smartSnapToggle)els.smartSnapToggle.onchange=()=>{smartSnapEnabled=els.smartSnapToggle.checked;persistSmartSnapState();clearSmartGuides();drawOverlay();setStatus(smartSnapEnabled?'Умная привязка включена':'Умная привязка выключена');};
$$('[data-align]').forEach(button=>button.addEventListener('click',()=>alignSelectedLayer(button.dataset.align)));
els.undo.onclick=undo;els.redo.onclick=redo;$('#exportQuickBtn').onclick=exportDialog;
$('#addRasterBtn').onclick=addBlankLayer;$('#addGroupBtn').onclick=()=>addGroup();$('#renameLayerBtn').onclick=()=>{const layer=selected();if(layer)renameLayer(layer);};$('#duplicateLayerBtn').onclick=duplicateSelected;$('#deleteLayerBtn').onclick=deleteSelected;
$('#layerUpBtn').onclick=()=>{if(moveLayer(doc,doc.selectedLayerId,1))commit('Поднять слой');};$('#layerDownBtn').onclick=()=>{if(moveLayer(doc,doc.selectedLayerId,-1))commit('Опустить слой');};
$('#addPathBtn').onclick=addDocumentPathFromCurrent;
$('#editPathBtn').onclick=editSelectedDocumentPath;
$('#applyPathMaskBtn').onclick=applySelectedDocumentPathAsVectorMask;
$('#renamePathBtn').onclick=renameSelectedDocumentPath;
$('#duplicatePathBtn').onclick=duplicateSelectedDocumentPath;
$('#deletePathBtn').onclick=deleteSelectedDocumentPath;
els.layers.addEventListener('dragover',e=>{
  if((!layerDragId&&!groupDragId)||e.target!==els.layers)return;
  e.preventDefault();
  if(e.dataTransfer)e.dataTransfer.dropEffect='move';
  els.layers.classList.add('drop-root');
});
els.layers.addEventListener('dragleave',e=>{if(e.target===els.layers)els.layers.classList.remove('drop-root');});
els.layers.addEventListener('drop',e=>{
  if((!layerDragId&&!groupDragId)||e.target!==els.layers)return;
  e.preventDefault();
  const draggedLayerId=layerDragId;
  const draggedGroupId=groupDragId;
  els.layers.classList.remove('drop-root');
  if(draggedLayerId&&moveLayerToRootTop(draggedLayerId)){commit('Вынести слой из группы');return;}
  if(draggedGroupId&&moveLayerGroupIntoGroup(doc,draggedGroupId,null))commit('Вынести группу на верхний уровень');
});
$('#clearHistoryBtn').onclick=()=>{history.clearToCurrent();updateHistory();updateAll();};
$('#resetColorEffectsBtn').onclick=resetSelectedLayerEffects;
els.addTab.onclick=()=>addDocumentTab();
els.blend.onchange=()=>{const l=selected();if(l&&!isLayerLocked(doc,l)){l.blendMode=els.blend.value;commit('Режим наложения');}};
els.layerOpacity.oninput=()=>{const l=selected();if(l&&!isLayerLocked(doc,l)){l.opacity=Number(els.layerOpacity.value)/100;markDirty(true);render();}};
els.layerOpacity.onchange=()=>{const l=selected();if(l&&!isLayerLocked(doc,l)){l.opacity=Number(els.layerOpacity.value)/100;commit('Непрозрачность слоя');}};
$('#zoomOutBtn').onclick=()=>setZoom(zoom-.1);$('#zoomInBtn').onclick=()=>setZoom(zoom+.1);$('#fitBtn').onclick=fitToView;els.zoomRange.oninput=()=>setZoom(Number(els.zoomRange.value)/100,false);
els.fileInput.onchange=()=>{handleIncomingFiles(els.fileInput.files,null,'Импорт').catch(e=>{console.error(e);alert(e.message);});els.fileInput.value='';};
els.projectInput.onchange=()=>{const f=els.projectInput.files[0];if(f)openProject(f);els.projectInput.value='';};

function dragCarriesFiles(event) {
  const dt=event.dataTransfer;
  if(!dt)return false;
  if(dt.files?.length)return true;
  if([...(dt.items||[])].some(item=>item.kind==='file'))return true;
  return [...(dt.types||[])].some(type=>String(type).toLowerCase()==='files');
}
function showDropTarget() {
  dragDepth=Math.max(1,dragDepth);
  els.dropOverlay.hidden=false;
  els.viewport.classList.add('drop-active');
}
function hideDropTarget() {
  dragDepth=0;
  els.dropOverlay.hidden=true;
  els.viewport.classList.remove('drop-active');
}
// Capture on window so Windows Explorer drops are intercepted before the browser can navigate to the file.
window.addEventListener('dragenter',e=>{
  if(!dragCarriesFiles(e))return;
  e.preventDefault();e.stopPropagation();dragDepth+=1;showDropTarget();
},{capture:true});
window.addEventListener('dragover',e=>{
  if(!dragCarriesFiles(e))return;
  e.preventDefault();e.stopPropagation();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';showDropTarget();
},{capture:true});
window.addEventListener('dragleave',e=>{
  if(!dragCarriesFiles(e))return;
  e.preventDefault();e.stopPropagation();
  dragDepth=Math.max(0,dragDepth-1);
  if(dragDepth===0)hideDropTarget();
},{capture:true});
window.addEventListener('drop',e=>{
  if(!dragCarriesFiles(e))return;
  e.preventDefault();e.stopPropagation();hideDropTarget();
  const files=[...(e.dataTransfer?.files||[])];
  if(!files.length){toast('Windows передал событие перетаскивания без файла','error');return;}
  const r=els.overlay.getBoundingClientRect();
  const inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  const anchor=inside?clientPointToCanvas(e.clientX,e.clientY):visibleCanvasCenter();
  handleIncomingFiles(files,anchor,'Перетаскивание').catch(error=>{console.error(error);toast(error.message||'Ошибка импорта','error');});
},{capture:true});

window.addEventListener('copy',e=>{
  if(isEditingTarget(e.target)||!selectionRect)return;
  e.preventDefault();
  copySelection().catch(error=>{console.error(error);toast(error.message||'Ошибка копирования','error');});
});
window.addEventListener('cut',e=>{
  if(isEditingTarget(e.target)||!selectionRect)return;
  e.preventDefault();
  cutSelection().catch(error=>{console.error(error);toast(error.message||'Ошибка вырезания','error');});
});

window.addEventListener('paste',e=>{
  if(isEditingTarget(e.target))return;
  const files=[];
  for(const item of [...(e.clipboardData?.items||[])]){
    if(item.kind==='file'&&item.type.startsWith('image/')){
      const file=item.getAsFile();if(file)files.push(file);
    }
  }
  if(!files.length){
    for(const file of [...(e.clipboardData?.files||[])])if(isImageFile(file))files.push(file);
  }
  if(!files.length){
    const hasClipboardPayload=(e.clipboardData?.items?.length||0)>0 || (e.clipboardData?.files?.length||0)>0;
    if(hasClipboardPayload)toast('В буфере есть данные, но браузер не передал их как изображение','error');
    return;
  }
  e.preventDefault();
  pasteGeneration+=1;
  clearTimeout(pasteFallbackTimer);
  importImages(files,{anchor:visibleCanvasCenter(),source:'Вставка'}).catch(error=>{console.error(error);toast(error.message||'Ошибка вставки','error');});
});

els.viewport.addEventListener('wheel',e=>{
  if(!e.ctrlKey&&!e.altKey)return;
  e.preventDefault();
  const factor=e.deltaY<0?1.1:0.9;
  setZoomAtClientPoint(zoom*factor,e.clientX,e.clientY);
},{passive:false});

window.addEventListener('keydown',e=>{
  const editing=isEditingTarget();
  const interactive=isInteractiveControlTarget(e.target);
  if(e.code==='Space'&&!editing&&!interactive){spaceHeld=true;if(!drag)els.overlay.style.cursor='grab';e.preventDefault();}
  if(editing)return;
  const ctrl=e.ctrlKey||e.metaKey;
  if(e.key==='Escape'){
    if(openMenuKey){e.preventDefault();closeMenu({restoreFocus:true});return;}
    if(drag && drag.kind!=='paint'){
      e.preventDefault();
      const d=drag;drag=null;activePrimaryPointerId=null;clearSmartGuides();
      if(d.kind==='move'){const l=doc.layers.find(x=>x.id===d.layerId);if(l){l.x=d.x;l.y=d.y;render();updateTransformPropertyValues(l);}}
      if(d.kind==='resize'){const l=doc.layers.find(x=>x.id===d.layerId);if(l){Object.assign(l,d.initial);render();updateTransformPropertyValues(l);}}
      if(d.kind==='rotate'){const l=doc.layers.find(x=>x.id===d.layerId);if(l){l.rotation=d.initialRotation;render();updateTransformPropertyValues(l);}}
      if(d.kind==='pen-handle'&&penDraft){penDraft.points.splice(d.nodeIndex,1);if(!penDraft.points.length)penDraft=null;}
      if(d.kind==='path-control')restorePathControlDrag(d);
      if(d.kind==='crop')cropRect=null;
      if(d.kind==='marquee')setSelectionShape(d.previousSelection);
      els.overlay.style.cursor=defaultToolCursor();drawOverlay();setStatus('Действие отменено');return;
    }
    if(polygonDraft){e.preventDefault();cancelPolygonDraft({restorePrevious:true,announce:true});return;}
    if(penDraft){e.preventDefault();penDraft=null;drawOverlay();setStatus('Контур отменён');return;}
    if(magneticDraft){e.preventDefault();magneticDraft=null;drawOverlay();setStatus('Магнитное выделение отменено');return;}
    if(cropRect){cropRect=null;drawOverlay();setStatus('Кадрирование отменено');return;}
    if(selectionRect){deselectPixels();return;}
  }
  if(e.target instanceof Node && els.modalRoot.contains(e.target))return;
  if(openMenuKey && (els.menu.contains(e.target)||e.target.closest?.('.menu-button')))return;
  if(e.key==='Enter'&&polygonDraft&&currentTool==='marquee'){e.preventDefault();finishPolygonSelection();return;}
  if(e.key==='Enter'&&penDraft&&currentTool==='pen'){e.preventDefault();finishPenPath();return;}
  if(e.key==='Enter'&&magneticDraft&&currentTool==='magnetic'){e.preventDefault();finishMagneticSelection();return;}
  if(ctrl&&e.code==='Digit0'){e.preventDefault();fitToView();return;}
  if(ctrl&&e.code==='Digit1'){e.preventDefault();setZoom(1);return;}
  if(ctrl&&(e.code==='Equal'||e.code==='NumpadAdd')){e.preventDefault();setZoom(zoom+.1);return;}
  if(ctrl&&(e.code==='Minus'||e.code==='NumpadSubtract')){e.preventDefault();setZoom(zoom-.1);return;}
  if(ctrl&&e.code==='KeyC'){e.preventDefault();copySelection().catch(error=>{console.error(error);toast(error.message||'Ошибка копирования','error');});return;}
  if(ctrl&&e.code==='KeyX'){e.preventDefault();cutSelection().catch(error=>{console.error(error);toast(error.message||'Ошибка вырезания','error');});return;}
  if(ctrl&&e.code==='KeyV'){armPasteShortcutFallback();return;}
  if(ctrl&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(ctrl&&e.code==='KeyY'){e.preventDefault();redo();return;}
  if(ctrl&&e.code==='KeyS'){e.preventDefault();(e.shiftKey||e.altKey)?exportDialog():saveProject();return;}
  if(ctrl&&e.code==='KeyO'){e.preventDefault();els.fileInput.click();return;}
  if(ctrl&&e.code==='KeyN'){e.preventDefault();e.shiftKey?addBlankLayer():createNewDialog();return;}
  if(ctrl&&e.code==='KeyA'){e.preventDefault();selectAllPixels();return;}
  if(ctrl&&e.code==='KeyD'){e.preventDefault();deselectPixels();return;}
  if(ctrl&&e.code==='KeyJ'){e.preventDefault();duplicateSelected();return;}
  if(interactive)return;
  if(e.key==='Tab'&&!ctrl&&!e.altKey){e.preventDefault();togglePanels();return;}
  if(e.altKey&&e.code==='ArrowUp'){e.preventDefault();selectAdjacentLayer(1);return;}
  if(e.altKey&&e.code==='ArrowDown'){e.preventDefault();selectAdjacentLayer(-1);return;}
  if(e.code==='F2'){e.preventDefault();const l=selected();if(l)renameLayer(l);return;}
  if(e.key==='Delete'){e.preventDefault();if(selectionRect&&isEditableRasterLayer(selected()))clearSelectedPixels();else deleteSelected();return;}
  if(!ctrl&&!e.altKey&&(e.code==='BracketLeft'||e.code==='BracketRight')){e.preventDefault();adjustBrushSize(e.code==='BracketRight'?1:-1,e.shiftKey);return;}
  if(!ctrl&&!e.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){
    e.preventDefault();const step=e.shiftKey?10:1;
    if(e.code==='ArrowLeft')nudgeSelected(-step,0);if(e.code==='ArrowRight')nudgeSelected(step,0);if(e.code==='ArrowUp')nudgeSelected(0,-step);if(e.code==='ArrowDown')nudgeSelected(0,step);return;
  }
  if(!ctrl&&!e.altKey&&e.shiftKey&&e.code==='KeyM'){e.preventDefault();if(currentTool!=='marquee')setTool('marquee');cycleSelectionType();return;}
  if(!ctrl&&!e.altKey&&e.shiftKey&&e.code==='KeyO'){e.preventDefault();setTool('burn');return;}
  if(!ctrl&&!e.altKey&&e.shiftKey&&e.code==='KeyG'){e.preventDefault();setTool('gradient');return;}
  const map={KeyV:'move',KeyM:'marquee',KeyB:'brush',KeyS:'clone',KeyJ:'heal',KeyN:'smudge',KeyO:'dodge',KeyR:'blur',KeyE:'eraser',KeyG:'fill',KeyP:'pen',KeyA:'magnetic',KeyW:'wand',KeyL:'line',KeyT:'text',KeyU:'shape',KeyC:'crop',KeyI:'eyedropper',KeyH:'hand',KeyZ:'zoom'}; if(!ctrl&&!e.altKey&&map[e.code]){setTool(map[e.code]);return;}
  if(e.code==='Digit0'&&!ctrl){fitToView();return;}if(e.code==='Digit1'&&!ctrl){setZoom(1);return;}
  if((e.code==='Equal'||e.code==='NumpadAdd')&&!ctrl){e.preventDefault();setZoom(zoom+.1);return;}
  if((e.code==='Minus'||e.code==='NumpadSubtract')&&!ctrl){e.preventDefault();setZoom(zoom-.1);return;}
  if(e.code==='F11'){e.preventDefault();toggleFullscreen();}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceHeld=false;if(!drag)els.overlay.style.cursor=defaultToolCursor();}});
window.addEventListener('resize',()=>{drawOverlay();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&documentSessions.some(session=>session.dirty))queueRecovery({immediate:true});});
window.addEventListener('beforeunload',e=>{syncCurrentSession();if(documentSessions.some(session=>session.dirty)||documentEditPending()){e.preventDefault();e.returnValue='';}});

async function bootstrap(){
  initTooltips();
  initCollapsiblePanels();
  readSmartSnapState();
  const initialSession = buildSession(doc);
  documentSessions = [initialSession];
  activeSessionId = initialSession.id;
  loadSession(initialSession);
  markDirty(false);
  setTool('move');
  updateAll();
  const restored=await restoreRecoveryIfAvailable();
  requestAnimationFrame(fitToView);
  return restored;
}
bootstrap().then(()=>{
  window.__ZETER_BOOTED__=true;
  document.documentElement.dataset.appReady='true';
}).catch(error=>{
  console.error('ZeTer Photo Editor bootstrap failed',error);
  document.documentElement.dataset.appReady='error';
  const message=document.createElement('div');
  message.className='fatal-error';
  message.textContent=`Ошибка запуска редактора: ${error?.message||error}`;
  document.body.append(message);
});