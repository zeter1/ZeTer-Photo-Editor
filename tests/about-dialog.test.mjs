import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('about dialog exposes developer contact links', () => {
  assert.match(mainSource, /href="mailto:zeter11@gmail\.com">zeter11@gmail\.com<\/a>/);
  assert.match(mainSource, /href="https:\/\/t\.me\/zeterchat" target="_blank" rel="noopener noreferrer">Telegram: @zeterchat<\/a>/);
  assert.match(mainSource, /href="https:\/\/github\.com\/zeter1" target="_blank" rel="noopener noreferrer">GitHub: @zeter1<\/a>/);
});
