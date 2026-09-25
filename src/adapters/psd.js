const PSD_SIGNATURE = '8BPS';
const PSD_VERSION = 1;
const PSB_VERSION = 2;
const PSB_LONG_ADDITIONAL_KEYS = new Set(['LMsk','Lr16','Lr32','Layr','Mt16','Mt32','Mtrn','Alph','FMsk','lnk2','FEid','FXid','PxSD']);
const PSD_COLOR_MODE_RGB = 3;
const PSD_DEPTH = 8;
const MAX_PSD_LAYERS = 500;
const MAX_PSD_CHANNEL_BYTES = 256 * 1024 * 1024;

const PSD_BLEND_MODES = Object.freeze({
  norm: 'source-over',
  mul: 'multiply',
  'mul ': 'multiply',
  scrn: 'screen',
  over: 'overlay',
  dark: 'darken',
  lite: 'lighten',
  div: 'color-dodge',
  'div ': 'color-dodge',
  idiv: 'color-burn',
});

export class PsdImportError extends Error {
  constructor(message, code = 'PSD_IMPORT_ERROR') {
    super(message);
    this.name = 'PsdImportError';
    this.code = code;
  }
}

class Reader {
  constructor(bytes, offset = 0, end = bytes.length) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = offset;
    this.end = Math.min(end, bytes.length);
  }
  ensure(size) {
    if (!Number.isInteger(size) || size < 0 || this.offset + size > this.end) {
      throw new PsdImportError('PSD повреждён или обрезан', 'PSD_TRUNCATED');
    }
  }
  u8() { this.ensure(1); return this.view.getUint8(this.offset++); }
  i8() { this.ensure(1); return this.view.getInt8(this.offset++); }
  u16() { this.ensure(2); const v = this.view.getUint16(this.offset, false); this.offset += 2; return v; }
  i16() { this.ensure(2); const v = this.view.getInt16(this.offset, false); this.offset += 2; return v; }
  u32() { this.ensure(4); const v = this.view.getUint32(this.offset, false); this.offset += 4; return v; }
  i32() { this.ensure(4); const v = this.view.getInt32(this.offset, false); this.offset += 4; return v; }
  u64() {
    const high = this.u32();
    const low = this.u32();
    const value = high * 0x100000000 + low;
    if (!Number.isSafeInteger(value)) throw new PsdImportError('PSD/PSB length exceeds JavaScript safe integer range', 'PSD_LENGTH_RANGE');
    return value;
  }
  ascii(size) {
    const bytes = this.take(size);
    let out = '';
    for (const value of bytes) out += String.fromCharCode(value);
    return out;
  }
  take(size) {
    this.ensure(size);
    const out = this.bytes.subarray(this.offset, this.offset + size);
    this.offset += size;
    return out;
  }
  skip(size) { this.ensure(size); this.offset += size; }
  seek(offset) {
    if (!Number.isInteger(offset) || offset < 0 || offset > this.end) throw new PsdImportError('Некорректный PSD offset', 'PSD_OFFSET');
    this.offset = offset;
  }
}

function asBytes(buffer) {
  if (buffer instanceof Uint8Array) return buffer;
  if (ArrayBuffer.isView(buffer)) return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  throw new PsdImportError('PSD/PSB decoder ожидал ArrayBuffer', 'PSD_BUFFER');
}

function safeArea(width, height, maxPixels) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0) {
    throw new PsdImportError('Некорректный размер PSD/PSB', 'PSD_SIZE');
  }
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels > maxPixels) {
    throw new PsdImportError(`PSD/PSB слишком большой для безопасного импорта: ${width} × ${height}`, 'PSD_TOO_LARGE');
  }
  return pixels;
}

export function isPsdFile(file) {
  const name = String(file?.name || '');
  const type = String(file?.type || '').toLowerCase();
  return /\.ps[db]$/i.test(name) || type === 'image/vnd.adobe.photoshop' || type === 'image/x-photoshop';
}

export function inspectPsdHeader(buffer) {
  const reader = new Reader(asBytes(buffer));
  const signature = reader.ascii(4);
  if (signature !== PSD_SIGNATURE) throw new PsdImportError('Это не PSD/PSB-файл (нет сигнатуры 8BPS)', 'PSD_SIGNATURE');
  const version = reader.u16();
  reader.skip(6);
  const channels = reader.u16();
  const height = reader.u32();
  const width = reader.u32();
  const bitsPerChannel = reader.u16();
  const colorMode = reader.u16();
  return { signature, version, channels, width, height, bitsPerChannel, colorMode };
}

