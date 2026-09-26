import { clamp, frameBounds } from '../core/geometry.js';
import { LAYER_STYLE_FIELDS, createLayerStyles, sanitizeLayerStyles } from '../core/layer-styles.js';
import { isLayerLocked } from '../core/state.js';
import { makeModalDraggable } from './modal-controller.js';

export function blendingPreviewCrop(documentValue, layer) {
  const scale = Math.max(Math.abs(layer.scaleX || 1), Math.abs(layer.scaleY || 1));
  const bounds = frameBounds(layer, Math.min(180 * scale, Math.max(documentValue.width, documentValue.height)));
  const width = Math.min(documentValue.width, Math.max(160, bounds.width));
  const height = Math.min(documentValue.height, Math.max(120, bounds.height));
  return {
    x: clamp(bounds.x + bounds.width / 2 - width / 2, 0, documentValue.width - width),
    y: clamp(bounds.y + bounds.height / 2 - height / 2, 0, documentValue.height - height),
    width,
    height,
  };
}

export function syncBlendingPreviewCanvas(preview, {
  documentValue,
  sourceCanvas,
  windowTarget = globalThis.window,
} = {}) {
  if (!preview || !documentValue || !sourceCanvas || preview.document !== documentValue ||
      !preview.canvas?.isConnected ||
      documentValue.layers?.find(item => item.id === preview.layer?.id) !== preview.layer ||
      sourceCanvas.width !== documentValue.width || sourceCanvas.height !== documentValue.height) return false;
  const canvas = preview.canvas;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 1 || height < 1) return false;
  const ratio = Math.min(windowTarget?.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const context = canvas.getContext('2d', { alpha:true });
  if (!context) return false;
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  const crop = preview.crop;
  const fit = Math.min(pixelWidth / crop.width, pixelHeight / crop.height);
  const drawnWidth = crop.width * fit;
  const drawnHeight = crop.height * fit;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height,
    (pixelWidth - drawnWidth) / 2, (pixelHeight - drawnHeight) / 2, drawnWidth, drawnHeight);
  return true;
}

export function createLayerBlendingSession({
  owner,
  layer,
  getDocument = () => owner,
  markTransientChange = () => {},
  updateLayerControls = () => {},
  render = () => {},
  commit = () => {},
} = {}) {
  if (!owner || !layer) throw new Error('Layer blending session requires an owner document and layer');
  const original = {
    blendMode: layer.blendMode || 'source-over',
    opacity: layer.opacity ?? 1,
    styles: layer.styles ? structuredClone(layer.styles) : null,
  };
  const originalStyles = sanitizeLayerStyles(original.styles) || createLayerStyles();
  const draft = {
    blendMode: original.blendMode,
    opacity: Math.round(original.opacity * 100),
    styles: structuredClone(originalStyles),
  };
  const ownerLayer = () => owner.layers?.find(item => item.id === layer.id) === layer ? layer : null;
  const isCurrent = () => getDocument() === owner && ownerLayer() === layer && !isLayerLocked(owner, layer);
  const publishTransient = () => {
    markTransientChange();
    updateLayerControls();
    render();
  };
  const assignOriginal = ({ publish = true } = {}) => {
    if (!ownerLayer()) return false;
    layer.blendMode = original.blendMode;
    layer.opacity = original.opacity;
    layer.styles = original.styles ? structuredClone(original.styles) : null;
    if (publish && getDocument() === owner) publishTransient();
    return true;
  };
  const assignDraft = () => {
    if (!isCurrent()) return false;
    layer.blendMode = draft.blendMode;
    layer.opacity = draft.opacity / 100;
    layer.styles = sanitizeLayerStyles(draft.styles);
    publishTransient();
    return true;
  };
  const styleChanged = () => JSON.stringify(draft.styles) !== JSON.stringify(originalStyles);
  const hasChanges = () => draft.blendMode !== original.blendMode ||
    draft.opacity !== Math.round(original.opacity * 100) || styleChanged();

  function preview(useDraft) {
    return useDraft ? assignDraft() : (isCurrent() ? assignOriginal() : false);
  }
  function cancel() {
    const valid = isCurrent();
    const restored = assignOriginal({ publish:getDocument() === owner });
    return { valid, changed:false, committed:false, restored };
  }
  function apply() {
    const valid = isCurrent();
    const changed = valid && hasChanges();
    if (!valid) {
      const restored = assignOriginal({ publish:getDocument() === owner });
      return { valid:false, changed:false, committed:false, restored };
    }
    if (!changed) {
      const restored = assignOriginal();
      return { valid:true, changed:false, committed:false, restored };
    }
    const stylesChanged = styleChanged();
    layer.blendMode = draft.blendMode;
    layer.opacity = draft.opacity / 100;
    layer.styles = stylesChanged || original.styles ? sanitizeLayerStyles(draft.styles) : null;
    commit('Параметры наложения слоя');
    return { valid:true, changed:true, committed:true, restored:false };
  }
  return { original, originalStyles, draft, isCurrent, preview, cancel, apply, hasChanges };
}

