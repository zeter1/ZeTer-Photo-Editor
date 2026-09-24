import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePsd, encodePsd, inspectPsdHeader, isPsdFile, PsdImportError } from '../src/adapters/psd.js';
import { readFile } from 'node:fs/promises';

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
  const push = value => parts.push(value);
  return { parts, bytes, ascii, u16, i16, u32, i32, push };
}

function makeRawPsd({ version = 1, depth = 8, colorMode = 3 } = {}) {
  const out = writer();
  out.ascii('8BPS'); out.u16(version); out.bytes(0,0,0,0,0,0);
  out.u16(4); out.u32(1); out.u32(2); out.u16(depth); out.u16(colorMode);
  out.u32(0); out.u32(0);

  const info = writer();
  info.i16(1);
  info.i32(0); info.i32(0); info.i32(1); info.i32(2);
  info.u16(4);
  for (const id of [0,1,2,-1]) { info.i16(id); info.u32(4); }
  info.ascii('8BIM'); info.ascii('norm'); info.bytes(255,0,0,0);
  const extra = writer();
  extra.u32(0); extra.u32(0); extra.bytes(5); extra.ascii('Layer'); extra.bytes(0,0);
  const extraBytes = concat(extra.parts);
  info.u32(extraBytes.length); info.push(extraBytes);
  for (const data of [[255,0],[0,255],[0,0],[255,128]]) { info.u16(0); info.bytes(...data); }

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
  assert.deepEqual([...decoded.layers[0].pixels], [255,0,0,255, 0,255,0,128]);
});

test('PSD Stage 3 rejects PSB and high bit depth explicitly', async () => {
  await assert.rejects(() => decodePsd(makeRawPsd({ version:2 })), error => error instanceof PsdImportError && error.code === 'PSD_VERSION');
  await assert.rejects(() => decodePsd(makeRawPsd({ depth:16 })), error => error instanceof PsdImportError && error.code === 'PSD_BIT_DEPTH');
  await assert.rejects(() => decodePsd(makeRawPsd({ colorMode:4 })), error => error instanceof PsdImportError && error.code === 'PSD_COLOR_MODE');
});

test('PSD detection uses extension or Photoshop MIME type', () => {
  assert.equal(isPsdFile({ name:'layout.PSD', type:'' }), true);
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
      mask:{pixels,disabled:false},
    }],
  });
  const decoded = await decodePsd(encoded);
  assert.equal(decoded.layers.length, 1);
  assert.deepEqual([...decoded.layers[0].pixels], [...pixels]);
  assert.deepEqual([...decoded.layers[0].mask.pixels], [...pixels]);
});
