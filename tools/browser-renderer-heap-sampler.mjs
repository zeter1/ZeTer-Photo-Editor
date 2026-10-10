// Informational CDP renderer-heap samples. Worker heaps, native allocations and
// process RSS are NOT represented by JSHeapUsedSize; sampled max != true peak.
// An optional browser-level CDP connection can sample Chromium's reported
// privateMemory for its process list; this is not an isolated Worker peak.
export function createBrowserRendererHeapSampler(client, {
  intervalMs = 50,
  processClient = null,
  now = () => performance.now(),
  schedule = setInterval,
  unschedule = clearInterval,
} = {}) {
  if (!client || typeof client.send !== 'function' ||
      (processClient !== null && typeof processClient?.send !== 'function') ||
      !Number.isFinite(intervalMs) || intervalMs < 1) {
    throw new TypeError('Browser renderer heap sampler: invalid CDP client/interval');
  }
  const samples = [];
  let timer = null;
  let pending = null;
  let active = false;
  let pollError = null;
  let processUnavailableReason = null;

  async function snapshot(phase) {
    const { metrics } = await client.send('Performance.getMetrics');
    if (!Array.isArray(metrics)) throw new Error('Browser renderer heap sampler: missing metrics');
    const values = new Map(metrics.map(metric => [metric.name, metric.value]));
    const used = values.get('JSHeapUsedSize');
    const total = values.get('JSHeapTotalSize');
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total < used) {
      throw new Error('Browser renderer heap sampler: invalid JS heap metrics');
    }
    const entry = { phase, elapsedMs:now(), jsHeapUsedBytes:used, jsHeapTotalBytes:total };
    if (processClient && !processUnavailableReason) {
      try {
        const info = await processClient.send('SystemInfo.getProcessInfo');
        const processes = info?.processInfo;
        // Never advertise a partial sum as the memory of the whole browser.
        if (!Array.isArray(processes) || !processes.length ||
            processes.some(item => !Number.isSafeInteger(item?.privateMemory) || item.privateMemory < 0)) {
          throw new Error('Chromium did not expose complete process privateMemory counters');
        }
        const sum = processes.reduce((bytes, item) => bytes + item.privateMemory, 0);
        if (!Number.isSafeInteger(sum)) throw new Error('Chromium process privateMemory sum overflowed');
        entry.processPrivateMemoryBytes = sum;
        entry.processCount = processes.length;
      } catch (error) {
        // Older Chromium/CDP implementations may omit SystemInfo or the
        // privateMemory field. Heap sampling must still complete normally.
        processUnavailableReason = String(error?.message || error);
      }
    }
    samples.push(entry);
    return entry;
  }

  function poll() {
    if (!active || pending) return;
    pending = snapshot('sample')
      .catch(error => { pollError ??= error; })
      .finally(() => { pending = null; });
  }

  return {
    async start() {
      if (active || samples.length) throw new Error('Browser renderer heap sampler: already started');
      await client.send('Performance.enable');
      active = true;
      try {
        await snapshot('before-import');
        timer = schedule(poll, intervalMs);
      } catch (error) {
        active = false;
        if (timer !== null) unschedule(timer);
        throw error;
      }
    },
    snapshot,
    async stop() {
      if (!active) throw new Error('Browser renderer heap sampler: not running');
      active = false;
      if (timer !== null) unschedule(timer);
      if (pending) await pending;
      const end = await snapshot('finished');
      if (pollError) throw pollError;
      const baseline = samples[0];
      const peak = samples.reduce((best, item) => item.jsHeapUsedBytes > best.jsHeapUsedBytes ? item : best);
      const processSamples = samples.filter(item => Number.isSafeInteger(item.processPrivateMemoryBytes));
      const processPeak = processSamples.reduce((best, item) =>
        !best || item.processPrivateMemoryBytes > best.processPrivateMemoryBytes ? item : best, null);
      const processBaseline = processSamples[0] ?? null;
      const processEnd = processSamples.at(-1) ?? null;
      return {
        metric:'CDP Performance.getMetrics / renderer JSHeapUsedSize',
        limitations:'Informational sampled main-frame JS heap, plus optional aggregate Chromium process private memory. NOT isolated Worker heap, true RSS/HWM, native/GPU breakdown or instantaneous peak. No timing/memory pass thresholds.',
        chromiumProcesses: {
          metric:'CDP SystemInfo.getProcessInfo / sum of privateMemory over complete reported process list',
          availability:!processClient ? 'not-requested' : processUnavailableReason ? 'unavailable' : 'sampled',
          unavailableReason:processUnavailableReason,
          sampleCount:processSamples.length,
          baselinePrivateBytes:processBaseline?.processPrivateMemoryBytes ?? null,
          sampledMaxPrivateBytes:processPeak?.processPrivateMemoryBytes ?? null,
          endPrivateBytes:processEnd?.processPrivateMemoryBytes ?? null,
          sampledIncreaseBytes:processPeak ? Math.max(0, processPeak.processPrivateMemoryBytes - processBaseline.processPrivateMemoryBytes) : null,
          maxSampledProcessCount:processSamples.reduce((max, item) => Math.max(max, item.processCount), 0),
        },
        sampleCount:samples.length,
        baselineJsHeapUsedBytes:baseline.jsHeapUsedBytes,
        sampledMaxJsHeapUsedBytes:peak.jsHeapUsedBytes,
        endJsHeapUsedBytes:end.jsHeapUsedBytes,
        sampledIncreaseBytes:Math.max(0, peak.jsHeapUsedBytes - baseline.jsHeapUsedBytes),
        stages:samples.filter(item => item.phase !== 'sample'),
      };
    },
  };
}
