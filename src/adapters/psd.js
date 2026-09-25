import { createPixelBuffer, createRgba8PixelBuffer, isPixelBuffer } from '../core/pixel-buffer.js';

const PSD_SIGNATURE = '8BPS';
const PSD_VERSION = 1;
const PSB_VERSION = 2;
const PSB_LONG_ADDITIONAL_KEYS = new Set(['LMsk','Lr16','Lr32','Layr','Mt16','Mt32','Mtrn','Alph','FMsk','lnk2','FEid','FXid','PxSD']);
const PSD_COLOR_MODE_RGB = 3;
const PSD_SUPPORTED_DEPTHS = new Set([8, 16, 32]);
const MAX_PSD_LAYERS = 500;
const MAX_PSD_CHANNEL_BYTES = 256 * 1024 * 1024;
const MAX_PSD_PATH_RECORDS = 262144;
const PSD_PATH_BOOLEAN_OPERATIONS = Object.freeze(['exclude','add','subtract','intersect']);

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
  if (!PSD_SUPPORTED_DEPTHS.has(header.bitsPerChannel)) {
    throw new PsdImportError(
      `PSD/PSB import поддерживает RGB 8/16/32-bit/channel. Получено: ${header.bitsPerChannel}-bit.`,
      'PSD_BIT_DEPTH',
    );
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


function readPascalEven(reader, sectionEnd) {
  if (reader.offset >= sectionEnd) throw new PsdImportError('Image resource: отсутствует Pascal name', 'PSD_IMAGE_RESOURCE');
  const length = reader.u8();
  if (reader.offset + length > sectionEnd) throw new PsdImportError('Image resource name выходит за границы секции', 'PSD_IMAGE_RESOURCE');
  const name = decodeLatin1(reader.take(length));
  if ((1 + length) & 1) {
    if (reader.offset >= sectionEnd) throw new PsdImportError('Image resource name padding отсутствует', 'PSD_IMAGE_RESOURCE');
    reader.skip(1);
  }
  return name;
}

function parseIccProfileHeader(bytes) {
  const summary = {
    size: bytes.length,
    declaredSize: null,
    version: null,
    deviceClass: null,
    colorSpace: null,
    pcs: null,
    signatureValid: false,
  };
  if (bytes.length < 128) return summary;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const asciiAt = offset => {
    let value = '';
    for (let i = 0; i < 4; i += 1) value += String.fromCharCode(bytes[offset + i]);
    return value;
  };
  summary.declaredSize = view.getUint32(0, false);
  const major = bytes[8];
  const minor = bytes[9] >> 4;
  const bugfix = bytes[9] & 0x0f;
  summary.version = `${major}.${minor}.${bugfix}`;
  summary.deviceClass = asciiAt(12).trim();
  summary.colorSpace = asciiAt(16).trim();
  summary.pcs = asciiAt(20).trim();
  summary.signatureValid = asciiAt(36) === 'acsp';
  return summary;
}


function readFixedPointPath32(reader) {
  return reader.i32() / 0x01000000;
}

function readPhotoshopPathPoint(reader, width, height) {
  const y = readFixedPointPath32(reader) * height;
  const x = readFixedPointPath32(reader) * width;
  return { x, y };
}

function pathPointEqual(a, b) {
  return Math.abs(a.x - b.x) < 1e-7 && Math.abs(a.y - b.y) < 1e-7;
}

function parsePhotoshopPathRecords(bytes, width, height, warnings = [], label = 'Path') {
  const reader = bytes instanceof Reader ? bytes : new Reader(asBytes(bytes));
  const end = reader.end;
  const subpaths = [];
  let current = null;
  let expectedKnots = 0;
  let recordCount = 0;
  let fillStartsWithAllPixels = false;
  while (end - reader.offset >= 26) {
    recordCount += 1;
    if (recordCount > MAX_PSD_PATH_RECORDS) throw new PsdImportError(`${label}: слишком много path records`, 'PSD_PATH_LIMIT');
    const recordStart = reader.offset;
    const selector = reader.u16();
    if (selector === 0 || selector === 3) {
      if (current && current.points.length !== expectedKnots) warnings.push(`${label}: число knots не совпало с length record`);
      expectedKnots = reader.u16();
      const boolOp = reader.i16();
      const flags = reader.u16();
      reader.skip(18);
      current = {
        closed: selector === 0,
        operation: PSD_PATH_BOOLEAN_OPERATIONS[boolOp] || 'add',
        fillRule: flags === 1 ? 'even-odd' : 'non-zero',
        points: [],
      };
      subpaths.push(current);
      continue;
    }
    if ([1,2,4,5].includes(selector)) {
      if (!current) { warnings.push(`${label}: knot без subpath length record пропущен`); reader.seek(recordStart + 26); continue; }
      const handleIn = readPhotoshopPathPoint(reader, width, height);
      const anchor = readPhotoshopPathPoint(reader, width, height);
      const handleOut = readPhotoshopPathPoint(reader, width, height);
      current.points.push({
        x: anchor.x,
        y: anchor.y,
        handleIn: pathPointEqual(handleIn, anchor) ? null : handleIn,
        handleOut: pathPointEqual(handleOut, anchor) ? null : handleOut,
        kind: selector === 1 || selector === 4 ? 'smooth' : 'corner',
      });
      continue;
    }
    if (selector === 6) { reader.skip(24); continue; }
    if (selector === 7) { reader.skip(24); continue; }
    if (selector === 8) { fillStartsWithAllPixels = Boolean(reader.u16()); reader.skip(22); continue; }
    warnings.push(`${label}: неизвестный path selector ${selector}; record пропущен`);
    reader.seek(recordStart + 26);
  }
  if (current && current.points.length !== expectedKnots) warnings.push(`${label}: число knots не совпало с последним length record`);
  if (reader.offset !== end) warnings.push(`${label}: ${end - reader.offset} trailing byte(s) после path records`);
  return {
    fillStartsWithAllPixels,
    subpaths: subpaths.filter(path => path.points.length >= 2),
  };
}
function parseImageResources(reader, section, warnings, { maxIccBytes = 4 * 1024 * 1024, width = 1, height = 1 } = {}) {
  const resources = {
    iccProfile: null,
    iccUntagged: false,
    paths: [],
  };
  while (reader.offset < section.end) {
    if (section.end - reader.offset < 12) {
      warnings.push('Image Resources: хвост секции короче минимального resource block');
      reader.seek(section.end);
      break;
    }
    const signature = reader.ascii(4);
    if (signature !== '8BIM') {
      warnings.push(`Image Resources: неизвестная сигнатура ${JSON.stringify(signature)}; оставшаяся часть секции пропущена`);
      reader.seek(section.end);
      break;
    }
    const id = reader.u16();
    const name = readPascalEven(reader, section.end);
    if (reader.offset + 4 > section.end) throw new PsdImportError('Image resource size отсутствует', 'PSD_IMAGE_RESOURCE');
    const size = reader.u32();
    if (reader.offset + size > section.end) throw new PsdImportError('Image resource data выходит за границы секции', 'PSD_IMAGE_RESOURCE');
    const data = reader.take(size);
    if (size & 1) {
      if (reader.offset >= section.end) throw new PsdImportError('Image resource padding отсутствует', 'PSD_IMAGE_RESOURCE');
      reader.skip(1);
    }

    if (id === 1039) {
      if (size > maxIccBytes) {
        warnings.push(`ICC profile пропущен: ${Math.ceil(size / 1024 / 1024)} МБ превышает лимит ${Math.ceil(maxIccBytes / 1024 / 1024)} МБ`);
        continue;
      }
      const bytes = new Uint8Array(size);
      bytes.set(data);
      resources.iccProfile = {
        id,
        name,
        bytes,
        ...parseIccProfileHeader(bytes),
      };
    } else if (id === 1041) {
      resources.iccUntagged = Boolean(data[0]);
    } else if (id >= 2000 && id <= 2997) {
      if (resources.paths.length >= 998) {
        warnings.push('Path Information: превышен лимит 998 saved paths; лишние ресурсы пропущены');
        continue;
      }
      const parsed = parsePhotoshopPathRecords(data, width, height, warnings, `Path resource ${id}`);
      if (parsed.subpaths.length) resources.paths.push({ id, name: name || `Path ${id - 1999}`, ...parsed });
    }
  }
  return resources;
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

function parseAdditionalLayerInfo(reader, extraEnd, record, version, documentWidth, documentHeight, warnings) {
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
    } else if ((key === 'vmsk' || key === 'vsms') && length >= 8) {
      const vectorVersion = reader.u32();
      const flags = reader.u32();
      if (vectorVersion !== 3) warnings.push(`Слой «${record.name}»: vector mask version ${vectorVersion} импортирован best-effort`);
      const parsed = parsePhotoshopPathRecords(
        new Reader(reader.bytes, reader.offset, dataEnd),
        documentWidth,
        documentHeight,
        warnings,
        `Vector mask «${record.name}»`,
      );
      record.vectorMask = {
        enabled: (flags & 4) === 0,
        invert: Boolean(flags & 1),
        linked: (flags & 2) === 0,
        fillStartsWithAllPixels: parsed.fillStartsWithAllPixels,
        subpaths: parsed.subpaths,
      };
    } else if ((key === 'lsct' || key === 'lsdk') && length >= 4) {
      record.sectionDivider = reader.u32();
      if (length >= 12 && reader.offset + 8 <= dataEnd) {
        const sectionSignature = reader.ascii(4);
        const sectionBlendKey = reader.ascii(4);
        if (sectionSignature === '8BIM') record.sectionBlendKey = sectionBlendKey;
      }
      if (length >= 16 && reader.offset + 4 <= dataEnd) record.sectionSubtype = reader.u32();
    }
    reader.seek(dataEnd);
    if ((length & 1) && reader.offset < extraEnd) reader.skip(1);
  }
}

