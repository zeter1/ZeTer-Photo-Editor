import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const adapter=await readFile(new URL('../src/adapters/psd.js',import.meta.url),'utf8');

test('PSD Stage 4 and PSB Stage 7a are wired into the export UI',()=>{
  assert.match(main,/import \{ decodePsd, encodePsdBlob, encodePsbBlob, isPsdFile \} from '\.\/adapters\/psd\.js'/);
  assert.match(main,/PSD — слои \(Stage 4\)/);
  assert.match(main,/PSB — Large Document \(Stage 7a\)/);
  assert.match(main,/async function preparePsdExport\(exportDoc\)/);
  assert.match(main,/async function exportPsdDocument\(exportDoc,\{psb=false\}=\{\}\)/);
  assert.match(main,/const encodeBlob=psb\?encodePsbBlob:encodePsdBlob/);
  assert.match(main,/if\(type==='psb'\)\{await exportPsdDocument\(exportDoc,\{psb:true\}\);return;\}/);
  assert.match(main,/downloadBlob\(blob,filename\)/);
  assert.match(main,/image\/vnd\.adobe\.photoshop/);
  assert.match(main,/48_000_000/);
  assert.match(main,/ZPE Composite Preview \(adjustments baked\)/);
});

test('PSD Stage 4 writer exposes Photoshop-compatible layered export primitives',()=>{
  assert.match(adapter,/export function encodePsd\(/);
  assert.match(adapter,/export function encodePsdBlob\(/);
  assert.match(adapter,/export function encodePsb\(/);
  assert.match(adapter,/export function encodePsbBlob\(/);
  assert.match(adapter,/const PSD_BLEND_KEYS/);
  assert.match(adapter,/writeUnicodeLayerName/);
  assert.match(adapter,/encodeRleRgbaChannel/);
  assert.match(adapter,/measureRleRgbaRows/);
  assert.match(adapter,/appendRleRgbaRows/);
  assert.match(adapter,/writeLayerMaskExtra/);
  assert.match(adapter,/const flags = 0x08/);
  assert.match(adapter,/while \(layerInfo\.length % 4\)/);
  assert.match(adapter,/function encodeCompositeRle/);
  assert.doesNotMatch(adapter,/function rgbaPlane/);
  assert.doesNotMatch(adapter,/function compositePlane/);
});


test('PSB Stage 7a import surface accepts .psb and strips either Photoshop extension',()=>{
  assert.match(main,/replace\(\/\\\.ps\[db\]\$\/i,''\)/);
  assert.match(adapter,/\/\\\.ps\[db\]\$\/i/);
});


test('PixelBuffer Stage 7b is the PSD/PSB adapter-to-UI raster boundary',()=>{
  assert.match(adapter,/createRgba8PixelBuffer/);
  assert.match(adapter,/pixelBuffer,/);
  assert.match(main,/pixelBufferToRgba8Preview/);
  assert.match(main,/sourceLayer\.pixelBuffer/);
  assert.match(main,/parsed\.compositePixelBuffer/);
});
