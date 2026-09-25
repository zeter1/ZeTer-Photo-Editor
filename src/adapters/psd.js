import { createPixelBuffer, createRgba8PixelBuffer, isPixelBuffer } from '../core/pixel-buffer.js';

const PSD_SIGNATURE = '8BPS';
const PSD_VERSION = 1;
const PSB_VERSION = 2;
const PSB_LONG_ADDITIONAL_KEYS = new Set(['LMsk','Lr16','Lr32','Layr','Mt16','Mt32','Mtrn','Alph','FMsk','lnk2','lnkD','lnkE','FEid','FXid','PxSD']);
const PSD_SMART_OBJECT_LAYER_KEYS = new Set(['PlLd','SoLd','SoLE']);
const PSD_TEXT_LAYER_KEYS = new Set(['TySh']);
const PSD_SHAPE_LAYER_KEYS = new Set(['SoCo','GdFl','PtFl','vscg','vstk']);
const PSD_ADJUSTMENT_LAYER_KEYS = new Set(['brit','CgEd','expA','hue2','hue ','levl','curv','nvrt','post','thrs']);
const PSD_LINKED_LAYER_KEYS = new Set(['lnk2','lnkD','lnkE']);
const MAX_PSD_SMART_OBJECT_BLOCK_BYTES = 8 * 1024 * 1024;
const MAX_PSD_TEXT_BLOCK_BYTES = 16 * 1024 * 1024;
const MAX_PSD_SHAPE_BLOCK_BYTES = 4 * 1024 * 1024;
const MAX_PSD_ADJUSTMENT_BLOCK_BYTES = 4 * 1024 * 1024;
const MAX_PSD_ENGINE_DATA_BYTES = 8 * 1024 * 1024;
const MAX_PSD_LINKED_LAYER_BLOCK_BYTES = 128 * 1024 * 1024;
const MAX_PSD_LINKED_LAYER_BLOCKS = 32;
const MAX_PSD_LINKED_ASSET_BYTES = 64 * 1024 * 1024;
const MAX_PSD_DESCRIPTOR_ITEMS = 4096;
const MAX_PSD_DESCRIPTOR_DEPTH = 16;
const MAX_PSD_DESCRIPTOR_STRING_CHARS = 1_000_000;
const PSD_COLOR_MODE_RGB = 3;
const PSD_COLOR_MODE_CMYK = 4;
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
  if (header.colorMode !== PSD_COLOR_MODE_RGB && header.colorMode !== PSD_COLOR_MODE_CMYK) {
    throw new PsdImportError('PSD/PSB import Stage 13a поддерживает RGB и CMYK. Lab/Indexed/Multichannel требуют отдельного adapter path.', 'PSD_COLOR_MODE');
  }
  if (!PSD_SUPPORTED_DEPTHS.has(header.bitsPerChannel)) {
    throw new PsdImportError(
      `PSD/PSB import поддерживает RGB/CMYK 8/16/32-bit/channel. Получено: ${header.bitsPerChannel}-bit.`,
      'PSD_BIT_DEPTH',
    );
  }
  const minimumChannels = header.colorMode === PSD_COLOR_MODE_CMYK ? 4 : 3;
  if (header.channels < minimumChannels || header.channels > 56) throw new PsdImportError(`Некорректное число каналов PSD/PSB: ${header.channels}`, 'PSD_CHANNELS');
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

function copyOpaquePsdBlock(bytes,start,end,maxBytes,label,warnings) {
  const length=end-start;
  if(length<0||length>maxBytes){
    warnings.push(`${label}: opaque block ${Math.max(0,length)} bytes не сохранён из-за safety limit ${maxBytes}`);
    return null;
  }
  return bytes.slice(start,end);
}

function readPsdFloat64(reader) {
  reader.ensure(8);
  const value=reader.view.getFloat64(reader.offset,false);
  reader.offset+=8;
  return value;
}

function readPsdUnicodeString(reader,label='descriptor string') {
  const count=reader.u32();
  if(count>MAX_PSD_DESCRIPTOR_STRING_CHARS)throw new PsdImportError(`${label}: слишком длинная Unicode string`,'PSD_DESCRIPTOR_LIMIT');
  const value=decodeUtf16Be(reader.take(count*2));
  return value.replace(/\0+$/g,'');
}

function readPsdDescriptorKey(reader,label='descriptor key') {
  const length=reader.u32();
  const size=length||4;
  if(size>4096)throw new PsdImportError(`${label}: слишком длинный key`,'PSD_DESCRIPTOR_LIMIT');
  return decodeLatin1(reader.take(size));
}

function readPsdClass(reader,depth) {
  return{name:readPsdUnicodeString(reader,'descriptor class name'),classId:readPsdDescriptorKey(reader,'descriptor class id')};
}

function readPsdDescriptorValue(reader,type,depth) {
  if(depth>MAX_PSD_DESCRIPTOR_DEPTH)throw new PsdImportError('Descriptor nesting depth превышен','PSD_DESCRIPTOR_DEPTH');
  if(type==='Objc'||type==='GlbO')return readPsdDescriptorBody(reader,depth+1);
  if(type==='VlLs'||type==='obj '){
    const count=reader.u32();
    if(count>MAX_PSD_DESCRIPTOR_ITEMS)throw new PsdImportError('Descriptor list слишком длинный','PSD_DESCRIPTOR_LIMIT');
    const values=[];
    for(let index=0;index<count;index+=1)values.push(readPsdDescriptorValue(reader,reader.ascii(4),depth+1));
    return values;
  }
  if(type==='doub')return readPsdFloat64(reader);
  if(type==='UntF')return{unit:reader.ascii(4),value:readPsdFloat64(reader)};
  if(type==='UnFl'){
    const unit=reader.ascii(4),count=reader.u32();
    if(count>MAX_PSD_DESCRIPTOR_ITEMS)throw new PsdImportError('Descriptor unit-float array слишком длинный','PSD_DESCRIPTOR_LIMIT');
    const values=[];for(let index=0;index<count;index+=1)values.push(readPsdFloat64(reader));
    return{unit,values};
  }
  if(type==='TEXT')return readPsdUnicodeString(reader,'descriptor text');
  if(type==='enum')return{typeId:readPsdDescriptorKey(reader),value:readPsdDescriptorKey(reader)};
  if(type==='long')return reader.i32();
  if(type==='comp'){
    const high=reader.i32(),low=reader.u32();
    const value=high*0x100000000+low;
    return Number.isSafeInteger(value)?value:{high,low};
  }
  if(type==='bool')return Boolean(reader.u8());
  if(type==='type'||type==='GlbC'||type==='Clss')return readPsdClass(reader,depth+1);
  if(type==='alis'||type==='tdta'||type==='Pth '){
    const length=reader.u32();
    if(length>reader.end-reader.offset)throw new PsdImportError('Descriptor raw data обрезаны','PSD_DESCRIPTOR_RAW');
    if(type==='tdta'&&length<=MAX_PSD_ENGINE_DATA_BYTES){
      return{byteLength:length,data:reader.take(length).slice()};
    }
    reader.skip(length);
    return{byteLength:length,data:null};
  }
  if(type==='ObAr'){
    const itemsCount=reader.u32();
    return{itemsCount,descriptor:readPsdDescriptorBody(reader,depth+1)};
  }
  if(type==='prop')return{name:readPsdUnicodeString(reader),classId:readPsdDescriptorKey(reader),key:readPsdDescriptorKey(reader)};
  if(type==='Enmr')return{name:readPsdUnicodeString(reader),classId:readPsdDescriptorKey(reader),typeId:readPsdDescriptorKey(reader),value:readPsdDescriptorKey(reader)};
  if(type==='rele')return{name:readPsdUnicodeString(reader),classId:readPsdDescriptorKey(reader),offset:reader.u32()};
  if(type==='Idnt'||type==='indx')return reader.i32();
  if(type==='name')return{name:readPsdUnicodeString(reader),classId:readPsdDescriptorKey(reader),value:readPsdUnicodeString(reader)};
  throw new PsdImportError(`Unsupported descriptor OSType ${JSON.stringify(type)}`,'PSD_DESCRIPTOR_TYPE');
}

function readPsdDescriptorBody(reader,depth=0) {
  if(depth>MAX_PSD_DESCRIPTOR_DEPTH)throw new PsdImportError('Descriptor nesting depth превышен','PSD_DESCRIPTOR_DEPTH');
  const name=readPsdUnicodeString(reader,'descriptor name');
  const classId=readPsdDescriptorKey(reader,'descriptor class id');
  const count=reader.u32();
  if(count>MAX_PSD_DESCRIPTOR_ITEMS)throw new PsdImportError('Descriptor содержит слишком много items','PSD_DESCRIPTOR_LIMIT');
  const items={};
  for(let index=0;index<count;index+=1){
    const key=readPsdDescriptorKey(reader,'descriptor item key');
    const type=reader.ascii(4);
    items[key]=readPsdDescriptorValue(reader,type,depth+1);
  }
  return{name,classId,items};
}

function readPsdDescriptorBlock(reader) {
  const version=reader.u32();
  if(version!==16)throw new PsdImportError(`DescriptorBlock version ${version} не поддерживается`,'PSD_DESCRIPTOR_VERSION');
  return{version,...readPsdDescriptorBody(reader,0)};
}

function readPsdDescriptorBlockLayout(reader) {
  const version=reader.u32();
  if(version!==16)throw new PsdImportError('DescriptorBlock version '+version+' не поддерживается','PSD_DESCRIPTOR_VERSION');
  const name=readPsdUnicodeString(reader,'descriptor name');
  const classId=readPsdDescriptorKey(reader,'descriptor class id');
  const count=reader.u32();
  if(count>MAX_PSD_DESCRIPTOR_ITEMS)throw new PsdImportError('Descriptor содержит слишком много items','PSD_DESCRIPTOR_LIMIT');
  const items={},layout=new Map();
  for(let index=0;index<count;index+=1){
    const key=readPsdDescriptorKey(reader,'descriptor item key');
    const type=reader.ascii(4);
    const valueStart=reader.offset;
    const value=readPsdDescriptorValue(reader,type,1);
    const valueEnd=reader.offset;
    items[key]=value;
    layout.set(key,{type,valueStart,valueEnd,value});
  }
  return{descriptor:{version,name,classId,items},layout};
}

function psdEngineSkipWhitespace(bytes,state) {
  while(state.index<bytes.length){
    const value=bytes[state.index];
    if(value===0x20||value===0x09||value===0x0a||value===0x0d||value===0)state.index+=1;
    else break;
  }
}

function psdEngineReadBareToken(bytes,state) {
  const start=state.index;
  while(state.index<bytes.length){
    const value=bytes[state.index];
    if(value===0x20||value===0x09||value===0x0a||value===0x0d||value===0||
       value===0x5b||value===0x5d||value===0x3c||value===0x3e)break;
    state.index+=1;
  }
  return decodeLatin1(bytes.subarray(start,state.index));
}

function psdEngineReadProperty(bytes,state) {
  if(bytes[state.index]!==0x2f)throw new PsdImportError('EngineData property: expected /','PSD_ENGINE_DATA');
  state.index+=1;
  const start=state.index;
  while(state.index<bytes.length){
    const value=bytes[state.index];
    if(value===0x20||value===0x09||value===0x0a||value===0x0d||value===0||
       value===0x5b||value===0x5d||value===0x3c||value===0x3e||value===0x2f)break;
    state.index+=1;
  }
  if(state.index===start)throw new PsdImportError('EngineData property: empty name','PSD_ENGINE_DATA');
  return decodeLatin1(bytes.subarray(start,state.index));
}

function psdEngineReadString(bytes,state) {
  if(bytes[state.index]!==0x28)throw new PsdImportError('EngineData string: expected (','PSD_ENGINE_DATA');
  state.index+=1;
  const raw=[];
  let escaped=false,closed=false;
  while(state.index<bytes.length){
    const value=bytes[state.index++];
    if(escaped){raw.push(value);escaped=false;continue;}
    if(value===0x5c){escaped=true;continue;}
    if(value===0x29){closed=true;break;}
    raw.push(value);
  }
  if(!closed)throw new PsdImportError('EngineData string не закрыта','PSD_ENGINE_DATA');
  const data=Uint8Array.from(raw);
  if(data.length>=2&&data[0]===0xfe&&data[1]===0xff)return decodeUtf16Be(data.subarray(2)).replace(/\0+$/g,'');
  return decodeLatin1(data);
}

