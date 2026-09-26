import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const gesture = await readFile(new URL('../src/painting/gesture-controller.js', import.meta.url), 'utf8');
const retouch = await readFile(new URL('../src/retouch/controller.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('clone, dodge and burn are first-class tools with vector icons and shortcuts', () => {
  for (const tool of ['clone','dodge','burn']) assert.match(html, new RegExp(`data-tool="${tool}"`));
  for (const icon of ['clone','dodge','burn']) assert.match(html, new RegExp(`id="icon-${icon}"`));
  assert.match(main, /KeyS:'clone'/);
  assert.match(main, /KeyO:'dodge'/);
  assert.match(main, /e\.shiftKey&&e\.code==='KeyO'.*setTool\('burn'\)/);
});

test('clone stamp requires Alt-click source and paints from an immutable stroke snapshot', () => {
  assert.match(main, /currentTool === 'clone' \|\| currentTool === 'heal'\) && e\.altKey/);
  assert.match(main, /async function setCloneSource\(point\)/);
  assert.match(main, /setRetouchCloneSource\(\{layerId:layer\.id/);
  assert.match(retouch, /function prepareCloneStroke\(layer, destinationPoint\)/);
  assert.match(retouch, /cloneSnapshotCanvas\.getContext\('2d'/);
  assert.match(retouch, /function cloneStrokeSegment\(from, to, offset, pointerEvent = null, healing = false\)/);
  assert.match(main, /clipContext: clipContextToSelection/);
  assert.match(gesture, /selection\?\.clipContext\?\.\(context, layer\)/);
});

test('retouch tools edit only an existing raster layer and keep dedicated history labels', () => {
  const ensurePaintLayer = gesture.match(/async function ensurePaintLayer\(point, tool, canContinue = \(\) => true\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(ensurePaintLayer, /EXISTING_RASTER_ONLY_TOOLS\.has\(tool\)/);
  assert.match(gesture, /clone:'Штамп',[\s\S]*?heal:'Лечебная кисть',[\s\S]*?smudge:'Палец \/ смазывание',[\s\S]*?dodge:'Осветлитель',[\s\S]*?burn:'Затемнитель'/);
  assert.match(retouch, /function applyToneDab\(layer, point, pointerEvent = null, brighten = true\)/);
  assert.match(retouch, /applyToneBrushPixels\(/);
  assert.doesNotMatch(main, /currentTool==='dodge'\?'#ffffff':currentTool==='burn'\?'#000000'/);
});

test('destructive raster tools keep editing bound to the selected visible layer', () => {
  const targetResolver = main.match(/function paintLayerAtPoint\(point\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(targetResolver, /const layer = selected\(\)/);
  assert.match(targetResolver, /isLayerVisible\(doc, layer\)/);
  assert.doesNotMatch(targetResolver, /findTopEditableRasterLayerAt/);
  assert.match(main, /const layer=findTopEditableRasterLayerAt\(point\)/);
});

test('retouch dabs use feathered masks and magnetic lasso traces intermediate edge points', () => {
  assert.match(retouch, /function applyFeatherMask\(ctx, centerX, centerY, radius\)/);
  assert.match(retouch, /applyFeatherMask\(scratchCtx, point\.x-left, point\.y-top, radius\)/);
  assert.match(main, /function magneticSegmentPoints\(from,to\)/);
  assert.match(main, /magneticDraft\.points\.push\(\.\.\.magneticSegmentPoints\(last,snapped\)\)/);
});