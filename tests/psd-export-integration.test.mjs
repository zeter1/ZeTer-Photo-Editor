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


test('PSD Group Import Stage 8a maps adapter group keys into ZPE layer groups',()=>{
  assert.match(adapter,/function reconstructPsdGroups\(/);
  assert.match(adapter,/groupKey: record\.groupKey \|\| null/);
  assert.match(adapter,/return \{ \.\.\.header, layers, groups, composite, compositePixelBuffer, warnings \}/);
  assert.match(main,/const usedGroupKeys=new Set\(parsed\.layers\.map\(layer=>layer\.groupKey\)/);
  assert.match(main,/createLayerGroup\(\{/);
  assert.match(main,/groupId:sourceLayer\.groupKey\?/);
  assert.match(main,/next\.groups=importedGroups/);
});


test('PSD Group Export Stage 8b wires ZPE flat groups into the PSD/PSB writer',()=>{
  assert.match(adapter,/function expandExportLayerGroups\(/);
  assert.match(adapter,/writeSectionDividerExtra\(extra, layer\)/);
  assert.match(adapter,/groups = \[\]/);
  assert.match(main,/const exportGroups=\(exportDoc\.groups\|\|\[\]\)/);
  assert.match(main,/groupKey:layer\.groupId/);
  assert.match(main,/return\{layers:\[\.\.\.prepared\]\.reverse\(\),groups:exportGroups,composite,warnings\}/);
  assert.match(main,/layers:prepared\.layers,groups:prepared\.groups,composite:prepared\.composite/);
});


test('PSD Group Stage 8c carries native parent relationships through ZPE and writer',()=>{
  assert.match(adapter,/parentKey: group\.parent\?\.key \?\? null/);
  assert.match(adapter,/function exportGroupLineage\(/);
  assert.match(main,/group\.parentGroupId=sourceGroup\.parentKey/);
  assert.match(main,/parentKey:group\.parentGroupId/);
  assert.match(main,/isGroupVisible\(doc, group\)/);
  assert.match(main,/isGroupLocked\(doc, group\)/);
});


test('PSD Group Stage 8e maps opacity and blend mode through ZPE and lsct folder records',()=>{
  assert.match(adapter,/function groupBlendModeFor\(/);
  assert.match(adapter,/opacity: group\.opacity/);
  assert.match(adapter,/blendMode: groupBlendModeFor/);
  assert.match(adapter,/opacity: folder \? group\.opacity : 1/);
  assert.match(main,/opacity:clamp\(Number\(sourceGroup\.opacity\?\?1\),0,1\)/);
  assert.match(main,/blendMode:sourceGroup\.blendMode\|\|'pass-through'/);
  assert.match(main,/opacity:clamp\(Number\(group\.opacity\?\?1\),0,1\)/);
});


test('PSD Color Management Stage 7f surfaces ICC metadata without pretending to color-convert',()=>{
  assert.match(adapter,/function parseImageResources\(/);
  assert.match(adapter,/id === 1039/);
  assert.match(adapter,/id === 1041/);
  assert.match(adapter,/iccProfile: imageResources\.iccProfile/);
  assert.match(main,/ICC profile обнаружен/);
  assert.match(main,/Canvas preview пока не выполняет явное ICC-преобразование/);
});
