import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePsd, inspectPsdHeader, isPsdFile, PsdImportError } from '../src/adapters/psd.js';

const encoder = new TextEncoder();

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
