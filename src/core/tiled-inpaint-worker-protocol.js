import { inpaintTiledPixelBufferSource } from './pixel-buffer.js';

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
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || !Number.isSafeInteger(total)) {
    throw new RangeError('Tiled inpaint Worker: invalid source geometry');
  }
  const selected = new Set();
  for (const index of selectedIndices) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= total || selected.has(index)) {
      throw new RangeError('Tiled inpaint Worker: invalid or duplicate selected index');
    }
    selected.add(index);
  }
  return inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => selected.has(y * width + x),
    halo:job.halo,
    maxLayerPixels:job.maxLayerPixels,
    maxFillPixels:job.maxFillPixels,
    maxBytes:job.maxBytes,
  });
}
