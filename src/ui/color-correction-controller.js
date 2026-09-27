import { COLOR_CORRECTION_CONTROLS } from './tool-config.js';
import {
  DEFAULT_LAYER_FILTERS,
  FILTER_RANGES,
  sanitizeFilters,
  isLayerLocked,
} from '../core/state.js';

const COLOR_CORRECTION_CONTROL_BY_KEY = new Map(COLOR_CORRECTION_CONTROLS.map(control => [control.key, control]));
const COLOR_CORRECTION_EPSILON = 1e-9;

function colorCorrectionNumbersEqual(left, right) {
  return Math.abs(Number(left) - Number(right)) < COLOR_CORRECTION_EPSILON;
}

function colorCorrectionFiltersEqual(left, right) {
  return COLOR_CORRECTION_CONTROLS.every(control => colorCorrectionNumbersEqual(
    left?.[control.key] ?? DEFAULT_LAYER_FILTERS[control.key],
    right?.[control.key] ?? DEFAULT_LAYER_FILTERS[control.key],
  ));
}

function normalizeColorCorrectionValue(control, raw) {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  const [safeMin, safeMax] = FILTER_RANGES[control.key] ?? [control.min, control.max];
  const minimum = Math.max(Number(control.min), safeMin);
  const maximum = Math.min(Number(control.max), safeMax);
  return Math.min(maximum, Math.max(minimum, numeric));
}

function colorCorrectionRejectionMessage(reason) {
  if (reason === 'locked') return 'Слой или его группа заблокированы';
  if (reason === 'missing-target') return 'Слой цветокоррекции больше недоступен';
  if (reason === 'stale-document') return 'Цветокоррекция отменена после смены документа';
  if (reason === 'invalid-value') return 'Некорректное значение цветокоррекции';
  return 'Цветокоррекция не может быть применена';
}

export function createColorCorrectionSession({
  owner,
  layerId,
  getDocument = () => owner,
  markTransientChange = () => {},
  render = () => {},
  refreshInspectorPanels = () => {},
  commit = () => {},
} = {}) {
  if (!owner || !layerId) throw new TypeError('Color correction session requires an owner document and layer id');
  const initialLayer = owner.layers?.find(layer => layer.id === layerId) ?? null;
  if (!initialLayer || initialLayer.type !== 'raster') {
    throw new TypeError('Color correction session requires an exact raster layer');
  }

  const identity = initialLayer;
  const original = sanitizeFilters(initialLayer.filters);
  const draft = { ...original };

  function exactLayer() {
    const current = owner.layers?.find(layer => layer.id === layerId) ?? null;
    return current === identity ? current : null;
  }

  function publicationState() {
    if (getDocument() !== owner) return { valid:false, reason:'stale-document', target:exactLayer() };
    const target = exactLayer();
    if (!target || target.type !== 'raster') return { valid:false, reason:'missing-target', target:null };
    if (isLayerLocked(owner, target)) return { valid:false, reason:'locked', target };
    return { valid:true, reason:null, target };
  }

  function publishTransient(target, nextFilters) {
    const normalized = sanitizeFilters(nextFilters);
    if (colorCorrectionFiltersEqual(target.filters, normalized)) return false;
    target.filters = normalized;
    markTransientChange();
    render();
    return true;
  }

  function restore({ publish = getDocument() === owner } = {}) {
    const target = exactLayer();
    if (!target) return false;
    const changed = !colorCorrectionFiltersEqual(target.filters, original);
    if (changed) target.filters = { ...original };
    if (changed && publish) {
      markTransientChange();
      render();
      refreshInspectorPanels();
    }
    return changed;
  }

  function preview(key, raw) {
    const control = COLOR_CORRECTION_CONTROL_BY_KEY.get(key);
    if (!control) return { valid:false, changed:false, reason:'invalid-value', value:null };
    const value = normalizeColorCorrectionValue(control, raw);
    if (value === null) return { valid:false, changed:false, reason:'invalid-value', value:draft[key] };
    const state = publicationState();
    if (!state.valid) return { valid:false, changed:false, reason:state.reason, value:draft[key] };
    if (colorCorrectionNumbersEqual(draft[key], value) && colorCorrectionNumbersEqual(state.target.filters?.[key], value)) {
      return { valid:true, changed:false, reason:null, value };
    }
    draft[key] = value;
    const changed = publishTransient(state.target, draft);
    return { valid:true, changed, reason:null, value };
  }

  function reset() {
    const state = publicationState();
    if (!state.valid) return { valid:false, changed:false, reason:state.reason };
    for (const control of COLOR_CORRECTION_CONTROLS) {
      draft[control.key] = normalizeColorCorrectionValue(control, DEFAULT_LAYER_FILTERS[control.key]);
    }
    const changed = publishTransient(state.target, draft);
    return { valid:true, changed, reason:null };
  }

  function cancel() {
    const state = publicationState();
    const restored = restore({ publish:getDocument() === owner });
    return { valid:state.valid, changed:false, committed:false, restored, reason:state.reason };
  }

  function apply() {
    const state = publicationState();
    if (!state.valid) {
      const restored = restore({ publish:getDocument() === owner });
      return { valid:false, changed:false, committed:false, restored, reason:state.reason };
    }
    const changed = !colorCorrectionFiltersEqual(draft, original);
    if (!changed) {
      const restored = restore();
      return { valid:true, changed:false, committed:false, restored, reason:null };
    }
    state.target.filters = sanitizeFilters(draft);
    commit('Цветокоррекция слоя');
    return { valid:true, changed:true, committed:true, restored:false, reason:null };
  }

  return { draft, exactLayer, publicationState, preview, reset, cancel, apply };
}

