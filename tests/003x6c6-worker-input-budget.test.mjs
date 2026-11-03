import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, deserializePixelBufferSource, serializePixelBufferSource,
  serializeTiledPixelBufferSource } from '../src/core/pixel-buffer.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';
import { runTiledInpaintWorkerJob } from '../src/core/tiled-inpaint-worker-protocol.js';
import { createRasterEditController } from '../src/painting/controller.js';
import { HistoryStack } from '../src/core/history.js';

const W = 131, H = 99, SELECTED = 5 * W + 5;
const isAllowed = (x, y) => y * W + x === SELECTED;
function native(model) {
  const c = model === 'rgb' ? 4 : 5, bits = model === 'rgb' ? 16 : 32;
  const data = bits === 16 ? new Uint16Array(W * H * c) : new Float32Array(W * H * c);
  for (let p = 0; p < W * H; p++) {
    data.set(bits === 16 ? [10000, 20000, 30000, 65535] : [0.2, 0.3, 0.4, 0.5, 1], p * c);
  }
  data.set(bits === 16 ? [60000, 60000, 60000, 65535] : [9, 9, 9, 9, 1], SELECTED * c);
  if (bits === 32) {
    const words = new Uint32Array(data.buffer);
    words[4] = 0x7f812345; // signaling NaN alpha payload
    words[9] = 0x80000000; // negative-zero alpha
    words[words.length - 1] = 0x7f811111; // edge-tile alpha payload
  }
  return createPixelBuffer({ width:W, height:H, model, channels:c, bitsPerChannel:bits, data });
}
function bytes(source) {
  const data = deserializePixelBufferSource(source).data;
  return Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
function urlChars(source) {
  return source.tiles.reduce((sum, tile) => sum + tile.dataUrl.length, 0);
}
test('003X/6c-6: UI -> Worker input clone has an opt-in native URL cap before selection or mutation', async (t) => {
  for (const model of ['rgb', 'cmyk']) {
    const nativeBuffer = native(model);
    const source = serializeTiledPixelBufferSource(nativeBuffer, { tileSize:32 });
    const original = JSON.stringify(source), originalBytes = bytes(source);
    const required = urlChars(source), history = new HistoryStack(8, 8 * 1024 * 1024);
    history.reset('before', JSON.stringify({ layer:source }));
    const beforeHistory = history.current().snapshot, historyChars = beforeHistory.length;
    const input = { source, selectedIndices:Uint32Array.of(SELECTED), compactResult:true };
    const clone = structuredClone(input);
    assert.equal(urlChars(clone.source), required);
    assert.equal(clone.source.tiles.length, source.tiles.length);
    t.diagnostic(model + ': UI retained tile URLs ' + required + ' chars; input structuredClone URLs ' +
      urlChars(clone.source) + ' chars; independent History JSON ' + historyChars + ' chars');
    let samples = 0, yields = 0, dispatched = 0;
    const worker = { async run(job) {
      dispatched++;
      assert.equal(urlChars(job.source), required, 'complete source must cross the input boundary');
      return structuredClone(runTiledInpaintWorkerJob(structuredClone(job)));
    } };
    const options = { worker, maxWorkerInputDataUrlChars:required - 1,
      isAllowed:(x,y) => { samples++; return isAllowed(x,y); },
      yieldControl:async () => { yields++; } };
    await assert.rejects(prepareTiledInpaintWithWorker(source, options),
      /Worker input exceeds maxWorkerInputDataUrlChars/);
    assert.equal(samples, 0, 'refuse before any selection predicate');
    assert.equal(yields, 0, 'refuse before any async yield');
    assert.equal(dispatched, 0, 'refuse before structured-clone transport');
    assert.equal(JSON.stringify(source), original);
    assert.deepEqual(bytes(source), originalBytes);
    assert.strictEqual(history.current().snapshot, beforeHistory, 'no History mutation');
    const accepted = await prepareTiledInpaintWithWorker(source, {
      ...options, maxWorkerInputDataUrlChars:required,
    });
    assert.equal(dispatched, 1, 'exact cap accepts the original native payload');
    assert.equal(samples, W * H);
    assert.ok(accepted.changed > 0);
    assert.deepEqual(bytes(accepted.source),
      bytes(runTiledInpaintWorkerJob({ ...input, compactResult:false }).source), 'no native precision loss');
    assert.equal(JSON.stringify(source), original, 'immutable UI source');
    const after = JSON.parse(JSON.stringify(accepted.source));
    history.push('after', JSON.stringify({ layer:after }));
    assert.deepEqual(bytes(JSON.parse(history.undo().snapshot).layer), originalBytes);
    assert.deepEqual(bytes(JSON.parse(history.redo().snapshot).layer), bytes(accepted.source));
    assert.deepEqual(bytes(JSON.parse(JSON.stringify(serializePixelBufferSource(nativeBuffer)))),
      originalBytes, 'legacy .zpe v1 high-depth bytes remain exact');
  }
});
test('003X/6c-6: invalid budgets reject atomically, controller forwards opt-in cap, retry survives a late Worker failure', async () => {
  for (const model of ['rgb', 'cmyk']) {
    const source = serializeTiledPixelBufferSource(native(model), { tileSize:32 });
    const required = urlChars(source), before = JSON.stringify(source);
    let sampled = 0, dispatched = 0;
    const worker = { async run(job) {
      dispatched++;
      if (dispatched === 1) throw new Error('late injected Worker failure');
      return runTiledInpaintWorkerJob(job);
    } };
    for (const invalid of [-1, 1.25, Number.NaN, Infinity, '1']) {
      await assert.rejects(prepareTiledInpaintWithWorker(source, {
        worker, maxWorkerInputDataUrlChars:invalid,
        isAllowed:() => { sampled++; return true; },
      }), /invalid maxWorkerInputDataUrlChars/);
    }
    assert.equal(sampled, 0);
    assert.equal(dispatched, 0);
    const layer = { id:'layer', type:'raster', locked:false, groupId:null,
      width:W, height:H, highDepthSource:source, dataUrl:null,
      filters:{}, highDepthPreview:null };
    const owner = { width:W, height:H, layers:[layer], groups:[] };
    const editor = createRasterEditController({
      getDocument:() => owner, tiledInpaintWorker:worker,
      documentRef:{ createElement() { throw new Error('no preview on refusal'); } },
    });
    await assert.rejects(editor.persistTiledHighDepthInpaint(owner, layer, {
      isAllowed, maxWorkerInputDataUrlChars:required - 1,
    }), /Worker input exceeds maxWorkerInputDataUrlChars/);
    assert.equal(dispatched, 0, 'controller preflight avoids Worker');
    assert.strictEqual(layer.highDepthSource, source);
    assert.equal(layer.dataUrl, null);
    await assert.rejects(prepareTiledInpaintWithWorker(source, {
      worker, isAllowed, maxWorkerInputDataUrlChars:required,
    }), /late injected Worker failure/);
    assert.equal(dispatched, 1);
    assert.equal(JSON.stringify(source), before);
    const success = await prepareTiledInpaintWithWorker(source, {
      worker, isAllowed, maxWorkerInputDataUrlChars:required,
    });
    assert.equal(dispatched, 2, 'retry succeeds without corrupting the source');
    assert.ok(success.changed > 0);
    assert.equal(JSON.stringify(source), before);
  }
});
test('003X/6c-6: opt-in cap preserves cooperative cancellation, stale owner and no-Worker fallback', async () => {
  const source = serializeTiledPixelBufferSource(native('cmyk'), { tileSize:32 });
  const required = urlChars(source), before = JSON.stringify(source);
  let cancelled = false, dispatched = 0;
  const halted = await prepareTiledInpaintWithWorker(source, {
    worker:{ async run() { dispatched++; throw Error('must not dispatch'); } },
    maxWorkerInputDataUrlChars:required, isAllowed,
    scanChunkPixels:17, yieldControl:async () => { cancelled = true; },
    isCancelled:() => cancelled,
  });
  assert.equal(halted.cancelled, true);
  assert.equal(dispatched, 0);
  let current = true;
  const stale = await prepareTiledInpaintWithWorker(source, {
    worker:{ async run(job) {
      dispatched++;
      current = false;
      return runTiledInpaintWorkerJob(job);
    } },
    maxWorkerInputDataUrlChars:required, isAllowed, isCancelled:() => !current,
  });
  assert.equal(stale.cancelled, true);
  assert.equal(dispatched, 1);
  assert.equal(JSON.stringify(source), before);
  const fallback = await prepareTiledInpaintWithWorker(source, {
    worker:null, maxWorkerInputDataUrlChars:0, isAllowed,
  });
  assert.ok(fallback.changed > 0,
    'Worker-specific input URL budget does not break cooperative CPU fallback');
  assert.equal(JSON.stringify(source), before);
});