function requireImportCapabilities(header, maxPixels) {
  if (header.version !== PSD_VERSION && header.version !== PSB_VERSION) {
    throw new PsdImportError(`Неподдерживаемая версия PSD/PSB: ${header.version}`, 'PSD_VERSION');
  }
  if (header.colorMode !== PSD_COLOR_MODE_RGB) {
    throw new PsdImportError('PSD/PSB import поддерживает только RGB. CMYK/Lab/Indexed будут добавлены отдельным color-management этапом.', 'PSD_COLOR_MODE');
  }
  if (header.bitsPerChannel !== PSD_DEPTH) {
    throw new PsdImportError(`PSD/PSB import поддерживает 8-bit/channel. Получено: ${header.bitsPerChannel}-bit.`, 'PSD_BIT_DEPTH');
  }
  if (header.channels < 3 || header.channels > 56) throw new PsdImportError(`Некорректное число каналов PSD/PSB: ${header.channels}`, 'PSD_CHANNELS');
  safeArea(header.width, header.height, maxPixels);
}

function readVersionedLength(reader, version) {
  return version === PSB_VERSION ? reader.u64() : reader.u32();
}

function readLengthSection(reader, label) {
  const length = reader.u32();
  const end = reader.offset + length;
  if (end > reader.end) throw new PsdImportError(`${label}: длина выходит за границы файла`, 'PSD_SECTION_LENGTH');
  return { length, end };
}

function decodeUtf16Be(bytes) {
  if (bytes.length % 2) return '';
  let result = '';
  for (let i = 0; i < bytes.length; i += 2) result += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return result;
}

function decodeLatin1(bytes) {
  let result = '';
  for (const value of bytes) result += String.fromCharCode(value);
  return result;
}

function parseLayerMask(reader, length) {
  if (!length) return null;
  const start = reader.offset;
  const end = start + length;
  reader.ensure(length);
  if (length < 18) { reader.seek(end); return null; }
  const top = reader.i32();
  const left = reader.i32();
  const bottom = reader.i32();
  const right = reader.i32();
  const defaultColor = reader.u8();
  const flags = reader.u8();
  reader.seek(end);
  return {
    top, left, bottom, right,
    defaultColor,
    positionRelativeToLayer: Boolean(flags & 0x01),
    disabled: Boolean(flags & 0x02),
    inverted: Boolean(flags & 0x04),
  };
}

function parseAdditionalLayerInfo(reader, extraEnd, record, version) {
  while (reader.offset + 12 <= extraEnd) {
    const blockStart = reader.offset;
    const signature = reader.ascii(4);
    if (signature !== '8BIM' && signature !== '8B64') { reader.seek(blockStart); break; }
    const key = reader.ascii(4);
    const useLongLength = version === PSB_VERSION && (signature === '8B64' || PSB_LONG_ADDITIONAL_KEYS.has(key));
    const length = useLongLength ? reader.u64() : reader.u32();
    const dataStart = reader.offset;
    const dataEnd = dataStart + length;
    if (dataEnd > extraEnd) { reader.seek(extraEnd); break; }
    if (key === 'luni' && length >= 4) {
      const count = reader.u32();
      const byteLength = Math.min(count * 2, Math.max(0, dataEnd - reader.offset));
      const name = decodeUtf16Be(reader.take(byteLength));
      if (name) record.name = name;
    } else if ((key === 'lsct' || key === 'lsdk') && length >= 4) {
      record.sectionDivider = reader.u32();
    }
    reader.seek(dataEnd);
    if ((length & 1) && reader.offset < extraEnd) reader.skip(1);
  }
}

function parseLayerRecord(reader, version) {
  const top = reader.i32();
  const left = reader.i32();
  const bottom = reader.i32();
  const right = reader.i32();
  const channelCount = reader.u16();
  if (channelCount > 64) throw new PsdImportError(`Слишком много каналов в слое: ${channelCount}`, 'PSD_LAYER_CHANNELS');
  const channels = [];
  for (let index = 0; index < channelCount; index += 1) channels.push({ id: reader.i16(), length: readVersionedLength(reader, version) });
  if (reader.ascii(4) !== '8BIM') throw new PsdImportError('Некорректная сигнатура blend mode слоя', 'PSD_BLEND_SIGNATURE');
  const blendKey = reader.ascii(4);
  const opacity = reader.u8();
  reader.u8();
  const flags = reader.u8();
  reader.u8();
  const extraLength = reader.u32();
  const extraStart = reader.offset;
  const extraEnd = extraStart + extraLength;
  if (extraEnd > reader.end) throw new PsdImportError('Extra data слоя выходит за границы PSD', 'PSD_LAYER_EXTRA');
  const maskLength = reader.u32();
  const mask = parseLayerMask(reader, maskLength);
  if (reader.offset + 4 > extraEnd) { reader.seek(extraEnd); return { top,left,bottom,right,channels,blendKey,opacity,flags,mask,name:'Слой',sectionDivider:0 }; }
  const blendingRangesLength = reader.u32();
  if (reader.offset + blendingRangesLength > extraEnd) throw new PsdImportError('Повреждены blending ranges слоя', 'PSD_BLEND_RANGES');
  reader.skip(blendingRangesLength);
  let name = 'Слой';
  if (reader.offset < extraEnd) {
    const nameLength = reader.u8();
    if (reader.offset + nameLength <= extraEnd) name = decodeLatin1(reader.take(nameLength)) || name;
    const consumed = 1 + nameLength;
    const padding = (4 - (consumed % 4)) % 4;
    if (reader.offset + padding <= extraEnd) reader.skip(padding);
  }
  const record = { top,left,bottom,right,channels,blendKey,opacity,flags,mask,name,sectionDivider:0 };
  parseAdditionalLayerInfo(reader, extraEnd, record, version);
  reader.seek(extraEnd);
  return record;
}

