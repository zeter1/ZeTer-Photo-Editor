import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const bundle = await readFile(new URL('../src/app.bundle.js', import.meta.url), 'utf8');

test('index uses classic bundle so direct file:// opening does not depend on ES module imports', () => {
  assert.match(index, /<script\s+src="\.\/src\/app\.bundle\.js"\s+defer><\/script>/);
  assert.doesNotMatch(index, /type=["']module["']/);
});

test('browser bundle contains no static import/export syntax', () => {
  assert.doesNotMatch(bundle, /^\s*import\s/m);
  assert.doesNotMatch(bundle, /^\s*export\s/m);
  assert.match(bundle, /window\.__ZETER_BOOTED__=true/);
});