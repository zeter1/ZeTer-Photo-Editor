import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePsd, encodePsd, encodePsdBlob, encodePsb, encodePsbBlob, inspectPsdHeader, isPsdFile, PsdImportError } from '../src/adapters/psd.js';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { pixelBufferToRgba8Preview } from '../src/core/pixel-buffer.js';

const encoder = new TextEncoder();
const psdSource = await readFile(new URL('../src/adapters/psd.js', import.meta.url), 'utf8');

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function writer() {
  const parts = [];
  const bytes = (...values) => parts.push(Uint8Array.from(values));
  const ascii = value => parts.push(encoder.encode(value));
  const u16 = value => bytes((value >>> 8) & 255, value & 255);
  const i16 = value => u16(value < 0 ? 0x10000 + value : value);
  const u32 = value => bytes((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
  const i32 = value => u32(value < 0 ? 0x100000000 + value : value);
  const u64 = value => {
    const high = Math.floor(value / 0x100000000);
    const low = value - high * 0x100000000;
    u32(high); u32(low);
  };
  const push = value => parts.push(value);
  return { parts, bytes, ascii, u16, i16, u32, i32, u64, push };
}

function channelSamples(depth) {
  if (depth === 16) {
    return [
      [65535, 0],
      [0, 32768],
      [0, 65535],
      [65535, 32768],
    ];
  }
  if (depth === 32) {
    return [
      [0, 2],
      [-0.5, 0.25],
      [1, 4],
      [1, 0.5],
    ];
  }
  return [
    [255, 0],
    [0, 255],
    [0, 0],
    [255, 128],
  ];
}

function sampleRowBytes(samples, depth) {
  if (depth === 8) return Uint8Array.from(samples.map(value => value & 255));
  const bytesPerSample = depth === 16 ? 2 : 4;
  const bytes = new Uint8Array(samples.length * bytesPerSample);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    if (depth === 16) view.setUint16(index * 2, samples[index], false);
    else if (depth === 32) view.setFloat32(index * 4, samples[index], false);
    else throw new Error(`Unsupported fixture depth: ${depth}`);
  }
  return bytes;
}


function makeTestIccProfile({ colorSpace='RGB ', pcs='XYZ ', deviceClass='mntr' } = {}) {
  const bytes = new Uint8Array(128);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length, false);
  bytes[8] = 4;
  bytes[9] = 0x30;
  const putAscii = (offset, value) => {
    for (let i = 0; i < 4; i += 1) bytes[offset + i] = value.charCodeAt(i) || 32;
  };
  putAscii(12, deviceClass);
  putAscii(16, colorSpace);
  putAscii(20, pcs);
  putAscii(36, 'acsp');
  return bytes;
}

function imageResourceBlock(id, data, name='') {
  const out=writer();
  out.ascii('8BIM');
  out.u16(id);
  const nameBytes=encoder.encode(name);
  out.bytes(nameBytes.length);
  if(nameBytes.length)out.push(nameBytes);
  if((1+nameBytes.length)&1)out.bytes(0);
  out.u32(data.length);
  out.push(data);
  if(data.length&1)out.bytes(0);
  return concat(out.parts);
}

function imageResourcesBytes({ iccProfile=null, iccUntagged=false } = {}) {
  const parts=[];
  if(iccProfile)parts.push(imageResourceBlock(1039,iccProfile));
  if(iccUntagged)parts.push(imageResourceBlock(1041,Uint8Array.of(1)));
  return concat(parts);
}