function packBitsRow(source, expectedWidth) {
  const out = new Uint8Array(expectedWidth);
  let input = 0;
  let output = 0;
  while (input < source.length && output < expectedWidth) {
    const header = source[input++];
    const signed = header > 127 ? header - 256 : header;
    if (signed >= 0) {
      const count = signed + 1;
      if (input + count > source.length || output + count > expectedWidth) throw new PsdImportError('Повреждён PackBits-поток PSD', 'PSD_RLE');
      out.set(source.subarray(input, input + count), output);
      input += count;
      output += count;
    } else if (signed >= -127) {
      if (input >= source.length) throw new PsdImportError('Повреждён PackBits repeat PSD', 'PSD_RLE');
      const count = 1 - signed;
      if (output + count > expectedWidth) throw new PsdImportError('PackBits строка длиннее ожидаемой', 'PSD_RLE');
      out.fill(source[input++], output, output + count);
      output += count;
    }
  }
  if (output !== expectedWidth) throw new PsdImportError('PackBits строка короче ожидаемой', 'PSD_RLE');
  return out;
}

async function inflateZlib(bytes) {
  if (typeof DecompressionStream !== 'function' || typeof Blob !== 'function' || typeof Response !== 'function') {
    throw new PsdImportError('Этот браузер не поддерживает встроенную ZIP-декомпрессию PSD', 'PSD_ZIP_UNAVAILABLE');
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    throw new PsdImportError(`Не удалось распаковать ZIP-канал PSD: ${error?.message || error}`, 'PSD_ZIP');
  }
}

async function decodeChannel(reader, descriptor, width, height, maxChannelBytes, version) {
  const channelStart = reader.offset;
  const channelEnd = channelStart + descriptor.length;
  if (descriptor.length < 2 || channelEnd > reader.end || descriptor.length > maxChannelBytes) {
    throw new PsdImportError('Некорректная длина PSD-канала', 'PSD_CHANNEL_LENGTH');
  }
  const compression = reader.u16();
  const expected = safeArea(width, height, maxChannelBytes);
  let decoded;
  if (compression === 0) {
    decoded = reader.take(Math.min(expected, channelEnd - reader.offset));
    if (decoded.length !== expected) throw new PsdImportError('Raw PSD-канал имеет неверный размер', 'PSD_RAW_CHANNEL');
  } else if (compression === 1) {
    const rowLengths = [];
    for (let row = 0; row < height; row += 1) rowLengths.push(version === PSB_VERSION ? reader.u32() : reader.u16());
    decoded = new Uint8Array(expected);
    for (let row = 0; row < height; row += 1) {
      const packed = reader.take(rowLengths[row]);
      decoded.set(packBitsRow(packed, width), row * width);
    }
  } else if (compression === 2 || compression === 3) {
    const compressed = reader.take(channelEnd - reader.offset);
    decoded = await inflateZlib(compressed);
    if (decoded.length < expected) throw new PsdImportError('ZIP PSD-канал короче ожидаемого', 'PSD_ZIP_CHANNEL');
    if (decoded.length !== expected) decoded = decoded.subarray(0, expected);
    if (compression === 3) {
      for (let row = 0; row < height; row += 1) {
        const start = row * width;
        for (let x = 1; x < width; x += 1) decoded[start + x] = (decoded[start + x] + decoded[start + x - 1]) & 255;
      }
    }
  } else {
    throw new PsdImportError(`Неподдерживаемое сжатие PSD-канала: ${compression}`, 'PSD_COMPRESSION');
  }
  reader.seek(channelEnd);
  return decoded;
}

