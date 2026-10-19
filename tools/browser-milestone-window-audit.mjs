// 003T/2e: explicit Chromium milestone windows, not continuous PID/Worker
// membership or an operation peak. A CDP snapshot itself is non-atomic.
const ms = value => Number.isFinite(value) && value >= 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const FIELDS = new Set([
  'kind','measurementClass','sampledReadCount','milestones',
  'missingPidMilestones','missingLinuxIdentityMilestones',
  'unverifiedBetweenMilestoneIntervals','trueOperationPeakKnown',
  'workerPidMapping','limitations',
]);
const WINDOW_FIELDS = new Set([
  'phase','readStartOffsetMs','readEndOffsetMs','pidMembershipObserved',
  'linuxIdentityObserved','workerTargetsObserved','privateMemoryObserved',
  'linuxRssObserved',
]);
const OBSERVED_FIELDS = [
  'pidMembershipObserved','linuxIdentityObserved','workerTargetsObserved',
  'privateMemoryObserved','linuxRssObserved',
];

export function validateBrowserMilestoneWindowAudit(audit, timing, sampleCount) {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit) ||
      Object.keys(audit).some(key => !FIELDS.has(key)) ||
      audit.kind !== 'zpe-browser-milestone-window-audit-v1' ||
      audit.measurementClass !== 'non-atomic-milestone-samples' ||
      !count(sampleCount) || sampleCount < 2 ||
      !timing || timing.snapshotCount !== sampleCount || !ms(timing.readWindowMs) ||
      audit.sampledReadCount !== sampleCount || !Array.isArray(audit.milestones) ||
      audit.milestones.length < 2 ||
      !count(timing.periodicSamples) ||
      timing.periodicSamples > sampleCount - 2 ||
      audit.milestones.length !== sampleCount - timing.periodicSamples ||
      !count(audit.missingPidMilestones) ||
      !count(audit.missingLinuxIdentityMilestones) ||
      audit.unverifiedBetweenMilestoneIntervals !== audit.milestones.length - 1 ||
      audit.trueOperationPeakKnown !== false || audit.workerPidMapping !== 'unknown' ||
      typeof audit.limitations !== 'string' ||
      !audit.limitations.includes('not continuous coverage')) {
    throw new TypeError('Browser milestone windows: unsupported summary or peak/PID claim');
  }
  let prevEnd = 0, missingPid = 0, missingLinux = 0;
  for (const [index, entry] of audit.milestones.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).some(key => !WINDOW_FIELDS.has(key)) ||
        typeof entry.phase !== 'string' || !/^[a-z][a-z0-9-]*$/.test(entry.phase) ||
        entry.phase === 'sample' ||
        (entry.phase === 'invalid-phase' && entry.workerTargetsObserved) ||
        // Independent optional counters cannot be observed after a missing
        // CDP process list. A verified Linux incarnation additionally needs
        // the matching /proc RSS read; never trust contradictory receipts.
        ((entry.privateMemoryObserved || entry.linuxRssObserved ||
          entry.linuxIdentityObserved) && !entry.pidMembershipObserved) ||
        (entry.linuxIdentityObserved && !entry.linuxRssObserved) ||
        !ms(entry.readStartOffsetMs) || !ms(entry.readEndOffsetMs) ||
        entry.readStartOffsetMs < prevEnd ||
        entry.readStartOffsetMs > entry.readEndOffsetMs ||
        entry.readEndOffsetMs > timing.readWindowMs + 1e-6 ||
        OBSERVED_FIELDS.some(key => typeof entry[key] !== 'boolean')) {
      throw new TypeError('Browser milestone windows: invalid read window or evidence flag');
    }
    if (index === 0 && (entry.phase !== 'before-import' || entry.readStartOffsetMs !== 0)) {
      throw new TypeError('Browser milestone windows: missing initial boundary');
    }
    if (index === audit.milestones.length - 1 &&
        (entry.phase !== 'finished' ||
         Math.abs(entry.readEndOffsetMs - timing.readWindowMs) > 1e-6)) {
      throw new TypeError('Browser milestone windows: missing final boundary');
    }
    if (!entry.pidMembershipObserved) missingPid++;
    if (!entry.linuxIdentityObserved) missingLinux++;
    prevEnd = entry.readEndOffsetMs;
  }
  if (audit.missingPidMilestones !== missingPid ||
      audit.missingLinuxIdentityMilestones !== missingLinux) {
    throw new TypeError('Browser milestone windows: inconsistent missing identity counters');
  }
  return true;
}

export function summarizeBrowserMilestoneWindows(samples, timing) {
  if (!Array.isArray(samples) || samples.length < 2 || !timing ||
      timing.snapshotCount !== samples.length || !ms(timing.readWindowMs) ||
      samples[0]?.phase !== 'before-import' || samples.at(-1)?.phase !== 'finished') {
    throw new TypeError('Browser milestone windows: missing sample boundaries');
  }
  const origin = samples[0].readStartedMs;
  const milestones = samples.filter(item => item.phase !== 'sample').map(item => ({
    // The generic heap sampler accepts arbitrary labels, but the target
    // census records an invalid label as a missed target observation. Retain
    // that fail-closed sentinel here instead of failing the entire report.
    phase:typeof item.phase === 'string' && /^[a-z][a-z0-9-]*$/.test(item.phase)
      ? item.phase : 'invalid-phase',
    readStartOffsetMs:item.readStartedMs - origin,
    readEndOffsetMs:item.readFinishedMs - origin,
    pidMembershipObserved:item.pidMembershipObserved === true,
    linuxIdentityObserved:item.linuxIdentityObserved === true,
    workerTargetsObserved:item.workerTargetsObserved === true,
    privateMemoryObserved:Number.isSafeInteger(item.processPrivateMemoryBytes) && item.processPrivateMemoryBytes >= 0,
    linuxRssObserved:Number.isSafeInteger(item.chromiumRssBytes) && item.chromiumRssBytes >= 0,
  }));
  const audit = {
    kind:'zpe-browser-milestone-window-audit-v1',
    measurementClass:'non-atomic-milestone-samples',
    sampledReadCount:samples.length,
    milestones,
    missingPidMilestones:milestones.filter(item => !item.pidMembershipObserved).length,
    missingLinuxIdentityMilestones:milestones.filter(item => !item.linuxIdentityObserved).length,
    unverifiedBetweenMilestoneIntervals:Math.max(0,milestones.length-1),
    trueOperationPeakKnown:false,
    workerPidMapping:'unknown',
    limitations:'Only explicit serialized milestone read windows, not continuous coverage of intervening processes or memory. Even observed adjacent milestones do not prove a stable PID/Worker incarnation between them or an operation-specific peak.',
  };
  validateBrowserMilestoneWindowAudit(audit,timing,samples.length);
  return audit;
}