function parseLayerRecord(reader, version, documentWidth, documentHeight, warnings) {
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
  if (reader.offset + 4 > extraEnd) { reader.seek(extraEnd); return { top,left,bottom,right,channels,blendKey,opacity,flags,mask,name:'Слой',sectionDivider:0,sectionBlendKey:null,sectionSubtype:0 }; }
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
  const record = { top,left,bottom,right,channels,blendKey,opacity,flags,mask,name,sectionDivider:0,sectionBlendKey:null,sectionSubtype:0,groupKey:null,vectorMask:null };
  parseAdditionalLayerInfo(reader, extraEnd, record, version, documentWidth, documentHeight, warnings);
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

async function inflateZlib(bytes, maxOutputBytes = null) {
  if (typeof DecompressionStream !== 'function' || typeof Blob !== 'function') {
    throw new PsdImportError('Этот браузер не поддерживает встроенную ZIP-декомпрессию PSD', 'PSD_ZIP_UNAVAILABLE');
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || !value.length) continue;
      total += value.length;
      if (Number.isFinite(maxOutputBytes) && total > maxOutputBytes) {
        await reader.cancel().catch(() => {});
        throw new PsdImportError(
          `ZIP PSD/PSB распаковывается больше ожидаемого лимита: ${total} > ${maxOutputBytes} байт`,
          'PSD_ZIP_LIMIT',
        );
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  } catch (error) {
    if (error instanceof PsdImportError) throw error;
    throw new PsdImportError(`Не удалось распаковать ZIP-канал PSD: ${error?.message || error}`, 'PSD_ZIP');
  }
}

function bytesPerSample(bitsPerChannel) {
  if (bitsPerChannel === 8) return 1;
  if (bitsPerChannel === 16) return 2;
  if (bitsPerChannel === 32) return 4;
  throw new PsdImportError(`Неподдерживаемая глубина PSD/PSB sample: ${bitsPerChannel}-bit`, 'PSD_BIT_DEPTH');
}

function decodedChannelByteLength(width, height, bitsPerChannel, maxChannelBytes) {
  const pixels = safeArea(width, height, Number.MAX_SAFE_INTEGER);
  const bytes = pixels * bytesPerSample(bitsPerChannel);
  if (!Number.isSafeInteger(bytes) || bytes > maxChannelBytes) {
    throw new PsdImportError(
      `PSD/PSB канал слишком большой после декодирования: ${Math.ceil(bytes / 1024 / 1024)} МБ`,
      'PSD_CHANNEL_LIMIT',
    );
  }
  return bytes;
}

function decodeZipPredictionBytes(bytes, width, height, bitsPerChannel) {
  const rowBytes = width * bytesPerSample(bitsPerChannel);
  const expected = rowBytes * height;
  if (bytes.length !== expected) {
    throw new PsdImportError(
      `ZIP prediction PSD/PSB: неверный размер после inflate: ${bytes.length} вместо ${expected}`,
      'PSD_ZIP_PREDICTION',
    );
  }

  if (bitsPerChannel === 8) {
    for (let row = 0; row < height; row += 1) {
      const start = row * rowBytes;
      for (let x = 1; x < rowBytes; x += 1) bytes[start + x] = (bytes[start + x] + bytes[start + x - 1]) & 255;
    }
    return bytes;
  }

  if (bitsPerChannel === 16) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let row = 0; row < height; row += 1) {
      const start = row * rowBytes;
      let previous = view.getUint16(start, false);
      for (let x = 1; x < width; x += 1) {
        const offset = start + x * 2;
        const value = (view.getUint16(offset, false) + previous) & 0xffff;
        view.setUint16(offset, value, false);
        previous = value;
      }
    }
    return bytes;
  }

  if (bitsPerChannel === 32) {
    for (let row = 0; row < height; row += 1) {
      const start = row * rowBytes;
      for (let x = 1; x < rowBytes; x += 1) bytes[start + x] = (bytes[start + x] + bytes[start + x - 1]) & 255;
    }
    const restored = new Uint8Array(bytes.length);
    for (let row = 0; row < height; row += 1) {
      const start = row * rowBytes;
      for (let x = 0; x < width; x += 1) {
        const target = start + x * 4;
        restored[target] = bytes[start + x];
        restored[target + 1] = bytes[start + width + x];
        restored[target + 2] = bytes[start + width * 2 + x];
        restored[target + 3] = bytes[start + width * 3 + x];
      }
    }
    return restored;
  }

  throw new PsdImportError(
    `ZIP prediction PSD/PSB: неподдерживаемая глубина ${bitsPerChannel}-bit`,
    'PSD_ZIP_PREDICTION',
  );
}