function composeRgba(width, height, channels) {
  const pixels = safeArea(width, height, Number.MAX_SAFE_INTEGER);
  const red = channels.get(0);
  const green = channels.get(1);
  const blue = channels.get(2);
  if (!red || !green || !blue) return null;
  const alpha = channels.get(-1);
  const rgba = new Uint8ClampedArray(pixels * 4);
  for (let index = 0; index < pixels; index += 1) {
    const out = index * 4;
    rgba[out] = red[index];
    rgba[out + 1] = green[index];
    rgba[out + 2] = blue[index];
    rgba[out + 3] = alpha ? alpha[index] : 255;
  }
  return rgba;
}

function buildMaskRgba(record, maskChannel, layerWidth, layerHeight) {
  if (!record.mask || !maskChannel || layerWidth <= 0 || layerHeight <= 0) return null;
  const mask = record.mask;
  const maskWidth = Math.max(0, mask.right - mask.left);
  const maskHeight = Math.max(0, mask.bottom - mask.top);
  if (!maskWidth || !maskHeight || maskChannel.length < maskWidth * maskHeight) return null;
  const rgba = new Uint8ClampedArray(layerWidth * layerHeight * 4);
  const defaultAlpha = mask.defaultColor === 0 ? 0 : 255;
  for (let index = 0; index < layerWidth * layerHeight; index += 1) {
    const out = index * 4;
    rgba[out] = 255; rgba[out + 1] = 255; rgba[out + 2] = 255; rgba[out + 3] = defaultAlpha;
  }
  const originX = mask.positionRelativeToLayer ? mask.left : mask.left - record.left;
  const originY = mask.positionRelativeToLayer ? mask.top : mask.top - record.top;
  for (let y = 0; y < maskHeight; y += 1) {
    const targetY = originY + y;
    if (targetY < 0 || targetY >= layerHeight) continue;
    for (let x = 0; x < maskWidth; x += 1) {
      const targetX = originX + x;
      if (targetX < 0 || targetX >= layerWidth) continue;
      let value = maskChannel[y * maskWidth + x];
      if (mask.inverted) value = 255 - value;
      rgba[(targetY * layerWidth + targetX) * 4 + 3] = value;
    }
  }
  return rgba;
}

function blendModeFor(key, warnings, layerName) {
  if (key in PSD_BLEND_MODES) return PSD_BLEND_MODES[key];
  if (key !== 'pass') warnings.push(`Слой «${layerName}»: blend mode ${JSON.stringify(key)} импортирован как Normal`);
  return 'source-over';
}

async function decodeComposite(reader, header, maxChannelBytes) {
  if (reader.offset >= reader.end) return null;
  const compression = reader.u16();
  const pixels = header.width * header.height;
  const channels = new Map();
  if (compression === 0) {
    for (let channel = 0; channel < header.channels; channel += 1) {
      if (pixels > maxChannelBytes) throw new PsdImportError('Composite PSD-канал слишком большой', 'PSD_CHANNEL_LIMIT');
      const data = reader.take(pixels);
      if (channel < 3) channels.set(channel, data);
      else if (channel === 3) channels.set(-1, data);
    }
  } else if (compression === 1) {
    const rowLengths = [];
    for (let channel = 0; channel < header.channels; channel += 1) {
      const rows = [];
      for (let row = 0; row < header.height; row += 1) rows.push(header.version === PSB_VERSION ? reader.u32() : reader.u16());
      rowLengths.push(rows);
    }
    for (let channel = 0; channel < header.channels; channel += 1) {
      const data = new Uint8Array(pixels);
      for (let row = 0; row < header.height; row += 1) data.set(packBitsRow(reader.take(rowLengths[channel][row]), header.width), row * header.width);
      if (channel < 3) channels.set(channel, data);
      else if (channel === 3) channels.set(-1, data);
    }
  } else if (compression === 2 || compression === 3) {
    const decoded = await inflateZlib(reader.take(reader.end - reader.offset));
    const expected = pixels * header.channels;
    if (decoded.length < expected) throw new PsdImportError('Composite ZIP PSD короче ожидаемого', 'PSD_COMPOSITE_ZIP');
    for (let channel = 0; channel < header.channels; channel += 1) {
      const data = decoded.slice(channel * pixels, (channel + 1) * pixels);
      if (compression === 3) {
        for (let row = 0; row < header.height; row += 1) {
          const start = row * header.width;
          for (let x = 1; x < header.width; x += 1) data[start + x] = (data[start + x] + data[start + x - 1]) & 255;
        }
      }
      if (channel < 3) channels.set(channel, data);
      else if (channel === 3) channels.set(-1, data);
    }
  } else {
    throw new PsdImportError(`Неподдерживаемое сжатие composite PSD: ${compression}`, 'PSD_COMPOSITE_COMPRESSION');
  }
  return composeRgba(header.width, header.height, channels);
}

