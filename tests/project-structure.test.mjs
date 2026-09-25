import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

test('runtime bundle declares extracted config and toolbar owners before main', () => {
  const build = read('tools/build-bundle.mjs');
  const config = build.indexOf("'src/config/editor.js'");
  const toolbar = build.indexOf("'src/ui/toolbar.js'");
  const main = build.indexOf("'src/main.js'");
  assert.ok(config >= 0, 'editor config must be part of the browser bundle');
  assert.ok(toolbar > config, 'toolbar UI must be bundled after static config');
  assert.ok(main > toolbar, 'composition root must be bundled after extracted UI modules');
});

test('main composition root delegates toolbar UI instead of owning toolbar internals', () => {
  const main = read('src/main.js');
  assert.match(main, /from '\.\/config\/editor\.js'/);
  assert.match(main, /from '\.\/ui\/toolbar\.js'/);
  assert.match(main, /createToolbarController/);
  assert.match(main, /toolbarUi\.initReorder\(\)/);
  assert.match(main, /toolbarUi\.initTooltips\(\)/);
  assert.doesNotMatch(main, /function toolbarGridMetrics\(/);
  assert.doesNotMatch(main, /function initToolbarReorder\(/);
});

test('AI entrypoints route to source owners and warn against generated bundle editing', () => {
  const agents = read('AGENTS.md');
  const start = read('docs/ai/START-HERE.md');
  const project = read('docs/PROJECT.md');
  const moduleMap = read('docs/architecture/MODULE-MAP.md');
  assert.match(agents, /docs\/ai\/START-HERE\.md/);
  assert.match(agents, /app\.bundle\.js.*генерируем/i);
  assert.match(start, /src\/app\.bundle\.js/);
  assert.match(start, /src\/ui\/toolbar\.js/);
  assert.match(project, /src\/config\//);
  assert.match(project, /src\/ui\//);
  assert.match(moduleMap, /Composition root/);
});