function decodeSamplePlane(bytes, bitsPerChannel) {
  if (bitsPerChannel === 8) return bytes;
  if (bitsPerChannel === 16) {
    if (bytes.length % 2) throw new PsdImportError('16-bit PSD/PSB канал имеет нечётную длину', 'PSD_16BIT_CHANNEL');
    const samples = new Uint16Array(bytes.length / 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < samples.length; index += 1) samples[index] = view.getUint16(index * 2, false);
    return samples;
  }
  if (bitsPerChannel === 32) {
    if (bytes.length % 4) throw new PsdImportError('32-bit PSD/PSB канал имеет неверную длину', 'PSD_32BIT_CHANNEL');
    const samples = new Float32Array(bytes.length / 4);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < samples.length; index += 1) samples[index] = view.getFloat32(index * 4, false);
    return samples;
  }
  throw new PsdImportError(`Неподдерживаемая глубина PSD/PSB sample: ${bitsPerChannel}-bit`, 'PSD_BIT_DEPTH');
}

async function decodeChannel(reader, descriptor, width, height, maxChannelBytes, version, bitsPerChannel) {
  const channelStart = reader.offset;
  const channelEnd = channelStart + descriptor.length;
  if (descriptor.length < 2 || channelEnd > reader.end || descriptor.length > maxChannelBytes * 2 + 16 * 1024 * 1024) {
    throw new PsdImportError('Некорректная длина PSD-канала', 'PSD_CHANNEL_LENGTH');
  }
  const compression = reader.u16();
  const expectedBytes = decodedChannelByteLength(width, height, bitsPerChannel, maxChannelBytes);
  const rowBytes = width * bytesPerSample(bitsPerChannel);
  let decodedBytes;
  if (compression === 0) {
    if (reader.offset + expectedBytes > channelEnd) {
      throw new PsdImportError('Raw PSD-канал имеет неверный размер', 'PSD_RAW_CHANNEL');
    }
    decodedBytes = reader.take(expectedBytes);
  } else if (compression === 1) {
    const rowLengths = [];
    const rowLengthBytes = version === PSB_VERSION ? 4 : 2;
    if (reader.offset + height * rowLengthBytes > channelEnd) {
      throw new PsdImportError('RLE table PSD/PSB выходит за границы канала', 'PSD_RLE');
    }
    for (let row = 0; row < height; row += 1) rowLengths.push(version === PSB_VERSION ? reader.u32() : reader.u16());
    decodedBytes = new Uint8Array(expectedBytes);
    for (let row = 0; row < height; row += 1) {
      if (reader.offset + rowLengths[row] > channelEnd) {
        throw new PsdImportError('RLE строка PSD/PSB выходит за границы канала', 'PSD_RLE');
      }
      const packed = reader.take(rowLengths[row]);
      decodedBytes.set(packBitsRow(packed, rowBytes), row * rowBytes);
    }
  } else if (compression === 2 || compression === 3) {
    const compressed = reader.take(channelEnd - reader.offset);
    decodedBytes = await inflateZlib(compressed, expectedBytes);
    if (decodedBytes.length !== expectedBytes) throw new PsdImportError('ZIP PSD-канал имеет неверный размер после распаковки', 'PSD_ZIP_CHANNEL');
    if (compression === 3) decodedBytes = decodeZipPredictionBytes(decodedBytes, width, height, bitsPerChannel);
  } else {
    throw new PsdImportError(`Неподдерживаемое сжатие PSD-канала: ${compression}`, 'PSD_COMPRESSION');
  }
  reader.seek(channelEnd);
  return decodeSamplePlane(decodedBytes, bitsPerChannel);
}

function composeRgbPixelBuffer(width, height, channels, bitsPerChannel) {
  const pixels = safeArea(width, height, Number.MAX_SAFE_INTEGER);
  const red = channels.get(0);
  const green = channels.get(1);
  const blue = channels.get(2);
  if (!red || !green || !blue) return null;
  const alpha = channels.get(-1);
  if (bitsPerChannel === 8) {
    const rgba = new Uint8ClampedArray(pixels * 4);
    for (let index = 0; index < pixels; index += 1) {
      const out = index * 4;
      rgba[out] = red[index];
      rgba[out + 1] = green[index];
      rgba[out + 2] = blue[index];
      rgba[out + 3] = alpha ? alpha[index] : 255;
    }
    return createRgba8PixelBuffer(width, height, rgba, { colorSpace: 'srgb' });
  }
  if (bitsPerChannel === 16) {
    const rgba = new Uint16Array(pixels * 4);
    for (let index = 0; index < pixels; index += 1) {
      const out = index * 4;
      rgba[out] = red[index];
      rgba[out + 1] = green[index];
      rgba[out + 2] = blue[index];
      rgba[out + 3] = alpha ? alpha[index] : 65535;
    }
    return createPixelBuffer({
      width,
      height,
      model: 'rgb',
      channels: 4,
      bitsPerChannel: 16,
      colorSpace: 'srgb',
      alphaMode: 'straight',
      data: rgba,
    });
  }
  if (bitsPerChannel === 32) {
    const rgba = new Float32Array(pixels * 4);
    for (let index = 0; index < pixels; index += 1) {
      const out = index * 4;
      rgba[out] = red[index];
      rgba[out + 1] = green[index];
      rgba[out + 2] = blue[index];
      rgba[out + 3] = alpha ? alpha[index] : 1;
    }
    return createPixelBuffer({
      width,
      height,
      model: 'rgb',
      channels: 4,
      bitsPerChannel: 32,
      colorSpace: 'linear-rgb-unmanaged',
      alphaMode: 'straight',
      data: rgba,
    });
  }
  return null;
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
      const sample = maskChannel[y * maskWidth + x];
      let value = maskChannel instanceof Uint16Array
        ? Math.round(sample / 257)
        : maskChannel instanceof Float32Array
          ? Math.round(Math.min(1, Math.max(0, Number.isNaN(sample) ? 0 : sample)) * 255)
          : sample;
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

function groupBlendModeFor(key, warnings, groupName) {
  if (key === 'pass') return 'pass-through';
  if (key in PSD_BLEND_MODES) return PSD_BLEND_MODES[key];
  warnings.push(`Группа «${groupName}»: blend mode ${JSON.stringify(key)} импортирован как Pass Through`);
  return 'pass-through';
}


function reconstructPsdGroups(records, warnings) {
  const stack = [];
  const groups = [];
  let sequence = 0;

  for (const record of records) {
    const divider = Number(record.sectionDivider) || 0;
    if (divider === 3) {
      const group = {
        key: `psd-group-${++sequence}`,
        name: `PSD Group ${sequence}`,
        parent: stack.at(-1) ?? null,
        collapsed: false,
        visible: true,
        opacity: 1,
        blendKey: 'pass',
      };
      groups.push(group);
      stack.push(group);
      continue;
    }

    if (divider === 1 || divider === 2) {
      const group = stack.pop();
      if (!group) {
        warnings.push(`Группа «${record.name || 'PSD Group'}»: folder marker не имеет matching bounding divider`);
        continue;
      }
      group.name = record.name || group.name;
      group.collapsed = divider === 2;
      group.visible = !(record.flags & 0x02);
      group.opacity = record.opacity / 255;
      group.blendKey = record.sectionBlendKey || record.blendKey || 'pass';
      continue;
    }

    if (stack.length) record.groupKey = stack.at(-1).key;
  }

  if (stack.length) {
    warnings.push(`PSD/PSB содержит ${stack.length} незакрытых group divider; импортирована доступная часть структуры`);
  }

  const serialized = groups.map(group => {
    const path = [];
    const seen = new Set();
    let cursor = group;
    let visible = true;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      path.unshift(cursor.name || 'PSD Group');
      visible = visible && cursor.visible !== false;
      cursor = cursor.parent;
    }
    return {
      key: group.key,
      parentKey: group.parent?.key ?? null,
      name: group.name || 'PSD Group',
      path,
      depth: Math.max(0, path.length - 1),
      collapsed: Boolean(group.collapsed),
      visible: group.visible !== false,
      effectiveVisible: visible,
      opacity: group.opacity,
      blendMode: groupBlendModeFor(group.blendKey || 'pass', warnings, path.join(' / ')),
    };
  });

  return serialized;
}

