import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('history navigation and panel composition route through their narrow owners', async () => {
  const [main, navigationController, panelController, build] = await Promise.all([
    readFile(new URL('src/main.js', root), 'utf8'),
    readFile(new URL('src/workspace/history-navigation-controller.js', root), 'utf8'),
    readFile(new URL('src/ui/history-panel-controller.js', root), 'utf8'),
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

  assert.match(main, /from '\.\/ui\/history-panel-controller\.js'/);
  assert.match(main, /createHistoryPanelController\(\{/);
  assert.match(main, /container:\s*els\.history/);
  assert.match(main, /state:\s*\{\s*getHistory:\s*\(\)\s*=>\s*history\s*\}/);
  assert.match(main, /commands:\s*\{\s*jumpToHistory\s*\}/);
  assert.match(main, /historyPanelController\.render\(\)/);
  assert.doesNotMatch(main, /function updateHistory\s*\(/);

  assert.match(main, /\['Отменить','Ctrl\+Z',undo,/);
  assert.match(main, /\['Повторить','Ctrl\+Y',redo,/);
  assert.match(main, /els\.undo\.onclick=undo;els\.redo\.onclick=redo/);
  assert.match(main, /e\.shiftKey\?redo\(\):undo\(\)/);
  assert.match(main, /e\.code==='KeyY'\)\{e\.preventDefault\(\);redo\(\);return;\}/);

  assert.match(navigationController, /getHistory\(\)/);
  assert.doesNotMatch(navigationController, /new\s+HistoryStack|from ['"].*core\/history/);

  assert.match(panelController, /state\.getHistory\(\)/);
  assert.match(panelController, /commands\.jumpToHistory\(index\)/);
  assert.match(panelController, /row\.disabled\s*=\s*current/);
  assert.doesNotMatch(
    panelController,
    /restoreDocument|markDirty|updateAll|setStatus|new\s+HistoryStack|history\.(?:undo|redo|jump)\s*\(/,
  );

  const navigationOwnerPath = "'src/workspace/history-navigation-controller.js'";
  const panelOwnerPath = "'src/ui/history-panel-controller.js'";
  const mainPath = "'src/main.js'";
  assert.match(build, /'src\/workspace\/history-navigation-controller\.js'/);
  assert.match(build, /'src\/ui\/history-panel-controller\.js'/);
  assert.ok(
    build.indexOf(navigationOwnerPath) < build.indexOf(mainPath),
    'file bundle initializes history-navigation owner before main.js',
  );
  assert.ok(
    build.indexOf(panelOwnerPath) < build.indexOf(mainPath),
    'file bundle initializes history-panel owner before main.js',
  );
});
