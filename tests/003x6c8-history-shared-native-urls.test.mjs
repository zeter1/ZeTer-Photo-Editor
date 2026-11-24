import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStack } from '../src/core/history.js';
import { createDocument, createRasterLayer, snapshotDocument, restoreDocument } from '../src/core/state.js';
import { createPixelBuffer, serializeTiledPixelBufferSource, deserializePixelBufferSource } from '../src/core/pixel-buffer.js';

function fixture(model) {
  const width = 35, height = 33;
  const channels = model === 'rgb' ? 4 : 5, bitsPerChannel = model === 'rgb' ? 16 : 32;
  const data = bitsPerChannel === 16 ? new Uint16Array(width * height * channels) :
    new Float32Array(width * height * channels);
  for (let i = 0; i < data.length; i++) data[i] = bitsPerChannel === 16 ? (i * 31) % 65536 : i / 101;
  if (bitsPerChannel === 32) {
    const words = new Uint32Array(data.buffer);
    words[2] = 0x7f812345; words[4] = 0x80000000; words[words.length - 1] = 0x7f811111;
  }
  return createPixelBuffer({ width, height, channels, model, bitsPerChannel, data });
}
function docSnapshot(source, name) {
  const doc = createDocument({ width:35, height:33, name });
  const layer = createRasterLayer({ width:35, height:33, highDepthSource:source });
  doc.layers.push(layer); doc.selectedLayerId = layer.id;
  return snapshotDocument(doc);
}
function bytes(source) {
  const data = deserializePixelBufferSource(source).data;
  return Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}

test('003X/6c-8: opt-in shared native URLs preserve all Undo slots and exact PSD16/PSB32 payloads', () => {
  for (const model of ['rgb', 'cmyk']) {
    const buffer = fixture(model);
    const source = serializeTiledPixelBufferSource(buffer, { tileSize:16 });
    const native = source.tiles.reduce((sum, t) => sum + t.dataUrl.length, 0);
    const a = docSnapshot(source, 'A');
    const b = docSnapshot(source, 'Б');
    const c = docSnapshot(source, 'C');
    const stack = new HistoryStack(8, 8 * 1024 * 1024, { shareNativeDataUrls:true });
    stack.reset('A', a);
    stack.push('B', b);
    stack.push('C', c);
    assert.deepEqual(stack.entries.map(e => e.snapshot), [a,b,c]);
    assert.equal(stack.entries.length, 3);
    assert.equal(stack.retainedNativeDataUrlChars(), native * 3, 'logical retained URLs unchanged');
    assert.equal(stack.pooledNativeDataUrlChars(), native, 'identical URL bytes have one owner');
    assert.equal(stack.totalBytes(), [a,b,c].reduce((sum,s) => sum + stack.snapshotBytes(s),0));
    assert.equal(stack.undo().snapshot, b);
    assert.deepEqual(bytes(restoreDocument(stack.undo().snapshot).layers[0].highDepthSource),bytes(source));
    assert.equal(stack.redo().snapshot, b);
    assert.equal(stack.redo().snapshot, c);
    assert.equal(stack.jump(0).snapshot, a);
    assert.equal(stack.jump(2).snapshot, c);
    const changedBuffer = fixture(model);
    changedBuffer.data[0] = model === 'rgb' ? 56789 : -0.125;
    const changedSource = serializeTiledPixelBufferSource(changedBuffer, { tileSize:16 });
    const d = docSnapshot(changedSource, 'D');
    stack.push('D', d);
    assert.equal(stack.pooledNativeDataUrlChars() > native, true, 'edited tile adds unique owner');
    assert.deepEqual(bytes(restoreDocument(stack.current().snapshot).layers[0].highDepthSource), bytes(changedSource));
    stack.undo();
    stack.push('branch', b);
    assert.equal(stack.canRedo(), false);
    assert.equal(stack.pooledNativeDataUrlChars(), native, 'branch releases unique edited tile owner');
    stack.clearToCurrent();
    assert.equal(stack.entries.length, 1);
    assert.equal(stack.pooledNativeDataUrlChars(), native);
    stack.reset('plain', '{"name":"plain"}');
    assert.equal(stack.pooledNativeDataUrlChars(), 0);
  }
});

