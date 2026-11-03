import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStack } from '../src/core/history.js';
import { createDocument, createRasterLayer, snapshotDocument, restoreDocument } from '../src/core/state.js';
import { createPixelBuffer, serializeTiledPixelBufferSource, serializePixelBufferSource,
  deserializePixelBufferSource } from '../src/core/pixel-buffer.js';

const WIDTH = 131, HEIGHT = 99;
function native(model) {
  const channels = model === 'rgb' ? 4 : 5;
  const bits = model === 'rgb' ? 16 : 32;
  const data = bits === 16
    ? new Uint16Array(WIDTH * HEIGHT * channels)
    : new Float32Array(WIDTH * HEIGHT * channels);
  for (let p = 0; p < WIDTH * HEIGHT; p++) {
    data.set(bits === 16 ? [10000, 20000, 30000, 65535] : [0.2, 0.3, 0.4, 0.5, 1], p * channels);
  }
  if (bits === 32) {
    const words = new Uint32Array(data.buffer);
    words[4] = 0x7f812345;
    words[9] = 0x80000000;
    words[words.length - 1] = 0x7f811111;
  }
  return createPixelBuffer({ width:WIDTH, height:HEIGHT, model, channels, bitsPerChannel:bits, data });
}
function raw(source) {
  const decoded = deserializePixelBufferSource(source).data;
  return Buffer.from(new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength));
}
function docWith(source, name) {
  const doc = createDocument({ width:WIDTH, height:HEIGHT, name });
  const layer = createRasterLayer({ width:WIDTH, height:HEIGHT, highDepthSource:source });
  doc.layers.push(layer);
  doc.selectedLayerId = layer.id;
  return doc;
}
function nativeChars(source) {
  return source.tiles.reduce((n, tile) => n + tile.dataUrl.length, 0);
}

test('003X/6c-7: opt-in ceiling accounts for *each* retained native v2 URL snapshot and preserves byte-exact Undo/Redo', (t) => {
  for (const model of ['rgb', 'cmyk']) {
    for (const tileSize of [32, 65, 256]) {
      const buffer = native(model);
      const source = serializeTiledPixelBufferSource(buffer, { tileSize });
      const sourceChars = nativeChars(source);
      const initialRaw = raw(source);
      const doc = docWith(source, 'initial');
      const snapA = snapshotDocument(doc);
      doc.name = 'first edit';
      const snapB = snapshotDocument(doc);
      const modifiedData = buffer.data.slice();
      modifiedData[13 * (model === 'rgb' ? 4 : 5)] = model === 'rgb' ? 64500 : 0.75;
      const edited = serializeTiledPixelBufferSource(createPixelBuffer({
        width:WIDTH, height:HEIGHT, model, channels:buffer.channels,
        bitsPerChannel:buffer.bitsPerChannel, data:modifiedData,
      }), { tileSize });
      doc.layers[0].highDepthSource = edited;
      doc.name = 'second edit';
      const snapC = snapshotDocument(doc);
      const editedRaw = raw(edited);
      const full = new HistoryStack(8, 8 * 1024 * 1024);
      full.reset('A', snapA);
      full.push('B', snapB);
      full.push('C', snapC);
      assert.equal(full.retainedNativeDataUrlChars(), sourceChars * 3);
      const cap = new HistoryStack(8, 8 * 1024 * 1024,
        { maxRetainedNativeDataUrlChars:sourceChars * 2 });
      cap.reset('A', snapA);
      cap.push('B', snapB);
      cap.push('C', snapC);
      assert.deepEqual(cap.entries.map(e => e.label), ['B', 'C']);
      assert.equal(cap.retainedNativeDataUrlChars(), sourceChars * 2);
      assert.equal(cap.totalBytes(), cap.snapshotBytes(snapB) + cap.snapshotBytes(snapC));
      assert.deepEqual(raw(restoreDocument(cap.undo().snapshot).layers[0].highDepthSource), initialRaw);
      assert.deepEqual(raw(restoreDocument(cap.redo().snapshot).layers[0].highDepthSource), editedRaw);
      assert.deepEqual(raw(JSON.parse(JSON.stringify(edited))), editedRaw, 'v2 .zpe JSON survives');
      assert.deepEqual(raw(JSON.parse(JSON.stringify(serializePixelBufferSource(buffer)))),
        Buffer.from(new Uint8Array(buffer.data.buffer)), 'v1 .zpe raw native bits survive');
      assert.equal(cap.canRedo(), false);
      t.diagnostic(model + ' tile=' + tileSize + ': original source URLs ' + sourceChars +
        ', three snapshots ' + (sourceChars * 3) + ' -> retained two snapshots ' +
        cap.retainedNativeDataUrlChars() + ' URL chars; JSON ' +
        [snapA.length, snapB.length, snapC.length].join('/'));
    }
  }
});

