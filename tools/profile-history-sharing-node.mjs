// Separate Node evidence lane. This never stands in for Chrome/file://.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { PerformanceObserver, performance } from 'node:perf_hooks';
import * as pixels from '../src/core/pixel-buffer.js';
import * as state from '../src/core/state.js';
import { HistoryStack } from '../src/core/history.js';
import { createDocumentSessionController } from '../src/workspace/session-controller.js';
import { createHistoryNavigationController } from '../src/workspace/history-navigation-controller.js';
import { createTiledInpaintWorkerJobController } from '../src/core/tiled-inpaint-worker-client.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';
import { makeRecoveryRecord, normalizeRecoveryRecord } from '../src/core/recovery.js';
import { createHistorySharingFixture, historySourceFingerprint, historyOwnerAccounting, validateHistoryProfileConfig } from './history-sharing-fixture.mjs';

const api = { ...pixels, ...state }, ROOT = fileURLToPath(new URL('../', import.meta.url));
const timed = fn => { const start = performance.now(); const value = fn(); return { ms:performance.now() - start, value }; };
const gcSample = phase => {
  const before = process.memoryUsage(), start = performance.now();
  globalThis.gc();
  return { phase, before, forcedGcCallMs:performance.now() - start, after:process.memoryUsage() };
};

