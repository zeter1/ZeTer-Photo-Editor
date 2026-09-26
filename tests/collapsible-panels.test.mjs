import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const toolConfig = await readFile(new URL('../src/ui/tool-config.js', import.meta.url), 'utf8');
const workspaceLayout = await readFile(new URL('../src/ui/workspace-layout-controller.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

const advancedKeys = [
  'exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'temperature',
  'tint', 'saturate', 'vibrance', 'hue', 'gamma',
];

test('all color-correction sliders are rendered in the dedicated color and effects sidebar panel', () => {
  assert.match(toolConfig, /export const RASTER_EFFECT_CONTROLS = \[/);
  assert.match(toolConfig, /\.\.\.COLOR_CORRECTION_CONTROLS/);
  assert.match(main, /function updateEffectsPanel\(\)/);
  assert.match(main, /renderEffectControls\(l\)/);
  for (const key of advancedKeys) assert.match(toolConfig, new RegExp(`key:'${key}'`));
  assert.match(toolConfig, /key:'blur'.*group:'Эффекты'/);
  assert.match(html, /data-panel-id="effects"/);
  assert.match(html, /id="effectsContent"/);
  assert.match(html, /id="resetColorEffectsBtn"/);
});

test('right sidebar cards expose persistent accessible collapse toggles', () => {
  for (const id of ['properties', 'effects', 'layers', 'paths', 'history']) {
    assert.match(html, new RegExp(`data-panel-id="${id}"`));
  }
  assert.equal((html.match(/class="panel-toggle"/g) || []).length, 5);
  assert.match(workspaceLayout, /export function createWorkspaceLayoutController/);
  assert.match(workspaceLayout, /function initCollapsiblePanels\(\)/);
  assert.match(workspaceLayout, /UI_COLLAPSE_STORAGE_KEY/);
  assert.match(workspaceLayout, /aria-expanded/);
  assert.doesNotMatch(main, /function initCollapsiblePanels\(\)/);
  assert.match(css, /\.panel-card\.is-collapsed > :not\(header\)/);
});

test('legacy nested color section state migrates to the dedicated effects panel', () => {
  assert.doesNotMatch(main, /function setPropertySectionCollapsed\(section, collapsed\)/);
  assert.match(workspaceLayout, /parsed\.propertySections/);
  assert.match(workspaceLayout, /collapsedPanelIds\.add\('effects'\)/);
});