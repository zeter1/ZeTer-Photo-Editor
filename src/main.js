import { HistoryStack } from './core/history.js';
import { fitZoom, layerFrame, frameBounds, hitLayerHandle, normalizeRect, constrainedRect, pointInLayer, resizeLayerFromPoint, rotationHandlePoint, rotationFromDrag, snapLineEnd, snapLayerMove, alignLayerToCanvas, selectionPixelBounds, selectionBounds, selectionPathPoints, pointInSelection, clamp } from './core/geometry.js';
import {
  createDocument, createRasterLayer, createTextLayer, createShapeLayer, createLayerGroup, documentWithTextPreview,
  addLayer, removeLayer, duplicateLayer, moveLayer, addLayerGroup, removeLayerGroup, moveLayerIntoGroup, selectedLayer,
  snapshotDocument, restoreDocument, sanitizeProject, touch, checkedCanvasSize, imageResizeTransforms, MAX_LAYER_POSITION, DEFAULT_LAYER_FILTERS, FILTER_RANGES, sanitizeFilters,
  isLayerVisible, isLayerLocked,
} from './core/state.js';
import { renderDocument, renderLayer, compositeToBlob, invalidateImageCache, clearImageCache, getImage, ensureTextFont } from './core/render.js';
import { readFileAsDataURL, readFileAsText, dimensionsFromDataUrl, canvasToDataURL, downloadBlob, downloadText, safeFilename } from './core/io.js';
import { applyBlurBrushPixels, applyToneBrushPixels, floodFillPixels, hexToRgb } from './core/pixels.js';
import { saveRecoverySnapshot, loadRecoverySnapshots, clearRecoverySnapshot } from './core/recovery.js';
import { LAYER_STYLE_FIELDS, createLayerStyles, sanitizeLayerStyles, layerStyleOutset } from './core/layer-styles.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  canvas: $('#editorCanvas'), overlay: $('#overlayCanvas'), shell: $('#canvasShell'), viewport: $('#stageViewport'),
  title: $('#documentTitle'), tabs: $('#docTabs'), addTab: $('#addDocTabBtn'), dimensions: $('#docDimensions'), zoomLabel: $('#zoomLabel'), zoomRange: $('#zoomRange'),
  status: $('#statusText'), pointer: $('#pointerInfo'), layers: $('#layersList'), history: $('#historyList'), props: $('#propertiesContent'), effects: $('#effectsContent'), emptyDrop: $('#emptyDrop'),
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
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
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
let blurScratchCanvas = null;
let blurScratchCtx = null;
let retouchScratchCanvas = null;
let retouchScratchCtx = null;
let cloneSource = null;
let cloneSnapshotCanvas = null;
let penDraft = null;
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
}
function loadSession(session) {
  doc = session.doc;
  history = session.history;
  zoom = session.zoom;
  dirty = session.dirty;
  cropRect = cloneRect(session.cropRect);
  selectionRect = cloneRect(session.selectionRect);
  selectionShape = cloneSelectionShape(session.selectionShape) || (selectionRect ? {type:'rect',rect:cloneRect(selectionRect)} : null);
  polygonDraft = null;
  drag = null;
  brushCanvas = null;
  brushCtx = null;
  brushLayerId = null;
  hoverPoint = null;
  activePrimaryPointerId = null;
  paintPersisting = false;
}
function buildSession(documentValue, { label = 'Новый документ', zoomLevel = 0.75, dirtyState = false } = {}) {
  const sessionHistory = new HistoryStack(80);
  sessionHistory.reset(label, snapshotDocument(documentValue));
  return {
    id: createSessionId(),
    doc: documentValue,
    history: sessionHistory,
    zoom: zoomLevel,
    dirty: dirtyState,
    cropRect: null,
    selectionRect: null,
    selectionShape: null,
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
    button.title = session.doc?.name || 'Без имени';

    const title = document.createElement('span');
    title.className = 'doc-tab-title';
    title.textContent = session.doc?.name || 'Без имени';
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
  clearSelectionState();
  brushCanvas=null;brushCtx=null;brushLayerId=null;
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
      ? new Map([[brushLayerId, brushCanvas]])
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
  const pointDraft=penDraft||magneticDraft;
  if(pointDraft?.points?.length){const points=pointDraft.points;ctx.save();ctx.lineWidth=1.5/zoom;ctx.strokeStyle=penDraft?'#72a7ff':'#ff5fa8';ctx.fillStyle='#fff';ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i+=1)ctx.lineTo(points[i].x,points[i].y);if(pointDraft.hover)ctx.lineTo(pointDraft.hover.x,pointDraft.hover.y);ctx.stroke();for(const point of points){ctx.beginPath();ctx.arc(point.x,point.y,2.5/zoom,0,Math.PI*2);ctx.fill();}ctx.restore();}
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
  if (!layer || !isLayerVisible(doc, layer)) return;
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
  updateCanvasSize(); updateLayers(); updateHistory(); refreshInspectorPanels(); updateLayerControls(); render();
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
  if (targetGroup?.locked) return false;
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
  const membersByGroup = new Map();
  for (const layer of displayLayers) {
    if (!layer.groupId || !groupsById.has(layer.groupId)) continue;
    if (!membersByGroup.has(layer.groupId)) membersByGroup.set(layer.groupId, []);
    membersByGroup.get(layer.groupId).push(layer);
  }

  const appendLayerRow = (layer, { inGroup = false } = {}) => {
    const group = layer.groupId ? groupsById.get(layer.groupId) : null;
    const groupHidden = Boolean(group && group.visible === false);
    const groupLocked = Boolean(group?.locked);
    const effectiveLocked = isLayerLocked(doc, layer);
    const row = document.createElement('div');
    row.className = `layer-row${inGroup ? ' in-group' : ''}${groupHidden ? ' group-hidden' : ''}${groupLocked ? ' group-locked' : ''}${layer.id === doc.selectedLayerId ? ' selected' : ''}`;
    row.dataset.id = layer.id; row.setAttribute('role','option'); row.setAttribute('aria-selected', String(layer.id === doc.selectedLayerId));
    row.tabIndex = layer.id === doc.selectedLayerId ? 0 : -1;
    const eye = document.createElement('button'); eye.className = 'layer-eye'; eye.textContent = layer.visible ? '◉' : '○';
    eye.title = groupHidden ? 'Группа скрыта; переключить собственную видимость слоя' : layer.visible ? 'Скрыть' : 'Показать';
    eye.setAttribute('aria-label', eye.title);
    eye.onclick = (e) => { e.stopPropagation(); layer.visible = !layer.visible; commit(layer.visible ? 'Показать слой' : 'Скрыть слой'); };
    const thumb = document.createElement('div'); thumb.className = 'layer-thumb';
    if (layer.type === 'raster' && layer.dataUrl) { const img = new Image(); img.src = layer.dataUrl; thumb.append(img); }
    else thumb.textContent = layer.type === 'text' ? 'T' : layer.type === 'shape' ? '▭' : '▦';
    const name = document.createElement('div'); name.className = 'layer-name'; name.textContent = layer.name; name.title = layer.name;
    name.ondblclick = (e) => { e.stopPropagation(); renameLayer(layer); };
    const lock = document.createElement('button'); lock.className = 'layer-lock';
    lock.textContent = effectiveLocked ? '🔒' : '·';
    lock.title = groupLocked ? 'Слой заблокирован группой' : layer.locked ? 'Разблокировать' : 'Заблокировать';
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

  const appendGroupRow = (group, members) => {
    const row = document.createElement('div');
    row.className = `layer-group-row${group.visible === false ? ' group-hidden' : ''}${group.locked ? ' group-locked' : ''}`;
    row.dataset.groupId = group.id;
    row.tabIndex = 0;
    row.setAttribute('role','group');
    row.setAttribute('aria-label', `${group.name}, ${members.length} слоёв`);

    const eye = document.createElement('button');
    eye.className = 'layer-eye layer-group-eye';
    eye.textContent = group.visible === false ? '○' : '◉';
    eye.title = group.visible === false ? 'Показать группу' : 'Скрыть группу';
    eye.setAttribute('aria-label', eye.title);
    eye.onclick = e => {
      e.stopPropagation();
      group.visible = group.visible === false;
      commit(group.visible ? 'Показать группу слоёв' : 'Скрыть группу слоёв');
    };

    const toggle = document.createElement('button');