/**
 * Stage 003: detached tiled inpaint Worker lifecycle (not yet used by the UI).
 *
 * No live document objects cross the boundary. A new job supersedes the old
 * worker, and a caller must call cancel() when its document/target changes.
 * isCurrent is checked before dispatch and again before accepting a result;
 * worker.terminate() is the only mid-kernel stop mechanism at this stage.
 *
 * Accept both browser Worker events and Node worker_threads events, allowing
 * the same owner/cancellation contract to be tested without a browser Worker
 * bootstrap (file:// module Worker loading is not supported by this seam).
 */
export function createTiledInpaintWorkerJobController({ createWorker } = {}) {
  if (typeof createWorker !== 'function') {
    throw new TypeError('Tiled inpaint Worker: createWorker is required');
  }
  let active = null;
  let nextId = 0;

  function cancel() {
    if (!active) return false;
    active.cancel();
    return true;
  }

  function run(job, { isCurrent = () => true } = {}) {
    // Superseding a job must stop it even if the new request is stale.
    cancel();
    if (typeof isCurrent !== 'function') {
      return Promise.reject(new TypeError('Tiled inpaint Worker: isCurrent must be a function'));
    }
    const current = () => {
      try { return Boolean(isCurrent()); } catch { return false; }
    };
    if (!current()) return Promise.resolve({ cancelled:true });

    let worker;
    try {
      worker = createWorker();
      if (!worker || typeof worker.postMessage !== 'function' ||
          typeof worker.terminate !== 'function') {
        throw new TypeError('Tiled inpaint Worker: invalid Worker instance');
      }
    } catch (error) {
      return Promise.reject(error);
    }
    const id = ++nextId;

    return new Promise((resolve, reject) => {
      let settled = false;
      let dispatched = false;
      let detach = () => {};
      const terminate = () => {
        try {
          const result = worker.terminate();
          // Node returns a Promise; a failed termination cannot turn a
          // cancelled/stale result into an unhandled rejection.
          if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch { /* the result is already settled; never publish it */ }
      };
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        detach();
        if (active?.id === id) active = null;
        terminate();
        if (error) reject(error);
        else resolve(result);
      };
      const stop = () => finish({ cancelled:true });
      const fail = error => finish(null, error instanceof Error ? error : new Error(String(error?.message || error)));
      const message = data => {
        if (settled) return;
        if (!current()) { stop(); return; }
        if (!dispatched) {
          if (data?.ready !== true) return;
          dispatched = true;
          try { worker.postMessage({ ...job, id }); }
          catch (error) { fail(error); }
          return;
        }
        if (data?.id !== id) return;
        if (data.ok === true) {
          finish(data.result);
        } else if (data.ok === false) {
          const error = new Error(String(data.error?.message || 'Worker compute failed'));
          error.name = String(data.error?.name || 'Error');
          fail(error);
        } else {
          fail(new TypeError('Tiled inpaint Worker: invalid reply'));
        }
      };

      // Subscribe may synchronously emit ready/error (or a test double may
      // answer in postMessage). Register ownership and detachment first so
      // a reentrant finish can clear the active job and release every listener.
      active = { id, cancel:stop };
      try {
        if (typeof worker.addEventListener === 'function') {
          const onMessage = event => message(event.data);
          const onError = event => fail(new Error(String(event?.message || 'Worker error')));
          detach = () => {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
          };
          worker.addEventListener('message', onMessage);
          worker.addEventListener('error', onError);
        } else if (typeof worker.on === 'function' && typeof worker.off === 'function') {
          const onMessage = data => message(data);
          const onError = error => fail(error);
          const onExit = code => fail(new Error('Tiled inpaint Worker exited before reply: ' + code));
          detach = () => {
            worker.off('message', onMessage);
            worker.off('error', onError);
            worker.off('exit', onExit);
          };
          worker.on('message', onMessage);
          worker.on('error', onError);
          worker.on('exit', onExit);
        } else {
          fail(new TypeError('Tiled inpaint Worker: missing message event API'));
          return;
        }
      } catch (error) {
        fail(error);
        return;
      }
      // A callback could have settled mid-subscription, before all handlers
      // were registered: remove the late registrations as well.
      if (settled) { detach(); return; }
      // An owner can change synchronously inside a Worker factory/subscription.
      if (!current()) stop();
    });
  }

  return { run, cancel };
}
