// 003T/2f-2: isolated Linux PID+starttime observations on real file://
// operation boundaries. A pair of observed endpoints never proves continuity.
const nonnegative = value => Number.isFinite(value) && value >= 0;
const flags = new Set([
  'kind','measurementClass','windows','unverifiedIntervals',
  'trueOperationPeakKnown','workerPidMapping','limitations',
]);
const windowFields = new Set([
  'phase','readStartOffsetMs','readEndOffsetMs','availability','incarnations',
]);
const intervalFields = new Set([
  'fromPhase','toPhase','unobservedGapMs','pidIncarnationContinuity',
]);
const incarnationFields = new Set(['pid','starttimeTicks']);

export function validateBrowserOperationIncarnationWindows(audit, milestoneAudit) {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit) ||
      Object.keys(audit).some(key => !flags.has(key)) ||
      audit.kind !== 'zpe-browser-operation-incarnation-windows-v1' ||
      audit.measurementClass !== 'discrete-linux-pid-starttime-reads' ||
      audit.trueOperationPeakKnown !== false ||
      audit.workerPidMapping !== 'unknown' ||
      typeof audit.limitations !== 'string' ||
      !audit.limitations.includes('not continuous coverage') ||
      !Array.isArray(audit.windows) ||
      !Array.isArray(audit.unverifiedIntervals) ||
      !Array.isArray(milestoneAudit?.milestones) ||
      audit.windows.length !== milestoneAudit.milestones.length ||
      audit.windows.length < 2 ||
      audit.unverifiedIntervals.length !== audit.windows.length - 1) {
    throw new TypeError('Chromium incarnation windows: unsupported summary or claim');
  }
  for (let i=0; i<audit.windows.length; i++) {
    const item=audit.windows[i], source=milestoneAudit.milestones[i];
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        Object.keys(item).some(key => !windowFields.has(key)) ||
        item.phase !== source?.phase ||
        item.readStartOffsetMs !== source.readStartOffsetMs ||
        item.readEndOffsetMs !== source.readEndOffsetMs ||
        !nonnegative(item.readStartOffsetMs) ||
        !nonnegative(item.readEndOffsetMs) ||
        item.readEndOffsetMs < item.readStartOffsetMs) {
      throw new TypeError('Chromium incarnation windows: forged milestone boundary');
    }
    const observed=source.linuxIdentityObserved === true && source.linuxRssObserved === true;
    if (observed !== (item.availability === 'observed') ||
        (item.availability !== 'observed' && item.availability !== 'unknown')) {
      throw new TypeError('Chromium incarnation windows: invented Linux identity evidence');
    }
    if (!observed) {
      if (item.incarnations !== null) {
        throw new TypeError('Chromium incarnation windows: missing read must remain unknown');
      }
    } else {
      if (!Array.isArray(item.incarnations) || item.incarnations.length === 0)
        throw new TypeError('Chromium incarnation windows: missing observed PID/starttime');
      let previousPid = 0;
      for (const id of item.incarnations) {
        if (!id || typeof id !== 'object' || Array.isArray(id) ||
            Object.keys(id).some(key => !incarnationFields.has(key)) ||
            !Number.isSafeInteger(id.pid) || id.pid <= previousPid ||
            typeof id.starttimeTicks !== 'string' ||
            !/^[1-9]\d*$/.test(id.starttimeTicks)) {
          throw new TypeError('Chromium incarnation windows: duplicate/invalid/reused PID evidence');
        }
        previousPid=id.pid;
      }
    }
    if (i>0) {
      const prev=audit.windows[i-1];
      const gap=item.readStartOffsetMs-prev.readEndOffsetMs;
      const interval=audit.unverifiedIntervals[i-1];
      if (!nonnegative(gap) || !interval || typeof interval !== 'object' ||
          Array.isArray(interval) ||
          Object.keys(interval).some(key => !intervalFields.has(key)) ||
          interval.fromPhase !== prev.phase || interval.toPhase !== item.phase ||
          Math.abs(interval.unobservedGapMs-gap)>1e-6 ||
          interval.pidIncarnationContinuity !== 'unknown') {
        throw new TypeError('Chromium incarnation windows: unobserved interval asserted as continuity');
      }
    }
  }
  return true;
}

export function summarizeBrowserOperationIncarnationWindows(samples, milestoneAudit) {
  if (!Array.isArray(samples) || samples.length < 2 ||
      !Array.isArray(milestoneAudit?.milestones)) {
    throw new TypeError('Chromium incarnation windows: missing sample audit');
  }
  const stages=samples.filter(item => item?.phase !== 'sample');
  if (stages.length !== milestoneAudit.milestones.length) {
    throw new TypeError('Chromium incarnation windows: missing explicit reads');
  }
  const windows=stages.map((item,index) => {
    const source=milestoneAudit.milestones[index];
    const observed=source.linuxIdentityObserved === true && source.linuxRssObserved === true;
    // A missing read must not retain a stale/forged PID list from an earlier stage.
    const incarnations=item.linuxIncarnations ?? null;
    if ((!observed && incarnations != null) ||
        (observed && (!Array.isArray(incarnations) || incarnations.length === 0))) {
      throw new TypeError('Chromium incarnation windows: inconsistent sampled Linux identity');
    }
    return {
      phase:source.phase,
      readStartOffsetMs:source.readStartOffsetMs,
      readEndOffsetMs:source.readEndOffsetMs,
      availability:observed?'observed':'unknown',
      incarnations:observed
        ? incarnations.map(id => ({pid:id.pid,starttimeTicks:id.starttimeTicks}))
            .sort((a,b)=>a.pid-b.pid)
        : null,
    };
  });
  const unverifiedIntervals=windows.slice(1).map((item,index)=>({
    fromPhase:windows[index].phase,toPhase:item.phase,
    unobservedGapMs:item.readStartOffsetMs-windows[index].readEndOffsetMs,
    pidIncarnationContinuity:'unknown',
  }));
  const result={
    kind:'zpe-browser-operation-incarnation-windows-v1',
    measurementClass:'discrete-linux-pid-starttime-reads',
    windows,unverifiedIntervals,
    trueOperationPeakKnown:false,
    workerPidMapping:'unknown',
    limitations:'Per-milestone Linux /proc PID+starttime snapshots, not continuous coverage; start/end reads are non-atomic. Even matching endpoint incarnations do not prove uninterrupted process membership, a Worker-to-PID join, exit, or operation-exclusive peak.',
  };
  validateBrowserOperationIncarnationWindows(result,milestoneAudit);
  return result;
}
