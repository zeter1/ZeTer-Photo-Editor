const SAVED_PATH_RESOURCE_MIN = 2000;
const SAVED_PATH_RESOURCE_MAX = 2997;
const SAVED_PATH_LIMIT = 998;

export function createPathsController({
  state = {},
  vectors = {},
  edit = {},
  ui = {},
  clone = value => globalThis.structuredClone(value),
} = {}) {
  const {
    getDocument = () => null,
    getSelectedLayer = () => null,
    getSelectionShape = () => null,
    isLayerLocked = () => false,
    commit = () => {},
  } = state;
  const {
    exportVectorMask = () => null,
    importVectorMask = () => null,
    layerPixelToDocumentPoint = point => ({ ...point }),
    selectionDocumentNodes = () => [],
  } = vectors;
  const {
    beginPathEdit = () => {},
    syncPathEditSelection = () => {},
    onPathDeleted = () => {},
    normalizePathEditIndex = () => {},
    clearVectorMaskEdit = () => {},
    drawOverlay = () => {},
  } = edit;
  const {
    setStatus = () => {},
    toast = () => {},
    showModal = () => {},
    openContextMenu = () => {},
    pathList = null,
    controls = {},
    documentRef = globalThis.document,
    requestFrame = callback => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(callback) : callback()),
  } = ui;

  let selectedIndex = -1;

  const documentValue = () => getDocument?.() || null;
  const paths = () => {
    const value = documentValue()?.paths;
    return Array.isArray(value) ? value : [];
  };

  function normalizeSelectedIndex() {
    const list = paths();
    if (!list.length) {
      selectedIndex = -1;
      normalizePathEditIndex(0);
      return -1;
    }
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= list.length) selectedIndex = 0;
    normalizePathEditIndex(list.length);
    return selectedIndex;
  }

  function getSelectedIndex() {
    return selectedIndex;
  }

  function setSelectedIndex(index, { syncEdit = false, render = false, draw = false } = {}) {
    selectedIndex = Number.isInteger(index) ? index : -1;
    const normalized = normalizeSelectedIndex();
    if (syncEdit && normalized >= 0) syncPathEditSelection(normalized);
    if (render) updatePathsPanel();
    if (draw) drawOverlay();
    return normalized;
  }

  function selectedPath() {
    const index = normalizeSelectedIndex();
    return index >= 0 ? paths()[index] : null;
  }

  function allocateResourceId() {
    const used = new Set(paths()
      .map(path => path?.id)
      .filter(id => Number.isInteger(id) && id >= SAVED_PATH_RESOURCE_MIN && id <= SAVED_PATH_RESOURCE_MAX));
    for (let id = SAVED_PATH_RESOURCE_MIN; id <= SAVED_PATH_RESOURCE_MAX; id += 1) {
      if (!used.has(id)) return id;
    }
    return null;
  }

  function uniqueName(base = 'Контур') {
    const names = new Set(paths().map(path => String(path?.name || '').trim()).filter(Boolean));
    const root = String(base || 'Контур').trim().slice(0, 220) || 'Контур';
    if (!names.has(root)) return root;
    let index = 2;
    while (names.has(`${root} ${index}`)) index += 1;
    return `${root} ${index}`;
  }

  function toDocumentNode(node, layer) {
    const anchor = layerPixelToDocumentPoint(node, layer);
    return {
      x: anchor.x,
      y: anchor.y,
      handleIn: node.handleIn ? layerPixelToDocumentPoint(node.handleIn, layer) : null,
      handleOut: node.handleOut ? layerPixelToDocumentPoint(node.handleOut, layer) : null,
      kind: node.kind === 'smooth' ? 'smooth' : 'corner',
    };
  }

  function pathFromCurrentSource() {
    const layer = getSelectedLayer?.();
    if (layer?.vectorMask?.subpaths?.length) {
      const vector = exportVectorMask(layer);
      return {
        name: uniqueName(`${layer.name || 'Слой'} — маска`),
        fillStartsWithAllPixels: vector.fillStartsWithAllPixels === true,
        subpaths: clone(vector.subpaths),
      };
    }
    if (layer?.type === 'shape' && layer.shape === 'path' && Array.isArray(layer.pathPoints) && layer.pathPoints.length >= 2) {
      return {
        name: uniqueName(`${layer.name || 'Контур'} — путь`),
        fillStartsWithAllPixels: false,
        subpaths: [{
          operation: 'add',
          closed: Boolean(layer.pathClosed),
          fillRule: 'non-zero',
          points: layer.pathPoints.map(node => toDocumentNode(node, layer)),
        }],
      };
    }
    if (getSelectionShape?.()) {
      const nodes = selectionDocumentNodes() || [];
      if (nodes.length >= 3) {
        return {
          name: uniqueName('Контур из выделения'),
          fillStartsWithAllPixels: false,
          subpaths: [{
            operation: 'add',
            closed: true,
            fillRule: 'non-zero',
            points: nodes.map(node => clone(node)),
          }],
        };
      }
    }
    return null;
  }

  function addDocumentPathFromCurrent() {
    const doc = documentValue();
    if (!doc) return false;
    if (paths().length >= SAVED_PATH_LIMIT) {
      setStatus('Достигнут лимит 998 сохранённых контуров');
      toast('Нельзя сохранить больше 998 Photoshop-compatible paths', 'warn');
      return false;
    }
    const path = pathFromCurrentSource();
    if (!path) {
      setStatus('Нужен path-слой, векторная маска или активное выделение');
      toast('Нечего сохранять как контур', 'warn');
      return false;
    }
    const id = allocateResourceId();
    if (id === null) {
      setStatus('Исчерпан диапазон Photoshop Path Resource ID 2000..2997');
      return false;
    }
    if (!Array.isArray(doc.paths)) doc.paths = [];
    doc.paths.push({ id, ...path });
    selectedIndex = doc.paths.length - 1;
    commit('Сохранить контур');
    setStatus(`Сохранён контур «${path.name}»`);
    return true;
  }

  function renameSelectedDocumentPath() {
    const path = selectedPath();
    if (!path) return false;
    const targetIndex = selectedIndex;
    showModal({
      title: 'Переименовать контур',
      fields: [{ name:'name', label:'Имя', value:path.name || 'Контур', required:true }],
      submitLabel: 'Переименовать',
      onSubmit: values => {
        const target = paths()[targetIndex];
        const name = String(values.name || '').trim().slice(0, 240);
        if (!target || !name || name === target.name) return false;
        target.name = name;
        selectedIndex = targetIndex;
        commit('Переименовать контур');
        return true;
      },
    });
    return true;
  }

  function duplicateSelectedDocumentPath() {
    const path = selectedPath();
    if (!path) return false;
    const doc = documentValue();
    if (!doc) return false;
    if (paths().length >= SAVED_PATH_LIMIT) {
      setStatus('Достигнут лимит 998 сохранённых контуров');
      return false;
    }
    const id = allocateResourceId();
    if (id === null) return false;
    const copy = clone(path);
    copy.id = id;
    copy.name = uniqueName(`${path.name || 'Контур'} — копия`);
    doc.paths.push(copy);
    selectedIndex = doc.paths.length - 1;
    commit('Дублировать контур');
    return true;
  }

  function deleteSelectedDocumentPath() {
    const index = normalizeSelectedIndex();
    if (index < 0) return false;
    const doc = documentValue();
    const name = paths()[index]?.name || 'Контур';
    doc.paths.splice(index, 1);
    onPathDeleted(index);
    selectedIndex = Math.min(index, doc.paths.length - 1);
    normalizePathEditIndex(doc.paths.length);
    commit('Удалить контур');
    setStatus(`Удалён контур «${name}»`);
    return true;
  }

  function editSelectedDocumentPath() {
    const index = normalizeSelectedIndex();
    if (index < 0) return false;
    beginPathEdit(index);
    const path = paths()[index];
    setStatus(`Перо: редактирование сохранённого контура «${path?.name || 'Контур'}»`);
    return true;
  }

  function canApplyPath(path = selectedPath(), layer = getSelectedLayer?.()) {
    return Boolean(path && layer && layer.type !== 'adjustment' && !isLayerLocked(layer, documentValue()));
  }

  function applySelectedDocumentPathAsVectorMask() {
    const path = selectedPath();
    const layer = getSelectedLayer?.();
    if (!path) {
      setStatus('Выберите сохранённый контур');
      return false;
    }
    if (!layer) {
      setStatus('Выберите слой для векторной маски');
      return false;
    }
    if (layer.type === 'adjustment') {
      setStatus('Сохранённый контур как vector mask пока применяется к обычным слоям, не к adjustment layer');
      return false;
    }
    if (isLayerLocked(layer, documentValue())) {
      setStatus('Слой или его группа заблокированы');
      return false;
    }
    const mask = importVectorMask({
      enabled: true,
      invert: false,
      linked: true,
      fillStartsWithAllPixels: path.fillStartsWithAllPixels === true,
      subpaths: path.subpaths,
    }, layer);
    if (!mask) {
      setStatus('Контур не содержит пригодных subpaths');
      return false;
    }
    layer.vectorMask = mask;
    clearVectorMaskEdit();
    commit('Применить контур как векторную маску');
    setStatus(`Контур «${path.name || 'Контур'}» применён как векторная маска`);
    return true;
  }

  function selectForAction(index) {
    setSelectedIndex(index);
    return selectedIndex;
  }

  function pathContextMenu(index) {
    const exists = () => Boolean(paths()[index]);
    return [
      ['Редактировать пером', '', () => { selectForAction(index); editSelectedDocumentPath(); }, exists],
      ['Применить как векторную маску', '', () => { selectForAction(index); applySelectedDocumentPathAsVectorMask(); }, () => exists() && canApplyPath(paths()[index], getSelectedLayer?.())],
      ['sep'],
      ['Переименовать…', '', () => { selectForAction(index); renameSelectedDocumentPath(); }, exists],
      ['Дублировать', '', () => { selectForAction(index); duplicateSelectedDocumentPath(); }, exists],
      ['Удалить', '', () => { selectForAction(index); deleteSelectedDocumentPath(); }, exists],
    ];
  }

  function updateControls(list) {
    const path = selectedPath();
    const layer = getSelectedLayer?.();
    const canSave = Boolean(
      getSelectionShape?.()
      || layer?.vectorMask?.subpaths?.length
      || (layer?.type === 'shape' && layer.shape === 'path' && layer.pathPoints?.length >= 2)
    ) && list.length < SAVED_PATH_LIMIT;
    const enabled = {
      add: canSave,
      edit: Boolean(path),
      applyMask: canApplyPath(path, layer),
      rename: Boolean(path),
      duplicate: Boolean(path && list.length < SAVED_PATH_LIMIT),
      delete: Boolean(path),
    };
    for (const [key, value] of Object.entries(enabled)) {
      if (controls[key]) controls[key].disabled = !value;
    }
    return enabled;
  }

  function updatePathsPanel() {
    const list = paths();
    normalizeSelectedIndex();
    if (pathList && documentRef?.createElement) {
      pathList.replaceChildren();
      if (!list.length) {
        const empty = documentRef.createElement('div');
        empty.className = 'paths-empty';
        empty.textContent = 'Нет сохранённых контуров';
        pathList.append(empty);
      } else {
        list.forEach((path, index) => {
          const row = documentRef.createElement('button');
          row.type = 'button';
          row.className = `path-row${index === selectedIndex ? ' selected' : ''}`;
          row.setAttribute('role', 'option');
          row.setAttribute('aria-selected', String(index === selectedIndex));
          const name = documentRef.createElement('span');
          name.className = 'path-row-name';
          name.textContent = path.name || `Контур ${index + 1}`;
          const count = (path.subpaths || []).reduce((sum, subpath) => sum + (subpath.points?.length || 0), 0);
          const meta = documentRef.createElement('span');
          meta.className = 'path-row-meta';
          meta.textContent = `${path.subpaths?.length || 0} конт. · ${count} узл. · #${path.id ?? 'auto'}`;
          row.append(name, meta);
          row.onclick = () => {
            setSelectedIndex(index, { syncEdit:true });
            updatePathsPanel();
            drawOverlay();
          };
          row.ondblclick = event => {
            event.preventDefault();
            setSelectedIndex(index);
            renameSelectedDocumentPath();
          };
          row.oncontextmenu = event => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedIndex(index);
            updatePathsPanel();
            openContextMenu(`path:${index}`, pathContextMenu(index), event, row);
          };
          row.onkeydown = event => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const next = Math.max(0, Math.min(list.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
            setSelectedIndex(next);
            updatePathsPanel();
            requestFrame(() => pathList.querySelectorAll('.path-row')[next]?.focus());
            drawOverlay();
          };
          pathList.append(row);
        });
      }
    }
    updateControls(list);
    return { selectedIndex, count:list.length };
  }

  function bindControls() {
    const bindings = {
      add: addDocumentPathFromCurrent,
      edit: editSelectedDocumentPath,
      applyMask: applySelectedDocumentPathAsVectorMask,
      rename: renameSelectedDocumentPath,
      duplicate: duplicateSelectedDocumentPath,
      delete: deleteSelectedDocumentPath,
    };
    let bound = 0;
    for (const [key, handler] of Object.entries(bindings)) {
      if (!controls[key]) continue;
      controls[key].onclick = handler;
      bound += 1;
    }
    return bound;
  }

  return {
    getSelectedIndex,
    setSelectedIndex,
    normalizeSelectedIndex,
    selectedPath,
    pathFromCurrentSource,
    addDocumentPathFromCurrent,
    renameSelectedDocumentPath,
    duplicateSelectedDocumentPath,
    deleteSelectedDocumentPath,
    editSelectedDocumentPath,
    applySelectedDocumentPathAsVectorMask,
    pathContextMenu,
    updatePathsPanel,
    bindControls,
  };
}
