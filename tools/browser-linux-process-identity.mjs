// Test-harness Linux Chromium process incarnation tracking. /proc field 22 is
// a boot-relative tick counter, kept as a string to preserve full precision.
export function parseLinuxProcStartTime(stat, expectedPid) {
  if (typeof stat !== 'string' || !Number.isSafeInteger(expectedPid) || expectedPid <= 0)
    throw new Error('Chromium identity: invalid /proc stat or PID');
  // comm (field 2) may itself contain whitespace and ')' characters.
  const opening = stat.indexOf('('), closing = stat.lastIndexOf(')');
  if (opening < 1 || closing <= opening ||
      stat.slice(0, opening).trim() !== String(expectedPid))
    throw new Error('Chromium identity: /proc stat PID or comm mismatch');
  // Token zero after comm is state (field 3); starttime is field 22.
  const fields = stat.slice(closing + 1).trim().split(/\s+/);
  const raw = fields[19];
  if (fields.length < 20 || !/^\d+$/.test(raw || '') || BigInt(raw) <= 0n)
    throw new Error('Chromium identity: missing or invalid /proc starttime');
  return BigInt(raw).toString();
}

export function createLinuxChromiumIdentityTracker() {
  const known = new Map(), lastByPid = new Map();
  let previous = null, observations = 0;
  let reusedPidObservations = 0, missingIdentityObservations = 0, newIdentityObservations = 0;
  const milestones = [];
  function observe(processes, phase) {
    if (!Array.isArray(processes) || !processes.length || typeof phase !== 'string' || !phase)
      throw new Error('Chromium identity: invalid process snapshot');
    const current = new Map();
    // Reject the entire invalid observation before mutating tracker state.
    for (const process of processes) {
      const {pid,starttimeTicks,rssBytes,highWaterBytes} = process ?? {};
      if (!Number.isSafeInteger(pid) || pid <= 0 ||
          typeof starttimeTicks !== 'string' || !/^[1-9]\d*$/.test(starttimeTicks) ||
          !Number.isSafeInteger(rssBytes) || rssBytes < 0 ||
          !Number.isSafeInteger(highWaterBytes) || highWaterBytes < rssBytes ||
          current.has(pid))
        throw new Error('Chromium identity: invalid or duplicate per-PID RSS/starttime');
      current.set(pid,process);
    }
    let arrivals = 0, misses = 0, reuse = 0;
    for (const [pid,process] of current) {
      const key = pid + ':' + process.starttimeTicks;
      if (previous && previous.get(pid) !== key) arrivals++;
      if (lastByPid.has(pid) && lastByPid.get(pid) !== key) reuse++;
    }
    if (previous) for (const [pid,key] of previous) {
      if (!current.has(pid) || pid + ':' + current.get(pid).starttimeTicks !== key) misses++;
    }
    for (const [pid,process] of current) {
      const key = pid + ':' + process.starttimeTicks;
      const existing = known.get(key);
      if (!existing) {
        known.set(key,{
          pid,starttimeTicks:process.starttimeTicks,type:process.type || 'unknown',
          firstSeenPhase:phase,lastSeenPhase:phase,samples:1,
          maxSampledRssBytes:process.rssBytes,maxObservedLifetimeHwmBytes:process.highWaterBytes,
        });
      } else {
        existing.samples++;
        existing.lastSeenPhase=phase;
        existing.maxSampledRssBytes=Math.max(existing.maxSampledRssBytes,process.rssBytes);
        existing.maxObservedLifetimeHwmBytes=Math.max(existing.maxObservedLifetimeHwmBytes,process.highWaterBytes);
      }
      lastByPid.set(pid,key);
    }
    newIdentityObservations+=arrivals;
    missingIdentityObservations+=misses;
    reusedPidObservations+=reuse;
    observations++;
    if (phase !== 'sample') milestones.push({
      phase,processCount:current.size,newIdentityObservations:arrivals,
      missingPreviouslyObservedIdentities:misses,reusedPidObservations:reuse,
    });
    previous = new Map([...current].map(([pid,p])=>[pid,pid+':'+p.starttimeTicks]));
  }
  function report() {
    return {
      metric:'Linux /proc/<pid>/stat field 22 starttime + per-incarnation VmRSS/VmHWM',
      availability:observations?'sampled':'unavailable',
      sampleCount:observations,uniqueProcessIdentities:known.size,
      newIdentityObservations,missingIdentityObservations,reusedPidObservations,
      processes:[...known.values()].sort((a,b)=>a.pid-b.pid ||
        (BigInt(a.starttimeTicks)<BigInt(b.starttimeTicks)?-1:1)),
      milestones,workerPidMapping:'unknown',
      limitations:'PID+starttime identifies observed Linux incarnations, not across reboots. Missing CDP PIDs are not proven exits; VmHWM is a process lifetime maximum, not an operation peak. Worker-to-PID attribution remains unknown.',
    };
  }
  return {observe,report};
}
