import { inpaintTiledPixelBufferSource, MAX_PIXEL_BUFFER_SOURCE_BYTES } from './pixel-buffer.js';

/**
 * A structured-clone-friendly, DOM-free proof of the tiled inpaint compute
 * contract. The caller freezes selection indices before dispatch; no functions
 * or live document/layer references cross the Worker boundary.
 *
 * This module is deliberately NOT wired into the file:// browser bundle yet.
 */
export function runTiledInpaintWorkerJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    throw new TypeError('Tiled inpaint Worker: job object is required');
  }
  const { source, selectedIndices } = job;
  if (!Array.isArray(selectedIndices) && !(selectedIndices instanceof Uint32Array)) {
    throw new TypeError('Tiled inpaint Worker: frozen selection indices must be an Array or Uint32Array');
  }
  const width = Number(source?.width);
  const height = Number(source?.height);
  const total = width * height;
  // Every supported source fits in the global 48 MiB precision budget. Even
  // at the smallest supported 8-bit RGB depth this bounds the pixel count,
  // preventing a malformed geometry from allocating an enormous bitmap.
  const maxPixels = Math.floor(MAX_PIXEL_BUFFER_SOURCE_BYTES / 3);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || !Number.isSafeInteger(total) || total > maxPixels) {
    throw new RangeError('Tiled inpaint Worker: invalid source geometry');
  }
  if (selectedIndices.length > total) {
    throw new RangeError('Tiled inpaint Worker: invalid or duplicate selected index');
  }
  // A Set of up to 2 million JS numbers consumed tens of MiB on top of the
  // cloned source. One bit per pixel gives O(1) membership/duplicate checks
  // with a bounded <= 2 MiB working allocation for any supported source.
  const selectedBits = new Uint8Array(Math.ceil(total / 8));
  for (const index of selectedIndices) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= total) {
      throw new RangeError('Tiled inpaint Worker: invalid or duplicate selected index');
    }
    const byte = Math.floor(index / 8), bit = 1 << (index % 8);
    if (selectedBits[byte] & bit) {
      throw new RangeError('Tiled inpaint Worker: invalid or duplicate selected index');
    }
    selectedBits[byte] |= bit;
  }
  return inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => {
      const index = y * width + x;
      return (selectedBits[Math.floor(index / 8)] & (1 << (index % 8))) !== 0;
    },
    halo:job.halo,
    maxLayerPixels:job.maxLayerPixels,
    maxFillPixels:job.maxFillPixels,
    maxBytes:job.maxBytes,
  });
}
