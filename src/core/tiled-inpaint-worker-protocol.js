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
  const result = inpaintTiledPixelBufferSourceFromIndices(job.source, {
    selectedIndices:job.selectedIndices,
    halo:job.halo,
    maxLayerPixels:job.maxLayerPixels,
    maxFillPixels:job.maxFillPixels,
    maxBytes:job.maxBytes,
  });
  if (job.compactResult !== true) return result;
  // The UI still owns every unchanged native Data URL. Returning the full
  // source structured-clones all of those strings back from the Worker,
  // although the fill kernel only modified a small subset of tiles.
  const tileUpdates = [];
  for (let index = 0; index < result.source.tiles.length; index += 1) {
    const after = result.source.tiles[index];
    if (after.dataUrl !== job.source.tiles[index].dataUrl) {
      tileUpdates.push({ index, dataUrl:after.dataUrl });
    }
  }
  const { source, ...counts } = result;
  return { ...counts, tileUpdates };
}
