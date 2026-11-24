import test from 'node:test';
import assert from 'node:assert/strict';
import * as pixels from '../src/core/pixel-buffer.js';
import * as state from '../src/core/state.js';
import { HistoryStack } from '../src/core/history.js';
import { createHistorySharingFixture, historySourceFingerprint, historyOwnerAccounting, validateHistoryProfileConfig } from '../tools/history-sharing-fixture.mjs';

const api = { ...pixels, ...state };

function independentRaw(model, width, height) {
  const channels = model === 'rgb' ? 4 : 5, size = model === 'rgb' ? 2 : 4;
  const raw = Buffer.alloc(width * height * channels * size);
  for (let i = 0; i < raw.length / size; i++) {
    if (size === 2) raw.writeUInt16LE((i * 4051 + Math.floor(i / 128)) % 65536, i * size);
    else raw.writeUInt32LE(0x3e000000 + ((i * 104729 % 4294967296) & 0xffffff), i * size);
  }
  if (size === 2) { raw.writeUInt16LE(0, 6); raw.writeUInt16LE(65535, raw.length - 2); }
  else {
    raw.writeUInt32LE(0x7f812345, 0); raw.writeUInt32LE(0x80000000, 4);
    raw.writeUInt32LE(0x7f811111, 16); raw.writeUInt32LE(0x80000000, raw.length - 4);
  }
  return raw;
}
function raw(source) {
  const data = pixels.deserializePixelBufferSource(source).data;
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

for (const model of ['rgb', 'cmyk']) for (const version of [1, 2]) {
  test(`003X/6c-9 ${model} v${version}: actual baseline/shared exact bytes, positions and ownership`, () => {
    const fixture = createHistorySharingFixture(api, { model, version, width:259, height:257 });
    const expected = independentRaw(model, 259, 257);
    assert.deepEqual(raw(fixture.source), expected, 'independently packed raw oracle');
    const fingerprint = historySourceFingerprint(api, fixture.source);
    assert.equal(fingerprint.rawBytes, expected.length);
    const stacks = [false, true].map(shareNativeDataUrls => new HistoryStack(80, 128 * 1048576, { shareNativeDataUrls }));
    const snapshots = ['initial', 'metadata-1', 'metadata-2', 'metadata-3'].map(name => {
      fixture.doc.name = name;
      return state.snapshotDocument(fixture.doc);
    });
    for (const h of stacks) {
      snapshots.forEach((snapshot, i) => h.push(String(i), snapshot));
      assert.equal(h.entries.length, 4);
      assert.deepEqual(h.entries.map(e => e.snapshot), snapshots);
      const verify = (entry, index) => {
        assert.equal(entry.snapshot, snapshots[index]);
        const restored = state.restoreDocument(entry.snapshot);
        assert.deepEqual(raw(restored.layers[0].highDepthSource), expected);
        assert.deepEqual(historySourceFingerprint(api, restored.layers[0].highDepthSource), fingerprint);
        assert.equal(state.snapshotDocument(restored), entry.snapshot, 'exact .zpe v1/v2 JSON');
      };
      verify(h.undo(), 2); verify(h.undo(), 1); verify(h.redo(), 2);
      verify(h.jump(0), 0); verify(h.jump(3), 3);
      h.undo(); h.push('branch', snapshots[0]);
      assert.equal(h.canRedo(), false);
      assert.equal(h.entries.length, 4);
    }
    const [baseline, shared] = stacks.map(historyOwnerAccounting);
    assert.equal(baseline.pooledNativeUrlBytes, 0);
    assert.equal(shared.logicalNativeUrlChars, baseline.logicalNativeUrlChars);
    assert.equal(shared.logicalSnapshotBytes, baseline.logicalSnapshotBytes);
    const urls = version === 1 ? [fixture.source.dataUrl] : fixture.source.tiles.map(t => t.dataUrl);
    assert.equal(shared.pooledNativeUrlBytes, [...new Set(urls)].reduce((n, s) => n + s.length, 0));
    assert.ok(shared.nonNativeSegmentBytes > 0);
    stacks[1].reset('closed', '{}');
    assert.equal(historyOwnerAccounting(stacks[1]).pooledNativeUrlBytes, 0);
  });
}

test('003X/6c-9: configuration rejects silent eviction and invalid measurements', () => {
  assert.equal(validateHistoryProfileConfig().positions, 4);
  for (const input of [{ width:0 }, { repeats:0 }, { sessions:1 }, { positions:9 },
    { width:2048, height:2048, positions:8 }]) {
    assert.throws(() => validateHistoryProfileConfig(input), RangeError);
  }
  assert.throws(() => createHistorySharingFixture(api, { version:3 }), RangeError);
  assert.throws(() => createHistorySharingFixture(api, { model:'unknown' }), RangeError);
});

test('003X/6c-9: native URL reconstruction avoids per-code-unit spread while preserving arbitrary UTF-16', () => {
  const fixture = createHistorySharingFixture(api, { model:'cmyk', version:2, width:259, height:257 });
  // Raw unmatched surrogate deliberately is not JSON-escaped: HistoryStack's
  // public arbitrary-string contract is wider than valid document JSON.
  const snapshot = 'Привет\ud800' + state.snapshotDocument(fixture.doc) + '\udfff';
  const h = new HistoryStack(80, 128 * 1048576, { shareNativeDataUrls:true });
  h.reset('initial', snapshot);
  const nativeChars = h.retainedNativeDataUrlChars();
  const original = String.fromCharCode;
  let spreadCodeUnits = 0, restored;
  try {
    String.fromCharCode = function(...units) {
      spreadCodeUnits += units.length;
      return original(...units);
    };
    restored = h.current().snapshot;
  } finally { String.fromCharCode = original; }
  assert.equal(restored, snapshot);
  assert.ok(spreadCodeUnits <= snapshot.length - nativeChars,
    `native ASCII payload must not use per-code-unit spread: ${spreadCodeUnits} units`);
});