async function decodeComposite(reader, header, maxChannelBytes) {
  if (reader.offset >= reader.end) return null;
  const compression = reader.u16();
  const planeBytes = decodedChannelByteLength(header.width, header.height, header.bitsPerChannel, maxChannelBytes);
  const rowBytes = header.width * bytesPerSample(header.bitsPerChannel);
  const channels = new Map();
  if (compression === 0) {
    for (let channel = 0; channel < header.channels; channel += 1) {
      const bytes = reader.take(planeBytes);
      if (channel < 3) channels.set(channel, decodeSamplePlane(bytes, header.bitsPerChannel));
      else if (channel === 3) channels.set(-1, decodeSamplePlane(bytes, header.bitsPerChannel));
    }
  } else if (compression === 1) {
    const rowLengths = [];
    for (let channel = 0; channel < header.channels; channel += 1) {
      const rows = [];
      for (let row = 0; row < header.height; row += 1) rows.push(header.version === PSB_VERSION ? reader.u32() : reader.u16());
      rowLengths.push(rows);
    }
    for (let channel = 0; channel < header.channels; channel += 1) {
      const bytes = new Uint8Array(planeBytes);
      for (let row = 0; row < header.height; row += 1) {
        bytes.set(packBitsRow(reader.take(rowLengths[channel][row]), rowBytes), row * rowBytes);
      }
      if (channel < 3) channels.set(channel, decodeSamplePlane(bytes, header.bitsPerChannel));
      else if (channel === 3) channels.set(-1, decodeSamplePlane(bytes, header.bitsPerChannel));
    }
  } else if (compression === 2 || compression === 3) {
    const expected = planeBytes * header.channels;
    if (!Number.isSafeInteger(expected)) throw new PsdImportError('Composite ZIP PSD/PSB слишком большой', 'PSD_COMPOSITE_ZIP');
    const decoded = await inflateZlib(reader.take(reader.end - reader.offset), expected);
    if (decoded.length !== expected) {
      throw new PsdImportError('Composite ZIP PSD/PSB имеет неверный размер после распаковки', 'PSD_COMPOSITE_ZIP');
    }
    for (let channel = 0; channel < header.channels; channel += 1) {
      let bytes = decoded.slice(channel * planeBytes, (channel + 1) * planeBytes);
      if (compression === 3) bytes = decodeZipPredictionBytes(bytes, header.width, header.height, header.bitsPerChannel);
      if (channel < 3) channels.set(channel, decodeSamplePlane(bytes, header.bitsPerChannel));
      else if (channel === 3) channels.set(-1, decodeSamplePlane(bytes, header.bitsPerChannel));
    }
  } else {
    throw new PsdImportError(`Неподдерживаемое сжатие composite PSD: ${compression}`, 'PSD_COMPOSITE_COMPRESSION');
  }
  return composeRgbPixelBuffer(header.width, header.height, channels, header.bitsPerChannel);
}

async function parseLayerInfoBody(reader, layerInfoEnd, header, maxPixels, maxLayers, maxChannelBytes, warnings) {
  const records = [];
  if (reader.offset >= layerInfoEnd) return records;
  if (reader.offset + 2 > layerInfoEnd) throw new PsdImportError('Layer info не содержит layer count', 'PSD_LAYER_INFO');
  const layerCountSigned = reader.i16();
  const layerCount = Math.abs(layerCountSigned);
  if (layerCount > maxLayers) throw new PsdImportError(`PSD содержит слишком много слоёв: ${layerCount} > ${maxLayers}`, 'PSD_LAYER_LIMIT');
  for (let index = 0; index < layerCount; index += 1) records.push(parseLayerRecord(reader, header.version, header.width, header.height, warnings));
  for (const record of records) {
    const width = Math.max(0, record.right - record.left);
    const height = Math.max(0, record.bottom - record.top);
    if (width && height) safeArea(width, height, maxPixels);
    record.decodedChannels = new Map();
    for (const descriptor of record.channels) {
      const useMaskBounds = descriptor.id === -2 && record.mask;
      const channelWidth = useMaskBounds ? Math.max(0, record.mask.right - record.mask.left) : width;
      const channelHeight = useMaskBounds ? Math.max(0, record.mask.bottom - record.mask.top) : height;
      if (!channelWidth || !channelHeight) {
        if (reader.offset + descriptor.length > layerInfoEnd) throw new PsdImportError('PSD layer channel выходит за границы layer info', 'PSD_LAYER_INFO');
        reader.skip(descriptor.length);
        continue;
      }
      const data = await decodeChannel(reader, descriptor, channelWidth, channelHeight, maxChannelBytes, header.version, header.bitsPerChannel);
      if ([0,1,2,-1,-2].includes(descriptor.id)) record.decodedChannels.set(descriptor.id, data);
    }
  }
  if (reader.offset > layerInfoEnd) throw new PsdImportError('PSD layer info channel data выходит за границы секции', 'PSD_LAYER_INFO');
  reader.seek(layerInfoEnd);
  return records;
}

