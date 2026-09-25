import { bytesToDataUrl, dataUrlToBytes } from './io.js';

export const PIXEL_BUFFER_KIND = 'zpe-pixel-buffer-v1';
export const PIXEL_MODELS = Object.freeze(['rgb','cmyk']);
export const PIXEL_DEPTHS = Object.freeze([8,16,32]);
export const PIXEL_BUFFER_SOURCE_KIND = 'zpe-pixel-buffer-source-v1';
export const PIXEL_BUFFER_SOURCE_MIME = 'application/x-zeter-pixel-buffer';
export const MAX_PIXEL_BUFFER_SOURCE_BYTES = 48 * 1024 * 1024;
export const MAX_PIXEL_BUFFER_SOURCE_DATA_URL = 4 * Math.ceil(MAX_PIXEL_BUFFER_SOURCE_BYTES / 3) + 128;

function integer(value, label) {
  const number = Math.trunc(Number(value));
  if (!Number.isInteger(number) || number <= 0) throw new TypeError(`${label} должен быть положительным целым числом`);
  return number;
}

function channelRange(model) {
  if (model === 'rgb') return { min: 3, max: 4 };
  if (model === 'cmyk') return { min: 4, max: 5 };
  throw new TypeError(`Неподдерживаемая модель PixelBuffer: ${model}`);
}

function expectedArrayConstructor(bitsPerChannel) {
  if (bitsPerChannel === 8) return Uint8ClampedArray;
  if (bitsPerChannel === 16) return Uint16Array;
  if (bitsPerChannel === 32) return Float32Array;
  throw new TypeError(`Неподдерживаемая глубина PixelBuffer: ${bitsPerChannel}-bit`);
}

function normalizeData(data, bitsPerChannel, length) {
  const Expected = expectedArrayConstructor(bitsPerChannel);
  if (data == null) return new Expected(length);
  if (bitsPerChannel === 8 && data instanceof Uint8Array && !(data instanceof Uint8ClampedArray)) {
    return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  }
  if (!(data instanceof Expected)) {
    throw new TypeError(`PixelBuffer ${bitsPerChannel}-bit требует ${Expected.name}`);
  }
  if (data.length !== length) {
    throw new RangeError(`PixelBuffer data length ${data.length} не совпадает с ожидаемым ${length}`);
  }
  return data;
}

export function createPixelBuffer({
  width,
  height,
  model = 'rgb',
  channels,
  bitsPerChannel = 8,
  colorSpace = model === 'rgb' ? 'srgb' : 'device-cmyk',
  alphaMode,
  profileName = '',
  data = null,
} = {}) {
  const w = integer(width, 'PixelBuffer width');
  const h = integer(height, 'PixelBuffer height');
  const normalizedModel = String(model || '').toLowerCase();
  const range = channelRange(normalizedModel);
  const channelCount = channels == null ? range.max : integer(channels, 'PixelBuffer channels');
  if (channelCount < range.min || channelCount > range.max) {
    throw new RangeError(`PixelBuffer ${normalizedModel} поддерживает ${range.min}–${range.max} каналов`);
  }
  const depth = integer(bitsPerChannel, 'PixelBuffer bitsPerChannel');
  expectedArrayConstructor(depth);
  const samples = w * h * channelCount;
  if (!Number.isSafeInteger(samples)) throw new RangeError('PixelBuffer слишком большой для безопасной адресации');
  const hasAlpha = channelCount === range.max;
  const normalizedAlpha = alphaMode ?? (hasAlpha ? 'straight' : 'none');
  if (!['none','straight'].includes(normalizedAlpha)) throw new TypeError(`Неподдерживаемый alphaMode PixelBuffer: ${normalizedAlpha}`);
  if ((normalizedAlpha === 'none') === hasAlpha) {
    throw new RangeError('PixelBuffer alphaMode не согласован с числом каналов');
  }
  return {
    kind: PIXEL_BUFFER_KIND,
    width: w,
    height: h,
    model: normalizedModel,
    channels: channelCount,
    bitsPerChannel: depth,
    sampleType: depth === 32 ? 'float' : 'uint',
    colorSpace: String(colorSpace || ''),
    alphaMode: normalizedAlpha,
    profileName: String(profileName || ''),
    data: normalizeData(data, depth, samples),
  };
}

export function createRgba8PixelBuffer(width, height, data, options = {}) {
  return createPixelBuffer({
    width,
    height,
    model: 'rgb',
    channels: 4,
    bitsPerChannel: 8,
    colorSpace: options.colorSpace || 'srgb',
    alphaMode: 'straight',
    profileName: options.profileName || '',
    data,
  });
}

export function isPixelBuffer(value) {
  return Boolean(value)
    && value.kind === PIXEL_BUFFER_KIND
    && Number.isInteger(value.width)
    && Number.isInteger(value.height)
    && PIXEL_MODELS.includes(value.model)
    && PIXEL_DEPTHS.includes(value.bitsPerChannel)
    && ArrayBuffer.isView(value.data);
}

function sample01(buffer, index) {
  if (buffer.bitsPerChannel === 8) return buffer.data[index] / 255;
  if (buffer.bitsPerChannel === 16) return buffer.data[index] / 65535;
  return Math.min(1, Math.max(0, Number(buffer.data[index]) || 0));
}

export function pixelBufferToRgba8Preview(buffer) {
  if (!isPixelBuffer(buffer)) throw new TypeError('Ожидался PixelBuffer');
  if (buffer.model !== 'rgb') {
    throw new Error('CMYK PixelBuffer требует отдельного color-management преобразования перед RGB preview');
  }
  if (buffer.bitsPerChannel === 8 && buffer.channels === 4 && buffer.data instanceof Uint8ClampedArray) {
    return buffer.data;
  }
  const pixels = buffer.width * buffer.height;
  const rgba = new Uint8ClampedArray(pixels * 4);
  const hasAlpha = buffer.channels === 4;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const source = pixel * buffer.channels;
    const target = pixel * 4;
    rgba[target] = Math.round(sample01(buffer, source) * 255);
    rgba[target + 1] = Math.round(sample01(buffer, source + 1) * 255);
    rgba[target + 2] = Math.round(sample01(buffer, source + 2) * 255);
    rgba[target + 3] = hasAlpha ? Math.round(sample01(buffer, source + 3) * 255) : 255;
  }
  return rgba;
}

