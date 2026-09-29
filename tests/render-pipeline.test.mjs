import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const render = await readFile(new URL('../src/core/render.js', import.meta.url), 'utf8');
const layerTransformGestureController = await readFile(new URL('../src/interaction/layer-transform-gesture-controller.js', import.meta.url), 'utf8');

test('full renders are serialized and only the latest completed frame reaches the visible canvas', () => {
  assert.match(main, /let renderBusy = false/);
  assert.match(main, /let renderPending = null/);
  assert.match(main, /const renderBuffer = document\.createElement\('canvas'\)/);
  assert.match(main, /const previewDoc = textEditController\.documentWithPreview\(doc\)/);
  assert.match(main, /await renderDocument\(renderBuffer, previewDoc/);
  assert.match(main, /if \(request\.version !== renderVersion\) return/);
  assert.doesNotMatch(main, /await renderDocument\(els\.canvas, doc/);
});

test('full render respects effective group visibility', () => {
  assert.match(render, /isLayerVisible\(doc, layer\)/);
});

test('Stage 8e renders nested group opacity and blend through isolated canvases', () => {
  assert.match(render, /function buildGroupRenderPlan\(doc\)/);
  assert.match(render, /async function renderGroupHierarchy\(/);
  assert.match(render, /const isolated = blendMode !== 'pass-through' \|\| opacity < 1 - 1e-9/);
  assert.match(render, /targetCtx\.globalAlpha = opacity/);
  assert.match(render, /targetCtx\.globalCompositeOperation = blendMode === 'pass-through' \? 'source-over' : blendMode/);
  assert.match(render, /await renderEntries\(targetCanvas, targetCtx, group\.id\)/);
});

test('scaled raster rendering requests high-quality image smoothing', () => {
  assert.match(render, /ctx\.imageSmoothingEnabled = true/);
  assert.match(render, /ctx\.imageSmoothingQuality = 'high'/);
});

test('resize interaction calculates every pointer move from the captured transform baseline', () => {
  assert.match(layerTransformGestureController, /function numericBaseline\(layer\)/);
  assert.match(layerTransformGestureController, /width: finiteNumber\(layer\.width\) \?\? 1/);
  assert.match(layerTransformGestureController, /scaleX: finiteNumber\(layer\.scaleX\) \?\? 1/);
  assert.match(layerTransformGestureController, /rotation: finiteNumber\(layer\.rotation\) \?\? 0/);
  assert.match(layerTransformGestureController, /resizeLayerFromPoint\([\s\S]*?\{ \.\.\.layer, \.\.\.gesture\.baseline \}/);
});

test('render pipeline treats adjustment layers as cumulative stack operations and supports clipping masks', () => {
  assert.match(render, /layer\.type === 'adjustment'/);
  assert.match(render, /applyAdjustmentLayer\(canvas, ctx, layer, \{ clippingMask \}\)/);
  assert.match(render, /sourceCtx\.drawImage\(canvas, 0, 0, width, height\)/);
  assert.match(render, /sourceCtx\.drawImage\(clippingMask,0,0,width,height\)/);
});

test('layer masks isolate content and route professional controls through the canonical alpha pipeline', () => {
  assert.match(render, /const hasRasterMask=Boolean\(layer\.mask && layer\.mask\.enabled !== false/);
  assert.match(render, /applyLayerMaskToContext/);
  assert.match(render, /applyMaskControlsAlpha/);
  assert.match(render, /globalCompositeOperation = 'destination-in'/);
  assert.match(render, /mask: null/);
});

test('Stage 10 vector masks share the isolated mask pipeline and support boolean subpaths',()=>{
  assert.match(render,/function renderVectorMaskBitmap\(vectorMask, width, height\)/);
  assert.match(render,/operation==='subtract'[\s\S]*'destination-out'/);
  assert.match(render,/operation==='intersect'[\s\S]*'destination-in'/);
  assert.match(render,/operation==='exclude'[\s\S]*'xor'/);
  assert.match(render,/vectorMask: null/);
  assert.match(render,/renderVectorMaskBitmap\(layer\.vectorMask,masked\.width,masked\.height\)/);
});


test('smart objects render from preview data without mutating embedded document state', () => {
  assert.match(render, /layer\.type === 'smart-object' && layer\.previewDataUrl/);
  assert.match(render, /layer\.type === 'smart-object' \? layer\.previewDataUrl : layer\.dataUrl/);
});


test('adjustment rendering preserves alpha through the pixel compositor', () => {
  assert.match(render, /compositeAdjustmentPixels\(basePixels,effectPixels/);
  assert.match(render, /ctx\.putImageData\(basePixels,0,0\)/);
  assert.doesNotMatch(render, /ctx\.globalAlpha = layer\.opacity \?\? 1;[\s\S]{0,180}ctx\.drawImage\(source, 0, 0, width, height\)/);
});

test('checkerboard is composited behind transparent document content after adjustments', () => {
  assert.match(render, /const needsCheckerBackdrop=checker&&doc\.background==='transparent'/);
  assert.match(render, /await renderGroupHierarchy\(contentCanvas, contentCtx, doc, rasterOverrides\)/);
  assert.match(render, /drawChecker\(ctx,doc\.width,doc\.height\)/);
  assert.match(render, /ctx\.drawImage\(contentCanvas,0,0\)/);
});
