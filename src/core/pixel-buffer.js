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