const clampPreview01 = value => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));

function sourceSampleValue(buffer, index) {
  if (buffer.bitsPerChannel === 8) return buffer.data[index] / 255;
  if (buffer.bitsPerChannel === 16) return buffer.data[index] / 65535;
  const value = Number(buffer.data[index]);
  return Number.isFinite(value) ? value : 0;
}

function srgbToLinear(value) {
  const v = Math.max(0, Number(value) || 0);
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  const v = Math.max(0, Number(value) || 0);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * (v ** (1 / 2.4)) - 0.055;
}

function acesToneMap(value) {
  const v = Math.max(0, Number(value) || 0);
  const mapped = (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14);
  return clampPreview01(mapped);
}

function compileHighDepthAdjustments(filters = {}) {
  return {
    exposure: 2 ** Math.max(-4, Math.min(4, Number(filters.exposure) || 0)),
    gammaPower: 1 / Math.max(0.1, Math.min(5, Number(filters.gamma) || 1)),
    temperature: Math.max(-1, Math.min(1, (Number(filters.temperature) || 0) / 100)),
    tint: Math.max(-1, Math.min(1, (Number(filters.tint) || 0) / 100)),
    vibrance: Math.max(-1, Math.min(1, (Number(filters.vibrance) || 0) / 100)),
    highlights: Math.max(-1, Math.min(1, (Number(filters.highlights) || 0) / 100)),
    shadows: Math.max(-1, Math.min(1, (Number(filters.shadows) || 0) / 100)),
  };
}

function adjustHighDepthRgb(r, g, b, compiled) {
  let red = Math.max(0, r) * compiled.exposure;
  let green = Math.max(0, g) * compiled.exposure;
  let blue = Math.max(0, b) * compiled.exposure;

  const temperature = compiled.temperature;
  if (temperature) {
    red *= 1 + temperature * 0.14;
    green *= 1 + temperature * 0.018;
    blue *= 1 - temperature * 0.14;
  }
  const tint = compiled.tint;
  if (tint) {
    red *= 1 + tint * 0.055;
    green *= 1 - tint * 0.10;
    blue *= 1 + tint * 0.055;
  }

  let luminance = Math.max(0, red * 0.2126 + green * 0.7152 + blue * 0.0722);
  if (compiled.shadows) {
    const weight = (1 - clampPreview01(luminance)) ** 2;
    const strength = Math.abs(compiled.shadows) * weight * 0.72;
    if (compiled.shadows > 0) {
      red += (1 - Math.min(1, red)) * strength;
      green += (1 - Math.min(1, green)) * strength;
      blue += (1 - Math.min(1, blue)) * strength;
    } else {
      const factor = 1 - strength;
      red *= factor; green *= factor; blue *= factor;
    }
  }

  luminance = Math.max(0, red * 0.2126 + green * 0.7152 + blue * 0.0722);
  if (compiled.highlights) {
    const strength = Math.abs(compiled.highlights) * (clampPreview01(luminance) ** 2) * 0.72;
    if (compiled.highlights > 0) {
      const factor = 1 + strength * 0.35;
      red *= factor; green *= factor; blue *= factor;
    } else {
      const factor = 1 - strength * 0.62;
      red *= factor; green *= factor; blue *= factor;
    }
  }

  if (compiled.vibrance) {
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const saturation = maxChannel > 1e-8 ? Math.min(1, (maxChannel - minChannel) / maxChannel) : 0;
    const factor = Math.max(0, 1 + compiled.vibrance * (1 - saturation) * 0.85);
    const gray = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    red = gray + (red - gray) * factor;
    green = gray + (green - gray) * factor;
    blue = gray + (blue - gray) * factor;
  }

  if (Math.abs(compiled.gammaPower - 1) > 1e-9) {
    red = Math.max(0, red) ** compiled.gammaPower;
    green = Math.max(0, green) ** compiled.gammaPower;
    blue = Math.max(0, blue) ** compiled.gammaPower;
  }
  return [Math.max(0, red), Math.max(0, green), Math.max(0, blue)];
}

export function pixelBufferToToneMappedRgba8Preview(buffer, filters = {}, { toneMap = 'auto', displayExposure = 0 } = {}) {
  if (!isPixelBuffer(buffer)) throw new TypeError('Ожидался PixelBuffer');
  if (buffer.model !== 'rgb') throw new Error('High-depth preview пока поддерживает только RGB PixelBuffer');
  const mode = toneMap === 'auto' ? (buffer.bitsPerChannel === 32 ? 'aces' : 'clip') : toneMap;
  if (!['clip','aces'].includes(mode)) throw new TypeError(`Неподдерживаемый tone map: ${mode}`);
  const encodedSrgb = /srgb/i.test(buffer.colorSpace || '') && !/linear/i.test(buffer.colorSpace || '');
  const linearPipeline = encodedSrgb || /linear/i.test(buffer.colorSpace || '');
  const compiled = compileHighDepthAdjustments(filters);
  const displayMultiplier = 2 ** Math.max(-6, Math.min(6, Number(displayExposure) || 0));
  const pixels = buffer.width * buffer.height;
  const rgba = new Uint8ClampedArray(pixels * 4);
  const hasAlpha = buffer.channels === 4;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const source = pixel * buffer.channels;
    const target = pixel * 4;
    let r = sourceSampleValue(buffer, source);
    let g = sourceSampleValue(buffer, source + 1);
    let b = sourceSampleValue(buffer, source + 2);
    if (encodedSrgb) { r = srgbToLinear(r); g = srgbToLinear(g); b = srgbToLinear(b); }
    [r,g,b] = adjustHighDepthRgb(r,g,b,compiled);
    r *= displayMultiplier; g *= displayMultiplier; b *= displayMultiplier;
    if (mode === 'aces') { r = acesToneMap(r); g = acesToneMap(g); b = acesToneMap(b); }
    else { r = clampPreview01(r); g = clampPreview01(g); b = clampPreview01(b); }
    if (linearPipeline) { r = linearToSrgb(r); g = linearToSrgb(g); b = linearToSrgb(b); }
    rgba[target] = Math.round(clampPreview01(r) * 255);
    rgba[target + 1] = Math.round(clampPreview01(g) * 255);
    rgba[target + 2] = Math.round(clampPreview01(b) * 255);
    rgba[target + 3] = hasAlpha ? Math.round(clampPreview01(sourceSampleValue(buffer, source + 3)) * 255) : 255;
  }
  return rgba;
}

