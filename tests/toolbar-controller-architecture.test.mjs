import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const controller = await readFile(new URL('../src/ui/toolbar-controller.js', import.meta.url), 'utf8');
const build = await readFile(new URL('../tools/build-bundle.mjs', import.meta.url), 'utf8');
const codemap = await readFile(new URL('../docs/architecture/CODEMAP.md', import.meta.url), 'utf8');

test('toolbar DOM state has a dedicated controller owner', () => {
  assert.match(main, /createToolbarController/);
  assert.match(main, /toolbarUi\.initReorder\(\)/);
  assert.match(main, /toolbarUi\.initTooltips\(\)/);
  assert.match(main, /toolbarUi\.isClickSuppressed\(\)/);
  assert.doesNotMatch(main, /let toolbarDragToolId/);
  assert.doesNotMatch(main, /function toolbarGridMetrics\(/);
  assert.doesNotMatch(main, /function initToolbarReorder\(/);
  assert.doesNotMatch(main, /function initTooltips\(/);

  assert.match(controller, /export function createToolbarController/);
  assert.match(controller, /localStorage\.setItem\(TOOL_ORDER_STORAGE_KEY/);
  assert.match(controller, /gridCellIndexFromPoint/);
  assert.match(controller, /button\.removeAttribute\('title'\)/);
});

test('bundle and architecture docs recognize toolbar controller as canonical UI code', () => {
  const configIndex = build.indexOf("'src/ui/tool-config.js'");
  const controllerIndex = build.indexOf("'src/ui/toolbar-controller.js'");
  const mainIndex = build.indexOf("'src/main.js'");
  assert.ok(configIndex >= 0);
  assert.ok(controllerIndex > configIndex);
  assert.ok(mainIndex > controllerIndex);
  assert.match(codemap, /toolbar-controller\.js/);
  assert.match(codemap, /does \*\*not\*\* own active tool or document\/layer state/);
});