function makeRawPsd({ version = 1, depth = 8, colorMode = 3, iccProfile = null, iccUntagged = false } = {}) {
  const out = writer();
  out.ascii('8BPS'); out.u16(version); out.bytes(0,0,0,0,0,0);
  out.u16(4); out.u32(1); out.u32(2); out.u16(depth); out.u16(colorMode);
  out.u32(0);
  const resources=imageResourcesBytes({iccProfile,iccUntagged});
  out.u32(resources.length);
  if(resources.length)out.push(resources);

  const info = writer();
  info.i16(1);
  info.i32(0); info.i32(0); info.i32(1); info.i32(2);
  const rows = channelSamples(depth).map(samples => sampleRowBytes(samples, depth));
  info.u16(4);
  for (let index = 0; index < 4; index += 1) { info.i16([0,1,2,-1][index]); info.u32(2 + rows[index].length); }
  info.ascii('8BIM'); info.ascii('norm'); info.bytes(255,0,0,0);
  const extra = writer();
  extra.u32(0); extra.u32(0); extra.bytes(5); extra.ascii('Layer'); extra.bytes(0,0);
  const extraBytes = concat(extra.parts);
  info.u32(extraBytes.length); info.push(extraBytes);
  for (const row of rows) { info.u16(0); info.push(row); }

  const infoBytes = concat(info.parts);
  out.u32(4 + infoBytes.length);
  out.u32(infoBytes.length);
  out.push(infoBytes);
  return concat(out.parts);
}


function makeRlePsb({ depth = 8, colorMode = 3 } = {}) {
  const out = writer();
  out.ascii('8BPS'); out.u16(2); out.bytes(0,0,0,0,0,0);
  out.u16(4); out.u32(1); out.u32(2); out.u16(depth); out.u16(colorMode);
  out.u32(0); // Color Mode Data remains 4-byte length in PSB.
  out.u32(0); // Image Resources remains 4-byte length in PSB.

  const info = writer();
  info.i16(1);
  info.i32(0); info.i32(0); info.i32(1); info.i32(2);
  const rows = channelSamples(depth).map(samples => sampleRowBytes(samples, depth));
  info.u16(4);
  for (let index = 0; index < 4; index += 1) {
    info.i16([0,1,2,-1][index]);
    info.u64(2 + 4 + 1 + rows[index].length);
  }
  info.ascii('8BIM'); info.ascii('norm'); info.bytes(255,0,0,0);
  const extra = writer();
  extra.u32(0); extra.u32(0); extra.bytes(5); extra.ascii('Layer'); extra.bytes(0,0);
  const extraBytes = concat(extra.parts);
  info.u32(extraBytes.length); info.push(extraBytes);

  for (const row of rows) {
    info.u16(1);
    info.u32(1 + row.length);
    info.bytes(row.length - 1);
    info.push(row);
  }

  const infoBytes = concat(info.parts);
  const layerAndMask = writer();
  layerAndMask.u64(infoBytes.length);
  layerAndMask.push(infoBytes);
  layerAndMask.u32(0);
  const layerAndMaskBytes = concat(layerAndMask.parts);

  out.u64(layerAndMaskBytes.length);
  out.push(layerAndMaskBytes);
  return concat(out.parts);
}

function encodePredictionRow(row, depth, width) {
  const source = Uint8Array.from(row);
  if (depth === 8) {
    for (let index = source.length - 1; index >= 1; index -= 1) source[index] = (source[index] - source[index - 1]) & 255;
    return source;
  }
  if (depth === 16) {
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    for (let x = width - 1; x >= 1; x -= 1) {
      const current = view.getUint16(x * 2, false);
      const previous = view.getUint16((x - 1) * 2, false);
      view.setUint16(x * 2, (current - previous) & 0xffff, false);
    }
    return source;
  }
  if (depth === 32) {
    const shuffled = new Uint8Array(source.length);
    for (let x = 0; x < width; x += 1) {
      const offset = x * 4;
      shuffled[x] = source[offset];
      shuffled[width + x] = source[offset + 1];
      shuffled[width * 2 + x] = source[offset + 2];
      shuffled[width * 3 + x] = source[offset + 3];
    }
    for (let index = shuffled.length - 1; index >= 1; index -= 1) shuffled[index] = (shuffled[index] - shuffled[index - 1]) & 255;
    return shuffled;
  }
  throw new Error(`Unsupported prediction fixture depth: ${depth}`);
}

