import { isGroupLocked, isGroupVisible, isLayerLocked } from '../core/state.js';

const LAYERS_PANEL_TYPE_GLYPHS = Object.freeze({
  text: 'T',
  shape: '▭',
  adjustment: '◐',
  'smart-object': '◇',
});

function layersPanelMaskHints(layer) {
  const hints = [];
  if (layer.mask) {
    hints.push(layer.mask.enabled === false
      ? 'Растровая маска отключена'
      : layer.mask.dataUrl
        ? 'Есть растровая маска'
        : 'Растровая маска: показать всё');
  }
  if (layer.vectorMask) {
    hints.push(
      'Векторная маска: ' + String(layer.vectorMask.subpaths?.length || 0) + ' контур(ов)' +
      (layer.vectorMask.enabled === false ? ' · отключена' : '') +
      (layer.vectorMask.invert ? ' · инвертирована' : ''),
    );
  }
  if (layer.smartFilterMask) {
    hints.push(
      'Маска смарт-фильтров' +
      (layer.smartFilterMask.enabled === false ? ' · отключена' : '') +
      (layer.smartFilterMask.invert ? ' · инвертирована' : ''),
    );
  }
  return hints;
}

function layersPanelBeforeMidpoint(event, row) {
  const bounds = row.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2;
}

