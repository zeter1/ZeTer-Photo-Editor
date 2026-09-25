import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeToolOrder, moveToolInOrder } from '../src/core/tool-layout.js';

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