function makeZipPsd({ depth = 16, compression = 2 } = {}) {
  const out = writer();
  out.ascii('8BPS'); out.u16(1); out.bytes(0,0,0,0,0,0);
  out.u16(4); out.u32(1); out.u32(2); out.u16(depth); out.u16(3);
  out.u32(0); out.u32(0);

  const rows = channelSamples(depth).map(samples => sampleRowBytes(samples, depth));
  const compressedRows = rows.map(row => new Uint8Array(deflateSync(compression === 3 ? encodePredictionRow(row, depth, 2) : row)));
  const info = writer();
  info.i16(1);
  info.i32(0); info.i32(0); info.i32(1); info.i32(2);
  info.u16(4);
  for (let index = 0; index < 4; index += 1) {
    info.i16([0,1,2,-1][index]);
    info.u32(2 + compressedRows[index].length);
  }
  info.ascii('8BIM'); info.ascii('norm'); info.bytes(255,0,0,0);
  const extra = writer();
  extra.u32(0); extra.u32(0); extra.bytes(5); extra.ascii('Layer'); extra.bytes(0,0);
  const extraBytes = concat(extra.parts);
  info.u32(extraBytes.length); info.push(extraBytes);
  for (const compressed of compressedRows) {
    info.u16(compression);
    info.push(compressed);
  }

  const infoBytes = concat(info.parts);
  out.u32(4 + infoBytes.length);
  out.u32(infoBytes.length);
  out.push(infoBytes);
  return concat(out.parts);
}



function makeCompositeZipPsd({ depth = 16, compression = 3 } = {}) {
  const out = writer();
  out.ascii('8BPS'); out.u16(1); out.bytes(0,0,0,0,0,0);
  out.u16(4); out.u32(1); out.u32(2); out.u16(depth); out.u16(3);
  out.u32(0); out.u32(0);
  out.u32(0);
  const planes = channelSamples(depth).map(samples => sampleRowBytes(samples, depth));
  const payload = concat(planes.map(row => compression === 3 ? encodePredictionRow(row, depth, 2) : row));
  out.u16(compression);
  out.push(new Uint8Array(deflateSync(payload)));
  return concat(out.parts);
}

function makeNestedGroupPsd() {
  const out = writer();
  out.ascii('8BPS'); out.u16(1); out.bytes(0,0,0,0,0,0);
  out.u16(4); out.u32(1); out.u32(2); out.u16(8); out.u16(3);
  out.u32(0); out.u32(0);

  const records = [
    {name:'</Layer group>',divider:3},
    {name:'Outer Pixel',planes:[[0,[255,0]],[1,[0,255]],[2,[0,0]],[-1,[255,255]]]},
    {name:'</Layer group>',divider:3},
    {name:'Inner Pixel',planes:[[0,[0,255]],[1,[0,255]],[2,[255,0]],[-1,[255,128]]]},
    {name:'Inner',divider:2,hidden:true},
    {name:'Outer',divider:1},
  ];

  const info = writer();
  const channelPayloads = [];
  info.i16(records.length);
  for (const record of records) {
    const hasPixels = Array.isArray(record.planes);
    const width = hasPixels ? 2 : 0;
    const height = hasPixels ? 1 : 0;
    info.i32(0); info.i32(0); info.i32(height); info.i32(width);
    info.u16(hasPixels ? record.planes.length : 0);
    if (hasPixels) {
      for (const [id, plane] of record.planes) {
        info.i16(id);
        info.u32(2 + plane.length);
      }
    }
    info.ascii('8BIM');
    info.ascii(record.divider ? 'pass' : 'norm');
    info.bytes(255,0,record.hidden ? 0x02 : 0,0);

    const extra = writer();
    extra.u32(0);
    extra.u32(0);
    const nameBytes = encoder.encode(record.name);
    extra.bytes(nameBytes.length);
    extra.push(nameBytes);
    const nameConsumed = 1 + nameBytes.length;
    const namePadding = (4 - (nameConsumed % 4)) % 4;
    if (namePadding) extra.push(new Uint8Array(namePadding));
    if (record.divider) {
      extra.ascii('8BIM'); extra.ascii('lsct'); extra.u32(12);
      extra.u32(record.divider); extra.ascii('8BIM'); extra.ascii('pass');
    }
    const extraBytes = concat(extra.parts);
    info.u32(extraBytes.length);
    info.push(extraBytes);
    if (hasPixels) channelPayloads.push(record.planes);
  }

  for (const planes of channelPayloads) {
    for (const [, plane] of planes) {
      info.u16(0);
      info.bytes(...plane);
    }
  }

  const infoBytes = concat(info.parts);
  out.u32(4 + infoBytes.length);
  out.u32(infoBytes.length);
  out.push(infoBytes);
  return concat(out.parts);
}