async function readHighDepthLayerInfoBlocks(reader, sectionEnd, header, maxPixels, maxLayers, maxChannelBytes, warnings) {
  const wantedKey = header.bitsPerChannel === 16 ? 'Lr16' : header.bitsPerChannel === 32 ? 'Lr32' : null;
  let highDepthRecords = null;
  while (reader.offset + 12 <= sectionEnd) {
    const blockStart = reader.offset;
    const signature = reader.ascii(4);
    if (signature !== '8BIM' && signature !== '8B64') { reader.seek(blockStart); break; }
    const key = reader.ascii(4);
    const useLongLength = header.version === PSB_VERSION && (signature === '8B64' || PSB_LONG_ADDITIONAL_KEYS.has(key));
    const length = useLongLength ? reader.u64() : reader.u32();
    const dataStart = reader.offset;
    const dataEnd = dataStart + length;
    if (dataEnd > sectionEnd) throw new PsdImportError(`Additional Layer Info ${key}: длина выходит за границы секции`, 'PSD_LAYER_INFO');
    if (wantedKey && key === wantedKey && length > 0) {
      const blockReader = new Reader(reader.bytes, dataStart, dataEnd);
      highDepthRecords = await parseLayerInfoBody(blockReader, dataEnd, header, maxPixels, maxLayers, maxChannelBytes, warnings);
    }
    reader.seek(dataEnd);
    if ((length & 1) && reader.offset < sectionEnd) reader.skip(1);
  }
  return highDepthRecords;
}

export async function decodePsd(buffer, { maxPixels = 48_000_000, maxLayers = MAX_PSD_LAYERS, maxChannelBytes = MAX_PSD_CHANNEL_BYTES } = {}) {
  const bytes = asBytes(buffer);
  const header = inspectPsdHeader(bytes);
  requireImportCapabilities(header, maxPixels);
  const reader = new Reader(bytes);
  reader.skip(26);
  const colorMode = readLengthSection(reader, 'Color Mode Data'); reader.seek(colorMode.end);
  const warnings = [];
  const resources = readLengthSection(reader, 'Image Resources');
  const imageResources = parseImageResources(reader, resources, warnings, { width:header.width, height:header.height });
  reader.seek(resources.end);
  const layerMaskLength = readVersionedLength(reader, header.version);
  const layerMaskEnd = reader.offset + layerMaskLength;
  if (layerMaskEnd > reader.end) throw new PsdImportError('Layer and Mask Information: длина выходит за границы файла', 'PSD_SECTION_LENGTH');
  const layerMask = { length: layerMaskLength, end: layerMaskEnd };
  let records = [];
  if (layerMask.length > 0) {
    const layerInfoLength = readVersionedLength(reader, header.version);
    const layerInfoEnd = reader.offset + layerInfoLength;
    if (layerInfoEnd > layerMask.end) throw new PsdImportError('Layer info выходит за границы Layer and Mask section', 'PSD_LAYER_INFO');
    if (layerInfoLength > 0) records = await parseLayerInfoBody(reader, layerInfoEnd, header, maxPixels, maxLayers, maxChannelBytes, warnings);
    else reader.seek(layerInfoEnd);

    if (reader.offset + 4 <= layerMask.end) {
      const globalMaskLength = reader.u32();
      if (reader.offset + globalMaskLength > layerMask.end) throw new PsdImportError('Global Layer Mask выходит за границы секции', 'PSD_LAYER_INFO');
      reader.skip(globalMaskLength);
    }
    const taggedRecords = await readHighDepthLayerInfoBlocks(reader, layerMask.end, header, maxPixels, maxLayers, maxChannelBytes, warnings);
    if (taggedRecords?.length) records = taggedRecords;
    reader.seek(layerMask.end);
  }

  const groups = reconstructPsdGroups(records, warnings);

  const layers = [];
  for (const record of records) {
    if (record.sectionDivider === 1 || record.sectionDivider === 2 || record.sectionDivider === 3) continue;
    const width = Math.max(0, record.right - record.left);
    const height = Math.max(0, record.bottom - record.top);
    if (!width || !height) { warnings.push(`Слой «${record.name}» пропущен: пустые bounds`); continue; }
    const pixelBuffer = composeRgbPixelBuffer(width, height, record.decodedChannels, header.bitsPerChannel);
    if (!pixelBuffer) { warnings.push(`Слой «${record.name}» пропущен: нет RGB bitmap-preview`); continue; }
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
      groupKey: record.groupKey || null,
      pixelBuffer,
      pixels: header.bitsPerChannel === 8 ? pixelBuffer.data : null,
      mask: maskRgba ? { pixels: maskRgba, disabled: Boolean(record.mask?.disabled) } : null,
      vectorMask: record.vectorMask,
    });
  }

  let composite = null;
  let compositePixelBuffer = null;
  if (!layers.length && reader.offset < reader.end) {
    compositePixelBuffer = await decodeComposite(reader, header, maxChannelBytes);
    if (compositePixelBuffer) {
      composite = header.bitsPerChannel === 8 ? compositePixelBuffer.data : null;
      warnings.push('PSD/PSB не содержит импортируемых bitmap-слоёв: использован composite preview');
    }
  }
  return {
    ...header,
    layers,
    groups,
    composite,
    compositePixelBuffer,
    iccProfile: imageResources.iccProfile,
    iccUntagged: imageResources.iccUntagged,
    paths: imageResources.paths,
    warnings,
  };
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


function writeFixedPointPath32(writer, value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < -16 || number >= 16) {
    throw new PsdImportError(`PSD/PSB writer: ${label} выходит за диапазон path fixed-point [-16, 16)`, 'PSD_EXPORT_PATH_RANGE');
  }
  return writer.i32(Math.round(number * 0x01000000));
}

function writePhotoshopPathPoint(writer, point, width, height, label) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
    throw new PsdImportError(`PSD/PSB writer: ${label} содержит некорректную точку`, 'PSD_EXPORT_PATH_POINT');
  }
  writeFixedPointPath32(writer, Number(point.y) / height, `${label}.y`);
  writeFixedPointPath32(writer, Number(point.x) / width, `${label}.x`);
}

function writePhotoshopPathRecords(writer, pathData, width, height, label = 'Path') {
  const subpaths = Array.isArray(pathData?.subpaths) ? pathData.subpaths : [];
  if (!subpaths.length) throw new PsdImportError(`PSD/PSB writer: ${label} не содержит subpaths`, 'PSD_EXPORT_PATH_EMPTY');
  writer.u16(6).push(new Uint8Array(24));
  writer.u16(8).u16(pathData?.fillStartsWithAllPixels ? 1 : 0).push(new Uint8Array(22));
  let recordCount = 2;
  for (let subpathIndex = 0; subpathIndex < subpaths.length; subpathIndex += 1) {
    const subpath = subpaths[subpathIndex];
    const points = Array.isArray(subpath?.points) ? subpath.points : [];
    if (points.length < 2 || points.length > 65535) {
      throw new PsdImportError(`PSD/PSB writer: ${label} subpath #${subpathIndex + 1} имеет недопустимое число knots`, 'PSD_EXPORT_PATH_KNOTS');
    }
    recordCount += 1 + points.length;
    if (recordCount > MAX_PSD_PATH_RECORDS) throw new PsdImportError(`PSD/PSB writer: ${label} превышает лимит path records`, 'PSD_EXPORT_PATH_LIMIT');
    const closed = subpath?.closed !== false;
    const operation = ['add','subtract','intersect','exclude'].includes(subpath?.operation) ? subpath.operation : 'add';
    const boolOp = PSD_PATH_BOOLEAN_OPERATIONS.indexOf(operation);
    writer.u16(closed ? 0 : 3).u16(points.length).i16(boolOp).u16(subpath?.fillRule === 'even-odd' ? 1 : 2).push(new Uint8Array(18));
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      const linked = point?.kind === 'smooth';
      writer.u16(closed ? (linked ? 1 : 2) : (linked ? 4 : 5));
      writePhotoshopPathPoint(writer, point?.handleIn || point, width, height, `${label} handleIn`);
      writePhotoshopPathPoint(writer, point, width, height, `${label} anchor`);
      writePhotoshopPathPoint(writer, point?.handleOut || point, width, height, `${label} handleOut`);
    }
  }
}

