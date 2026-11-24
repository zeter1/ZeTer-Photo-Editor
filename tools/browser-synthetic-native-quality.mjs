// Test-only native quality oracle for the ZeTer-authored constant-background PSD16/PSB32
// fixtures. The 5x5 defect replaces known clean pixels; this does NOT measure
// Photoshop parity, natural-image quality, or browser memory peaks.
export function measureSyntheticNativeDefectQuality(source, {
  normal, defectX, defectY, radius = 2,
} = {}) {
  const fail = reason => { throw new TypeError('Synthetic native quality: ' + reason); };
  if (!source || source.kind !== 'zpe-pixel-buffer-source-v2' ||
      ![16,32].includes(source.bitsPerChannel) || source.channels !== 4 ||
      !Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height) ||
      !Array.isArray(source.tiles) || !Array.isArray(normal) ||
      normal.length !== source.channels || normal.some(value => !Number.isFinite(value)) ||
      !Number.isSafeInteger(radius) || radius < 0 || radius > 8 ||
      !Number.isSafeInteger(defectX) || !Number.isSafeInteger(defectY) ||
      defectX - radius < 0 || defectY - radius < 0 ||
      defectX + radius >= source.width || defectY + radius >= source.height) {
    fail('invalid source or reference region');
  }
  const bytesPerSample = source.bitsPerChannel / 8;
  const stride = source.channels * bytesPerSample;
  const prefix = 'data:application/x-zeter-pixel-buffer-tile;base64,';
  const cache = new Map();
  function decode(tile) {
    if (cache.has(tile)) return cache.get(tile);
    if (!Number.isSafeInteger(tile.x) || !Number.isSafeInteger(tile.y) ||
        !Number.isSafeInteger(tile.width) || !Number.isSafeInteger(tile.height) ||
        tile.width < 1 || tile.height < 1 || tile.x < 0 || tile.y < 0 ||
        tile.x + tile.width > source.width || tile.y + tile.height > source.height ||
        tile.rawBytes !== tile.width * tile.height * stride ||
        typeof tile.dataUrl !== 'string' || !tile.dataUrl.startsWith(prefix)) {
      fail('invalid native tile geometry or payload');
    }
    const encoded = tile.dataUrl.slice(prefix.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      fail('invalid base64');
    }
    let binary;
    try { binary = atob(encoded); }
    catch { fail('unreadable base64'); }
    if (binary.length !== tile.rawBytes) fail('native tile byte length mismatch');
    const view = new DataView(Uint8Array.from(binary, c => c.charCodeAt(0)).buffer);
    cache.set(tile, view);
    return view;
  }
  let sumAbsolute = 0, sumSquared = 0, maxAbsoluteError = 0;
  let sampledPixels = 0;
  for (let y = defectY - radius; y <= defectY + radius; y += 1) {
    for (let x = defectX - radius; x <= defectX + radius; x += 1) {
      const covering = source.tiles.filter(tile => tile && x >= tile.x &&
        x < tile.x + tile.width && y >= tile.y && y < tile.y + tile.height);
      if (covering.length !== 1) fail('missing or overlapping native tile');
      const tile = covering[0];
      const view = decode(tile);
      const offset = ((y - tile.y) * tile.width + x - tile.x) * stride;
      for (let channel = 0; channel < source.channels; channel += 1) {
        const at = offset + channel * bytesPerSample;
        const actual = source.bitsPerChannel === 16
          ? view.getUint16(at,true) : view.getFloat32(at,true);
        if (!Number.isFinite(actual)) fail('non-finite native pixel');
        const error = Math.abs(actual - normal[channel]);
        sumAbsolute += error;
        sumSquared += error * error;
        maxAbsoluteError = Math.max(maxAbsoluteError,error);
      }
      sampledPixels += 1;
    }
  }
  const samples = sampledPixels * source.channels;
  return {
    kind:'zpe-synthetic-native-defect-metrics-v1',
    bitsPerChannel:source.bitsPerChannel,
    channels:source.channels,
    sampledPixels,
    meanAbsoluteError:sumAbsolute / samples,
    rootMeanSquareError:Math.sqrt(sumSquared / samples),
    maxAbsoluteError,
  };
}

// Gate for the genuine Chromium UI operation reports. JSON cannot by itself prove
// pixels: the browser smoke must calculate these numbers from persisted native tiles.
export function validateBrowserSyntheticQualityEvidence(quality, {format,outcome} = {}) {
  const fail = reason => { throw new TypeError('Synthetic native quality evidence: ' + reason); };
  if (outcome === 'failed') {
    if (quality != null) fail('failed operation has a quality claim');
    return true;
  }
  const keys = ['kind','reference','bitsPerChannel','channels','sampledPixels',
    'baseline','firstFill','firstRedo','cancelled','recoveredFill',
    'recoveredUndo','recoveredRedo'];
  if (!quality || typeof quality !== 'object' || Array.isArray(quality) ||
      Object.keys(quality).length !== keys.length ||
      keys.some(key => !Object.hasOwn(quality,key)) ||
      quality.kind !== 'zpe-browser-synthetic-native-quality-v1' ||
      quality.reference !== 'ZeTer-authored constant native background; not Photoshop' ||
      quality.bitsPerChannel !== (format === 'PSD16' ? 16 : format === 'PSB32' ? 32 : null) ||
      quality.channels !== 4 || quality.sampledPixels !== 25) {
    fail('invalid metric identity or shape');
  }
  const metric = (item) => item && typeof item === 'object' && !Array.isArray(item) &&
    Object.keys(item).length === 2 && Object.hasOwn(item,'mae') &&
    Object.hasOwn(item,'rmse') && Number.isFinite(item.mae) &&
    Number.isFinite(item.rmse) && item.mae >= 0 &&
    item.rmse >= item.mae - 1e-8;
  if (!metric(quality.baseline) || !metric(quality.firstFill) ||
      !metric(quality.firstRedo) ||
      !(quality.firstFill.mae < quality.baseline.mae &&
        quality.firstFill.rmse < quality.baseline.rmse) ||
      quality.firstRedo.mae !== quality.firstFill.mae ||
      quality.firstRedo.rmse !== quality.firstFill.rmse) {
    fail('first Fill must improve synthetic reference and exact Redo must match');
  }
  if (outcome === 'completed') {
    if ([quality.cancelled,quality.recoveredFill,quality.recoveredUndo,
      quality.recoveredRedo].some(value => value !== null)) {
      fail('ordinary run cannot claim retry metrics');
    }
    return true;
  }
  if (outcome !== 'completed-with-cancelled-retry' ||
      ![quality.cancelled,quality.recoveredFill,quality.recoveredUndo,
        quality.recoveredRedo].every(metric) ||
      quality.cancelled.mae !== quality.baseline.mae ||
      quality.cancelled.rmse !== quality.baseline.rmse ||
      quality.recoveredUndo.mae !== quality.baseline.mae ||
      quality.recoveredUndo.rmse !== quality.baseline.rmse ||
      !(quality.recoveredFill.mae < quality.baseline.mae &&
        quality.recoveredFill.rmse < quality.baseline.rmse) ||
      quality.recoveredRedone !== undefined ||
      quality.recoveredRedo.mae !== quality.recoveredFill.mae ||
      quality.recoveredRedo.rmse !== quality.recoveredFill.rmse) {
    fail('cancel/retry/Undo/Redo synthetic reference mismatch');
  }
  return true;
}
