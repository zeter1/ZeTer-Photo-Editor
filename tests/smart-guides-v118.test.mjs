import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const mark = await readFile(new URL('../assets/zeter-mark.svg', import.meta.url), 'utf8');

test('move tool exposes persisted smart snapping and six canvas alignment commands', () => {
  assert.match(html, /id="smartSnapToggle"/);
  for (const mode of ['left','hcenter','right','top','vcenter','bottom']) assert.match(html, new RegExp(`data-align="${mode}"`));
  assert.match(main, /SMART_SNAP_STORAGE_KEY/);
  assert.match(main, /readSmartSnapState\(\)/);
  assert.match(main, /persistSmartSnapState\(\)/);
  assert.match(main, /alignLayerToCanvas\(l,mode,doc\.width,doc\.height\)/);
});

test('move dragging supports smart guides, screen-space snap threshold, axis lock, and temporary Ctrl bypass', () => {
  const move = main.match(/if \(drag\.kind === 'move'\) \{[\s\S]*?drawOverlay\(\); return;\n  \}/)?.[0] ?? '';
  assert.match(move, /if \(e\.shiftKey\)/);
  assert.match(move, /lockedAxis = 'y'/);
  assert.match(move, /lockedAxis = 'x'/);
  assert.match(move, /lockedAxis === 'x' \? drag\.x : snapped\.x/);
  assert.match(move, /lockedAxis === 'y' \? drag\.y : snapped\.y/);
  assert.match(move, /smartSnapEnabled && !e\.ctrlKey && !e\.metaKey/);
  assert.match(move, /threshold: 8 \/ zoom/);
  assert.match(move, /visibleSnapTargetRects\(l\.id\)/);
  assert.match(move, /smartGuides = \{/);
  assert.match(move, /snapped\.guides\.x/);
  assert.match(move, /snapped\.guides\.y/);
  assert.match(main, /strokeStyle = '#ff61d8'/);
  assert.match(main, /smartGuides\.x !== null/);
  assert.match(main, /smartGuides\.y !== null/);
});

test('toolbar uses consistent vector icon assets instead of platform-dependent emoji glyphs', () => {
  assert.match(html, /class="tool-icon"/);
  assert.match(html, /assets\/zeter-mark\.svg/);
  assert.doesNotMatch(html, /🖌|✋|🔍|🩹|🪣/u);
  assert.match(css, /\.ui-icon, \.tool-icon/);
  assert.match(css, /\.option-icon-button:focus-visible/);
  assert.match(mark, /<svg[\s\S]*?<path/);
});