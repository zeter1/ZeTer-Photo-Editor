export const PIXEL_BUFFER_KIND = 'zpe-pixel-buffer-v1';
export const PIXEL_MODELS = Object.freeze(['rgb','cmyk']);
export const PIXEL_DEPTHS = Object.freeze([8,16,32]);

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

export function pixelBufferByteLength(buffer) {
  if (!isPixelBuffer(buffer)) throw new TypeError('Ожидался PixelBuffer');
  return buffer.data.byteLength;
}
