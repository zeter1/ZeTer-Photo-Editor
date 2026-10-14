import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

// Test-only CI reports for genuine Chromium file:// scenarios. Informational
// samples are NOT native Worker memory, simultaneous true peak, or an exit proof.
export function buildBrowserOperationArtifact(profile) {
  if (!profile || profile.kind !== 'zpe-browser-high-depth-operation-timeline-v1' ||
      typeof profile.operationId !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,100}$/.test(profile.operationId) ||
      !['PSD16','PSB32'].includes(profile.format) ||
      !['completed','completed-with-cancelled-retry','failed'].includes(profile.outcome) ||
      !Number.isSafeInteger(profile.memory?.sampleCount) || profile.memory.sampleCount < 1 ||
      !Array.isArray(profile.milestones) || !Number.isFinite(profile.observedWindowMs) ||
      (profile.memory.workerTargets && profile.memory.workerTargets.workerPidMapping !== 'unknown')) {
    throw new TypeError('Browser operation artifact: invalid timeline or unsafe operationId');
  }
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
