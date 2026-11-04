import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStack } from '../src/core/history.js';

test('003W/2b-2a: ASCII native tile snapshots retain one byte per char and allow Undo', () => {
  const stack = new HistoryStack(80,128);
  const initial='data:application/x-zeter-pixel-buffer-tile;base64,'+'A'.repeat(14);
  const edited='data:application/x-zeter-pixel-buffer-tile;base64,'+'B'.repeat(14);
  assert.equal(initial.length,64);
  assert.equal(stack.snapshotBytes(initial),64);
  stack.reset('initial',initial);
  stack.push('tiled Fill',edited);
  assert.equal(stack.entries.length,2);
  assert.equal(stack.totalBytes(),128);
  assert.equal(stack.canUndo(),true);
});

test('003W/2b-2a: compact ASCII Undo with an exact bounded history budget', () => {
  const stack=new HistoryStack(80,128);
  const source='data:application/x-zeter-pixel-buffer-tile;base64,'+'A'.repeat(14);
  const changed=source.replace(/A/g,'B');
  stack.reset('initial',source);
  stack.push('native Fill',changed);
  assert.equal(stack.totalBytes(),128);
  assert.equal(stack.canUndo(),true,'two ASCII native snapshots fit the same byte budget');
  assert.equal(stack.undo().snapshot,source);
  assert.equal(stack.redo().snapshot,changed);
});
test('003W/2b-2a: two-byte Unicode strings still evict to the configured cap',()=>{
  const history=new HistoryStack(80,120);
  assert.equal(history.snapshotBytes('Ж'.repeat(40)),80);
  history.reset('initial','Ж'.repeat(40));
  history.push('wide snapshot','Я'.repeat(40));
  assert.equal(history.entries.length,1,'160 wide bytes must not be miscounted as 80');
  assert.equal(history.canUndo(),false);
  assert.equal(history.snapshotBytes('abcЖ'),8,'mixed wide strings use conservative two-byte estimate');
});
test('003W/2b-2a: mutated object snapshots never use stale string byte cache',()=>{
  const history=new HistoryStack(80,1024);
  const snapshot={name:'ordinary'};
  history.reset('initial',snapshot);
  const before=history.totalBytes();
  snapshot.data='X'.repeat(80);
  assert.ok(history.totalBytes()>before);
  assert.equal(history.snapshotBytes(null),4);
});
