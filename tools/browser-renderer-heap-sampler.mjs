// Informational CDP renderer-heap samples. Worker heaps, native allocations and
// process RSS are NOT represented by JSHeapUsedSize; sampled max != true peak.
export function createBrowserRendererHeapSampler(client, {
  intervalMs = 50,
  now = () => performance.now(),
  schedule = setInterval,
  unschedule = clearInterval,
} = {}) {
  if (!client || typeof client.send !== 'function' || !Number.isFinite(intervalMs) || intervalMs < 1) {
    throw new TypeError('Browser renderer heap sampler: invalid CDP client/interval');
  }
  const samples = [];
  let timer = null;
  let pending = null;
  let active = false;
  let pollError = null;

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
      return {
        metric:'CDP Performance.getMetrics / renderer JSHeapUsedSize',
        limitations:'Informational sampled main-frame JS heap only; NOT Worker heap, process RSS, native buffers or true instantaneous peak. No timing/memory pass thresholds.',
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