test('PSD adapter inspects and decodes layered raw RGB/8-bit PSD', async () => {
  const psd = makeRawPsd();
  assert.deepEqual(inspectPsdHeader(psd), {
    signature:'8BPS', version:1, channels:4, width:2, height:1, bitsPerChannel:8, colorMode:3,
  });
  const decoded = await decodePsd(psd);
  assert.equal(decoded.layers.length, 1);
  assert.equal(decoded.layers[0].name, 'Layer');
  assert.equal(decoded.layers[0].blendMode, 'source-over');
  assert.equal(decoded.layers[0].pixelBuffer.kind, 'zpe-pixel-buffer-v1');
  assert.equal(decoded.layers[0].pixelBuffer.bitsPerChannel, 8);
  assert.strictEqual(decoded.layers[0].pixels, decoded.layers[0].pixelBuffer.data);
  assert.deepEqual([...decoded.layers[0].pixels], [255,0,0,255, 0,255,0,128]);
});

test('PSB Stage 7a decodes version 2 with 64-bit section/channel lengths and 32-bit RLE row counts', async () => {
  const psb = makeRlePsb();
  assert.deepEqual(inspectPsdHeader(psb), {
    signature:'8BPS', version:2, channels:4, width:2, height:1, bitsPerChannel:8, colorMode:3,
  });
  const decoded = await decodePsd(psb);
  assert.equal(decoded.layers.length, 1);
  assert.equal(decoded.layers[0].name, 'Layer');
  assert.equal(decoded.layers[0].pixelBuffer.kind, 'zpe-pixel-buffer-v1');
  assert.strictEqual(decoded.layers[0].pixels, decoded.layers[0].pixelBuffer.data);
  assert.deepEqual([...decoded.layers[0].pixels], [255,0,0,255, 0,255,0,128]);
});

test('PSD/PSB Stage 7c decodes RGB/16-bit Raw, RLE and ZIP without prediction into precision-preserving PixelBuffers', async () => {
  const expected16 = [
    65535,0,0,65535,
    0,32768,65535,32768,
  ];
  const expectedPreview = [
    255,0,0,255,
    0,128,255,128,
  ];
  for (const source of [
    makeRawPsd({ depth:16 }),
    makeRlePsb({ depth:16 }),
    makeZipPsd({ depth:16 }),
    makeZipPsd({ depth:16, compression:3 }),
  ]) {
    const decoded = await decodePsd(source);
    assert.equal(decoded.bitsPerChannel,16);
    assert.equal(decoded.layers.length,1);
    assert.equal(decoded.layers[0].pixelBuffer.bitsPerChannel,16);
    assert.ok(decoded.layers[0].pixelBuffer.data instanceof Uint16Array);
    assert.deepEqual([...decoded.layers[0].pixelBuffer.data],expected16);
    assert.equal(decoded.layers[0].pixels,null);
    assert.deepEqual([...pixelBufferToRgba8Preview(decoded.layers[0].pixelBuffer)],expectedPreview);
  }
});

test('PSD/PSB Stage 7d decodes RGB/32-bit float Raw, RLE and ZIP without prediction into Float32 PixelBuffers', async () => {
  const expected32 = [
    0,-0.5,1,1,
    2,0.25,4,0.5,
  ];
  const expectedPreview = [
    0,0,255,255,
    255,64,255,128,
  ];
  for (const source of [
    makeRawPsd({ depth:32 }),
    makeRlePsb({ depth:32 }),
    makeZipPsd({ depth:32 }),
    makeZipPsd({ depth:32, compression:3 }),
  ]) {
    const decoded = await decodePsd(source);
    assert.equal(decoded.bitsPerChannel,32);
    assert.equal(decoded.layers.length,1);
    assert.equal(decoded.layers[0].pixelBuffer.bitsPerChannel,32);
    assert.ok(decoded.layers[0].pixelBuffer.data instanceof Float32Array);
    assert.deepEqual([...decoded.layers[0].pixelBuffer.data],expected32);
    assert.equal(decoded.layers[0].pixels,null);
    assert.deepEqual([...pixelBufferToRgba8Preview(decoded.layers[0].pixelBuffer)],expectedPreview);
  }
});

