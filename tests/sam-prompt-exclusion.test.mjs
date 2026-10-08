import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSamPrompts, mergeSamMask } from '../src/ai/sam-preprocess.js';

// A positive hint marks the subject; a nearby negative hint marks a tiny
// enclosed hole which must not be silently filled by contour cleanup.
function hintedLayer() {
  const width = 256, height = 256;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const mask = new Uint8Array(width * height);
  mask[112 * width + 112] = 1;
  mask[128 * width + 128] = 2;
  return { width, height, data, mask };
}

function competingCandidates() {
  const plane = 256 * 256;
  const masks = new Float32Array(3 * plane).fill(-6);
  for (let y = 90; y <= 170; y++) {
    for (let x = 90; x <= 170; x++) {
      masks[y * 256 + x] = 6;
      masks[plane + y * 256 + x] = 6;
    }
  }
  // Nine model pixels: below the ordinary pinhole-filling threshold (16).
  // Only the lower-confidence candidate honors the explicit negative hint.
  for (let y = 127; y <= 129; y++) {
    for (let x = 127; x <= 129; x++) masks[plane + y * 256 + x] = -6;
  }
  return { masks, scores: Float32Array.from([0.99, 0.72, 0.1]) };
}

test('SAM prioritizes positive/negative hints over a higher-confidence mask and preserves an excluded pinhole', () => {
  const source = hintedLayer();
  const original = source.data.slice();
  const prompts = prepareSamPrompts(source);
  assert.deepEqual([...prompts.labels].sort(), [0, 1], 'both foreground and exclusion prompts must reach the model');

  const result = mergeSamMask(source, prompts, competingCandidates());
  const alpha = (x, y) => result[(y * source.width + x) * 4 + 3];

  assert.equal(alpha(112, 112), 255, 'the marked subject must remain visible');
  assert.equal(alpha(128, 128), 0, 'a negative hint must survive small-hole cleanup');
  assert.equal(alpha(20, 20), 0, 'unmarked background must be removed');
  assert.deepEqual(source.data, original, 'preparation and merge must not mutate source pixels');
  for (let i = 0; i < result.length; i += 4) {
    assert.deepEqual([...result.subarray(i, i + 3)], [255, 255, 255], 'SAM must only change alpha');
  }
});

test('SAM fails closed when every candidate contradicts an explicit negative hint', () => {
  const source = hintedLayer();
  const original = source.data.slice();
  const prompts = prepareSamPrompts(source);
  const output = competingCandidates();
  // All candidates either include the excluded area or miss the subject.
  output.masks.copyWithin(256 * 256, 0, 256 * 256);

  assert.throws(() => mergeSamMask(source, prompts, output), /Подсказки противоречат результату/);
  assert.deepEqual(source.data, original, 'rejected inference must preserve source pixels');
});
