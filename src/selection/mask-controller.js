import { clamp } from '../core/geometry.js';
import { checkedCanvasSize, createLayerMask, isLayerLocked } from '../core/state.js';
import { canvasToDataURL } from '../core/io.js';
import { composeMaskPreviewRgba, refineMaskAlpha } from '../core/pixels.js';

export function createSelectionMaskController({
  state = {},
  selection = {},
  rendering = {},
  ui = {},
} = {}) {
  const {
    getDocument = () => null,
    getSelectedLayer = () => null,
    commit = () => {},
  } = state;
  const {
    getSelectionShape = () => null,
    traceDocumentSelectionPath = () => false,
    selectionPolygonForLayer = () => null,
  } = selection;
  const {
    renderLayer = async () => {},
    getSourceCanvas = () => null,
  } = rendering;
  const {
    showModal = () => {},
    setStatus = () => {},
    toast = () => {},
    documentRef = globalThis.document,
    FormDataClass = globalThis.FormData,
    requestFrame = callback => globalThis.requestAnimationFrame(callback),
    cancelFrame = id => globalThis.cancelAnimationFrame(id),
    consoleRef = globalThis.console,
  } = ui;

  const previewOwners = new WeakMap();

  function currentTarget(ownerDocument, layer, { requireMaskAbsent = false } = {}) {
    if (!ownerDocument || getDocument() !== ownerDocument || getSelectedLayer() !== layer) return false;
    if (isLayerLocked(ownerDocument, layer)) return false;
    if (requireMaskAbsent && layer?.mask) return false;
    return true;
  }

  async function selectionRefineSourceRgba(layer, sourceWidth, sourceHeight, scale = 1, ownerDocument = getDocument()) {
    const factor = Math.max(.0001, Number(scale) || 1);
    const width = Math.max(1, Math.round(sourceWidth * factor));
    const height = Math.max(1, Math.round(sourceHeight * factor));
    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:true });
    if (layer.type === 'adjustment') {
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(getSourceCanvas(), 0, 0, ownerDocument.width, ownerDocument.height, 0, 0, width, height);
    } else {
      ctx.scale(factor, factor);
      const plain = {
        ...layer,
        mask:null,
        styles:null,
        opacity:1,
        blendMode:'source-over',
        x:0,
        y:0,
        scaleX:1,
        scaleY:1,
        rotation:0,
        width:sourceWidth,
        height:sourceHeight,
      };
      await renderLayer(ctx, plain);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return ctx.getImageData(0, 0, width, height).data;
  }

  async function selectionMaskDataUrlForOwner(
    layer,
    { smooth=0, shift=0, edgeRadius=0, edgeStrength=60, smartRadius=true, feather=0, contrast=0, invert=false } = {},
    ownerDocument = getDocument(),
    shape = getSelectionShape(),
  ) {
    if (!shape || !ownerDocument || !layer) return null;
    const width = layer.type === 'adjustment' ? ownerDocument.width : Math.max(1, Math.round(layer.width || 1));
    const height = layer.type === 'adjustment' ? ownerDocument.height : Math.max(1, Math.round(layer.height || 1));
    checkedCanvasSize(width, height, 'Маска слоя');

    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:true });
    ctx.fillStyle = '#ffffff';
    if (layer.type === 'adjustment') {
      if (traceDocumentSelectionPath(ctx, shape)) ctx.fill();
    } else {
      const polygon = selectionPolygonForLayer(layer, shape);
      if (polygon?.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let index = 1; index < polygon.length; index += 1) ctx.lineTo(polygon[index].x, polygon[index].y);
        ctx.closePath();
        ctx.fill();
      }
    }

    const needsRefine = Number(smooth) > 0 || Number(shift) !== 0 || Number(edgeRadius) > 0 || Number(feather) > 0 || Number(contrast) > 0 || Boolean(invert);
    if (needsRefine) {
      const pixels = width * height;
      if (pixels > 12_000_000) {
        throw new Error('Уточнение края ограничено маской до 12 МП. Уменьшите слой или используйте обычную маску из выделения.');
      }
      const detectionRadius = clamp(Math.round(Number(edgeRadius) || 0), 0, 12);
      if (detectionRadius > 0 && pixels * Math.max(1, detectionRadius) > 48_000_000) {
        throw new Error('Умный радиус слишком тяжёлый для этой маски. Уменьшите радиус или размер слоя.');
      }
      const image = ctx.getImageData(0, 0, width, height);
      const alpha = new Uint8ClampedArray(pixels);
      for (let index = 0; index < pixels; index += 1) alpha[index] = image.data[index * 4 + 3];
      const sourceRgba = detectionRadius > 0
        ? await selectionRefineSourceRgba(layer, width, height, 1, ownerDocument)
        : null;
      const refined = refineMaskAlpha(alpha, width, height, {
        smooth,
        shift,
        edgeRadius:detectionRadius,
        edgeStrength,
        smartRadius,
        sourceRgba,
        feather,
        contrast,
        invert,
      });
      for (let index = 0; index < pixels; index += 1) {
        const offset = index * 4;
        image.data[offset] = 255;
        image.data[offset + 1] = 255;
        image.data[offset + 2] = 255;
        image.data[offset + 3] = refined[index];
      }
      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(image, 0, 0);
    }
    return canvasToDataURL(canvas, 'image/png');
  }

  function selectionMaskDataUrl(layer, options = {}) {
    return selectionMaskDataUrlForOwner(layer, options, getDocument(), getSelectionShape());
  }

  async function addSelectedLayerMask(fromSelection = false) {
    const ownerDocument = getDocument();
    const layer = getSelectedLayer();
    if (!layer) {
      setStatus('Сначала выберите слой');
      return false;
    }
    if (isLayerLocked(ownerDocument, layer)) {
      setStatus('Слой или его группа заблокированы');
      return false;
    }
    if (layer.mask) {
      setStatus('У слоя уже есть маска');
      return false;
    }
    const shape = getSelectionShape();
    if (fromSelection && !shape) {
      setStatus('Сначала создайте выделение');
      return false;
    }

    const dataUrl = fromSelection
      ? await selectionMaskDataUrlForOwner(layer, {}, ownerDocument, shape)
      : null;

    if (!currentTarget(ownerDocument, layer, { requireMaskAbsent:true })) return false;
    layer.mask = createLayerMask({ enabled:true, dataUrl });
    commit(fromSelection ? 'Добавить маску из выделения' : 'Добавить маску слоя');
    setStatus(fromSelection ? 'Маска слоя создана из текущего выделения' : 'Добавлена маска «показать всё»');
    return true;
  }

  function selectionRefineOptionsFromValues(values, scale = 1) {
    const factor = Math.max(.0001, Number(scale) || 1);
    return {
      smooth:clamp(Number(values?.smooth) || 0, 0, 32) / factor,
      shift:clamp(Number(values?.shift) || 0, -64, 64) / factor,
      edgeRadius:clamp(Number(values?.edgeRadius) || 0, 0, 12) / factor,
      edgeStrength:clamp(Number(values?.edgeStrength) || 0, 0, 100),
      smartRadius:values?.smartRadius !== 'no',
      feather:clamp(Number(values?.feather) || 0, 0, 64) / factor,
      contrast:clamp(Number(values?.contrast) || 0, 0, 100),
      invert:values?.invert === 'yes',
    };
  }

  async function buildSelectionRefinePreviewSource(
    layer,
    { maxWidth=420, maxHeight=240 } = {},
    ownerDocument = getDocument(),
    shape = getSelectionShape(),
  ) {
    if (!shape || !layer || !ownerDocument) return null;
    const sourceWidth = layer.type === 'adjustment' ? ownerDocument.width : Math.max(1, Math.round(layer.width || 1));
    const sourceHeight = layer.type === 'adjustment' ? ownerDocument.height : Math.max(1, Math.round(layer.height || 1));
    const previewScale = Math.max(.0001, Math.min(2, maxWidth / sourceWidth, maxHeight / sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * previewScale));
    const height = Math.max(1, Math.round(sourceHeight * previewScale));
    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:true });
    ctx.scale(previewScale, previewScale);
    ctx.fillStyle = '#fff';
    if (layer.type === 'adjustment') {
      if (traceDocumentSelectionPath(ctx, shape)) ctx.fill();
    } else {
      const polygon = selectionPolygonForLayer(layer, shape);
      if (polygon?.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let index = 1; index < polygon.length; index += 1) ctx.lineTo(polygon[index].x, polygon[index].y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const image = ctx.getImageData(0, 0, width, height);
    const alpha = new Uint8ClampedArray(width * height);
    for (let index = 0; index < alpha.length; index += 1) alpha[index] = image.data[index * 4 + 3];
    const sourceRgba = await selectionRefineSourceRgba(layer, sourceWidth, sourceHeight, previewScale, ownerDocument);
    return { alpha, sourceRgba, width, height, scale:previewScale, sourceWidth, sourceHeight };
  }

  async function attachSelectionRefinePreview(
    modal,
    body,
    layer,
    layerScale,
    ownerDocument = getDocument(),
    shape = getSelectionShape(),
  ) {
    const token = {};
    previewOwners.set(modal, token);
    let frame = 0;
    let cleaned = false;
    let listenersBound = false;

    const section = documentRef.createElement('section');
    section.className = 'selection-refine-preview';
    const heading = documentRef.createElement('strong');
    heading.textContent = 'Предпросмотр маски';
    const status = documentRef.createElement('small');
    status.textContent = 'Подготовка edge-aware preview…';
    const canvas = documentRef.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.setAttribute('aria-label', 'Предпросмотр уточнённой маски');
    section.append(heading, canvas, status);
    body.prepend(section);

    const ownsPreview = () =>
      !cleaned &&
      modal.isConnected &&
      previewOwners.get(modal) === token &&
      currentTarget(ownerDocument, layer);

    let schedule = () => {};
    const priorCleanup = modal.previewCleanup;
    modal.previewCleanup = () => {
      priorCleanup?.();
      cleaned = true;
      if (frame) {
        cancelFrame(frame);
        frame = 0;
      }
      if (listenersBound) {
        modal.removeEventListener('input', schedule);
        modal.removeEventListener('change', schedule);
        listenersBound = false;
      }
      if (previewOwners.get(modal) === token) previewOwners.delete(modal);
    };

    const source = await buildSelectionRefinePreviewSource(layer, {}, ownerDocument, shape);
    if (!source || !ownsPreview()) return false;

    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d', { alpha:false });

    const renderPreview = () => {
      frame = 0;
      if (!ownsPreview()) return;
      const values = Object.fromEntries(new FormDataClass(modal));
      const previewOptions = selectionRefineOptionsFromValues(values, layerScale / source.scale);
      const alpha = refineMaskAlpha(source.alpha, source.width, source.height, {
        ...previewOptions,
        sourceRgba:source.sourceRgba,
      });
      const previewPixels = composeMaskPreviewRgba(
        source.sourceRgba,
        alpha,
        source.width,
        source.height,
        { mode:values.viewMode || 'mask' },
      );
      const image = ctx.createImageData(source.width, source.height);
      image.data.set(previewPixels);
      ctx.putImageData(image, 0, 0);
      const viewLabel = {
        mask:'маска',
        overlay:'наложение',
        black:'на чёрном',
        white:'на белом',
      }[values.viewMode] || 'маска';
      status.textContent = `${viewLabel} · маска ${source.sourceWidth}×${source.sourceHeight}px · preview ${source.width}×${source.height}px · документ изменится только после применения`;
    };

    schedule = () => {
      if (!ownsPreview()) return;
      if (frame) cancelFrame(frame);
      frame = requestFrame(renderPreview);
    };
    modal.addEventListener('input', schedule);
    modal.addEventListener('change', schedule);
    listenersBound = true;
    renderPreview();
    return true;
  }

  async function refineSelectionToLayerMask() {
    const ownerDocument = getDocument();
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
    if (isLayerLocked(ownerDocument, layer)) {
      setStatus('Слой или его группа заблокированы');
      return false;
    }
    const scale = layer.type === 'adjustment'
      ? 1
      : Math.max(.01, (Math.abs(Number(layer.scaleX) || 1) + Math.abs(Number(layer.scaleY) || 1)) / 2);
    const replacing = Boolean(layer.mask);

    showModal({
      title:'Уточнить выделение → маска слоя',
      className:'selection-refine-modal',
      fields:[
        { name:'viewMode', label:'Режим просмотра', type:'select', value:'mask', options:[['mask','Чёрно-белая маска'],['overlay','Наложение'],['black','На чёрном'],['white','На белом']] },
        { name:'smooth', label:'Сглаживание, px', type:'number', value:2, min:0, max:32, step:1 },
        { name:'shift', label:'Расширить / сжать, px', type:'number', value:0, min:-64, max:64, step:1 },
        { name:'edgeRadius', label:'Радиус обнаружения края, px', type:'number', value:0, min:0, max:12, step:.5 },
        { name:'edgeStrength', label:'Сила уточнения края, %', type:'number', value:60, min:0, max:100, step:1 },
        { name:'smartRadius', label:'Умный радиус', type:'select', value:'yes', options:[['yes','Да'],['no','Нет']] },
        { name:'feather', label:'Растушёвка, px', type:'number', value:1, min:0, max:64, step:.5 },
        { name:'contrast', label:'Контраст края, %', type:'number', value:0, min:0, max:100, step:1 },
        { name:'invert', label:'Инвертировать маску', type:'select', value:'no', options:[['no','Нет'],['yes','Да']] },
      ],
      submitLabel:replacing ? 'Заменить маску' : 'Создать маску',
      onMount:({ modal, body }) => {
        void attachSelectionRefinePreview(modal, body, layer, scale, ownerDocument, shape).catch(error => {
          consoleRef?.error?.(error);
          if (modal.isConnected && currentTarget(ownerDocument, layer)) {
            toast(error?.message || 'Не удалось построить edge-aware preview', 'warn');
          }
        });
      },
      onSubmit:async values => {
        if (!currentTarget(ownerDocument, layer)) return false;
        const options = selectionRefineOptionsFromValues(values, scale);
        const dataUrl = await selectionMaskDataUrlForOwner(layer, options, ownerDocument, shape);
        if (!currentTarget(ownerDocument, layer)) return false;
        layer.mask = createLayerMask({ enabled:true, dataUrl });
        commit(replacing ? 'Уточнить маску слоя' : 'Создать уточнённую маску слоя');
        setStatus(`Маска уточнена: сглаживание ${Number(values.smooth) || 0}px, край ${Number(values.shift) || 0}px, радиус ${Number(values.edgeRadius) || 0}px, растушёвка ${Number(values.feather) || 0}px`);
        return true;
      },
    });
    return true;
  }

  function removeSelectedLayerMask() {
    const ownerDocument = getDocument();
    const layer = getSelectedLayer();
    if (!layer?.mask || isLayerLocked(ownerDocument, layer)) return false;
    layer.mask = null;
    commit('Удалить маску слоя');
    setStatus('Маска слоя удалена');
    return true;
  }

  return {
    selectionMaskDataUrl,
    addSelectedLayerMask,
    selectionRefineOptionsFromValues,
    buildSelectionRefinePreviewSource,
    attachSelectionRefinePreview,
    refineSelectionToLayerMask,
    removeSelectedLayerMask,
  };
}