function writeVectorMaskExtra(writer, layer, documentWidth, documentHeight) {
  if (!layer.vectorMask?.subpaths?.length) return;
  const vectorMask = layer.vectorMask;
  const data = new Writer();
  const flags = (vectorMask.invert ? 1 : 0) | (vectorMask.linked === false ? 2 : 0) | (vectorMask.enabled === false ? 4 : 0);
  data.u32(3).u32(flags);
  writePhotoshopPathRecords(data, vectorMask, documentWidth, documentHeight, `vector mask «${layer.name || 'Layer'}»`);
  writer.ascii('8BIM').ascii('vmsk').u32(data.length).append(data);
  if (data.length & 1) writer.u8(0);
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

function exportPixelSource(value, width, height, label) {
  const count = safeArea(width, height, Number.MAX_SAFE_INTEGER);
  if (isPixelBuffer(value?.pixelBuffer)) {
    const buffer = value.pixelBuffer;
    if (buffer.model !== 'rgb' || ![3,4].includes(buffer.channels) || buffer.width !== width || buffer.height !== height) {
      throw new PsdImportError(`PSD/PSB writer: ${label} имеет несовместимый PixelBuffer`, 'PSD_EXPORT_PIXELS');
    }
    return { kind:'pixel-buffer', buffer };
  }
  const rgba = asBytes(value?.pixels);
  if (rgba.length !== count * 4) {
    throw new PsdImportError(`PSD/PSB writer: ${label} имеет неверный RGBA-буфер`, 'PSD_EXPORT_PIXELS');
  }
  return { kind:'rgba8', pixels:rgba };
}

function exportSourceValue(source, pixel, channel) {
  if (source.kind === 'rgba8') return source.pixels[pixel * 4 + channel] / 255;
  const buffer = source.buffer;
  const offset = pixel * buffer.channels;
  if (channel === 3 && buffer.channels === 3) return 1;
  const value = Number(buffer.data[offset + channel]);
  if (!Number.isFinite(value)) return 0;
  if (buffer.bitsPerChannel === 8) return value / 255;
  if (buffer.bitsPerChannel === 16) return value / 65535;
  return channel === 3 ? Math.max(0, Math.min(1, value)) : value;
}

function writeExportSample(view, offset, value, bitsPerChannel, channel) {
  const finite = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (bitsPerChannel === 8) {
    view.setUint8(offset, Math.round(Math.max(0, Math.min(1, finite)) * 255));
    return;
  }
  if (bitsPerChannel === 16) {
    view.setUint16(offset, Math.round(Math.max(0, Math.min(1, finite)) * 65535), false);
    return;
  }
  view.setFloat32(offset, channel === 3 ? Math.max(0, Math.min(1, finite)) : finite, false);
}

function fillExportChannelRow(target, source, channel, width, row, bitsPerChannel, { whiteMatte=false } = {}) {
  const sampleBytes = bytesPerSample(bitsPerChannel);
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength);
  for (let x=0; x<width; x+=1) {
    const pixel = row * width + x;
    const alpha = exportSourceValue(source, pixel, 3);
    let value = exportSourceValue(source, pixel, channel);
    if (whiteMatte && channel < 3 && alpha > 0 && alpha < 1) value = value * alpha + (1 - alpha);
    writeExportSample(view, x * sampleBytes, value, bitsPerChannel, channel);
  }
  return target;
}

function encodeRleExportChannel(source, channel, width, height, version, options = {}) {
  const rowLengthBytes = version === PSB_VERSION ? 4 : 2;
  const rows = [];
  const lengths = rowLengthBytes === 4 ? new Uint32Array(height) : new Uint16Array(height);
  const raw = new Uint8Array(width);
  for (let row=0; row<height; row+=1) {
    fillExportChannelRow(raw, source, channel, width, row, 8, options);
    const packed = packBitsEncodeRow(raw);
    const max = rowLengthBytes === 4 ? 0xffffffff : 0xffff;
    if (packed.length > max) throw new PsdImportError('PSD/PSB writer: RLE-строка превышает допустимую длину', 'PSD_EXPORT_RLE_ROW');
    lengths[row] = packed.length;
    rows.push(packed);
  }
  const writer = new Writer();
  writer.u16(1);
  for (const length of lengths) rowLengthBytes === 4 ? writer.u32(length) : writer.u16(length);
  for (const row of rows) writer.push(row);
  return writer;
}

function encodeRawExportChannel(source, channel, width, height, bitsPerChannel, options = {}) {
  const writer = new Writer();
  writer.u16(0);
  const rowBytes = width * bytesPerSample(bitsPerChannel);
  for (let row=0; row<height; row+=1) {
    const bytes = new Uint8Array(rowBytes);
    fillExportChannelRow(bytes, source, channel, width, row, bitsPerChannel, options);
    writer.push(bytes);
  }
  return writer;
}

function encodeExportChannel(source, channel, width, height, version, bitsPerChannel, options = {}) {
  if (bitsPerChannel === 8 && source.kind === 'rgba8') {
    return encodeRleRgbaChannel(source.pixels, channel, width, height, version, options);
  }
  if (bitsPerChannel === 8) return encodeRleExportChannel(source, channel, width, height, version, options);
  return encodeRawExportChannel(source, channel, width, height, bitsPerChannel, options);
}

