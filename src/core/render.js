import { isLayerVisible } from './state.js';
import { hasLayerStyles, renderLayerStyles } from './layer-styles.js';
import { colorAdjustmentSignature, hasAdvancedColorAdjustments } from './color.js';
import { applyAdvancedColorAdjustmentsAsync } from './pixel-worker.js';
import { deserializePixelBufferSource, pixelBufferToToneMappedRgba8Preview } from './pixel-buffer.js';
import { applyAdjustmentPixels } from './adjustments.js';

const imageCache = new Map();
const IMAGE_CACHE_LIMIT = 24;
const adjustedRasterCache = new Map();
const ADJUSTED_RASTER_CACHE_LIMIT = 24;
const highDepthRasterCache = new Map();
const HIGH_DEPTH_RASTER_CACHE_LIMIT = 2;
const smartFilterCache = new Map();
const SMART_FILTER_CACHE_LIMIT = 16;
const fontLoads = new Map();
const bundledFontStyles = new Map();
const BUNDLED_FONT_PATHS = new Map([
  ['"ZPE Roboto"', 'roboto'], ['"ZPE Open Sans"', 'opensans'],
  ['"ZPE Montserrat"', 'montserrat'], ['"ZPE Noto Sans"', 'notosans'],
  ['"ZPE Noto Serif"', 'notoserif'], ['"ZPE Rubik"', 'rubik'],
  ['"ZPE Oswald"', 'oswald'], ['"ZPE PT Sans"', 'ptsans'],
  ['"ZPE PT Serif"', 'ptserif'], ['"ZPE Lobster"', 'lobster'],
  ['"ZPE Manrope"', 'manrope'], ['"ZPE Merriweather"', 'merriweather'],
]);

async function ensureBundledTextFont(family, font, text) {
  const folder = BUNDLED_FONT_PATHS.get(family);
  if (!folder) return;
  if (!bundledFontStyles.has(folder)) {
    const loading = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `assets/fonts/${folder}/embedded.css`;
      link.onload = resolve;
      link.onerror = () => { link.remove(); reject(new Error(`Не удалось загрузить шрифт ${family}`)); };
      document.head.append(link);
    }).catch(error => { bundledFontStyles.delete(folder); throw error; });
    bundledFontStyles.set(folder, loading);
  }
  await bundledFontStyles.get(folder);
  await document.fonts.load(font, text || 'Аa');
}

export async function ensureTextFont(fontFamily, fontData) {
  if (!fontData) return;
  if (!fontLoads.has(fontFamily)) {
    const loading = new FontFace(fontFamily, `url("${fontData}")`).load()
      .then(face => { document.fonts.add(face); return face; })
      .catch(error => { fontLoads.delete(fontFamily); throw error; });
    fontLoads.set(fontFamily, loading);
  }
  await fontLoads.get(fontFamily);
}

function trimImageCache() {
  while (imageCache.size > IMAGE_CACHE_LIMIT) {
    const oldest = imageCache.keys().next().value;
    imageCache.delete(oldest);
  }
}

