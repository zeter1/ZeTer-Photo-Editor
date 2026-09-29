import { clamp } from '../core/geometry.js';
import { checkedCanvasSize, createLayerMask, isLayerLocked } from '../core/state.js';
import { canvasToDataURL } from '../core/io.js';
import { composeMaskPreviewRgba, decontaminateMaskEdgeColors, refineMaskAlpha } from '../core/pixels.js';
import { decontaminatePixelBufferEdgeColors, deserializePixelBufferSource } from '../core/pixel-buffer.js';

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
    publishRefinedRasterOutput = () => null,
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

  function currentTarget(ownerDocument, layer, options = {}) {
    const { requireMaskAbsent = false } = options;
    if (!ownerDocument || getDocument() !== ownerDocument || getSelectedLayer() !== layer) return false;
    if (isLayerLocked(ownerDocument, layer)) return false;
    if (requireMaskAbsent && layer?.mask) return false;
    if (Object.prototype.hasOwnProperty.call(options, 'expectedMask') && layer?.mask !== options.expectedMask) return false;
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

  function selectionDecontaminateOptionsFromValues(values, scale = 1) {
    const factor = Math.max(.0001, Number(scale) || 1);
    return {
      strength:clamp(Number(values?.decontaminate) || 0, 0, 100),
      radius:clamp(Number(values?.decontaminateRadius) || 0, 0, 8) / factor,
    };
  }

  function alphaMaskDataUrl(alpha, width, height) {
    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:true });
    const image = ctx.createImageData(width, height);
    for (let index = 0; index < alpha.length; index += 1) {
      const offset = index * 4;
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = alpha[index];
    }
    ctx.putImageData(image, 0, 0);
    return canvasToDataURL(canvas, 'image/png');
  }

  function rgbaDataUrl(rgba, width, height) {
    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:true });
    const image = ctx.createImageData(width, height);
    image.data.set(rgba);
    ctx.putImageData(image, 0, 0);
    return canvasToDataURL(canvas, 'image/png');
  }

  function refinedMaskFromDataUrl(existingMask, dataUrl) {
    return createLayerMask({
      enabled:existingMask?.enabled !== false,
      dataUrl,
      invert:Boolean(existingMask?.invert),
      density:clamp(Number(existingMask?.density ?? 1), 0, 1),
      feather:clamp(Number(existingMask?.feather) || 0, 0, 250),
      linked:existingMask?.linked !== false,
      transform:existingMask?.transform ? { ...existingMask.transform } : null,
    });
  }

  async function buildSelectionRefinePreviewSource(
    layer,
    { maxWidth=420, maxHeight=240, fullResolution=false } = {},
    ownerDocument = getDocument(),
    shape = getSelectionShape(),
  ) {
    if (!shape || !layer || !ownerDocument) return null;
    const sourceWidth = layer.type === 'adjustment' ? ownerDocument.width : Math.max(1, Math.round(layer.width || 1));
    const sourceHeight = layer.type === 'adjustment' ? ownerDocument.height : Math.max(1, Math.round(layer.height || 1));
    const previewScale = fullResolution ? 1 : Math.max(.0001, Math.min(2, maxWidth / sourceWidth, maxHeight / sourceHeight));
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
      const decontaminateOptions = selectionDecontaminateOptionsFromValues(values, layerScale / source.scale);
      const previewSource = decontaminateMaskEdgeColors(
        source.sourceRgba,
        alpha,
        source.width,
        source.height,
        decontaminateOptions,
      );
      const previewPixels = composeMaskPreviewRgba(
        previewSource,
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
    const existingMask = layer.mask;
    const replacing = Boolean(existingMask);

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
        { name:'decontaminate', label:'Очистить цвета края, %', type:'number', value:0, min:0, max:100, step:1 },
        { name:'decontaminateRadius', label:'Радиус очистки цвета, px', type:'number', value:2, min:1, max:8, step:1 },
        { name:'outputMode', label:'Вывод', type:'select', value:'mask', options:[['mask','Маска слоя'],['new-raster-mask','Новый растровый слой + маска']] },
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
        if (!currentTarget(ownerDocument, layer, { expectedMask:existingMask })) return false;
        const options = selectionRefineOptionsFromValues(values, scale);
        const decontaminateOptions = selectionDecontaminateOptionsFromValues(values, scale);
        const outputMode = values?.outputMode === 'new-raster-mask' ? 'new-raster-mask' : 'mask';

        if (decontaminateOptions.strength > 0 && outputMode === 'mask') {
          toast('Очистка цвета края изменяет пиксели. Выберите «Новый растровый слой + маска» или установите очистку в 0%.', 'warn');
          return false;
        }

        if (outputMode === 'mask') {
          const dataUrl = await selectionMaskDataUrlForOwner(layer, options, ownerDocument, shape);
          if (!currentTarget(ownerDocument, layer, { expectedMask:existingMask })) return false;
          layer.mask = refinedMaskFromDataUrl(existingMask, dataUrl);
          commit(replacing ? 'Уточнить маску слоя' : 'Создать уточнённую маску слоя');
          setStatus(`Маска уточнена: сглаживание ${Number(values.smooth) || 0}px, край ${Number(values.shift) || 0}px, радиус ${Number(values.edgeRadius) || 0}px, растушёвка ${Number(values.feather) || 0}px`);
          return true;
        }

        if (layer.type === 'adjustment') {
          toast('Новый растровый слой из Select & Mask недоступен для корректирующего слоя. Используйте вывод «Маска слоя».', 'warn');
          return false;
        }
        const width = Math.max(1, Math.round(layer.width || 1));
        const height = Math.max(1, Math.round(layer.height || 1));
        checkedCanvasSize(width, height, 'Select & Mask');
        const pixels = width * height;
        if (pixels > 12_000_000) {
          toast('Вывод Select & Mask в новый растровый слой ограничен 12 МП. Используйте вывод «Маска слоя».', 'warn');
          return false;
        }
        const detectionRadius = clamp(Math.round(Number(options.edgeRadius) || 0), 0, 12);
        if (detectionRadius > 0 && pixels * Math.max(1, detectionRadius) > 48_000_000) {
          toast('Умный радиус слишком тяжёлый для полноразмерного Select & Mask. Уменьшите радиус.', 'warn');
          return false;
        }
        const colorRadius = clamp(Math.round(Number(decontaminateOptions.radius) || 0), 0, 8);
        const colorKernel = (colorRadius * 2 + 1) ** 2;
        if (decontaminateOptions.strength > 0 && pixels * colorKernel > 48_000_000) {
          toast('Очистка цвета края слишком тяжёлая для этого слоя. Уменьшите радиус/размер или отключите очистку.', 'warn');
          return false;
        }

        const sourceHighDepth = layer.highDepthSource || null;
        const source = await buildSelectionRefinePreviewSource(layer, { fullResolution:true }, ownerDocument, shape);
        if (!source || !currentTarget(ownerDocument, layer, { expectedMask:existingMask })) return false;
        if (layer.highDepthSource !== sourceHighDepth) return false;
        const alpha = refineMaskAlpha(source.alpha, source.width, source.height, {
          ...options,
          sourceRgba:source.sourceRgba,
        });

        let dataUrl = null;
        let highDepthBuffer = null;
        if (sourceHighDepth) {
          try {
            const nativeSource = deserializePixelBufferSource(sourceHighDepth);
            if (nativeSource.width !== source.width || nativeSource.height !== source.height) {
              toast('Native PixelBuffer Select & Mask не совпадает с размером растрового слоя.', 'warn');
              return false;
            }
            highDepthBuffer = decontaminatePixelBufferEdgeColors(nativeSource, alpha, decontaminateOptions);
          } catch (error) {
            toast(error?.message || 'Не удалось подготовить native PixelBuffer для Select & Mask', 'warn');
            return false;
          }
        } else {
          const outputPixels = decontaminateMaskEdgeColors(
            source.sourceRgba,
            alpha,
            source.width,
            source.height,
            decontaminateOptions,
          );
          dataUrl = rgbaDataUrl(outputPixels, source.width, source.height);
        }

        const mask = refinedMaskFromDataUrl(existingMask, alphaMaskDataUrl(alpha, source.width, source.height));
        if (!currentTarget(ownerDocument, layer, { expectedMask:existingMask })) return false;
        if (layer.highDepthSource !== sourceHighDepth) return false;
        const outputLayer = await publishRefinedRasterOutput({
          ownerDocument,
          sourceLayer:layer,
          width:source.width,
          height:source.height,
          dataUrl,
          highDepthBuffer,
          expectedHighDepthSource:sourceHighDepth,
          mask,
        });
        if (!outputLayer) return false;
        commit('Select & Mask: новый растровый слой');
        setStatus(`Select & Mask: создан новый растровый слой с маской${highDepthBuffer ? `, native ${highDepthBuffer.model.toUpperCase()} ${highDepthBuffer.bitsPerChannel}-bit` : ''}${decontaminateOptions.strength > 0 ? `, очистка цвета края ${decontaminateOptions.strength}%` : ''}`);
        return true;
      },
    });
    return true;
  }

  function toggleSelectedLayerMask() {
    const ownerDocument = getDocument();
    const layer = getSelectedLayer();
    const mask = layer?.mask;
    if (!mask || !currentTarget(ownerDocument, layer, { expectedMask:mask })) return false;
    mask.enabled = mask.enabled === false;
    commit(mask.enabled ? 'Включить маску слоя' : 'Отключить маску слоя');
    setStatus(mask.enabled ? 'Маска слоя включена' : 'Маска слоя отключена');
    return true;
  }

  function invertSelectedLayerMask() {
    const ownerDocument = getDocument();
    const layer = getSelectedLayer();
    const mask = layer?.mask;
    if (!mask || !currentTarget(ownerDocument, layer, { expectedMask:mask })) return false;
    mask.invert = !Boolean(mask.invert);
    commit('Инвертировать маску слоя');
    setStatus(mask.invert ? 'Маска слоя инвертирована' : 'Инверсия маски слоя снята');
    return true;
  }

  function editSelectedLayerMaskProperties() {
    const ownerDocument = getDocument();
    const layer = getSelectedLayer();
    const mask = layer?.mask;
    if (!mask || !currentTarget(ownerDocument, layer, { expectedMask:mask })) return false;
    showModal({
      title:'Параметры растровой маски',
      fields:[
        { name:'density', label:'Плотность, %', type:'number', value:Math.round(clamp(Number(mask.density ?? 1), 0, 1) * 100), min:0, max:100, step:1 },
        { name:'feather', label:'Растушёвка, px', type:'number', value:clamp(Number(mask.feather) || 0, 0, 250), min:0, max:250, step:.5 },
        { name:'invert', label:'Инвертировать', type:'select', value:mask.invert ? 'yes' : 'no', options:[['no','Нет'],['yes','Да']] },
      ],
      submitLabel:'Применить',
      onSubmit:values => {
        if (!currentTarget(ownerDocument, layer, { expectedMask:mask })) return false;
        const density = clamp(Number(values?.density) || 0, 0, 100) / 100;
        const feather = clamp(Number(values?.feather) || 0, 0, 250);
        const invert = values?.invert === 'yes';
        if (
          Math.abs(Number(mask.density ?? 1) - density) < 1e-9 &&
          Math.abs((Number(mask.feather) || 0) - feather) < 1e-9 &&
          Boolean(mask.invert) === invert
        ) {
          setStatus('Параметры маски слоя не изменились');
          return true;
        }
        mask.density = density;
        mask.feather = feather;
        mask.invert = invert;
        commit('Параметры маски слоя');
        setStatus(`Маска слоя: плотность ${Math.round(density * 100)}%, растушёвка ${feather}px${invert ? ', инвертирована' : ''}`);
        return true;
      },
    });
    return true;
  }

  function toggleSelectedLayerMaskLink() {
    const ownerDocument = getDocument();
    const layer = getSelectedLayer();
    const mask = layer?.mask;
    if (!mask || !currentTarget(ownerDocument, layer, { expectedMask:mask })) return false;
    if (layer.type === 'adjustment') {
      setStatus('Маска корректирующего слоя уже работает в координатах документа');
      return false;
    }
    mask.linked = mask.linked === false;
    commit(mask.linked ? 'Связать маску со слоем' : 'Отвязать маску от слоя');
    setStatus(mask.linked
      ? 'Растровая маска связана со слоем и будет двигаться/масштабироваться вместе с ним'
      : 'Растровая маска отвязана: трансформации слоя больше не сдвигают маску');
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
    selectionDecontaminateOptionsFromValues,
    buildSelectionRefinePreviewSource,
    attachSelectionRefinePreview,
    refineSelectionToLayerMask,
    toggleSelectedLayerMask,
    invertSelectedLayerMask,
    editSelectedLayerMaskProperties,
    toggleSelectedLayerMaskLink,
    removeSelectedLayerMask,
  };
}