function validateExportLayer(layer, index, maxPixels) {
  const width = Math.trunc(Number(layer?.width));
  const height = Math.trunc(Number(layer?.height));
  safeArea(width, height, maxPixels);
  const source = exportPixelSource(layer, width, height, `слой #${index + 1}`);
  const x = Math.trunc(Number(layer?.x) || 0);
  const y = Math.trunc(Number(layer?.y) || 0);
  return { ...layer, x, y, width, height, source };
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


function writeSectionDividerExtra(writer, layer) {
  const divider = Number(layer?.sectionDivider) || 0;
  if (![1,2,3].includes(divider)) return;
  const data = new Writer();
  data.u32(divider);
  data.ascii('8BIM');
  data.ascii(layer.sectionBlendKey || 'pass');
  writer.ascii('8BIM').ascii('lsct').u32(data.length).append(data);
  if (data.length & 1) writer.u8(0);
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

function normalizeExportLayer(layer, index, maxPixels, version, bitsPerChannel) {
  const item = validateExportLayer(layer, index, maxPixels);
  const channels = [
    { id: 0, data: encodeExportChannel(item.source, 0, item.width, item.height, version, bitsPerChannel) },
    { id: 1, data: encodeExportChannel(item.source, 1, item.width, item.height, version, bitsPerChannel) },
    { id: 2, data: encodeExportChannel(item.source, 2, item.width, item.height, version, bitsPerChannel) },
    { id: -1, data: encodeExportChannel(item.source, 3, item.width, item.height, version, bitsPerChannel) },
  ];
  let mask = null;
  if (item.mask?.pixels || isPixelBuffer(item.mask?.pixelBuffer)) {
    const maskSource = exportPixelSource(item.mask, item.width, item.height, `маска слоя «${item.name || index + 1}»`);
    mask = { disabled: Boolean(item.mask.disabled), pixels: true };
    channels.push({ id: -2, data: encodeExportChannel(maskSource, 3, item.width, item.height, version, bitsPerChannel) });
  }
  const { pixels: _pixels, pixelBuffer: _pixelBuffer, source: _source, ...metadata } = item;
  return { ...metadata, mask, channels };
}


function normalizeExportGroups(groups = []) {
  if (!Array.isArray(groups)) return [];
  const seen = new Set();
  const normalized = [];
  for (const group of groups) {
    const key = String(group?.key ?? group?.id ?? '').slice(0, 160);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      key,
      parentKey: group?.parentKey == null ? null : String(group.parentKey).slice(0, 160),
      name: String(group?.name || 'Group').slice(0, 240),
      visible: group?.visible !== false,
      collapsed: Boolean(group?.collapsed),
      opacity: Math.max(0, Math.min(1, Number(group?.opacity ?? 1))),
      blendMode: group?.blendMode === 'pass-through' || group?.blendMode in PSD_BLEND_KEYS ? group.blendMode : 'pass-through',
    });
  }
  return normalized;
}

function makeExportGroupMarker(group, sectionDivider) {
  const folder = sectionDivider !== 3;
  const sectionBlendKey = group.blendMode === 'pass-through' ? 'pass' : (PSD_BLEND_KEYS[group.blendMode] || 'norm');
  return {
    recordType: sectionDivider === 3 ? 'group-boundary' : 'group-folder',
    sectionDivider,
    sectionBlendKey,
    name: sectionDivider === 3 ? '</Layer group>' : group.name,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    opacity: folder ? group.opacity : 1,
    blendMode: 'source-over',
    visible: folder ? group.visible : false,
    transparencyProtected: false,
    mask: null,
    channels: [],
  };
}

function exportGroupLineage(groupMap, key) {
  if (!key) return [];
  const lineage = [];
  const seen = new Set();
  let current = groupMap.get(String(key));
  if (!current) return [];
  while (current) {
    if (seen.has(current.key)) {
      throw new PsdImportError(`PSD/PSB writer: цикл вложенности групп у «${current.name}»`, 'PSD_EXPORT_GROUP_CYCLE');
    }
    seen.add(current.key);
    lineage.unshift(current);
    if (!current.parentKey) break;
    const parent = groupMap.get(String(current.parentKey));
    if (!parent) {
      throw new PsdImportError(
        `PSD/PSB writer: родительская группа ${JSON.stringify(current.parentKey)} для «${current.name}» отсутствует`,
        'PSD_EXPORT_GROUP_PARENT',
      );
    }
    current = parent;
  }
  return lineage;
}