test('PSD/PSB Stage 7e decodes high-depth ZIP prediction for composite image data', async () => {
  for (const depth of [16,32]) {
    const decoded = await decodePsd(makeCompositeZipPsd({ depth, compression:3 }));
    assert.equal(decoded.layers.length,0);
    assert.equal(decoded.composite,null);
    assert.ok(decoded.compositePixelBuffer);
    assert.equal(decoded.compositePixelBuffer.bitsPerChannel,depth);
    const expected = depth === 16
      ? [65535,0,0,65535, 0,32768,65535,32768]
      : [0,-0.5,1,1, 2,0.25,4,0.5];
    assert.deepEqual([...decoded.compositePixelBuffer.data],expected);
  }
});

test('PSD/PSB high-depth import still rejects CMYK explicitly', async () => {
  await assert.rejects(() => decodePsd(makeRawPsd({ colorMode:4 })), error => error instanceof PsdImportError && error.code === 'PSD_COLOR_MODE');
  await assert.rejects(() => decodePsd(makeRlePsb({ colorMode:4 })), error => error instanceof PsdImportError && error.code === 'PSD_COLOR_MODE');
});


test('PSD Group Import Stage 8a reconstructs nested lsct groups and layer membership', async () => {
  const decoded=await decodePsd(makeNestedGroupPsd());
  assert.equal(decoded.groups.length,2);
  const outer=decoded.groups.find(group=>group.name==='Outer');
  const inner=decoded.groups.find(group=>group.name==='Inner');
  assert.ok(outer);
  assert.ok(inner);
  assert.deepEqual(outer.path,['Outer']);
  assert.equal(outer.depth,0);
  assert.equal(outer.collapsed,false);
  assert.equal(outer.visible,true);
  assert.deepEqual(inner.path,['Outer','Inner']);
  assert.equal(inner.parentKey,outer.key);
  assert.equal(inner.depth,1);
  assert.equal(inner.collapsed,true);
  assert.equal(inner.visible,false);

  const outerPixel=decoded.layers.find(layer=>layer.name==='Outer Pixel');
  const innerPixel=decoded.layers.find(layer=>layer.name==='Inner Pixel');
  assert.equal(outerPixel.groupKey,outer.key);
  assert.equal(innerPixel.groupKey,inner.key);
  assert.deepEqual([...outerPixel.pixels],[255,0,0,255,0,255,0,255]);
  assert.deepEqual([...innerPixel.pixels],[0,0,255,255,255,255,0,128]);
});


test('PSD Color Management Stage 7f extracts ICC resource 1039 and untagged flag 1041', async () => {
  const profile=makeTestIccProfile();
  const decoded=await decodePsd(makeRawPsd({iccProfile:profile,iccUntagged:true}));
  assert.ok(decoded.iccProfile);
  assert.equal(decoded.iccProfile.id,1039);
  assert.equal(decoded.iccProfile.size,128);
  assert.equal(decoded.iccProfile.declaredSize,128);
  assert.equal(decoded.iccProfile.version,'4.3.0');
  assert.equal(decoded.iccProfile.deviceClass,'mntr');
  assert.equal(decoded.iccProfile.colorSpace,'RGB');
  assert.equal(decoded.iccProfile.pcs,'XYZ');
  assert.equal(decoded.iccProfile.signatureValid,true);
  assert.deepEqual([...decoded.iccProfile.bytes],[...profile]);
  assert.equal(decoded.iccUntagged,true);
});

test('PSD/PSB detection uses extensions or Photoshop MIME type', () => {
  assert.equal(isPsdFile({ name:'layout.PSD', type:'' }), true);
  assert.equal(isPsdFile({ name:'layout.PSB', type:'' }), true);
  assert.equal(isPsdFile({ name:'layout.bin', type:'image/vnd.adobe.photoshop' }), true);
  assert.equal(isPsdFile({ name:'layout.png', type:'image/png' }), false);
});


