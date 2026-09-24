import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const adapter=await readFile(new URL('../src/adapters/psd.js',import.meta.url),'utf8');

test('PSD Stage 4 is wired into the export UI and uses the dedicated writer',()=>{
  assert.match(main,/import \{ decodePsd, encodePsd, isPsdFile \} from '\.\/adapters\/psd\.js'/);
  assert.match(main,/PSD — слои \(Stage 4\)/);
  assert.match(main,/async function preparePsdExport\(exportDoc\)/);
  assert.match(main,/async function exportPsdDocument\(exportDoc\)/);
  assert.match(main,/const bytes=encodePsd\(/);
  assert.match(main,/image\/vnd\.adobe\.photoshop/);
  assert.match(main,/48_000_000/);
  assert.match(main,/ZPE Composite Preview \(adjustments baked\)/);
});

test('PSD Stage 4 writer exposes Photoshop-compatible layered export primitives',()=>{
  assert.match(adapter,/export function encodePsd\(/);
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
