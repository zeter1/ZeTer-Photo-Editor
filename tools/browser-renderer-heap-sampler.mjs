import { sampleLinuxChromiumRss } from './browser-linux-process-rss.mjs';
import { createLinuxChromiumIdentityTracker } from './browser-linux-process-identity.mjs';
import { createBrowserWorkerTargetTracker } from './browser-worker-target-census.mjs';
import { summarizeBrowserSamplingTiming } from './browser-sampling-timing.mjs';
import { summarizeBrowserMilestoneWindows } from './browser-milestone-window-audit.mjs';
import { summarizeBrowserOperationIncarnationWindows } from './browser-operation-incarnation-windows.mjs';
import { validateChromiumRssSampleMembership } from './browser-rss-sample-identity.mjs';

// An ENOENT from a specific member of the *current* CDP census can mean that
// Chromium retired that process between the census and its /proc reads. Retry
// only on a later, freshly collected CDP list; never retry a partial census
// in place or infer a continuous process lifetime across the missing window.
function isTransientProcMemberMissing(error, processes) {
  if (error?.code !== 'ENOENT' || typeof error.path !== 'string') return false;
  return processes.some(({id}) =>
    error.path === '/proc/' + id + '/stat' ||
    error.path === '/proc/' + id + '/status');
}

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
  let pollsAttempted = 0;
  let pollsSkippedBusy = 0;
  let processUnavailableReason = null;
  let rssUnavailableReason = null;
  let transientProcMissingSnapshots = 0;
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
  const workerTargets = createBrowserWorkerTargetTracker();
  let workerTargetUnavailableReason = null;

  // CDP reads can complete out of order when a periodic poll overlaps an
  // explicit stage marker or stop(). Queue reads in invocation order so the
  // recorded final sample is genuinely last, without discarding poll errors.
  let snapshotTail = Promise.resolve();
  // Count both active and queued milestone reads. A periodic tick arriving
  // while an explicit marker is pending must be skipped, not attributed to
  // the time at which its delayed CDP read eventually starts.
  let queuedSnapshots = 0;
  async function readSnapshot(phase) {
    const readStartedMs = now();
    const { metrics } = await client.send('Performance.getMetrics');
    if (!Array.isArray(metrics)) throw new Error('Browser renderer heap sampler: missing metrics');
    const values = new Map(metrics.map(metric => [metric.name, metric.value]));
    const used = values.get('JSHeapUsedSize');
    const total = values.get('JSHeapTotalSize');
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total < used) {
      throw new Error('Browser renderer heap sampler: invalid JS heap metrics');
    }
    const entry = { phase, elapsedMs:now(), readStartedMs, jsHeapUsedBytes:used, jsHeapTotalBytes:total,
      pidMembershipObserved:false, linuxIdentityObserved:false, workerTargetsObserved:false };
    // Browser CDP targets have their own opaque identities, independent of
    // SystemInfo PIDs. Neither API provides a documented target->PID join.
    // A denied Target domain must not disable /proc or renderer sampling.
    if (processClient && !workerTargetUnavailableReason) {
      try {
        const response = await processClient.send('Target.getTargets');
        workerTargets.observe(response?.targetInfos, phase);
        entry.workerTargetsObserved = true;
      } catch (error) {
        workerTargetUnavailableReason = String(error?.message || error);
      }
    }
    // Target census validates milestone labels more strictly than the generic
    // heap sampler. When it rejects a label (or payload), missing coverage
    // must still be recorded without failing the independent browser smoke.
    if (processClient && !entry.workerTargetsObserved) {
      const censusPhase = typeof phase === 'string' && /^[a-z][a-z0-9-]*$/.test(phase)
        ? phase : 'invalid-phase';
      workerTargets.noteMissingSnapshot(censusPhase);
    }
    if (processClient && (!processUnavailableReason || !rssUnavailableReason || !processIdentityUnavailableReason)) {
      try {
        const info = await processClient.send('SystemInfo.getProcessInfo');
        const processes = info?.processInfo;
        if (!Array.isArray(processes) || !processes.length) {
          throw new Error('Chromium did not expose a complete process list');
        }
        // Every aggregate must use a complete set of distinct OS processes.
        // An invalid/duplicate PID invalidates privateMemory just as it does
        // Linux RSS; otherwise we could silently count one process twice.
        const ids = processes.map(item => item?.id);
        if (ids.some(pid => !Number.isSafeInteger(pid) || pid <= 0) ||
            new Set(ids).size !== ids.length) {
          throw new Error('Chromium process snapshot: missing, duplicate or invalid CDP PID');
        }
        if (!processIdentityUnavailableReason) {
          entry.pidMembershipObserved = true;
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
            // A partial or inconsistent /proc read must not become an
            // aggregate. Legacy test samplers without processSamples retain
            // informational RSS, but do not establish any PID identity.
            if (rss.processSamples !== undefined) {
              validateChromiumRssSampleMembership(processes, rss);
            }
            entry.chromiumRssBytes = rss.aggregateRssBytes;
            entry.largestProcessHighWaterBytes = rss.largestProcessHighWaterBytes;
            // Legacy synthetic RSS samplers may omit identity. Keep their valid
            // RSS metrics, but never claim starttime-verified attribution.
            if (!linuxIdentityUnavailableReason) {
              try {
                linuxIdentity.observe(rss.processSamples,phase);
                entry.linuxIdentityObserved = true;
                // Only the exact verified /proc incarnation census for this
                // explicit milestone, never an inferred Worker/PID mapping.
                if (phase !== 'sample') entry.linuxIncarnations = rss.processSamples.map(
                  ({pid,starttimeTicks}) => ({pid,starttimeTicks}));
              } catch (error) { linuxIdentityUnavailableReason=String(error?.message || error); }
            }
          } catch (error) {
            if (isTransientProcMemberMissing(error, processes)) {
              // This entire aggregate, including previously read members, is
              // unknown. The existing missing-snapshot path breaks identity
              // adjacency. The *next* snapshot may re-observe from scratch.
              transientProcMissingSnapshots++;
              entry.linuxRssGapReason = 'transient-proc-enoent';
            } else {
              // Permission, unsupported platform, malformed data, PID reuse
              // during a read, and untrusted errors disable RSS capability.
              rssUnavailableReason = String(error?.message || error);
            }
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
    // A skipped/failed optional snapshot breaks temporal adjacency. Never
    // count PID arrivals/disappearances across an unobserved interval.
    if (!entry.pidMembershipObserved) previousPids = null;
    if (!entry.linuxIdentityObserved) linuxIdentity.noteMissingSnapshot();
    entry.readFinishedMs = now();
    // Fail rather than publishing fabricated timing coverage from a broken clock.
    if (!Number.isFinite(readStartedMs) || !Number.isFinite(entry.readFinishedMs) ||
        readStartedMs > entry.elapsedMs || entry.elapsedMs > entry.readFinishedMs ||
        (samples.length && readStartedMs < samples.at(-1).readFinishedMs)) {
      throw new Error('Browser renderer heap sampler: non-monotonic observation clock');
    }
    samples.push(entry);
    return entry;
  }

  function snapshot(phase) {
    queuedSnapshots++;
    const result = snapshotTail.then(() => readSnapshot(phase));
    // A failed explicit marker must reject its own caller but must not poison
    // the queue for subsequent sampling or the final stop() snapshot.
    // Decrement in both branches without creating an unobserved rejected promise.
    snapshotTail = result.then(
      () => { queuedSnapshots--; },
      () => { queuedSnapshots--; },
    );
    return result;
  }

  function poll() {
    if (!active) return;
    pollsAttempted++;
    if (pending || queuedSnapshots > 0) { pollsSkippedBusy++; return; }
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
      // Start/end mean the actual before-import/finished snapshots, not the
      // first or last successful optional CDP or /proc read. A disappeared
      // metric MUST NOT be reported as a value observed at operation finish.
      const processBaseline = Number.isSafeInteger(baseline.processPrivateMemoryBytes)
        ? baseline : null;
      const processEnd = Number.isSafeInteger(end.processPrivateMemoryBytes) ? end : null;
      const rssSamples = samples.filter(item => Number.isSafeInteger(item.chromiumRssBytes));
      const rssBaseline = Number.isSafeInteger(baseline.chromiumRssBytes) ? baseline : null;
      const rssEnd = Number.isSafeInteger(end.chromiumRssBytes) ? end : null;
      function metricCoverage(field) {
        const observed = samples.filter(item => Number.isSafeInteger(item[field]));
        return {
          observedSamples:observed.length,
          missingSamples:samples.length - observed.length,
          observedAtStart:Number.isSafeInteger(baseline[field]),
          observedAtFinish:Number.isSafeInteger(end[field]),
          firstObservedPhase:observed[0]?.phase ?? null,
          lastObservedPhase:observed.at(-1)?.phase ?? null,
          missingMilestonePhases:samples
            .filter(item => item.phase !== 'sample' && !Number.isSafeInteger(item[field]))
            .map(item => item.phase),
        };
      }
      // Worker target and PID observations have independent success/failure
      // timelines. A failed final Target read must not reuse the prior target set.
      // Identity coverage is separate from privateMemory/RSS counter coverage:
      // a CDP PID list may be valid while /proc is unavailable, and vice versa.
      function identityCoverage(field) {
        let observedSamples = 0, observedAdjacentTransitions = 0, gapStart = -1;
        let firstObservedPhase = null, lastObservedPhase = null;
        const gaps = [];
        function closeGap(end) {
          gaps.push({
            missingSamples:end-gapStart,
            firstMissingPhase:samples[gapStart].phase,
            lastMissingPhase:samples[end-1].phase,
            previousObservedPhase:gapStart > 0 ? samples[gapStart-1].phase : null,
            nextObservedPhase:end < samples.length ? samples[end].phase : null,
          });
          gapStart = -1;
        }
        for (let i = 0; i < samples.length; i++) {
          if (samples[i][field] === true) {
            observedSamples++;
            firstObservedPhase ??= samples[i].phase;
            lastObservedPhase = samples[i].phase;
            if (i > 0 && samples[i-1][field] === true) observedAdjacentTransitions++;
            if (gapStart >= 0) closeGap(i);
          } else if (gapStart < 0) gapStart = i;
        }
        if (gapStart >= 0) closeGap(samples.length);
        return {
          observedSamples, missingSamples:samples.length-observedSamples,
          observedAtStart:samples[0][field] === true,
          observedAtFinish:end[field] === true,
          firstObservedPhase,lastObservedPhase,
          observedAdjacentTransitions,
          unknownAdjacentTransitions:Math.max(0,samples.length-1-observedAdjacentTransitions),
          missingMilestonePhases:samples.filter(s => s.phase !== 'sample' && s[field] !== true)
            .map(s => s.phase),
          gaps,
        };
      }
      const rssMax = rssSamples.reduce((max, item) =>
        !max || item.chromiumRssBytes > max.chromiumRssBytes ? item : max, null);
      const samplingTiming = summarizeBrowserSamplingTiming(samples,pollsAttempted,pollsSkippedBusy);
      const milestoneWindowAudit = summarizeBrowserMilestoneWindows(samples,samplingTiming);
      const incarnationWindowAudit = summarizeBrowserOperationIncarnationWindows(samples,milestoneWindowAudit);
      return {
        metric:'CDP Performance.getMetrics / renderer JSHeapUsedSize',
        samplingTiming,
        milestoneWindowAudit,
        incarnationWindowAudit,
        limitations:'Informational sampled main-frame JS heap, browser Worker target census, optional Chromium privateMemory and Linux /proc VmRSS/VmHWM. Missing identity/Worker target snapshots break comparisons and final visibility. Missing start/end counters are null, not last-observed substitutes. Target IDs cannot be joined to OS PIDs; NOT Worker heap in isolation, atomic aggregate or true operation peak; no GPU breakdown or memory thresholds.',
        metricCoverage: {
          chromiumPrivateMemory:metricCoverage('processPrivateMemoryBytes'),
          linuxAggregateRss:metricCoverage('chromiumRssBytes'),
        },
        browserWorkerTargets: {
          ...workerTargets.report(),
          availability:!processClient ? 'not-requested' :
            workerTargetUnavailableReason ? 'unavailable' : 'sampled',
          unavailableReason:workerTargetUnavailableReason,
        },
        chromiumProcessLifecycle: {
          metric:'CDP SystemInfo.getProcessInfo / sampled PID membership and process types',
          snapshotCoverage:identityCoverage('pidMembershipObserved'),
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
          limitations:'Sampling cannot see all short-lived PIDs or distinguish PID reuse. Churn counters compare only adjacent observed snapshots; missing observations make that interval unknown. Process types do not establish Worker identity; missing PID in a successful later snapshot is not proven exit. No sum of per-PID lifetime HWM represents concurrent peak memory.',
        },
        linuxProcessIdentity: {
          ...linuxIdentity.report(),
          snapshotCoverage:identityCoverage('linuxIdentityObserved'),
          availability:!processClient?'not-requested':
            linuxIdentityUnavailableReason || rssUnavailableReason ||
              !samples.some(item => item.linuxIdentityObserved) ?'unavailable':'sampled',
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
          sampledIncreaseBytes:processPeak && processBaseline
            ? Math.max(0, processPeak.processPrivateMemoryBytes - processBaseline.processPrivateMemoryBytes) : null,
          maxSampledProcessCount:processSamples.reduce((max, item) => Math.max(max, item.processCount), 0),
        },
        linuxProcessRss: {
          metric:'Linux /proc/<pid>/status VmRSS summed over CDP process list; VmHWM individual-process diagnostic',
          availability:!processClient ? 'not-requested' :
            rssUnavailableReason || !rssSamples.length ? 'unavailable' : 'sampled',
          unavailableReason:rssUnavailableReason ||
            (!rssSamples.length && transientProcMissingSnapshots
              ? 'transient /proc member disappeared in every attempted snapshot' : null),
          sampleCount:rssSamples.length,
          transientProcMissingSnapshots,
          baselineAggregateRssBytes:rssBaseline?.chromiumRssBytes ?? null,
          sampledMaxAggregateRssBytes:rssMax?.chromiumRssBytes ?? null,
          endAggregateRssBytes:rssEnd?.chromiumRssBytes ?? null,
          sampledIncreaseBytes:rssMax && rssBaseline
            ? Math.max(0, rssMax.chromiumRssBytes - rssBaseline.chromiumRssBytes) : null,
          maxObservedIndividualProcessHwmBytes:rssSamples.reduce((max, item) =>
            Math.max(max, item.largestProcessHighWaterBytes), 0) || null,
        },
        sampleCount:samples.length,
        requestedSamplingIntervalMs:intervalMs,
        observedSamplingWindowMs:end.elapsedMs-baseline.elapsedMs,
        baselineJsHeapUsedBytes:baseline.jsHeapUsedBytes,
        sampledMaxJsHeapUsedBytes:peak.jsHeapUsedBytes,
        endJsHeapUsedBytes:end.jsHeapUsedBytes,
        sampledIncreaseBytes:Math.max(0, peak.jsHeapUsedBytes - baseline.jsHeapUsedBytes),
        stages:samples.filter(item => item.phase !== 'sample'),
      };
    },
  };
}
