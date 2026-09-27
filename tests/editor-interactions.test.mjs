import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const textEditController=fs.readFileSync(new URL('../src/ui/text-edit-controller.js',import.meta.url),'utf8');
const layerTransformGestureController=fs.readFileSync(new URL('../src/interaction/layer-transform-gesture-controller.js',import.meta.url),'utf8');

test('resize interaction supports Alt-from-center and Shift aspect locking',()=>{
  assert.match(layerTransformGestureController,/lockAspect:\s*Boolean\(modifiers\.shiftKey\)/);
  assert.match(layerTransformGestureController,/fromCenter:\s*Boolean\(modifiers\.altKey\)/);
});

test('shape interaction constrains preview and committed geometry with Shift',()=>{
  assert.match(main,/constrainedRect\(drag\.start,p,e\.shiftKey\)/);
  assert.match(main,/constrainedRect\(d\.start,d\.current,e\.shiftKey\|\|d\.lockAspect\)/);
});

test('text tool edits an existing visible text layer instead of always creating a new one',()=>{
  assert.match(main,/textEditController\.open\(p\)/);
  assert.match(textEditController,/export function topVisibleTextLayerAt\(documentValue, point\)/);
  assert.match(textEditController,/title: 'Редактировать текст'/);
  assert.match(textEditController,/commit\('Редактировать текст'\)/);
  assert.match(textEditController,/isLayerLocked\(owner, existing\)/);
});