import {
  createSerializedPixelBufferTileWorkingSet,
  isCanonicalPixelBufferBase64,
  inpaintTiledPixelBufferSourceCooperative,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
} from '../core/pixel-buffer.js';
import { dataUrlToBytes } from '../core/io.js';


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
  // One bit per document pixel (at most 2 MiB with the 48 MiB source cap),
  // avoiding a multi-million-element Set of selected coordinates.
  const selectedBits = new Uint8Array(Math.ceil(source.width * source.height / 8));
  for (const index of selectedIndices) {
    const x = index % source.width, y = Math.floor(index / source.width);
    editableTiles.add(Math.floor(y / source.tileSize) * columns + Math.floor(x / source.tileSize));
    selectedBits[index >> 3] |= 1 << (index & 7);
  }

  const pixelBytes = source.channels * source.bitsPerChannel / 8;
  // Content-Aware Fill is a color operation: even selected pixels must retain
  // their original native alpha samples byte-for-byte (RGB and CMYK).
  const alphaBytes = source.channels === (source.model === 'cmyk' ? 5 : 4)
    ? source.bitsPerChannel / 8 : 0;
  let changedTilePayloads = 0;
  let changedPixels = 0;
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
    if (!isCanonicalPixelBufferBase64(encoded, before.rawBytes)) throw invalid();

    // A selected tile may contain unselected donor pixels. Compare the exact
    // native little-endian bytes, not a lossy 8-bit preview or float values.
    // Only changed tiles are decoded; memory is bounded to two tile payloads.
    let originalBytes, returnedBytes;
    try {
      originalBytes = dataUrlToBytes(before.dataUrl, { maxBytes:before.rawBytes });
      returnedBytes = dataUrlToBytes(after.dataUrl, { maxBytes:before.rawBytes });
    } catch { throw invalid(); }
    if (originalBytes.length !== before.rawBytes ||
        returnedBytes.length !== before.rawBytes) throw invalid();
    // Reuse a single view per changed tile (up to millions of selected pixels).
    const returnedFloatView = source.bitsPerChannel === 32
      ? new DataView(returnedBytes.buffer, returnedBytes.byteOffset, returnedBytes.byteLength)
      : null;
    let tilePixelChanges = 0;
    for (let local = 0; local < before.width * before.height; local += 1) {
      const offset = local * pixelBytes;
      let different = false;
      for (let byte = 0; byte < pixelBytes; byte += 1) {
        if (originalBytes[offset + byte] !== returnedBytes[offset + byte]) {
          different = true;
          break;
        }
      }
      if (!different) continue;
      // A malformed Worker must never change opacity or poison the saved
      // Float32 document with NaN/Infinity. HDR values >1 remain permitted.
      for (let byte = pixelBytes - alphaBytes; byte < pixelBytes; byte += 1) {
        if (originalBytes[offset + byte] !== returnedBytes[offset + byte]) throw invalid();
      }
      if (returnedFloatView) {
        for (let channel = 0; channel < source.channels - (alphaBytes ? 1 : 0); channel += 1) {
          if (!Number.isFinite(returnedFloatView.getFloat32(offset + channel * 4, true))) throw invalid();
        }
      }
      const globalX = before.x + local % before.width;
      const globalY = before.y + Math.floor(local / before.width);
      const global = globalY * source.width + globalX;
      if (!(selectedBits[global >> 3] & (1 << (global & 7)))) throw invalid();
      tilePixelChanges += 1;
    }
    if (!tilePixelChanges) throw invalid();
    changedPixels += tilePixelChanges;
    changedTilePayloads += 1;
  }
  if (changedTilePayloads !== result.changedTiles || changedPixels !== result.changed) throw invalid();
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
  onTiming = null, // opt-in monotonic observer; must not affect compute
} = {}) {
  // Refuse over-budget sources before the first selection predicate call,
  // cooperative yield or Worker message. Returning null here used to send the
  // caller into a second (contiguous) native fallback, hiding the budget error.
  if (Number.isSafeInteger(maxBytes) && Number.isSafeInteger(source?.rawBytes) &&
      source.rawBytes > maxBytes) {
    throw new RangeError('Контент-заливка: native source превышает доступный лимит памяти (' +
      source.rawBytes + ' > ' + maxBytes + ' байт)');
  }
  if (!worker) {
    return inpaintTiledPixelBufferSourceCooperative(source, {
      isAllowed, isCancelled, maxBytes, maxFillPixels, scanChunkPixels, yieldControl,
    });
  }
  if (typeof isAllowed !== 'function' || typeof isCancelled !== 'function' ||
      typeof yieldControl !== 'function' || typeof worker.run !== 'function') {
    throw new TypeError('Tiled inpaint: invalid Worker selection callbacks');
  }
  const working = createSerializedPixelBufferTileWorkingSet(source, { maxBytes });
  if (!working) throw new TypeError('Tiled inpaint: invalid native source');
  const { width, height } = working;
  const total = width * height;
  // The Worker protocol uses Uint32 indices. Never allocate a huge JS
  // number[] plus a second typed copy while freezing the UI selection.
  if (!Number.isSafeInteger(total) || total < 1 || total > 0x1_0000_0000 ||
      !Number.isSafeInteger(maxFillPixels) || maxFillPixels < 1) {
    throw new RangeError('Tiled inpaint: unsafe selection size or maxFillPixels');
  }
  const maxStored = Math.min(total, maxFillPixels);
  let indices = new Uint32Array(0);
  let selected = 0;
  function storeSelected(index) {
    if (selected > maxStored) return;
    if (selected > indices.length) {
      // Geometric growth, capped to the admissible selection; tiny sparse
      // regions never reserve the entire multi-million-pixel fill budget.
      const capacity = Math.min(maxStored, Math.max(selected,
        indices.length ? indices.length * 2 : 32));
      const next = new Uint32Array(capacity);
      next.set(indices);
      indices = next;
    }
    indices[selected - 1] = index;
  }
  const emitTiming = (phase, selectedPixels = null) => {
    if (typeof onTiming !== 'function') return;
    try {
      const atMs = globalThis.performance?.now?.();
      if (Number.isFinite(atMs)) onTiming({ phase, atMs, selectedPixels });
    } catch { /* instrumentation is strictly observational */ }
  };
  const chunk = Math.max(1, Math.min(262_144, Math.trunc(Number(scanChunkPixels) || 32_768)));
  const cancelled = () => ({
    source, changed:0, filled:0, changedTiles:0, loadedTiles:0, cancelled:true,
  });
  const unchanged = () => ({ source, changed:0, filled:0, changedTiles:0, loadedTiles:0 });

  emitTiming('selection-start');
  for (let start = 0; start < total; start += chunk) {
    if (isCancelled()) return cancelled();
    if (start > 0) {
      await yieldControl();
      if (isCancelled()) return cancelled();
    }
    const end = Math.min(total, start + chunk);
    for (let index = start; index < end; index += 1) {
      // A synchronous owner/session cancellation can arise inside isAllowed.
      // Honor it within a bounded number of predicates even for a large chunk.
      if (index !== start && ((index - start) & 63) === 0 && isCancelled()) return cancelled();
      const y = Math.floor(index / width), x = index - y * width;
      if (!isAllowed(x, y)) continue;
      selected += 1;
      storeSelected(index);
    }
  }
  emitTiming('selection-end', selected);
  if (isCancelled()) return cancelled();
  // Preserve existing native semantics: empty/full selection is a no-op,
  // even when full selection exceeds the bounded maxFillPixels.
  if (!selected || selected === total) return unchanged();
  if (selected > maxFillPixels) {
    throw new RangeError('Контент-заливка: выделено больше безопасного лимита ' + maxFillPixels + ' px');
  }
  // Detach a compact, exact-length immutable snapshot from any spare buffer
  // capacity; no transient JS Array of pixel indices is ever constructed.
  const selectedIndices = indices.length === selected ? indices : indices.slice(0, selected);
  const job = { source, selectedIndices, maxBytes, maxFillPixels };
  emitTiming('worker-run-start', selected);
  const result = await worker.run(job, { isCurrent:() => !isCancelled() });
  if (isCancelled() || result?.cancelled) return cancelled();
  if (result?.unavailable) {
    // Only a pure supplier failure may trigger fallback. A Worker reply that
    // mixes an unavailable flag with native payloads is a protocol failure.
    if (result.unavailable !== true || Object.keys(result).length !== 1) {
      throw new TypeError('Tiled inpaint: invalid Worker result');
    }
    // Use the SAME frozen snapshot: do not call a mutable predicate twice.
    return inpaintTiledPixelBufferSourceFromIndicesCooperative(source, {
      ...job, isCancelled, yieldControl,
    });
  }
  return assertTiledInpaintWorkerResult(result, source, job.selectedIndices);
}
