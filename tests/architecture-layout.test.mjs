import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [main, build, legacyPsd, legacyToolLayout, project, workspaceSessions, toolbarController, menuController] = await Promise.all([
  readFile(new URL('src/main.js', root), 'utf8'),
  readFile(new URL('tools/build-bundle.mjs', root), 'utf8'),
  readFile(new URL('src/adapters/psd.js', root), 'utf8'),
  readFile(new URL('src/core/tool-layout.js', root), 'utf8'),
  readFile(new URL('docs/PROJECT.md', root), 'utf8'),
  readFile(new URL('src/workspace/session-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/toolbar-controller.js', root), 'utf8'),
  readFile(new URL('src/ui/menu-controller.js', root), 'utf8'),
]);

test('canonical UI and PSD boundaries stay out of legacy compatibility paths', () => {
  assert.match(main, /from '\.\/ui\/tool-config\.js'/);
  assert.match(toolbarController, /from '\.\/tool-layout\.js'/);
  assert.match(main, /from '\.\/formats\/psd\.js'/);
  assert.doesNotMatch(main, /^const TOOL_LABELS\s*=/m);

  assert.match(build, /'src\/ui\/tool-config\.js'/);
  assert.match(build, /'src\/ui\/tool-layout\.js'/);
  assert.match(build, /'src\/formats\/psd\.js'/);
  assert.doesNotMatch(build, /'src\/adapters\/psd\.js'/);

  assert.match(legacyPsd, /export \* from '\.\.\/formats\/psd\.js'/);
  assert.match(legacyToolLayout, /export \* from '\.\.\/ui\/tool-layout\.js'/);
  assert.match(project, /src\/formats\/psd\.js/);
  assert.match(project, /src\/ui\/tool-config\.js/);
  assert.match(main, /from '\.\/workspace\/session-controller\.js'/);
  assert.match(build, /'src\/workspace\/session-controller\.js'/);
  assert.match(workspaceSessions, /export function createDocumentSessionController/);
  assert.doesNotMatch(main, /function renderDocumentTabs\(\)/);
  assert.match(main, /from '\.\/ui\/toolbar-controller\.js'/);
  assert.match(build, /'src\/ui\/toolbar-controller\.js'/);
  assert.match(toolbarController, /export function createToolbarController/);
  assert.doesNotMatch(main, /function initToolbarReorder\(\)/);
  assert.doesNotMatch(main, /function initTooltips\(\)/);
  assert.match(main, /from '\.\/ui\/menu-controller\.js'/);
  assert.match(build, /'src\/ui\/menu-controller\.js'/);
  assert.match(menuController, /export function createMenuController/);
  assert.match(main, /menuButtons: \\$\\$\\('\.menu-button'\\)/);
  assert.doesNotMatch(main, /function populateMenu\(/);
  assert.doesNotMatch(main, /function openMenu\(/);
  assert.doesNotMatch(main, /function openContextMenu\(/);
  assert.doesNotMatch(main, /let openMenuKey = null/);
});