function filterString(filters = {}) {
  const f = {
    brightness: 100, contrast: 100, saturate: 100, hue: 0, grayscale: 0,
    sepia: 0, invert: 0, blur: 0, ...filters,
  };
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.hue}deg) grayscale(${f.grayscale}%) sepia(${f.sepia}%) invert(${f.invert}%) blur(${f.blur}px)`;
}

function trimAdjustedRasterCache() {
  while (adjustedRasterCache.size > ADJUSTED_RASTER_CACHE_LIMIT) {
    const oldest = adjustedRasterCache.keys().next().value;
    adjustedRasterCache.delete(oldest);
  }
}


function trimHighDepthRasterCache() {
  while (highDepthRasterCache.size > HIGH_DEPTH_RASTER_CACHE_LIMIT) {
    const oldest = highDepthRasterCache.keys().next().value;
    highDepthRasterCache.delete(oldest);
  }
}

async function makeHighDepthRasterSource(layer) {
  const metadata = layer?.highDepthSource;
  if (!metadata || layer?.type !== 'raster' || metadata.model !== 'rgb') return null;
  const preview = layer.highDepthPreview || {};
  const toneMap = ['auto','clip','aces'].includes(preview.toneMap) ? preview.toneMap : 'auto';
  const displayExposure = Math.max(-6, Math.min(6, Number(preview.displayExposure) || 0));
  const signature = `${metadata.bitsPerChannel}|${metadata.colorSpace || ''}|${colorAdjustmentSignature(layer.filters || {})}|${toneMap}|${displayExposure.toFixed(3)}|tone-v2`;
  const sourceToken = metadata.dataUrl || '';
  const cached = highDepthRasterCache.get(layer.id);
  if (cached && cached.sourceToken === sourceToken && cached.signature === signature) {
    highDepthRasterCache.delete(layer.id);
    highDepthRasterCache.set(layer.id, cached);
    return cached.canvas;
  }
  try {
    const buffer = cached && cached.sourceToken === sourceToken && cached.buffer
      ? cached.buffer
      : deserializePixelBufferSource(metadata);
    const rgba = pixelBufferToToneMappedRgba8Preview(buffer, layer.filters || {}, { toneMap, displayExposure });
    const canvas = document.createElement('canvas');
    canvas.width = buffer.width; canvas.height = buffer.height;
    const ctx = canvas.getContext('2d', { alpha:true, willReadFrequently:true });
    const image = ctx.createImageData(buffer.width, buffer.height);
    image.data.set(rgba);
    ctx.putImageData(image, 0, 0);
    highDepthRasterCache.delete(layer.id);
    highDepthRasterCache.set(layer.id, { sourceToken, signature, buffer, canvas });
    trimHighDepthRasterCache();
    return canvas;
  } catch (error) {
    console.warn('High-depth raster preview failed; falling back to RGBA8 layer preview', error);
    return null;
  }
}

function smartFilterStackSignature(layer) {
  return JSON.stringify({
    stack:(Array.isArray(layer?.smartFilters) ? layer.smartFilters : []).map(item => ({
      id:item?.id || '',
      enabled:item?.enabled !== false,
      filters:item?.filters || {},
    })),
    mask:layer?.smartFilterMask ? {
      enabled:layer.smartFilterMask.enabled !== false,
      dataUrl:layer.smartFilterMask.dataUrl || '',
      invert:Boolean(layer.smartFilterMask.invert),
      density:Number(layer.smartFilterMask.density ?? 1),
      feather:Number(layer.smartFilterMask.feather ?? 0),
    } : null,
  });
}

function trimSmartFilterCache() {
  while (smartFilterCache.size > SMART_FILTER_CACHE_LIMIT) {
    const oldest = smartFilterCache.keys().next().value;
    smartFilterCache.delete(oldest);
  }
}

async function applyFilterSetToSource(source, filters = {}) {
  const width = Math.max(1, Math.round(source.naturalWidth || source.videoWidth || source.width || 1));
  const height = Math.max(1, Math.round(source.naturalHeight || source.videoHeight || source.height || 1));
  let adjusted = source;
  if (hasAdvancedColorAdjustments(filters)) {
    const advanced = document.createElement('canvas');
    advanced.width = width; advanced.height = height;
    const advancedCtx = advanced.getContext('2d', { alpha:true, willReadFrequently:true });
    advancedCtx.drawImage(source, 0, 0, width, height);
    try {
      let pixels = advancedCtx.getImageData(0, 0, width, height);
      pixels = await applyAdvancedColorAdjustmentsAsync(pixels, filters, {
        recover: () => advancedCtx.getImageData(0, 0, width, height),
      });
      advancedCtx.putImageData(pixels, 0, 0);
      adjusted = advanced;
    } catch (error) {
      console.warn('Smart Filter advanced correction failed; basic pass will continue', error);
    }
  }
  const output = document.createElement('canvas');
  output.width = width; output.height = height;
  const ctx = output.getContext('2d', { alpha:true });
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  ctx.filter = filterString(filters);
  ctx.drawImage(adjusted, 0, 0, width, height);
  return output;
}

async function applySmartFilterMask(source, filtered, mask, width, height) {
  if (!mask || mask.enabled === false) return filtered;
  const coverage = document.createElement('canvas');
  coverage.width = width; coverage.height = height;
  const coverageCtx = coverage.getContext('2d', { alpha:true, willReadFrequently:true });
  const feather = Math.max(0, Math.min(250, Number(mask.feather) || 0));
  if (mask.dataUrl) {
    const maskImage = await getImage(mask.dataUrl);
    if (!maskImage) return filtered;
    coverageCtx.save();
    coverageCtx.filter = feather > 0 ? `blur(${feather}px)` : 'none';
    coverageCtx.drawImage(maskImage, 0, 0, width, height);
    coverageCtx.restore();
  } else {
    coverageCtx.fillStyle = '#fff';
    coverageCtx.fillRect(0, 0, width, height);
  }

  const density = Math.max(0, Math.min(1, Number(mask.density ?? 1)));
  const pixels = coverageCtx.getImageData(0, 0, width, height);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    let amount = pixels.data[offset + 3] / 255;
    if (mask.invert) amount = 1 - amount;
    amount = 1 - density + density * amount;
    pixels.data[offset] = 255;
    pixels.data[offset + 1] = 255;
    pixels.data[offset + 2] = 255;
    pixels.data[offset + 3] = Math.round(amount * 255);
  }
  coverageCtx.putImageData(pixels, 0, 0);

  const filteredMasked = document.createElement('canvas');
  filteredMasked.width = width; filteredMasked.height = height;
  const filteredCtx = filteredMasked.getContext('2d', { alpha:true });
  filteredCtx.drawImage(filtered, 0, 0, width, height);
  filteredCtx.globalCompositeOperation = 'destination-in';
  filteredCtx.drawImage(coverage, 0, 0, width, height);

  const output = document.createElement('canvas');
  output.width = width; output.height = height;
  const outputCtx = output.getContext('2d', { alpha:true });
  outputCtx.drawImage(source, 0, 0, width, height);
  outputCtx.drawImage(filteredMasked, 0, 0, width, height);
  return output;
}

async function applySmartFilterStack(source, layer) {
  const stack = Array.isArray(layer?.smartFilters) ? layer.smartFilters : [];
  if (!stack.some(item => item?.enabled !== false)) return source;
  const signature = smartFilterStackSignature(layer);
  const width = Math.max(1, Math.round(source.naturalWidth || source.videoWidth || source.width || 1));
  const height = Math.max(1, Math.round(source.naturalHeight || source.videoHeight || source.height || 1));
  const sourceToken = layer.previewDataUrl || '';
  const cached = smartFilterCache.get(layer.id);
  if (cached && cached.sourceToken === sourceToken && cached.signature === signature && cached.width === width && cached.height === height) {
    smartFilterCache.delete(layer.id);
    smartFilterCache.set(layer.id, cached);
    return cached.canvas;
  }
  let current = source;
  // The stack is displayed top-first. Smart Filters are applied bottom-up.
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const item = stack[index];
    if (!item || item.enabled === false) continue;
    current = await applyFilterSetToSource(current, item.filters || {});
  }
  const result = await applySmartFilterMask(source, current, layer.smartFilterMask, width, height);
  smartFilterCache.delete(layer.id);
  smartFilterCache.set(layer.id, { sourceToken, signature, width, height, canvas:result });
  trimSmartFilterCache();
  return result;
}

async function makeAdjustedRasterSource(source, layer, { cacheable = true } = {}) {
  const filters = layer.filters || {};
  if (!hasAdvancedColorAdjustments(filters)) return source;
  const width = Math.max(1, Math.round(source.naturalWidth || source.videoWidth || source.width || layer.width || 1));
  const height = Math.max(1, Math.round(source.naturalHeight || source.videoHeight || source.height || layer.height || 1));
  const signature = colorAdjustmentSignature(filters);
  const sourceToken = cacheable
    ? (layer.type === 'smart-object'
      ? `${layer.previewDataUrl || ''}|${smartFilterStackSignature(layer)}`
      : layer.dataUrl)
    : null;
  if (cacheable) {
    const cached = adjustedRasterCache.get(layer.id);
    if (cached && cached.sourceToken === sourceToken && cached.signature === signature && cached.width === width && cached.height === height) {
      adjustedRasterCache.delete(layer.id);
      adjustedRasterCache.set(layer.id, cached);
      return cached.canvas;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const scratch = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  scratch.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in scratch) scratch.imageSmoothingQuality = 'high';
  scratch.drawImage(source, 0, 0, width, height);
  try {
    let pixels = scratch.getImageData(0, 0, width, height);
    pixels = await applyAdvancedColorAdjustmentsAsync(pixels, filters, {
      recover: () => scratch.getImageData(0, 0, width, height),
    });
    scratch.putImageData(pixels, 0, 0);
  } catch (error) {
    console.warn('Color correction preview could not process raster pixels', error);
    return source;
  }
  if (cacheable) {
    adjustedRasterCache.delete(layer.id);
    adjustedRasterCache.set(layer.id, { sourceToken, signature, width, height, canvas });
    trimAdjustedRasterCache();
  }
  return canvas;
}

export async function getImage(dataUrl) {
  if (!dataUrl) return null;
  if (imageCache.has(dataUrl)) {
    const cached = imageCache.get(dataUrl);
    imageCache.delete(dataUrl);
    imageCache.set(dataUrl, cached);
    return cached;
  }
  // A broken embedded image must not poison the entire document renderer.
  // Resolve to null and cache that result, so every animation frame does not
  // repeatedly try to decode the same corrupt payload.
  const promise = new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
  imageCache.set(dataUrl, promise);
  trimImageCache();
  return promise;
}

async function applyAdjustmentLayer(canvas, ctx, layer) {
  const width = Math.max(1, canvas.width || 1);
  const height = Math.max(1, canvas.height || 1);
  const source = document.createElement('canvas');
  source.width = width; source.height = height;
  const sourceCtx = source.getContext('2d', { alpha: true, willReadFrequently: true });
  sourceCtx.drawImage(canvas, 0, 0, width, height);
  if(layer.adjustment){
    try{
      const pixels=sourceCtx.getImageData(0,0,width,height);
      applyAdjustmentPixels(pixels,layer.adjustment);
      sourceCtx.putImageData(pixels,0,0);
    }catch(error){
      console.warn('Photoshop semantic adjustment could not process composite pixels',error);
    }
  }
  if (hasAdvancedColorAdjustments(layer.filters)) {
    try {
      let pixels = sourceCtx.getImageData(0, 0, width, height);
      pixels = await applyAdvancedColorAdjustmentsAsync(pixels, layer.filters, {
        recover: () => sourceCtx.getImageData(0, 0, width, height),
      });
      sourceCtx.putImageData(pixels, 0, 0);
    } catch (error) {
      console.warn('Adjustment layer could not process composite pixels', error);
    }
  }
  if (layer.mask?.enabled && layer.mask.dataUrl) {
    const mask = await getImage(layer.mask.dataUrl);
    if (mask) {
      sourceCtx.save();
      sourceCtx.globalCompositeOperation = 'destination-in';
      sourceCtx.globalAlpha = 1;
      sourceCtx.filter = 'none';
      sourceCtx.drawImage(mask, 0, 0, width, height);
      sourceCtx.restore();
    }
  }
  if(layer.vectorMask?.enabled!==false&&layer.vectorMask?.subpaths?.length){
    const vectorMask=renderVectorMaskBitmap(layer.vectorMask,width,height);
    sourceCtx.save();
    sourceCtx.globalCompositeOperation='destination-in';
    sourceCtx.globalAlpha=1;
    sourceCtx.filter='none';
    sourceCtx.drawImage(vectorMask,0,0,width,height);
    sourceCtx.restore();
  }
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.globalCompositeOperation = layer.blendMode || 'source-over';
  ctx.filter = filterString(layer.filters);
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();
}

function buildGroupRenderPlan(doc) {
  const groups = Array.isArray(doc?.groups) ? doc.groups : [];
  const groupMap = new Map(groups.map(group => [group.id, group]).filter(([id]) => Boolean(id)));
  const directLayers = new Map();
  const childGroups = new Map();
  const groupRanks = new Map();

  const append = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  for (const group of groups) {
    const parentId = group.parentGroupId && groupMap.has(group.parentGroupId) ? group.parentGroupId : null;
    append(childGroups, parentId, group);
  }

  for (let index = 0; index < doc.layers.length; index += 1) {
    const layer = doc.layers[index];
    const groupId = layer.groupId && groupMap.has(layer.groupId) ? layer.groupId : null;
    append(directLayers, groupId, { layer, index });
    let currentId = groupId;
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      if (!groupRanks.has(currentId) || index < groupRanks.get(currentId)) groupRanks.set(currentId, index);
      const current = groupMap.get(currentId);
      currentId = current?.parentGroupId && groupMap.has(current.parentGroupId) ? current.parentGroupId : null;
    }
  }

  const entriesFor = parentId => {
    const entries = [];
    for (const item of directLayers.get(parentId) || []) {
      entries.push({ type:'layer', layer:item.layer, rank:item.index, order:item.index });
    }
    for (const group of childGroups.get(parentId) || []) {
      entries.push({
        type:'group',
        group,
        rank:groupRanks.get(group.id) ?? Number.POSITIVE_INFINITY,
        order:groups.indexOf(group),
      });
    }
    entries.sort((a,b) => a.rank - b.rank || a.order - b.order);
    return entries;
  };

  return { entriesFor };
}

async function renderLayerEntry(canvas, ctx, doc, layer, rasterOverrides) {
  if (!isLayerVisible(doc, layer) || layer.opacity <= 0) return;
  if (layer.type === 'adjustment') {
    await applyAdjustmentLayer(canvas, ctx, layer);
    return;
  }
  await renderLayer(ctx, layer, { rasterOverride: rasterOverrides?.get?.(layer.id) || null });
}

async function renderGroupHierarchy(canvas, ctx, doc, rasterOverrides) {
  const plan = buildGroupRenderPlan(doc);
  const activeGroups = new Set();

  const renderEntries = async (targetCanvas, targetCtx, parentGroupId = null) => {
    for (const entry of plan.entriesFor(parentGroupId)) {
      if (entry.type === 'layer') {
        await renderLayerEntry(targetCanvas, targetCtx, doc, entry.layer, rasterOverrides);
        continue;
      }

      const group = entry.group;
      if (!group || group.visible === false || Number(group.opacity ?? 1) <= 0 || activeGroups.has(group.id)) continue;
      activeGroups.add(group.id);
      try {
        const opacity = Math.max(0, Math.min(1, Number(group.opacity ?? 1)));
        const blendMode = group.blendMode || 'pass-through';
        const isolated = blendMode !== 'pass-through' || opacity < 1 - 1e-9;

        if (!isolated) {
          await renderEntries(targetCanvas, targetCtx, group.id);
          continue;
        }

        const groupCanvas = document.createElement('canvas');
        groupCanvas.width = doc.width;
        groupCanvas.height = doc.height;
        const groupCtx = groupCanvas.getContext('2d', { alpha:true });
        groupCtx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in groupCtx) groupCtx.imageSmoothingQuality = 'high';
        await renderEntries(groupCanvas, groupCtx, group.id);

        targetCtx.save();
        targetCtx.globalAlpha = opacity;
        targetCtx.globalCompositeOperation = blendMode === 'pass-through' ? 'source-over' : blendMode;
        targetCtx.filter = 'none';
        targetCtx.drawImage(groupCanvas, 0, 0);
        targetCtx.restore();
      } finally {
        activeGroups.delete(group.id);
      }
    }
  };

  await renderEntries(canvas, ctx, null);
}

export async function renderDocument(canvas, doc, { checker = false, rasterOverrides = null } = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (canvas.width !== doc.width) canvas.width = doc.width;
  if (canvas.height !== doc.height) canvas.height = doc.height;
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, doc.width, doc.height);
  if (checker && doc.background === 'transparent') drawChecker(ctx, doc.width, doc.height);
  if (doc.background && doc.background !== 'transparent') {
    ctx.save(); ctx.fillStyle = doc.background; ctx.fillRect(0, 0, doc.width, doc.height); ctx.restore();
  }
  await renderGroupHierarchy(canvas, ctx, doc, rasterOverrides);
}

function traceLayerBezierPath(ctx, points, closed = false) {
  if (!Array.isArray(points) || !points.length) return false;
  ctx.moveTo(points[0].x, points[0].y);
  const segment = (from, to) => {
    const out = from?.handleOut;
    const incoming = to?.handleIn;
    if (out || incoming) {
      const cp1 = out || from;
      const cp2 = incoming || to;
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y);
    } else {
      ctx.lineTo(to.x, to.y);
    }
  };
  for (let index = 1; index < points.length; index += 1) segment(points[index - 1], points[index]);
  if (closed && points.length > 1) {
    segment(points.at(-1), points[0]);
    ctx.closePath();
  }
  return true;
}


function renderVectorMaskBitmap(vectorMask, width, height) {
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.ceil(width));
  canvas.height=Math.max(1,Math.ceil(height));
  const ctx=canvas.getContext('2d',{alpha:true});
  const subpaths=Array.isArray(vectorMask?.subpaths)?vectorMask.subpaths:[];
  let initialized=false;
  if(vectorMask?.fillStartsWithAllPixels===true){
    ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
    initialized=true;
  }

  for(const subpath of subpaths){
    const points=Array.isArray(subpath?.points)?subpath.points:[];
    if(points.length<3)continue;
    const operation=['add','subtract','intersect','exclude'].includes(subpath.operation)?subpath.operation:'add';
    if(!initialized && operation!=='add'){
      ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
      initialized=true;
    }
    ctx.save();
    ctx.globalCompositeOperation=operation==='subtract'
      ? 'destination-out'
      : operation==='intersect'
        ? 'destination-in'
        : operation==='exclude'
          ? 'xor'
          : 'source-over';
    ctx.fillStyle='#fff';
    ctx.beginPath();
    if(traceLayerBezierPath(ctx,points,subpath.closed!==false))ctx.fill(subpath.fillRule==='even-odd'?'evenodd':'nonzero');
    ctx.restore();
    initialized=true;
  }

  if(vectorMask?.invert===true){
    ctx.save();ctx.globalCompositeOperation='xor';ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
  }
  return canvas;
}

export async function renderLayer(ctx, layer, { rasterOverride = null } = {}) {
  ctx.save();
  try {
    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';
    const w = Math.max(1, layer.width ?? 1);
    const h = Math.max(1, layer.height ?? 1);
    const cx = layer.x + (w * (layer.scaleX ?? 1)) / 2;
    const cy = layer.y + (h * (layer.scaleY ?? 1)) / 2;
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation ?? 0) * Math.PI / 180);
    ctx.scale(layer.scaleX ?? 1, layer.scaleY ?? 1);
    ctx.translate(-w / 2, -h / 2);

    if (hasLayerStyles(layer.styles)) {
      const plain={...layer,styles:null,opacity:1,blendMode:'source-over',x:0,y:0,scaleX:1,scaleY:1,rotation:0};
      const styled=await renderLayerStyles(layer.styles,w,h,sourceCtx=>renderLayer(sourceCtx,plain,{rasterOverride}),{contentBlur:layer.filters?.blur||0});
      ctx.drawImage(styled.canvas,styled.x,styled.y,styled.width,styled.height);
      return;
    }
    const hasRasterMask=Boolean(layer.mask?.enabled && layer.mask.dataUrl);
    const hasVectorMask=Boolean(layer.vectorMask?.enabled !== false && layer.vectorMask?.subpaths?.length);
    if (hasRasterMask || hasVectorMask) {
      const masked = document.createElement('canvas');
      masked.width = Math.max(1, Math.ceil(w));
      masked.height = Math.max(1, Math.ceil(h));
      const maskedCtx = masked.getContext('2d', { alpha: true });
      const plain = {
        ...layer,
        mask: null,
        vectorMask: null,
        styles: null,
        opacity: 1,
        blendMode: 'source-over',
        x: 0,
        y: 0,
        width: w,
        height: h,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      };
      await renderLayer(maskedCtx, plain, { rasterOverride });
      if(hasRasterMask){
        const mask = await getImage(layer.mask.dataUrl);
        if(mask){
          maskedCtx.save();maskedCtx.globalCompositeOperation='destination-in';maskedCtx.globalAlpha=1;maskedCtx.filter='none';
          maskedCtx.drawImage(mask,0,0,masked.width,masked.height);maskedCtx.restore();
        }
      }
      if(hasVectorMask){
        const vectorMask=renderVectorMaskBitmap(layer.vectorMask,masked.width,masked.height);
        maskedCtx.save();maskedCtx.globalCompositeOperation='destination-in';maskedCtx.globalAlpha=1;maskedCtx.filter='none';
        maskedCtx.drawImage(vectorMask,0,0,masked.width,masked.height);maskedCtx.restore();
      }
      ctx.drawImage(masked, 0, 0, w, h);
      return;
    }

    ctx.filter = filterString(layer.filters);

    if ((layer.type === 'raster' && (rasterOverride || layer.dataUrl || layer.highDepthSource)) || (layer.type === 'smart-object' && layer.previewDataUrl)) {
      const dataUrl = layer.type === 'smart-object' ? layer.previewDataUrl : layer.dataUrl;
      const overrideEntry = layer.type === 'raster' ? rasterOverride : null;
      const overrideSource = overrideEntry?.source || overrideEntry || null;
      const overrideSkipAdjustments = Boolean(overrideEntry?.skipAdjustments);
      let highDepthApplied = false;
      let img = null;
      if (layer.type === 'raster' && !rasterOverride && layer.highDepthSource) {
        img = await makeHighDepthRasterSource(layer);
        highDepthApplied = Boolean(img);
      }
      if (!img) img = layer.type === 'raster' && overrideSource ? overrideSource : await getImage(dataUrl);
      if (img) {
        const filtered = layer.type === 'smart-object' ? await applySmartFilterStack(img, layer) : img;
        const source = highDepthApplied || overrideSkipAdjustments
          ? filtered
          : await makeAdjustedRasterSource(filtered, layer, { cacheable: !(layer.type === 'raster' && overrideSource) });
        ctx.drawImage(source, 0, 0, w, h);
      }
    } else if (layer.type === 'text') {
      if (layer.fontData) {
        try { await ensureTextFont(layer.fontFamily, layer.fontData); }
        catch (error) { console.warn('Не удалось загрузить шрифт текстового слоя', error); }
      }
      ctx.fillStyle = layer.color || '#ffffff';
      ctx.font = `${layer.fontStyle === 'italic' ? 'italic ' : ''}${layer.fontWeight || '400'} ${layer.fontSize || 48}px ${layer.fontFamily || 'Arial, sans-serif'}`;
      if (BUNDLED_FONT_PATHS.has(layer.fontFamily)) {
        try { await ensureBundledTextFont(layer.fontFamily, ctx.font, layer.text); }
        catch (error) { console.warn('Не удалось загрузить встроенный шрифт', error); }
      }
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${layer.letterSpacing ?? 0}px`;
      ctx.textAlign = layer.align || 'left';
      ctx.textBaseline = 'top';
      drawMultilineText(ctx, layer.text || '', layer.align === 'center' ? w / 2 : layer.align === 'right' ? w : 0, 0, w, (layer.fontSize || 48) * (layer.lineHeight ?? 1.18), layer);
    } else if (layer.type === 'shape') {
      ctx.beginPath();
      if (layer.shape === 'path') {
        const points=Array.isArray(layer.pathPoints)?layer.pathPoints:[];
        traceLayerBezierPath(ctx,points,Boolean(layer.pathClosed));
        if(layer.pathClosed&&layer.fill&&layer.fill!=='transparent'){ctx.fillStyle=layer.fill;ctx.fill();}
        if(layer.stroke&&layer.stroke!=='transparent'&&layer.strokeWidth>0){ctx.strokeStyle=layer.stroke;ctx.lineWidth=layer.strokeWidth;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
      } else if (layer.shape === 'line') {
        if (layer.lineMode === 'horizontal') { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
        else if (layer.lineMode === 'vertical') { ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); }
        else if (layer.lineFlip) { ctx.moveTo(0, h); ctx.lineTo(w, 0); }
        else { ctx.moveTo(0, 0); ctx.lineTo(w, h); }
        ctx.lineCap = 'round';
        if (layer.stroke && layer.stroke !== 'transparent' && layer.strokeWidth > 0) {
          ctx.strokeStyle = layer.stroke; ctx.lineWidth = layer.strokeWidth; ctx.stroke();
        }
      } else {
        if (layer.shape === 'ellipse') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        else roundedRectPath(ctx, 0, 0, w, h, layer.radius || 0);
        if (layer.fill && layer.fill !== 'transparent') { ctx.fillStyle = layer.fill; ctx.fill(); }
        if (layer.stroke && layer.stroke !== 'transparent' && layer.strokeWidth > 0) {
          ctx.strokeStyle = layer.stroke; ctx.lineWidth = layer.strokeWidth; ctx.stroke();
        }
      }
    }
  } finally {
    // Keep the caller's context balanced even if a future layer renderer throws.
    ctx.restore();
  }
}

