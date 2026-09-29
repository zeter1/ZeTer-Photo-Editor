import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('history navigation composition routes runtime commands through the workspace owner', async () => {
  const [main, controller, build] = await Promise.all([
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/workspace/history-navigation-controller.js', root), 'utf8'),
    readFile(new URL('tools/build-bundle.mjs', root), 'utf8'),
  ]);

  assert.match(main, /from '\.\/workspace\/history-navigation-controller\.js'/);
  assert.match(main, /createHistoryNavigationController\(\{/);
  assert.match(main, /getHistory:\s*\(\)\s*=>\s*history/);
  assert.match(main, /setDocument:\s*value\s*=>\s*\{\s*doc\s*=\s*value;?\s*\}/);
  assert.match(main, /const \{ undo, redo, jumpToHistory \} = historyNavigationController;/);

  assert.doesNotMatch(main, /function undo\s*\(/);
  assert.doesNotMatch(main, /function redo\s*\(/);
  assert.doesNotMatch(main, /function jumpToHistory\s*\(/);

  assert.match(main, /row\.onclick\s*=\s*\(\)\s*=>\s*jumpToHistory\(index\)/);
  assert.match(main, /\['Отменить','Ctrl\+Z',undo,/);
  assert.match(main, /\['Повторить','Ctrl\+Y',redo,/);
  assert.match(main, /els\.undo\.onclick=undo;els\.redo\.onclick=redo/);
  assert.match(main, /e\.shiftKey\?redo\(\):undo\(\)/);
  assert.match(main, /e\.code==='KeyY'\)\{e\.preventDefault\(\);redo\(\);return;\}/);

  assert.match(controller, /getHistory\(\)/);
  assert.doesNotMatch(controller, /HistoryStack/);

  const ownerPath = "'src/workspace/history-navigation-controller.js'";
  const mainPath = "'src/main.js'";
  assert.match(build, /'src\/workspace\/history-navigation-controller\.js'/);
  assert.ok(
    build.indexOf(ownerPath) < build.indexOf(mainPath),
    'file bundle initializes history-navigation owner before main.js',
  );
});
