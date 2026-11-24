// Test-harness integrity guard: a Linux RSS aggregate is only usable when its
// per-PID samples match the entire CDP PID census. Identity is PID+starttime,
// not an undocumented Worker target -> OS PID mapping.
export function validateChromiumRssSampleMembership(processes, rss) {
  if (!Array.isArray(processes) || !processes.length ||
      !rss || !Array.isArray(rss.processSamples) ||
      rss.processSamples.length !== processes.length ||
      rss.processCount !== processes.length) {
    throw new Error('Chromium RSS identity: incomplete CDP /proc membership');
  }
  const expected = new Set();
  for (const item of processes) {
    if (!Number.isSafeInteger(item?.id) || item.id <= 0 || expected.has(item.id))
      throw new Error('Chromium RSS identity: invalid or duplicate CDP PID');
    expected.add(item.id);
  }
  const found = new Set();
  let total = 0, maxHwm = 0;
  for (const item of rss.processSamples) {
    const { pid, starttimeTicks, rssBytes, highWaterBytes } = item ?? {};
    if (!expected.has(pid) || found.has(pid) ||
        typeof starttimeTicks !== 'string' || !/^[1-9]\d*$/.test(starttimeTicks) ||
        !Number.isSafeInteger(rssBytes) || rssBytes < 0 ||
        !Number.isSafeInteger(highWaterBytes) || highWaterBytes < rssBytes) {
      throw new Error('Chromium RSS identity: invalid, missing or duplicate /proc PID/starttime');
    }
    found.add(pid);
    total += rssBytes;
    maxHwm = Math.max(maxHwm, highWaterBytes);
    if (!Number.isSafeInteger(total))
      throw new Error('Chromium RSS identity: aggregate overflow');
  }
  if (found.size !== expected.size ||
      rss.aggregateRssBytes !== total ||
      rss.largestProcessHighWaterBytes !== maxHwm)
    throw new Error('Chromium RSS identity: inconsistent aggregate or incomplete process set');
  return true;
}