function drawMultilineText(ctx, text, x, y, maxWidth, lineHeight, layer) {
  const paragraphs = String(text).split('\n');
  let lineY = y;
  const drawLine = line => {
    ctx.fillText(line, x, lineY);
    if (!line || (!layer.underline && !layer.strikeThrough)) return;
    const width = ctx.measureText(line).width;
    const startX = ctx.textAlign === 'center' ? x - width / 2 : ctx.textAlign === 'right' ? x - width : x;
    const thickness = Math.max(1, (layer.fontSize || 48) / 16);
    if (layer.underline) ctx.fillRect(startX, lineY + (layer.fontSize || 48) * .88, width, thickness);
    if (layer.strikeThrough) ctx.fillRect(startX, lineY + (layer.fontSize || 48) * .5, width, thickness);
  };
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        drawLine(line);
        lineY += lineHeight;
        line = word;
      } else line = test;
    }
    drawLine(line);
    lineY += lineHeight;
  }
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(Math.max(radius, 0), width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

let checkerTile = null;
function drawChecker(ctx, width, height) {
  if (!checkerTile) {
    const size = 16;
    checkerTile = document.createElement('canvas');
    checkerTile.width = size * 2; checkerTile.height = size * 2;
    const tileCtx = checkerTile.getContext('2d');
    tileCtx.fillStyle = '#262a31'; tileCtx.fillRect(0, 0, size * 2, size * 2);
    tileCtx.fillStyle = '#30353d';
    tileCtx.fillRect(size, 0, size, size);
    tileCtx.fillRect(0, size, size, size);
  }
  const pattern = ctx.createPattern(checkerTile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export async function compositeToBlob(doc, type = 'image/png', quality = 0.92) {
  const canvas = document.createElement('canvas');
  canvas.width = doc.width; canvas.height = doc.height;
  const exportDoc = structuredClone(doc);
  if (type === 'image/jpeg' && exportDoc.background === 'transparent') exportDoc.background = '#ffffff';
  await renderDocument(canvas, exportDoc, { checker: false });
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Экспорт не удался')), type, quality));
}

export function invalidateImageCache(dataUrl) {
  if (dataUrl) imageCache.delete(dataUrl);
  adjustedRasterCache.clear();
  highDepthRasterCache.clear();
  smartFilterCache.clear();
}
export function clearImageCache() {
  imageCache.clear();
  adjustedRasterCache.clear();
  highDepthRasterCache.clear();
  smartFilterCache.clear();
}