test('PSD writer round-trips layered RGB pixels, Unicode names, blend state and user mask', async () => {
  const topPixels=Uint8Array.from([10,20,220,200]);
  const topMask=Uint8Array.from([255,255,255,100]);
  const bottomPixels=Uint8Array.from([
    255,0,0,255,
    0,255,0,255,
  ]);
  const composite=Uint8Array.from([
    200,10,20,255,
    5,180,40,180,
  ]);
  const encoded=encodePsd({
    width:2,height:1,composite,
    layers:[
      {
        name:'Верх ✓',x:1,y:0,width:1,height:1,pixels:topPixels,
        opacity:.5,blendMode:'multiply',visible:false,
        mask:{pixels:topMask,disabled:true},
      },
      {
        name:'Низ',x:0,y:0,width:2,height:1,pixels:bottomPixels,
        opacity:1,blendMode:'source-over',visible:true,
      },
    ],
  });
  const header=inspectPsdHeader(encoded);
  assert.equal(header.channels,4);
  assert.equal(header.width,2);
  assert.equal(header.height,1);

  const decoded=await decodePsd(encoded);
  assert.equal(decoded.layers.length,2);
  assert.equal(decoded.layers[0].name,'Верх ✓');
  assert.equal(decoded.layers[0].blendMode,'multiply');
  assert.equal(decoded.layers[0].visible,false);
  assert.ok(Math.abs(decoded.layers[0].opacity-(128/255))<1e-9);
  assert.deepEqual([...decoded.layers[0].pixels],[...topPixels]);
  assert.equal(decoded.layers[0].mask.disabled,true);
  assert.equal(decoded.layers[0].mask.pixels[3],100);
  assert.equal(decoded.layers[1].name,'Низ');
  assert.deepEqual([...decoded.layers[1].pixels],[...bottomPixels]);
});

test('PSD writer rejects malformed layer and mask buffers', () => {
  const composite=Uint8Array.from([0,0,0,0]);
  assert.throws(
    () => encodePsd({width:1,height:1,composite,layers:[{name:'bad',x:0,y:0,width:1,height:1,pixels:Uint8Array.from([1,2,3])}]}),
    error => error instanceof PsdImportError && error.code === 'PSD_EXPORT_PIXELS',
  );
  assert.throws(
    () => encodePsd({
      width:1,height:1,composite,
      layers:[{name:'bad mask',x:0,y:0,width:1,height:1,pixels:Uint8Array.from([1,2,3,4]),mask:{pixels:Uint8Array.from([255])}}],
    }),
    error => error instanceof PsdImportError && error.code === 'PSD_EXPORT_MASK',
  );
});