export async function profileNodeHistoryCase({ model, shared, ...input }) {
  const config = validateHistoryProfileConfig(input);
  assert.equal(typeof globalThis.gc, 'function', 'run Node with --expose-gc');
  const gcEvents = [];
  const observer = new PerformanceObserver(list => {
    for (const e of list.getEntries()) gcEvents.push({ startTime:e.startTime, duration:e.duration, kind:e.detail.kind, flags:e.detail.flags });
  });
  observer.observe({ entryTypes:['gc'] });
  const result = { model, shared, config, memory:[gcSample('empty-core')] };
  let sessions = [], activeId = '', runtime = {}, pendingWorker = null;
  const sessionController = createDocumentSessionController({
    getSessions:() => sessions, getActiveSessionId:() => activeId,
    setActiveSessionId:id => { activeId = id; }, getRuntimeState:() => runtime,
    applyRuntimeState:value => { runtime = value; }, cloneSelectionShape:() => null,
    cancelPendingContentAwareFill:() => pendingWorker?.cancel(),
  });
  const navigation = createHistoryNavigationController({
    state:{ getHistory:() => runtime.history, setDocument:doc => { runtime.doc = doc; } },
    guard:{ blockPendingDocumentEdit:() => false }, restore:{ restoreDocument:state.restoreDocument },
    transient:{ clearSelection() {}, clearRasterEdit() {}, resetCrop() {} },
    runtime:{ updateAll() {}, markDirty() {}, setStatus() {} },
  });
  const makeSession = doc => {
    const session = sessionController.buildSession(doc);
    // Identical production limits, change only the opt-in being measured.
    session.history = new HistoryStack(80, 128 * 1048576, { shareNativeDataUrls:shared });
    session.history.reset('initial', state.snapshotDocument(doc));
    return session;
  };
  function setup() {
    const fixture = createHistorySharingFixture(api, { model, width:config.width, height:config.height });
    result.expected = historySourceFingerprint(api, fixture.source);
    for (let i = 0; i < config.sessions; i++) {
      const doc = i ? state.restoreDocument(state.snapshotDocument(fixture.doc)) : fixture.doc;
      doc.name = `profile-${i}-0`; sessions.push(makeSession(doc));
    }
    activeId = sessions[0].id; sessionController.loadSession(sessions[0]);
  }
  const commit = label => {
    const snapshot = state.snapshotDocument(runtime.doc);
    return timed(() => runtime.history.push(label, snapshot)).ms;
  };
  const verifyNative = () => assert.deepEqual(historySourceFingerprint(api, runtime.doc.layers[0].highDepthSource), result.expected);
  try {
    setup(); result.memory.push(gcSample('two-session-initial'));
    result.pushMs = [];
    for (const [s, session] of sessions.entries()) {
      sessionController.activateDocumentTab(session.id);
      for (let i = 1; i < config.positions; i++) {
        runtime.doc.name = `profile-${s}-${i}`;
        result.pushMs.push(commit(`metadata-${i}`));
      }
      sessionController.syncCurrentSession();
      assert.equal(session.history.entries.length, config.positions);
    }
    result.memory.push(gcSample('retained-history'));
    result.owners = sessions.map(session => historyOwnerAccounting(session.history));
    result.reconstructionMs = []; result.restoreMs = []; result.navigationMs = [];
    for (const [s, session] of sessions.entries()) {
      sessionController.activateDocumentTab(session.id);
      for (const index of [0, config.positions - 1, 1]) {
        const snapshot = timed(() => runtime.history.entries[index].snapshot);
        result.reconstructionMs.push(snapshot.ms);
        const restored = timed(() => state.restoreDocument(snapshot.value));
        result.restoreMs.push(restored.ms);
        assert.equal(restored.value.name, `profile-${s}-${index}`);
        assert.equal(state.snapshotDocument(restored.value), snapshot.value);
        result.navigationMs.push(timed(() => assert.equal(navigation.jumpToHistory(index), true)).ms);
        verifyNative();
      }
      assert.equal(navigation.undo(), true); verifyNative();
      assert.equal(runtime.doc.name, `profile-${s}-0`);
      assert.equal(navigation.redo(), true); verifyNative();
      assert.equal(runtime.doc.name, `profile-${s}-1`);
      runtime.doc.name = `branch-${s}`; commit('branch');
      assert.equal(runtime.history.canRedo(), false); assert.equal(runtime.history.entries.length, 3);
      sessionController.syncCurrentSession();
    }
    result.memory.push(gcSample('after-navigation-branch'));
    result.worker = [];
    for (const mode of ['complete', 'cancel', 'stale', 'session-close']) {
      sessionController.activateDocumentTab(sessions[0].id);
      const owner = runtime.doc, sessionId = activeId, history = runtime.history;
      const original = state.snapshotDocument(owner), index = history.index, count = history.entries.length;
      const workerSamples = [], exits = [];
      let current = true, dispatched = 0;
      pendingWorker = createTiledInpaintWorkerJobController({ createWorker() {
        const worker = new Worker(new URL('./history-profile-worker-thread.mjs', import.meta.url));
        exits.push(new Promise(resolve => worker.once('exit', resolve)));
        worker.on('message', value => { if (value.profileMemory) workerSamples.push(value.profileMemory); });
        const send = worker.postMessage.bind(worker);
        worker.postMessage = value => {
          send(value); dispatched++;
          if (mode === 'cancel') pendingWorker.cancel();
          if (mode === 'stale') current = false;
          if (mode === 'session-close') sessionController.closeDocumentTab(sessionId);
        };
        return worker;
      } });
      const x = Math.floor(config.width / 2), y = Math.floor(config.height / 2);
      const start = performance.now();
      let reply;
      try {
        reply = await prepareTiledInpaintWithWorker(owner.layers[0].highDepthSource, {
          worker:pendingWorker, isAllowed:(px, py) => px >= x - 1 && px <= x + 1 && py >= y - 1 && py <= y + 1,
          isCancelled:() => !current || activeId !== sessionId || runtime.doc !== owner,
        });
      } finally { pendingWorker.cancel(); await Promise.all(exits); pendingWorker = null; }
      assert.equal(dispatched, 1, 'each probe crossed an actual Worker postMessage');
      assert.equal(state.snapshotDocument(owner), original, 'detached compute never mutates source');
      assert.equal(history.index, index); assert.equal(history.entries.length, count);
      if (mode === 'complete') {
        assert.ok(reply.changed > 0);
        assert.equal(workerSamples.length, 2, 'real isolate input and result observations');
      } else assert.equal(reply.cancelled, true);
      if (mode === 'session-close') assert.equal(sessions.some(session => session.id === sessionId), false);
      result.worker.push({ mode, elapsedMs:performance.now() - start, dispatched,
        cancelled:!!reply.cancelled, changed:reply.changed || 0, samples:workerSamples });
    }
    result.memory.push(gcSample('worker-finished-session-closed'));
    // Real recovery record schema and session builder, in memory. No claim of
    // browser IDB, reload, recovery modal or filesystem persistence.
    sessionController.syncCurrentSession();
    const record = normalizeRecoveryRecord(makeRecoveryRecord(sessions.map(s => ({
      docName:s.doc.name, snapshot:state.snapshotDocument(s.doc),
    })), { activeIndex:0 }));
    const names = sessions.map(s => s.doc.name);
    sessions = record.documents.map(item => makeSession(state.restoreDocument(item.snapshot)));
    assert.deepEqual(sessions.map(s => s.doc.name), names);
    for (const session of sessions) {
      assert.equal(session.history.entries.length, 1);
      assert.deepEqual(historySourceFingerprint(api, session.doc.layers[0].highDepthSource), result.expected);
    }
    result.restored = { sessions:sessions.length, names, positions:sessions.map(s => s.history.entries.length) };
    // Allow perf_hooks to deliver recorded GC entries; no timed retry/sleep.
    await new Promise(resolve => setImmediate(resolve));
    result.gcEvents = gcEvents;
    result.status = 'PASS';
    return result;
  } finally { observer.disconnect(); pendingWorker?.cancel(); }
}

