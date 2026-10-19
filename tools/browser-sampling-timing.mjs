// Stage 003T: bounded observational metadata, not an operation-peak oracle.
// A CDP read is not atomic: its counters and /proc reads occur at different
// times inside the read window. Even zero gaps do NOT prove continuous coverage.
const validMs = n => Number.isFinite(n) && n >= 0;
const validCount = n => Number.isSafeInteger(n) && n >= 0;

export function summarizeBrowserSamplingTiming(samples, pollsAttempted, pollsSkippedBusy) {
  if (!Array.isArray(samples) || samples.length < 2 ||
      !validCount(pollsAttempted) || !validCount(pollsSkippedBusy) ||
      pollsSkippedBusy > pollsAttempted) {
    throw new TypeError('Browser sampling timing: invalid observations or poll counts');
  }
  let previousEnd = null;
  let maxReadDurationMs = 0;
  let maxBetweenReadWindowsMs = 0;
  let maxBetweenReadStartsMs = 0;
  let previousStart = null;
  for (const sample of samples) {
    const {readStartedMs:start,readFinishedMs:end,elapsedMs:heapAt} = sample ?? {};
    if (!validMs(start) || !validMs(end) || !validMs(heapAt) ||
        start > heapAt || heapAt > end ||
        (previousEnd !== null && start < previousEnd)) {
      throw new TypeError('Browser sampling timing: non-monotonic read window');
    }
    maxReadDurationMs = Math.max(maxReadDurationMs, end - start);
    if (previousEnd !== null) {
      maxBetweenReadWindowsMs = Math.max(maxBetweenReadWindowsMs, start - previousEnd);
      maxBetweenReadStartsMs = Math.max(maxBetweenReadStartsMs, start - previousStart);
    }
    previousEnd = end;
    previousStart = start;
  }
  const periodicSamples = samples.filter(sample => sample.phase === 'sample').length;
  if (periodicSamples > pollsAttempted - pollsSkippedBusy) {
    throw new TypeError('Browser sampling timing: more periodic reads than admitted polls');
  }
  return {
    method:'serialized-CDP-read-windows',
    snapshotCount:samples.length,
    periodicSamples,
    pollsAttempted,
    pollsSkippedBusy,
    readWindowMs:previousEnd - samples[0].readStartedMs,
    maxReadDurationMs,
    maxBetweenReadWindowsMs,
    maxBetweenReadStartsMs,
    trueOperationPeakKnown:false,
    workerPidMapping:'unknown',
    limitations:'Read windows bound when a serialized diagnostic request ran, not when all processes were measured atomically. Busy polls are skipped; no sample covers short-lived memory spikes between or during reads. No process-specific Worker attribution or true operation peak.',
  };
}

export function validateBrowserSamplingTiming(timing, sampleCount) {
  if (!timing || typeof timing !== 'object' || Array.isArray(timing) ||
      timing.method !== 'serialized-CDP-read-windows' ||
      !validCount(sampleCount) || sampleCount < 2 ||
      timing.snapshotCount !== sampleCount ||
      !validCount(timing.periodicSamples) ||
      !validCount(timing.pollsAttempted) ||
      !validCount(timing.pollsSkippedBusy) ||
      timing.pollsSkippedBusy > timing.pollsAttempted ||
      timing.periodicSamples > timing.pollsAttempted - timing.pollsSkippedBusy ||
      timing.periodicSamples > sampleCount - 2 ||
      !validMs(timing.readWindowMs) ||
      !validMs(timing.maxReadDurationMs) ||
      !validMs(timing.maxBetweenReadWindowsMs) ||
      !validMs(timing.maxBetweenReadStartsMs) ||
      timing.maxReadDurationMs > timing.readWindowMs ||
      timing.maxBetweenReadWindowsMs > timing.readWindowMs ||
      timing.maxBetweenReadStartsMs > timing.readWindowMs ||
      timing.trueOperationPeakKnown !== false ||
      timing.workerPidMapping !== 'unknown' ||
      typeof timing.limitations !== 'string' || !timing.limitations.includes('not when all processes')) {
    throw new TypeError('Browser sampling timing: unsupported or inconsistent coverage/peak claims');
  }
  return true;
}
