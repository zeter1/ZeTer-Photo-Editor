import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pointInSelection, selectionBounds, selectionPathPoints } from '../src/core/geometry.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const selectionGestures = await readFile(new URL('../src/selection/gesture-controller.js', import.meta.url), 'utf8');
const clipboard = await readFile(new URL('../src/selection/clipboard-controller.js', import.meta.url), 'utf8');
const toolConfig = await readFile(new URL('../src/ui/tool-config.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('selection geometry supports rectangle, ellipse, free lasso and polygonal lasso', () => {
  const rect = { type:'rect', rect:{x:10,y:10,width:20,height:12} };
  const ellipse = { type:'ellipse', rect:{x:0,y:0,width:20,height:10} };
  const lasso = { type:'lasso', points:[{x:0,y:0},{x:12,y:0},{x:6,y:10}] };
  const polygon = { type:'polygon', points:[{x:2,y:2},{x:10,y:2},{x:10,y:8},{x:2,y:8}] };

  assert.equal(pointInSelection({x:15,y:15}, rect), true);
  assert.equal(pointInSelection({x:5,y:5}, rect), false);
  assert.equal(pointInSelection({x:10,y:5}, ellipse), true);
  assert.equal(pointInSelection({x:0,y:0}, ellipse), false);
  assert.equal(pointInSelection({x:6,y:4}, lasso), true);
  assert.equal(pointInSelection({x:11,y:9}, lasso), false);
  assert.equal(pointInSelection({x:5,y:5}, polygon), true);
  assert.deepEqual(selectionBounds(lasso), {x:0,y:0,width:12,height:10});
  assert.ok(selectionPathPoints(ellipse, 24).length >= 24);
});

test('selection toolbar exposes all four selection types and Shift+M cycling', () => {
  assert.match(index, /id="selectionType"/);
  assert.match(index, /value="rect">Прямоугольное/);
  assert.match(index, /value="ellipse">Эллиптическое/);
  assert.match(index, /value="lasso">Свободное лассо/);
  assert.match(index, /value="polygon">Многоугольное лассо/);
  assert.match(toolConfig, /export const SELECTION_TYPE_LABELS = \{ rect:'Прямоугольное выделение', ellipse:'Эллиптическое выделение', lasso:'Свободное лассо', polygon:'Многоугольное лассо' \}/);
  assert.match(selectionGestures, /function cycleType\(\)/);
  assert.match(main, /e\.shiftKey&&e\.code==='KeyM'[\s\S]*selectionGestures\.cycleType\(\)/);
});

test('non-rectangular selections clip copy, raster editing and fill through the same selection shape', () => {
  assert.match(main, /function clipContextToDocumentSelection\(ctx\)/);
  assert.match(clipboard, /renderSelectionLayerToPng[\s\S]*clipContextToDocumentSelection\(ctx\)/);
  assert.match(clipboard, /renderSelectionMergedToPng[\s\S]*clipContextToDocumentSelection\(ctx\)/);
  assert.match(main, /function selectionPolygonForLayer\(layer, shape = selectionShape\)[\s\S]*selectionPathPoints\(shape, 72\)/);
  assert.match(main, /function rasterSelectionPredicate\(layer\)[\s\S]*pointInsideSelection/);
});

test('polygonal lasso lifecycle lives in the selection gesture controller while keyboard routing stays global', () => {
  assert.match(selectionGestures, /function beginMarquee\(/);
  assert.match(selectionGestures, /polygonDraft = \{ points:/);
  assert.match(selectionGestures, /detail >= 2/);
  assert.match(selectionGestures, /function finishPolygonSelection\(/);
  assert.match(main, /selectionGestures\.hasPolygonDraft\(\).*currentTool==='marquee'/);
  assert.match(main, /selectionGestures\.finishPolygonSelection\(\)/);
  assert.match(main, /selectionGestures\.cancelPolygonDraft\(/);
});