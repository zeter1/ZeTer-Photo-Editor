import test from 'node:test';
import assert from 'node:assert/strict';
import { safeFilename } from '../src/core/io.js';

test('download filename stems cannot use Windows reserved device names, even with suffixes', () => {
  for (const reserved of [
    'CON', 'PrN', 'AUX', 'nul', 'COM1', 'com9', 'LPT1', 'lpt9',
    'CONIN$', 'CONOUT$', 'con.backup', 'com¹', 'COM²', 'lpt³.photo',
  ]) {
    assert.equal(safeFilename(reserved), `_${reserved}`, reserved);
    assert.ok(safeFilename(reserved).startsWith('_'), reserved);
  }
  assert.equal(`${safeFilename('CON')}.png`, '_CON.png');
  assert.equal(`${safeFilename('aux.txt')}.zpe`, '_aux.txt.zpe');
});

test('download filename stems remove forbidden characters but preserve ordinary Unicode', () => {
  assert.equal(safeFilename('Пейзаж 2026'), 'Пейзаж 2026');
  assert.equal(safeFilename('a/b:c'), 'a_b_c');
  assert.equal(safeFilename('a\0b\x1fc\x7fd'), 'a_b_c_d');
  assert.equal(safeFilename('  Работа.  '), 'Работа');
  assert.equal(safeFilename('...'), 'image');
  assert.equal(safeFilename('  '), 'image');
  assert.equal(safeFilename('CONcept'), 'CONcept');
  assert.equal(safeFilename('COM10'), 'COM10');
  assert.equal(safeFilename('LPT0'), 'LPT0');
});
