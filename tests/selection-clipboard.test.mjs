import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectionPixelBounds } from '../src/core/geometry.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('selectionPixelBounds keeps every touched pixel while clipping to the document', () => {
  assert.deepEqual(
    selectionPixelBounds({ x:10.2, y:20.7, width:5.1, height:8.1 }, 100, 80),
    { x:10, y:20, width:6, height:9 },
  );
  assert.deepEqual(
    selectionPixelBounds({ x:-3.4, y:75.2, width:12.1, height:10 }, 100, 80),
    { x:0, y:75, width:9, height:5 },
  );
  assert.equal(selectionPixelBounds({ x:100, y:10, width:5, height:5 }, 100, 80), null);
});

test('selection tool exposes merged and selected-layer clipboard modes', () => {
  assert.match(index, /id="selectionCopyMode"/);
  assert.match(index, /value="merged">Со всех видимых слоёв/);
  assert.match(index, /value="selected">С выбранного слоя/);
  assert.match(main, /let selectionCopyMode = 'merged'/);
  assert.match(main, /\.marquee-only/);
});

test('Ctrl+C and Ctrl+X are wired to image clipboard commands', () => {
  assert.match(main, /function copySelection\(\) \{ return copySelectionToClipboard\(\); \}/);
  assert.match(main, /function cutSelection\(\) \{ return copySelectionToClipboard\(\{cut:true\}\); \}/);
  assert.match(main, /if\(ctrl&&e\.code==='KeyC'\)/);
  assert.match(main, /if\(ctrl&&e\.code==='KeyX'\)/);
  assert.match(main, /\['Копировать выделение','Ctrl\+C',copySelection/);
  assert.match(main, /\['Вырезать выделение','Ctrl\+X',cutSelection/);
  assert.match(main, /window\.addEventListener\('copy'/);
  assert.match(main, /window\.addEventListener\('cut'/);
});

test('merged clipboard mode renders every visible layer and selected mode renders one layer', () => {
  assert.match(main, /async function renderSelectionMergedToPng\(bounds\)/);
  assert.match(main, /for\(const layer of doc\.layers\)/);
  assert.match(main, /if\(!isLayerVisible\(doc,layer\)\|\|layer\.opacity<=0\)continue/);
  assert.match(main, /selectionCopyMode==='merged'[\s\S]*renderSelectionMergedToPng\(bounds\)[\s\S]*renderSelectionLayerToPng\(layer,bounds\)/);
});

test('clipboard writes PNG before cut mutates raster pixels', () => {
  const start = main.indexOf('async function copySelectionToClipboard({ cut = false } = {}) {');
  const end = main.indexOf('\nfunction copySelection()', start);
  const fn = start >= 0 && end > start ? main.slice(start, end) : '';
  assert.match(fn, /new ClipboardItem\(\{'image\/png':pngPromise\}\)/);
  assert.match(fn, /await navigator\.clipboard\.write\(\[item\]\)/);
  assert.match(fn, /clearSelectionAcrossVisibleLayers/);
  assert.match(fn, /await clearSelectedPixels/);
  assert.ok(fn.indexOf('navigator.clipboard.write') < fn.indexOf('clearSelectionAcrossVisibleLayers'));
});


test('merged cut rasterizes editable text and shape layers instead of silently skipping them', () => {
  const start = main.indexOf('async function clearSelectionAcrossVisibleLayers(');
  const end = main.indexOf('\nfunction finishSelectionClipboardAction', start);
  const fn = start >= 0 && end > start ? main.slice(start, end) : '';
  assert.match(fn, /const targets=intersecting\.filter\(layer=>!isLayerLocked\(doc,layer\)\)/);
  assert.match(fn, /layer\.type==='raster' \? layer : await rasterizeLayerForPixelEditing\(layer\)/);
  assert.match(fn, /doc\.layers\.splice\(index,1,working\)/);
  assert.match(fn, /rasterized\+=1/);
  assert.doesNotMatch(fn, /nonRaster/);
});

test('successful copy or cut clears the marquee and switches to move for immediate paste positioning', () => {
  assert.match(main, /function finishSelectionClipboardAction\(message\) \{[\s\S]*clearSelectionState\(\);[\s\S]*setTool\('move'\)/);
  assert.match(main, /finishSelectionClipboardAction\(`Скопировано/);
  assert.match(main, /finishSelectionClipboardAction\(`Вырезано/);
});