// Test-only instrumentation: SharedArrayBuffer exposes *kernel progress*, not
// document publication. Production tiled Worker jobs own private cloned tiles.
import { parentPort } from 'node:worker_threads';
import { inpaintSelectedSamples } from '../../src/core/inpaint.js';

if (!parentPort) throw new Error('Must run in a Worker');
parentPort.on('message', job => {
  const id = job?.id;
  try {
    const { width, height, shared, minX, minY, maxX, maxY } = job;
    const samples = new Uint16Array(shared);
    const filled = inpaintSelectedSamples(samples, width, height, 3, {
      isAllowed:(x, y) => x >= minX && x < maxX && y >= minY && y < maxY,
      maxLayerPixels:width * height,
      maxFillPixels:(maxX - minX) * (maxY - minY),
      sampleRadius:6,
      // Keep the probe on the deterministic boundary kernel: do not turn
      // a test of termination into a PatchMatch performance benchmark.
      patchMatchMaxFillPixels:1,
    });
    parentPort.postMessage({ id, ok:true, result:{ filled } });
  } catch (error) {
    parentPort.postMessage({
      id, ok:false,
      error:{ name:error?.name || 'Error', message:String(error?.message || error) },
    });
  }
});
parentPort.postMessage({ ready:true });
