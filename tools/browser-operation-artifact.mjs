import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateBrowserOperationEvidence } from './browser-operation-timeline.mjs';
import { validateBrowserSyntheticQualityEvidence } from './browser-synthetic-native-quality.mjs';
import { validateBrowserSamplingTiming } from './browser-sampling-timing.mjs';
import { validateBrowserMilestoneWindowAudit } from './browser-milestone-window-audit.mjs';
import {
  validateBrowserOperationIncarnationWindows,
  summarizeBrowserOperationIncarnationWindows,
} from './browser-operation-incarnation-windows.mjs';

// Test-only CI reports for genuine Chromium file:// scenarios. Informational
// samples are NOT native Worker memory, simultaneous true peak, or an exit proof.
// Informational samples cannot be upgraded into Worker/PID/exit/peak proof by
// editing a saved JSON report. This gate runs for both writer and CI verifier.
function validateInformationalMemoryClaims(memory) {
  if (!memory || typeof memory !== 'object' || Array.isArray(memory) ||
      Object.hasOwn(memory,'operationPeakRssBytes') ||
      Object.hasOwn(memory,'workerRssBytes') ||
      Object.hasOwn(memory,'provenWorkerTerminationCount')) {
    throw new TypeError('Browser operation artifact: unsupported memory evidence');
  }
  if (memory.samplingTiming != null) {
    validateBrowserSamplingTiming(memory.samplingTiming,memory.sampleCount);
  }
  if (memory.milestoneWindowAudit != null) {
    validateBrowserMilestoneWindowAudit(memory.milestoneWindowAudit,
      memory.samplingTiming,memory.sampleCount);
  }
  if (memory.incarnationWindowAudit != null) {
    validateBrowserOperationIncarnationWindows(memory.incarnationWindowAudit,
      memory.milestoneWindowAudit);
    if (!Array.isArray(memory.stages) ||
        JSON.stringify(summarizeBrowserOperationIncarnationWindows(
          memory.stages,memory.milestoneWindowAudit)) !==
          JSON.stringify(memory.incarnationWindowAudit)) {
      throw new TypeError('Browser operation artifact: incarnation windows disagree with saved raw read stages');
    }
  }
  const churn=memory.processChurn;
  if (churn != null && (typeof churn !== 'object' || Array.isArray(churn) ||
      churn.workerPidMapping !== 'unknown' ||
      Object.hasOwn(churn,'provenExitCount'))) {
    throw new TypeError('Browser operation artifact: unsupported PID/exit evidence');
  }
  const identity=memory.linuxProcessIdentity;
  if (identity != null && (typeof identity !== 'object' || Array.isArray(identity) ||
      identity.provenExitCount !== null)) {
    throw new TypeError('Browser operation artifact: unsupported process exit evidence');
  }
  const census=memory.workerTargets;
  if (census == null) return;
  const censusFields=new Set([
    'metric','availability','sampleCount','snapshotCoverage',
    'uniqueWorkerTargetIds','maxObservedConcurrentWorkerTargets',
    'newTargetObservations','missingTargetObservations',
    'observedAtLastSnapshotCount','noLongerObservedAtLastSnapshotCount',
    'provenWorkerTerminationCount','targets','milestones','workerPidMapping',
    'limitations','unavailableReason',
  ]);
  const targetFields=new Set([
    'targetId','type','firstSeenPhase','lastSeenPhase','samples',
    'observedAtLastSnapshot',
  ]);
  if (typeof census !== 'object' || Array.isArray(census) ||
      census.workerPidMapping !== 'unknown' ||
      census.provenWorkerTerminationCount !== null ||
      !Array.isArray(census.targets) ||
      !Number.isSafeInteger(census.uniqueWorkerTargetIds) ||
      census.uniqueWorkerTargetIds !== census.targets.length ||
      Object.keys(census).some(key => !censusFields.has(key)) ||
      census.targets.some(target => !target || typeof target !== 'object' ||
        Array.isArray(target) || Object.keys(target).some(key => !targetFields.has(key)) ||
        typeof target.targetId !== 'string' || !target.targetId ||
        !['worker','shared_worker','service_worker'].includes(target.type) ||
        !Number.isSafeInteger(target.samples) || target.samples < 1 ||
        ![true,false,null].includes(target.observedAtLastSnapshot))) {
    throw new TypeError('Browser operation artifact: unsupported Worker target evidence');
  }
}