test('003X/6c-8: exact arbitrary UTF-16 strings, mutable replacement, budgets and no-leak after count eviction', () => {
  const url = 'data:application/x-zeter-pixel-buffer;base64,QUJDRA==';
  const snapshots = ['{"value":"\uD800","native":"' + url + '"}',
    '{"value":"Привет","native":"' + url + '"}',
    '{"value":"tail","native":"' + url + '"}'];
  const h = new HistoryStack(2, 100000, { shareNativeDataUrls:true });
  h.reset('A', snapshots[0]);
  h.push('B', snapshots[1]);
  h.push('C', snapshots[2]);
  assert.deepEqual(h.entries.map(e => e.snapshot), snapshots.slice(1));
  assert.equal(h.pooledNativeDataUrlChars(), url.length);
  const replaced = '{"changed":"yes"}';
  h.current().snapshot = replaced;
  assert.equal(h.current().snapshot, replaced);
  assert.equal(h.pooledNativeDataUrlChars(), url.length);
  h.clearToCurrent();
  assert.equal(h.pooledNativeDataUrlChars(), 0);
  const cap = new HistoryStack(5, 100000, { shareNativeDataUrls:true, maxRetainedNativeDataUrlChars:url.length * 2 });
  for (const [i,s] of snapshots.entries()) cap.push(String(i), s);
  assert.equal(cap.entries.length, 2);
  assert.equal(cap.pooledNativeDataUrlChars(), url.length);
  assert.equal(cap.retainedNativeDataUrlChars(), url.length * 2);
  const generic = { editable:true };
  cap.push('object', generic);
  generic.editable = false;
  assert.equal(cap.current().snapshot.editable, false);
  assert.throws(() => new HistoryStack(5, 10000, { shareNativeDataUrls:'yes' }), /shareNativeDataUrls/);
});

test('003X/6c-8: v1 exact URL, external snapshots and failed preparation leave redo unchanged', () => {
  const url = 'data:application/x-zeter-pixel-buffer;base64,QUJDRA==';
  const a = '{"first":"' + url + '","again":"' + url + '"}';
  const b = '{"name":"other","native":"' + url + '"}';
  const history = new HistoryStack(4, 1024, { shareNativeDataUrls:true });
  history.reset('A', a);
  history.push('B', b);
  assert.equal(history.pooledNativeDataUrlChars(), url.length);
  assert.equal(history.retainedNativeDataUrlChars(), url.length * 3);
  const selected = history.undo();
  assert.strictEqual(selected.snapshot, a);
  assert.strictEqual(JSON.stringify(selected), JSON.stringify({label:'A',snapshot:a,timestamp:selected.timestamp}));
  // A failed allocation in the middle of a prepared new owner cannot clear
  // the redo branch or retain a stray interned URL.
  let allocations = 0;
  const previous = globalThis.Uint16Array;
  try {
    globalThis.Uint16Array = class extends previous {
      constructor(...args) {
        allocations++;
        if (allocations === 2) throw new Error('injected snapshot allocation failure');
        super(...args);
      }
    };
    assert.throws(() => history.push('failure', '{"native":"' + url + '","new":"yes"}'),
      /injected snapshot allocation failure/);
  } finally {
    globalThis.Uint16Array = previous;
  }
  assert.equal(allocations, 2);
  assert.strictEqual(history.current(), selected);
  assert.equal(history.redo().label, 'B');
  assert.equal(history.pooledNativeDataUrlChars(), url.length);
  history.reset('clean', '{"ok":true}');
  assert.equal(history.pooledNativeDataUrlChars(), 0);
});

test('003X/6c-8: retained URL bytes measured on 131x99 tiled RGB16 and CMYKA32 snapshots', (t) => {
  for (const model of ['rgb','cmyk']) {
    const width = 131, height = 99, channels = model === 'rgb' ? 4 : 5;
    const bitsPerChannel = model === 'rgb' ? 16 : 32;
    const data = bitsPerChannel === 16
      ? new Uint16Array(width * height * channels)
      : new Float32Array(width * height * channels);
    for (let i = 0; i < data.length; i++) data[i] = bitsPerChannel === 16
      ? (i * 31 + (i >>> 3)) % 65536 : i / 101;
    const source = serializeTiledPixelBufferSource(createPixelBuffer({
      width, height, channels, bitsPerChannel, model, data,
    }), { tileSize:32 });
    const doc = createDocument({ width, height, name:'initial' });
    const layer = createRasterLayer({ width, height, highDepthSource:source });
    doc.layers.push(layer); doc.selectedLayerId = layer.id;
    const stack = new HistoryStack(8, 8 * 1024 * 1024, { shareNativeDataUrls:true });
    const jsonLengths = [];
    for (const label of ['initial','rename','metadata']) {
      doc.name = label;
      const snapshot = snapshotDocument(doc);
      jsonLengths.push(snapshot.length);
      stack.push(label,snapshot);
    }
    const sourceChars = source.tiles.reduce((n,tile) => n + tile.dataUrl.length,0);
    assert.equal(stack.entries.length,3);
    assert.equal(stack.retainedNativeDataUrlChars(), sourceChars * 3);
    assert.equal(stack.pooledNativeDataUrlChars(), sourceChars);
    assert.equal(stack.undo().label,'rename');
    assert.equal(stack.redo().label,'metadata');
    t.diagnostic(model + ': UI native URLs ' + sourceChars +
      ', History logical URLs ' + stack.retainedNativeDataUrlChars() +
      ', History pooled immutable URL bytes ' + stack.pooledNativeDataUrlChars() +
      ', full JSON chars ' + jsonLengths.join('/'));
  }
});
