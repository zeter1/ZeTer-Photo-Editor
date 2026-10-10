import { inpaintTiledPixelBufferSourceFromIndices } from './pixel-buffer.js';

/**
 * Detached, structured-clone-friendly tiled inpaint compute contract.
 * The caller freezes selection indices before dispatch. The native kernel
 * consumes them directly without scanning every pixel a second time.
 * Live document/layer objects and selection predicates never cross the Worker.
 *
 * The classic file:// Worker source is generated from this module. UI wiring
 * and exact-owner cancellation remain separate Stage 003 work.
 */
export function runTiledInpaintWorkerJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    throw new TypeError('Tiled inpaint Worker: job object is required');
  }
  return inpaintTiledPixelBufferSourceFromIndices(job.source, {
    selectedIndices:job.selectedIndices,
    halo:job.halo,
    maxLayerPixels:job.maxLayerPixels,
    maxFillPixels:job.maxFillPixels,
    maxBytes:job.maxBytes,
  });
}
