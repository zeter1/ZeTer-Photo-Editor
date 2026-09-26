import { clamp } from '../core/geometry.js';
import {
  createSmartFilter,
  createSmartFilterMask,
  DEFAULT_LAYER_FILTERS,
  FILTER_RANGES,
  MAX_SMART_FILTERS,
  isLayerLocked,
} from '../core/state.js';
import { RASTER_EFFECT_CONTROLS } from './tool-config.js';

export function createSmartFilterController({
  state = {},
  selection = {},
  renderApi = {},
  ui = {},
} = {}) {
  const {
    getDocument = () => null,
    getSelectedLayer = () => null,
    commit = () => {},
    markDirty = () => {},
    blockPendingDocumentEdit = () => false,
  } = state;
  const {
    getSelectionShape = () => null,
    selectionMaskDataUrl = async () => null,
  } = selection;
  const {
    render = () => {},
    refreshInspectorPanels = () => {},
  } = renderApi;
  const {
    modalRoot = null,
    documentRef = globalThis.document,
    setStatus = () => {},
    toast = () => {},
    escapeHtml = value => String(value ?? ''),
    formatFilterValue = (_key, value) => String(value ?? ''),
  } = ui;

  function smartFilterTarget(owner, layerId) {
    const documentValue = getDocument();
    if (documentValue !== owner) return null;
    return documentValue?.layers?.find(item => item.id === layerId && item.type === 'smart-object') || null;
  }

  function smartFilterDefaultName(layer) {
    const count = Array.isArray(layer?.smartFilters) ? layer.smartFilters.length : 0;
    return 'Смарт-фильтр ' + (count + 1);
  }

  function hasSmartFilterCapacity(layer) {
    return (Array.isArray(layer?.smartFilters) ? layer.smartFilters.length : 0) < MAX_SMART_FILTERS;
  }

  function smartFilterMaskMarkup(layer) {
    const stack = Array.isArray(layer?.smartFilters) ? layer.smartFilters : [];
    if (!stack.length) return '';
    const mask = layer?.smartFilterMask;
    const selectionDisabled = getSelectionShape() ? '' : ' disabled';
    if (!mask) {
      return '<div class="smart-filter-mask"><div class="smart-filter-mask-title"><strong>Маска смарт-фильтров</strong><span>нет</span></div><div class="smart-filter-mask-actions"><button type="button" class="mini-button" data-smart-filter-mask-show>Показать всё</button><button type="button" class="mini-button" data-smart-filter-mask-selection' + selectionDisabled + '>Из выделения</button></div></div>';
    }
    const density = Math.round(Math.max(0, Math.min(1, Number(mask.density ?? 1))) * 100);
    const feather = Math.max(0, Math.min(250, Number(mask.feather) || 0));
    return '<div class="smart-filter-mask' + (mask.enabled === false ? ' is-disabled' : '') + '"><div class="smart-filter-mask-title"><strong>Маска смарт-фильтров</strong><span>' + (mask.dataUrl ? 'растровая' : 'показать всё') + '</span></div><div class="smart-filter-mask-actions"><button type="button" class="mini-button" data-smart-filter-mask-toggle>' + (mask.enabled === false ? 'Включить' : 'Отключить') + '</button><button type="button" class="mini-button" data-smart-filter-mask-invert>' + (mask.invert ? 'Не инвертировать' : 'Инвертировать') + '</button><button type="button" class="mini-button" data-smart-filter-mask-selection' + selectionDisabled + '>Из выделения</button><button type="button" class="mini-button" data-smart-filter-mask-remove>Удалить</button></div><label class="smart-filter-mask-range"><span>Плотность</span><input type="range" min="0" max="100" step="1" value="' + density + '" data-smart-filter-mask-density><output>' + density + '%</output></label><label class="smart-filter-mask-range"><span>Растушёвка</span><input type="range" min="0" max="250" step="0.5" value="' + feather + '" data-smart-filter-mask-feather><output>' + feather + ' px</output></label></div>';
  }

  function smartFilterStackMarkup(layer) {
    const stack = Array.isArray(layer?.smartFilters) ? layer.smartFilters : [];
    const rows = stack.map((item, index) =>
      '<div class="smart-filter-row' + (item.enabled === false ? ' is-disabled' : '') + '">' +
        '<button type="button" class="smart-filter-toggle" data-smart-filter-toggle="' + index + '" title="' + (item.enabled === false ? 'Включить' : 'Отключить') + ' смарт-фильтр" aria-label="' + (item.enabled === false ? 'Включить' : 'Отключить') + ' смарт-фильтр">' + (item.enabled === false ? '○' : '◉') + '</button>' +
        '<button type="button" class="smart-filter-name" data-smart-filter-edit="' + index + '" title="Редактировать смарт-фильтр">' + escapeHtml(item.name || smartFilterDefaultName({ smartFilters:stack.slice(0, index) })) + '</button>' +
        '<button type="button" class="smart-filter-order" data-smart-filter-up="' + index + '" title="Выше" aria-label="Переместить смарт-фильтр выше"' + (index === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="smart-filter-order" data-smart-filter-down="' + index + '" title="Ниже" aria-label="Переместить смарт-фильтр ниже"' + (index === stack.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="smart-filter-remove" data-smart-filter-remove="' + index + '" title="Удалить" aria-label="Удалить смарт-фильтр">×</button>' +
      '</div>'
    ).join('');
    return '<div class="wide smart-filter-stack">' +
      '<div class="smart-filter-heading"><strong>Смарт-фильтры</strong><span>верхние применяются последними</span></div>' +
      smartFilterMaskMarkup(layer) +
      (rows || '<div class="smart-filter-empty">Нет смарт-фильтров</div>') +
      '<div class="smart-filter-actions">' +
        '<button type="button" class="mini-button" data-smart-filter-add>+ Добавить</button>' +
        '<button type="button" class="mini-button" data-smart-filter-clear' + (stack.length ? '' : ' disabled') + '>Очистить</button>' +
      '</div>' +
    '</div>';
  }

  function moveSmartFilter(layer, index, direction) {
    const documentValue = getDocument();
    if (!layer || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer)) return false;
    const stack = Array.isArray(layer.smartFilters) ? layer.smartFilters : [];
    const target = index + direction;
    if (index < 0 || index >= stack.length || target < 0 || target >= stack.length) return false;
    [stack[index], stack[target]] = [stack[target], stack[index]];
    commit(direction < 0 ? 'Поднять смарт-фильтр' : 'Опустить смарт-фильтр');
    return true;
  }

  function toggleSmartFilter(layer, index) {
    const documentValue = getDocument();
    if (!layer || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer)) return false;
    const item = layer.smartFilters?.[index];
    if (!item) return false;
    item.enabled = item.enabled === false;
    commit(item.enabled ? 'Включить смарт-фильтр' : 'Отключить смарт-фильтр');
    return true;
  }

  function removeSmartFilter(layer, index) {
    const documentValue = getDocument();
    if (!layer || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer)) return false;
    if (!Array.isArray(layer.smartFilters) || index < 0 || index >= layer.smartFilters.length) return false;
    layer.smartFilters.splice(index, 1);
    if (!layer.smartFilters.length) layer.smartFilterMask = null;
    commit('Удалить смарт-фильтр');
    return true;
  }

  function clearSmartFilters(layer = getSelectedLayer()) {
    const documentValue = getDocument();
    if (!layer || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer) || !layer.smartFilters?.length) return false;
    layer.smartFilters = [];
    layer.smartFilterMask = null;
    commit('Очистить смарт-фильтры');
    return true;
  }

  async function setSmartFilterMask(layer = getSelectedLayer(), fromSelection = false) {
    if (blockPendingDocumentEdit()) return false;
    const owner = getDocument();
    if (!layer || layer.type !== 'smart-object') {
      setStatus('Маска смарт-фильтров доступна только для смарт-объекта');
      return false;
    }
    if (isLayerLocked(owner, layer)) {
      setStatus('Смарт-объект или его группа заблокированы');
      return false;
    }
    if (!layer.smartFilters?.length) {
      setStatus('Сначала добавьте хотя бы один смарт-фильтр');
      return false;
    }
    if (fromSelection && !getSelectionShape()) {
      setStatus('Сначала создайте выделение');
      return false;
    }
    const layerId = layer.id;
    const dataUrl = fromSelection ? await selectionMaskDataUrl(layer) : null;
    const target = smartFilterTarget(owner, layerId);
    if (!target || isLayerLocked(owner, target)) return false;
    target.smartFilterMask = createSmartFilterMask({ enabled:true, dataUrl });
    commit(fromSelection ? 'Маска смарт-фильтров из выделения' : 'Маска смарт-фильтров: показать всё');
    return true;
  }

  function toggleSmartFilterMask(layer = getSelectedLayer()) {
    const documentValue = getDocument();
    if (!layer?.smartFilterMask || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer)) return false;
    layer.smartFilterMask.enabled = layer.smartFilterMask.enabled === false;
    commit(layer.smartFilterMask.enabled ? 'Включить маску смарт-фильтров' : 'Отключить маску смарт-фильтров');
    return true;
  }

  function invertSmartFilterMask(layer = getSelectedLayer()) {
    const documentValue = getDocument();
    if (!layer?.smartFilterMask || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer)) return false;
    layer.smartFilterMask.invert = !layer.smartFilterMask.invert;
    commit(layer.smartFilterMask.invert ? 'Инвертировать маску смарт-фильтров' : 'Снять инверсию маски смарт-фильтров');
    return true;
  }

  function removeSmartFilterMask(layer = getSelectedLayer()) {
    const documentValue = getDocument();
    if (!layer?.smartFilterMask || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer)) return false;
    layer.smartFilterMask = null;
    commit('Удалить маску смарт-фильтров');
    return true;
  }

  function updateSmartFilterMaskSetting(layer, key, raw, shouldCommit = true) {
    const documentValue = getDocument();
    if (!layer?.smartFilterMask || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer)) return false;
    let value = Number(raw);
    if (!Number.isFinite(value)) return false;
    if (key === 'density') value = clamp(value, 0, 1);
    else if (key === 'feather') value = clamp(value, 0, 250);
    else return false;
    layer.smartFilterMask[key] = value;
    markDirty(true);
    if (shouldCommit) commit(key === 'density' ? 'Изменить плотность маски смарт-фильтров' : 'Изменить растушёвку маски смарт-фильтров');
    else render();
    return true;
  }

  function bindSmartFilterControls(root, layer) {
    root?.querySelector('[data-smart-filter-add]')?.addEventListener('click', () => openSmartFilterDialog(layer));
    root?.querySelector('[data-smart-filter-clear]')?.addEventListener('click', () => clearSmartFilters(layer));
    root?.querySelector('[data-smart-filter-mask-show]')?.addEventListener('click', () => { void setSmartFilterMask(layer, false); });
    root?.querySelector('[data-smart-filter-mask-selection]')?.addEventListener('click', () => { void setSmartFilterMask(layer, true); });
    root?.querySelector('[data-smart-filter-mask-toggle]')?.addEventListener('click', () => toggleSmartFilterMask(layer));
    root?.querySelector('[data-smart-filter-mask-invert]')?.addEventListener('click', () => invertSmartFilterMask(layer));
    root?.querySelector('[data-smart-filter-mask-remove]')?.addEventListener('click', () => removeSmartFilterMask(layer));
    const density = root?.querySelector('[data-smart-filter-mask-density]');
    if (density) {
      const output = density.closest('.smart-filter-mask-range')?.querySelector('output');
      density.addEventListener('input', () => {
        if (output) output.textContent = density.value + '%';
        updateSmartFilterMaskSetting(layer, 'density', Number(density.value) / 100, false);
      });
      density.addEventListener('change', () => updateSmartFilterMaskSetting(layer, 'density', Number(density.value) / 100, true));
    }
    const feather = root?.querySelector('[data-smart-filter-mask-feather]');
    if (feather) {
      const output = feather.closest('.smart-filter-mask-range')?.querySelector('output');
      feather.addEventListener('input', () => {
        if (output) output.textContent = feather.value + ' px';
        updateSmartFilterMaskSetting(layer, 'feather', feather.value, false);
      });
      feather.addEventListener('change', () => updateSmartFilterMaskSetting(layer, 'feather', feather.value, true));
    }
    root?.querySelectorAll('[data-smart-filter-edit]').forEach(button => button.addEventListener('click', () => openSmartFilterDialog(layer, Number(button.dataset.smartFilterEdit))));
    root?.querySelectorAll('[data-smart-filter-toggle]').forEach(button => button.addEventListener('click', () => toggleSmartFilter(layer, Number(button.dataset.smartFilterToggle))));
    root?.querySelectorAll('[data-smart-filter-up]').forEach(button => button.addEventListener('click', () => moveSmartFilter(layer, Number(button.dataset.smartFilterUp), -1)));
    root?.querySelectorAll('[data-smart-filter-down]').forEach(button => button.addEventListener('click', () => moveSmartFilter(layer, Number(button.dataset.smartFilterDown), 1)));
    root?.querySelectorAll('[data-smart-filter-remove]').forEach(button => button.addEventListener('click', () => removeSmartFilter(layer, Number(button.dataset.smartFilterRemove))));
  }

  function openSmartFilterDialog(layer = getSelectedLayer(), index = -1) {
    if (blockPendingDocumentEdit()) return;
    const owner = getDocument();
    if (!layer || layer.type !== 'smart-object') {
      setStatus('Смарт-фильтры доступны только для смарт-объектов');
      return;
    }
    if (isLayerLocked(owner, layer)) {
      setStatus('Смарт-объект или его группа заблокированы');
      return;
    }
    const layerId = layer.id;
    const original = structuredClone(layer.smartFilters || []);
    if (index < 0 && !hasSmartFilterCapacity(layer)) {
      const message = 'Достигнут лимит: ' + MAX_SMART_FILTERS + ' смарт-фильтра';
      setStatus(message);
      toast(message, 'warn');
      return;
    }
    layer.smartFilters = structuredClone(original);
    let targetIndex = index;
    if (targetIndex < 0) {
      layer.smartFilters.unshift(createSmartFilter({ name:smartFilterDefaultName(layer) }));
      targetIndex = 0;
    }
    if (!layer.smartFilters[targetIndex]) return;
    const filterId = layer.smartFilters[targetIndex].id;
    const isNew = index < 0;
    const previousFocus = documentRef?.activeElement;
    const back = documentRef.createElement('div');
    back.className = 'modal-backdrop';
    const modal = documentRef.createElement('form');
    modal.className = 'modal smart-filter-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', isNew ? 'Добавить смарт-фильтр' : 'Редактировать смарт-фильтр');
    modal.innerHTML = '<header>' + (isNew ? 'Добавить смарт-фильтр' : 'Редактировать смарт-фильтр') + '</header><div class="modal-body smart-filter-body"><p class="muted smart-filter-hint">Изменения показываются на холсте сразу. Фильтры в списке применяются снизу вверх; верхний получает результат нижних.</p></div><footer><button type="button" class="secondary-button" data-reset>Сбросить</button><span class="modal-footer-spacer"></span><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">Применить</button></footer>';
    const body = modal.querySelector('.smart-filter-body');
    const nameRow = documentRef.createElement('label');
    nameRow.className = 'smart-filter-dialog-name';
    const nameLabel = documentRef.createElement('span');
    nameLabel.textContent = 'Название';
    const nameInput = documentRef.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 160;
    nameInput.value = layer.smartFilters[targetIndex].name || smartFilterDefaultName(layer);
    nameRow.append(nameLabel, nameInput);
    body.append(nameRow);

    let currentGroup = '';
    for (const control of RASTER_EFFECT_CONTROLS) {
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
      input.value = String(layer.smartFilters[targetIndex].filters?.[control.key] ?? DEFAULT_LAYER_FILTERS[control.key]);
      const output = documentRef.createElement('output');
      output.value = formatFilterValue(control.key, input.value);
      output.textContent = output.value;
      row.append(label, input, output);
      body.append(row);
      input.addEventListener('input', () => {
        const target = smartFilterTarget(owner, layerId);
        const item = target?.smartFilters?.find(entry => entry.id === filterId);
        if (!item) return;
        const [min, max] = FILTER_RANGES[control.key] || [control.min, control.max];
        const value = clamp(Number(input.value), min, max);
        item.filters[control.key] = value;
        output.value = formatFilterValue(control.key, value);
        output.textContent = output.value;
        render();
      });
    }

    const liveItem = () => smartFilterTarget(owner, layerId)?.smartFilters?.find(entry => entry.id === filterId) || null;
    nameInput.addEventListener('input', () => {
      const item = liveItem();
      if (item) item.name = nameInput.value.slice(0, 160);
    });
    const close = () => {
      modalRoot?.replaceChildren();
      const HTMLElementCtor = documentRef?.defaultView?.HTMLElement ?? globalThis.HTMLElement;
      if (HTMLElementCtor ? previousFocus instanceof HTMLElementCtor : typeof previousFocus?.focus === 'function') previousFocus.focus();
    };
    const restore = () => {
      const target = smartFilterTarget(owner, layerId);
      if (target) {
        target.smartFilters = structuredClone(original);
        render();
        refreshInspectorPanels();
      }
    };
    back.append(modal);
    modalRoot?.replaceChildren(back);
    render();

    modal.querySelector('[data-reset]').addEventListener('click', () => {
      const HTMLInputElementCtor = documentRef?.defaultView?.HTMLInputElement ?? globalThis.HTMLInputElement;
      const EventCtor = documentRef?.defaultView?.Event ?? globalThis.Event;
      for (const control of RASTER_EFFECT_CONTROLS) {
        const input = modal.elements.namedItem(control.key);
        if (HTMLInputElementCtor ? !(input instanceof HTMLInputElementCtor) : !input || !('value' in input)) continue;
        input.value = String(DEFAULT_LAYER_FILTERS[control.key]);
        input.dispatchEvent(new EventCtor('input', { bubbles:true }));
      }
    });
    modal.querySelector('[data-cancel]').addEventListener('click', () => {
      restore();
      close();
      setStatus('Изменения смарт-фильтра отменены');
    });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        restore();
        close();
        setStatus('Изменения смарт-фильтра отменены');
      }
    });
    modal.addEventListener('submit', event => {
      event.preventDefault();
      const target = smartFilterTarget(owner, layerId);
      const item = liveItem();
      if (!target || !item) {
        close();
        return;
      }
      item.name = nameInput.value.trim().slice(0, 160) || smartFilterDefaultName(target);
      const changed = JSON.stringify(target.smartFilters) !== JSON.stringify(original);
      close();
      if (changed) commit(isNew ? 'Добавить смарт-фильтр' : 'Изменить смарт-фильтр');
      else {
        target.smartFilters = structuredClone(original);
        render();
        refreshInspectorPanels();
      }
    });
    nameInput.focus();
    nameInput.select();
  }

  return {
    smartFilterMaskMarkup,
    smartFilterStackMarkup,
    hasSmartFilterCapacity,
    moveSmartFilter,
    toggleSmartFilter,
    removeSmartFilter,
    clearSmartFilters,
    setSmartFilterMask,
    toggleSmartFilterMask,
    invertSmartFilterMask,
    removeSmartFilterMask,
    updateSmartFilterMaskSetting,
    bindSmartFilterControls,
    openSmartFilterDialog,
  };
}