function psdEngineReadValue(bytes,state,depth=0) {
  if(depth>MAX_PSD_DESCRIPTOR_DEPTH)throw new PsdImportError('EngineData nesting depth превышен','PSD_ENGINE_DATA_DEPTH');
  psdEngineSkipWhitespace(bytes,state);
  if(state.index>=bytes.length)return null;

  if(bytes[state.index]===0x3c&&bytes[state.index+1]===0x3c){
    state.index+=2;
    const out={};
    let count=0;
    while(state.index<bytes.length){
      psdEngineSkipWhitespace(bytes,state);
      if(bytes[state.index]===0x3e&&bytes[state.index+1]===0x3e){state.index+=2;return out;}
      const key=psdEngineReadProperty(bytes,state);
      out[key]=psdEngineReadValue(bytes,state,depth+1);
      count+=1;
      if(count>MAX_PSD_DESCRIPTOR_ITEMS)throw new PsdImportError('EngineData dict слишком большой','PSD_ENGINE_DATA_LIMIT');
    }
    throw new PsdImportError('EngineData dict не закрыт','PSD_ENGINE_DATA');
  }

  if(bytes[state.index]===0x5b){
    state.index+=1;
    const out=[];
    while(state.index<bytes.length){
      psdEngineSkipWhitespace(bytes,state);
      if(bytes[state.index]===0x5d){state.index+=1;return out;}
      out.push(psdEngineReadValue(bytes,state,depth+1));
      if(out.length>MAX_PSD_DESCRIPTOR_ITEMS)throw new PsdImportError('EngineData array слишком большой','PSD_ENGINE_DATA_LIMIT');
    }
    throw new PsdImportError('EngineData array не закрыт','PSD_ENGINE_DATA');
  }

  if(bytes[state.index]===0x28)return psdEngineReadString(bytes,state);

  const token=psdEngineReadBareToken(bytes,state);
  if(!token)throw new PsdImportError('EngineData содержит пустой token','PSD_ENGINE_DATA');
  if(token==='true')return true;
  if(token==='false')return false;
  if(/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(token))return Number(token);
  return token;
}

function parsePsdEngineData(data,warnings,label) {
  if(!(data instanceof Uint8Array)||!data.length)return null;
  try{
    const state={index:0};
    return psdEngineReadValue(data,state,0);
  }catch(error){
    warnings.push(label+': EngineData не разобраны ('+(error?.message||error)+'); исходные bytes сохранены');
    return null;
  }
}

function normalizePhotoshopFontFamily(name) {
  const value=String(name||'').replace(/\0+$/g,'').trim();
  if(!value)return'Arial, sans-serif';
  if(/^Arial(?:MT)?$/i.test(value))return'Arial, sans-serif';
  if(/^HelveticaNeue/i.test(value))return'"Helvetica Neue", Helvetica, Arial, sans-serif';
  if(/^TimesNewRomanPS/i.test(value))return'"Times New Roman", Times, serif';
  if(/^CourierNewPS/i.test(value))return'"Courier New", Courier, monospace';
  return JSON.stringify(value)+', Arial, sans-serif';
}

function engineDataTypographySummary(engine) {
  if(!engine||typeof engine!=='object')return null;
  const engineDict=engine.EngineDict&&typeof engine.EngineDict==='object'?engine.EngineDict:{};
  const resource=engine.ResourceDict&&typeof engine.ResourceDict==='object'?engine.ResourceDict:{};
  const styleRun=engineDict.StyleRun&&typeof engineDict.StyleRun==='object'?engineDict.StyleRun:{};
  const styleDefault=styleRun.DefaultRunData?.StyleSheet?.StyleSheetData||{};
  const firstStyle=Array.isArray(styleRun.RunArray)?styleRun.RunArray[0]?.StyleSheet?.StyleSheetData||{}:{};
  const style={...styleDefault,...firstStyle};
  const paragraphRun=engineDict.ParagraphRun&&typeof engineDict.ParagraphRun==='object'?engineDict.ParagraphRun:{};
  const paragraphDefault=paragraphRun.DefaultRunData?.ParagraphSheet?.Properties||{};
  const firstParagraph=Array.isArray(paragraphRun.RunArray)?paragraphRun.RunArray[0]?.ParagraphSheet?.Properties||{}:{};
  const paragraph={...paragraphDefault,...firstParagraph};
  const fontSet=Array.isArray(resource.FontSet)?resource.FontSet:[];
  const fontIndex=Number(style.Font);
  const font=Number.isInteger(fontIndex)&&fontSet[fontIndex]?fontSet[fontIndex]:fontSet[0]||{};
  const fontName=String(font.Name||font.FontFamily||'').replace(/\0+$/g,'')||null;
  const fontSize=Number(style.FontSize)||12;
  const tracking=Number(style.Tracking)||0;
  const fill=style.FillColor?.Values;
  let color=null;
  if(Array.isArray(fill)&&fill.length>=4){
    const rgb=fill.slice(-3).map(value=>Math.max(0,Math.min(255,Math.round(Number(value||0)*255))));
    color='#'+rgb.map(value=>value.toString(16).padStart(2,'0')).join('');
  }
  const justification=Number(paragraph.Justification);
  const align=justification===1?'right':justification===2?'center':'left';
  const autoLeading=Number(paragraph.AutoLeading);
  const explicitLeading=Number(style.Leading);
  const lineHeight=style.AutoLeading===false&&Number.isFinite(explicitLeading)&&explicitLeading>0&&fontSize>0
    ? explicitLeading/fontSize
    : Number.isFinite(autoLeading)&&autoLeading>0?autoLeading:1.2;
  const styleRunLengths=Array.isArray(styleRun.RunLengthArray)?styleRun.RunLengthArray.map(value=>Math.max(0,Math.trunc(Number(value)||0))):[];
  const paragraphRunLengths=Array.isArray(paragraphRun.RunLengthArray)?paragraphRun.RunLengthArray.map(value=>Math.max(0,Math.trunc(Number(value)||0))):[];
  const engineText=typeof engineDict.Editor?.Text==='string'?engineDict.Editor.Text.replace(/\r$/,'').replace(/\r/g,'\n'):null;
  return{
    engineText,fontName,fontFamily:normalizePhotoshopFontFamily(fontName),fontSize,
    fontWeight:style.FauxBold===true?'700':'400',
    fontStyle:style.FauxItalic===true?'italic':'normal',
    color:color||'#000000',align,lineHeight,tracking,letterSpacing:fontSize*tracking/1000,
    underline:style.Underline===true,strikeThrough:style.Strikethrough===true,
    justification:Number.isFinite(justification)?justification:0,
    styleRunLengths,paragraphRunLengths,
    editableSingleStyle:styleRunLengths.length===1&&paragraphRunLengths.length===1,
    fontCount:fontSet.length,
  };
}

function findEngineEditorTextRange(data) {
  const bytes=asBytes(data);
  const matchAscii=(needle,start=0)=>{
    outer:for(let index=start;index<=bytes.length-needle.length;index+=1){
      for(let cursor=0;cursor<needle.length;cursor+=1)if(bytes[index+cursor]!==needle.charCodeAt(cursor))continue outer;
      return index;
    }
    return-1;
  };
  const editor=matchAscii('/Editor');
  if(editor<0)return null;
  const textKey=matchAscii('/Text',editor+7);
  if(textKey<0)return null;
  let open=textKey+5;
  while(open<bytes.length&&(bytes[open]===0x20||bytes[open]===0x09||bytes[open]===0x0a||bytes[open]===0x0d||bytes[open]===0))open+=1;
  if(bytes[open]!==0x28||bytes[open+1]!==0xfe||bytes[open+2]!==0xff)return null;
  let index=open+1,escaped=false;
  while(index<bytes.length){
    const value=bytes[index++];
    if(escaped){escaped=false;continue;}
    if(value===0x5c){escaped=true;continue;}
    if(value===0x29)return{start:open,end:index};
  }
  return null;
}

function findEngineRunLengthRanges(data) {
  const bytes=asBytes(data),ranges=[];
  const needle='/RunLengthArray';
  outer:for(let start=0;start<=bytes.length-needle.length;start+=1){
    for(let cursor=0;cursor<needle.length;cursor+=1)if(bytes[start+cursor]!==needle.charCodeAt(cursor))continue outer;
    let open=start+needle.length;
    while(open<bytes.length&&(bytes[open]===0x20||bytes[open]===0x09||bytes[open]===0x0a||bytes[open]===0x0d||bytes[open]===0))open+=1;
    if(bytes[open]!==0x5b)continue;
    let close=open+1;
    while(close<bytes.length&&bytes[close]!==0x5d)close+=1;
    if(close>=bytes.length)continue;
    const content=decodeLatin1(bytes.subarray(open+1,close)).trim();
    const values=content?content.split(/\s+/).map(Number).filter(Number.isFinite):[];
    ranges.push({start:open+1,end:close,values});
    start=close;
  }
  return ranges;
}

