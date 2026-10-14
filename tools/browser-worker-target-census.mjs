// Test-only browser-CDP Target.getTargets census. Target IDs identify observed
// DevTools targets, NOT operating-system processes or proof of Worker termination.
// Intentionally never records target URLs/titles (which can contain local paths).
const WORKER_TYPES = new Set(['worker', 'shared_worker', 'service_worker']);
const MAX_TARGETS_PER_SNAPSHOT = 2048;

export function createBrowserWorkerTargetTracker() {
  const known = new Map();
  let previous = null;
  let sampleCount = 0;
  let newTargetObservations = 0;
  let missingTargetObservations = 0;
  let maxObservedConcurrentWorkerTargets = 0;
  const milestones = [];

  function observe(targetInfos, phase) {
    if (!Array.isArray(targetInfos) || targetInfos.length > MAX_TARGETS_PER_SNAPSHOT ||
        typeof phase !== 'string' || !/^[a-z][a-z0-9-]*$/.test(phase))
      throw new TypeError('Worker target census: invalid target snapshot/phase');
    const allIds = new Set(), workers = new Map();
    // Validate the WHOLE observation before changing any state. In particular,
    // a repeated target ID with a different type cannot be treated as a PID.
    for (const info of targetInfos) {
      if (typeof info?.targetId !== 'string' || !info.targetId ||
          info.targetId.length > 256 || typeof info.type !== 'string' ||
          !info.type || allIds.has(info.targetId))
        throw new TypeError('Worker target census: missing/duplicate target identity');
      allIds.add(info.targetId);
      if (WORKER_TYPES.has(info.type)) {
        if (known.has(info.targetId) && known.get(info.targetId).type !== info.type)
          throw new TypeError('Worker target census: target ID changed worker type');
        workers.set(info.targetId, info.type);
      } else if (known.has(info.targetId)) {
        throw new TypeError('Worker target census: worker ID reused by non-worker target');
      }
    }
    const added = previous ? [...workers.keys()].filter(id => !previous.has(id)).length : 0;
    const missing = previous ? [...previous.keys()].filter(id => !workers.has(id)).length : 0;
    for (const [id, type] of workers) {
      const record = known.get(id);
      if (record) {
        record.lastSeenPhase = phase;
        record.samples++;
      } else {
        known.set(id, {targetId:id, type, firstSeenPhase:phase, lastSeenPhase:phase, samples:1});
      }
    }
    newTargetObservations += added;
    missingTargetObservations += missing;
    maxObservedConcurrentWorkerTargets = Math.max(maxObservedConcurrentWorkerTargets, workers.size);
    sampleCount++;
    if (phase !== 'sample') milestones.push({
      phase, workerTargetCount:workers.size,
      newlyObservedWorkerTargets:added, missingPreviouslyObservedWorkerTargets:missing,
    });
    previous = workers;
  }

  function report() {
    const visible = new Set(previous?.keys() ?? []);
    const targets = [...known.values()].map(target => ({
      ...target, observedAtLastSnapshot:visible.has(target.targetId),
    })).sort((a,b) => a.targetId.localeCompare(b.targetId));
    return {
      metric:'Browser CDP Target.getTargets / worker target ID and type census',
      availability:sampleCount ? 'sampled' : 'unavailable',
      sampleCount,
      uniqueWorkerTargetIds:known.size,
      maxObservedConcurrentWorkerTargets,
      newTargetObservations,
      missingTargetObservations,
      observedAtLastSnapshotCount:visible.size,
      noLongerObservedAtLastSnapshotCount:known.size - visible.size,
      provenWorkerTerminationCount:null,
      targets, milestones,
      workerPidMapping:'unknown',
      limitations:'Target.getTargets exposes opaque target IDs/types, not OS PIDs. A missing target in a later poll does not prove Worker termination. Targets may be missed between polls. No Worker-to-PID attribution or Worker-specific RSS/peak is supported.',
    };
  }
  return {observe, report};
}