function editableSampleMax(buffer) {
  if (buffer.bitsPerChannel === 8) return 255;
  if (buffer.bitsPerChannel === 16) return 65535;
  return 1;
}

function writeNormalizedSample(buffer, index, value) {
  const normalized = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (buffer.bitsPerChannel === 8) buffer.data[index] = Math.round(clampPreview01(normalized) * 255);
  else if (buffer.bitsPerChannel === 16) buffer.data[index] = Math.round(clampPreview01(normalized) * 65535);
  else buffer.data[index] = normalized;
}

function normalizedSample(buffer, index) {
  return sourceSampleValue(buffer, index);
}

function clonePixelData(data) {
  return new data.constructor(data);
}

export function clonePixelBuffer(buffer) {
  if (!isPixelBuffer(buffer)) throw new TypeError('Ожидался PixelBuffer');
  return createPixelBuffer({
    width:buffer.width,height:buffer.height,model:buffer.model,channels:buffer.channels,bitsPerChannel:buffer.bitsPerChannel,
    colorSpace:buffer.colorSpace,alphaMode:buffer.alphaMode,profileName:buffer.profileName,data:clonePixelData(buffer.data),
  });
}

export function pixelBufferWithStraightAlpha(buffer) {
  if (!isPixelBuffer(buffer)) throw new TypeError('Ожидался PixelBuffer');
  if (buffer.model !== 'rgb') throw new Error('High-depth pixel editing пока поддерживает только RGB PixelBuffer');
  if (buffer.channels === 4) return clonePixelBuffer(buffer);
  if (buffer.channels !== 3) throw new Error('Для RGB high-depth editing ожидается 3 или 4 канала');
  const Type = expectedArrayConstructor(buffer.bitsPerChannel);
  const output = new Type(buffer.width * buffer.height * 4);
  const alpha = editableSampleMax(buffer);
  for (let pixel=0; pixel<buffer.width*buffer.height; pixel+=1) {
    const source=pixel*3,target=pixel*4;
    output[target]=buffer.data[source];output[target+1]=buffer.data[source+1];output[target+2]=buffer.data[source+2];output[target+3]=alpha;
  }
  return createPixelBuffer({
    width:buffer.width,height:buffer.height,model:'rgb',channels:4,bitsPerChannel:buffer.bitsPerChannel,
    colorSpace:buffer.colorSpace,alphaMode:'straight',profileName:buffer.profileName,data:output,
  });
}

export const MAX_HIGH_DEPTH_COMPOSITE_BYTES = 256 * 1024 * 1024;
const HIGH_DEPTH_COMPOSITE_BLEND_MODES = new Set(['source-over','multiply','screen','overlay','darken','lighten','color-dodge','color-burn']);

function compositeColorSample(buffer, index, targetLinear) {
  let value = sourceSampleValue(buffer, index);
  const colorSpace = String(buffer.colorSpace || '');
  const sourceLinear = /linear/i.test(colorSpace);
  const sourceSrgb = /srgb/i.test(colorSpace) && !sourceLinear;
  if (targetLinear && sourceSrgb) value = srgbToLinear(value);
  else if (!targetLinear && sourceLinear) value = linearToSrgb(value);
  return Number.isFinite(value) ? value : 0;
}

function compositeBlendChannel(mode, backdrop, source) {
  const cb = Number.isFinite(backdrop) ? backdrop : 0;
  const cs = Number.isFinite(source) ? source : 0;
  if (mode === 'multiply') return cb * cs;
  if (mode === 'screen') return cb + cs - cb * cs;
  if (mode === 'overlay') return cb <= 0.5 ? 2 * cb * cs : 1 - 2 * (1 - cb) * (1 - cs);
  if (mode === 'darken') return Math.min(cb, cs);
  if (mode === 'lighten') return Math.max(cb, cs);
  if (mode === 'color-dodge') {
    if (cs >= 1) return 1;
    const base = clampPreview01(cb);
    return Math.min(1, base / Math.max(1e-12, 1 - clampPreview01(cs)));
  }
  if (mode === 'color-burn') {
    if (cs <= 0) return 0;
    const base = clampPreview01(cb);
    return 1 - Math.min(1, (1 - base) / Math.max(1e-12, clampPreview01(cs)));
  }
  return cs;
}

function compositeBackgroundInto(buffer, background, targetLinear) {
  if (!background) return;
  const descriptor = Array.isArray(background) ? { rgba:background, colorSpace:'srgb' } : background;
  const rgba = Array.isArray(descriptor?.rgba) ? descriptor.rgba : null;
  if (!rgba || rgba.length < 3) throw new TypeError('High-depth composite background требует RGB/RGBA');
  const sourceSpace = String(descriptor.colorSpace || 'srgb');
  const sourceLinear = /linear/i.test(sourceSpace);
  const sourceSrgb = /srgb/i.test(sourceSpace) && !sourceLinear;
  let r = Number(rgba[0]) || 0;
  let g = Number(rgba[1]) || 0;
  let b = Number(rgba[2]) || 0;
  if (targetLinear && sourceSrgb) { r=srgbToLinear(r); g=srgbToLinear(g); b=srgbToLinear(b); }
  else if (!targetLinear && sourceLinear) { r=linearToSrgb(r); g=linearToSrgb(g); b=linearToSrgb(b); }
  const alpha = clampPreview01(rgba.length > 3 ? rgba[3] : 1);
  for (let pixelIndex=0; pixelIndex<buffer.width*buffer.height; pixelIndex+=1) {
    const offset=pixelIndex*4;
    writeNormalizedSample(buffer,offset,r);
    writeNormalizedSample(buffer,offset+1,g);
    writeNormalizedSample(buffer,offset+2,b);
    writeNormalizedSample(buffer,offset+3,alpha);
  }
}

