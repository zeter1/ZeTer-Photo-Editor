import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkedCanvasSize, createDocument, sanitizeProject, MAX_CANVAS_PIXELS } from '../src/core/state.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const painting = await readFile(new URL('../src/painting/controller.js', import.meta.url), 'utf8');
const render = await readFile(new URL('../src/core/render.js', import.meta.url), 'utf8');
const modalController = await readFile(new URL('../src/ui/modal-controller.js', import.meta.url), 'utf8');
const documentImportController = await readFile(new URL('../src/document/import-controller.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('canvas allocation has a pixel budget in addition to per-axis bounds', () => {
  assert.ok(MAX_CANVAS_PIXELS > 10_000_000);
  assert.deepEqual(checkedCanvasSize(12000, 3000), { width: 12000, height: 3000, pixels: 36_000_000 });
  assert.throws(() => checkedCanvasSize(12000, 12000), /безопасный лимит/);
  assert.throws(() => createDocument({ width: 12000, height: 12000 }), /безопасный лимит/);
  assert.throws(() => sanitizeProject({version:1,width:12000,height:12000,layers:[]}), /безопасный лимит/);
});

test('new paint and blank layers stay sparse until pixels are actually drawn', () => {
  assert.doesNotMatch(main, /function blankRasterData/);
  const ensure = main.match(/async function ensurePaintLayer\(point, canContinue = \(\) => true\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(ensure, /dataUrl:null/);
  assert.doesNotMatch(ensure, /canvasToDataURL/);
  assert.match(main, /function addBlankLayer\(\)\{addLayer\(doc,createRasterLayer\(\{name:'Новый слой',width:doc\.width,height:doc\.height,dataUrl:null\}\)\)/);
});

test('drawing supports pen pressure while mouse width remains stable', () => {
  assert.match(main, /function brushWidthForPointer\(event\)/);
  assert.match(main, /event\?\.pointerType !== 'pen'/);
  assert.match(main, /rasterEdit\.brushContext\.lineWidth=brushWidthForPointer\(pointerEvent\)/);
  assert.match(main, /paintTo\(canvasPoint\(event, \{ clampToDocument:false \}\), event\)/);
});

test('brush size has layout-independent bracket shortcuts', () => {
  assert.match(main, /e\.code==='BracketLeft'\|\|e\.code==='BracketRight'/);
  assert.match(main, /adjustBrushSize\(e\.code==='BracketRight'\?1:-1,e\.shiftKey\)/);
});

test('checkerboard is presentation-only so the eyedropper reads actual document pixels', () => {
  assert.match(main, /renderDocument\(renderBuffer, previewDoc, \{ checker: false, rasterOverrides \}\)/);
  assert.match(css, /\.canvas-shell[^\n]*background-image:/);
  assert.match(main, /if\(pixel\[3\]===0\)\{setStatus\('Пипетка: прозрачный пиксель'\);return;\}/);
});

test('raster decode cache is bounded and corrupt embedded images do not reject the render pipeline', () => {
  assert.match(render, /const IMAGE_CACHE_LIMIT = 24/);
  assert.match(render, /while \(imageCache\.size > IMAGE_CACHE_LIMIT\)/);
  assert.match(render, /img\.onerror = \(\) => resolve\(null\)/);
  assert.match(render, /try \{[\s\S]*?\} finally \{[\s\S]*?ctx\.restore\(\)/);
});

test('multi-image import validates all inputs before changing document state', () => {
  const importFn = documentImportController.match(/async function importImages\(files,[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(importFn, /const prepared=\[\]/);
  assert.match(importFn, /checkedCanvasSize\(dimensions\.width,dimensions\.height/);
  assert.ok(importFn.indexOf('prepared.push') < importFn.indexOf('addLayer(doc'), 'all files should be prepared before the first layer mutation');
});


test('high zoom supports pixel inspection and a visible brush outline', () => {
  assert.match(main, /const value=clamp\(next,\.1,16\)/);
  assert.match(main, /zoom >= 4 \? 'pixelated' : 'auto'/);
  assert.match(main, /ctx\.ellipse\(hoverPoint\.x,hoverPoint\.y,radius\*scaleX,radius\*scaleY,rotation/);
  assert.match(main, /RASTER_BRUSH_TOOLS\.has\(currentTool\) \? 'none'/);
});

test('layer menu has center and fit-to-canvas transforms', () => {
  assert.match(main, /function centerSelectedLayer\(\)/);
  assert.match(main, /function fitSelectedLayerToCanvas\(\)/);
  assert.match(main, /'Центрировать слой на холсте'/);
  assert.match(main, /'Вписать слой в холст'/);
});


test('modal submissions await async work, surface failures, and restore focus', () => {
  const modal = modalController.match(/function showModal\(\{title,[^\n]*onSubmit,onMount=null\}\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(modal, /await onSubmit\?\.\(data,\(\)=>!closed&&modal\.isConnected\)/);
  assert.match(modal, /submit\.disabled=true/);
  assert.match(modal, /if\(result!==false\)close\(\)/);
  assert.match(modalController, /previousFocus instanceof HTMLElementClass/);
  assert.match(modal, /aria-modal/);
});

test('brush outline and painting stay bound to the selected visible raster layer', () => {
  const helper = main.match(/function paintLayerAtPoint\(point\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(helper, /const layer = selected\(\)/);
  assert.match(helper, /isEditableRasterLayer\(layer\) && isLayerVisible\(doc, layer\) && pointInLayer\(point, layer\) \? layer : null/);
  assert.match(main, /const paintLayer = paintLayerAtPoint\(hoverPoint\)/);
  assert.match(main, /const rasterAtPoint = paintLayerAtPoint\(point\)/);
});

test('manual raster dimensions cannot bypass the canvas pixel budget', () => {
  assert.match(main, /if \(l\.type === 'raster'\) \{[\s\S]*?checkedCanvasSize\(path === 'width' \? value : l\.width, path === 'height' \? value : l\.height/);
  assert.match(painting, /const paintSize = checkedCanvasSize\(layer\.width, layer\.height, `Растровый слой/);
  assert.match(painting, /const canvasWidth = paintSize\.width/);
  assert.match(painting, /const canvasHeight = paintSize\.height/);
});

test('rotation handle is clamped into the interactive canvas area at document edges', () => {
  const helper = main.match(/function interactiveRotationHandlePoint\(layer\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(helper, /rotationHandlePoint\(layer, 30 \/ zoom\)/);
  assert.match(helper, /x: clamp\(preferred\.x/);
  assert.match(helper, /y: clamp\(preferred\.y/);
  assert.ok((main.match(/interactiveRotationHandlePoint\(/g) ?? []).length >= 4, 'draw + hover + pointerdown should share the interactive handle point');
});