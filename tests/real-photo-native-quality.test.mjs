import test from 'node:test';
import assert from 'node:assert/strict';
import {hashNativeCleanReference,measureRealPhotoNativeQuality} from '../tools/real-photo-native-quality.mjs';

// Deterministic textured surrogate only for unit testing the independent
// reference oracle; this is NOT the actual photograph / Stage 037 benchmark.
function scenario(bits) {
  const width = 18, height = 12, channels = 4;
  const Type = bits === 16 ? Uint16Array : Float32Array;
  const clean = new Type(width * height * channels);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    for (let c = 0; c < 3; c += 1)
      clean[pixel * 4 + c] = bits === 16
        ? 9000 + (pixel * 937 + c * 2221) % 43000
        : (0.03 + ((pixel * 19 + c * 61) % 200) / 255);
    clean[pixel * 4 + 3] = bits === 16 ? 65535 : 1;
  }
  const selectedIndices = Uint32Array.from([28,29,30,46,47,48,64,65,66]);
  const before = clean.slice(), after = clean.slice();
  for (const pixel of selectedIndices) for (let c = 0; c < 3; c += 1)
    before[pixel * 4 + c] = bits === 16 ? 61500 : 3.75;
  return {bitsPerChannel: bits, channels, alphaChannel: 3, before, after, clean,
    selectedIndices, expectedReferenceSha256: hashNativeCleanReference(clean, bits)};
}

for (const bits of [16,32]) {
  test(`037A: independent textured per-pixel ${bits}-bit clean reference scores native exact repair`, () => {
    const s = scenario(bits);
    const value = measureRealPhotoNativeQuality(s);
    assert.equal(value.kind,'zpe-real-photo-native-per-pixel-quality-v1');
    assert.equal(value.referenceNativeSha256,s.expectedReferenceSha256);
    assert.equal(value.selectedPixels,9);
    assert.equal(value.changedSelectedPixels,9);
    assert.equal(value.scoredSamples,27);
    assert.ok(value.baseline.mae > 0 && value.baseline.rmse >= value.baseline.mae);
    assert.deepEqual(value.repaired,{mae:0,rmse:0,maxAbsoluteError:0});
    assert.equal(value.outsideSelectionAndAlphaNativeWordsExact,true);
  });

  test(`037A: ${bits}-bit reject changed outside pixels, alpha, reference, mixed bits, alias, NaN and selection`, () => {
    const attempts = [
      s => { s.after[1] += 1; },
      s => { s.after[28*4+3] = bits===16?65534:0.5; },
      s => { s.clean[0] += 1; s.expectedReferenceSha256 = hashNativeCleanReference(s.clean,bits); },
      s => { s.clean[28*4] += 1; },
      s => { s.clean = s.before; },
      s => { s.after = s.before.subarray(); },
      s => { s.after = bits===16?new Float32Array(s.after):new Uint16Array(s.after.length); },
      s => { s.selectedIndices = Uint32Array.from([29,28]); },
      s => { s.selectedIndices = Uint32Array.from([28,28]); },
      s => { s.selectedIndices = Uint32Array.from([999]); },
      s => { s.selectedIndices = new Uint32Array(); },
      s => { s.expectedReferenceSha256 = 'f'.repeat(64); },
      s => { s.expectedReferenceSha256 = null; },
      s => { s.after = s.before.slice(); },
    ];
    if (bits===32) attempts.push(s => { s.after[28*4] = Number.NaN; });
    for (const mutate of attempts) {
      const scenarioValue = scenario(bits);
      mutate(scenarioValue);
      assert.throws(() => measureRealPhotoNativeQuality(scenarioValue),/037 native photo quality/);
    }
  });
}

test('037A: Float32 signed zero differences are detected byte-exactly (not numerically)', () => {
  const s = scenario(32);
  s.before[0] = -0; s.after[0] = 0; s.clean[0] = -0;
  s.expectedReferenceSha256 = hashNativeCleanReference(s.clean,32);
  assert.throws(() => measureRealPhotoNativeQuality(s),/outside selection/);
});
