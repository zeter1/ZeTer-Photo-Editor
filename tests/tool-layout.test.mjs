import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeToolOrder, moveToolInOrder, moveToolToIndex, gridCellIndexFromPoint } from '../src/core/tool-layout.js';

test('sanitizeToolOrder restores valid saved IDs and appends newly available tools', () => {
  assert.deepEqual(
    sanitizeToolOrder(['brush', 'ghost', 'move', 'brush'], ['move', 'brush', 'zoom']),
    ['brush', 'move', 'zoom'],
  );
  assert.deepEqual(sanitizeToolOrder(null, ['move', 'brush']), ['move', 'brush']);
});

test('moveToolInOrder moves a tool before or after any target', () => {
  const order = ['move', 'brush', 'zoom', 'hand'];
  assert.deepEqual(moveToolInOrder(order, 'hand', 'brush', false), ['move', 'hand', 'brush', 'zoom']);
  assert.deepEqual(moveToolInOrder(order, 'move', 'zoom', true), ['brush', 'zoom', 'move', 'hand']);
  assert.deepEqual(moveToolInOrder(order, 'brush', null, true), ['move', 'zoom', 'hand', 'brush']);
});

test('moveToolInOrder is stable for self/unknown drags', () => {
  const order = ['move', 'brush', 'zoom'];
  assert.deepEqual(moveToolInOrder(order, 'brush', 'brush', true), order);
  assert.deepEqual(moveToolInOrder(order, 'missing', 'brush', false), order);
});

test('moveToolToIndex places the dragged tool into the exact grid slot', () => {
  const order = ['move', 'marquee', 'brush', 'zoom'];
  assert.deepEqual(moveToolToIndex(order, 'zoom', 1), ['move', 'zoom', 'marquee', 'brush']);
  assert.deepEqual(moveToolToIndex(order, 'move', 3), ['marquee', 'brush', 'zoom', 'move']);
});

test('gridCellIndexFromPoint maps toolbar gaps to the nearest real grid slot', () => {
  const layout = {
    left: 7,
    top: 7,
    columns: 2,
    cellWidth: 36,
    cellHeight: 40,
    columnGap: 4,
    rowGap: 4,
    maxIndex: 7,
  };
  assert.equal(gridCellIndexFromPoint({ x:45, y:27 }, layout), 1);
  assert.equal(gridCellIndexFromPoint({ x:25, y:71 }, layout), 2);
  assert.equal(gridCellIndexFromPoint({ x:65, y:71 }, layout), 3);
});
