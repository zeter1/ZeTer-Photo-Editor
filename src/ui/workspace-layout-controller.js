import { UI_COLLAPSE_STORAGE_KEY } from './tool-config.js';

export function createWorkspaceLayoutController({
  panelCards = [],
  workspace = null,
  toolbar = null,
  rightPanel = null,
  viewport = null,
  overlay = null,
  storage = null,
  storageKey = UI_COLLAPSE_STORAGE_KEY,
  requestFrame = callback => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(callback) : callback()),
  getZoom = () => 1,
  clientPointToCanvas = null,
  setStatus = () => {},
  consoleRef = console,
} = {}) {
  const collapsedPanelIds = new Set();
  let panelsVisible = true;

  const cards = () => Array.from(typeof panelCards === 'function' ? panelCards() : (panelCards || []));

  function readCollapseState() {
    collapsedPanelIds.clear();
    try {
      const target = storage ?? globalThis.localStorage;
      const parsed = JSON.parse(target?.getItem?.(storageKey) || '{}');
      for (const id of Array.isArray(parsed.panels) ? parsed.panels : []) collapsedPanelIds.add(String(id));
      if (Array.isArray(parsed.propertySections) && parsed.propertySections.includes('color-effects')) {
        collapsedPanelIds.add('effects');
      }
    } catch (error) {
      consoleRef?.warn?.('Could not restore panel collapse state', error);
    }
    return [...collapsedPanelIds];
  }

  function persistCollapseState() {
    try {
      const target = storage ?? globalThis.localStorage;
      if (!target?.setItem) return false;
      target.setItem(storageKey, JSON.stringify({ panels:[...collapsedPanelIds] }));
      return true;
    } catch (error) {
      consoleRef?.warn?.('Could not persist panel collapse state', error);
      return false;
    }
  }

  function setPanelCollapsed(panel, collapsed, { persist = true } = {}) {
    const id = panel?.dataset?.panelId;
    if (!panel || !id) return false;
    const next = Boolean(collapsed);
    panel.classList.toggle('is-collapsed', next);
    const toggle = panel.querySelector(':scope > header .panel-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!next));
      const name = toggle.querySelector('strong')?.textContent?.trim() || 'раздел';
      toggle.title = `${next ? 'Развернуть' : 'Свернуть'} раздел «${name}»`;
    }
    if (next) collapsedPanelIds.add(id);
    else collapsedPanelIds.delete(id);
    if (persist) persistCollapseState();
    return true;
  }

  function initCollapsiblePanels() {
    readCollapseState();
    let initialized = 0;
    for (const panel of cards()) {
      const toggle = panel?.querySelector?.(':scope > header .panel-toggle');
      if (!toggle) continue;
      setPanelCollapsed(panel, collapsedPanelIds.has(panel.dataset.panelId), { persist:false });
      toggle.addEventListener('click', () => {
        setPanelCollapsed(panel, !panel.classList.contains('is-collapsed'));
      });
      initialized += 1;
    }
    return initialized;
  }

  function togglePanels() {
    let centerPoint = null;
    if (viewport && overlay && typeof clientPointToCanvas === 'function') {
      const before = viewport.getBoundingClientRect();
      centerPoint = clientPointToCanvas(before.left + before.width / 2, before.top + before.height / 2);
    }

    panelsVisible = !panelsVisible;
    workspace?.classList?.toggle('panels-hidden', !panelsVisible);
    toolbar?.setAttribute?.('aria-hidden', String(!panelsVisible));
    rightPanel?.setAttribute?.('aria-hidden', String(!panelsVisible));

    if (centerPoint && viewport && overlay) {
      requestFrame(() => {
        const viewportRect = viewport.getBoundingClientRect();
        const canvasRect = overlay.getBoundingClientRect();
        const zoom = Number(getZoom?.()) || 1;
        viewport.scrollLeft += canvasRect.left + centerPoint.x * zoom
          - (viewportRect.left + viewportRect.width / 2);
        viewport.scrollTop += canvasRect.top + centerPoint.y * zoom
          - (viewportRect.top + viewportRect.height / 2);
      });
    }

    setStatus(panelsVisible ? 'Панели показаны' : 'Режим холста: панели скрыты');
    return panelsVisible;
  }

  return {
    readCollapseState,
    persistCollapseState,
    setPanelCollapsed,
    initCollapsiblePanels,
    togglePanels,
    getCollapsedPanelIds: () => [...collapsedPanelIds],
    arePanelsVisible: () => panelsVisible,
  };
}