test('PSD writer Stage 6b keeps row-chunk encoding instead of full channel planes', () => {
  assert.match(psdSource, /function fillRgbaChannelRow\(/);
  assert.match(psdSource, /function measureRleRgbaRows\(/);
  assert.match(psdSource, /function appendRleRgbaRows\(/);
  assert.match(psdSource, /append\(other\)/);
  assert.match(psdSource, /layerInfo\.append\(layerRecords\)\.append\(channelData\)/);
  assert.doesNotMatch(psdSource, /function rgbaPlane\(/);
  assert.doesNotMatch(psdSource, /function compositePlane\(/);
});

test('PSD row encoder round-trips long literal and repeated PackBits rows', async () => {
  const width = 260;
  const height = 2;
  const pixels = new Uint8Array(width * height * 4);
  const mask = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const repeated = x < 130;
      pixels[offset] = repeated ? 42 : (x * 13 + y * 7) & 255;
      pixels[offset + 1] = repeated ? 42 : (x * 29 + 11) & 255;
      pixels[offset + 2] = repeated ? 42 : (255 - x) & 255;
      pixels[offset + 3] = x % 5 === 0 ? 128 : 255;
      mask[offset] = 255;
      mask[offset + 1] = 255;
      mask[offset + 2] = 255;
      mask[offset + 3] = (x + y * 31) & 255;
    }
  }
  const encoded = encodePsd({
    width,
    height,
    composite: pixels,
    layers:[{
      name:'row-stream',
      x:0,y:0,width,height,
      pixels,
      opacity:1,
      blendMode:'source-over',
      visible:true,
      mask:{pixels:mask,disabled:false},
    }],
  });
  const decoded = await decodePsd(encoded);
  assert.equal(decoded.layers.length, 1);
  assert.deepEqual([...decoded.layers[0].pixels], [...pixels]);
  assert.deepEqual([...decoded.layers[0].mask.pixels], [...mask]);
});



test('PSD Group Export Stage 8b round-trips flat group records and keeps child visibility independent', async () => {
  const visiblePixels=Uint8Array.from([255,0,0,255]);
  const hiddenPixels=Uint8Array.from([0,255,0,255]);
  const freePixels=Uint8Array.from([0,0,255,255]);
  const encoded=encodePsd({
    width:1,height:1,composite:visiblePixels,
    groups:[{key:'group-1',name:'Папка ✓',visible:false,collapsed:true}],
    layers:[
      {name:'Visible child',groupKey:'group-1',x:0,y:0,width:1,height:1,pixels:visiblePixels,opacity:1,blendMode:'source-over',visible:true},
      {name:'Hidden child',groupKey:'group-1',x:0,y:0,width:1,height:1,pixels:hiddenPixels,opacity:1,blendMode:'source-over',visible:false},
      {name:'Free',x:0,y:0,width:1,height:1,pixels:freePixels,opacity:1,blendMode:'source-over',visible:true},
    ],
  });
  const decoded=await decodePsd(encoded);
  assert.equal(decoded.groups.length,1);
  const group=decoded.groups[0];
  assert.equal(group.name,'Папка ✓');
  assert.equal(group.visible,false);
  assert.equal(group.collapsed,true);
  const visibleChild=decoded.layers.find(layer=>layer.name==='Visible child');
  const hiddenChild=decoded.layers.find(layer=>layer.name==='Hidden child');
  const free=decoded.layers.find(layer=>layer.name==='Free');
  assert.equal(visibleChild.groupKey,group.key);
  assert.equal(visibleChild.visible,true);
  assert.equal(hiddenChild.groupKey,group.key);
  assert.equal(hiddenChild.visible,false);
  assert.equal(free.groupKey,null);
});


test('PSD Group Stage 8c round-trips native nested groups without flattening names', async () => {
  const pixels=Uint8Array.from([20,40,60,255]);
  const encoded=encodePsd({
    width:1,height:1,composite:pixels,
    groups:[
      {key:'outer',name:'Outer',visible:true,collapsed:false,opacity:1,blendMode:'pass-through'},
      {key:'inner',parentKey:'outer',name:'Inner',visible:false,collapsed:true,opacity:.5,blendMode:'multiply'},
    ],
    layers:[
      {name:'Outer layer',groupKey:'outer',x:0,y:0,width:1,height:1,pixels,opacity:1,blendMode:'source-over',visible:true},
      {name:'Inner layer',groupKey:'inner',x:0,y:0,width:1,height:1,pixels,opacity:1,blendMode:'source-over',visible:true},
    ],
  });
  const decoded=await decodePsd(encoded);
  const outer=decoded.groups.find(group=>group.name==='Outer');
  const inner=decoded.groups.find(group=>group.name==='Inner');
  assert.ok(outer);
  assert.ok(inner);
  assert.equal(inner.parentKey,outer.key);
  assert.deepEqual(inner.path,['Outer','Inner']);
  assert.equal(inner.visible,false);
  assert.equal(inner.collapsed,true);
  assert.ok(Math.abs(inner.opacity-128/255)<1e-9);
  assert.equal(inner.blendMode,'multiply');
  assert.equal(outer.blendMode,'pass-through');
  assert.equal(decoded.layers.find(layer=>layer.name==='Outer layer').groupKey,outer.key);
  assert.equal(decoded.layers.find(layer=>layer.name==='Inner layer').groupKey,inner.key);
});

test('PSD Group Export Stage 8b rejects non-contiguous members instead of grouping unrelated layers', () => {
  const pixels=Uint8Array.from([1,2,3,255]);
  assert.throws(()=>encodePsd({
    width:1,height:1,composite:pixels,
    groups:[{key:'g',name:'split'}],
    layers:[
      {name:'A',groupKey:'g',x:0,y:0,width:1,height:1,pixels,opacity:1,blendMode:'source-over',visible:true},
      {name:'Free',x:0,y:0,width:1,height:1,pixels,opacity:1,blendMode:'source-over',visible:true},
      {name:'B',groupKey:'g',x:0,y:0,width:1,height:1,pixels,opacity:1,blendMode:'source-over',visible:true},
    ],
  }),error=>error instanceof PsdImportError&&error.code==='PSD_EXPORT_GROUP_SPLIT');
});

test('PSD Blob export is byte-identical to encodePsd without a final UI concat', async () => {
  const pixels=Uint8Array.from([
    10,20,30,255,
    40,50,60,128,
  ]);
  const options={
    width:2,height:1,composite:pixels,
    layers:[{
      name:'blob',x:0,y:0,width:2,height:1,pixels,
      opacity:1,blendMode:'source-over',visible:true,
    }],
  };
  const bytes=encodePsd(options);
  const blob=encodePsdBlob(options);
  assert.equal(blob.type,'image/vnd.adobe.photoshop');
  assert.equal(blob.size,bytes.length);
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[...bytes]);
  const decoded=await decodePsd(await blob.arrayBuffer());
  assert.deepEqual([...decoded.layers[0].pixels],[...pixels]);
});

test('PSD Blob export keeps byte-array compatibility API separate from chunked Blob path', () => {
  assert.match(psdSource, /function buildPsdWriter\(/);
  assert.match(psdSource, /export function encodePsd\(options = \{\}\)/);
  assert.match(psdSource, /export function encodePsdBlob\(options = \{\}\)/);
  assert.match(psdSource, /new Blob\(writer\.parts/);
});


test('PSB writer round-trips RGB/8-bit layers and masks with version 2 header', async () => {
  const pixels=Uint8Array.from([
    20,40,60,255,
    80,100,120,128,
  ]);
  const mask=Uint8Array.from([
    255,255,255,220,
    255,255,255,70,
  ]);
  const options={
    width:2,height:1,composite:pixels,
    layers:[{
      name:'PSB ✓',x:0,y:0,width:2,height:1,pixels,
      opacity:.75,blendMode:'screen',visible:true,
      mask:{pixels:mask,disabled:false},
    }],
  };
  const encoded=encodePsb(options);
  assert.equal(inspectPsdHeader(encoded).version,2);
  const decoded=await decodePsd(encoded);
  assert.equal(decoded.layers.length,1);
  assert.equal(decoded.layers[0].name,'PSB ✓');
  assert.equal(decoded.layers[0].blendMode,'screen');
  assert.deepEqual([...decoded.layers[0].pixels],[...pixels]);
  assert.deepEqual([...decoded.layers[0].mask.pixels],[...mask]);
});

test('PSB Blob export is byte-identical to encodePsb and keeps chunked output', async () => {
  const pixels=Uint8Array.from([1,2,3,255]);
  const options={
    width:1,height:1,composite:pixels,
    layers:[{name:'psb-blob',x:0,y:0,width:1,height:1,pixels,opacity:1,blendMode:'source-over',visible:true}],
  };
  const bytes=encodePsb(options);
  const blob=encodePsbBlob(options);
  assert.equal(blob.type,'image/vnd.adobe.photoshop');
  assert.equal(blob.size,bytes.length);
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[...bytes]);
});

test('PSB Stage 7a wire contract keeps 64-bit lengths and 32-bit RLE row counts explicit', () => {
  assert.match(psdSource, /const PSB_VERSION = 2/);
  assert.match(psdSource, /readVersionedLength\(reader, version\)/);
  assert.match(psdSource, /version === PSB_VERSION \? reader\.u32\(\) : reader\.u16\(\)/);
  assert.match(psdSource, /if \(version === PSB_VERSION\) layerRecords\.u64\(channel\.data\.length\)/);
  assert.match(psdSource, /if \(version === PSB_VERSION\) out\.u64\(layerAndMask\.length\)/);
  assert.match(psdSource, /export function encodePsb\(/);
  assert.match(psdSource, /export function encodePsbBlob\(/);
});