async function main() {
  if (process.argv[2] === '--case') {
    const result = await profileNodeHistoryCase(JSON.parse(process.argv[3]));
    process.stdout.write(JSON.stringify(result));
    return;
  }
  assert.equal(process.argv.length, 2, 'profile takes no implicit size/path flags');
  const config = validateHistoryProfileConfig();
  const report = { schema:'zpe-history-node-profile-v1', createdAt:new Date().toISOString(),
    node:process.version, platform:process.platform, arch:process.arch, config,
    methodology:'Fresh Node child per case, production HistoryStack/session/navigation/Worker protocol; same byte fixtures and logical caps; counterbalanced order. UI/render ports are no-ops, no browser results implied. No performance thresholds or fastest-trial selection.',
    limitations:'Node main isolate heapUsed/external/arrayBuffers overlap and must NOT be summed. Worker heap is sampled inside that isolate; its RSS is the same process-wide RSS, never sum it with parent RSS. Samples are NOT true peaks or browser RAM. GC call wall time and perf_hooks events are distinct. Recovery is real schema plus session rebuild in memory, NOT IDB/reload. Synthetic bytes NOT independent Adobe provenance.',
    cases:[] };
  const output = path.join(ROOT, 'task/evidence/003x6c9-node-profile.json');
  await mkdir(path.dirname(output), { recursive:true });
  for (let repeat = 0; repeat < config.repeats; repeat++) for (const model of ['rgb', 'cmyk']) {
    for (const shared of repeat % 2 ? [true, false] : [false, true]) {
      const child = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), '--case',
        JSON.stringify({ ...config, model, shared })], { cwd:ROOT, encoding:'utf8', windowsHide:true,
        timeout:180000, maxBuffer:8 * 1048576 });
      assert.ifError(child.error);
      assert.equal(child.status, 0, `Node case failed: ${child.stderr.slice(-2500)}`);
      const result = JSON.parse(child.stdout); result.repeat = repeat;
      assert.equal(result.status, 'PASS'); report.cases.push(result);
      await writeFile(output, JSON.stringify(report, null, 2) + '\n');
      const retained = result.memory.find(s => s.phase === 'retained-history').after;
      console.log(JSON.stringify({ repeat, model, shared, retained, reconstructionMs:result.reconstructionMs }));
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