export async function decodePsd(buffer, { maxPixels = 48_000_000, maxLayers = MAX_PSD_LAYERS, maxChannelBytes = MAX_PSD_CHANNEL_BYTES } = {}) {
  const bytes = asBytes(buffer);
  const header = inspectPsdHeader(bytes);
  requireImportCapabilities(header, maxPixels);
  const reader = new Reader(bytes);
  reader.skip(26);
  const colorMode = readLengthSection(reader, 'Color Mode Data'); reader.seek(colorMode.end);
  const resources = readLengthSection(reader, 'Image Resources'); reader.seek(resources.end);
  const layerMaskLength = readVersionedLength(reader, header.version);
  const layerMaskEnd = reader.offset + layerMaskLength;
  if (layerMaskEnd > reader.end) throw new PsdImportError('Layer and Mask Information: длина выходит за границы файла', 'PSD_SECTION_LENGTH');
  const layerMask = { length: layerMaskLength, end: layerMaskEnd };
  const warnings = [];
  const records = [];
  if (layerMask.length > 0) {
    const layerInfoLength = readVersionedLength(reader, header.version);
    const layerInfoEnd = reader.offset + layerInfoLength;
    if (layerInfoEnd > layerMask.end) throw new PsdImportError('Layer info выходит за границы Layer and Mask section', 'PSD_LAYER_INFO');
    if (layerInfoLength > 0) {
      const layerCountSigned = reader.i16();
      const layerCount = Math.abs(layerCountSigned);
      if (layerCount > maxLayers) throw new PsdImportError(`PSD содержит слишком много слоёв: ${layerCount} > ${maxLayers}`, 'PSD_LAYER_LIMIT');
      for (let index = 0; index < layerCount; index += 1) records.push(parseLayerRecord(reader, header.version));
      for (const record of records) {
        const width = Math.max(0, record.right - record.left);
        const height = Math.max(0, record.bottom - record.top);
        if (width && height) safeArea(width, height, maxPixels);
        record.decodedChannels = new Map();
        for (const descriptor of record.channels) {
          const useMaskBounds = descriptor.id === -2 && record.mask;
          const channelWidth = useMaskBounds ? Math.max(0, record.mask.right - record.mask.left) : width;
          const channelHeight = useMaskBounds ? Math.max(0, record.mask.bottom - record.mask.top) : height;
          if (!channelWidth || !channelHeight) { reader.skip(descriptor.length); continue; }
          const data = await decodeChannel(reader, descriptor, channelWidth, channelHeight, maxChannelBytes, header.version);
          if ([0,1,2,-1,-2].includes(descriptor.id)) record.decodedChannels.set(descriptor.id, data);
        }
      }
      if (reader.offset < layerInfoEnd) reader.seek(layerInfoEnd);
    }
    reader.seek(layerMask.end);
  }

  const groupMarkers = records.filter(record => record.sectionDivider === 1 || record.sectionDivider === 2 || record.sectionDivider === 3).length;
  if (groupMarkers) warnings.push('Группы PSD/PSB импортированы как плоский список слоёв; вложенная структура групп пока не сохраняется');

  const layers = [];
  for (const record of records) {
    if (record.sectionDivider === 1 || record.sectionDivider === 2 || record.sectionDivider === 3) continue;
    const width = Math.max(0, record.right - record.left);
    const height = Math.max(0, record.bottom - record.top);
    if (!width || !height) { warnings.push(`Слой «${record.name}» пропущен: пустые bounds`); continue; }
    const rgba = composeRgba(width, height, record.decodedChannels);
    if (!rgba) { warnings.push(`Слой «${record.name}» пропущен: нет RGB bitmap-preview`); continue; }
    const maskRgba = buildMaskRgba(record, record.decodedChannels.get(-2), width, height);
    layers.push({
      name: record.name || 'PSD Layer',
      x: record.left,
      y: record.top,
      width,
      height,
      visible: !(record.flags & 0x02),
      transparencyProtected: Boolean(record.flags & 0x01),
      opacity: record.opacity / 255,
      blendMode: blendModeFor(record.blendKey, warnings, record.name),
      pixels: rgba,
      mask: maskRgba ? { pixels: maskRgba, disabled: Boolean(record.mask?.disabled) } : null,
    });
  }

  let composite = null;
  if (!layers.length && reader.offset < reader.end) {
    composite = await decodeComposite(reader, header, maxChannelBytes);
    if (composite) warnings.push('PSD/PSB не содержит импортируемых bitmap-слоёв: использован composite preview');
  }
  return { ...header, layers, composite, warnings };
}