export function createColorCorrectionModalFinalizer({
  session,
  closeModal = () => {},
  restoreFocus = () => {},
  setStatus = () => {},
  toast = () => {},
} = {}) {
  if (!session) throw new TypeError('Color correction modal finalizer requires a session');
  let closed = false;

  function closeOnce() {
    if (closed) return false;
    closed = true;
    closeModal();
    restoreFocus();
    return true;
  }

  function cancel(reason = null) {
    if (closed) return null;
    const outcome = session.cancel();
    closeOnce();
    const rejection = reason || outcome.reason;
    if (rejection && rejection !== 'stale-document') toast(colorCorrectionRejectionMessage(rejection), 'warn');
    setStatus(rejection ? colorCorrectionRejectionMessage(rejection) : 'Цветокоррекция отменена');
    return outcome;
  }

  function apply() {
    if (closed) return null;
    const outcome = session.apply();
    closeOnce();
    if (!outcome.valid) {
      const message = colorCorrectionRejectionMessage(outcome.reason);
      toast(message, 'warn');
      setStatus(message);
    } else if (outcome.changed) {
      setStatus('Цветокоррекция применена');
    } else {
      setStatus('Цветокоррекция без изменений');
    }
    return outcome;
  }

  return { cancel, apply, isClosed:() => closed };
}

