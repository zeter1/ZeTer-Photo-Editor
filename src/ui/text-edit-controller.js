import { frameBounds, pointInLayer } from '../core/geometry.js';
import { createTextLayer, documentWithTextPreview, isLayerLocked, isLayerVisible } from '../core/state.js';

const textLayerPreviewHeight = settings =>
  Math.min(12000, Math.max(settings.fontSize * 2.4, settings.fontSize * settings.lineHeight * 2));

export function topVisibleTextLayerAt(documentValue, point) {
  return [...(documentValue?.layers || [])].reverse().find(layer =>
    layer?.type === 'text' && isLayerVisible(documentValue, layer) && pointInLayer(point, layer)
  ) ?? null;
}

export function createTextPreviewSession({
  owner,
  layer = null,
  point = null,
  getDocument = () => owner,
  getSettings,
  getToolOpacity = () => 1,
  isActive = () => true,
  publish = () => {},
  onError = () => {},
} = {}) {
  if (!owner || typeof getSettings !== 'function') {
    throw new Error('Text preview session requires an owner document and settings resolver');
  }
  let generation = 0;
  let closed = false;
  const targetIsCurrent = () => !layer ||
    (owner.layers?.find(item => item.id === layer.id) === layer && !isLayerLocked(owner, layer));
  const isCurrent = () => !closed && isActive() && getDocument() === owner && targetIsCurrent();

  async function update(values) {
    const current = ++generation;
    if (!isCurrent()) return null;
    try {
      const settings = await getSettings(values, layer);
      if (current !== generation || !isCurrent()) return null;
      const draftLayer = createTextLayer({
        ...(layer || {}),
        ...settings,
        x: layer?.x ?? point?.x ?? 0,
        y: layer?.y ?? point?.y ?? 0,
        height: layer?.height ?? textLayerPreviewHeight(settings),
        opacity: layer?.opacity ?? getToolOpacity(),
      });
      const draft = { document: owner, originalId: layer?.id ?? null, layer: draftLayer };
      publish(draft);
      return draft;
    } catch (error) {
      if (current === generation && isCurrent()) onError(error);
      return null;
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    generation += 1;
  }

  return { update, close, isCurrent };
}

export function syncTextPreviewCanvas(draft, {
  documentValue,
  sourceCanvas,
  zoom = 1,
  windowTarget = globalThis.window,
} = {}) {
  const canvas = draft?.previewCanvas;
  if (!draft || draft.document !== documentValue || !canvas?.isConnected || !sourceCanvas) return false;
  const pixelRatio = Number(windowTarget?.devicePixelRatio) || 1;
  const scale = Number(zoom) || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return false;
  const bounds = frameBounds(draft.layer);
  const visibleWidth = width / (scale * pixelRatio);
  const margin = 16 / scale;
  const sourceX = draft.layer.align === 'right' ? bounds.x + bounds.width - visibleWidth + margin
    : draft.layer.align === 'center' ? bounds.x + bounds.width / 2 - visibleWidth / 2
    : bounds.x - margin;
  const sourceY = bounds.y - margin;
  context.clearRect(0, 0, width, height);
  context.setTransform(scale * pixelRatio, 0, 0, scale * pixelRatio, -sourceX * scale * pixelRatio, -sourceY * scale * pixelRatio);
  context.drawImage(sourceCanvas, 0, 0);
  context.setTransform(1, 0, 0, 1, 0, 0);
  canvas.style.setProperty('--preview-bg-x', `${-sourceX * scale}px`);
  canvas.style.setProperty('--preview-bg-y', `${-sourceY * scale}px`);
  return true;
}

export function createTextEditController({ state = {}, text = {}, renderApi = {}, ui = {} } = {}) {
  const {
    getDocument = () => null,
    getSelectedLayer = () => null,
    selectLayer = () => {},
    addLayer: addLayerToDocument = () => {},
    commit = () => {},
  } = state;
  const { fields = () => [], settingsFromForm = async () => ({}) } = text;
  const {
    render = () => {},
    updateLayers = () => {},
    refreshInspectorPanels = () => {},
    drawOverlay = () => {},
    getSourceCanvas = () => null,
    getZoom = () => 1,
    getToolOpacity = () => 1,
  } = renderApi;
  const {
    showModal,
    setStatus = () => {},
    toast = () => {},
    documentRef = globalThis.document,
    windowTarget = globalThis.window,
    ResizeObserverClass = globalThis.ResizeObserver,
    FormDataClass = globalThis.FormData,
  } = ui;
  if (typeof showModal !== 'function') throw new Error('Text edit controller requires showModal');

  let activeDraft = null;

  function getDraft(documentValue = getDocument()) {
    if (!activeDraft || activeDraft.document !== documentValue) return null;
    if (activeDraft.originalLayer &&
        documentValue?.layers?.find(item => item.id === activeDraft.originalLayer.id) !== activeDraft.originalLayer) {
      return null;
    }
    return activeDraft;
  }

  function documentWithPreview(documentValue = getDocument()) {
    return documentWithTextPreview(documentValue, getDraft(documentValue));
  }

  function previewLayer(documentValue = getDocument()) {
    return getDraft(documentValue)?.layer ?? null;
  }

  function syncPreviewCanvas() {
    const documentValue = getDocument();
    return syncTextPreviewCanvas(getDraft(documentValue), {
      documentValue,
      sourceCanvas: getSourceCanvas(),
      zoom: getZoom(),
      windowTarget,
    });
  }

  function clearDraftForModal(modal) {
    if (activeDraft?.owner !== modal) return false;
    activeDraft = null;
    return true;
  }

  function attachPreview({ modal, body, owner, layer = null, point = null }) {
    const preview = documentRef.createElement('section');
    preview.className = 'text-preview';
    const heading = documentRef.createElement('strong');
    heading.textContent = 'Предпросмотр';
    const canvas = documentRef.createElement('canvas');
    canvas.setAttribute('aria-label', 'Предпросмотр текста на фоне изображения');
    const status = documentRef.createElement('small');
    status.textContent = 'Фрагмент холста в месте текста';
    preview.append(heading, canvas, status);
    body.prepend(preview);

    const session = createTextPreviewSession({
      owner,
      layer,
      point,
      getDocument,
      getSettings: settingsFromForm,
      getToolOpacity,
      isActive: () => modal.isConnected,
      publish: draft => {
        activeDraft = { ...draft, owner: modal, originalLayer: layer, previewCanvas: canvas };
        render();
        status.textContent = 'Фрагмент холста в месте текста';
      },
      onError: error => { status.textContent = error?.message || 'Ошибка предпросмотра'; },
    });
    const observer = typeof ResizeObserverClass === 'function' ? new ResizeObserverClass(syncPreviewCanvas) : null;
    observer?.observe(canvas);
    const priorCleanup = modal.previewCleanup;
    modal.previewCleanup = () => {
      session.close();
      observer?.disconnect();
      priorCleanup?.();
    };

    const update = () => {
      const values = Object.fromEntries(new FormDataClass(modal));
      void session.update(values);
    };
    modal.addEventListener('input', event => {
      if (event.target.name === 'systemFontName' && event.target.value.trim()) modal.elements.fontFile.value = '';
      if (event.target.matches('input,textarea,select')) update();
    });
    modal.addEventListener('change', event => {
      if (event.target.name === 'fontFamily') {
        modal.elements.systemFontName.value = '';
        modal.elements.fontFile.value = '';
      }
      if (event.target.name === 'fontFile' && event.target.files?.[0]?.name) modal.elements.systemFontName.value = '';
      if (event.target.matches('input,textarea,select')) update();
    });
    update();
    return session;
  }

  function open(point) {
    const owner = getDocument();
    if (!owner) return false;
    const existing = topVisibleTextLayerAt(owner, point);
    if (existing) {
      selectLayer(owner, existing);
      updateLayers();
      refreshInspectorPanels();
      drawOverlay();
      if (isLayerLocked(owner, existing)) {
        setStatus('Текстовый слой заблокирован');
        toast('Сначала разблокируйте слой или его группу', 'warn');
        return false;
      }
      let modalOwner = null;
      let previewSession = null;
      showModal({
        title: 'Редактировать текст',
        className: 'text-modal',
        fields: fields(existing, existing.width),
        submitLabel: 'Применить',
        onMount: ({ modal, body }) => {
          modalOwner = modal;
          previewSession = attachPreview({ modal, body, owner, layer: existing });
        },
        onClose: ({ modal }) => {
          previewSession?.close();
          if (clearDraftForModal(modal)) render();
        },
        onSubmit: async (values, isActive) => {
          const settings = await settingsFromForm(values, existing);
          if (!isActive() || getDocument() !== owner || getSelectedLayer() !== existing ||
              owner.layers?.find(item => item.id === existing.id) !== existing || isLayerLocked(owner, existing)) {
            return false;
          }
          previewSession?.close();
          clearDraftForModal(modalOwner);
          Object.assign(existing, settings);
          commit('Редактировать текст');
        },
      });
      return true;
    }

    const defaultWidth = Math.max(240, Math.min(owner.width - point.x, 600));
    let modalOwner = null;
    let previewSession = null;
    showModal({
      title: 'Добавить текст',
      className: 'text-modal',
      fields: fields(null, defaultWidth),
      submitLabel: 'Добавить',
      onMount: ({ modal, body }) => {
        modalOwner = modal;
        previewSession = attachPreview({ modal, body, owner, point });
      },
      onClose: ({ modal }) => {
        previewSession?.close();
        if (clearDraftForModal(modal)) render();
      },
      onSubmit: async (values, isActive) => {
        const settings = await settingsFromForm(values);
        if (!isActive() || getDocument() !== owner) return false;
        previewSession?.close();
        clearDraftForModal(modalOwner);
        addLayerToDocument(owner, createTextLayer({
          x: point.x,
          y: point.y,
          ...settings,
          opacity: getToolOpacity(),
          height: textLayerPreviewHeight(settings),
        }));
        commit('Добавить текст');
      },
    });
    return true;
  }

  return { open, getDraft, documentWithPreview, previewLayer, syncPreviewCanvas };
}