const PSD_BLEND_KEYS = Object.freeze({
  'source-over': 'norm',
  multiply: 'mul ',
  screen: 'scrn',
  overlay: 'over',
  darken: 'dark',
  lighten: 'lite',
  'color-dodge': 'div ',
  'color-burn': 'idiv',
});

class Writer {
  constructor() {
    this.parts = [];
    this.length = 0;
  }
  push(value) {
    const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
    this.parts.push(bytes);
    this.length += bytes.length;
    return this;
  }
  append(other) {
    if (!(other instanceof Writer)) return this.push(other);
    if (other === this) throw new Error('Writer cannot append itself');
    for (const part of other.parts) {
      this.parts.push(part);
      this.length += part.length;
    }
    return this;
  }
  u8(value) { return this.push([Number(value) & 255]); }
  u16(value) {
    const n = Number(value) & 0xffff;
    return this.push([(n >>> 8) & 255, n & 255]);
  }
  i16(value) { return this.u16(Number(value) < 0 ? 0x10000 + Number(value) : value); }
  u32(value) {
    const n = Number(value) >>> 0;
    return this.push([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  }
  i32(value) { return this.u32(Number(value) < 0 ? 0x100000000 + Number(value) : value); }
  u64(value) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0) throw new PsdImportError('PSD/PSB writer: 64-bit length outside JavaScript safe integer range', 'PSD_EXPORT_LENGTH_RANGE');
    const high = Math.floor(n / 0x100000000);
    const low = n - high * 0x100000000;
    return this.u32(high).u32(low);
  }
  ascii(value) {
    const text = String(value);
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 255;
    return this.push(bytes);
  }
  concat() {
    const result = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }
}

function encodeLatin1(value, maxLength = 255) {
  const text = String(value || '').slice(0, maxLength);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[index] = code <= 255 ? code : 63;
  }
  return bytes;
}

function encodeUtf16Be(value) {
  const text = String(value || '');
  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[index * 2] = (code >>> 8) & 255;
    bytes[index * 2 + 1] = code & 255;
  }
  return bytes;
}

function packBitsEncodeRow(row) {
  const out = [];
  let index = 0;
  while (index < row.length) {
    let run = 1;
    while (index + run < row.length && row[index + run] === row[index] && run < 128) run += 1;
    if (run >= 3) {
      out.push((257 - run) & 255, row[index]);
      index += run;
      continue;
    }
    const literalStart = index;
    index += run;
    while (index < row.length && index - literalStart < 128) {
      run = 1;
      while (index + run < row.length && row[index + run] === row[index] && run < 128) run += 1;
      if (run >= 3) break;
      if (index - literalStart + run > 128) break;
      index += run;
    }
    const count = index - literalStart;
    out.push(count - 1);
    for (let cursor = literalStart; cursor < index; cursor += 1) out.push(row[cursor]);
  }
  return Uint8Array.from(out);
}

function fillRgbaChannelRow(target, rgba, channel, width, row, { whiteMatte = false } = {}) {
  const rowStart = row * width * 4;
  for (let x = 0; x < width; x += 1) {
    const source = rowStart + x * 4;
    const alpha = rgba[source + 3];
    const value = rgba[source + channel];
    if (whiteMatte && channel < 3 && alpha !== 0 && alpha !== 255) {
      const a = alpha / 255;
      target[x] = value * a + 255 * (1 - a);
    } else {
      target[x] = value;
    }
  }
  return target;
}

function measureRleRgbaRows(rgba, channel, width, height, options = {}) {
  const rowBuffer = new Uint8Array(width);
  const rowLengthBytes = options.rowLengthBytes === 4 ? 4 : 2;
  const rowLengths = rowLengthBytes === 4 ? new Uint32Array(height) : new Uint16Array(height);
  for (let row = 0; row < height; row += 1) {
    fillRgbaChannelRow(rowBuffer, rgba, channel, width, row, options);
    const packed = packBitsEncodeRow(rowBuffer);
    const maxRowLength = rowLengthBytes === 4 ? 0xffffffff : 0xffff;
    if (packed.length > maxRowLength) throw new PsdImportError('PSD/PSB writer: RLE-строка превышает допустимую длину', 'PSD_EXPORT_RLE_ROW');
    rowLengths[row] = packed.length;
  }
  return rowLengths;
}

function appendRleRgbaRows(writer, rgba, channel, width, height, options = {}) {
  const rowBuffer = new Uint8Array(width);
  for (let row = 0; row < height; row += 1) {
    fillRgbaChannelRow(rowBuffer, rgba, channel, width, row, options);
    writer.push(packBitsEncodeRow(rowBuffer));
  }
  return writer;
}