export function compositePixelBufferLayers(width, height, layers = [], {
  bitsPerChannel = 16,
  colorSpace = bitsPerChannel === 32 ? 'linear-rgb-unmanaged' : 'srgb',
  background = null,
  maxBytes = MAX_HIGH_DEPTH_COMPOSITE_BYTES,
} = {}) {
  const w=integer(width,'High-depth composite width');
  const h=integer(height,'High-depth composite height');
  const depth=integer(bitsPerChannel,'High-depth composite bitsPerChannel');
  if (![8,16,32].includes(depth)) throw new TypeError('High-depth composite поддерживает только 8/16/32-bit');
  const sampleCount=w*h*4;
  if (!Number.isSafeInteger(sampleCount)) throw new RangeError('High-depth composite слишком большой для безопасной адресации');
  const requiredBytes=sampleCount*(depth/8);
  const limit=Math.trunc(Number(maxBytes));
  if (!Number.isSafeInteger(limit)||limit<=0) throw new TypeError('High-depth composite maxBytes должен быть положительным целым числом');
  if (requiredBytes>limit) throw new RangeError('High-depth composite требует ' + requiredBytes + ' байт, лимит ' + limit);

  const output=createPixelBuffer({
    width:w,height:h,model:'rgb',channels:4,bitsPerChannel:depth,
    colorSpace:String(colorSpace || (depth===32?'linear-rgb-unmanaged':'srgb')),alphaMode:'straight',
  });
  const targetLinear=/linear/i.test(output.colorSpace || '');
  compositeBackgroundInto(output,background,targetLinear);

  for (const entry of Array.isArray(layers)?layers:[]) {
    const source=entry?.buffer;
    if (!isPixelBuffer(source)||source.model!=='rgb'||![3,4].includes(source.channels)) {
      throw new TypeError('High-depth composite layer требует RGB PixelBuffer');
    }
    const mode=HIGH_DEPTH_COMPOSITE_BLEND_MODES.has(entry?.blendMode)?entry.blendMode:'source-over';
    const opacity=clampPreview01(entry?.opacity ?? 1);
    if (opacity<=0) continue;
    const x=Math.trunc(Number(entry?.x)||0);
    const y=Math.trunc(Number(entry?.y)||0);
    const mask=entry?.maskPixels || null;
    if (mask && (!ArrayBuffer.isView(mask) || mask.length < source.width*source.height*4)) {
      throw new RangeError('High-depth composite mask имеет неверный размер');
    }
    const left=Math.max(0,-x),top=Math.max(0,-y);
    const right=Math.min(source.width,w-x),bottom=Math.min(source.height,h-y);
    if (left>=right||top>=bottom) continue;

    for (let sy=top; sy<bottom; sy+=1) {
      const dy=y+sy;
      for (let sx=left; sx<right; sx+=1) {
        const dx=x+sx;
        const sourcePixel=sy*source.width+sx;
        const sourceOffset=sourcePixel*source.channels;
        const targetOffset=(dy*w+dx)*4;
        const sourceAlpha=clampPreview01((source.channels===4?sourceSampleValue(source,sourceOffset+3):1)*opacity*(mask?clampPreview01(Number(mask[sourcePixel*4+3]??255)/255):1));
        if (sourceAlpha<=0) continue;
        const backdropAlpha=clampPreview01(normalizedSample(output,targetOffset+3));
        const outputAlpha=sourceAlpha+backdropAlpha*(1-sourceAlpha);
        if (outputAlpha<=0) continue;

        for (let channel=0; channel<3; channel+=1) {
          const sourceColor=compositeColorSample(source,sourceOffset+channel,targetLinear);
          const backdropColor=normalizedSample(output,targetOffset+channel);
          const blended=compositeBlendChannel(mode,backdropColor,sourceColor);
          const premultiplied=
            sourceAlpha*((1-backdropAlpha)*sourceColor+backdropAlpha*blended)
            + backdropAlpha*(1-sourceAlpha)*backdropColor;
          writeNormalizedSample(output,targetOffset+channel,premultiplied/outputAlpha);
        }
        writeNormalizedSample(output,targetOffset+3,outputAlpha);
      }
    }
  }
  return output;
}

function uiSrgbRgbForBuffer(buffer, rgb8) {
  if (!Array.isArray(rgb8) || rgb8.length < 3) throw new TypeError('Для high-depth editing нужен RGB-цвет');
  const encoded = rgb8.slice(0,3).map(value=>clampPreview01((Number(value)||0)/255));
  if (/linear/i.test(buffer.colorSpace || '')) return encoded.map(srgbToLinear);
  return encoded;
}

function highDepthBrushFalloff(distance, radius) {
  const normalized = clampPreview01(distance / Math.max(radius, 0.001));
  if (normalized <= 0.55) return 1;
  const edge = (normalized - 0.55) / 0.45;
  return 1 - edge * edge * (3 - 2 * edge);
}

function blendPixelBufferSourceOver(buffer, offset, color, opacity) {
  const sourceAlpha=clampPreview01(opacity);
  if(sourceAlpha<=0)return;
  const hasAlpha=buffer.channels===4;
  const destAlpha=hasAlpha?clampPreview01(normalizedSample(buffer,offset+3)):1;
  const outAlpha=sourceAlpha+destAlpha*(1-sourceAlpha);
  if(outAlpha<=0){
    for(let channel=0;channel<buffer.channels;channel+=1)writeNormalizedSample(buffer,offset+channel,0);
    return;
  }
  const destFactor=destAlpha*(1-sourceAlpha);
  for(let channel=0;channel<3;channel+=1){
    const dest=normalizedSample(buffer,offset+channel);
    writeNormalizedSample(buffer,offset+channel,(color[channel]*sourceAlpha+dest*destFactor)/outAlpha);
  }
  if(hasAlpha)writeNormalizedSample(buffer,offset+3,outAlpha);
}

