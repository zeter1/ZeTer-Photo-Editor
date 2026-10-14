// Test-only observational timeline for genuine Chromium file:// PSD/PSB actions.
// Harness milestones are not inner-kernel timestamps; sampled RAM is not peak RAM.
export function createBrowserOperationTimeline({ operationId, fixture, format, now = () => performance.now() } = {}) {
  if (typeof operationId !== 'string' || !/^[a-z0-9-]+$/.test(operationId) ||
      typeof fixture !== 'string' || !fixture || !['PSD16','PSB32'].includes(format) ||
      typeof now !== 'function') throw new TypeError('Browser operation timeline: invalid identity/clock');
  const began=now();
  if (!Number.isFinite(began)) throw new TypeError('Browser operation timeline: invalid start');
  const events=[], names=new Set();
  let finished=false;
  function mark(phase) {
    if (finished || typeof phase !== 'string' || !/^[a-z][a-z0-9-]*$/.test(phase) ||
        names.has(phase)) throw new Error('Browser operation timeline: finished, invalid or repeated milestone');
    const at=now(), previous=events.at(-1)?.absoluteMs ?? began;
    if (!Number.isFinite(at) || at<previous) throw new Error('Browser operation timeline: non-monotonic clock');
    events.push({phase,absoluteMs:at,atMs:at-began,sincePreviousMs:at-previous});
    names.add(phase);
  }
  function duration(start,end) {
    const first=events.find(event=>event.phase===start);
    const last=events.find(event=>event.phase===end);
    return first && last && last.absoluteMs>=first.absoluteMs?last.absoluteMs-first.absoluteMs:null;
  }
  return {
    mark,
    finish({outcome,memoryReport}={}) {
      if(finished)throw new Error('Browser operation timeline: already finished');
      if(!['completed','completed-with-cancelled-retry','failed'].includes(outcome))
        throw new TypeError('Browser operation timeline: invalid outcome');
      if(!memoryReport || !Number.isSafeInteger(memoryReport.sampleCount) || memoryReport.sampleCount<1)
        throw new TypeError('Browser operation timeline: missing real sampling report');
      if(outcome!=='failed' && ![
        'import-input-dispatched','import-preview-ready','native-source-verified','selection-created',
        'fill-command-invoked','preview-history-published','undo-complete','redo-complete',
      ].every(phase=>names.has(phase)))throw new Error('Browser operation timeline: successful operation missing milestones');
      if(outcome==='completed-with-cancelled-retry' && ![
        'cancel-fill-command-invoked','cancel-kernel-write-observed','cancel-owner-revoked','cancel-native-verified',
        'retry-fill-command-invoked','retry-preview-history-published',
        'retry-undo-native-verified','retry-redo-native-verified',
      ].every(phase=>names.has(phase)))throw new Error('Browser operation timeline: cancellation lacks atomicity evidence');
      const end=now();
      if(!Number.isFinite(end) || end<(events.at(-1)?.absoluteMs??began))
        throw new Error('Browser operation timeline: non-monotonic finish');
      finished=true;
      return {
        kind:'zpe-browser-high-depth-operation-timeline-v1',
        operationId,fixture,format,outcome,origin:'real Chromium file:// UI + native Worker',
        observedWindowMs:end-began,
        milestones:events.map(({phase,atMs,sincePreviousMs})=>({phase,atMs,sincePreviousMs})),
        durationsMs:{
          importInputToPreview:duration('import-input-dispatched','import-preview-ready'),
          fillCommandToHistoryPreview:duration('fill-command-invoked','preview-history-published'),
          undoToRedo:duration('undo-complete','redo-complete'),
          cancelledRetryObservation:duration('cancel-fill-command-invoked','cancel-native-verified'),
          recoveredRetryToRedo:duration('retry-fill-command-invoked','retry-redo-native-verified'),
        },
        memory:{
          sampleCount:memoryReport.sampleCount,
          requestedSamplingIntervalMs:memoryReport.requestedSamplingIntervalMs??null,
          observedSamplingWindowMs:memoryReport.observedSamplingWindowMs??null,
          rendererHeapSampledMaxBytes:memoryReport.sampledMaxJsHeapUsedBytes??null,
          chromiumPrivateMemoryAvailability:memoryReport.chromiumProcesses?.availability??'unavailable',
          chromiumPrivateSampledMaxBytes:memoryReport.chromiumProcesses?.sampledMaxPrivateBytes??null,
          linuxRssAvailability:memoryReport.linuxProcessRss?.availability??'unavailable',
          linuxRssSampledMaxBytes:memoryReport.linuxProcessRss?.sampledMaxAggregateRssBytes??null,
          maxObservedSinglePidLifetimeHwmBytes:memoryReport.linuxProcessRss?.maxObservedIndividualProcessHwmBytes??null,
          processChurn:memoryReport.chromiumProcessLifecycle??null,
          metricCoverage:memoryReport.metricCoverage??null,
          workerTargets:memoryReport.browserWorkerTargets??null,
          linuxProcessIdentity:memoryReport.linuxProcessIdentity??null,
          limitations:'Sampled renderer heap/CDP privateMemory/Linux RSS; missing start/finish counters remain unknown even if earlier polls succeeded; PID+starttime identifies observed Linux process incarnations when available. PID HWM belongs to process lifetime, not this operation. No exact peak, GPU accounting or Worker-to-PID attribution; CDP target IDs are not OS PIDs.',
        },
      };
    },
  };
}
