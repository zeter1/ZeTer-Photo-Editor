import { selectionBounds, selectionPathPoints } from '../core/geometry.js';
import { createVectorMask, isLayerLocked } from '../core/state.js';

export function createSelectionVectorMaskController({
  state = {},
  selection = {},
  geometry = {},
  edit = {},
  ui = {},
} = {}) {
  const {
    getDocument = () => null,
    getSelectedLayer = () => null,
    commit = () => {},
  } = state;
  const { getSelectionShape = () => null } = selection;
  const boundsForSelection = geometry.selectionBounds || selectionBounds;
  const pathPointsForSelection = geometry.selectionPathPoints || selectionPathPoints;
  const documentPointToLayer = geometry.documentPointToLayer || (point => ({ ...point }));
  const {
    beginVectorMaskEdit = () => {},
    clearVectorMaskEdit = () => {},
  } = edit;
  const {
    setStatus = () => {},
    toast = () => {},
  } = ui;

  function selectionVectorMaskDocumentNodes(shape = getSelectionShape()) {
    if (!shape) return [];
    if (shape.type === 'rect') {
      const rect = boundsForSelection(shape);
      if (!rect || rect.width <= 0 || rect.height <= 0) return [];
      return [
        { x:rect.x, y:rect.y },
        { x:rect.x + rect.width, y:rect.y },
        { x:rect.x + rect.width, y:rect.y + rect.height },
        { x:rect.x, y:rect.y + rect.height },
      ];
    }
    if (shape.type === 'ellipse') {
      const rect = boundsForSelection(shape);
      if (!rect || rect.width <= 0 || rect.height <= 0) return [];
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const rx = rect.width / 2;
      const ry = rect.height / 2;
      const k = .5522847498307936;
      return [
        { x:cx + rx, y:cy, handleIn:{ x:cx + rx, y:cy - k * ry }, handleOut:{ x:cx + rx, y:cy + k * ry }, kind:'smooth' },
        { x:cx, y:cy + ry, handleIn:{ x:cx + k * rx, y:cy + ry }, handleOut:{ x:cx - k * rx, y:cy + ry }, kind:'smooth' },
        { x:cx - rx, y:cy, handleIn:{ x:cx - rx, y:cy + k * ry }, handleOut:{ x:cx - rx, y:cy - k * ry }, kind:'smooth' },
        { x:cx, y:cy - ry, handleIn:{ x:cx - k * rx, y:cy - ry }, handleOut:{ x:cx + k * rx, y:cy - ry }, kind:'smooth' },
      ];
    }
    return pathPointsForSelection(shape, 72).map(point => ({ x:point.x, y:point.y }));
  }

  function selectionVectorMaskSubpath(layer, operation = 'add', shape = getSelectionShape()) {
    const nodes = selectionVectorMaskDocumentNodes(shape);
    if (nodes.length < 3) return null;
    const localize = node => {
      const anchor = documentPointToLayer(node, layer);
      return {
        x:anchor.x,
        y:anchor.y,
        handleIn:node.handleIn ? documentPointToLayer(node.handleIn, layer) : null,
        handleOut:node.handleOut ? documentPointToLayer(node.handleOut, layer) : null,
        kind:node.kind === 'smooth' ? 'smooth' : 'corner',
      };
    };
    return {
      operation:['add', 'subtract', 'intersect', 'exclude'].includes(operation) ? operation : 'add',
      closed:true,
      points:nodes.map(localize),
    };
  }

  function applySelectionToVectorMask(operation = 'replace') {
    const documentValue = getDocument();
    const layer = getSelectedLayer();
    if (!layer) {
      setStatus('Сначала выберите слой');
      return false;
    }
    const shape = getSelectionShape();
    if (!shape) {
      setStatus('Сначала создайте выделение');
      return false;
    }
    if (isLayerLocked(documentValue, layer)) {
      setStatus('Слой или его группа заблокированы');
      return false;
    }
    const subpath = selectionVectorMaskSubpath(layer, operation === 'replace' ? 'add' : operation, shape);
    if (!subpath) {
      setStatus('Выделение слишком мало для векторной маски');
      return false;
    }
    if (operation === 'replace' || !layer.vectorMask) {
      layer.vectorMask = createVectorMask({ enabled:true, invert:false, subpaths:[subpath] });
    } else {
      if (layer.vectorMask.subpaths.length >= 128) {
        const message = 'Векторная маска ограничена 128 контурами';
        setStatus(message);
        toast(message, 'warn');
        return false;
      }
      layer.vectorMask.subpaths.push(subpath);
      layer.vectorMask.enabled = true;
    }
    const labels = {
      replace:'Создать векторную маску',
      add:'Добавить контур к векторной маске',
      subtract:'Вычесть контур из векторной маски',
      intersect:'Пересечь контуры векторной маски',
      exclude:'Исключить пересечение векторной маски',
    };
    commit(labels[operation] || labels.replace);
    setStatus(`Векторная маска: ${layer.vectorMask.subpaths.length} контур(ов)`);
    return true;
  }

  function editSelectedVectorMask() {
    const documentValue = getDocument();
    const layer = getSelectedLayer();
    if (!layer?.vectorMask) {
      setStatus('У выбранного слоя нет векторной маски');
      return false;
    }
    if (isLayerLocked(documentValue, layer)) {
      setStatus('Слой или его группа заблокированы');
      return false;
    }
    beginVectorMaskEdit(layer.id);
    setStatus('Перо: редактирование векторной маски — перетаскивайте anchors и Bézier-handles');
    return true;
  }

  function toggleSelectedVectorMask() {
    const documentValue = getDocument();
    const layer = getSelectedLayer();
    if (!layer?.vectorMask || isLayerLocked(documentValue, layer)) return;
    layer.vectorMask.enabled = layer.vectorMask.enabled === false;
    commit(layer.vectorMask.enabled ? 'Включить векторную маску' : 'Отключить векторную маску');
  }

  function invertSelectedVectorMask() {
    const documentValue = getDocument();
    const layer = getSelectedLayer();
    if (!layer?.vectorMask || isLayerLocked(documentValue, layer)) return;
    layer.vectorMask.invert = !layer.vectorMask.invert;
    commit(layer.vectorMask.invert ? 'Инвертировать векторную маску' : 'Отменить инверсию векторной маски');
  }

  function removeSelectedVectorMask() {
    const documentValue = getDocument();
    const layer = getSelectedLayer();
    if (!layer?.vectorMask || isLayerLocked(documentValue, layer)) return;
    clearVectorMaskEdit(layer.id);
    layer.vectorMask = null;
    commit('Удалить векторную маску');
    setStatus('Векторная маска удалена');
  }

  return {
    selectionVectorMaskDocumentNodes,
    selectionVectorMaskSubpath,
    applySelectionToVectorMask,
    editSelectedVectorMask,
    toggleSelectedVectorMask,
    invertSelectedVectorMask,
    removeSelectedVectorMask,
  };
}