export function applyPixelBufferBrushDab(buffer, centerX, centerY, radius, rgb8, { opacity=1, erase=false, isAllowed=null } = {}) {
  if (!isPixelBuffer(buffer) || buffer.model !== 'rgb' || ![3,4].includes(buffer.channels)) throw new TypeError('Нужен RGB PixelBuffer');
  if (erase && buffer.channels !== 4) throw new Error('Для high-depth eraser требуется alpha channel');
  const brushRadius=Math.max(0.5,Number(radius)||0.5);
  const strength=clampPreview01(opacity);
  if(strength<=0)return 0;
  const color=erase?null:uiSrgbRgbForBuffer(buffer,rgb8);
  const left=Math.max(0,Math.floor(centerX-brushRadius)),right=Math.min(buffer.width-1,Math.ceil(centerX+brushRadius));
  const top=Math.max(0,Math.floor(centerY-brushRadius)),bottom=Math.min(buffer.height-1,Math.ceil(centerY+brushRadius));
  let changed=0;
  for(let y=top;y<=bottom;y+=1){
    for(let x=left;x<=right;x+=1){
      if(isAllowed&&!isAllowed(x,y))continue;
      const distance=Math.hypot(x+.5-centerX,y+.5-centerY);
      if(distance>brushRadius)continue;
      const local=strength*highDepthBrushFalloff(distance,brushRadius);
      if(local<=0)continue;
      const offset=(y*buffer.width+x)*buffer.channels;
      if(erase){
        const alpha=clampPreview01(normalizedSample(buffer,offset+3));
        const next=alpha*(1-local);
        if(Math.abs(next-alpha)<1e-12)continue;
        writeNormalizedSample(buffer,offset+3,next);
      }else blendPixelBufferSourceOver(buffer,offset,color,local);
      changed+=1;
    }
  }
  return changed;
}

export function applyPixelBufferStrokeSegment(buffer, from, to, radius, rgb8, options = {}) {
  const distance=Math.hypot(to.x-from.x,to.y-from.y);
  const spacing=Math.max(0.75,Math.max(1,Number(radius)||1)*0.35);
  const steps=Math.max(1,Math.ceil(distance/spacing));
  let changed=0;
  for(let index=1;index<=steps;index+=1){
    const t=index/steps;
    changed+=applyPixelBufferBrushDab(buffer,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,radius,rgb8,options);
  }
  return changed;
}

function retouchStrokeIncrement(coverage, x, y, localStrength) {
  if (!coverage) return localStrength;
  const tileX=Math.floor(x/128),tileY=Math.floor(y/128);
  const tileKey=tileY*Math.ceil(Math.max(1,Number(coverage.width)||1)/128)+tileX;
  let tile=coverage.tiles.get(tileKey);
  if(!tile){tile=new Uint8Array(128*128);coverage.tiles.set(tileKey,tile);}
  const index=(y%128)*128+x%128;
  const previous=tile[index];
  const next=Math.max(previous,Math.round(clampPreview01(localStrength)*255));
  if(next===previous)return 0;
  tile[index]=next;
  return (next-previous)/(255-previous);
}

function retouchEncodedSrgb(buffer) {
  return /srgb/i.test(buffer.colorSpace || '') && !/linear/i.test(buffer.colorSpace || '');
}

function retouchReadRgb(buffer, offset) {
  let r=normalizedSample(buffer,offset),g=normalizedSample(buffer,offset+1),b=normalizedSample(buffer,offset+2);
  if(retouchEncodedSrgb(buffer)){r=srgbToLinear(r);g=srgbToLinear(g);b=srgbToLinear(b);}
  return [r,g,b];
}

function retouchWriteRgb(buffer, offset, rgb) {
  let [r,g,b]=rgb;
  if(retouchEncodedSrgb(buffer)){r=linearToSrgb(r);g=linearToSrgb(g);b=linearToSrgb(b);}
  writeNormalizedSample(buffer,offset,r);
  writeNormalizedSample(buffer,offset+1,g);
  writeNormalizedSample(buffer,offset+2,b);
}

function validateRgbRetouchBuffer(buffer,label='PixelBuffer') {
  if(!isPixelBuffer(buffer)||buffer.model!=='rgb'||![3,4].includes(buffer.channels))throw new TypeError(label+': нужен RGB PixelBuffer');
}

function buffersMatchForRetouch(buffer,source) {
  return isPixelBuffer(source)&&source.model===buffer.model&&source.width===buffer.width&&source.height===buffer.height&&
    source.channels===buffer.channels&&source.bitsPerChannel===buffer.bitsPerChannel;
}

function pixelAlpha01(buffer,offset) {
  return buffer.channels===4?clampPreview01(normalizedSample(buffer,offset+3)):1;
}

function blendRetouchRgb(buffer,offset,rgb,opacity,sourceAlpha=1) {
  const amount=clampPreview01(opacity)*clampPreview01(sourceAlpha);
  if(amount<=0)return;
  const dest=retouchReadRgb(buffer,offset);
  const alpha=pixelAlpha01(buffer,offset);
  const outAlpha=amount+alpha*(1-amount);
  const factor=alpha*(1-amount);
  const out=outAlpha>1e-12
    ? [(rgb[0]*amount+dest[0]*factor)/outAlpha,(rgb[1]*amount+dest[1]*factor)/outAlpha,(rgb[2]*amount+dest[2]*factor)/outAlpha]
    : [0,0,0];
  retouchWriteRgb(buffer,offset,out);
  if(buffer.channels===4)writeNormalizedSample(buffer,offset+3,outAlpha);
}

function sampleRetouchBilinear(buffer,x,y) {
  if(x<0||y<0||x>buffer.width-1||y>buffer.height-1)return null;
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(buffer.width-1,x0+1),y1=Math.min(buffer.height-1,y0+1);
  const tx=x-x0,ty=y-y0;
  const weights=[[(1-tx)*(1-ty),x0,y0],[tx*(1-ty),x1,y0],[(1-tx)*ty,x0,y1],[tx*ty,x1,y1]];
  const rgb=[0,0,0];let alpha=0;
  for(const [weight,sx,sy] of weights){
    if(weight<=0)continue;
    const offset=(sy*buffer.width+sx)*buffer.channels;
    const a=pixelAlpha01(buffer,offset);
    const c=retouchReadRgb(buffer,offset);
    rgb[0]+=c[0]*weight;rgb[1]+=c[1]*weight;rgb[2]+=c[2]*weight;alpha+=a*weight;
  }
  return {rgb,alpha};
}

