import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const bundle = await readFile(new URL('../src/app.bundle.js', import.meta.url), 'utf8');

test('index keeps a classic-script file:// startup path without ES module imports', () => {
  assert.match(index, /location\.protocol === 'file:'/);
  assert.match(index, /loadApp\(currentBuild, false\)/);
  assert.match(index, /document\.createElement\('script'\)/);
  assert.match(index, /'\.\/src\/app\.bundle\.js'/);
  assert.doesNotMatch(index, /type=["']module["']/);
});

test('browser bundle contains no static import/export syntax', () => {
  assert.doesNotMatch(bundle, /^\s*import\s/m);
  assert.doesNotMatch(bundle, /^\s*export\s/m);
  assert.match(bundle, /window\.__ZETER_BOOTED__=true/);
});