// 037A: independent per-pixel native known-clean reference for photographed
// textures. This is an oracle, not an image synthesizer, editor or Adobe parity test.
import { createHash } from 'node:crypto';

const SHA256 = /^[0-9a-f]{64}$/;
const fail = message => { throw new TypeError(`037 native photo quality: ${message}`); };

// Hash canonical little-endian channel words, never a preview or JSON floats.
export function hashNativeCleanReference(samples, bitsPerChannel) {
  const Type = bitsPerChannel === 16 ? Uint16Array
    : bitsPerChannel === 32 ? Float32Array : null;
  if (!Type || !(samples instanceof Type) || samples.length === 0)
    fail('unsupported reference words');
  const bytesPerWord = bitsPerChannel / 8;
  const encoded = Buffer.allocUnsafe(samples.length * bytesPerWord);
  const view = new DataView(samples.buffer, samples.byteOffset, samples.byteLength);
  for (let i = 0; i < samples.length; i += 1) {
    if (bitsPerChannel === 16) encoded.writeUInt16LE(view.getUint16(i * 2, true), i * 2);
    else encoded.writeUInt32LE(view.getUint32(i * 4, true), i * 4);
  }
  return createHash('sha256').update(encoded).digest('hex');
}

export function measureRealPhotoNativeQuality({
  before, after, clean, selectedIndices, channels = 4, bitsPerChannel,
  alphaChannel = 3, expectedReferenceSha256,
} = {}) {
  const Type = bitsPerChannel === 16 ? Uint16Array
    : bitsPerChannel === 32 ? Float32Array : null;
  if (!Type || !(before instanceof Type) || !(after instanceof Type) ||
      !(clean instanceof Type) || before.length === 0 ||
      before.length !== after.length || before.length !== clean.length ||
      !Number.isInteger(channels) || channels < 2 || channels > 5 ||
      before.length % channels !== 0 ||
      !Number.isInteger(alphaChannel) || alphaChannel < 0 || alphaChannel >= channels ||
      !(selectedIndices instanceof Uint32Array) || selectedIndices.length === 0 ||
      !SHA256.test(expectedReferenceSha256 ?? '')) {
    fail('invalid reference, native word type, or geometry');
  }
  // Even aliased *different* typed-array views must not masquerade as a frozen
  // independent reference or a detached pre-operation snapshot.
  if (before.buffer === after.buffer || before.buffer === clean.buffer || after.buffer === clean.buffer)
    fail('snapshots and reference must be backed by independent buffers');

  const expected = hashNativeCleanReference(clean, bitsPerChannel);
  if (expected !== expectedReferenceSha256) fail('clean reference SHA-256 mismatch');
  const pixelCount = before.length / channels;
  const selected = new Uint8Array(pixelCount);
  let previous = -1;
  for (const pixel of selectedIndices) {
    if (pixel >= pixelCount || pixel <= previous) fail('selected indices must be unique, sorted and in range');
    selected[pixel] = 1;
    previous = pixel;
  }
  const wordBytes = bitsPerChannel / 8;
  const beforeView = new DataView(before.buffer, before.byteOffset, before.byteLength);
  const afterView = new DataView(after.buffer, after.byteOffset, after.byteLength);
  const cleanView = new DataView(clean.buffer, clean.byteOffset, clean.byteLength);
  const word = bitsPerChannel === 16
    ? (view, offset) => view.getUint16(offset * wordBytes, true)
    : (view, offset) => view.getUint32(offset * wordBytes, true);
  const baseline = { sumAbs: 0, sumSquared: 0, maxAbsoluteError: 0 };
  const repaired = { sumAbs: 0, sumSquared: 0, maxAbsoluteError: 0 };
  let scoredSamples = 0;
  let changedSelectedPixels = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    let changed = false;
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = pixel * channels + channel;
      const originalWord = word(beforeView, offset);
      const resultWord = word(afterView, offset);
      const cleanWord = word(cleanView, offset);
      if (!Number.isFinite(before[offset]) || !Number.isFinite(after[offset]) ||
          !Number.isFinite(clean[offset])) fail('non-finite native word');
      if (!selected[pixel] || channel === alphaChannel) {
        if (originalWord !== resultWord) fail('native words changed outside selection or in alpha');
        if (originalWord !== cleanWord) fail('clean reference differs outside selection or in alpha');
        continue;
      }
      changed ||= originalWord !== resultWord;
      const oldError = Math.abs(before[offset] - clean[offset]);
      const newError = Math.abs(after[offset] - clean[offset]);
      baseline.sumAbs += oldError;
      baseline.sumSquared += oldError * oldError;
      baseline.maxAbsoluteError = Math.max(baseline.maxAbsoluteError, oldError);
      repaired.sumAbs += newError;
      repaired.sumSquared += newError * newError;
      repaired.maxAbsoluteError = Math.max(repaired.maxAbsoluteError, newError);
      scoredSamples += 1;
    }
    if (changed) changedSelectedPixels += 1;
  }
  if (scoredSamples === 0 || changedSelectedPixels === 0)
    fail('selected color samples were not changed');
  const metrics = item => ({
    mae: item.sumAbs / scoredSamples,
    rmse: Math.sqrt(item.sumSquared / scoredSamples),
    maxAbsoluteError: item.maxAbsoluteError,
  });
  return {
    kind: 'zpe-real-photo-native-per-pixel-quality-v1',
    reference: 'separate photographed known-clean per-pixel native words; not Photoshop',
    referenceNativeSha256: expected,
    bitsPerChannel, channels, pixelCount,
    selectedPixels: selectedIndices.length, changedSelectedPixels, scoredSamples,
    outsideSelectionAndAlphaNativeWordsExact: true,
    baseline: metrics(baseline), repaired: metrics(repaired),
  };
}