export function buildBrowserOperationArtifact(profile) {
  if (!profile || profile.kind !== 'zpe-browser-high-depth-operation-timeline-v1' ||
      typeof profile.operationId !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,100}$/.test(profile.operationId) ||
      !['PSD16','PSB32'].includes(profile.format) ||
      !['completed','completed-with-cancelled-retry','failed'].includes(profile.outcome) ||
      !Number.isSafeInteger(profile.memory?.sampleCount) || profile.memory.sampleCount < 1 ||
      !Array.isArray(profile.milestones) || !Number.isFinite(profile.observedWindowMs)) {
    throw new TypeError('Browser operation artifact: invalid timeline or unsafe operationId');
  }
  validateBrowserOperationEvidence(profile);
  if (profile.origin === 'real Chromium file:// UI + native Worker' && !profile.memory.samplingTiming) {
    throw new TypeError('Browser operation artifact: missing real sampling timing coverage');
  }
  if (profile.origin === 'real Chromium file:// UI + native Worker' &&
      profile.quality != null && !profile.memory.milestoneWindowAudit) {
    throw new TypeError('Browser operation artifact: missing real milestone read-window evidence');
  }
  if (profile.origin === 'real Chromium file:// UI + native Worker' &&
      profile.quality != null && !profile.memory.incarnationWindowAudit) {
    throw new TypeError('Browser operation artifact: missing real Linux incarnation windows');
  }
  validateInformationalMemoryClaims(profile.memory);
  validateBrowserSyntheticQualityEvidence(profile.quality,{format:profile.format,outcome:profile.outcome});
  return {
    kind:'zpe-browser-operation-artifact-v1',
    schemaVersion:1,
    measurementClass:'informational-observed-samples',
    operationId:profile.operationId,
    format:profile.format,
    outcome:profile.outcome,
    observedProcessExitCount:null,
    processExitEvidence:'Unknown: a PID absent from CDP or /proc samples is NOT a verified exited process.',
    workerPidMapping:'unknown',
    operationPeakRssBytes:null,
    limitations:'Sampled Chromium RSS/JS heap and per-process lifetime VmHWM are different measurements; no operation peak or proven process exit.',
    timeline:profile,
  };
}

export async function writeBrowserOperationArtifact(profile, {
  directory=process.env.ZPE_BROWSER_OPERATION_ARTIFACT_DIR,
}={}) {
  const artifact=buildBrowserOperationArtifact(profile);
  if (directory == null || directory === '') return null;
  if (typeof directory !== 'string') throw new TypeError('Browser operation artifact: invalid directory');
  await mkdir(directory,{recursive:true});
  const filename=artifact.operationId+'.json';
  const target=path.resolve(directory,filename);
  await writeFile(target,JSON.stringify(artifact,null,2)+'\n','utf8');
  return target;
}

// Test the actual persisted real UI boundaries in strict operation order.
export function hasRequiredBrowserOperationIncarnationBoundaries(windows) {
  if (!Array.isArray(windows)) return false;
  const required=[
    'before-first-fill','after-large-worker-preview','after-first-undo',
    'after-large-undo-redo','before-cancel-fill','after-large-mid-kernel-cancel',
    'before-retry-fill','after-retry-undo','after-large-mid-kernel-recovered-redo',
  ];
  let last=-1;
  for (const phase of required) {
    last=windows.findIndex((item,index) => index>last && item?.phase===phase);
    if (last<0) return false;
  }
  return true;
}

export async function verifyBrowserOperationArtifacts(directory) {
  if (typeof directory !== 'string' || !directory.trim()) {
    throw new TypeError('Browser operation artifact: missing CI directory');
  }
  const required=[
    ['stage003-psd16-with-cancelled-retry.json','PSD16','completed-with-cancelled-retry'],
    ['stage003-psb32-with-cancelled-retry.json','PSB32','completed-with-cancelled-retry'],
  ];
  for (const [filename,format,outcome] of required) {
    const artifact=JSON.parse(await readFile(path.join(directory,filename),'utf8'));
    const expected=buildBrowserOperationArtifact(artifact.timeline);
    if (JSON.stringify(artifact)!==JSON.stringify(expected) ||
        artifact.format!==format || artifact.outcome!==outcome ||
        artifact.timeline.memory.requestedSamplingIntervalMs!==50 ||
        artifact.timeline.memory.samplingTiming == null ||
        (artifact.timeline.origin === 'real Chromium file:// UI + native Worker' &&
          !hasRequiredBrowserOperationIncarnationBoundaries(
            artifact.timeline.memory.incarnationWindowAudit?.windows)) ||
        artifact.timeline.memory.processChurn?.workerPidMapping!=='unknown' ||
        (artifact.timeline.memory.workerTargets && artifact.timeline.memory.workerTargets.workerPidMapping!=='unknown') ||
        artifact.timeline.memory.linuxProcessIdentity?.provenExitCount!==null ||
        !artifact.timeline.milestones.some(event=>event.phase==='cancel-kernel-write-observed') ||
        !artifact.timeline.milestones.some(event=>event.phase==='retry-redo-native-verified')) {
      throw new Error('Browser operation artifact: incorrect or unsupported measurement claims in '+filename);
    }
  }
  return required.map(([filename])=>filename);
}
