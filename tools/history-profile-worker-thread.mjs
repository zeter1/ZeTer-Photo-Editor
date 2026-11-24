// Measurement adapter around the unchanged production compute protocol.
// Samples are isolate-local heap/ArrayBuffers; rss remains PROCESS-wide.
import { parentPort } from 'node:worker_threads';
import { runTiledInpaintWorkerJob } from '../src/core/tiled-inpaint-worker-protocol.js';
if (!parentPort) throw new Error('History profile adapter requires a Worker');
parentPort.on('message', job => {
  const sample = phase => parentPort.postMessage({ profileMemory:{ phase, ...process.memoryUsage() } });
  sample('input-received');
  try {
    const result = runTiledInpaintWorkerJob(job);
    sample('result-ready');
    parentPort.postMessage({ id:job.id, ok:true, result });
  } catch (error) {
    parentPort.postMessage({ id:job.id, ok:false, error:{ name:error.name, message:error.message } });
  }
});
parentPort.postMessage({ ready:true });
