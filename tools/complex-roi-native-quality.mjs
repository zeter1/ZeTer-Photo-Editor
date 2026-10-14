// Test-only reference oracle for synthetic connected ROI. Measures original native
// Uint16/Float32 samples against known clean values; never uses the inpaint engine
// or RGBA8 preview. Does not establish Photoshop/reference-image parity.
export function measureKnownNativeConnectedRoiQuality({
  before, after, selectedIndices, clean, channels, bitsPerChannel, alphaChannel = null,
} = {}) {
  const fail = reason => { throw new TypeError('Known native ROI quality: ' + reason); };
  const Type = bitsPerChannel === 16 ? Uint16Array
    : bitsPerChannel === 32 ? Float32Array : null;
  if (!Type || !(before instanceof Type) || !(after instanceof Type) ||
      before.length !== after.length || before.length === 0 ||
      !Number.isSafeInteger(channels) || channels < 1 || channels > 5 ||
      before.length % channels !== 0 ||
      !(selectedIndices instanceof Uint32Array) || selectedIndices.length === 0 ||
      !Array.isArray(clean) || clean.length !== channels ||
      clean.some(value => !Number.isFinite(value) ||
        (bitsPerChannel === 16 && (!Number.isInteger(value) || value < 0 || value > 65535))) ||
      !(alphaChannel === null ||
        (Number.isInteger(alphaChannel) && alphaChannel >= 0 && alphaChannel < channels)) ||
      (alphaChannel !== null && channels < 2)) {
    fail('invalid native reference inputs');
  }
  const pixels = before.length / channels;
  const selected = new Uint8Array(pixels);
  for (const index of selectedIndices) {
    if (index >= pixels || selected[index]) fail('invalid or duplicate selected pixel');
    selected[index] = 1;
  }
  let beforeAbs = 0, beforeSquared = 0, beforeMax = 0;
  let afterAbs = 0, afterSquared = 0, afterMax = 0;
  let samples = 0;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = pixel * channels + channel;
      const old = before[offset], next = after[offset];
      if (!Number.isFinite(old) || !Number.isFinite(next)) fail('non-finite native sample');
      if (!selected[pixel] || channel === alphaChannel) {
        if (!Object.is(old,next)) fail('native sample changed outside selected color channels');
        continue;
      }
      const oldError = Math.abs(old - clean[channel]);
      const newError = Math.abs(next - clean[channel]);
      beforeAbs += oldError;
      beforeSquared += oldError * oldError;
      beforeMax = Math.max(beforeMax,oldError);
      afterAbs += newError;
      afterSquared += newError * newError;
      afterMax = Math.max(afterMax,newError);
      samples += 1;
    }
  }
  if (!samples) fail('selection has no color samples');
  return {
    kind:'zpe-known-native-connected-roi-quality-v1',
    reference:'ZeTer-authored constant native clean background; not Photoshop',
    bitsPerChannel, channels, selectedPixels:selectedIndices.length, scoredSamples:samples,
    baseline:{mae:beforeAbs / samples,rmse:Math.sqrt(beforeSquared / samples),maxAbsoluteError:beforeMax},
    repaired:{mae:afterAbs / samples,rmse:Math.sqrt(afterSquared / samples),maxAbsoluteError:afterMax},
    unchangedOutsideSelection:true,
  };
}