export function createLayersPanelController({ container, state = {}, actions = {}, ui = {} } = {}) {
  if (!container) throw new Error('Layers panel container is required');
  const documentRef = ui.documentRef ?? globalThis.document;
  if (!documentRef?.createElement) throw new Error('Layers panel document is required');
  const requestFrame = ui.requestFrame ?? (callback => globalThis.requestAnimationFrame?.(callback) ?? callback());
  const setStatus = ui.setStatus ?? (() => {});
  const layerActions = actions.layer ?? {};
  const groupActions = actions.group ?? {};
  const dragActions = actions.drag ?? {};

  let bound = false;
  let dragState = null;
  let layerRows = new Map();
  let groupRows = new Map();

  const getDocument = () => state.getDocument?.() ?? null;
  const isCurrentDocument = owner => Boolean(owner) && getDocument() === owner;
  const groupsOf = owner => Array.isArray(owner?.groups) ? owner.groups : [];
  const resolveLayer = (owner, id) => isCurrentDocument(owner)
    ? owner.layers?.find(item => item.id === id) ?? null
    : null;
  const resolveGroup = (owner, id) => isCurrentDocument(owner)
    ? groupsOf(owner).find(item => item.id === id) ?? null
    : null;

  function clearDragDecorations() {
    container.classList.remove('drop-root');
    container.querySelectorAll('.layer-row,.layer-group-row')
      .forEach(item => item.classList.remove('dragging', 'drop-before', 'drop-after', 'drop-into'));
  }

  function finishDrag() {
    dragState = null;
    clearDragDecorations();
  }

  function getLayerRow(id) { return layerRows.get(id) ?? null; }
  function getGroupRow(id) { return groupRows.get(id) ?? null; }

  function focusSelectedLayerRow(owner = getDocument()) {
    if (!isCurrentDocument(owner)) return false;
    const row = getLayerRow(owner.selectedLayerId);
    row?.focus?.();
    return Boolean(row);
  }

  function scheduleSelectedLayerFocus(owner) {
    requestFrame(() => {
      if (isCurrentDocument(owner)) focusSelectedLayerRow(owner);
    });
  }

  function selectLayer(owner, layerId, { refresh = true, focus = false } = {}) {
    if (!resolveLayer(owner, layerId)) return false;
    const changed = state.selectLayer?.(owner, layerId, { refresh }) !== false;
    if (changed && focus) scheduleSelectedLayerFocus(owner);
    return changed;
  }

  function selectAdjacentLayer(owner, direction) {
    if (!isCurrentDocument(owner) || !owner.layers?.length) return false;
    const currentIndex = Math.max(0, owner.layers.findIndex(layer => layer.id === owner.selectedLayerId));
    const nextIndex = Math.max(0, Math.min(owner.layers.length - 1, currentIndex + direction));
    return selectLayer(owner, owner.layers[nextIndex].id, { refresh: true, focus: true });
  }

  function toggleGroupCollapsed(owner, groupId) {
    const group = resolveGroup(owner, groupId);
    if (!group) return false;
    group.collapsed = !group.collapsed;
    render();
    return true;
  }

  function appendLayerRow(owner, layer, groupsById, depth) {
    const currentGroup = layer.groupId ? groupsById.get(layer.groupId) : null;
    const groupHidden = Boolean(currentGroup && !isGroupVisible(owner, currentGroup));
    const groupLocked = Boolean(currentGroup && isGroupLocked(owner, currentGroup));
    const effectiveLocked = isLayerLocked(owner, layer);
    const row = documentRef.createElement('div');
    row.className =
      'layer-row' +
      (depth > 0 ? ' in-group' : '') +
      (groupHidden ? ' group-hidden' : '') +
      (groupLocked ? ' group-locked' : '') +
      (layer.id === owner.selectedLayerId ? ' selected' : '');
    row.style.setProperty('--layer-depth', String(depth));
    row.dataset.id = layer.id;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(layer.id === owner.selectedLayerId));
    row.tabIndex = layer.id === owner.selectedLayerId ? 0 : -1;
    layerRows.set(layer.id, row);

    const eye = documentRef.createElement('button');
    eye.className = 'layer-eye';
    eye.textContent = layer.visible ? '◉' : '○';
    eye.title = groupHidden
      ? 'Родительская группа скрыта; переключить собственную видимость слоя'
      : layer.visible ? 'Скрыть' : 'Показать';
    eye.setAttribute('aria-label', eye.title);
    eye.onclick = event => {
      event.stopPropagation();
      if (resolveLayer(owner, layer.id)) layerActions.toggleVisibility?.(owner, layer.id);
    };

    const thumb = documentRef.createElement('div');
    thumb.className = 'layer-thumb';
    if ((layer.type === 'raster' && layer.dataUrl) || (layer.type === 'smart-object' && layer.previewDataUrl)) {
      const img = documentRef.createElement('img');
      img.src = layer.type === 'smart-object' ? layer.previewDataUrl : layer.dataUrl;
      thumb.append(img);
    } else {
      thumb.textContent = LAYERS_PANEL_TYPE_GLYPHS[layer.type] ?? '▦';
    }
    if (layer.type === 'smart-object') {
      thumb.title = 'Двойной клик: редактировать содержимое смарт-объекта';
      thumb.ondblclick = event => {
        event.stopPropagation();
        if (resolveLayer(owner, layer.id)) layerActions.openSmartObject?.(owner, layer.id);
      };
    }
    const maskHints = layersPanelMaskHints(layer);
    if (maskHints.length) thumb.title = [thumb.title, ...maskHints].filter(Boolean).join(' · ');

    const name = documentRef.createElement('div');
    name.className = 'layer-name';
    name.textContent = layer.name;
    name.title = layer.name;
    name.ondblclick = event => {
      event.stopPropagation();
      if (resolveLayer(owner, layer.id)) layerActions.rename?.(owner, layer.id);
    };

    const lock = documentRef.createElement('button');
    lock.className = 'layer-lock';
    lock.textContent = effectiveLocked ? '🔒' : '·';
    lock.title = groupLocked
      ? 'Слой заблокирован одной из родительских групп'
      : layer.locked ? 'Разблокировать' : 'Заблокировать';
    lock.setAttribute('aria-label', lock.title);
    lock.disabled = groupLocked;
    lock.onclick = event => {
      event.stopPropagation();
      if (resolveLayer(owner, layer.id) && !groupLocked) layerActions.toggleLock?.(owner, layer.id);
    };

    row.append(eye, thumb, name, lock);
    row.onclick = () => selectLayer(owner, layer.id, { refresh: true });
    row.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      if (!resolveLayer(owner, layer.id)) return;
      layerActions.openContextMenu?.(owner, layer.id, event, row);
    });
    row.addEventListener('keydown', event => {
      if (event.target !== row || !resolveLayer(owner, layer.id)) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        selectAdjacentLayer(owner, event.key === 'ArrowUp' ? 1 : -1);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        event.stopPropagation();
        const next = event.key === 'Home' ? owner.layers.at(-1) : owner.layers[0];
        if (next) selectLayer(owner, next.id, { refresh: true, focus: true });
        return;
      }
      if (event.key === 'Enter' || event.code === 'F2') {
        event.preventDefault();
        event.stopPropagation();
        layerActions.rename?.(owner, layer.id);
        return;
      }
      if (event.key === 'Delete') {
        event.preventDefault();
        event.stopPropagation();
        layerActions.remove?.(owner, layer.id);
        scheduleSelectedLayerFocus(owner);
      }
    });

    row.draggable = !effectiveLocked;
    row.addEventListener('dragstart', event => {
      const currentLayer = resolveLayer(owner, layer.id);
      if (!currentLayer || isLayerLocked(owner, currentLayer)) {
        event.preventDefault();
        setStatus('Слой или его группа заблокированы');
        return;
      }
      dragState = { kind: 'layer', id: layer.id, owner };
      state.selectLayer?.(owner, layer.id, { refresh: false });
      row.classList.add('dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', layer.id);
      }
    });
    row.addEventListener('dragover', event => {
      if (!dragState || dragState.kind !== 'layer' || dragState.owner !== owner) return;
      const target = resolveLayer(owner, layer.id);
      if (!target || dragState.id === layer.id || isLayerLocked(owner, target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const before = layersPanelBeforeMidpoint(event, row);
      row.classList.toggle('drop-before', before);
      row.classList.toggle('drop-after', !before);
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
    row.addEventListener('drop', event => {
      if (!dragState || dragState.kind !== 'layer' || dragState.owner !== owner) return;
      const draggedLayerId = dragState.id;
      const target = resolveLayer(owner, layer.id);
      try {
        if (!target || draggedLayerId === layer.id || isLayerLocked(owner, target)) return;
        event.preventDefault();
        event.stopPropagation();
        dragActions.moveLayerRelative?.(owner, draggedLayerId, layer.id, layersPanelBeforeMidpoint(event, row));
      } finally {
        finishDrag();
      }
    });
    row.addEventListener('dragend', finishDrag);
    container.append(row);
  }

  function appendGroupRow(owner, group, directMembers, groupsById, depth) {
    const effectiveVisible = isGroupVisible(owner, group);
    const effectiveLocked = isGroupLocked(owner, group);
    const parent = group.parentGroupId ? groupsById.get(group.parentGroupId) : null;
    const ancestorLocked = Boolean(parent && isGroupLocked(owner, parent));
    const ancestorHidden = Boolean(parent && !isGroupVisible(owner, parent));
    const row = documentRef.createElement('div');
    row.className =
      'layer-group-row' +
      (!effectiveVisible ? ' group-hidden' : '') +
      (effectiveLocked ? ' group-locked' : '');
    row.style.setProperty('--group-depth', String(depth));
    row.dataset.groupId = group.id;
    row.tabIndex = 0;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', group.name + ', уровень ' + String(depth + 1) + ', ' + String(directMembers.length) + ' прямых слоёв');
    groupRows.set(group.id, row);

    const eye = documentRef.createElement('button');
    eye.className = 'layer-eye layer-group-eye';
    eye.textContent = group.visible === false ? '○' : '◉';
    eye.title = ancestorHidden
      ? 'Родительская группа скрыта; переключить собственную видимость'
      : group.visible === false ? 'Показать группу' : 'Скрыть группу';
    eye.setAttribute('aria-label', eye.title);
    eye.onclick = event => {
      event.stopPropagation();
      if (resolveGroup(owner, group.id)) groupActions.toggleVisibility?.(owner, group.id);
    };

    const toggle = documentRef.createElement('button');
    toggle.className = 'layer-group-toggle';
    toggle.textContent = group.collapsed ? '▸' : '▾';
    toggle.title = group.collapsed ? 'Развернуть группу' : 'Свернуть группу';
    toggle.setAttribute('aria-expanded', String(!group.collapsed));
    toggle.onclick = event => {
      event.stopPropagation();
      toggleGroupCollapsed(owner, group.id);
    };

    const thumb = documentRef.createElement('div');
    thumb.className = 'layer-thumb layer-group-thumb';
    thumb.textContent = '▰';

    const name = documentRef.createElement('button');
    name.type = 'button';
    name.className = 'layer-name layer-group-name';
    name.textContent = group.name;
    const groupMode = group.blendMode === 'pass-through' ? 'Pass Through' : (group.blendMode || 'source-over');
    name.title =
      group.name + ' · уровень ' + String(depth + 1) +
      ' · ' + String(directMembers.length) + ' прямых слоёв · ' +
      String(Math.round((group.opacity ?? 1) * 100)) + '% · ' + groupMode +
      ' · клик: свернуть/развернуть · двойной клик: переименовать';
    name.onclick = event => {
      event.stopPropagation();
      toggleGroupCollapsed(owner, group.id);
    };
    name.ondblclick = event => {
      event.preventDefault();
      event.stopPropagation();
      if (resolveGroup(owner, group.id)) groupActions.rename?.(owner, group.id);
    };

    const lock = documentRef.createElement('button');
    lock.className = 'layer-lock layer-group-lock';
    lock.textContent = effectiveLocked ? '🔒' : '·';
    lock.title = ancestorLocked
      ? 'Группа заблокирована родительской группой'
      : group.locked ? 'Разблокировать группу' : 'Заблокировать группу';
    lock.setAttribute('aria-label', lock.title);
    lock.disabled = ancestorLocked;
    lock.onclick = event => {
      event.stopPropagation();
      if (resolveGroup(owner, group.id) && !ancestorLocked) groupActions.toggleLock?.(owner, group.id);
    };

    const remove = documentRef.createElement('button');
    remove.className = 'layer-group-remove';
    remove.textContent = '×';
    remove.title = 'Удалить группу (содержимое останется)';
    remove.setAttribute('aria-label', remove.title);
    remove.disabled = effectiveLocked;
    remove.onclick = event => {
      event.stopPropagation();
      if (resolveGroup(owner, group.id) && !effectiveLocked) groupActions.remove?.(owner, group.id);
    };

    row.append(eye, toggle, thumb, name, lock, remove);
    row.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      if (!resolveGroup(owner, group.id)) return;
      groupActions.openContextMenu?.(owner, group.id, event, row);
    });
    row.draggable = !effectiveLocked;
    row.addEventListener('dragstart', event => {
      const currentGroup = resolveGroup(owner, group.id);
      if (!currentGroup || isGroupLocked(owner, currentGroup)) {
        event.preventDefault();
        setStatus('Группа или её родитель заблокированы');
        return;
      }
      dragState = { kind: 'group', id: group.id, owner };
      row.classList.add('dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'group:' + group.id);
      }
    });
    row.addEventListener('dragover', event => {
      if (!dragState || dragState.owner !== owner) return;
      const target = resolveGroup(owner, group.id);
      const validGroup = dragState.kind !== 'group' || dragState.id !== group.id;
      if (!target || !validGroup || isGroupLocked(owner, target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      row.classList.add('drop-into');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-into'));
    row.addEventListener('drop', event => {
      if (!dragState || dragState.owner !== owner) return;
      const activeDrag = dragState;
      const target = resolveGroup(owner, group.id);
      try {
        if (!target || isGroupLocked(owner, target)) return;
        if (activeDrag.kind === 'group' && activeDrag.id === group.id) return;
        event.preventDefault();
        event.stopPropagation();
        if (activeDrag.kind === 'layer') {
          dragActions.moveLayerIntoGroup?.(owner, activeDrag.id, group.id);
          return;
        }
        if (!dragActions.moveGroupIntoGroup?.(owner, activeDrag.id, group.id)) {
          setStatus('Нельзя вложить группу в саму себя, потомка или заблокированную группу');
        }
      } finally {
        finishDrag();
      }
    });
    row.addEventListener('dragend', finishDrag);
    container.append(row);
  }

  function render() {
    finishDrag();
    container.replaceChildren();
    layerRows = new Map();
    groupRows = new Map();
    const owner = getDocument();
    if (!owner || !Array.isArray(owner.layers)) return 0;

    const groups = groupsOf(owner);
    const groupsById = new Map(groups.map(group => [group.id, group]));
    const displayLayers = [...owner.layers].reverse();
    const displayIndex = new Map(displayLayers.map((layer, index) => [layer.id, index]));
    const membersByGroup = new Map();
    const childrenByParent = new Map();

    for (const group of groups) {
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

    const activePath = new Set();
    const renderLevel = (parentGroupId = null, depth = 0) => {
      const entries = [];
      for (const group of childrenByParent.get(parentGroupId) || []) {
        entries.push({ type: 'group', group, rank: groupRank(group), order: groups.indexOf(group) });
      }
      for (const layer of membersByGroup.get(parentGroupId) || []) {
        entries.push({ type:'layer', layer, rank:displayIndex.get(layer.id) ?? Number.POSITIVE_INFINITY, order:displayIndex.get(layer.id) ?? 0 });
      }
      entries.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.type !== b.type) return a.type === 'group' ? -1 : 1;
        return a.order - b.order;
      });
      for (const entry of entries) {
        if (entry.type === 'layer') {
          appendLayerRow(owner, entry.layer, groupsById, depth);
          continue;
        }
        const group = entry.group;
        if (activePath.has(group.id)) continue;
        appendGroupRow(owner, group, membersByGroup.get(group.id) || [], groupsById, depth);
        if (!group.collapsed) {
          activePath.add(group.id);
          renderLevel(group.id, depth + 1);
          activePath.delete(group.id);
        }
      }
    };

    renderLevel(null, 0);
    return container.children?.length ?? layerRows.size + groupRows.size;
  }

  function onRootDragOver(event) {
    if (!dragState || event.target !== container) return;
    if (!isCurrentDocument(dragState.owner)) {
      finishDrag();
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    container.classList.add('drop-root');
  }

  function onRootDragLeave(event) {
    if (event.target === container) container.classList.remove('drop-root');
  }

  function onRootDrop(event) {
    if (!dragState || event.target !== container) return;
    const activeDrag = dragState;
    event.preventDefault();
    try {
      if (!isCurrentDocument(activeDrag.owner)) return;
      if (activeDrag.kind === 'layer') dragActions.moveLayerToRoot?.(activeDrag.owner, activeDrag.id);
      else dragActions.moveGroupToRoot?.(activeDrag.owner, activeDrag.id);
    } finally {
      finishDrag();
    }
  }

  function bind() {
    if (bound) return false;
    container.addEventListener('dragover', onRootDragOver);
    container.addEventListener('dragleave', onRootDragLeave);
    container.addEventListener('drop', onRootDrop);
    bound = true;
    return true;
  }

  function destroy() {
    if (!bound) {
      finishDrag();
      return false;
    }
    container.removeEventListener('dragover', onRootDragOver);
    container.removeEventListener('dragleave', onRootDragLeave);
    container.removeEventListener('drop', onRootDrop);
    bound = false;
    finishDrag();
    return true;
  }

  return { bind, destroy, render, focusSelectedLayerRow, getLayerRow, getGroupRow, clearDrag: finishDrag };
}