function expandExportLayerGroups(layers, groups) {
  const groupMap = new Map(normalizeExportGroups(groups).map(group => [group.key, group]));
  if (!groupMap.size) return layers;
  const records = [];
  const open = [];
  const closed = new Set();

  const closeTo = common => {
    while (open.length > common) {
      const group = open.pop();
      records.push(makeExportGroupMarker(group, group.collapsed ? 2 : 1));
      closed.add(group.key);
    }
  };

  for (const layer of layers) {
    const lineage = exportGroupLineage(groupMap, layer.groupKey);
    let common = 0;
    while (common < open.length && common < lineage.length && open[common].key === lineage[common].key) common += 1;
    closeTo(common);
    for (let index = common; index < lineage.length; index += 1) {
      const group = lineage[index];
      if (closed.has(group.key)) {
        throw new PsdImportError(
          `PSD/PSB writer: группа «${group.name}» разделена несмежными слоями`,
          'PSD_EXPORT_GROUP_SPLIT',
        );
      }
      records.push(makeExportGroupMarker(group, 3));
      open.push(group);
    }
    records.push(layer);
  }
  closeTo(0);
  return records;
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

function encodeCompositeData({ composite, compositePixelBuffer }, width, height, version, bitsPerChannel) {
  if (bitsPerChannel === 8 && !compositePixelBuffer) return encodeCompositeRle(composite, width, height, version);
  const source = exportPixelSource(
    compositePixelBuffer ? { pixelBuffer:compositePixelBuffer } : { pixels:composite },
    width,
    height,
    'composite',
  );
  if (bitsPerChannel === 8) {
    const writer = new Writer();
    // Composite RLE has one compression header and a single row-length table for all planes,
    // unlike per-layer channels.
    const rowLengthBytes = version === PSB_VERSION ? 4 : 2;
    const rows = [];
    const lengths = [];
    const raw = new Uint8Array(width);
    for (let channel=0; channel<4; channel+=1) {
      for (let row=0; row<height; row+=1) {
        fillExportChannelRow(raw, source, channel, width, row, 8, { whiteMatte:true });
        const packed = packBitsEncodeRow(raw);
        lengths.push(packed.length);
        rows.push(packed);
      }
    }
    writer.u16(1);
    for (const length of lengths) rowLengthBytes === 4 ? writer.u32(length) : writer.u16(length);
    for (const row of rows) writer.push(row);
    return writer;
  }
  const writer = new Writer();
  writer.u16(0);
  const rowBytes = width * bytesPerSample(bitsPerChannel);
  for (let channel=0; channel<4; channel+=1) {
    for (let row=0; row<height; row+=1) {
      const bytes = new Uint8Array(rowBytes);
      fillExportChannelRow(bytes, source, channel, width, row, bitsPerChannel, { whiteMatte:true });
      writer.push(bytes);
    }
  }
  return writer;
}


function writePascalEven(writer, name = '') {
  const text = String(name || '').slice(0, 255);
  writer.u8(text.length);
  for (let index = 0; index < text.length; index += 1) writer.u8(text.charCodeAt(index) & 255);
  if ((1 + text.length) & 1) writer.u8(0);
}

function writeImageResourceBlock(writer, id, data, name = '') {
  const bytes = asBytes(data);
  writer.ascii('8BIM').u16(id);
  writePascalEven(writer, name);
  writer.u32(bytes.length).push(bytes);
  if (bytes.length & 1) writer.u8(0);
}


function writeSavedPathResources(resources, paths, width, height) {
  if (!Array.isArray(paths) || !paths.length) return;
  const used = new Set();
  let nextId = 2000;
  const allocateId = requested => {
    const candidate = Number.isInteger(requested) && requested >= 2000 && requested <= 2997 && !used.has(requested) ? requested : null;
    if (candidate !== null) { used.add(candidate); return candidate; }
    while (nextId <= 2997 && used.has(nextId)) nextId += 1;
    if (nextId > 2997) throw new PsdImportError('PSD/PSB writer: исчерпан диапазон saved path resources 2000..2997', 'PSD_EXPORT_PATH_RESOURCE_LIMIT');
    const id = nextId++; used.add(id); return id;
  };
  for (const path of paths.slice(0, 998)) {
    const data = new Writer();
    writePhotoshopPathRecords(data, path, width, height, `saved path «${path?.name || 'Path'}»`);
    writeImageResourceBlock(resources, allocateId(path?.id), data.concat(), path?.name || 'Path');
  }
}
function buildImageResources({ iccProfile = null, iccUntagged = false, paths = [], width = 1, height = 1, maxIccBytes = 4 * 1024 * 1024 } = {}) {
  const resources = new Writer();
  if (iccProfile) {
    const bytes = asBytes(iccProfile);
    if (bytes.length > maxIccBytes) {
      throw new PsdImportError(
        `PSD/PSB writer: ICC profile ${Math.ceil(bytes.length / 1024 / 1024)} МБ превышает лимит ${Math.ceil(maxIccBytes / 1024 / 1024)} МБ`,
        'PSD_EXPORT_ICC_LIMIT',
      );
    }
    writeImageResourceBlock(resources, 1039, bytes);
  }
  if (iccUntagged) writeImageResourceBlock(resources, 1041, Uint8Array.of(1));
  writeSavedPathResources(resources, paths, width, height);
  return resources;
}

function writeLayerRecordAndData(layerRecords, channelData, layer, version, documentWidth, documentHeight) {
  layerRecords.i32(layer.y).i32(layer.x).i32(layer.y + layer.height).i32(layer.x + layer.width);
  layerRecords.u16(layer.channels.length);
  for (const channel of layer.channels) {
    layerRecords.i16(channel.id);
    if (version === PSB_VERSION) layerRecords.u64(channel.data.length);
    else layerRecords.u32(channel.data.length);
  }
  layerRecords.ascii('8BIM');
  layerRecords.ascii(layer.sectionDivider ? (layer.sectionBlendKey || 'pass') : (PSD_BLEND_KEYS[layer.blendMode] || 'norm'));
  const opacity = Math.round(Math.max(0, Math.min(1, Number(layer.opacity ?? 1))) * 255);
  layerRecords.u8(opacity).u8(0);
  const flags = 0x08 | (layer.transparencyProtected ? 0x01 : 0) | (layer.visible === false ? 0x02 : 0);
  layerRecords.u8(flags).u8(0);

  const extra = new Writer();
  writeLayerMaskExtra(extra, layer);
  extra.u32(0);
  writePascalLayerName(extra, layer.name || 'Layer');
  writeUnicodeLayerName(extra, layer.name || 'Layer');
  writeSectionDividerExtra(extra, layer);
  writeVectorMaskExtra(extra, layer, documentWidth, documentHeight);
  layerRecords.u32(extra.length).append(extra);
  for (const channel of layer.channels) channelData.append(channel.data);
}

function buildLayerInfoBody(records, version, documentWidth, documentHeight) {
  const layerRecords = new Writer();
  const channelData = new Writer();
  layerRecords.i16(-records.length);
  for (const layer of records) writeLayerRecordAndData(layerRecords, channelData, layer, version, documentWidth, documentHeight);
  const layerInfo = new Writer();
  layerInfo.append(layerRecords).append(channelData);
  while (layerInfo.length % 4) layerInfo.u8(0);
  return layerInfo;
}

function appendHighDepthLayerInfoBlock(writer, layerInfo, version, bitsPerChannel) {
  const key = bitsPerChannel === 16 ? 'Lr16' : bitsPerChannel === 32 ? 'Lr32' : null;
  if (!key) throw new PsdImportError(`PSD/PSB writer: high-depth tagged layer info не поддерживает ${bitsPerChannel}-bit`, 'PSD_EXPORT_DEPTH');
  writer.ascii(version === PSB_VERSION ? '8B64' : '8BIM').ascii(key);
  if (version === PSB_VERSION) writer.u64(layerInfo.length);
  else writer.u32(layerInfo.length);
  writer.append(layerInfo);
  if (layerInfo.length & 1) writer.u8(0);
}

function buildPsdWriter({ width, height, layers = [], groups = [], paths = [], composite, compositePixelBuffer = null, bitsPerChannel = 8, iccProfile = null, iccUntagged = false, version = PSD_VERSION, maxPixels = 48_000_000, maxLayers = MAX_PSD_LAYERS, maxBytes = 2_000_000_000 } = {}) {
  if (version !== PSD_VERSION && version !== PSB_VERSION) throw new PsdImportError(`PSD/PSB writer: unsupported version ${version}`, 'PSD_EXPORT_VERSION');
  const depth = Math.trunc(Number(bitsPerChannel));
  if (!PSD_SUPPORTED_DEPTHS.has(depth)) throw new PsdImportError(`PSD/PSB writer: unsupported bit depth ${bitsPerChannel}`, 'PSD_EXPORT_DEPTH');
  const documentWidth = Math.trunc(Number(width));
  const documentHeight = Math.trunc(Number(height));
  safeArea(documentWidth, documentHeight, maxPixels);
  if (!Array.isArray(layers) || layers.length > maxLayers) {
    throw new PsdImportError(`PSD/PSB writer: слишком много слоёв: ${layers?.length ?? 0} > ${maxLayers}`, 'PSD_EXPORT_LAYER_LIMIT');
  }
  if (!layers.length) throw new PsdImportError('PSD/PSB writer: нужен хотя бы один слой', 'PSD_EXPORT_EMPTY');

  const normalized = layers.map((layer, index) => normalizeExportLayer(layer, index, maxPixels, version, depth));
  const records = expandExportLayerGroups(normalized, groups);
  if (records.length > 32767) {
    throw new PsdImportError(`PSD/PSB writer: слишком много layer records после добавления групп: ${records.length}`, 'PSD_EXPORT_LAYER_RECORD_LIMIT');
  }

  const layerInfo = buildLayerInfoBody(records, version, documentWidth, documentHeight);
  const layerAndMask = new Writer();
  if (depth === 8) {
    if (version === PSB_VERSION) layerAndMask.u64(layerInfo.length);
    else layerAndMask.u32(layerInfo.length);
    layerAndMask.append(layerInfo);
    layerAndMask.u32(0);
  } else {
    // Photoshop stores 16/32-bit layer records in document-level Lr16/Lr32
    // tagged blocks; the ordinary layer-info length is zero.
    if (version === PSB_VERSION) layerAndMask.u64(0);
    else layerAndMask.u32(0);
    layerAndMask.u32(0);
    appendHighDepthLayerInfoBlock(layerAndMask, layerInfo, version, depth);
  }

  const compositeData = encodeCompositeData({ composite, compositePixelBuffer }, documentWidth, documentHeight, version, depth);
  const imageResources = buildImageResources({iccProfile,iccUntagged,paths,width:documentWidth,height:documentHeight});
  const out = new Writer();
  out.ascii('8BPS').u16(version).push(new Uint8Array(6));
  out.u16(4).u32(documentHeight).u32(documentWidth).u16(depth).u16(PSD_COLOR_MODE_RGB);
  out.u32(0);
  out.u32(imageResources.length).append(imageResources);
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