export function createLayerBlendingController({ state = {}, renderApi = {}, ui = {} } = {}) {
  const {
    getDocument = () => null,
    commit = () => {},
    markTransientChange = () => {},
    blockPendingDocumentEdit = () => false,
  } = state;
  const {
    render = () => {},
    updateLayerControls = () => {},
    getSourceCanvas = () => null,
  } = renderApi;
  const {
    modalRoot = null,
    blendControl = null,
    documentRef = globalThis.document,
    windowTarget = globalThis.window,
    ResizeObserverClass = globalThis.ResizeObserver,
    HTMLElementClass = globalThis.HTMLElement,
    setStatus = () => {},
    escapeHtml = value => String(value ?? ''),
  } = ui;
  let activePreview = null;

  function syncPreviewCanvas() {
    return syncBlendingPreviewCanvas(activePreview, {
      documentValue:getDocument(),
      sourceCanvas:getSourceCanvas(),
      windowTarget,
    });
  }

  function openBlendingOptions(layer) {
    const documentValue = getDocument();
    if (!layer || isLayerLocked(documentValue, layer) || blockPendingDocumentEdit()) return false;
    if (!documentValue?.layers?.some(item => item.id === layer.id && item === layer)) return false;
    if (!modalRoot || !documentRef) throw new Error('Layer blending controller requires modal DOM capabilities');

    const session = createLayerBlendingSession({
      owner:documentValue, layer, getDocument, markTransientChange, updateLayerControls, render, commit,
    });
    const { draft } = session;
    const previousFocus = documentRef.activeElement;
    const back = documentRef.createElement('div');
    back.className = 'modal-backdrop';
    const modal = documentRef.createElement('form');
    modal.className = 'modal blending-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Параметры наложения');
    modal.innerHTML = `<header>Параметры наложения</header><div class="blending-layout"><nav class="blending-list" aria-label="Стили слоя"></nav><div class="blending-details"><p class="muted blending-hint">Слой: ${escapeHtml(layer.name)}</p><div class="blending-fields"></div><section class="blending-canvas-preview" aria-label="Предпросмотр слоя на холсте"><strong>На холсте</strong><canvas aria-label="Фрагмент холста вокруг слоя"></canvas></section></div></div><footer><label class="blending-preview"><input type="checkbox" checked> Предпросмотр</label><span class="modal-footer-spacer"></span><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">Применить</button></footer>`;
    const list = modal.querySelector('.blending-list');
    const fields = modal.querySelector('.blending-fields');
    const previewCanvas = modal.querySelector('.blending-canvas-preview canvas');
    const previewToggle = modal.querySelector('.blending-preview input');
    const names = {
      size:'Размер, px', strength:'Сила', angle:'Угол, °', distance:'Смещение, px',
      blur:'Размытие, px', color:'Цвет', color1:'Начальный цвет', color2:'Конечный цвет',
      opacity:'Непрозрачность', pattern:'Узор', scale:'Шаг, px',
    };
    let selectedStyle = 'general';
    let closed = false;
    const preview = () => session.preview(previewToggle.checked);

    const addRange = (parent, label, value, min, max, onChange) => {
      const row = documentRef.createElement('label'); row.className = 'blending-field';
      const caption = documentRef.createElement('span'); caption.textContent = label;
      const control = documentRef.createElement('input');
      control.type = 'range'; control.min = String(min); control.max = String(max); control.step = '1'; control.value = String(value);
      const output = documentRef.createElement('output');
      output.textContent = `${value}${label.includes('px') ? ' px' : label.includes('°') ? '°' : '%'}`;
      control.addEventListener('input', () => {
        output.textContent = `${control.value}${label.includes('px') ? ' px' : label.includes('°') ? '°' : '%'}`;
        onChange(Number(control.value)); preview();
      });
      row.append(caption, control, output); parent.append(row);
    };
    const addColor = (parent, label, value, onChange) => {
      const row = documentRef.createElement('label'); row.className = 'blending-field';
      const caption = documentRef.createElement('span'); caption.textContent = label;
      const control = documentRef.createElement('input'); control.type = 'color'; control.value = value;
      control.addEventListener('input', () => { onChange(control.value); preview(); });
      row.append(caption, control); parent.append(row);
    };
    const showFields = () => {
      fields.replaceChildren();
      for (const button of list.querySelectorAll('.blending-style-select')) {
        button.classList.toggle('active', button.dataset.style === selectedStyle);
      }
      if (selectedStyle === 'general') {
        const modeRow = documentRef.createElement('label'); modeRow.className = 'blending-field';
        const caption = documentRef.createElement('span'); caption.textContent = 'Режим наложения';
        const mode = documentRef.createElement('select');
        for (const option of blendControl?.options || []) mode.append(option.cloneNode(true));
        mode.value = draft.blendMode;
        mode.addEventListener('change', () => { draft.blendMode = mode.value; preview(); });
        modeRow.append(caption, mode); fields.append(modeRow);
        addRange(fields, 'Непрозрачность', draft.opacity, 0, 100, value => { draft.opacity = value; });
        addRange(fields, 'Непрозрачность заливки', draft.styles.fillOpacity, 0, 100, value => { draft.styles.fillOpacity = value; });
        const hint = documentRef.createElement('p'); hint.className = 'muted blending-note';
        hint.textContent = 'Непрозрачность заливки меняет содержимое слоя, сохраняя видимость включённых стилей.';
        fields.append(hint);
        return;
      }
      const item = draft.styles[selectedStyle];
      const title = documentRef.createElement('h3'); title.textContent = LAYER_STYLE_FIELDS[selectedStyle].label; fields.append(title);
      for (const [key, rule] of Object.entries(LAYER_STYLE_FIELDS[selectedStyle].fields)) {
        if (rule[0] === 'range') addRange(fields, names[key], item[key], rule[1], rule[2], value => { item[key] = value; });
        else if (rule[0] === 'color') addColor(fields, names[key], item[key], value => { item[key] = value; });
        else {
          const row = documentRef.createElement('label'); row.className = 'blending-field';
          const caption = documentRef.createElement('span'); caption.textContent = names[key];
          const select = documentRef.createElement('select');
          for (const [value, text] of [['stripes','Полосы'],['dots','Точки'],['checker','Шахматный']]) {
            const option = documentRef.createElement('option'); option.value = value; option.textContent = text; select.append(option);
          }
          select.value = item[key];
          select.addEventListener('change', () => { item[key] = select.value; preview(); });
          row.append(caption, select); fields.append(row);
        }
      }
    };
    const addChoice = (key, label) => {
      const row = documentRef.createElement('div'); row.className = 'blending-style-row';
      if (key !== 'general') {
        const toggle = documentRef.createElement('input'); toggle.type = 'checkbox'; toggle.checked = draft.styles[key].enabled;
        toggle.setAttribute('aria-label', `Включить: ${label}`);
        toggle.addEventListener('change', () => { draft.styles[key].enabled = toggle.checked; preview(); });
        row.append(toggle);
      }
      const button = documentRef.createElement('button'); button.type = 'button'; button.className = 'blending-style-select';
      button.dataset.style = key; button.textContent = label;
      button.addEventListener('click', () => { selectedStyle = key; showFields(); });
      row.append(button); list.append(row);
    };

    addChoice('general', 'Общие параметры');
    for (const [key, spec] of Object.entries(LAYER_STYLE_FIELDS)) addChoice(key, spec.label);
    showFields();

    const finish = (apply = false) => {
      if (closed) return;
      closed = true;
      modal.previewCleanup?.();
      if (activePreview?.canvas === previewCanvas) activePreview = null;
      const outcome = apply ? session.apply() : session.cancel();
      modalRoot.replaceChildren();
      if (HTMLElementClass && previousFocus instanceof HTMLElementClass && previousFocus.isConnected) previousFocus.focus();
      setStatus(apply && outcome.valid && outcome.changed ? 'Параметры наложения применены' : 'Параметры наложения без изменений');
    };
    previewToggle.addEventListener('change', preview);
    modal.querySelector('[data-cancel]').onclick = () => finish();
    back.addEventListener('mousedown', event => { if (event.target === back) finish(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); }
    });
    modal.addEventListener('submit', event => { event.preventDefault(); finish(true); });
    back.append(modal); modalRoot.replaceChildren(back);
    makeModalDraggable(modal, { windowTarget, ResizeObserverClass });
    activePreview = { document:documentValue, layer, canvas:previewCanvas, crop:blendingPreviewCrop(documentValue, layer) };
    const previewObserver = typeof ResizeObserverClass === 'function' ? new ResizeObserverClass(syncPreviewCanvas) : null;
    previewObserver?.observe(previewCanvas);
    const priorCleanup = modal.previewCleanup;
    modal.previewCleanup = () => { previewObserver?.disconnect(); priorCleanup?.(); };
    syncPreviewCanvas();
    list.querySelector('button')?.focus();
    return true;
  }
  return { openBlendingOptions, syncPreviewCanvas };
}
