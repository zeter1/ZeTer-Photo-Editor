import { isLayerVisible } from './state.js';
import { hasLayerStyles, renderLayerStyles } from './layer-styles.js';
import { applyAdvancedColorAdjustments, colorAdjustmentSignature, hasAdvancedColorAdjustments } from './color.js';

const imageCache = new Map();
const IMAGE_CACHE_LIMIT = 24;
const adjustedRasterCache = new Map();
const ADJUSTED_RASTER_CACHE_LIMIT = 24;
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

function makeAdjustedRasterSource(source, layer, { cacheable = true } = {}) {
  const filters = layer.filters || {};
  if (!hasAdvancedColorAdjustments(filters)) return source;
  const width = Math.max(1, Math.round(source.naturalWidth || source.videoWidth || source.width || layer.width || 1));
  const height = Math.max(1, Math.round(source.naturalHeight || source.videoHeight || source.height || layer.height || 1));
  const signature = colorAdjustmentSignature(filters);
  const sourceToken = cacheable ? layer.dataUrl : null;
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
    const pixels = scratch.getImageData(0, 0, width, height);
    applyAdvancedColorAdjustments(pixels, filters);
    scratch.putImageData(pixels, 0, 0);
  } catch (error) {
    console.warn('Color correction preview could not read raster pixels', error);
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
  if (hasAdvancedColorAdjustments(layer.filters)) {
    try {
      const pixels = sourceCtx.getImageData(0, 0, width, height);
      applyAdvancedColorAdjustments(pixels, layer.filters);
      sourceCtx.putImageData(pixels, 0, 0);
    } catch (error) {
      console.warn('Adjustment layer could not read composite pixels', error);
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
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.globalCompositeOperation = layer.blendMode || 'source-over';
  ctx.filter = filterString(layer.filters);
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();
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
  for (const layer of doc.layers) {
    if (!isLayerVisible(doc, layer) || layer.opacity <= 0) continue;
    if (layer.type === 'adjustment') {
      await applyAdjustmentLayer(canvas, ctx, layer);
      continue;
    }
    await renderLayer(ctx, layer, { rasterOverride: rasterOverrides?.get?.(layer.id) || null });
  }
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
    if (layer.mask?.enabled && layer.mask.dataUrl) {
      const mask = await getImage(layer.mask.dataUrl);
      if (mask) {
        const masked = document.createElement('canvas');
        masked.width = Math.max(1, Math.ceil(w));
        masked.height = Math.max(1, Math.ceil(h));
        const maskedCtx = masked.getContext('2d', { alpha: true });
        const plain = {
          ...layer,
          mask: null,
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
        maskedCtx.save();
        maskedCtx.globalCompositeOperation = 'destination-in';
        maskedCtx.globalAlpha = 1;
        maskedCtx.filter = 'none';
        maskedCtx.drawImage(mask, 0, 0, masked.width, masked.height);
        maskedCtx.restore();
        ctx.drawImage(masked, 0, 0, w, h);
        return;
      }
    }

    ctx.filter = filterString(layer.filters);

    if (layer.type === 'raster' && (rasterOverride || layer.dataUrl)) {
      const img = rasterOverride || await getImage(layer.dataUrl);
      if (img) {
        const source = makeAdjustedRasterSource(img, layer, { cacheable: !rasterOverride });
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
        if(points.length){ctx.moveTo(points[0].x,points[0].y);for(let index=1;index<points.length;index+=1)ctx.lineTo(points[index].x,points[index].y);if(layer.pathClosed)ctx.closePath();}
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

export function invalidateImageCache(dataUrl) { if (dataUrl) imageCache.delete(dataUrl); adjustedRasterCache.clear(); }
export function clearImageCache() { imageCache.clear(); adjustedRasterCache.clear(); }