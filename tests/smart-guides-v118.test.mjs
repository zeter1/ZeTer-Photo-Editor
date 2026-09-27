import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const transformCommands = await readFile(new URL('../src/layers/transform-command-controller.js', import.meta.url), 'utf8');
const transformGestures = await readFile(new URL('../src/interaction/layer-transform-gesture-controller.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const mark = await readFile(new URL('../assets/zeter-mark.svg', import.meta.url), 'utf8');

test('move tool exposes persisted smart snapping and six canvas alignment commands', () => {
  assert.match(html, /id="smartSnapToggle"/);
  for (const mode of ['left','hcenter','right','top','vcenter','bottom']) assert.match(html, new RegExp(`data-align="${mode}"`));
  assert.match(main, /SMART_SNAP_STORAGE_KEY/);
  assert.match(main, /readSmartSnapState\(\)/);
  assert.match(main, /persistSmartSnapState\(\)/);
  assert.match(main, /layerTransformCommandController\.align\(doc,l\.id,mode\)/);
  assert.match(transformCommands, /alignLayerToCanvas\(layer, mode, size\.width, size\.height\)/);
  for (const mode of ['left','hcenter','right','top','vcenter','bottom']) {
    assert.match(transformCommands, new RegExp('\\b' + mode + ": '"));
  }
});

test('move dragging supports smart guides, screen-space snap threshold, axis lock, and temporary Ctrl bypass', () => {
  assert.match(transformGestures, /if \(modifiers\.shiftKey\)/);
  assert.match(transformGestures, /lockedAxis = 'y'/);
  assert.match(transformGestures, /lockedAxis = 'x'/);
  assert.match(transformGestures, /lockedAxis === 'x' \? gesture\.baseline\.x : snappedX/);
  assert.match(transformGestures, /lockedAxis === 'y' \? gesture\.baseline\.y : snappedY/);
  assert.match(transformGestures, /runtime\.isSmartSnapEnabled\(\) && !modifiers\.ctrlKey && !modifiers\.metaKey/);
  assert.match(transformGestures, /threshold: 8 \/ zoom/);
  assert.match(transformGestures, /runtime\.visibleSnapTargetRects\(gesture\.owner, gesture\.layerId\)/);
  assert.match(transformGestures, /runtime\.setSmartGuides\(\{/);
  assert.match(transformGestures, /snapped\?\.guides\?\.x/);
  assert.match(transformGestures, /snapped\?\.guides\?\.y/);
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
