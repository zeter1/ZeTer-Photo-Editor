import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDngLosslessJpeg} from '../src/formats/dng-lossless-jpeg.js';
import {decodeDng, inspectDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {encodeSyntheticLosslessJpeg, losslessJpegDngFixture,
  tiledLosslessJpegDngFixture} from './fixtures/dng-lossless-jpeg-fixture.mjs';

// Synthetic entropy stream, not a camera-authored independent RAW reference.
const pixels = (width, height, bits) => Array.from({length: width * height}, (_, i) => {
  const x = i % width, y = Math.floor(i / width);
  return (bits === 8 ? 33 : 480) + x * 9 + y * 11 + ((x + y) % 3) * 7;
});
const positions = (data, marker) => Array.from(data.keys())
  .filter(i => data[i] === 0xff && data[i + 1] === marker);

test('SOF3 two disjoint 2-component SOS groups decode exact CFA samples and restart predictors', () => {
  for (const bits of [8, 12, 16]) for (const predictor of [1, 4, 7])
    for (const restartInterval of [0, 1, 3, 7]) {
      const width = 8, height = 5, values = pixels(width, height, bits);
      const stream = encodeSyntheticLosslessJpeg({width, height, bits, values,
        components: 4, scanMode: 'paired', scanOrder: [2, 0, 3, 1],
        predictor, restartInterval});
      const scans = positions(stream, 0xda);
      assert.equal(scans.length, 2, 'exactly two SOS groups');
      assert.deepEqual(scans.map(i => stream[i + 4]), [2, 2], 'two components per SOS');
      assert.deepEqual([...decodeDngLosslessJpeg(stream, {width, height, bits})],
        values, `paired SOF3 ${bits}/${predictor}/${restartInterval}`);
    }
});

test('SOF3 paired scans preserve point transform and independent component order', () => {
  const width = 8, height = 4, bits = 16, values = pixels(width, height, bits);
  const jpeg = encodeSyntheticLosslessJpeg({width, height, bits, values,
    components: 4, scanMode: 'paired', scanOrder: [3, 1, 0, 2],
    pointTransform: 2, restartInterval: 2});
  assert.deepEqual([...decodeDngLosslessJpeg(jpeg, {width, height, bits})],
    values.map(value => (value >> 2) << 2));
});

test('SOF3 paired SOS TIFF strips and padded tiles preserve RAW CFA, orientation, original bytes', () => {
  for (const le of [true, false]) {
    const options = {le, bits: 12, width: 8, height: 6,
      samples: (x, y, c) => 530 + x * 8 + y * 10 + c * 21,
      defaultCropOrigin: [0.5, 0], defaultCropSize: [6, 5],
      orientation: 6, whiteLevel: 4095};
    const baseline = fixture({...options, bits: 16});
    const variants = [
      losslessJpegDngFixture({...options, components: 4,
        scanMode: 'paired', scanOrder: [2, 0, 3, 1], restartInterval: 3}),
      tiledLosslessJpegDngFixture({...options, components: 4,
        scanMode: 'paired', scanOrder: [3, 1, 0, 2],
        tileWidth: 4, tileLength: 3, restartInterval: 2}),
    ];
    for (const encoded of variants) {
      const original = new Uint8Array(encoded).slice();
      const decoded = decodeDng(encoded), expected = decodeDng(baseline);
      assert.equal(inspectDng(encoded).compression, 7);
      assert.equal(decoded.width, expected.width);
      assert.equal(decoded.height, expected.height);
      assert.deepEqual([...decoded.rgba], [...expected.rgba]);
      assert.deepEqual([...new Uint8Array(encoded)], [...original], 'DNG source immutable');
    }
  }
});

test('SOF3 paired groups reject missing, repeated, unknown, mixed and damaged scans', () => {
  const width = 8, height = 4, bits = 12, values = pixels(width, height, bits);
  const original = encodeSyntheticLosslessJpeg({width, height, bits, values,
    components: 4, scanMode: 'paired', scanOrder: [3, 1, 0, 2], restartInterval: 2});
  const [a, b] = positions(original, 0xda);
  assert.ok(a > 0 && b > a);
  const corrupt = edit => {const copy = original.slice(); edit(copy); return copy;};
  const reject = stream => assert.throws(
    () => decodeDngLosslessJpeg(stream, {width, height, bits}),
    /DNG: lossless JPEG/i);
  reject(Uint8Array.from([...original.slice(0, b), 255, 217])); // partial EOI
  reject(corrupt(v => {v[b + 5] = v[a + 5];})); // repeated across scans
  reject(corrupt(v => {v[a + 7] = v[a + 5];})); // repeated within scan
  reject(corrupt(v => {v[b + 7] = 99;})); // unknown SOF3 component
  reject(corrupt(v => {v[b + 4] = 1;})); // mismatched SOS segment length
  const restart = positions(original, 0xd0).find(i => i > b);
  assert.ok(restart, 'fixture has RST0 in second scan');
  reject(corrupt(v => {v[restart + 1] = 0xd7;})); // incorrect RST sequence
  reject(Uint8Array.from([...original, 0])); // stray bytes after EOI
});
