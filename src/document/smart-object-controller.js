import { frameBounds } from '../core/geometry.js';
import { layerStyleOutset } from '../core/layer-styles.js';
import {
  createDocument,
  createSmartObjectLayer,
  createSmartObjectLinkId,
  linkedSmartObjectLayers,
  duplicateLayer,
  snapshotDocument,
  restoreDocument,
  touch,
  checkedCanvasSize,
} from '../core/state.js';

export function createSmartObjectController({
  runtime = {},
  sessions = {},
  rendering = {},
  photoshop = {},
  ui = {},
  maxNestedDepth = 3,
} = {}) {
  const {
    getDocument,
    getActiveSessionId,
    setActiveSessionId,
    getSelectedLayer,
    getZoom,
    blockPendingDocumentEdit,
    isLayerLocked,
    commit,
    updateAll,
    fitToView,
    queueRecovery,
    invalidateImageCache,
    setActiveDocument,
    setDirty,
  } = runtime;
  const {
    getAll: getSessions,
    current: currentSession,
    syncCurrent: syncCurrentSession,
    build: buildSession,
    load: loadSession,
    activate: activateDocumentTab,
    renderTabs: renderDocumentTabs,
  } = sessions;
  const { renderPreview } = rendering;
  const {
    isLayer: isPhotoshopLayer = layer => Boolean(layer?.psdSmartObject),
    sourceId: photoshopSourceId = layer => layer?.psdSmartObject?.uniqueId || null,
    findLayers: findPhotoshopLayers = (owner, uniqueId) => {
      if (!owner || !uniqueId) return [];
      return (owner.layers || []).filter(layer =>
        layer?.type === 'smart-object' && layer.psdSmartObject?.uniqueId === uniqueId
      );
    },
    rewriteEmbeddedSource = async () => ({ rewritten:false, reason:'resource rewrite недоступен' }),
    publishEmbeddedSourceRewrite = () => {},
    updateTargetAfterRewrite = () => {},
  } = photoshop;
  const {
    setStatus = () => {},
    toast = () => {},
    consoleRef = globalThis.console,
  } = ui;

  function smartObjectLinkedCount(layer, owner = getDocument()) {
    const photoshopId = photoshopSourceId(layer);
    if (photoshopId) return Math.max(1, findPhotoshopLayers(owner, photoshopId).length);
    if (!layer?.linkedSourceId) return 1;
    return Math.max(1, linkedSmartObjectLayers(owner, layer.linkedSourceId).length);
  }

  function createLinkedCopy(layer = getSelectedLayer()) {
    if (blockPendingDocumentEdit()) return null;
    const documentValue = getDocument();
    if (!layer || layer.type !== 'smart-object' || !layer.embeddedDocument) {
      setStatus('Нужен смарт-объект со встроенным содержимым');
      return null;
    }
    if (isPhotoshopLayer(layer)) {
      setStatus('Photoshop Smart Object уже использует native UUID/source identity; обычная ZPE linked-copy для него отключена');
      return null;
    }
    if (isLayerLocked(documentValue, layer)) {
      setStatus('Смарт-объект или его группа заблокированы');
      return null;
    }
    const linkedSourceId = layer.linkedSourceId || createSmartObjectLinkId();
    const copy = duplicateLayer(documentValue, layer.id);
    if (!copy) return null;
    layer.linkedSourceId = linkedSourceId;
    copy.linkedSourceId = linkedSourceId;
    copy.name = (layer.name || 'Смарт-объект') + ' — связанная копия';
    commit('Создать связанную копию смарт-объекта');
    setStatus('Создана связанная копия. Экземпляров источника: ' + smartObjectLinkedCount(copy, documentValue));
    return copy;
  }

  function unlink(layer = getSelectedLayer()) {
    if (blockPendingDocumentEdit()) return false;
    const documentValue = getDocument();
    if (!layer || layer.type !== 'smart-object' || isLayerLocked(documentValue, layer)) return false;
    if (!layer.linkedSourceId) {
      setStatus('Смарт-объект уже независимый');
      return false;
    }
    layer.linkedSourceId = null;
    commit('Разорвать связь смарт-объекта');
    setStatus('Смарт-объект стал независимым; текущее встроенное содержимое сохранено');
    return true;
  }

  function sessionDepth(session = currentSession()) {
    let depth = 0;
    let current = session;
    const visited = new Set();
    while (current?.smartObjectLink) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      depth += 1;
      current = getSessions().find(item => item.id === current.smartObjectLink.parentSessionId);
    }
    return depth;
  }

  function sourceBounds(layer) {
    const scale = Math.max(Math.abs(Number(layer.scaleX) || 1), Math.abs(Number(layer.scaleY) || 1));
    const blur = Math.max(0, Number(layer.filters?.blur) || 0) * scale * 3;
    const stroke = layer.type === 'shape' ? Math.max(0, Number(layer.strokeWidth) || 0) * scale / 2 : 0;
    const bounds = frameBounds(layer, Math.ceil(blur + stroke + layerStyleOutset(layer.styles) * scale + 2));
    const x = Math.floor(bounds.x);
    const y = Math.floor(bounds.y);
    const width = Math.max(1, Math.ceil(bounds.x + bounds.width) - x);
    const height = Math.max(1, Math.ceil(bounds.y + bounds.height) - y);
    checkedCanvasSize(width, height, 'Смарт-объект «' + (layer.name || 'Без имени') + '»');
    return { x, y, width, height };
  }

  async function convertSelected() {
    if (blockPendingDocumentEdit()) return;
    const source = getSelectedLayer();
    const documentValue = getDocument();
    if (!source || source.type === 'smart-object' || source.type === 'adjustment' || isLayerLocked(documentValue, source)) return;
    if (sessionDepth() >= maxNestedDepth) {
      const message = 'Достигнут лимит вложенности смарт-объектов: ' + maxNestedDepth + ' уровня';
      setStatus(message);
      toast(message, 'warn');
      return;
    }

    const targetSessionId = getActiveSessionId();
    const index = documentValue.layers.indexOf(source);
    const original = JSON.stringify(source);
    const bounds = sourceBounds(source);
    const embedded = createDocument({
      name:(source.name || 'Слой') + ' — содержимое',
      width:bounds.width,
      height:bounds.height,
      background:'transparent',
    });
    const inner = structuredClone(source);
    inner.x -= bounds.x;
    inner.y -= bounds.y;
    inner.opacity = 1;
    inner.blendMode = 'source-over';
    inner.visible = true;
    inner.locked = false;
    inner.groupId = null;
    embedded.layers = [inner];
    embedded.selectedLayerId = inner.id;
    setStatus('Создание смарт-объекта…');

    try {
      const previewDataUrl = await renderPreview(embedded);
      if (
        getDocument() !== documentValue ||
        getActiveSessionId() !== targetSessionId ||
        documentValue.layers[index] !== source ||
        JSON.stringify(source) !== original
      ) {
        setStatus('Преобразование в смарт-объект отменено: слой изменился');
        return;
      }
      const smart = createSmartObjectLayer({
        id:source.id,
        name:source.name || 'Смарт-объект',
        visible:source.visible,
        locked:false,
        opacity:source.opacity,
        blendMode:source.blendMode,
        groupId:source.groupId ?? null,
        x:bounds.x,
        y:bounds.y,
        width:bounds.width,
        height:bounds.height,
        previewDataUrl,
        embeddedDocument:embedded,
      });
      documentValue.layers.splice(index, 1, smart);
      documentValue.selectedLayerId = smart.id;
      commit('Преобразовать в смарт-объект');
      setStatus('Слой преобразован в смарт-объект');
    } catch (error) {
      consoleRef?.error?.(error);
      setStatus('Ошибка создания смарт-объекта: ' + error.message);
      toast('Не удалось создать смарт-объект', 'error');
    }
  }

  function openContents(layer = getSelectedLayer()) {
    if (blockPendingDocumentEdit()) return;
    const documentValue = getDocument();
    if (!layer || layer.type !== 'smart-object' || !layer.embeddedDocument) {
      setStatus('У смарт-объекта нет встроенного содержимого');
      return;
    }
    if (isLayerLocked(documentValue, layer)) {
      setStatus('Смарт-объект или его группа заблокированы');
      return;
    }

    syncCurrentSession();
    const parentSessionId = getActiveSessionId();
    const linkedSourceId = layer.linkedSourceId || null;
    const photoshopId = photoshopSourceId(layer);
    const allSessions = getSessions();
    const existing = allSessions.find(session =>
      session.smartObjectLink?.parentSessionId === parentSessionId && (
        linkedSourceId ? session.smartObjectLink?.linkedSourceId === linkedSourceId :
        photoshopId ? session.smartObjectLink?.photoshopSourceId === photoshopId :
        session.smartObjectLink?.layerId === layer.id
      )
    );
    if (existing) {
      activateDocumentTab(existing.id, { focusViewport:true });
      return;
    }

    const count = smartObjectLinkedCount(layer, documentValue);
    const content = restoreDocument(snapshotDocument(layer.embeddedDocument));
    content.name = (layer.name || 'Смарт-объект') + ' — содержимое';
    const session = buildSession(content, {
      label:'Содержимое смарт-объекта',
      zoomLevel:getZoom?.() ?? 0.75,
      dirtyState:false,
      smartObjectLink:{
        parentSessionId,
        layerId:layer.id,
        linkedSourceId,
        photoshopSourceId:photoshopId,
      },
    });
    const parentIndex = allSessions.findIndex(item => item.id === parentSessionId);
    allSessions.splice(parentIndex + 1, 0, session);
    setActiveSessionId(session.id);
    loadSession(session);
    updateAll();
    fitToView();
    setStatus(
      linkedSourceId || photoshopId
        ? 'Содержимое общего источника открыто. Ctrl+S обновит ' + count + ' экземпляр(а).'
        : 'Содержимое смарт-объекта открыто. Ctrl+S обновит родительский слой.'
    );
  }

  function parentLayerFor(parentSession, link) {
    let layer = parentSession?.doc?.layers?.find(item => item.id === link.layerId && item.type === 'smart-object') || null;
    if (!layer && parentSession && link.linkedSourceId) {
      layer = linkedSmartObjectLayers(parentSession.doc, link.linkedSourceId)[0] || null;
    }
    if (!layer && parentSession && link.photoshopSourceId) {
      layer = findPhotoshopLayers(parentSession.doc, link.photoshopSourceId)[0] || null;
    }
    return layer;
  }

  async function saveContent(session = currentSession()) {
    if (!session?.smartObjectLink) return false;
    if (blockPendingDocumentEdit()) return false;
    syncCurrentSession();

    const link = session.smartObjectLink;
    const originatingSessionId = session.id;
    const sourceSnapshot = snapshotDocument(session.doc);
    const contentStillCurrent = () =>
      getActiveSessionId() === originatingSessionId &&
      currentSession() === session &&
      snapshotDocument(session.doc) === sourceSnapshot;
    const parentSession = getSessions().find(item => item.id === link.parentSessionId);
    const parentLayer = parentLayerFor(parentSession, link);
    if (!parentSession || !parentLayer) {
      const message = 'Родительский смарт-объект больше недоступен';
      setStatus(message);
      toast(message, 'error');
      return false;
    }
    if (isLayerLocked(parentSession.doc, parentLayer)) {
      const message = 'Родительский смарт-объект заблокирован: разблокируйте его перед сохранением содержимого';
      setStatus(message);
      toast(message, 'warn');
      return false;
    }

    const linkedSourceId = parentLayer.linkedSourceId || null;
    const photoshopId = photoshopSourceId(parentLayer) || link.photoshopSourceId || null;
    const targetsFor = (owner, layer) => linkedSourceId
      ? linkedSmartObjectLayers(owner, linkedSourceId)
      : photoshopId ? findPhotoshopLayers(owner, photoshopId) : [layer];
    const initialTargets = targetsFor(parentSession.doc, parentLayer);
    const embedded = restoreDocument(sourceSnapshot);
    setStatus(
      linkedSourceId || photoshopId
        ? 'Обновление общего источника: ' + initialTargets.length + ' экземпляр(а)…'
        : 'Обновление смарт-объекта…'
    );

    try {
      const previewDataUrl = await renderPreview(embedded);
      if (!contentStillCurrent()) {
        setStatus('Обновление смарт-объекта отменено: содержимое или активная вкладка изменились');
        return false;
      }

      const liveParent = getSessions().find(item => item.id === link.parentSessionId);
      const liveLayer = parentLayerFor(liveParent, {
        ...link,
        linkedSourceId,
        photoshopSourceId:photoshopId,
      });
      if (
        liveParent !== parentSession ||
        !liveLayer ||
        (linkedSourceId && liveLayer.linkedSourceId !== linkedSourceId) ||
        (photoshopId && photoshopSourceId(liveLayer) !== photoshopId)
      ) {
        setStatus('Обновление смарт-объекта отменено: родитель изменился');
        return false;
      }

      let photoshopRewrite = null;
      if (photoshopId) {
        try {
          photoshopRewrite = await rewriteEmbeddedSource(liveParent.doc, liveLayer, embedded, previewDataUrl);
        } catch (error) {
          consoleRef?.warn?.('Photoshop Smart Object resource rewrite skipped', error);
          photoshopRewrite = { rewritten:false, reason:error?.message || String(error) };
        }
      }

      if (!contentStillCurrent()) {
        setStatus('Обновление смарт-объекта отменено: содержимое или активная вкладка изменились');
        return false;
      }
      const publishParent = getSessions().find(item => item.id === link.parentSessionId);
      const publishLayer = parentLayerFor(publishParent, {
        ...link,
        linkedSourceId,
        photoshopSourceId:photoshopId,
      });
      if (
        publishParent !== parentSession ||
        !publishLayer ||
        (linkedSourceId && publishLayer.linkedSourceId !== linkedSourceId) ||
        (photoshopId && photoshopSourceId(publishLayer) !== photoshopId)
      ) {
        setStatus('Обновление смарт-объекта отменено: родитель изменился');
        return false;
      }

      const liveTargets = targetsFor(publishParent.doc, publishLayer);
      if (!liveTargets.length) {
        setStatus('Обновление смарт-объекта отменено: связанные экземпляры удалены');
        return false;
      }
      if (photoshopRewrite?.rewritten) {
        publishEmbeddedSourceRewrite(publishParent.doc, photoshopRewrite);
      }

      const embeddedSnapshot = snapshotDocument(embedded);
      const oldPreviews = new Set();
      for (const target of liveTargets) {
        if (target.previewDataUrl) oldPreviews.add(target.previewDataUrl);
        target.embeddedDocument = restoreDocument(embeddedSnapshot);
        target.previewDataUrl = previewDataUrl;
        if (!isPhotoshopLayer(target)) {
          target.width = embedded.width;
          target.height = embedded.height;
        } else if (photoshopRewrite?.rewritten) {
          updateTargetAfterRewrite(target, {
            rewrite:photoshopRewrite,
            previewDataUrl,
            embedded,
          });
        }
      }

      touch(parentSession.doc);
      parentSession.history.push(
        liveTargets.length > 1 ? 'Обновить общий источник смарт-объектов' : 'Обновить смарт-объект',
        snapshotDocument(parentSession.doc),
      );
      parentSession.dirty = true;
      session.doc = embedded;
      session.dirty = false;
      setActiveDocument(embedded);
      setDirty(false);
      session.smartObjectLink = {
        ...link,
        layerId:publishLayer.id,
        linkedSourceId,
        photoshopSourceId:photoshopId,
      };
      for (const oldPreview of oldPreviews) invalidateImageCache(oldPreview);
      renderDocumentTabs();
      queueRecovery({ immediate:true });

      if (photoshopId) {
        if (photoshopRewrite?.rewritten) {
          setStatus(
            'Photoshop Smart Object обновлён: embedded ' + (photoshopRewrite.type || 'asset') +
            ' переписан в native linked resource (' + photoshopRewrite.newSize +
            ' bytes), экземпляров: ' + liveTargets.length
          );
          toast('Embedded Photoshop Smart Object обновлён без raster fallback', 'success');
        } else {
          setStatus(
            'Содержимое обновлено; native Photoshop passthrough отключён: ' +
            (photoshopRewrite?.reason || 'resource rewrite недоступен')
          );
          toast('Содержимое сохранено; PSD/PSB использует безопасный raster fallback', 'warn');
        }
      } else {
        setStatus(
          liveTargets.length > 1
            ? 'Связанный источник обновлён: ' + liveTargets.length + ' экземпляр(а)'
            : 'Смарт-объект обновлён в родительском документе'
        );
        toast(
          liveTargets.length > 1
            ? 'Связанные смарт-объекты обновлены'
            : 'Содержимое смарт-объекта сохранено',
          'success'
        );
      }
      return true;
    } catch (error) {
      consoleRef?.error?.(error);
      setStatus('Ошибка обновления смарт-объекта: ' + error.message);
      toast('Не удалось обновить смарт-объект', 'error');
      return false;
    }
  }

  return {
    smartObjectLinkedCount,
    createLinkedCopy,
    unlink,
    sessionDepth,
    sourceBounds,
    convertSelected,
    openContents,
    saveContent,
  };
}