function retouchNeighborhoodMean(buffer,centerX,centerY,radius=3) {
  const r=Math.max(1,Math.min(12,Math.trunc(radius)||3));
  const left=Math.max(0,Math.floor(centerX)-r),right=Math.min(buffer.width-1,Math.floor(centerX)+r);
  const top=Math.max(0,Math.floor(centerY)-r),bottom=Math.min(buffer.height-1,Math.floor(centerY)+r);
  const sum=[0,0,0];let weight=0;
  for(let y=top;y<=bottom;y+=1)for(let x=left;x<=right;x+=1){
    const offset=(y*buffer.width+x)*buffer.channels;
    const alpha=pixelAlpha01(buffer,offset);
    if(alpha<=0)continue;
    const rgb=retouchReadRgb(buffer,offset);
    sum[0]+=rgb[0]*alpha;sum[1]+=rgb[1]*alpha;sum[2]+=rgb[2]*alpha;weight+=alpha;
  }
  return weight>1e-9?sum.map(value=>value/weight):[0,0,0];
}

export function applyPixelBufferToneDab(buffer, centerX, centerY, radius, amount, { brighten=true, isAllowed=null, strokeCoverage=null } = {}) {
  validateRgbRetouchBuffer(buffer,'High-depth tone brush');
  const brushRadius=Math.max(.5,Number(radius)||.5);
  const strength=clampPreview01(amount);
  if(strength<=0)return 0;
  const left=Math.max(0,Math.floor(centerX-brushRadius)),right=Math.min(buffer.width-1,Math.ceil(centerX+brushRadius));
  const top=Math.max(0,Math.floor(centerY-brushRadius)),bottom=Math.min(buffer.height-1,Math.ceil(centerY+brushRadius));
  let changed=0;
  for(let y=top;y<=bottom;y+=1)for(let x=left;x<=right;x+=1){
    if(isAllowed&&!isAllowed(x,y))continue;
    const distance=Math.hypot(x+.5-centerX,y+.5-centerY);
    if(distance>brushRadius)continue;
    const offset=(y*buffer.width+x)*buffer.channels;
    if(pixelAlpha01(buffer,offset)<=0)continue;
    const local=strength*highDepthBrushFalloff(distance,brushRadius);
    const increment=retouchStrokeIncrement(strokeCoverage,x,y,local);
    if(increment<=0)continue;
    const factor=2**(brighten?increment:-increment);
    const rgb=retouchReadRgb(buffer,offset).map(value=>value*factor);
    retouchWriteRgb(buffer,offset,rgb);
    changed+=1;
  }
  return changed;
}

export function applyPixelBufferBlurDab(buffer, centerX, centerY, radius, amount, { sampleRadius=3, isAllowed=null, strokeCoverage=null } = {}) {
  validateRgbRetouchBuffer(buffer,'High-depth blur brush');
  const brushRadius=Math.max(.5,Number(radius)||.5);
  const strength=clampPreview01(amount);
  const kernel=Math.max(1,Math.min(8,Math.trunc(sampleRadius)||3));
  if(strength<=0)return 0;
  const left=Math.max(0,Math.floor(centerX-brushRadius)),right=Math.min(buffer.width-1,Math.ceil(centerX+brushRadius));
  const top=Math.max(0,Math.floor(centerY-brushRadius)),bottom=Math.min(buffer.height-1,Math.ceil(centerY+brushRadius));
  const pending=[];
  for(let y=top;y<=bottom;y+=1)for(let x=left;x<=right;x+=1){
    if(isAllowed&&!isAllowed(x,y))continue;
    const distance=Math.hypot(x+.5-centerX,y+.5-centerY);
    if(distance>brushRadius)continue;
    const offset=(y*buffer.width+x)*buffer.channels;
    if(pixelAlpha01(buffer,offset)<=0)continue;
    const local=strength*highDepthBrushFalloff(distance,brushRadius);
    const increment=retouchStrokeIncrement(strokeCoverage,x,y,local);
    if(increment<=0)continue;
    const sum=[0,0,0];let weight=0;
    for(let sy=Math.max(0,y-kernel);sy<=Math.min(buffer.height-1,y+kernel);sy+=1){
      for(let sx=Math.max(0,x-kernel);sx<=Math.min(buffer.width-1,x+kernel);sx+=1){
        const source=(sy*buffer.width+sx)*buffer.channels;
        const alpha=pixelAlpha01(buffer,source);
        if(alpha<=0)continue;
        const rgb=retouchReadRgb(buffer,source);
        sum[0]+=rgb[0]*alpha;sum[1]+=rgb[1]*alpha;sum[2]+=rgb[2]*alpha;weight+=alpha;
      }
    }
    if(weight<=1e-9)continue;
    const blurred=sum.map(value=>value/weight);
    const dest=retouchReadRgb(buffer,offset);
    pending.push({offset,rgb:dest.map((value,channel)=>value*(1-increment)+blurred[channel]*increment)});
  }
  for(const item of pending)retouchWriteRgb(buffer,item.offset,item.rgb);
  return pending.length;
}

export function applyPixelBufferCloneDab(buffer, snapshot, centerX, centerY, radius, sourceOffset, { opacity=1, healing=false, isAllowed=null } = {}) {
  validateRgbRetouchBuffer(buffer,'High-depth clone target');
  if(!buffersMatchForRetouch(buffer,snapshot))throw new TypeError('High-depth clone source должен совпадать с target PixelBuffer');
  const brushRadius=Math.max(.5,Number(radius)||.5);
  const strength=clampPreview01(opacity)*(healing?.68:1);
  if(strength<=0)return 0;
  const offsetX=Number(sourceOffset?.x)||0,offsetY=Number(sourceOffset?.y)||0;
  let gain=null;
  if(healing){
    const localRadius=Math.max(2,Math.min(8,brushRadius*.25));
    const sourceMean=retouchNeighborhoodMean(snapshot,centerX+offsetX,centerY+offsetY,localRadius);
    const targetMean=retouchNeighborhoodMean(snapshot,centerX,centerY,localRadius);
    gain=sourceMean.map((value,index)=>Math.max(.25,Math.min(4,(targetMean[index]+1e-6)/(value+1e-6))));
  }
  const left=Math.max(0,Math.floor(centerX-brushRadius)),right=Math.min(buffer.width-1,Math.ceil(centerX+brushRadius));
  const top=Math.max(0,Math.floor(centerY-brushRadius)),bottom=Math.min(buffer.height-1,Math.ceil(centerY+brushRadius));
  const pending=[];
  for(let y=top;y<=bottom;y+=1)for(let x=left;x<=right;x+=1){
    if(isAllowed&&!isAllowed(x,y))continue;
    const distance=Math.hypot(x+.5-centerX,y+.5-centerY);
    if(distance>brushRadius)continue;
    const sampled=sampleRetouchBilinear(snapshot,x+offsetX,y+offsetY);
    if(!sampled||sampled.alpha<=0)continue;
    const local=strength*highDepthBrushFalloff(distance,brushRadius);
    if(local<=0)continue;
    const rgb=gain?sampled.rgb.map((value,index)=>value*gain[index]):sampled.rgb;
    pending.push({offset:(y*buffer.width+x)*buffer.channels,rgb,alpha:sampled.alpha,local});
  }
  for(const item of pending)blendRetouchRgb(buffer,item.offset,item.rgb,item.local,item.alpha);
  return pending.length;
}

