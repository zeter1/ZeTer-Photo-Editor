import {
  createSerializedPixelBufferTileWorkingSet,
  inpaintTiledPixelBufferSourceCooperative,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
} from '../core/pixel-buffer.js';


const TILED_INPAINT_RESULT_TILE_URL_PREFIX = 'data:application/x-zeter-pixel-buffer-tile;base64,';

// A detached Worker crosses a structured-clone boundary. Never allow a
// malformed or stale-shaped result to reach preview/History publication.
// This validates changed payloads without decoding every unchanged native tile.
function assertTiledInpaintWorkerResult(result, source, selectedIndices) {
  const invalid = () => new TypeError('Tiled inpaint: invalid Worker result');
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw invalid();
  const counts = [result.changed, result.filled, result.changedTiles, result.loadedTiles];
  if (!counts.every(value => Number.isSafeInteger(value) && value >= 0) ||
      result.filled !== selectedIndices.length ||
      result.changed > result.filled ||
      result.changedTiles > result.changed ||
      result.changedTiles > result.loadedTiles ||
      result.loadedTiles > source.tiles.length ||
      (result.changed === 0) !== (result.changedTiles === 0)) throw invalid();

  const returned = result.source;
  if (!returned || typeof returned !== 'object' || Array.isArray(returned) ||
      !Array.isArray(returned.tiles) || returned.tiles.length !== source.tiles.length) throw invalid();
  for (const field of ['kind', 'width', 'height', 'model', 'channels', 'bitsPerChannel',
    'tileSize', 'rawBytes']) {
    if (returned[field] !== source[field]) throw invalid();
  }
  if (returned.colorSpace !== String(source.colorSpace || '').slice(0, 120) ||
      returned.profileName !== String(source.profileName || '').slice(0, 240) ||
      returned.alphaMode !== (source.channels === (source.model === 'cmyk' ? 5 : 4) ? 'straight' : 'none') ||
      returned.sampleType !== (source.bitsPerChannel === 32 ? 'float' : 'uint') ||
      returned.byteOrder !== 'little-endian') throw invalid();

  const columns = Math.ceil(source.width / source.tileSize);
  const editableTiles = new Set();
  for (const index of selectedIndices) {
    const x = index % source.width, y = Math.floor(index / source.width);
    editableTiles.add(Math.floor(y / source.tileSize) * columns + Math.floor(x / source.tileSize));
  }

  let changedTilePayloads = 0;
  for (let index = 0; index < source.tiles.length; index += 1) {
    const before = source.tiles[index], after = returned.tiles[index];
    if (!after || typeof after !== 'object' || Array.isArray(after)) throw invalid();
    for (const field of ['x', 'y', 'width', 'height', 'rawBytes']) {
      if (after[field] !== before[field]) throw invalid();
    }
    if (typeof after.dataUrl !== 'string') throw invalid();
    if (after.dataUrl === before.dataUrl) continue;
    if (!editableTiles.has(index) ||
        !after.dataUrl.startsWith(TILED_INPAINT_RESULT_TILE_URL_PREFIX)) throw invalid();
    const encoded = after.dataUrl.slice(TILED_INPAINT_RESULT_TILE_URL_PREFIX.length);
    if (encoded.length !== 4 * Math.ceil(before.rawBytes / 3) ||
        !/^[a-z\d+/=]+$/i.test(encoded)) throw invalid();
    changedTilePayloads += 1;
  }
  if (changedTilePayloads !== result.changedTiles) throw invalid();
  return result;
}

// Stage 003: freeze geometry on the UI thread, then run the bounded native
// tile kernel in the browser Worker. A missing Worker is the ONLY fallback;
// compute/protocol failures fail closed rather than silently rerunning work.
export async function prepareTiledInpaintWithWorker(source, {
  isAllowed,
  isCancelled = () => false,
  worker = null,
  maxBytes,
  maxFillPixels = 2_000_000,
  scanChunkPixels = 32_768,
  yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
} = {}) {
  if (!worker) {
    return inpaintTiledPixelBufferSourceCooperative(source, {
      isAllowed, isCancelled, maxBytes, maxFillPixels, scanChunkPixels, yieldControl,
    });
  }
  if (typeof isAllowed !== 'function' || typeof isCancelled !== 'function' ||
      typeof yieldControl !== 'function' || typeof worker.run !== 'function') {
    throw new TypeError('Tiled inpaint: invalid Worker selection callbacks');
  }
  // Validate source and budget before any geometry sampling or Worker dispatch.
  const working = createSerializedPixelBufferTileWorkingSet(source, { maxBytes });
  if (!working) return null;
  const { width, height } = working;
  const total = width * height;
  const indices = [];
  let selected = 0;
  const chunk = Math.max(1, Math.min(262_144, Math.trunc(Number(scanChunkPixels) || 32_768)));
  const cancelled = () => ({
    source, changed:0, filled:0, changedTiles:0, loadedTiles:0, cancelled:true,
  });
  const unchanged = () => ({ source, changed:0, filled:0, changedTiles:0, loadedTiles:0 });

  for (let start = 0; start < total; start += chunk) {
    if (isCancelled()) return cancelled();
    if (start > 0) {
      await yieldControl();
      if (isCancelled()) return cancelled();
    }
    for (let index = start; index < Math.min(total, start + chunk); index += 1) {
      const y = Math.floor(index / width), x = index - y * width;
      if (!isAllowed(x, y)) continue;
      selected += 1;
      if (selected <= maxFillPixels) indices.push(index);
    }
  }
  if (isCancelled()) return cancelled();
  // Preserve existing native semantics: empty/full selection is a no-op,
  // even when full selection exceeds the bounded maxFillPixels.
  if (!selected || selected === total) return unchanged();
  if (selected > maxFillPixels) {
    throw new RangeError('Контент-заливка: выделено больше безопасного лимита ' + maxFillPixels + ' px');
  }
  const job = { source, selectedIndices:Uint32Array.from(indices), maxBytes, maxFillPixels };
  const result = await worker.run(job, { isCurrent:() => !isCancelled() });
  if (isCancelled() || result?.cancelled) return cancelled();
  if (result?.unavailable) {
    // Use the SAME frozen snapshot: do not call a mutable predicate twice.
    return inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
      ...job, isCancelled, yieldControl,
    });
  }
  return assertTiledInpaintWorkerResult(result, source, job.selectedIndices);
}
