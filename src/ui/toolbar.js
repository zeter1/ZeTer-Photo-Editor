import { sanitizeToolOrder, moveToolToIndex, gridCellIndexFromPoint } from '../core/tool-layout.js';

// Browser-only owner for toolbar ordering and tooltips.
// Document/layer/tool behavior stays in main.js; this module owns only toolbar UI state.
export function createToolbarController({
  toolbar,
  labels,
  help,
  storageKey,
  setStatus = () => {},
} = {}) {
  if (!toolbar) throw new Error('Toolbar controller requires a toolbar element');

  let dragToolId = '';
  let dropIndex = -1;
  let suppressClick = false;
  let reorderInitialized = false;
  let tooltipsInitialized = false;

  const toolButtons = () => [...toolbar.querySelectorAll('.tool')];

  function toolIds() {
    return toolButtons().map(button => button.dataset.tool).filter(Boolean);
  }

  function applyOrder(order) {
    const buttons = toolButtons();
    const available = buttons.map(button => button.dataset.tool).filter(Boolean);
    const normalized = sanitizeToolOrder(order, available);
    const byTool = new Map(buttons.map(button => [button.dataset.tool, button]));
    const anchor = toolbar.querySelector('.toolbar-spacer, .color-chip');
    for (const tool of normalized) {
      const button = byTool.get(tool);
      if (button) toolbar.insertBefore(button, anchor);
    }
    return normalized;
  }

  function readOrder() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    } catch (error) {
      console.warn('Could not restore toolbar tool order', error);
    }
    return applyOrder(saved);
  }

  function persistOrder(order = toolIds()) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(order));
      return true;
    } catch (error) {
      console.warn('Could not persist toolbar tool order', error);
      return false;
    }
  }

  function clearDropTarget() {
    dropIndex = -1;
    const marker = toolbar.querySelector('.toolbar-drop-slot');
    if (marker) marker.hidden = true;
  }

  function gridMetrics() {
    const buttons = toolButtons();
    const sample = buttons.find(button => button.dataset.tool !== dragToolId) || buttons[0];
    if (!sample) return null;

    const toolbarRect = toolbar.getBoundingClientRect();
    const sampleRect = sample.getBoundingClientRect();
    const style = getComputedStyle(toolbar);
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const columnGap = parseFloat(style.columnGap) || 0;
    const rowGap = parseFloat(style.rowGap) || 0;
    const template = String(style.gridTemplateColumns || '').trim();
    const columns = template && template !== 'none'
      ? Math.max(1, template.split(/\s+/).length)
      : 1;

    return {
      left: toolbarRect.left + borderLeft + paddingLeft,
      top: toolbarRect.top + borderTop + paddingTop,
      toolbarRect,
      columns,
      cellWidth: sampleRect.width,
      cellHeight: sampleRect.height,
      columnGap,
      rowGap,
      scrollTop: toolbar.scrollTop,
      maxIndex: Math.max(0, buttons.length - 1),
    };
  }

  function dropIndexFromPointer(event) {
    const metrics = gridMetrics();
    if (!metrics) return 0;
    return gridCellIndexFromPoint({ x:event.clientX, y:event.clientY }, metrics);
  }

  function showDropSlot(index) {
    const metrics = gridMetrics();
    const marker = toolbar.querySelector('.toolbar-drop-slot');
    if (!metrics || !marker) return;

    const clamped = Math.max(0, Math.min(metrics.maxIndex, Math.round(index)));
    dropIndex = clamped;
    const row = Math.floor(clamped / metrics.columns);
    const column = clamped % metrics.columns;
    const viewportLeft = metrics.left + column * (metrics.cellWidth + metrics.columnGap);
    const viewportTop = metrics.top - metrics.scrollTop + row * (metrics.cellHeight + metrics.rowGap);
    marker.style.left = `${viewportLeft - metrics.toolbarRect.left + toolbar.scrollLeft}px`;
    marker.style.top = `${viewportTop - metrics.toolbarRect.top + toolbar.scrollTop}px`;
    marker.style.width = `${metrics.cellWidth}px`;
    marker.style.height = `${metrics.cellHeight}px`;
    marker.hidden = false;
  }

  function commitMoveToIndex(index) {
    const next = moveToolToIndex(toolIds(), dragToolId, index);
    applyOrder(next);
    return persistOrder(next);
  }

  function initReorder() {
    if (reorderInitialized) return;
    reorderInitialized = true;
    readOrder();
    toolbar.setAttribute('aria-label', 'Инструменты. Кнопки можно перетаскивать в любую позицию панели.');

    const marker = document.createElement('div');
    marker.className = 'toolbar-drop-slot';
    marker.hidden = true;
    marker.setAttribute('aria-hidden', 'true');
    toolbar.append(marker);

    for (const button of toolButtons()) {
      button.draggable = true;
      button.setAttribute('aria-roledescription', 'перетаскиваемый инструмент');
      button.addEventListener('dragstart', event => {
        dragToolId = button.dataset.tool || '';
        if (!dragToolId) {
          event.preventDefault();
          return;
        }
        suppressClick = true;
        button.classList.add('tool-dragging');
        clearDropTarget();
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', `tool:${dragToolId}`);
        }
        setStatus(`Перемещение инструмента «${labels[dragToolId] || dragToolId}»: отпустите его в нужной ячейке панели`);
      });
      button.addEventListener('dragend', () => {
        button.classList.remove('tool-dragging');
        clearDropTarget();
        dragToolId = '';
        setTimeout(() => { suppressClick = false; }, 0);
      });
    }

    toolbar.addEventListener('dragover', event => {
      if (!dragToolId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      showDropSlot(dropIndexFromPointer(event));
    });
    toolbar.addEventListener('dragleave', event => {
      if (!dragToolId) return;
      const rect = toolbar.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) clearDropTarget();
    });
    toolbar.addEventListener('drop', event => {
      if (!dragToolId) return;
      event.preventDefault();
      event.stopPropagation();
      const movedLabel = labels[dragToolId] || dragToolId;
      const index = dropIndex >= 0 ? dropIndex : dropIndexFromPointer(event);
      const saved = commitMoveToIndex(index);
      clearDropTarget();
      setStatus(saved
        ? `Инструмент «${movedLabel}» перемещён в позицию ${index + 1}. Порядок сохранён.`
        : `Инструмент «${movedLabel}» перемещён, но браузер не разрешил сохранить порядок.`);
    });
  }

  function initTooltips() {
    if (tooltipsInitialized) return;
    tooltipsInitialized = true;

    const tooltip = document.createElement('div');
    tooltip.id = 'toolTooltip';
    tooltip.className = 'tool-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    document.body.append(tooltip);

    const hide = () => { tooltip.hidden = true; };
    for (const button of toolButtons()) {
      const item = help[button.dataset.tool];
      if (!item) continue;
      button.removeAttribute('title');
      button.setAttribute('aria-describedby', tooltip.id);
      const show = () => {
        const rect = button.getBoundingClientRect();
        tooltip.innerHTML = `<strong>${labels[button.dataset.tool]}</strong><span>${item.description}</span><kbd>${item.shortcut}</kbd>`;
        tooltip.hidden = false;
        const width = tooltip.offsetWidth;
        const height = tooltip.offsetHeight;
        const maxTop = Math.max(8, window.innerHeight - height - 8);
        const top = Math.max(8, Math.min(rect.top + rect.height / 2 - height / 2, maxTop));
        tooltip.style.left = `${Math.min(window.innerWidth - width - 10, rect.right + 10)}px`;
        tooltip.style.top = `${top}px`;
      };
      button.addEventListener('pointerenter', show);
      button.addEventListener('pointerleave', hide);
      button.addEventListener('focus', show);
      button.addEventListener('blur', hide);
      button.addEventListener('dragstart', hide);
      button.addEventListener('dragend', hide);
    }
  }

  return {
    initReorder,
    initTooltips,
    isClickSuppressed: () => suppressClick,
    applyOrder,
    readOrder,
  };
}
