import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('resize interaction supports Alt-from-center and Shift aspect locking',()=>{
  assert.match(main,/resizeLayerFromPoint\([\s\S]*?lockAspect:\s*e\.shiftKey,[\s\S]*?fromCenter:\s*e\.altKey/);
});

test('shape interaction constrains preview and committed geometry with Shift',()=>{
  assert.match(main,/constrainedRect\(drag\.start,p,e\.shiftKey\)/);
  assert.match(main,/constrainedRect\(d\.start,d\.current,e\.shiftKey\|\|d\.lockAspect\)/);
});

test('text tool edits an existing visible text layer instead of always creating a new one',()=>{
  assert.match(main,/function topTextLayerAt\(point\)/);
  assert.match(main,/title:'Редактировать текст'/);
  assert.match(main,/commit\('Редактировать текст'\)/);
  assert.match(main,/isLayerLocked\(doc,existing\)/);
});