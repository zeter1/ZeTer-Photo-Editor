import { parentPort } from 'node:worker_threads';
import { runTiledInpaintWorkerJob } from '../src/core/tiled-inpaint-worker-protocol.js';

// Node worker_threads harness: verifies structured-clone transport and
// off-main-thread execution, not browser file:// Worker availability.
if (!parentPort) throw new Error('This entrypoint must run inside a Worker');
parentPort.on('message', job => {
  const id = Number.isSafeInteger(job?.id) ? job.id : null;
  try {
    parentPort.postMessage({ id, ok:true, result:runTiledInpaintWorkerJob(job) });
  } catch (error) {
    parentPort.postMessage({
      id, ok:false,
      error:{ name:error?.name || 'Error', message:String(error?.message || error) },
    });
  }
});
parentPort.postMessage({ ready:true });