export function applyPixelBufferSmudgeDab(buffer, from, to, radius, amount, { isAllowed=null } = {}) {
  validateRgbRetouchBuffer(buffer,'High-depth smudge');
  const brushRadius=Math.max(.5,Number(radius)||.5);
  const strength=clampPreview01(amount);
  if(strength<=0)return 0;
  const dx=Number(from?.x)-Number(to?.x),dy=Number(from?.y)-Number(to?.y);
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return 0;
  const left=Math.max(0,Math.floor(to.x-brushRadius)),right=Math.min(buffer.width-1,Math.ceil(to.x+brushRadius));
  const top=Math.max(0,Math.floor(to.y-brushRadius)),bottom=Math.min(buffer.height-1,Math.ceil(to.y+brushRadius));
  const pending=[];
  for(let y=top;y<=bottom;y+=1)for(let x=left;x<=right;x+=1){
    if(isAllowed&&!isAllowed(x,y))continue;
    const distance=Math.hypot(x+.5-to.x,y+.5-to.y);
    if(distance>brushRadius)continue;
    const sampled=sampleRetouchBilinear(buffer,x+dx,y+dy);
    if(!sampled||sampled.alpha<=0)continue;
    const local=strength*highDepthBrushFalloff(distance,brushRadius);
    if(local<=0)continue;
    pending.push({offset:(y*buffer.width+x)*buffer.channels,rgb:sampled.rgb,alpha:sampled.alpha,local});
  }
  for(const item of pending)blendRetouchRgb(buffer,item.offset,item.rgb,item.local,item.alpha);
  return pending.length;
}

function pixelBufferDistanceSq(buffer, offset, target) {
  let distance=0;
  const count=Math.min(buffer.channels,4);
  for(let channel=0;channel<count;channel+=1){
    const delta=normalizedSample(buffer,offset+channel)-target[channel];
    distance+=delta*delta;
  }
  return distance;
}

function highDepthBitIsSet(bits,index){return (bits[index>>3]&(1<<(index&7)))!==0;}
function highDepthSetBit(bits,index){bits[index>>3]|=1<<(index&7);}

export function floodFillPixelBuffer(buffer, startX, startY, rgb8, { tolerance=0, opacity=1, isAllowed=null } = {}) {
  if (!isPixelBuffer(buffer) || buffer.model !== 'rgb' || ![3,4].includes(buffer.channels)) throw new TypeError('Нужен RGB PixelBuffer');
  const sx=Math.max(0,Math.min(buffer.width-1,Math.trunc(startX)));
  const sy=Math.max(0,Math.min(buffer.height-1,Math.trunc(startY)));
  if(isAllowed&&!isAllowed(sx,sy))return 0;
  const color=uiSrgbRgbForBuffer(buffer,rgb8);
  const sourceAlpha=clampPreview01(opacity);
  if(sourceAlpha<=0)return 0;
  const startOffset=(sy*buffer.width+sx)*buffer.channels;
  const target=[];
  for(let channel=0;channel<Math.min(buffer.channels,4);channel+=1)target.push(normalizedSample(buffer,startOffset+channel));
  const normalizedTolerance=Math.max(0,Math.min(100,Number(tolerance)||0));
  const threshold=(normalizedTolerance/100)**2*Math.min(buffer.channels,4);
  const visited=new Uint8Array(Math.ceil(buffer.width*buffer.height/8));
  const stack=[[sx,sy]];
  let filled=0;
  const matches=(x,y)=>{
    if(x<0||x>=buffer.width||y<0||y>=buffer.height)return false;
    const index=y*buffer.width+x;
    if(highDepthBitIsSet(visited,index))return false;
    if(isAllowed&&!isAllowed(x,y))return false;
    return pixelBufferDistanceSq(buffer,index*buffer.channels,target)<=threshold;
  };
  while(stack.length){
    const [seedX,y]=stack.pop();
    if(!matches(seedX,y))continue;
    let left=seedX;
    while(left>0&&matches(left-1,y))left-=1;
    let spanAbove=false,spanBelow=false;
    for(let x=left;x<buffer.width&&matches(x,y);x+=1){
      const index=y*buffer.width+x;
      highDepthSetBit(visited,index);
      blendPixelBufferSourceOver(buffer,index*buffer.channels,color,sourceAlpha);
      filled+=1;
      if(y>0){const match=matches(x,y-1);if(match&&!spanAbove)stack.push([x,y-1]);spanAbove=match;}
      if(y+1<buffer.height){const match=matches(x,y+1);if(match&&!spanBelow)stack.push([x,y+1]);spanBelow=match;}
    }
  }
  return filled;
}

export function clearPixelBufferPixels(buffer, { isAllowed=null } = {}) {
  if (!isPixelBuffer(buffer) || buffer.model !== 'rgb' || buffer.channels !== 4) throw new TypeError('Для high-depth clear нужен RGBA PixelBuffer');
  let changed=0;
  for(let y=0;y<buffer.height;y+=1){
    for(let x=0;x<buffer.width;x+=1){
      if(isAllowed&&!isAllowed(x,y))continue;
      const offset=(y*buffer.width+x)*4;
      const alpha=normalizedSample(buffer,offset+3);
      if(alpha<=0)continue;
      writeNormalizedSample(buffer,offset+3,0);
      changed+=1;
    }
  }
  return changed;
}

