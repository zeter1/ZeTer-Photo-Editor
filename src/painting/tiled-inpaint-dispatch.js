import {
  createSerializedPixelBufferTileWorkingSet,
  inpaintTiledPixelBufferSourceCooperative,
  inpaintTiledPixelBufferSourceFromIndicesCooperative,
} from '../core/pixel-buffer.js';

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
  if (!result || typeof result !== 'object' || typeof result.changed !== 'number') {
    throw new TypeError('Tiled inpaint: invalid Worker result');
  }
  return result;
}