test('003X/6c-7: jump, branch, limits, reset, mixed Unicode and active oversized snapshot stay correct', () => {
  const source = serializeTiledPixelBufferSource(native('rgb'), { tileSize:32 });
  const one = nativeChars(source);
  const sample = name => snapshotDocument(docWith(source, name));
  const history = new HistoryStack(10, 10_000_000,
    { maxRetainedNativeDataUrlChars:one * 3 });
  history.reset('A', sample('A'));
  history.push('B', sample('B'));
  history.push('C', sample('C'));
  assert.equal(history.jump(0).label, 'A');
  assert.equal(history.jump(2).label, 'C');
  assert.equal(history.undo().label, 'B');
  history.push('D', sample('D'));
  assert.deepEqual(history.entries.map(e => e.label), ['A','B','D']);
  history.push('E', sample('E'));
  assert.deepEqual(history.entries.map(e => e.label), ['B','D','E']);
  assert.equal(history.jump(0).label, 'B');
  history.clearToCurrent();
  assert.deepEqual(history.entries.map(e => e.label), ['B']);
  assert.equal(history.retainedNativeDataUrlChars(), one);
  history.reset('clean', '{"value":"no native URLs","dataUrl":"data:image/png;base64,AAAA"}');
  assert.equal(history.retainedNativeDataUrlChars(), 0);
  history.push('with native', sample('new'));
  assert.equal(history.retainedNativeDataUrlChars(), one);
  const none = new HistoryStack(10, 10_000_000,
    { maxRetainedNativeDataUrlChars:0 });
  none.reset('A', sample('A'));
  none.push('B', sample('B'));
  assert.equal(none.current().label, 'B');
  assert.equal(none.canUndo(), false);
  assert.equal(none.retainedNativeDataUrlChars(), one,
    'an oversized active snapshot must always survive');
  const wide = new HistoryStack(10, 1_000_000,
    { maxRetainedNativeDataUrlChars:one * 2 });
  wide.reset('first', sample('Russian: Привет'));
  wide.push('second', sample('New: Мир'));
  assert.equal(wide.retainedNativeDataUrlChars(), one * 2);
  assert.ok(wide.totalBytes() > wide.current().snapshot.length * 2);
  for (const invalid of [-1, 1.1, NaN, Infinity, '10']) {
    assert.throws(() => new HistoryStack(10, 100000,
      { maxRetainedNativeDataUrlChars:invalid }), /invalid maxRetainedNativeDataUrlChars/);
  }
});

test('003X/6c-7: v1 native Data URL is counted at exact cap; ordinary image URLs are excluded', () => {
  const buffer = native('cmyk');
  const v1 = serializePixelBufferSource(buffer);
  const snapshot = JSON.stringify({ highDepthSource:v1,
    preview:'data:image/png;base64,AAAA', label:'proof' });
  const one = v1.dataUrl.length;
  const history = new HistoryStack(3, 8 * 1024 * 1024,
    { maxRetainedNativeDataUrlChars:one * 2 });
  history.reset('before', snapshot);
  history.push('same native', snapshot);
  assert.equal(history.retainedNativeDataUrlChars(), one * 2);
  history.push('edited', JSON.stringify({ highDepthSource:v1, label:'updated' }));
  assert.deepEqual(history.entries.map(e => e.label), ['same native', 'edited']);
  assert.equal(history.retainedNativeDataUrlChars(), one * 2);
  assert.deepEqual(raw(JSON.parse(history.undo().snapshot).highDepthSource),
    Buffer.from(new Uint8Array(buffer.data.buffer)), 'raw v1 signaling NaN bits survive');
  assert.equal(history.redo().label, 'edited');
});

test('003X/6c-7: legacy stack default, object mutation, duplicate URL-looking notes and failed later snapshot', () => {
  const history = new HistoryStack(3, 1_000_000);
  const source = serializeTiledPixelBufferSource(native('rgb'), { tileSize:256 });
  const exact = nativeChars(source);
  const doc = docWith(source, 'a');
  history.reset('a', snapshotDocument(doc));
  doc.name = 'b'; history.push('b', snapshotDocument(doc));
  doc.name = 'c'; history.push('c', snapshotDocument(doc));
  assert.equal(history.retainedNativeDataUrlChars(), exact * 3);
  assert.equal(history.entries.length, 3, 'no surprise retention change without opt-in');
  assert.equal(history.undo().label, 'b');
  assert.throws(() => snapshotDocument({self: (() => { const x={}; x.self=x; return x; })()}),
    /circular/i);
  assert.equal(history.current().label, 'b', 'failed snapshot leaves History unchanged');
  history.push('branch', snapshotDocument(doc));
  assert.equal(history.canRedo(), false);
  const object = {name:'small'};
  const other = new HistoryStack(3, 100000, { maxRetainedNativeDataUrlChars:0 });
  other.reset('object', object);
  object.name = 'changed';
  assert.equal(other.retainedNativeDataUrlChars(), 0);
  assert.ok(other.totalBytes() > 0);
  assert.ok(history.snapshotBytes('Привет') > 'Привет'.length);
});
