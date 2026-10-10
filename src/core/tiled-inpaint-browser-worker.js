import { createTiledInpaintWorkerJobController } from './tiled-inpaint-worker-client.js';

/**
 * Browser file:// adapter for the generated classic tiled-inpaint Worker.
 * No ESM importScripts/fetch is issued by the Worker. A failed bootstrap is
 * reported as { unavailable:true } so the caller can use cooperative compute;
 * protocol/compute errors still reject instead of silently changing results.
 */
export function createBrowserTiledInpaintWorkerController({
  documentRef = globalThis.document,
  globalRef = globalThis,
  WorkerType = globalThis.Worker,
  BlobType = globalThis.Blob,
  URLApi = globalThis.URL,
  loadTimeoutMs = 5000,
} = {}) {
  const supplierName = '__zpeTiledInpaintWorkerSource';
  let sourcePromise = null;
  let source = null;
  let unavailable = false;
  let generation = 0;

  const currentSource = () => {
    const value = globalRef?.[supplierName];
    return typeof value === 'string' && value.startsWith('/* ZeTer tiled Content-Aware Worker.')
      ? value : null;
  };

  function loadSource() {
    if (unavailable) return Promise.resolve(null);
    if (source) return Promise.resolve(source);
    if (typeof WorkerType !== 'function' || typeof BlobType !== 'function' ||
        typeof URLApi?.createObjectURL !== 'function' || typeof URLApi?.revokeObjectURL !== 'function') {
      unavailable = true;
      return Promise.resolve(null);
    }
    const existing = currentSource();
    if (existing) { source = existing; return Promise.resolve(source); }
    if (sourcePromise) return sourcePromise;
    if (!documentRef?.createElement || !documentRef?.head?.appendChild) {
      unavailable = true;
      return Promise.resolve(null);
    }
    sourcePromise = new Promise(resolve => {
      let script;
      let timer;
      let finished = false;
      const finish = candidate => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (script) {
          script.onload = null;
          script.onerror = null;
          script.remove?.();
        }
        source = candidate;
        if (!candidate) unavailable = true;
        resolve(candidate);
      };
      try {
        script = documentRef.createElement('script');
        script.async = true;
        script.onload = () => finish(currentSource());
        script.onerror = () => finish(null);
        script.src = new URL('./src/core/tiled-inpaint-worker-source.js', documentRef.baseURI).href;
        timer = setTimeout(() => finish(null), Math.max(1, Number(loadTimeoutMs) || 5000));
        documentRef.head.appendChild(script);
      } catch {
        finish(null);
      }
    });
    return sourcePromise;
  }

  class BootstrapUnavailableError extends Error {}
  const client = createTiledInpaintWorkerJobController({
    // Exact-owner checks must terminate a stale in-flight computation even
    // when the Worker is CPU-bound and cannot send another message.
    pollIntervalMs:50,
    createWorker() {
      let url;
      try {
        url = URLApi.createObjectURL(new BlobType([source], { type:'text/javascript' }));
        return new WorkerType(url);
      } catch (error) {
        unavailable = true;
        throw new BootstrapUnavailableError(String(error?.message || error));
      } finally {
        if (url) {
          try { URLApi.revokeObjectURL(url); } catch { /* resource already handed to Worker */ }
        }
      }
    },
  });

  function cancel() {
    generation += 1;
    return client.cancel();
  }

  async function run(job, { isCurrent = () => true } = {}) {
    const owner = ++generation;
    client.cancel();
    if (typeof isCurrent !== 'function') throw new TypeError('Tiled inpaint Worker: isCurrent must be a function');
    const current = () => {
      try { return owner === generation && Boolean(isCurrent()); }
      catch { return false; }
    };
    if (!current()) return { cancelled:true };
    const ready = await loadSource();
    if (!current()) return { cancelled:true };
    if (!ready) return { unavailable:true };
    try {
      return await client.run(job, { isCurrent:current });
    } catch (error) {
      if (error instanceof BootstrapUnavailableError) return current() ? { unavailable:true } : { cancelled:true };
      throw error;
    }
  }

  return { run, cancel };
}