function encodeRleRgbaChannel(rgba, channel, width, height, version, options = {}) {
  const rowLengthBytes = version === PSB_VERSION ? 4 : 2;
  const rowLengths = measureRleRgbaRows(rgba, channel, width, height, { ...options, rowLengthBytes });
  const writer = new Writer();
  writer.u16(1);
  for (const length of rowLengths) {
    if (rowLengthBytes === 4) writer.u32(length);
    else writer.u16(length);
  }
  appendRleRgbaRows(writer, rgba, channel, width, height, options);
  return writer;
}

function validateExportLayer(layer, index, maxPixels) {
  const width = Math.trunc(Number(layer?.width));
  const height = Math.trunc(Number(layer?.height));
  const pixels = safeArea(width, height, maxPixels);
  const rgba = asBytes(layer?.pixels);
  if (rgba.length !== pixels * 4) {
    throw new PsdImportError(`PSD/PSB writer: слой #${index + 1} имеет неверный RGBA-буфер`, 'PSD_EXPORT_PIXELS');
  }
  const x = Math.trunc(Number(layer?.x) || 0);
  const y = Math.trunc(Number(layer?.y) || 0);
  return { ...layer, x, y, width, height, pixels: rgba };
}

function writePascalLayerName(writer, name) {
  const bytes = encodeLatin1(name || 'Layer');
  writer.u8(bytes.length).push(bytes);
  const consumed = 1 + bytes.length;
  const padding = (4 - (consumed % 4)) % 4;
  if (padding) writer.push(new Uint8Array(padding));
}

function writeUnicodeLayerName(writer, name) {
  const data = new Writer();
  const utf16 = encodeUtf16Be(name || 'Layer');
  data.u32(utf16.length / 2).push(utf16);
  while (data.length % 4) data.u8(0);
  writer.ascii('8BIM').ascii('luni').u32(data.length).append(data);
}

function writeLayerMaskExtra(writer, layer) {
  if (!layer.mask?.pixels) {
    writer.u32(0);
    return;
  }
  writer.u32(20);
  writer.i32(layer.y).i32(layer.x).i32(layer.y + layer.height).i32(layer.x + layer.width);
  writer.u8(255);
  writer.u8(layer.mask.disabled ? 0x02 : 0);
  writer.u16(0);
}

function normalizeExportLayer(layer, index, maxPixels, version) {
  const item = validateExportLayer(layer, index, maxPixels);
  const pixelCount = item.width * item.height;
  const channels = [
    { id: 0, data: encodeRleRgbaChannel(item.pixels, 0, item.width, item.height, version) },
    { id: 1, data: encodeRleRgbaChannel(item.pixels, 1, item.width, item.height, version) },
    { id: 2, data: encodeRleRgbaChannel(item.pixels, 2, item.width, item.height, version) },
    { id: -1, data: encodeRleRgbaChannel(item.pixels, 3, item.width, item.height, version) },
  ];
  let mask = null;
  if (item.mask?.pixels) {
    const maskPixels = asBytes(item.mask.pixels);
    if (maskPixels.length !== pixelCount * 4) throw new PsdImportError(`PSD/PSB writer: маска слоя «${item.name || index + 1}» имеет неверный размер`, 'PSD_EXPORT_MASK');
    mask = { disabled: Boolean(item.mask.disabled), pixels: true };
    channels.push({ id: -2, data: encodeRleRgbaChannel(maskPixels, 3, item.width, item.height, version) });
  }
  const { pixels: _pixels, ...metadata } = item;
  return { ...metadata, mask, channels };
}

function encodeCompositeRle(pixels, width, height, version) {
  const pixelCount = safeArea(width, height, Number.MAX_SAFE_INTEGER);
  const rgba = asBytes(pixels);
  if (rgba.length !== pixelCount * 4) throw new PsdImportError('PSD/PSB writer: composite RGBA имеет неверный размер', 'PSD_EXPORT_COMPOSITE');

  const channelRows = [];
  for (let channel = 0; channel < 4; channel += 1) {
    channelRows.push({
      channel,
      rowLengths: measureRleRgbaRows(rgba, channel, width, height, { whiteMatte: true, rowLengthBytes: version === PSB_VERSION ? 4 : 2 }),
    });
  }

  const writer = new Writer();
  writer.u16(1);
  for (const entry of channelRows) {
    for (const length of entry.rowLengths) {
      if (version === PSB_VERSION) writer.u32(length);
      else writer.u16(length);
    }
  }
  for (const entry of channelRows) {
    appendRleRgbaRows(writer, rgba, entry.channel, width, height, { whiteMatte: true });
  }
  return writer;
}