function encodeEngineTextString(value) {
  const normalized=String(value??'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n/g,'\r').replace(/\r*$/,'')+'\r';
  const utf=encodeUtf16Be(normalized);
  const out=[0x28,0xfe,0xff];
  for(const byte of utf){
    if(byte===0x5c||byte===0x28||byte===0x29)out.push(0x5c);
    out.push(byte);
  }
  out.push(0x29);
  return{bytes:Uint8Array.from(out),runLength:normalized.length};
}

function encodePsdRawDataValue(data) {
  const bytes=asBytes(data);
  const out=new Uint8Array(4+bytes.length);
  new DataView(out.buffer).setUint32(0,bytes.length,false);
  out.set(bytes,4);
  return out;
}

function readPsdDescriptorBodyLayout(reader,depth=0) {
  if(depth>MAX_PSD_DESCRIPTOR_DEPTH)throw new PsdImportError('Descriptor layout nesting depth превышен','PSD_DESCRIPTOR_DEPTH');
  const name=readPsdUnicodeString(reader,'descriptor name');
  const classId=readPsdDescriptorKey(reader,'descriptor class id');
  const count=reader.u32();
  if(count>MAX_PSD_DESCRIPTOR_ITEMS)throw new PsdImportError('Descriptor layout содержит слишком много items','PSD_DESCRIPTOR_LIMIT');
  const items={},layout=new Map();
  for(let index=0;index<count;index+=1){
    const key=readPsdDescriptorKey(reader,'descriptor item key');
    const type=reader.ascii(4);
    const valueStart=reader.offset;
    let value;
    if(type==='Objc'||type==='GlbO')value=readPsdDescriptorBodyLayout(reader,depth+1);
    else value=readPsdDescriptorValue(reader,type,depth+1);
    const valueEnd=reader.offset;
    items[key]=value?.descriptor??value;
    layout.set(key,{type,valueStart,valueEnd,value});
  }
  return{descriptor:{name,classId,items},layout};
}

function readPsdDescriptorBlockDeepLayout(reader) {
  const version=reader.u32();
  if(version!==16)throw new PsdImportError('DescriptorBlock version '+version+' не поддерживается','PSD_DESCRIPTOR_VERSION');
  return{version,...readPsdDescriptorBodyLayout(reader,0)};
}

function descriptorNestedLayout(item,bytes,label) {
  if(!item||item.type!=='Objc')throw new PsdImportError(label+': ожидался Objc descriptor','PSD_SHAPE_DESCRIPTOR');
  return readPsdDescriptorBodyLayout(new Reader(bytes,item.valueStart,item.valueEnd),1);
}

function patchDescriptorNumber(bytes,item,value,label) {
  if(!item)throw new PsdImportError(label+': numeric descriptor item не найден','PSD_SHAPE_DESCRIPTOR');
  const number=Number(value);
  if(!Number.isFinite(number))throw new PsdImportError(label+': numeric value некорректно','PSD_SHAPE_DESCRIPTOR');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(item.type==='doub'){ view.setFloat64(item.valueStart,number,false); return; }
  if(item.type==='UntF'){ view.setFloat64(item.valueStart+4,number,false); return; }
  if(item.type==='long'){ view.setInt32(item.valueStart,Math.round(number),false); return; }
  throw new PsdImportError(label+': неподдерживаемый numeric OSType '+item.type,'PSD_SHAPE_DESCRIPTOR');
}

function patchDescriptorBoolean(bytes,item,value,label) {
  if(!item||item.type!=='bool')throw new PsdImportError(label+': bool descriptor item не найден','PSD_SHAPE_DESCRIPTOR');
  bytes[item.valueStart]=value?1:0;
}

function parseShapeHexRgb(value,label) {
  const match=/^#([0-9a-f]{6})$/i.exec(String(value||''));
  if(!match)throw new PsdImportError(label+': ожидается RGB #RRGGBB','PSD_SHAPE_COLOR');
  return[
    parseInt(match[1].slice(0,2),16),
    parseInt(match[1].slice(2,4),16),
    parseInt(match[1].slice(4,6),16),
  ];
}

function patchRgbDescriptorObject(bytes,item,rgb,label) {
  const color=descriptorNestedLayout(item,bytes,label);
  patchDescriptorNumber(bytes,color.layout.get('Rd  '),rgb[0],label+'.R');
  patchDescriptorNumber(bytes,color.layout.get('Grn '),rgb[1],label+'.G');
  patchDescriptorNumber(bytes,color.layout.get('Bl  '),rgb[2],label+'.B');
}

function rewriteShapeSolidContentBlock(key,data,fill) {
  const bytes=asBytes(data).slice();
  const reader=new Reader(bytes);
  let subtype=key;
  if(key==='vscg')subtype=reader.ascii(4);
  if(subtype!=='SoCo')throw new PsdImportError('Shape content '+key+' subtype '+subtype+' не является SoCo','PSD_SHAPE_CONTENT');
  const layout=readPsdDescriptorBlockDeepLayout(reader);
  patchRgbDescriptorObject(bytes,layout.layout.get('Clr '),parseShapeHexRgb(fill,'Shape fill'),'Shape fill');
  return bytes;
}

function rewriteShapeStrokeBlock(data,{stroke,strokeEnabled,fillEnabled,strokeWidth}) {
  const bytes=asBytes(data).slice();
  const layout=readPsdDescriptorBlockDeepLayout(new Reader(bytes));
  patchDescriptorBoolean(bytes,layout.layout.get('strokeEnabled'),Boolean(strokeEnabled),'strokeEnabled');
  patchDescriptorBoolean(bytes,layout.layout.get('fillEnabled'),Boolean(fillEnabled),'fillEnabled');
  patchDescriptorNumber(bytes,layout.layout.get('strokeStyleLineWidth'),Math.max(0,Number(strokeWidth)||0),'strokeStyleLineWidth');
  if(strokeEnabled){
    const content=descriptorNestedLayout(layout.layout.get('strokeStyleContent'),bytes,'strokeStyleContent');
    patchRgbDescriptorObject(bytes,content.layout.get('Clr '),parseShapeHexRgb(stroke,'Shape stroke'),'Shape stroke');
  }
  return bytes;
}

export function rewritePsdShapeStyle(blocks,{fill,stroke,strokeWidth,fillEnabled=true,strokeEnabled=true}={}) {
  if(!Array.isArray(blocks)||!blocks.length)throw new PsdImportError('Shape style rewrite: blocks отсутствуют','PSD_SHAPE_DESCRIPTOR');
  const hasContent=blocks.some(block=>block?.key==='SoCo'||block?.key==='vscg');
  const hasStroke=blocks.some(block=>block?.key==='vstk');
  if(fillEnabled&&!hasContent)throw new PsdImportError('Shape style rewrite: solid content block отсутствует','PSD_SHAPE_CONTENT');
  if((!fillEnabled||strokeEnabled||Number(strokeWidth)>0)&&!hasStroke)throw new PsdImportError('Shape style rewrite: vstk block нужен для enable/disable или stroke edit','PSD_SHAPE_STROKE');
  let contentRewritten=0,strokeRewritten=0;
  const output=blocks.map(block=>{
    if(!block?.data)return block;
    if((block.key==='SoCo'||block.key==='vscg')&&fillEnabled){
      const subtype=block.key==='vscg'?decodeLatin1(asBytes(block.data).subarray(0,4)):block.key;
      if(subtype==='SoCo'){
        contentRewritten+=1;
        return{...block,data:rewriteShapeSolidContentBlock(block.key,block.data,fill)};
      }
    }
    if(block.key==='vstk'){
      strokeRewritten+=1;
      return{...block,data:rewriteShapeStrokeBlock(block.data,{stroke,strokeEnabled,fillEnabled,strokeWidth})};
    }
    return block;
  });
  return{blocks:output,contentRewritten,strokeRewritten};
}

function psdRgbDescriptorHex(descriptor) {
  const color=descriptor?.items?.['Clr ']?.items;
  if(!color||typeof color!=='object')return null;
  const channel=key=>Math.max(0,Math.min(255,Math.round(Number(color[key])||0)));
  const rgb=[channel('Rd  '),channel('Grn '),channel('Bl  ')];
  return'#'+rgb.map(value=>value.toString(16).padStart(2,'0')).join('');
}

function psdGradientSummary(descriptor) {
  const items=descriptor?.items||{};
  const gradient=items['Grad']?.items||{};
  const colors=Array.isArray(gradient.Clrs)?gradient.Clrs:[];
  const transparency=Array.isArray(gradient.Trns)?gradient.Trns:[];
  const colorStops=colors.slice(0,64).map(stop=>({
    location:Number(stop?.items?.Lctn)||0,
    midpoint:Number(stop?.items?.Mdpn)||50,
    color:psdRgbDescriptorHex({items:{'Clr ':stop?.items?.['Clr ']}}),
  })).filter(stop=>Boolean(stop.color));
  const transparencyStops=transparency.slice(0,64).map(stop=>{
    const opacity=Number(stop?.items?.Opct?.value);
    return{
      location:Number(stop?.items?.Lctn)||0,
      midpoint:Number(stop?.items?.Mdpn)||50,
      opacity:Number.isFinite(opacity)?Math.max(0,Math.min(100,opacity)):100,
    };
  });
  return{
    angle:Number(items.Angl?.value),
    type:items.Type?.value||null,
    name:String(gradient['Nm  ']||'').replace(/\0+$/g,'')||null,
    form:gradient.GrdF?.value||null,
    smoothness:Number(gradient.Intr),
    scale:Number(items['Scl ']?.value),
    reverse:items.Rvrs===true,
    dither:items.Dthr===true,
    align:items.Algn!==false,
    colorStops,
    transparencyStops,
  };
}

function psdPatternSummary(descriptor) {
  const items=descriptor?.items||{};
  const pattern=items.Ptrn?.items||{};
  return{
    name:String(pattern['Nm  ']||'').replace(/\0+$/g,'')||null,
    id:String(pattern.Idnt||'').replace(/\0+$/g,'')||null,
    scale:Number(items['Scl ']?.value??items['Scl ']),
    linked:items.Lnkd!==false,
  };
}

function parseShapeContentBlock(key,data,warnings,label) {
  try{
    const reader=new Reader(data);
    let subtype=key;
    if(key==='vscg')subtype=reader.ascii(4);
    const descriptor=readPsdDescriptorBlock(reader);
    if(subtype==='SoCo')return{sourceKey:key,subtype,fillType:'solid',fill:psdRgbDescriptorHex(descriptor),gradient:null,pattern:null};
    if(subtype==='GdFl')return{sourceKey:key,subtype,fillType:'gradient',fill:null,gradient:psdGradientSummary(descriptor),pattern:null};
    if(subtype==='PtFl')return{sourceKey:key,subtype,fillType:'pattern',fill:null,gradient:null,pattern:psdPatternSummary(descriptor)};
    return{sourceKey:key,subtype,fillType:null,fill:null,gradient:null,pattern:null};
  }catch(error){
    warnings.push(label+': '+key+' shape content не разобран ('+(error?.message||error)+'); opaque bytes сохранены');
    return{sourceKey:key,subtype:null,fillType:null,fill:null,gradient:null,pattern:null};
  }
}

function parseShapeStrokeBlock(data,warnings,label) {
  try{
    const descriptor=readPsdDescriptorBlock(new Reader(data));
    const items=descriptor.items||{};
    const width=Number(items.strokeStyleLineWidth?.value);
    const color=psdRgbDescriptorHex(items.strokeStyleContent);
    return{
      strokeEnabled:items.strokeEnabled===true,
      fillEnabled:items.fillEnabled!==false,
      strokeWidth:Number.isFinite(width)&&width>=0?width:0,
      stroke:color,
      opacity:Number(items.strokeStyleOpacity?.value),
      lineCap:items.strokeStyleLineCapType?.value||null,
      lineJoin:items.strokeStyleLineJoinType?.value||null,
      lineAlignment:items.strokeStyleLineAlignment?.value||null,
    };
  }catch(error){
    warnings.push(label+': vstk stroke style не разобран ('+(error?.message||error)+'); opaque bytes сохранены');
    return null;
  }
}

function appendShapeLayerBlock(record,signature,key,data,warnings) {
  if(!data)return;
  if(!record.psdShape){
    record.psdShape={
      fillType:null,fill:null,fillEnabled:true,
      stroke:null,strokeEnabled:false,strokeWidth:0,
      sourceContentKey:null,contentSubtype:null,gradient:null,pattern:null,strokeStyle:null,blocks:[],
    };
  }
  record.psdShape.blocks.push({signature,key,data});
  if(key==='SoCo'||key==='GdFl'||key==='PtFl'||key==='vscg'){
    const parsed=parseShapeContentBlock(key,data,warnings,'Слой «'+record.name+'»');
    if(parsed.fillType){
      record.psdShape.fillType=parsed.fillType;
      record.psdShape.fill=parsed.fill;
      record.psdShape.gradient=parsed.gradient;
      record.psdShape.pattern=parsed.pattern;
      record.psdShape.sourceContentKey=key;
      record.psdShape.contentSubtype=parsed.subtype;
    }
  }else if(key==='vstk'){
    const stroke=parseShapeStrokeBlock(data,warnings,'Слой «'+record.name+'»');
    if(stroke){
      record.psdShape.strokeStyle=stroke;
      record.psdShape.strokeEnabled=stroke.strokeEnabled;
      record.psdShape.fillEnabled=stroke.fillEnabled;
      record.psdShape.strokeWidth=stroke.strokeWidth;
      record.psdShape.stroke=stroke.stroke;
    }
  }
}

function parseTypeToolObject(data,warnings,label) {
  if(!(data instanceof Uint8Array)||data.length<60)return null;
  try{
    const reader=new Reader(data);
    const version=reader.u16();
    const transform=Array.from({length:6},()=>readPsdFloat64(reader));
    const textVersion=reader.u16();
    const textLayout=readPsdDescriptorBlockLayout(reader);
    const textValue=textLayout.descriptor.items['Txt '];
    const engineRaw=textLayout.descriptor.items.EngineData?.data||null;
    const engine=parsePsdEngineData(engineRaw,warnings,label);
    const typography=engineDataTypographySummary(engine);
    const warpVersion=reader.u16();
    const warp=readPsdDescriptorBlock(reader);
    const left=reader.i32(),top=reader.i32(),right=reader.i32(),bottom=reader.i32();
    return{
      version,textVersion,warpVersion,
      transform,bounds:{left,top,right,bottom},
      text:typeof textValue==='string'?textValue.replace(/\0+$/g,'').replace(/\r/g,'\n'):'',
      typography,
      orientation:textLayout.descriptor.items.Ornt?.value||null,
      antiAlias:textLayout.descriptor.items.AntA?.value||null,
      descriptorClass:textLayout.descriptor.classId||null,
      descriptorKeys:Object.keys(textLayout.descriptor.items).slice(0,128),
      warpClass:warp.classId||null,
    };
  }catch(error){
    warnings.push(label+': TySh descriptor не разобран ('+(error?.message||error)+'); raster preview сохранён');
    return null;
  }
}

function encodePsdUnicodeValue(value) {
  const text=String(value??'').replace(/\n/g,'\r');
  const utf=encodeUtf16Be(text);
  const out=new Uint8Array(4+utf.length);
  new DataView(out.buffer).setUint32(0,text.length,false);
  out.set(utf,4);
  return out;
}

function replaceByteRanges(bytes,replacements) {
  const sorted=[...replacements].sort((a,b)=>a.start-b.start);
  let cursor=0,total=bytes.length;
  for(const item of sorted){
    if(item.start<cursor||item.end<item.start||item.end>bytes.length)throw new PsdImportError('Перекрывающиеся PSD rewrite ranges','PSD_TEXT_REWRITE');
    total+=item.data.length-(item.end-item.start);
    cursor=item.end;
  }
  const out=new Uint8Array(total);
  cursor=0;
  let dest=0;
  for(const item of sorted){
    out.set(bytes.subarray(cursor,item.start),dest);
    dest+=item.start-cursor;
    out.set(item.data,dest);
    dest+=item.data.length;
    cursor=item.end;
  }
  out.set(bytes.subarray(cursor),dest);
  return out;
}

export function rewriteTypeToolText(data,value,{deltaX=0,deltaY=0}={}) {
  const bytes=asBytes(data);
  const reader=new Reader(bytes);
  const version=reader.u16();
  if(version!==1)throw new PsdImportError('TySh version '+version+' не поддерживается для rewrite','PSD_TEXT_VERSION');
  const transform=Array.from({length:6},()=>readPsdFloat64(reader));
  const textVersion=reader.u16();
  if(textVersion!==50)throw new PsdImportError('TySh text version '+textVersion+' не поддерживается для rewrite','PSD_TEXT_VERSION');
  const layout=readPsdDescriptorBlockLayout(reader);
  const txt=layout.layout.get('Txt ');
  if(!txt||txt.type!=='TEXT')throw new PsdImportError('TySh не содержит writable Txt TEXT item','PSD_TEXT_REWRITE');

  const normalized=String(value??'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const original=typeof txt.value==='string'?txt.value.replace(/\0+$/g,'').replace(/\r/g,'\n'):'';
  const replacements=[{start:txt.valueStart,end:txt.valueEnd,data:encodePsdUnicodeValue(normalized)}];
  let engineUpdated=false,runLength=null;

  if(normalized!==original){
    const engineItem=layout.layout.get('EngineData');
    const engineRaw=engineItem?.value?.data;
    if(engineItem?.type!=='tdta'||!(engineRaw instanceof Uint8Array))throw new PsdImportError('TySh EngineData недоступны для text writeback','PSD_TEXT_ENGINE_DATA');
    const textRange=findEngineEditorTextRange(engineRaw);
    const runRanges=findEngineRunLengthRanges(engineRaw);
    if(!textRange||runRanges.length<2||runRanges.some(range=>range.values.length!==1)){
      throw new PsdImportError('TySh EngineData имеют multi-run/unknown layout; text writeback небезопасен','PSD_TEXT_ENGINE_DATA');
    }
    const encoded=encodeEngineTextString(normalized);
    runLength=encoded.runLength;
    const asciiBytes=value=>Uint8Array.from(String(value).split('').map(ch=>ch.charCodeAt(0)));
    const engineReplacements=[
      {start:textRange.start,end:textRange.end,data:encoded.bytes},
      ...runRanges.map(range=>({start:range.start,end:range.end,data:asciiBytes(' '+runLength+' ')})),
    ];
    const nextEngine=replaceByteRanges(engineRaw,engineReplacements);
    replacements.push({start:engineItem.valueStart,end:engineItem.valueEnd,data:encodePsdRawDataValue(nextEngine)});
    engineUpdated=true;
  }

  const out=replaceByteRanges(bytes,replacements);
  const view=new DataView(out.buffer,out.byteOffset,out.byteLength);
  view.setFloat64(34,transform[4]+Number(deltaX||0),false);
  view.setFloat64(42,transform[5]+Number(deltaY||0),false);
  return{data:out,textUpdated:true,engineUpdated,runLength,deltaX:Number(deltaX||0),deltaY:Number(deltaY||0)};
}
function parseSmartObjectDescriptor(data,warnings,label) {
  if(!(data instanceof Uint8Array)||data.length<12)return null;
  try{
    const reader=new Reader(data);
    if(reader.ascii(4)!=='soLD')return null;
    const smartVersion=reader.u32();
    const descriptor=readPsdDescriptorBlock(reader);
    const idValue=descriptor.items.Idnt;
    const resolution=descriptor.items.Rslt;
    return{
      smartVersion,
      uniqueId:typeof idValue==='string'?idValue.replace(/\0+$/g,''):null,
      resolution:typeof resolution==='number'?resolution:Number(resolution?.value)||null,
      descriptorClass:descriptor.classId||null,
      descriptorKeys:Object.keys(descriptor.items).slice(0,128),
    };
  }catch(error){
    warnings.push(`${label}: SoLd/SoLE descriptor не разобран (${error?.message||error}); opaque bytes сохранены`);
    return null;
  }
}

function parsePlacedLayerHeader(data,warnings,label) {
  if(!(data instanceof Uint8Array)||data.length<9)return null;
  const reader=new Reader(data);
  const signature=reader.ascii(4);
  if(signature!=='plcL')return null;
  const version=reader.u32();
  const idLength=reader.u8();
  if(idLength>reader.end-reader.offset){
    warnings.push(`${label}: PlLd unique id обрезан`);
    return{version,uniqueId:null,transform:null};
  }
  const uniqueId=decodeLatin1(reader.take(idLength))||null;
  let page=null,totalPages=null,antiAlias=null,layerType=null,transform=null;
  try{
    if(reader.end-reader.offset>=16+64){
      page=reader.u32();totalPages=reader.u32();antiAlias=reader.u32();layerType=reader.u32();
      transform=Array.from({length:8},()=>readPsdFloat64(reader));
    }
  }catch(error){warnings.push(`${label}: PlLd transform обрезан (${error?.message||error})`);}
  return{version,uniqueId,page,totalPages,antiAlias,layerType,transform};
}

function appendSmartObjectLayerBlock(record,signature,key,data,warnings) {
  if(!data)return;
  if(!record.psdSmartObject){
    record.psdSmartObject={kind:'placed',uniqueId:null,placedVersion:null,placedTransform:null,descriptor:null,asset:null,blocks:[]};
  }
  record.psdSmartObject.blocks.push({signature,key,data});
  if(key==='SoLE')record.psdSmartObject.kind='linked';
  else if(key==='SoLd'&&record.psdSmartObject.kind!=='linked')record.psdSmartObject.kind='embedded';
  if(key==='PlLd'){
    const header=parsePlacedLayerHeader(data,warnings,`Слой «${record.name}»`);
    if(header){
      record.psdSmartObject.placedVersion=header.version;
      record.psdSmartObject.uniqueId=header.uniqueId;
      record.psdSmartObject.placedTransform=header.transform;
      if(header.version!==3)warnings.push(`Слой «${record.name}»: PlLd version ${header.version} сохранён opaque best-effort`);
    }
  }else if(key==='SoLd'||key==='SoLE'){
    const descriptor=parseSmartObjectDescriptor(data,warnings,`Слой «${record.name}»`);
    if(descriptor){
      record.psdSmartObject.descriptor=descriptor;
      if(!record.psdSmartObject.uniqueId&&descriptor.uniqueId)record.psdSmartObject.uniqueId=descriptor.uniqueId;
    }
  }
}

function readPsdFloat32(reader) {
  reader.ensure(4);
  const value=reader.view.getFloat32(reader.offset,false);
  reader.offset+=4;
  return value;
}

function signed16(value) {
  const number=Number(value)&0xffff;
  return number>0x7fff?number-0x10000:number;
}

function levelRecordFromReader(reader) {
  return{
    inputBlack:reader.u16(),
    inputWhite:reader.u16(),
    outputBlack:reader.u16(),
    outputWhite:reader.u16(),
    gamma:reader.u16()/100,
  };
}

function parseBrightnessContrastAdjustment(blocks,warnings,label) {
  const modern=blocks.find(block=>block.key==='CgEd');
  if(modern){
    try{
      const descriptor=readPsdDescriptorBlock(new Reader(modern.data));
      const items=descriptor.items||{};
      return{
        kind:'brightness-contrast',
        brightness:Number(items.Brgh)||0,
        contrast:Number(items.Cntr)||0,
        legacy:Boolean(items.useLegacy),
      };
    }catch(error){
      warnings.push(label+': CgEd Brightness/Contrast не разобран ('+(error?.message||error)+')');
    }
  }
  const legacy=blocks.find(block=>block.key==='brit');
  if(legacy?.data?.length>=8){
    const reader=new Reader(legacy.data);
    return{
      kind:'brightness-contrast',
      brightness:signed16(reader.u16()),
      contrast:signed16(reader.u16()),
      legacy:true,
    };
  }
  return null;
}

function parseExposureAdjustment(block) {
  if(!block?.data||block.data.length<14)return null;
  const reader=new Reader(block.data);
  const version=reader.u16();
  return{kind:'exposure',version,exposure:readPsdFloat32(reader),offset:readPsdFloat32(reader),gamma:readPsdFloat32(reader)};
}

function parseHueSaturationAdjustment(block) {
  if(!block?.data||block.data.length<16)return null;
  const reader=new Reader(block.data);
  const version=reader.u16(),enable=reader.u8();
  reader.u8();
  const colorization=[reader.i16(),reader.i16(),reader.i16()];
  const master=[reader.i16(),reader.i16(),reader.i16()];
  const items=[];
  while(reader.offset+14<=reader.end&&items.length<6){
    const range=[reader.i16(),reader.i16(),reader.i16(),reader.i16()];
    const settings=[reader.i16(),reader.i16(),reader.i16()];
    items.push({range,settings});
  }
  const colorize=Boolean(enable);
  const active=colorize?colorization:master;
  return{
    kind:'hue-saturation',version,enable:colorize,
    hue:active[0],saturation:active[1],lightness:active[2],
    colorize,
    colorization,items,
  };
}

function parseSimpleAdjustment(block,kind,field=null) {
  if(!block?.data)return null;
  if(field){
    if(block.data.length<2)return null;
    const reader=new Reader(block.data);
    return{kind,[field]:reader.u16()};
  }
  return{kind};
}

function parseLevelsAdjustment(block) {
  if(!block?.data||block.data.length<12)return null;
  const reader=new Reader(block.data);
  const version=reader.u16();
  if(version!==2)return{kind:'levels',version,master:null,channels:[]};
  const records=[];
  for(let index=0;index<29&&reader.offset+10<=reader.end;index+=1)records.push(levelRecordFromReader(reader));
  return{
    kind:'levels',version,
    master:records[0]||null,
    channels:records.slice(1,4).map((record,index)=>({id:index+1,...record})),
  };
}

function curvePointPair(reader) {
  const output=reader.u16(),input=reader.u16();
  return{input,output};
}
function parseCurvesAdjustment(block,warnings,label) {
  if(!block?.data||block.data.length<7)return null;
  try{
    const reader=new Reader(block.data);
    const isMap=Boolean(reader.u8()),version=reader.u16(),countMap=reader.u32();
    const ids=[];
    for(let bit=0;bit<32;bit+=1)if((countMap>>>bit)&1)ids.push(bit);
    const channels=[];
    if(isMap){
      for(let index=0;index<ids.length&&reader.offset+256<=reader.end;index+=1){
        const map=reader.take(256);
        const points=[];for(let input=0;input<256;input+=1)points.push({input,output:map[input]});
        channels.push({id:ids[index],points});
      }
    }else{
      for(let index=0;index<ids.length;index+=1){
        const count=reader.u16();
        if(count<2||count>19||reader.offset+count*4>reader.end)throw new PsdImportError('Curves point count повреждён','PSD_ADJUSTMENT_CURVES');
        channels.push({id:ids[index],points:Array.from({length:count},()=>curvePointPair(reader))});
      }
    }
    if(version===1&&reader.offset+10<=reader.end&&reader.ascii(4)==='Crv '){
      const extraVersion=reader.u16(),count=reader.u32();
      if(count<=32){
        const extra=[];
        for(let index=0;index<count&&reader.offset+4<=reader.end;index+=1){
          const id=reader.u16(),pointCount=reader.u16();
          if(pointCount>19||reader.offset+pointCount*4>reader.end)break;
          extra.push({id,points:Array.from({length:pointCount},()=>curvePointPair(reader))});
        }
        for(const entry of extra){
          const existing=channels.findIndex(channel=>channel.id===entry.id);
          if(existing>=0)channels[existing]=entry;else channels.push(entry);
        }
      }
      return{kind:'curves',version,isMap,countMap,extraVersion,channels};
    }
    return{kind:'curves',version,isMap,countMap,channels};
  }catch(error){
    warnings.push(label+': Curves не разобраны ('+(error?.message||error)+'); raw block сохранён');
    return{kind:'curves',version:null,isMap:false,countMap:0,channels:[]};
  }
}

function parsePsdAdjustmentBlocks(blocks,warnings,label) {
  if(!Array.isArray(blocks)||!blocks.length)return null;
  if(blocks.some(block=>block.key==='CgEd'||block.key==='brit'))return parseBrightnessContrastAdjustment(blocks,warnings,label);
  const exposure=blocks.find(block=>block.key==='expA');
  if(exposure)return parseExposureAdjustment(exposure);
  const hue=blocks.find(block=>block.key==='hue2'||block.key==='hue ');
  if(hue)return parseHueSaturationAdjustment(hue);
  const levels=blocks.find(block=>block.key==='levl');
  if(levels)return parseLevelsAdjustment(levels);
  const curves=blocks.find(block=>block.key==='curv');
  if(curves)return parseCurvesAdjustment(curves,warnings,label);
  const invert=blocks.find(block=>block.key==='nvrt');
  if(invert)return parseSimpleAdjustment(invert,'invert');
  const posterize=blocks.find(block=>block.key==='post');
  if(posterize)return parseSimpleAdjustment(posterize,'posterize','levels');
  const threshold=blocks.find(block=>block.key==='thrs');
  if(threshold)return parseSimpleAdjustment(threshold,'threshold','level');
  return null;
}

function appendAdjustmentLayerBlock(record,signature,key,data,warnings) {
  if(!data)return;
  if(!record.psdAdjustment)record.psdAdjustment={kind:null,parsed:null,blocks:[]};
  record.psdAdjustment.blocks.push({signature,key,data});
  const parsed=parsePsdAdjustmentBlocks(record.psdAdjustment.blocks,warnings,'Слой «'+record.name+'»');
  if(parsed){record.psdAdjustment.kind=parsed.kind;record.psdAdjustment.parsed=parsed;}
}

function patchBrightnessContrastBlock(block,adjustment) {
  const bytes=asBytes(block.data).slice();
  if(block.key==='CgEd'){
    const layout=readPsdDescriptorBlockDeepLayout(new Reader(bytes));
    patchDescriptorNumber(bytes,layout.layout.get('Brgh'),Math.round(Number(adjustment.brightness)||0),'Brightness');
    patchDescriptorNumber(bytes,layout.layout.get('Cntr'),Math.round(Number(adjustment.contrast)||0),'Contrast');
    return bytes;
  }
  if(block.key==='brit'&&bytes.length>=8){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    view.setInt16(0,Math.round(Number(adjustment.brightness)||0),false);
    view.setInt16(2,Math.round(Number(adjustment.contrast)||0),false);
    return bytes;
  }
  return bytes;
}

function patchLevelRecordAt(view,offset,record) {
  const value=record||{};
  const finite=(input,fallback)=>Number.isFinite(Number(input))?Number(input):fallback;
  view.setUint16(offset,Math.round(finite(value.inputBlack,0)),false);
  view.setUint16(offset+2,Math.round(finite(value.inputWhite,255)),false);
  view.setUint16(offset+4,Math.round(finite(value.outputBlack,0)),false);
  view.setUint16(offset+6,Math.round(finite(value.outputWhite,255)),false);
  view.setUint16(offset+8,Math.round(finite(value.gamma,1)*100),false);
}

function curveChannelsSemanticEqual(left,right) {
  const normalize=channels=>(Array.isArray(channels)?channels:[])
    .map(channel=>({
      id:Number(channel.id),
      points:(Array.isArray(channel.points)?channel.points:[]).map(point=>({input:Number(point.input),output:Number(point.output)})),
    }))
    .sort((a,b)=>a.id-b.id);
  return JSON.stringify(normalize(left))===JSON.stringify(normalize(right));
}

function encodeCurvesAdjustmentBlock(sourceBlock,adjustment) {
  const parsed=parseCurvesAdjustment(sourceBlock,[],'Curves rewrite');
  if(!parsed||parsed.version!==1||parsed.isMap){
    throw new PsdImportError('Curves rewrite: поддерживается point-based version 1','PSD_ADJUSTMENT_CURVES_WRITE');
  }
  const channels=(Array.isArray(adjustment?.channels)?adjustment.channels:[])
    .map(channel=>({
      id:Math.trunc(Number(channel?.id)),
      points:(Array.isArray(channel?.points)?channel.points:[])
        .map(point=>({input:Math.round(Number(point?.input)),output:Math.round(Number(point?.output))}))
        .sort((a,b)=>a.input-b.input),
    }))
    .filter(channel=>channel.id>=0&&channel.id<=31&&channel.points.length>=2&&channel.points.length<=19)
    .sort((a,b)=>a.id-b.id);
  if(!channels.length&&curveChannelsSemanticEqual(parsed.channels,channels))return asBytes(sourceBlock.data).slice();
  if(!channels.length)throw new PsdImportError('Curves rewrite: нужен хотя бы один channel с 2..19 points','PSD_ADJUSTMENT_CURVES_WRITE');
  for(const channel of channels){
    let previous=-1;
    for(const point of channel.points){
      if(point.input<0||point.input>255||point.output<0||point.output>255||point.input<=previous){
        throw new PsdImportError('Curves rewrite: points должны иметь возрастающий input 0..255 и output 0..255','PSD_ADJUSTMENT_CURVES_WRITE');
      }
      previous=point.input;
    }
  }
  if(curveChannelsSemanticEqual(parsed.channels,channels))return asBytes(sourceBlock.data).slice();
  let countMap=0;
  for(const channel of channels)countMap=(countMap|(1<<channel.id))>>>0;
  const writer=new Writer();
  writer.u8(0).u16(1).u32(countMap);
  for(const channel of channels){
    writer.u16(channel.points.length);
    for(const point of channel.points)writer.u16(point.output).u16(point.input);
  }
  const extraVersion=[3,4].includes(parsed.extraVersion)?parsed.extraVersion:4;
  writer.ascii('Crv ').u16(extraVersion).u32(channels.length);
  for(const channel of channels){
    writer.u16(channel.id).u16(channel.points.length);
    for(const point of channel.points)writer.u16(point.output).u16(point.input);
  }
  while(writer.length%4)writer.u8(0);
  return writer.concat();
}

export function rewritePsdAdjustmentBlocks(blocks,adjustment) {
  if(!Array.isArray(blocks)||!blocks.length)throw new PsdImportError('Adjustment rewrite: blocks отсутствуют','PSD_ADJUSTMENT_BLOCKS');
  const kind=String(adjustment?.kind||'');
  let rewritten=0;
  const output=blocks.map(block=>{
    if(!block?.data)return block;
    const bytes=asBytes(block.data).slice();
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(kind==='brightness-contrast'&&(block.key==='CgEd'||block.key==='brit')){
      rewritten+=1;return{...block,data:patchBrightnessContrastBlock(block,adjustment)};
    }
    if(kind==='exposure'&&block.key==='expA'&&bytes.length>=14){
      view.setFloat32(2,Number(adjustment.exposure)||0,false);
      view.setFloat32(6,Number(adjustment.offset)||0,false);
      view.setFloat32(10,Number(adjustment.gamma)||1,false);
      rewritten+=1;return{...block,data:bytes};
    }
    if(kind==='hue-saturation'&&(block.key==='hue2'||block.key==='hue ')&&bytes.length>=16){
      const colorize=adjustment.colorize===true;
      const offset=colorize?4:10;
      view.setUint8(2,colorize?1:0);
      view.setInt16(offset,Math.round(Number(adjustment.hue)||0),false);
      view.setInt16(offset+2,Math.round(Number(adjustment.saturation)||0),false);
      view.setInt16(offset+4,Math.round(Number(adjustment.lightness)||0),false);
      rewritten+=1;return{...block,data:bytes};
    }
    if(kind==='levels'&&block.key==='levl'&&bytes.length>=292){
      patchLevelRecordAt(view,2,adjustment.master);
      for(const channel of Array.isArray(adjustment.channels)?adjustment.channels:[]){
        const id=Math.trunc(Number(channel?.id));
        if(id>=1&&id<=3)patchLevelRecordAt(view,2+id*10,channel);
      }
      rewritten+=1;return{...block,data:bytes};
    }
    if(kind==='curves'&&block.key==='curv'){
      rewritten+=1;return{...block,data:encodeCurvesAdjustmentBlock(block,adjustment)};
    }
    if(kind==='invert'&&block.key==='nvrt'){
      rewritten+=1;return{...block,data:bytes};
    }
    if(kind==='posterize'&&block.key==='post'&&bytes.length>=2){
      view.setUint16(0,Math.round(Number(adjustment.levels)||4),false);
      rewritten+=1;return{...block,data:bytes};
    }
    if(kind==='threshold'&&block.key==='thrs'&&bytes.length>=2){
      view.setUint16(0,Math.round(Number(adjustment.level)||128),false);
      rewritten+=1;return{...block,data:bytes};
    }
    return block;
  });
  if(!rewritten)throw new PsdImportError('Adjustment rewrite: compatible block не найден для '+kind,'PSD_ADJUSTMENT_BLOCKS');
  return{blocks:output,rewritten};
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
    if (PSD_SMART_OBJECT_LAYER_KEYS.has(key)) {
      const data=copyOpaquePsdBlock(reader.bytes,dataStart,dataEnd,MAX_PSD_SMART_OBJECT_BLOCK_BYTES,`Слой «${record.name}» ${key}`,warnings);
      appendSmartObjectLayerBlock(record,signature,key,data,warnings);
    } else if (PSD_TEXT_LAYER_KEYS.has(key)) {
      const data=copyOpaquePsdBlock(reader.bytes,dataStart,dataEnd,MAX_PSD_TEXT_BLOCK_BYTES,`Слой «${record.name}» ${key}`,warnings);
      if(data)record.psdText={signature,key,data,parsed:parseTypeToolObject(data,warnings,`Слой «${record.name}»`)};
    } else if (PSD_SHAPE_LAYER_KEYS.has(key)) {
      const data=copyOpaquePsdBlock(reader.bytes,dataStart,dataEnd,MAX_PSD_SHAPE_BLOCK_BYTES,`Слой «${record.name}» ${key}`,warnings);
      appendShapeLayerBlock(record,signature,key,data,warnings);
    } else if (PSD_ADJUSTMENT_LAYER_KEYS.has(key)) {
      const data=copyOpaquePsdBlock(reader.bytes,dataStart,dataEnd,MAX_PSD_ADJUSTMENT_BLOCK_BYTES,`Слой «${record.name}» ${key}`,warnings);
      appendAdjustmentLayerBlock(record,signature,key,data,warnings);
    } else if (key === 'luni' && length >= 4) {
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
  const clipping = reader.u8();
  const flags = reader.u8();
  reader.u8();
  const extraLength = reader.u32();
  const extraStart = reader.offset;
  const extraEnd = extraStart + extraLength;
  if (extraEnd > reader.end) throw new PsdImportError('Extra data слоя выходит за границы PSD', 'PSD_LAYER_EXTRA');
  const maskLength = reader.u32();
  const mask = parseLayerMask(reader, maskLength);
  if (reader.offset + 4 > extraEnd) { reader.seek(extraEnd); return { top,left,bottom,right,channels,blendKey,opacity,clipping,flags,mask,name:'Слой',sectionDivider:0,sectionBlendKey:null,sectionSubtype:0 }; }
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
  const record = { top,left,bottom,right,channels,blendKey,opacity,clipping,flags,mask,name,sectionDivider:0,sectionBlendKey:null,sectionSubtype:0,groupKey:null,vectorMask:null,psdSmartObject:null,psdText:null,psdShape:null,psdAdjustment:null };
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

function invertCmykPlaneSample(plane, index, bitsPerChannel) {
  const sample=plane[index];
  if(bitsPerChannel===8)return 255-sample;
  if(bitsPerChannel===16)return 65535-sample;
  const value=Number(sample);
  return 1-Math.min(1,Math.max(0,Number.isFinite(value)?value:0));
}

function composeCmykPixelBuffer(width, height, channels, bitsPerChannel) {
  const pixels=safeArea(width,height,Number.MAX_SAFE_INTEGER);
  const cyan=channels.get(0),magenta=channels.get(1),yellow=channels.get(2),black=channels.get(3);
  if(!cyan||!magenta||!yellow||!black)return null;
  const alpha=channels.get(-1);
  const channelCount=alpha?5:4;
  const Type=bitsPerChannel===8?Uint8ClampedArray:bitsPerChannel===16?Uint16Array:Float32Array;
  if(!Type)return null;
  const data=new Type(pixels*channelCount);
  const alphaMax=bitsPerChannel===8?255:bitsPerChannel===16?65535:1;
  for(let index=0;index<pixels;index+=1){
    const out=index*channelCount;
    data[out]=invertCmykPlaneSample(cyan,index,bitsPerChannel);
    data[out+1]=invertCmykPlaneSample(magenta,index,bitsPerChannel);
    data[out+2]=invertCmykPlaneSample(yellow,index,bitsPerChannel);
    data[out+3]=invertCmykPlaneSample(black,index,bitsPerChannel);
    if(alpha)data[out+4]=alpha[index];
  }
  return createPixelBuffer({
    width,height,model:'cmyk',channels:channelCount,bitsPerChannel,
    colorSpace:'device-cmyk',alphaMode:alpha?'straight':'none',data,
  });
}

function composeDocumentPixelBuffer(width,height,channels,header) {
  return header.colorMode===PSD_COLOR_MODE_CMYK
    ? composeCmykPixelBuffer(width,height,channels,header.bitsPerChannel)
    : composeRgbPixelBuffer(width,height,channels,header.bitsPerChannel);
}

function buildMaskRgba(record, maskChannel, targetWidth, targetHeight, { targetLeft = record.left, targetTop = record.top } = {}) {
  if (!record.mask || !maskChannel || targetWidth <= 0 || targetHeight <= 0) return null;
  const mask = record.mask;
  const maskWidth = Math.max(0, mask.right - mask.left);
  const maskHeight = Math.max(0, mask.bottom - mask.top);
  if (!maskWidth || !maskHeight || maskChannel.length < maskWidth * maskHeight) return null;
  const rgba = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const defaultAlpha = mask.defaultColor === 0 ? 0 : 255;
  for (let index = 0; index < targetWidth * targetHeight; index += 1) {
    const out = index * 4;
    rgba[out] = 255; rgba[out + 1] = 255; rgba[out + 2] = 255; rgba[out + 3] = defaultAlpha;
  }
  const maskDocumentLeft = mask.positionRelativeToLayer ? record.left + mask.left : mask.left;
  const maskDocumentTop = mask.positionRelativeToLayer ? record.top + mask.top : mask.top;
  const originX = maskDocumentLeft - targetLeft;
  const originY = maskDocumentTop - targetTop;
  for (let y = 0; y < maskHeight; y += 1) {
    const targetY = originY + y;
    if (targetY < 0 || targetY >= targetHeight) continue;
    for (let x = 0; x < maskWidth; x += 1) {
      const targetX = originX + x;
      if (targetX < 0 || targetX >= targetWidth) continue;
      const sample = maskChannel[y * maskWidth + x];
      let value = maskChannel instanceof Uint16Array
        ? Math.round(sample / 257)
        : maskChannel instanceof Float32Array
          ? Math.round(Math.min(1, Math.max(0, Number.isNaN(sample) ? 0 : sample)) * 255)
          : sample;
      if (mask.inverted) value = 255 - value;
      rgba[(targetY * targetWidth + targetX) * 4 + 3] = value;
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
  const baseColorChannels = header.colorMode === PSD_COLOR_MODE_CMYK ? 4 : 3;
  if (compression === 0) {
    for (let channel = 0; channel < header.channels; channel += 1) {
      const bytes = reader.take(planeBytes);
      if (channel < baseColorChannels) channels.set(channel, decodeSamplePlane(bytes, header.bitsPerChannel));
      else if (channel === baseColorChannels) channels.set(-1, decodeSamplePlane(bytes, header.bitsPerChannel));
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
      if (channel < baseColorChannels) channels.set(channel, decodeSamplePlane(bytes, header.bitsPerChannel));
      else if (channel === baseColorChannels) channels.set(-1, decodeSamplePlane(bytes, header.bitsPerChannel));
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
      if (channel < baseColorChannels) channels.set(channel, decodeSamplePlane(bytes, header.bitsPerChannel));
      else if (channel === baseColorChannels) channels.set(-1, decodeSamplePlane(bytes, header.bitsPerChannel));
    }
  } else {
    throw new PsdImportError(`Неподдерживаемое сжатие composite PSD: ${compression}`, 'PSD_COMPOSITE_COMPRESSION');
  }
  return composeDocumentPixelBuffer(header.width, header.height, channels, header);
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
      const isColorChannel = header.colorMode === PSD_COLOR_MODE_CMYK
        ? descriptor.id >= 0 && descriptor.id <= 3
        : descriptor.id >= 0 && descriptor.id <= 2;
      if (isColorChannel || descriptor.id === -1 || descriptor.id === -2) record.decodedChannels.set(descriptor.id, data);
    }
  }
  if (reader.offset > layerInfoEnd) throw new PsdImportError('PSD layer info channel data выходит за границы секции', 'PSD_LAYER_INFO');
  reader.seek(layerInfoEnd);
  return records;
}

function detectPsdEmbeddedAssetType(data,filetype='',filename='') {
  const raw=String(filetype||'').trim().toLowerCase();
  if(raw==='8bps')return'psd';
  if(raw==='8bpb')return'psb';
  if(raw==='png')return'png';
  if(raw==='jpg'||raw==='jpeg')return'jpg';
  if(raw==='gif')return'gif';
  if(raw==='tif'||raw==='tiff')return'tiff';
  if(data?.length>=6&&decodeLatin1(data.subarray(0,4))==='8BPS')return data[4]===0&&data[5]===2?'psb':'psd';
  if(data?.length>=8&&data[0]===0x89&&decodeLatin1(data.subarray(1,4))==='PNG')return'png';
  if(data?.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff)return'jpg';
  if(data?.length>=4&&decodeLatin1(data.subarray(0,4))==='GIF8')return'gif';
  if(data?.length>=12&&decodeLatin1(data.subarray(0,4))==='RIFF'&&decodeLatin1(data.subarray(8,12))==='WEBP')return'webp';
  if(data?.length>=4&&((data[0]===0x49&&data[1]===0x49&&data[2]===0x2a&&data[3]===0)||(data[0]===0x4d&&data[1]===0x4d&&data[2]===0&&data[3]===0x2a)))return'tiff';
  if(data?.length>=2&&data[0]===0x42&&data[1]===0x4d)return'bmp';
  const match=String(filename||'').replace(/\0+$/g,'').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1]||raw||null;
}

function readPsdPascal1(reader,label) {
  const length=reader.u8();
  if(length>reader.end-reader.offset)throw new PsdImportError(`${label}: Pascal string обрезана`,'PSD_LINKED_LAYER_STRING');
  return decodeLatin1(reader.take(length));
}

function parseLinkedLayerRecord(reader,sourceKey,warnings) {
  const kindCode=reader.ascii(4);
  const version=reader.u32();
  if(version<1||version>8)throw new PsdImportError(`Linked Layer version ${version} вне диапазона 1..8`,'PSD_LINKED_LAYER_VERSION');
  const uuid=readPsdPascal1(reader,'Linked Layer uuid');
  const filename=readPsdUnicodeString(reader,'Linked Layer filename');
  const filetype=reader.ascii(4),creator=reader.ascii(4),dataSize=reader.u64(),hasOpenFile=Boolean(reader.u8());
  let openFile=null,linkedFile=null,timestamp=null,fileSize=null,data=null,childId=null,modTime=null,lockState=null;
  if(hasOpenFile)openFile=readPsdDescriptorBlock(reader);
  if(kindCode==='liFE'){
    linkedFile=readPsdDescriptorBlock(reader);
    if(version>3){
      const year=reader.u32(),month=reader.u8(),day=reader.u8(),hour=reader.u8(),minute=reader.u8(),seconds=readPsdFloat64(reader);
      timestamp={year,month,day,hour,minute,seconds};
    }
    fileSize=reader.u64();
    if(version>2&&dataSize>0){
      if(dataSize>reader.end-reader.offset)throw new PsdImportError('Linked external cached data обрезаны','PSD_LINKED_LAYER_DATA');
      const raw=reader.take(dataSize);
      if(dataSize<=MAX_PSD_LINKED_ASSET_BYTES)data=raw.slice();
      else warnings.push(`Linked Layer ${uuid}: cached asset ${dataSize} bytes не извлечён из-за safety limit`);
    }
  }else if(kindCode==='liFA'){
    reader.skip(8);
  }else if(kindCode==='liFD'){
    if(dataSize>reader.end-reader.offset)throw new PsdImportError('Embedded Smart Object data обрезаны','PSD_LINKED_LAYER_DATA');
    const raw=reader.take(dataSize);
    if(dataSize<=MAX_PSD_LINKED_ASSET_BYTES)data=raw.slice();
    else warnings.push(`Linked Layer ${uuid}: embedded asset ${dataSize} bytes не извлечён из-за safety limit`);
  }else{
    throw new PsdImportError(`Unknown Linked Layer kind ${JSON.stringify(kindCode)}`,'PSD_LINKED_LAYER_KIND');
  }
  if(version>=5)childId=readPsdUnicodeString(reader,'Linked Layer child id');
  if(version>=6)modTime=readPsdFloat64(reader);
  if(version>=7)lockState=reader.u8();
  if(kindCode==='liFE'&&version===2&&dataSize>0){
    if(dataSize>reader.end-reader.offset)throw new PsdImportError('Linked external v2 cached data обрезаны','PSD_LINKED_LAYER_DATA');
    const raw=reader.take(dataSize);
    if(dataSize<=MAX_PSD_LINKED_ASSET_BYTES)data=raw.slice();
  }
  const kind=kindCode==='liFD'?'data':kindCode==='liFE'?'external':'alias';
  return{
    sourceKey,kind,kindCode,version,uuid,filename:filename.replace(/\0+$/g,''),filetype:filetype.replace(/\0+$/g,''),creator,
    dataSize,fileSize,openFile,linkedFile,timestamp,data,childId,modTime,lockState,
    detectedFileType:detectPsdEmbeddedAssetType(data,filetype,filename),
  };
}

function parseLinkedLayerBlocks(blocks,warnings) {
  const entries=[];
  for(const block of blocks||[]){
    const reader=new Reader(block.data);
    while(reader.offset+8<=reader.end){
      const length=reader.u64();
      if(!length)break;
      const end=reader.offset+length;
      if(end>reader.end){warnings.push(`Linked Layer ${block.key}: record выходит за границы блока`);break;}
      try{
        const entry=parseLinkedLayerRecord(new Reader(reader.bytes,reader.offset,end),block.key,warnings);
        entries.push(entry);
      }catch(error){
        warnings.push(`Linked Layer ${block.key}: typed parse недоступен (${error?.message||error}); opaque block сохранён`);
      }
      reader.seek(end);
      const padding=(4-(length%4))%4;
      if(padding&&reader.offset+padding<=reader.end)reader.skip(padding);
    }
  }
  return entries;
}

async function readHighDepthLayerInfoBlocks(reader, sectionEnd, header, maxPixels, maxLayers, maxChannelBytes, warnings) {
  const wantedKey = header.bitsPerChannel === 16 ? 'Lr16' : header.bitsPerChannel === 32 ? 'Lr32' : null;
  let highDepthRecords = null;
  const linkedLayerBlocks=[];
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
    if(PSD_LINKED_LAYER_KEYS.has(key)){
      if(linkedLayerBlocks.length>=MAX_PSD_LINKED_LAYER_BLOCKS){
        warnings.push(`Linked Layer resources: превышен лимит ${MAX_PSD_LINKED_LAYER_BLOCKS} blocks; ${key} пропущен`);
      }else{
        const data=copyOpaquePsdBlock(reader.bytes,dataStart,dataEnd,MAX_PSD_LINKED_LAYER_BLOCK_BYTES,`Linked Layer ${key}`,warnings);
        if(data)linkedLayerBlocks.push({signature,key,data});
      }
    }
    reader.seek(dataEnd);
    if ((length & 1) && reader.offset < sectionEnd) reader.skip(1);
  }
  return{highDepthRecords,linkedLayerBlocks};
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
  let linkedLayerBlocks=[];
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
    const tagged = await readHighDepthLayerInfoBlocks(reader, layerMask.end, header, maxPixels, maxLayers, maxChannelBytes, warnings);
    if (tagged.highDepthRecords?.length) records = tagged.highDepthRecords;
    linkedLayerBlocks=tagged.linkedLayerBlocks;
    reader.seek(layerMask.end);
  }

  const linkedLayerEntries=parseLinkedLayerBlocks(linkedLayerBlocks,warnings);
  const linkedByUuid=new Map(linkedLayerEntries.filter(entry=>entry.uuid).map(entry=>[entry.uuid,entry]));
  for(const record of records){
    if(record.psdSmartObject?.uniqueId){
      const asset=linkedByUuid.get(record.psdSmartObject.uniqueId);
      if(asset)record.psdSmartObject.asset={sourceKey:asset.sourceKey,kind:asset.kind,uuid:asset.uuid,filename:asset.filename,filetype:asset.filetype,detectedFileType:asset.detectedFileType,dataSize:asset.dataSize,fileSize:asset.fileSize,data:asset.data};
    }
  }

  const groups = reconstructPsdGroups(records, warnings);

  const layers = [];
  const fillLayers = [];
  const adjustmentLayers = [];
  for (let recordIndex=0;recordIndex<records.length;recordIndex+=1) {
    const record=records[recordIndex];
    if (record.sectionDivider === 1 || record.sectionDivider === 2 || record.sectionDivider === 3) continue;
    if(record.psdAdjustment?.parsed){
      const maskRgba=buildMaskRgba(
        record,
        record.decodedChannels.get(-2),
        header.width,
        header.height,
        {targetLeft:0,targetTop:0},
      );
      adjustmentLayers.push({
        name:record.name||'PSD Adjustment Layer',
        visible:!(record.flags&0x02),
        opacity:record.opacity/255,
        blendMode:blendModeFor(record.blendKey,warnings,record.name),
        clipping:Boolean(record.clipping),
        groupKey:record.groupKey||null,
        vectorMask:record.vectorMask,
        mask:maskRgba?{pixels:maskRgba,disabled:Boolean(record.mask?.disabled)}:null,
        maskMeta:record.mask?{...record.mask}:null,
        channelIds:record.channels.map(channel=>channel.id),
        psdAdjustment:record.psdAdjustment,
        stackIndex:recordIndex,
      });
      continue;
    }
    const width = Math.max(0, record.right - record.left);
    const height = Math.max(0, record.bottom - record.top);
    if (!width || !height) {
      if(record.psdShape?.fillType==='gradient'||record.psdShape?.fillType==='pattern'){
        fillLayers.push({
          name:record.name||'PSD Fill Layer',
          visible:!(record.flags&0x02),
          opacity:record.opacity/255,
          blendMode:blendModeFor(record.blendKey,warnings,record.name),
          clipping:Boolean(record.clipping),
          groupKey:record.groupKey||null,
          psdShape:record.psdShape,
          stackIndex:recordIndex,
        });
        warnings.push(`Слой «${record.name}»: ${record.psdShape.fillType} fill metadata сохранены в fillLayers foundation; raster preview берётся из composite`);
      }else warnings.push(`Слой «${record.name}» пропущен: пустые bounds`);
      continue;
    }
    const pixelBuffer = composeDocumentPixelBuffer(width, height, record.decodedChannels, header);
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
      clipping: Boolean(record.clipping),
      groupKey: record.groupKey || null,
      pixelBuffer,
      pixels: header.bitsPerChannel === 8 ? pixelBuffer.data : null,
      mask: maskRgba ? { pixels: maskRgba, disabled: Boolean(record.mask?.disabled) } : null,
      vectorMask: record.vectorMask,
      psdSmartObject: record.psdSmartObject,
      psdText: record.psdText,
      psdShape: record.psdShape,
      stackIndex:recordIndex,
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
    fillLayers,
    adjustmentLayers,
    groups,
    composite,
    compositePixelBuffer,
    iccProfile: imageResources.iccProfile,
    iccUntagged: imageResources.iccUntagged,
    paths: imageResources.paths,
    linkedLayerBlocks,
    linkedLayerEntries,
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

function locateEmbeddedLinkedLayerRecord(bytes,start,end) {
  const reader=new Reader(bytes,start,end);
  const kindCode=reader.ascii(4);
  const version=reader.u32();
  if(version<1||version>8)return null;
  const uuid=readPsdPascal1(reader,'Linked Layer uuid');
  readPsdUnicodeString(reader,'Linked Layer filename');
  reader.ascii(4);reader.ascii(4);
  const dataSizeOffset=reader.offset;
  const dataSize=reader.u64();
  const dataSizeFieldEnd=reader.offset;
  const hasOpenFile=Boolean(reader.u8());
  if(hasOpenFile)readPsdDescriptorBlock(reader);
  if(kindCode!=='liFD')return{kindCode,version,uuid,dataSize};
  const dataStart=reader.offset;
  const dataEnd=dataStart+dataSize;
  if(dataEnd>end)throw new PsdImportError('Embedded Smart Object data обрезаны','PSD_LINKED_LAYER_DATA');
  return{kindCode,version,uuid,dataSize,dataSizeOffset,dataSizeFieldEnd,dataStart,dataEnd};
}

export function rewriteEmbeddedLinkedLayerAsset(blocks,uniqueId,newData) {
  const id=String(uniqueId||'');
  if(!id)throw new PsdImportError('Embedded Smart Object rewrite: отсутствует UUID','PSD_SMART_OBJECT_UUID');
  const asset=asBytes(newData);
  if(asset.byteLength>MAX_PSD_LINKED_ASSET_BYTES)throw new PsdImportError(`Embedded Smart Object rewrite: payload ${asset.byteLength} bytes превышает safety limit`,'PSD_LINKED_LAYER_DATA');
  let rewritten=0,oldSize=null,sourceKey=null;
  const output=(Array.isArray(blocks)?blocks:[]).map(block=>{
    if(!PSD_LINKED_LAYER_KEYS.has(block?.key))return block;
    const bytes=asBytes(block.data);
    const reader=new Reader(bytes);
    const writer=new Writer();
    let changed=false;
    while(reader.offset+8<=reader.end){
      const prefixStart=reader.offset;
      const length=reader.u64();
      if(!length){writer.push(bytes.subarray(prefixStart));reader.seek(reader.end);break;}
      const recordStart=reader.offset;
      const recordEnd=recordStart+length;
      if(recordEnd>reader.end)throw new PsdImportError(`Linked Layer ${block.key}: record выходит за границы блока`,'PSD_LINKED_LAYER_DATA');
      const layout=locateEmbeddedLinkedLayerRecord(bytes,recordStart,recordEnd);
      const oldPadding=(4-(length%4))%4;
      const nextOffset=recordEnd+oldPadding;
      if(nextOffset>reader.end)throw new PsdImportError(`Linked Layer ${block.key}: record padding выходит за границы блока`,'PSD_LINKED_LAYER_DATA');
      if(layout?.kindCode==='liFD'&&layout.uuid===id){
        const record=new Writer();
        record.push(bytes.subarray(recordStart,layout.dataSizeOffset));
        record.u64(asset.byteLength);
        record.push(bytes.subarray(layout.dataSizeFieldEnd,layout.dataStart));
        record.push(asset);
        record.push(bytes.subarray(layout.dataEnd,recordEnd));
        const recordBytes=record.concat();
        writer.u64(recordBytes.byteLength).push(recordBytes);
        const newPadding=(4-(recordBytes.byteLength%4))%4;
        if(newPadding)writer.push(new Uint8Array(newPadding));
        rewritten+=1;oldSize=layout.dataSize;sourceKey=block.key;changed=true;
      }else{
        writer.push(bytes.subarray(prefixStart,nextOffset));
      }
      reader.seek(nextOffset);
    }
    if(reader.offset<reader.end)writer.push(bytes.subarray(reader.offset));
    return changed?{...block,data:writer.concat()}:block;
  });
  return{blocks:output,rewritten,oldSize,newSize:asset.byteLength,sourceKey};
}

function writeOpaqueAdditionalInfoBlock(writer,block,version,allowedKeys,maxBytes,label) {
  const key=String(block?.key||'');
  if(!allowedKeys.has(key))throw new PsdImportError(`PSD/PSB writer: ${label} key ${JSON.stringify(key)} не разрешён`,'PSD_EXPORT_OPAQUE_KEY');
  const data=asBytes(block?.data);
  if(data.length>maxBytes)throw new PsdImportError(`PSD/PSB writer: ${label} ${key} превышает safety limit`,'PSD_EXPORT_OPAQUE_LIMIT');
  const longForPsb=version===PSB_VERSION&&PSB_LONG_ADDITIONAL_KEYS.has(key);
  const signature=version===PSB_VERSION&&block?.signature==='8B64'?'8B64':'8BIM';
  writer.ascii(signature).ascii(key);
  if(version===PSB_VERSION&&(signature==='8B64'||longForPsb))writer.u64(data.length);
  else writer.u32(data.length);
  writer.push(data);
  if(data.length&1)writer.u8(0);
}

function writeSmartObjectLayerExtras(writer,layer,version) {
  const blocks=Array.isArray(layer?.psdSmartObject?.blocks)?layer.psdSmartObject.blocks:[];
  for(const block of blocks.slice(0,8)){
    writeOpaqueAdditionalInfoBlock(writer,block,version,PSD_SMART_OBJECT_LAYER_KEYS,MAX_PSD_SMART_OBJECT_BLOCK_BYTES,'Smart Object layer block');
  }
}

function writeTextLayerExtra(writer,layer,version) {
  const block=layer?.psdText;
  if(!block)return;
  writeOpaqueAdditionalInfoBlock(writer,block,version,PSD_TEXT_LAYER_KEYS,MAX_PSD_TEXT_BLOCK_BYTES,'Text layer block');
}

function writeShapeLayerExtras(writer,layer,version,phase='content') {
  const blocks=Array.isArray(layer?.psdShape?.blocks)?layer.psdShape.blocks:[];
  for(const block of blocks.slice(0,8)){
    const isStroke=block?.key==='vstk';
    if((phase==='stroke')!==isStroke)continue;
    writeOpaqueAdditionalInfoBlock(writer,block,version,PSD_SHAPE_LAYER_KEYS,MAX_PSD_SHAPE_BLOCK_BYTES,'Shape layer block');
  }
}

function writeAdjustmentLayerExtras(writer,layer,version) {
  const blocks=Array.isArray(layer?.psdAdjustment?.blocks)?layer.psdAdjustment.blocks:[];
  for(const block of blocks.slice(0,12)){
    writeOpaqueAdditionalInfoBlock(writer,block,version,PSD_ADJUSTMENT_LAYER_KEYS,MAX_PSD_ADJUSTMENT_BLOCK_BYTES,'Adjustment layer block');
  }
}

function writeLinkedLayerBlocks(writer,blocks,version) {
  if(!Array.isArray(blocks))return;
  for(const block of blocks.slice(0,MAX_PSD_LINKED_LAYER_BLOCKS)){
    writeOpaqueAdditionalInfoBlock(writer,block,version,PSD_LINKED_LAYER_KEYS,MAX_PSD_LINKED_LAYER_BLOCK_BYTES,'Linked Layer block');
  }
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

function exportPixelSource(value, width, height, label, errorCode = 'PSD_EXPORT_PIXELS', expectedModel = 'rgb') {
  const count = safeArea(width, height, Number.MAX_SAFE_INTEGER);
  if (isPixelBuffer(value?.pixelBuffer)) {
    const buffer = value.pixelBuffer;
    const validChannels = expectedModel === 'cmyk' ? [4,5] : [3,4];
    if (buffer.model !== expectedModel || !validChannels.includes(buffer.channels) || buffer.width !== width || buffer.height !== height) {
      throw new PsdImportError('PSD/PSB writer: '+label+' имеет несовместимый '+expectedModel.toUpperCase()+' PixelBuffer', errorCode);
    }
    return { kind:'pixel-buffer', buffer, model:expectedModel };
  }
  if(expectedModel!=='rgb'){
    throw new PsdImportError('PSD/PSB writer: '+label+' требует native CMYK PixelBuffer', errorCode);
  }
  const rgba = asBytes(value?.pixels);
  if (rgba.length !== count * 4) {
    throw new PsdImportError('PSD/PSB writer: '+label+' имеет неверный RGBA-буфер', errorCode);
  }
  return { kind:'rgba8', pixels:rgba, model:'rgb' };
}

function exportSourceValue(source, pixel, channel) {
  if (source.kind === 'rgba8') return source.pixels[pixel * 4 + channel] / 255;
  const buffer = source.buffer;
  const offset = pixel * buffer.channels;
  const value = Number(buffer.data[offset + channel]);
  if (!Number.isFinite(value)) return 0;
  if (buffer.bitsPerChannel === 8) return value / 255;
  if (buffer.bitsPerChannel === 16) return value / 65535;
  return value;
}

function exportSourceAlpha(source, pixel) {
  if(source.kind==='rgba8')return source.pixels[pixel*4+3]/255;
  const buffer=source.buffer;
  const alphaIndex=buffer.model==='cmyk'?(buffer.channels===5?4:-1):(buffer.channels===4?3:-1);
  if(alphaIndex<0)return 1;
  return Math.max(0,Math.min(1,exportSourceValue(source,pixel,alphaIndex)));
}

function writeExportSample(view, offset, value, bitsPerChannel, { allowExtended = false } = {}) {
  const finite = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (bitsPerChannel === 8) {
    view.setUint8(offset, Math.round(Math.max(0, Math.min(1, finite)) * 255));
    return;
  }
  if (bitsPerChannel === 16) {
    view.setUint16(offset, Math.round(Math.max(0, Math.min(1, finite)) * 65535), false);
    return;
  }
  view.setFloat32(offset, allowExtended ? finite : Math.max(0,Math.min(1,finite)), false);
}

function fillExportChannelRow(target, source, channel, width, row, bitsPerChannel, {
  whiteMatte = false,
  matte = null,
  invert = false,
  alpha = false,
} = {}) {
  const sampleBytes = bytesPerSample(bitsPerChannel);
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength);
  for (let x=0; x<width; x+=1) {
    const pixel = row * width + x;
    const sourceAlpha = exportSourceAlpha(source,pixel);
    let value = alpha ? sourceAlpha : exportSourceValue(source, pixel, channel);
    const matteValue = matte == null ? (whiteMatte ? 1 : null) : Number(matte);
    if (!alpha && matteValue != null && sourceAlpha > 0 && sourceAlpha < 1) {
      value = value * sourceAlpha + matteValue * (1 - sourceAlpha);
    }
    if(invert&&!alpha)value=1-Math.max(0,Math.min(1,value));
    const allowExtended=!alpha&&!invert&&source.model==='rgb'&&bitsPerChannel===32;
    writeExportSample(view, x * sampleBytes, value, bitsPerChannel, {allowExtended});
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
  if (bitsPerChannel === 8 && source.kind === 'rgba8' && !options.invert && !options.alpha && options.matte == null) {
    return encodeRleRgbaChannel(source.pixels, channel, width, height, version, options);
  }
  if (bitsPerChannel === 8) return encodeRleExportChannel(source, channel, width, height, version, options);
  return encodeRawExportChannel(source, channel, width, height, bitsPerChannel, options);
}

function validateExportLayer(layer, index, maxPixels, colorMode = PSD_COLOR_MODE_RGB) {
  const width = Math.trunc(Number(layer?.width));
  const height = Math.trunc(Number(layer?.height));
  safeArea(width, height, maxPixels);
  const model=colorMode===PSD_COLOR_MODE_CMYK?'cmyk':'rgb';
  const source = exportPixelSource(layer, width, height, 'слой #'+(index+1), 'PSD_EXPORT_PIXELS', model);
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
  const x=Math.trunc(Number(layer.mask.x??layer.x)||0);
  const y=Math.trunc(Number(layer.mask.y??layer.y)||0);
  const width=Math.max(0,Math.trunc(Number(layer.mask.width??layer.width)||0));
  const height=Math.max(0,Math.trunc(Number(layer.mask.height??layer.height)||0));
  writer.u32(20);
  writer.i32(y).i32(x).i32(y + height).i32(x + width);
  writer.u8(layer.mask.defaultColor===0?0:255);
  writer.u8(layer.mask.disabled ? 0x02 : 0);
  writer.u16(0);
}

function normalizeExportLayer(layer, index, maxPixels, version, bitsPerChannel, colorMode = PSD_COLOR_MODE_RGB) {
  if(layer?.psdAdjustment){
    const channelIds=Array.isArray(layer.psdAdjustment.channelIds)&&layer.psdAdjustment.channelIds.length
      ? layer.psdAdjustment.channelIds.slice(0,16).map(Number)
      : [-1,0,1,2,-2];
    const channels=channelIds.map(id=>({id,data:new Uint8Array([0,0])}));
    let mask=null;
    if(layer.mask?.pixels){
      const maskWidth=Math.max(1,Math.trunc(Number(layer.mask.width)||0));
      const maskHeight=Math.max(1,Math.trunc(Number(layer.mask.height)||0));
      const maskSource=exportPixelSource({pixels:layer.mask.pixels},maskWidth,maskHeight,'маска adjustment '+(layer.name||index+1),'PSD_EXPORT_MASK','rgb');
      const maskData=encodeExportChannel(maskSource,0,maskWidth,maskHeight,version,bitsPerChannel,{alpha:true});
      const existing=channels.find(channel=>channel.id===-2);
      if(existing)existing.data=maskData;else channels.push({id:-2,data:maskData});
      mask={
        disabled:Boolean(layer.mask.disabled),pixels:true,
        x:Math.trunc(Number(layer.mask.x)||0),y:Math.trunc(Number(layer.mask.y)||0),
        width:maskWidth,height:maskHeight,defaultColor:layer.mask.defaultColor===0?0:255,
      };
    }
    return{
      ...layer,
      x:0,y:0,width:0,height:0,mask,
      channels,
    };
  }
  const item = validateExportLayer(layer, index, maxPixels, colorMode);
  const cmyk=colorMode===PSD_COLOR_MODE_CMYK;
  const channels = cmyk
    ? [
        { id:0, data:encodeExportChannel(item.source,0,item.width,item.height,version,bitsPerChannel,{invert:true}) },
        { id:1, data:encodeExportChannel(item.source,1,item.width,item.height,version,bitsPerChannel,{invert:true}) },
        { id:2, data:encodeExportChannel(item.source,2,item.width,item.height,version,bitsPerChannel,{invert:true}) },
        { id:3, data:encodeExportChannel(item.source,3,item.width,item.height,version,bitsPerChannel,{invert:true}) },
        { id:-1, data:encodeExportChannel(item.source,0,item.width,item.height,version,bitsPerChannel,{alpha:true}) },
      ]
    : [
        { id:0, data:encodeExportChannel(item.source,0,item.width,item.height,version,bitsPerChannel) },
        { id:1, data:encodeExportChannel(item.source,1,item.width,item.height,version,bitsPerChannel) },
        { id:2, data:encodeExportChannel(item.source,2,item.width,item.height,version,bitsPerChannel) },
        { id:-1, data:encodeExportChannel(item.source,0,item.width,item.height,version,bitsPerChannel,{alpha:true}) },
      ];
  let mask = null;
  if (item.mask?.pixels || isPixelBuffer(item.mask?.pixelBuffer)) {
    const maskSource = exportPixelSource(item.mask, item.width, item.height, 'маска слоя '+(item.name || index + 1), 'PSD_EXPORT_MASK', 'rgb');
    mask = { disabled: Boolean(item.mask.disabled), pixels: true };
    channels.push({ id:-2, data:encodeExportChannel(maskSource,0,item.width,item.height,version,bitsPerChannel,{alpha:true}) });
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

function encodeCompositeData({ composite, compositePixelBuffer }, width, height, version, bitsPerChannel, colorMode = PSD_COLOR_MODE_RGB) {
  const cmyk=colorMode===PSD_COLOR_MODE_CMYK;
  if (!cmyk && bitsPerChannel === 8 && !compositePixelBuffer) return encodeCompositeRle(composite, width, height, version);
  const source = exportPixelSource(
    compositePixelBuffer ? { pixelBuffer:compositePixelBuffer } : { pixels:composite },
    width,
    height,
    'composite',
    'PSD_EXPORT_COMPOSITE',
    cmyk?'cmyk':'rgb',
  );
  const planeDescriptors=cmyk
    ? [
        {channel:0,options:{invert:true,matte:0}},
        {channel:1,options:{invert:true,matte:0}},
        {channel:2,options:{invert:true,matte:0}},
        {channel:3,options:{invert:true,matte:0}},
        {channel:0,options:{alpha:true}},
      ]
    : [
        {channel:0,options:{whiteMatte:true}},
        {channel:1,options:{whiteMatte:true}},
        {channel:2,options:{whiteMatte:true}},
        {channel:0,options:{alpha:true}},
      ];
  if (bitsPerChannel === 8) {
    const writer = new Writer();
    const rowLengthBytes = version === PSB_VERSION ? 4 : 2;
    const rows = [];
    const lengths = [];
    const raw = new Uint8Array(width);
    for (const descriptor of planeDescriptors) {
      for (let row=0; row<height; row+=1) {
        fillExportChannelRow(raw, source, descriptor.channel, width, row, 8, descriptor.options);
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
  for (const descriptor of planeDescriptors) {
    for (let row=0; row<height; row+=1) {
      const bytes = new Uint8Array(rowBytes);
      fillExportChannelRow(bytes, source, descriptor.channel, width, row, bitsPerChannel, descriptor.options);
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
  layerRecords.u8(opacity).u8(layer.clipping ? 1 : 0);
  const flags = 0x08 | (layer.transparencyProtected ? 0x01 : 0) | (layer.visible === false ? 0x02 : 0);
  layerRecords.u8(flags).u8(0);

  const extra = new Writer();
  writeLayerMaskExtra(extra, layer);
  extra.u32(0);
  writePascalLayerName(extra, layer.name || 'Layer');
  writeUnicodeLayerName(extra, layer.name || 'Layer');
  writeSectionDividerExtra(extra, layer);
  writeShapeLayerExtras(extra, layer, version, 'content');
  writeVectorMaskExtra(extra, layer, documentWidth, documentHeight);
  writeShapeLayerExtras(extra, layer, version, 'stroke');
  writeAdjustmentLayerExtras(extra, layer, version);
  writeTextLayerExtra(extra, layer, version);
  writeSmartObjectLayerExtras(extra, layer, version);
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

function buildPsdWriter({ width, height, layers = [], groups = [], paths = [], composite, compositePixelBuffer = null, bitsPerChannel = 8, colorMode = PSD_COLOR_MODE_RGB, iccProfile = null, iccUntagged = false, linkedLayerBlocks = [], version = PSD_VERSION, maxPixels = 48_000_000, maxLayers = MAX_PSD_LAYERS, maxBytes = 2_000_000_000 } = {}) {
  const mode=colorMode==='cmyk'||Number(colorMode)===PSD_COLOR_MODE_CMYK?PSD_COLOR_MODE_CMYK:PSD_COLOR_MODE_RGB;
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

  const normalized = layers.map((layer, index) => normalizeExportLayer(layer, index, maxPixels, version, depth, mode));
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
  writeLinkedLayerBlocks(layerAndMask,linkedLayerBlocks,version);

  const compositeData = encodeCompositeData({ composite, compositePixelBuffer }, documentWidth, documentHeight, version, depth, mode);
  const imageResources = buildImageResources({iccProfile,iccUntagged,paths,width:documentWidth,height:documentHeight});
  const out = new Writer();
  out.ascii('8BPS').u16(version).push(new Uint8Array(6));
  out.u16(mode===PSD_COLOR_MODE_CMYK?5:4).u32(documentHeight).u32(documentWidth).u16(depth).u16(mode);
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
