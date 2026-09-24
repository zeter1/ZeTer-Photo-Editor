import { applyAdvancedColorAdjustments, advancedColorWorkerSource, hasAdvancedColorAdjustments } from './color.js';

export const ADVANCED_COLOR_WORKER_MIN_PIXELS = 512 * 512;
const PIXEL_WORKER_TIMEOUT_MS = 45_000;
const PIXEL_WORKER_MAX_PENDING = 2;

let worker = null;
let workerUrl = null;
let nextRequestId = 1;
const pending = new Map();

export function pixelWorkerSupported() {
  return typeof Worker === 'function'
    && typeof Blob === 'function'
    && typeof URL?.createObjectURL === 'function';
}

function releaseWorkerUrl() {
  if (!workerUrl) return;
  try { URL.revokeObjectURL(workerUrl); } catch {}
  workerUrl = null;
}

function rejectPending(error) {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(error);
  }
  pending.clear();
}

export function resetPixelWorker(reason = new Error('Pixel worker reset')) {
  rejectPending(reason instanceof Error ? reason : new Error(String(reason)));
  try { worker?.terminate(); } catch {}
  worker = null;
  releaseWorkerUrl();
}

function ensurePixelWorker() {
  if (worker) return worker;
  if (!pixelWorkerSupported()) return null;
  try {
    const blob = new Blob([advancedColorWorkerSource()], { type: 'text/javascript' });
    workerUrl = URL.createObjectURL(blob);
    worker = new Worker(workerUrl, { name: 'zpe-pixel-worker' });
    worker.addEventListener('message', event => {
      const message = event.data || {};
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) {
        request.reject(new Error(message.error));
        return;
      }
      request.resolve(message.buffer);
    });
    worker.addEventListener('error', event => {
      const error = new Error(`Pixel worker error: ${event.message || 'unknown error'}`);
      resetPixelWorker(error);
    });
    worker.addEventListener('messageerror', () => resetPixelWorker(new Error('Pixel worker message could not be deserialized')));
    return worker;
  } catch (error) {
    resetPixelWorker(error);
    return null;
  }
}

function rebuildImageData(original, buffer) {
  const data = new Uint8ClampedArray(buffer);
  const width = Number(original?.width) || 0;
  const height = Number(original?.height) || 0;
  if (typeof ImageData === 'function' && width > 0 && height > 0 && data.length === width * height * 4) {
    return new ImageData(data, width, height);
  }
  return { data, width, height };
}

function syncAdjust(imageData, filters) {
  applyAdvancedColorAdjustments(imageData, filters);
  return imageData;
}

async function runWorker(imageData, filters) {
  const target = ensurePixelWorker();
  if (!target || pending.size >= PIXEL_WORKER_MAX_PENDING) return null;

  const source = imageData.data;
  const transferable = source.byteOffset === 0 && source.byteLength === source.buffer.byteLength
    ? source
    : new Uint8ClampedArray(source);
  const id = nextRequestId++;
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      const error = new Error('Pixel worker timed out');
      reject(error);
      resetPixelWorker(error);
    }, PIXEL_WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
  });

  try {
    target.postMessage({ id, buffer: transferable.buffer, filters }, [transferable.buffer]);
  } catch (error) {
    const request = pending.get(id);
    if (request) {
      pending.delete(id);
      clearTimeout(request.timer);
      request.reject(error);
    }
  }
  return rebuildImageData(imageData, await result);
}

export async function applyAdvancedColorAdjustmentsAsync(imageData, filters = {}, {
  forceWorker = false,
  recover = null,
} = {}) {
  if (!imageData?.data || !hasAdvancedColorAdjustments(filters)) return imageData;
  const pixelCount = Math.floor(imageData.data.length / 4);
  if (!forceWorker && pixelCount < ADVANCED_COLOR_WORKER_MIN_PIXELS) return syncAdjust(imageData, filters);
  if (!pixelWorkerSupported() || pending.size >= PIXEL_WORKER_MAX_PENDING) return syncAdjust(imageData, filters);

  try {
    const processed = await runWorker(imageData, filters);
    if (processed) return processed;
    return syncAdjust(imageData, filters);
  } catch (error) {
    if (imageData.data?.byteLength) return syncAdjust(imageData, filters);
    if (typeof recover === 'function') {
      const recovered = recover();
      return syncAdjust(recovered, filters);
    }
    throw error;
  }
}
