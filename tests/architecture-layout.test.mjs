import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [main, build, legacyPsd, legacyToolLayout, project, workspaceSessions] = await Promise.all([
  readFile(new URL('src/main.js', root), 'utf8'),
  readFile(new URL('tools/build-bundle.mjs', root), 'utf8'),
  readFile(new URL('src/adapters/psd.js', root), 'utf8'),
  readFile(new URL('src/core/tool-layout.js', root), 'utf8'),
  readFile(new URL('docs/PROJECT.md', root), 'utf8'),
  readFile(new URL('src/workspace/session-controller.js', root), 'utf8'),
]);

test('canonical UI and PSD boundaries stay out of legacy compatibility paths', () => {
  assert.match(main, /from '\.\/ui\/tool-config\.js'/);
  assert.match(main, /from '\.\/ui\/tool-layout\.js'/);
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
});
