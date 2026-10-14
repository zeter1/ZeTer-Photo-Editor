// Shared test-only oracle for native bytes persisted by real Chromium file:// edits.
// Unlike RGBA8 canvas preview, compares every native channel byte in each changed
// tile, against the exact frozen Worker selectedIndices (not a guessed marquee box).
// This is NOT an independent Photoshop render oracle.
export function inspectNativeSelectedPixelChanges(before, after, selectedIndices) {
  const fail = message => { throw new TypeError('Native selection pixel oracle: ' + message); };
  if (!before || !after ||
      before.kind !== 'zpe-pixel-buffer-source-v2' ||
      after.kind !== 'zpe-pixel-buffer-source-v2') fail('invalid native source');
  const fields = ['width','height','model','channels','bitsPerChannel',
    'tileSize','rawBytes','colorSpace','alphaMode','profileName'];
  if (fields.some(key => before[key] !== after[key]) ||
      !Number.isSafeInteger(before.width) || before.width < 1 ||
      !Number.isSafeInteger(before.height) || before.height < 1 ||
      !Number.isSafeInteger(before.channels) || before.channels < 1 ||
      ![16,32].includes(before.bitsPerChannel) ||
      !Array.isArray(before.tiles) || !Array.isArray(after.tiles) ||
      before.tiles.length !== after.tiles.length) fail('source metadata or topology changed');
  const pixelCount = before.width * before.height;
  const stride = before.channels * (before.bitsPerChannel / 8);
  if (!Number.isSafeInteger(pixelCount) ||
      before.rawBytes !== pixelCount * stride) fail('invalid native byte budget');
  if (!(selectedIndices instanceof Uint32Array) && !Array.isArray(selectedIndices))
    fail('missing frozen Worker selection');
  const selection = new Set();
  for (const index of selectedIndices) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= pixelCount || selection.has(index))
      fail('invalid or duplicate frozen selection index');
    selection.add(index);
  }
  if (!selection.size) fail('empty frozen Worker selection');
  const prefix = 'data:application/x-zeter-pixel-buffer-tile;base64,';
  function decode(tile, byteLength) {
    if (typeof tile.dataUrl !== 'string' || !tile.dataUrl.startsWith(prefix))
      fail('invalid native tile payload');
    let binary;
    try { binary = atob(tile.dataUrl.slice(prefix.length)); }
    catch { fail('invalid native base64 payload'); }
    if (binary.length !== byteLength) fail('invalid native tile byte length');
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }
  let changedSelectedPixels = 0, changedTiles = 0;
  for (let i = 0; i < before.tiles.length; i += 1) {
    const original = before.tiles[i], current = after.tiles[i];
    if (!original || !current ||
        ['x','y','width','height','rawBytes'].some(key => original[key] !== current[key]) ||
        ![original.x,original.y,original.width,original.height,original.rawBytes]
          .every(Number.isSafeInteger) ||
        original.x < 0 || original.y < 0 || original.width < 1 || original.height < 1 ||
        original.x + original.width > before.width ||
        original.y + original.height > before.height ||
        original.rawBytes !== original.width * original.height * stride) {
      fail('native tile geometry or byte budget changed');
    }
    if (original.dataUrl === current.dataUrl) continue;
    const oldBytes = decode(original,original.rawBytes);
    const newBytes = decode(current,current.rawBytes);
    let changedHere = false;
    for (let offset = 0; offset < oldBytes.length; offset += stride) {
      let different = false;
      for (let byte = 0; byte < stride; byte += 1) {
        if (oldBytes[offset + byte] !== newBytes[offset + byte]) {
          different = true;
          break;
        }
      }
      if (!different) continue;
      const localPixel = offset / stride;
      const x = original.x + localPixel % original.width;
      const y = original.y + Math.floor(localPixel / original.width);
      if (!selection.has(y * before.width + x)) {
        fail('native byte mutation outside frozen Worker selection at ' + x + ',' + y);
      }
      changedSelectedPixels += 1;
      changedHere = true;
    }
    if (changedHere) changedTiles += 1;
  }
  return {
    selectedPixels: selection.size,
    changedSelectedPixels,
    changedTiles,
    changedOutsideSelectionPixels: 0,
  };
}
