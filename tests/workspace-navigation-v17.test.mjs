import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('middle mouse and Space provide temporary canvas panning without changing tools', () => {
  assert.match(main, /function pointerWantsPan\(event\)[\s\S]*?event\.button === 1[\s\S]*?spaceHeld \|\| currentTool === 'hand'/);
  assert.match(main, /const wantsPan = pointerWantsPan\(e\)/);
  assert.match(main, /if \(e\.button === 1\) e\.preventDefault\(\)/);
  assert.match(main, /drag = \{ kind:'pan'/);
  assert.match(main, /auxclick[\s\S]*?e\.button === 1/);
});

test('canvas zoom supports professional keyboard and wheel navigation', () => {
  assert.match(main, /if\(!e\.ctrlKey&&!e\.altKey\)return/);
  assert.match(main, /ctrl&&e\.code==='Digit0'[\s\S]*?fitToView/);
  assert.match(main, /ctrl&&e\.code==='Digit1'[\s\S]*?setZoom\(1\)/);
  assert.match(main, /ctrl&&\(e\.code==='Equal'\|\|e\.code==='NumpadAdd'\)/);
  assert.match(main, /ctrl&&\(e\.code==='Minus'\|\|e\.code==='NumpadSubtract'\)/);
});

test('Tab canvas mode hides both side panels and preserves the viewed canvas point', () => {
  const fn = main.match(/function togglePanels\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(fn, /clientPointToCanvas/);
  assert.match(fn, /classList\.toggle\('panels-hidden'/);
  assert.match(fn, /scrollLeft \+=/);
  assert.match(fn, /scrollTop \+=/);
  assert.match(css, /\.workspace\.panels-hidden \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /\.workspace\.panels-hidden \.toolbar, \.workspace\.panels-hidden \.right-panel \{ display: none; \}/);
});

test('global single-key shortcuts do not steal keyboard activation from controls', () => {
  assert.match(main, /function isInteractiveControlTarget\(target = document\.activeElement\)/);
  assert.match(main, /if\(e\.code==='Space'&&!editing&&!interactive\)/);
  assert.match(main, /if\(interactive\)return;[\s\S]*?if\(e\.key==='Tab'/);
  assert.match(main, /window\.addEventListener\('blur',[\s\S]*?spaceHeld=false/);
});

test('layer list is keyboard navigable and supports F2 rename', () => {
  assert.match(main, /row\.tabIndex = layer\.id === doc\.selectedLayerId \? 0 : -1/);
  assert.match(main, /e\.key === 'ArrowUp' \|\| e\.key === 'ArrowDown'/);
  assert.match(main, /e\.key === 'Home' \|\| e\.key === 'End'/);
  assert.match(main, /e\.key === 'Enter' \|\| e\.code === 'F2'/);
  assert.match(main, /if\(e\.code==='F2'\)[\s\S]*?renameLayer/);
  assert.match(css, /\.layer-row:focus-visible/);
});
test('smart snapping keeps explicit runtime state after workspace refactors', () => {
  assert.match(main, /let smartSnapEnabled = true;/);
  assert.match(main, /let smartGuides = \{ x:null, y:null \};/);
  assert.match(main, /function readSmartSnapState\(\)[\s\S]*?smartSnapEnabled = saved === null \? true : saved !== 'false'/);
  assert.match(main, /if \(smartSnapEnabled && !e\.ctrlKey && !e\.metaKey\)/);
});