function sourceSampleBytes(bitsPerChannel) {
  if (bitsPerChannel === 8) return 1;
  if (bitsPerChannel === 16) return 2;
  if (bitsPerChannel === 32) return 4;
  throw new TypeError(`Неподдерживаемая глубина PixelBuffer source: ${bitsPerChannel}-bit`);
}

function pixelBufferCanonicalBytes(buffer) {
  if (!isPixelBuffer(buffer)) throw new TypeError('Ожидался PixelBuffer');
  const bytesPerSample = sourceSampleBytes(buffer.bitsPerChannel);
  const bytes = new Uint8Array(buffer.data.length * bytesPerSample);
  if (buffer.bitsPerChannel === 8) {
    bytes.set(new Uint8Array(buffer.data.buffer, buffer.data.byteOffset, buffer.data.byteLength));
    return bytes;
  }
  const view = new DataView(bytes.buffer);
  if (buffer.bitsPerChannel === 16) {
    for (let index = 0; index < buffer.data.length; index += 1) view.setUint16(index * 2, buffer.data[index], true);
  } else {
    for (let index = 0; index < buffer.data.length; index += 1) view.setFloat32(index * 4, buffer.data[index], true);
  }
  return bytes;
}

function expectedSourceBytes({ width, height, channels, bitsPerChannel }) {
  const samples = Number(width) * Number(height) * Number(channels);
  const bytes = samples * sourceSampleBytes(Number(bitsPerChannel));
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : 0;
}

export function serializePixelBufferSource(buffer, { maxBytes = MAX_PIXEL_BUFFER_SOURCE_BYTES } = {}) {
  if (!isPixelBuffer(buffer)) throw new TypeError('Ожидался PixelBuffer');
  const bytes = pixelBufferCanonicalBytes(buffer);
  const limit = Math.max(1, Math.trunc(Number(maxBytes) || 0));
  if (bytes.byteLength > limit) throw new RangeError(`PixelBuffer source ${bytes.byteLength} байт превышает лимит ${limit} байт`);
  return {
    kind: PIXEL_BUFFER_SOURCE_KIND, width: buffer.width, height: buffer.height, model: buffer.model, channels: buffer.channels,
    bitsPerChannel: buffer.bitsPerChannel, sampleType: buffer.sampleType, colorSpace: String(buffer.colorSpace || '').slice(0,120),
    alphaMode: buffer.alphaMode, profileName: String(buffer.profileName || '').slice(0,240), byteOrder: 'little-endian',
    rawBytes: bytes.byteLength, dataUrl: bytesToDataUrl(bytes, PIXEL_BUFFER_SOURCE_MIME),
  };
}

export function sanitizeSerializedPixelBufferSource(source, { maxBytes = MAX_PIXEL_BUFFER_SOURCE_BYTES } = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source) || source.kind !== PIXEL_BUFFER_SOURCE_KIND) return null;
  const width=Math.trunc(Number(source.width)), height=Math.trunc(Number(source.height)), model=String(source.model||'').toLowerCase();
  const channels=Math.trunc(Number(source.channels)), bitsPerChannel=Math.trunc(Number(source.bitsPerChannel));
  if (width<1 || height<1 || !PIXEL_MODELS.includes(model) || !PIXEL_DEPTHS.includes(bitsPerChannel)) return null;
  const range=channelRange(model); if(channels<range.min || channels>range.max) return null;
  const expected=expectedSourceBytes({width,height,channels,bitsPerChannel});
  const limit=Math.max(1,Math.trunc(Number(maxBytes)||0));
  if(!expected || expected>limit || Number(source.rawBytes)!==expected) return null;
  const dataUrl=typeof source.dataUrl==='string'?source.dataUrl:'';
  if(dataUrl.length>MAX_PIXEL_BUFFER_SOURCE_DATA_URL) return null;
  const prefix=`data:${PIXEL_BUFFER_SOURCE_MIME};base64,`;
  if(!dataUrl.startsWith(prefix)) return null;
  const base64=dataUrl.slice(prefix.length);
  if(!/^[a-z\d+/=]+$/i.test(base64) || base64.length!==4*Math.ceil(expected/3)) return null;
  const hasAlpha=channels===range.max;
  return {kind:PIXEL_BUFFER_SOURCE_KIND,width,height,model,channels,bitsPerChannel,sampleType:bitsPerChannel===32?'float':'uint',
    colorSpace:String(source.colorSpace||'').slice(0,120),alphaMode:hasAlpha?'straight':'none',profileName:String(source.profileName||'').slice(0,240),
    byteOrder:'little-endian',rawBytes:expected,dataUrl};
}

export function deserializePixelBufferSource(source, { maxBytes = MAX_PIXEL_BUFFER_SOURCE_BYTES } = {}) {
  const safe=sanitizeSerializedPixelBufferSource(source,{maxBytes});
  if(!safe) throw new TypeError('Некорректный serialized PixelBuffer source');
  const bytes=dataUrlToBytes(safe.dataUrl,{maxBytes:safe.rawBytes});
  if(bytes.byteLength!==safe.rawBytes) throw new RangeError('Serialized PixelBuffer source имеет неверный размер');
  const samples=safe.width*safe.height*safe.channels;
  let data;
  if(safe.bitsPerChannel===8){ data=new Uint8ClampedArray(bytes); }
  else if(safe.bitsPerChannel===16){
    data=new Uint16Array(samples); const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    for(let index=0;index<samples;index+=1)data[index]=view.getUint16(index*2,true);
  } else {
    data=new Float32Array(samples); const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    for(let index=0;index<samples;index+=1)data[index]=view.getFloat32(index*4,true);
  }
  return createPixelBuffer({width:safe.width,height:safe.height,model:safe.model,channels:safe.channels,bitsPerChannel:safe.bitsPerChannel,
    colorSpace:safe.colorSpace,alphaMode:safe.alphaMode,profileName:safe.profileName,data});
}

export function pixelBufferByteLength(buffer) {
  if (!isPixelBuffer(buffer)) throw new TypeError('Ожидался PixelBuffer');
  return buffer.data.byteLength;
}
