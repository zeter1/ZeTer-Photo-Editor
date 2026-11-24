// Shared deterministic input, NOT a performance mock. All raster/History work
// is delegated to the supplied production exports (Node or the live bundle).
export function createHistorySharingFixture(api, {
  model = 'rgb', width = 1025, height = 1025, version = 2,
} = {}) {
  if (!['rgb', 'cmyk'].includes(model) || ![1, 2].includes(version) ||
      !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 2 || height < 2 || width * height > 4 * 1024 * 1024) {
    throw new RangeError('Invalid History profile fixture');
  }
  const channels = model === 'rgb' ? 4 : 5;
  const bitsPerChannel = model === 'rgb' ? 16 : 32;
  const data = bitsPerChannel === 16 ? new Uint16Array(width * height * channels)
    : new Float32Array(width * height * channels);
  // Write Float32 through integer words: assigning JS NaN would quiet sNaN.
  const words = bitsPerChannel === 16 ? data : new Uint32Array(data.buffer);
  for (let i = 0; i < words.length; i++) {
    words[i] = bitsPerChannel === 16 ? (Math.imul(i, 4051) + (i >>> 7)) & 65535
      : 0x3e000000 + ((Math.imul(i, 104729) >>> 0) & 0xffffff);
  }
  if (bitsPerChannel === 32) {
    words[0] = 0x7f812345; words[1] = 0x80000000;
    words[4] = 0x7f811111; // alpha sNaN
    words[words.length - 1] = 0x80000000; // edge alpha -0
  } else {
    words[3] = 0; words[words.length - 1] = 65535;
  }
  const buffer = api.createPixelBuffer({ width, height, channels, model, bitsPerChannel, data });
  const source = version === 2
    ? api.serializeTiledPixelBufferSource(buffer, { tileSize:256 })
    : api.serializePixelBufferSource(buffer);
  const doc = api.createDocument({ width, height, name:'history-profile' });
  const layer = api.createRasterLayer({ width, height, name:'native-profile', highDepthSource:source });
  doc.layers.push(layer); doc.selectedLayerId = layer.id;
  return { doc, source, rawBytes:data.byteLength };
}

// Use raw integer bytes, including alpha, rather than Float32 value equality.
export function historySourceFingerprint(api, source) {
  const data = api.deserializePixelBufferSource(source).data;
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const wordBytes = source.bitsPerChannel / 8;
  const word = i => wordBytes === 2 ? view.getUint16(i * 2, true) : view.getUint32(i * 4, true);
  return { rawBytes:bytes.length, fnv1a32:hash >>> 0,
    firstWords:Array.from({ length:5 }, (_, i) => word(i)), lastWord:word(bytes.length / wordBytes - 1) };
}

export function historyOwnerAccounting(history) {
  // These are explicitly allocated owners/logical characters, never heap/RSS.
  let nonNativeSegmentBytes = 0;
  for (const entry of history.entries) {
    const meta = history._sharedEntries.get(entry);
    if (meta) for (const part of meta.parts) nonNativeSegmentBytes += part.units?.byteLength || 0;
  }
  return { positions:history.entries.length, index:history.index,
    logicalSnapshotBytes:history.totalBytes(),
    logicalNativeUrlChars:history.retainedNativeDataUrlChars(),
    pooledNativeUrlBytes:history.pooledNativeDataUrlChars(), nonNativeSegmentBytes };
}

// Shared input limits for reproducible Node profiling. Production History
// still uses its unchanged 128 MiB logical snapshot budget.
export function validateHistoryProfileConfig({ width = 1025, height = 1025, positions = 4,
  sessions = 2, repeats = 2 } = {}) {
  if (![width, height, positions, sessions, repeats].every(Number.isSafeInteger) ||
      width < 2 || height < 2 || width * height > 4 * 1048576 ||
      positions < 3 || positions > 8 || sessions < 2 || sessions > 3 || repeats < 1 || repeats > 5) {
    throw new RangeError('Invalid History profile configuration');
  }
  if ((width * height * 20 * 4 / 3 + 65536) * positions > 128 * 1048576) {
    throw new RangeError('Requested History positions exceed the production logical byte cap');
  }
  return { width, height, positions, sessions, repeats };
}
