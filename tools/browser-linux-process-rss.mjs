// Diagnostic Linux-only Chromium process RSS snapshots for the real browser smoke.
// A sum of simultaneous VmRSS reads is sampled, not an instantaneous atomic
// reading or the guaranteed peak of a browser/Worker operation.
import { readFile } from 'node:fs/promises';

export async function sampleLinuxChromiumRss(processes, {
  platform = process.platform,
  readStatus = readFile,
} = {}) {
  if (platform !== 'linux') return { supported:false, reason:'Linux /proc is unavailable on this platform' };
  if (!Array.isArray(processes) || processes.length === 0) {
    throw new Error('Chromium RSS: complete CDP process list is required');
  }
  const seen = new Set();
  let aggregateRssBytes = 0;
  let largestProcessHighWaterBytes = 0;
  for (const processInfo of processes) {
    const pid = processInfo?.id;
    if (!Number.isSafeInteger(pid) || pid <= 0 || seen.has(pid)) {
      throw new Error('Chromium RSS: missing, duplicate or invalid CDP process id');
    }
    seen.add(pid);
    const status = await readStatus('/proc/' + pid + '/status', 'utf8');
    if (typeof status !== 'string') throw new Error('Chromium RSS: invalid /proc status');
    function bytesFor(field) {
      const match = status.match(new RegExp('^' + field + ':\\s*([0-9]+)\\s+kB\\s*$', 'm'));
      const kib = match && Number(match[1]);
      const bytes = kib * 1024;
      if (!match || !Number.isSafeInteger(bytes) || bytes < 0) {
        throw new Error('Chromium RSS: missing or invalid ' + field + ' for pid ' + pid);
      }
      return bytes;
    }
    const rssBytes = bytesFor('VmRSS');
    const highWaterBytes = bytesFor('VmHWM');
    if (highWaterBytes < rssBytes) {
      throw new Error('Chromium RSS: VmHWM smaller than VmRSS for pid ' + pid);
    }
    aggregateRssBytes += rssBytes;
    if (!Number.isSafeInteger(aggregateRssBytes)) {
      throw new Error('Chromium RSS: aggregate VmRSS overflow');
    }
    largestProcessHighWaterBytes = Math.max(largestProcessHighWaterBytes, highWaterBytes);
  }
  return {
    supported:true,
    processCount:seen.size,
    aggregateRssBytes,
    largestProcessHighWaterBytes,
  };
}
