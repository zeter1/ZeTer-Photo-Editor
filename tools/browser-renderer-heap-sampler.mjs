import { sampleLinuxChromiumRss } from './browser-linux-process-rss.mjs';
import { createLinuxChromiumIdentityTracker } from './browser-linux-process-identity.mjs';

// Informational CDP renderer-heap samples. Worker heaps, native allocations and
// process RSS are NOT represented by JSHeapUsedSize; sampled max != true peak.
// An optional browser-level CDP connection can sample Chromium's reported
// privateMemory for its process list; this is not an isolated Worker peak.
export function createBrowserRendererHeapSampler(client, {
  intervalMs = 50,
  processClient = null,
  processRssSampler = sampleLinuxChromiumRss,
  now = () => performance.now(),
  schedule = setInterval,
  unschedule = clearInterval,
} = {}) {
  if (!client || typeof client.send !== 'function' ||
      (processClient !== null && typeof processClient?.send !== 'function') ||
      typeof processRssSampler !== 'function' ||
      !Number.isFinite(intervalMs) || intervalMs < 1) {
    throw new TypeError('Browser renderer heap sampler: invalid CDP client/interval');
  }
  const samples = [];
  let timer = null;
  let pending = null;
  let active = false;
  let pollError = null;
  let processUnavailableReason = null;
  let rssUnavailableReason = null;
  // CDP PID membership is independent of optional privateMemory and /proc
  // availability. A PID can be recycled: no cross-snapshot identity claim.
  let processIdentityUnavailableReason = null;
  let previousPids = null;
  const distinctPids = new Set();
  const processTypeMaximums = new Map();
  const pidMarkers = [];
  let newPidObservations = 0;
  let missingPidObservations = 0;
  let maxSampledPidCount = 0;
  let pidSampleCount = 0;
  const linuxIdentity = createLinuxChromiumIdentityTracker();
  let linuxIdentityUnavailableReason = null;

  // CDP reads can complete out of order when a periodic poll overlaps an
  // explicit stage marker or stop(). Queue reads in invocation order so the
  // recorded final sample is genuinely last, without discarding poll errors.
  let snapshotTail = Promise.resolve();
  async function readSnapshot(phase) {
    const { metrics } = await client.send('Performance.getMetrics');
    if (!Array.isArray(metrics)) throw new Error('Browser renderer heap sampler: missing metrics');
    const values = new Map(metrics.map(metric => [metric.name, metric.value]));
    const used = values.get('JSHeapUsedSize');
    const total = values.get('JSHeapTotalSize');
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total < used) {
      throw new Error('Browser renderer heap sampler: invalid JS heap metrics');
    }
    const entry = { phase, elapsedMs:now(), jsHeapUsedBytes:used, jsHeapTotalBytes:total };
    if (processClient && (!processUnavailableReason || !rssUnavailableReason || !processIdentityUnavailableReason)) {
      try {
        const info = await processClient.send('SystemInfo.getProcessInfo');
        const processes = info?.processInfo;
        if (!Array.isArray(processes) || !processes.length) {
          throw new Error('Chromium did not expose a complete process list');
        }
        if (!processIdentityUnavailableReason) {
          const ids = processes.map(item => item?.id);
          if (ids.some(pid => !Number.isSafeInteger(pid) || pid <= 0) ||
              new Set(ids).size !== ids.length) {
            processIdentityUnavailableReason = 'Invalid or duplicate CDP PID; cannot track process churn';
          } else {
            const current = new Set(ids);
            const newlySeen = previousPids
              ? ids.filter(pid => !previousPids.has(pid)).length : 0;
            const missing = previousPids
              ? [...previousPids].filter(pid => !current.has(pid)).length : 0;
            newPidObservations += newlySeen;
            missingPidObservations += missing;
            maxSampledPidCount = Math.max(maxSampledPidCount, ids.length);
            pidSampleCount += 1;
            for (const pid of ids) distinctPids.add(pid);
            const typeCounts = new Map();
            for (const process of processes) {
              const type = typeof process.type === 'string' && process.type
                ? process.type : 'unknown';
              typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
            }
            for (const [type, count] of typeCounts) {
              processTypeMaximums.set(type, Math.max(processTypeMaximums.get(type) || 0, count));
            }
            if (phase !== 'sample') {
              pidMarkers.push({ phase, processCount:ids.length,
                newlyObservedPids:newlySeen, missingPreviouslyObservedPids:missing });
            }
            previousPids = current;
          }
        }
        // CDP privateMemory is optional. Its absence MUST NOT suppress the
        // independent Linux VmRSS path when a usable PID list is available.
        if (!processUnavailableReason) {
          try {
            if (processes.some(item =>
              !Number.isSafeInteger(item?.privateMemory) || item.privateMemory < 0)) {
              throw new Error('Chromium did not expose complete process privateMemory counters');
            }
            const sum = processes.reduce((bytes, item) => bytes + item.privateMemory, 0);
            if (!Number.isSafeInteger(sum)) {
              throw new Error('Chromium process privateMemory sum overflowed');
            }
            entry.processPrivateMemoryBytes = sum;
            entry.processCount = processes.length;
          } catch (error) {
            processUnavailableReason = String(error?.message || error);
          }
        }
        if (!rssUnavailableReason) {
          try {
            const rss = await processRssSampler(processes);
            if (!rss?.supported) throw new Error(rss?.reason || 'unsupported /proc');
            if (!Number.isSafeInteger(rss.aggregateRssBytes) ||
                rss.aggregateRssBytes < 0 ||
                !Number.isSafeInteger(rss.largestProcessHighWaterBytes) ||
                rss.largestProcessHighWaterBytes < 0 ||
                rss.processCount !== processes.length) {
              throw new Error('invalid Linux Chromium RSS snapshot');
            }
            entry.chromiumRssBytes = rss.aggregateRssBytes;
            entry.largestProcessHighWaterBytes = rss.largestProcessHighWaterBytes;
            // Legacy synthetic RSS samplers may omit identity. Keep their valid
            // RSS metrics, but never claim starttime-verified attribution.
            if (!linuxIdentityUnavailableReason) {
              try { linuxIdentity.observe(rss.processSamples,phase); }
              catch (error) { linuxIdentityUnavailableReason=String(error?.message || error); }
            }
          } catch (error) {
            rssUnavailableReason = String(error?.message || error);
          }
        }
      } catch (error) {
        // No usable CDP process list: both OS RSS and privateMemory become
        // unavailable, but renderer-heap sampling remains functional.
        const reason = String(error?.message || error);
        processUnavailableReason ??= reason;
        rssUnavailableReason ??= reason;
        processIdentityUnavailableReason ??= reason;
      }
    }
    samples.push(entry);
    return entry;
  }

  function snapshot(phase) {
    const result = snapshotTail.then(() => readSnapshot(phase));
    // A failed explicit marker must reject its own caller but must not poison
    // the queue for subsequent sampling or the final stop() snapshot.
    snapshotTail = result.catch(() => {});
    return result;
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
      const rssSamples = samples.filter(item => Number.isSafeInteger(item.chromiumRssBytes));
      const rssBaseline = rssSamples[0] ?? null;
      const rssEnd = rssSamples.at(-1) ?? null;
      const rssMax = rssSamples.reduce((max, item) =>
        !max || item.chromiumRssBytes > max.chromiumRssBytes ? item : max, null);
      return {
        metric:'CDP Performance.getMetrics / renderer JSHeapUsedSize',
        limitations:'Informational sampled main-frame JS heap, optional Chromium privateMemory and Linux /proc VmRSS/VmHWM. NOT Worker heap in isolation, atomic aggregate or true operation peak; no GPU breakdown or memory thresholds.',
        chromiumProcessLifecycle: {
          metric:'CDP SystemInfo.getProcessInfo / sampled PID membership and process types',
          availability:!processClient ? 'not-requested' :
            processIdentityUnavailableReason ? 'unavailable' : 'sampled',
          unavailableReason:processIdentityUnavailableReason,
          sampleCount:pidSampleCount,
          firstProcessCount:pidMarkers[0]?.processCount ?? null,
          uniquePidsSeen:distinctPids.size,
          maxSampledPidCount,
          newPidObservations,
          missingPidObservations,
          maximumObservedTypes:Object.fromEntries([...processTypeMaximums].sort(([a],[b])=>a.localeCompare(b))),
          milestones:pidMarkers,
          workerPidMapping:'unknown',
          limitations:'Sampling cannot see all short-lived PIDs or distinguish PID reuse. Process types do not establish Worker identity; missing PID means absent from a later CDP snapshot, not proven exit. No sum of per-PID lifetime HWM represents concurrent peak memory.',
        },
        linuxProcessIdentity: {
          ...linuxIdentity.report(),
          availability:!processClient?'not-requested':
            linuxIdentityUnavailableReason || rssUnavailableReason?'unavailable':'sampled',
          unavailableReason:linuxIdentityUnavailableReason || rssUnavailableReason,
        },
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
        linuxProcessRss: {
          metric:'Linux /proc/<pid>/status VmRSS summed over CDP process list; VmHWM individual-process diagnostic',
          availability:!processClient ? 'not-requested' :
            rssUnavailableReason ? 'unavailable' : 'sampled',
          unavailableReason:rssUnavailableReason,
          sampleCount:rssSamples.length,
          baselineAggregateRssBytes:rssBaseline?.chromiumRssBytes ?? null,
          sampledMaxAggregateRssBytes:rssMax?.chromiumRssBytes ?? null,
          endAggregateRssBytes:rssEnd?.chromiumRssBytes ?? null,
          sampledIncreaseBytes:rssMax ? Math.max(0, rssMax.chromiumRssBytes - rssBaseline.chromiumRssBytes) : null,
          maxObservedIndividualProcessHwmBytes:rssSamples.reduce((max, item) =>
            Math.max(max, item.largestProcessHighWaterBytes), 0) || null,
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