function buildPsdWriter({ width, height, layers = [], composite, version = PSD_VERSION, maxPixels = 48_000_000, maxLayers = MAX_PSD_LAYERS, maxBytes = 2_000_000_000 } = {}) {
  if (version !== PSD_VERSION && version !== PSB_VERSION) throw new PsdImportError(`PSD/PSB writer: unsupported version ${version}`, 'PSD_EXPORT_VERSION');
  const documentWidth = Math.trunc(Number(width));
  const documentHeight = Math.trunc(Number(height));
  safeArea(documentWidth, documentHeight, maxPixels);
  if (!Array.isArray(layers) || layers.length > maxLayers) {
    throw new PsdImportError(`PSD/PSB writer: слишком много слоёв: ${layers?.length ?? 0} > ${maxLayers}`, 'PSD_EXPORT_LAYER_LIMIT');
  }
  if (!layers.length) throw new PsdImportError('PSD/PSB writer: нужен хотя бы один слой', 'PSD_EXPORT_EMPTY');

  const normalized = layers.map((layer, index) => normalizeExportLayer(layer, index, maxPixels, version));
  const layerRecords = new Writer();
  const channelData = new Writer();

  layerRecords.i16(-normalized.length);
  for (const layer of normalized) {
    layerRecords.i32(layer.y).i32(layer.x).i32(layer.y + layer.height).i32(layer.x + layer.width);
    layerRecords.u16(layer.channels.length);
    for (const channel of layer.channels) {
      layerRecords.i16(channel.id);
      if (version === PSB_VERSION) layerRecords.u64(channel.data.length);
      else layerRecords.u32(channel.data.length);
    }
    layerRecords.ascii('8BIM');
    layerRecords.ascii(PSD_BLEND_KEYS[layer.blendMode] || 'norm');
    const opacity = Math.round(Math.max(0, Math.min(1, Number(layer.opacity ?? 1))) * 255);
    layerRecords.u8(opacity).u8(0);
    const flags = 0x08 | (layer.transparencyProtected ? 0x01 : 0) | (layer.visible === false ? 0x02 : 0);
    layerRecords.u8(flags).u8(0);

    const extra = new Writer();
    writeLayerMaskExtra(extra, layer);
    extra.u32(0);
    writePascalLayerName(extra, layer.name || 'Layer');
    writeUnicodeLayerName(extra, layer.name || 'Layer');
    layerRecords.u32(extra.length).append(extra);

    for (const channel of layer.channels) channelData.append(channel.data);
  }

  const layerInfo = new Writer();
  layerInfo.append(layerRecords).append(channelData);
  while (layerInfo.length % 4) layerInfo.u8(0);

  const layerAndMask = new Writer();
  if (version === PSB_VERSION) layerAndMask.u64(layerInfo.length);
  else layerAndMask.u32(layerInfo.length);
  layerAndMask.append(layerInfo);
  layerAndMask.u32(0);

  const compositeData = encodeCompositeRle(composite, documentWidth, documentHeight, version);
  const out = new Writer();
  out.ascii('8BPS').u16(version).push(new Uint8Array(6));
  out.u16(4).u32(documentHeight).u32(documentWidth).u16(8).u16(PSD_COLOR_MODE_RGB);
  out.u32(0);
  out.u32(0);
  if (version === PSB_VERSION) out.u64(layerAndMask.length);
  else out.u32(layerAndMask.length);
  out.append(layerAndMask);
  out.append(compositeData);

  if (out.length > maxBytes) {
    const hint = version === PSD_VERSION ? ' Для файлов больше 2 ГБ нужен PSB.' : '';
    throw new PsdImportError(`PSD/PSB writer: итоговый файл слишком большой для текущего browser limit (${Math.ceil(out.length / 1024 / 1024)} МБ).${hint}`, 'PSD_EXPORT_TOO_LARGE');
  }
  return out;
}

export function encodePsd(options = {}) {
  return buildPsdWriter({ ...options, version: PSD_VERSION }).concat();
}

export function encodePsdBlob(options = {}) {
  if (typeof Blob !== 'function') {
    throw new PsdImportError('PSD/PSB writer: Blob API недоступен в этом окружении', 'PSD_EXPORT_BLOB_UNAVAILABLE');
  }
  const writer = buildPsdWriter({ ...options, version: PSD_VERSION });
  return new Blob(writer.parts, { type: 'image/vnd.adobe.photoshop' });
}

export function encodePsb(options = {}) {
  return buildPsdWriter({ ...options, version: PSB_VERSION }).concat();
}

export function encodePsbBlob(options = {}) {
  if (typeof Blob !== 'function') {
    throw new PsdImportError('PSB writer: Blob API недоступен в этом окружении', 'PSD_EXPORT_BLOB_UNAVAILABLE');
  }
  const writer = buildPsdWriter({ ...options, version: PSB_VERSION });
  return new Blob(writer.parts, { type: 'image/vnd.adobe.photoshop' });
}
