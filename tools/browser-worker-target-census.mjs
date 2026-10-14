// Test-only browser-CDP Target.getTargets census. Target IDs identify observed
// DevTools targets, NOT operating-system processes or proof of Worker termination.
// Intentionally never records target URLs/titles (which can contain local paths).
const WORKER_TYPES = new Set(['worker', 'shared_worker', 'service_worker']);
const MAX_TARGETS_PER_SNAPSHOT = 2048;
const validPhase = phase => typeof phase === 'string' && /^[a-z][a-z0-9-]*$/.test(phase);

export function createBrowserWorkerTargetTracker() {
  const known = new Map();
  const snapshots = [];
  let previous = null;
  let sampleCount = 0;
  let newTargetObservations = 0;
  let missingTargetObservations = 0;
  let maxObservedConcurrentWorkerTargets = 0;
  const milestones = [];

  function observe(targetInfos, phase) {
    if (!Array.isArray(targetInfos) || targetInfos.length > MAX_TARGETS_PER_SNAPSHOT ||
        !validPhase(phase))
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
    // After a failed poll there is no evidence of continuity or churn between
    // the two successful observations. Null is not an observed zero transition.
    const added = previous ? [...workers.keys()].filter(id => !previous.has(id)).length
      : sampleCount ? null : 0;
    const missing = previous ? [...previous.keys()].filter(id => !workers.has(id)).length
      : sampleCount ? null : 0;
    for (const [id, type] of workers) {
      const record = known.get(id);
      if (record) {
        record.lastSeenPhase = phase;
        record.samples++;
      } else {
        known.set(id, {targetId:id, type, firstSeenPhase:phase, lastSeenPhase:phase, samples:1});
      }
    }
    if (added !== null) newTargetObservations += added;
    if (missing !== null) missingTargetObservations += missing;
    maxObservedConcurrentWorkerTargets = Math.max(maxObservedConcurrentWorkerTargets, workers.size);
    sampleCount++;
    snapshots.push({phase, observed:true});
    if (phase !== 'sample') milestones.push({
      phase, workerTargetCount:workers.size,
      newlyObservedWorkerTargets:added, missingPreviouslyObservedWorkerTargets:missing,
    });
    previous = workers;
  }

  // A failed/unavailable CDP read still occupies a real sampling interval.
  // Preserve the historical IDs, but revoke claims about last-snapshot
  // visibility and never compare membership across the unobserved gap.
  function noteMissingSnapshot(phase) {
    if (!validPhase(phase))
      throw new TypeError('Worker target census: invalid missing snapshot phase');
    snapshots.push({phase, observed:false});
    previous = null;
    if (phase !== 'sample') milestones.push({
      phase, workerTargetCount:null,
      newlyObservedWorkerTargets:null, missingPreviouslyObservedWorkerTargets:null,
    });
  }

  function report() {
    const lastObserved = snapshots.at(-1)?.observed === true;
    const visible = lastObserved ? new Set(previous.keys()) : null;
    const targets = [...known.values()].map(target => ({
      ...target, observedAtLastSnapshot:visible ? visible.has(target.targetId) : null,
    })).sort((a,b) => a.targetId.localeCompare(b.targetId));
    const gaps = [];
    let gapStart = -1, adjacentObservations = 0;
    for (let i = 0; i <= snapshots.length; i++) {
      if (i < snapshots.length && !snapshots[i].observed) {
        if (gapStart < 0) gapStart = i;
      } else if (gapStart >= 0) {
        gaps.push({
          missingSamples:i-gapStart,
          firstMissingPhase:snapshots[gapStart].phase,
          lastMissingPhase:snapshots[i-1].phase,
          previousObservedPhase:gapStart > 0 ? snapshots[gapStart-1].phase : null,
          nextObservedPhase:i < snapshots.length ? snapshots[i].phase : null,
        });
        gapStart = -1;
      }
      if (i > 0 && i < snapshots.length &&
          snapshots[i-1].observed && snapshots[i].observed) adjacentObservations++;
    }
    const observed = snapshots.filter(s => s.observed);
    return {
      metric:'Browser CDP Target.getTargets / worker target ID and type census',
      availability:sampleCount ? 'sampled' : 'unavailable',
      sampleCount,
      snapshotCoverage:{
        observedSamples:sampleCount,
        missingSamples:snapshots.length-sampleCount,
        observedAtStart:snapshots[0]?.observed === true,
        observedAtFinish:lastObserved,
        firstObservedPhase:observed[0]?.phase ?? null,
        lastObservedPhase:observed.at(-1)?.phase ?? null,
        observedAdjacentTransitions:adjacentObservations,
        unknownAdjacentTransitions:Math.max(0,snapshots.length-1-adjacentObservations),
        missingMilestonePhases:snapshots.filter(s => !s.observed && s.phase !== 'sample')
          .map(s => s.phase),
        gaps,
      },
      uniqueWorkerTargetIds:known.size,
      maxObservedConcurrentWorkerTargets,
      newTargetObservations,
      missingTargetObservations,
      observedAtLastSnapshotCount:visible ? visible.size : null,
      noLongerObservedAtLastSnapshotCount:visible ? known.size-visible.size : null,
      provenWorkerTerminationCount:null,
      targets, milestones,
      workerPidMapping:'unknown',
      limitations:'Target.getTargets exposes opaque target IDs/types, not OS PIDs. Missing CDP snapshots mean unknown last visibility and unknown transitions across gaps, never observed zero churn. A missing target in a later successful poll does not prove Worker termination. Targets may be missed between polls. No Worker-to-PID attribution or Worker-specific RSS/peak is supported.',
    };
  }
  return {observe, noteMissingSnapshot, report};
}