export function createColorCorrectionController({ state = {}, transaction = {}, rendering = {}, ui = {} } = {}) {
  const { getDocument = () => null } = state;
  const { commit = () => {}, markTransientChange = () => {} } = transaction;
  const { render = () => {}, refreshInspectorPanels = () => {} } = rendering;
  const {
    modalRoot = null,
    documentRef = globalThis.document,
    HTMLElementClass = globalThis.HTMLElement,
    setStatus = () => {},
    toast = () => {},
    formatFilterValue = (_key, value) => String(value),
  } = ui;

  function rejectOpen(message, { status = message } = {}) {
    toast(message, 'warn');
    setStatus(status);
    return false;
  }

  function open(layer) {
    const owner = getDocument();
    if (!owner || !layer || owner.layers?.find(item => item.id === layer.id) !== layer || layer.type !== 'raster') {
      return rejectOpen('Цветокоррекция доступна для растрового слоя', { status:'Выберите растровый слой' });
    }
    if (isLayerLocked(owner, layer)) return rejectOpen('Слой или его группа заблокированы');
    if (!modalRoot || !documentRef) throw new Error('Color correction controller requires modal DOM capabilities');

    const session = createColorCorrectionSession({
      owner,
      layerId:layer.id,
      getDocument,
      markTransientChange,
      render,
      refreshInspectorPanels,
      commit,
    });
    const previousFocus = documentRef.activeElement;
    const back = documentRef.createElement('div');
    back.className = 'modal-backdrop';
    const modal = documentRef.createElement('form');
    modal.className = 'modal color-correction-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Цветокоррекция');
    modal.innerHTML = '<header>Цветокоррекция</header><div class="modal-body color-correction-body"><p class="muted color-correction-hint">Настройки применяются неразрушающе к выбранному растровому слою. Изменения сразу видны на холсте.</p></div><footer><button type="button" class="secondary-button" data-reset>Сбросить</button><span class="modal-footer-spacer"></span><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">Применить</button></footer>';
    const body = modal.querySelector('.color-correction-body');
    const controlNodes = new Map();
    let currentGroup = '';

    for (const control of COLOR_CORRECTION_CONTROLS) {
      if (control.group !== currentGroup) {
        currentGroup = control.group;
        const heading = documentRef.createElement('div');
        heading.className = 'color-correction-group';
        heading.textContent = currentGroup;
        body.append(heading);
      }
      const row = documentRef.createElement('label');
      row.className = 'color-correction-row';
      const label = documentRef.createElement('span');
      label.textContent = control.label;
      const input = documentRef.createElement('input');
      input.type = 'range';
      input.name = control.key;
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step);
      input.value = String(session.draft[control.key]);
      const output = documentRef.createElement('output');
      output.value = formatFilterValue(control.key, input.value);
      output.textContent = output.value;
      row.append(label, input, output);
      body.append(row);
      controlNodes.set(control.key, { input, output });
    }

    const restoreFocus = () => {
      if (HTMLElementClass && previousFocus instanceof HTMLElementClass && previousFocus.isConnected) previousFocus.focus();
    };
    const finalizer = createColorCorrectionModalFinalizer({
      session,
      closeModal:() => modalRoot.replaceChildren(),
      restoreFocus,
      setStatus,
      toast,
    });

    function cancelForInvalidState(reason) {
      finalizer.cancel(reason);
    }

    for (const control of COLOR_CORRECTION_CONTROLS) {
      const { input, output } = controlNodes.get(control.key);
      input.addEventListener('input', () => {
        const outcome = session.preview(control.key, input.value);
        if (!outcome.valid) {
          if (outcome.reason === 'invalid-value') {
            input.value = String(outcome.value ?? session.draft[control.key]);
            output.value = formatFilterValue(control.key, input.value);
            output.textContent = output.value;
            toast(colorCorrectionRejectionMessage(outcome.reason), 'warn');
            return;
          }
          cancelForInvalidState(outcome.reason);
          return;
        }
        input.value = String(outcome.value);
        output.value = formatFilterValue(control.key, outcome.value);
        output.textContent = output.value;
      });
    }

    modal.querySelector('[data-reset]').addEventListener('click', () => {
      const outcome = session.reset();
      if (!outcome.valid) {
        cancelForInvalidState(outcome.reason);
        return;
      }
      for (const control of COLOR_CORRECTION_CONTROLS) {
        const { input, output } = controlNodes.get(control.key);
        input.value = String(session.draft[control.key]);
        output.value = formatFilterValue(control.key, input.value);
        output.textContent = output.value;
      }
    });
    modal.querySelector('[data-cancel]').addEventListener('click', () => finalizer.cancel());
    back.addEventListener('mousedown', event => { if (event.target === back) finalizer.cancel(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finalizer.cancel();
      }
    });
    modal.addEventListener('submit', event => {
      event.preventDefault();
      finalizer.apply();
    });
    back.append(modal);
    modalRoot.replaceChildren(back);
    modal.querySelector('input[type="range"]')?.focus();
    return true;
  }

  return { open };
}
