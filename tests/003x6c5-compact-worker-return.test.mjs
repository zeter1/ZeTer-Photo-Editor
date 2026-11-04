import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import {
  createPixelBuffer, deserializePixelBufferSource, serializePixelBufferSource,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { HistoryStack } from '../src/core/history.js';
import { runTiledInpaintWorkerJob } from '../src/core/tiled-inpaint-worker-protocol.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';
import { createTiledInpaintWorkerJobController } from '../src/core/tiled-inpaint-worker-client.js';

const WIDTH = 131, HEIGHT = 99, EDITED = 5 * WIDTH + 5;

function native(model) {
  const channels = model === 'rgb' ? 4 : 5;
  if (model === 'rgb') {
    const data = new Uint16Array(WIDTH * HEIGHT * channels);
    for (let p = 0; p < WIDTH * HEIGHT; p++) {
      data.set([10000, 20000, 30000, 65535], p * channels);
    }
    data.set([60000, 60000, 60000, 65535], EDITED * channels);
    data[data.length - 1] = 12345;
    return createPixelBuffer({
      width:WIDTH, height:HEIGHT, model, channels, bitsPerChannel:16, data,
    });
  }
  const data = new Float32Array(WIDTH * HEIGHT * channels);
  for (let p = 0; p < WIDTH * HEIGHT; p++) {
    data.set([0.2, 0.3, 0.4, 0.5, 1], p * channels);
  }
  data.set([9, 9, 9, 9, 1], EDITED * channels);
  const words = new Uint32Array(data.buffer);
  words[4] = 0x7f812345; // untouched signaling-NaN alpha payload
  words[9] = 0x80000000; // untouched negative-zero alpha
  words[words.length - 1] = 0x7f811111; // last edge tile's alpha payload
  return createPixelBuffer({
    width:WIDTH, height:HEIGHT, model, channels, bitsPerChannel:32, data,
  });
}

function raw(source) {
  const data = deserializePixelBufferSource(source).data;
  return Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
function jobFor(source) {
  return { source, selectedIndices:Uint32Array.of(EDITED), maxFillPixels:100 };
}
function allowed(x, y) { return y * WIDTH + x === EDITED; }
function detachedWorker() {
  return {
    async run(job) {
      assert.equal(job.compactResult, true, 'real UI Worker requests compact transport');
      return structuredClone(runTiledInpaintWorkerJob(job));
    },
  };
}

test('003X/6c-5: only changed native tiles cross Worker result boundary, not 19 unchanged Data URLs', async (t) => {
  for (const model of ['rgb', 'cmyk']) {
    const pixelBuffer = native(model);
    const originalRaw = Buffer.from(new Uint8Array(pixelBuffer.data.buffer));
    for (const tileSize of [32, 65, 256]) { // sparse, edge and single dense tile
      const source = serializeTiledPixelBufferSource(pixelBuffer, { tileSize });
      const before = JSON.stringify(source);
      const full = runTiledInpaintWorkerJob(jobFor(source));
      assert.ok(full.changed > 0 && full.changedTiles === 1);
      const compact = runTiledInpaintWorkerJob({ ...jobFor(source), compactResult:true });
      assert.equal(Object.hasOwn(compact, 'source'), false);
      assert.equal(compact.tileUpdates.length, 1);
      const changedIndex = source.tiles.findIndex((tile, i) =>
        full.source.tiles[i].dataUrl !== tile.dataUrl);
      assert.equal(compact.tileUpdates[0].index, changedIndex);
      assert.equal(compact.tileUpdates[0].dataUrl, full.source.tiles[changedIndex].dataUrl);
      const fullChars = JSON.stringify(full).length;
      const compactChars = JSON.stringify(compact).length;
      assert.ok(compactChars < fullChars, 'does not clone unchanged encoded strings back');
      if (tileSize === 32) {
        t.diagnostic(model + ': full Worker reply ' + fullChars + ' JSON chars; compact changed-tile reply ' + compactChars + ' chars');
        assert.ok(compactChars * 4 < fullChars,
          model + ': measured actual Worker JSON payload is at most 1/4 of the original');
      }
      const prepared = await prepareTiledInpaintWithWorker(source, {
        worker:detachedWorker(), isAllowed:allowed,
      });
      assert.equal(prepared.changed, full.changed);
      assert.deepEqual(raw(prepared.source), raw(full.source),
        'updated native pixels and alpha are bit-exact with original compute');
      assert.deepEqual(raw(source), originalRaw,
        'sNaN, signed zero and edge alpha remain unchanged in source');
      assert.equal(JSON.stringify(source), before, 'no source metadata mutation');
      for (let i = 0; i < source.tiles.length; i++) {
        if (i !== changedIndex) {
          assert.strictEqual(prepared.source.tiles[i], source.tiles[i],
            'unchanged native tiles retain their existing UI-side owner');
        }
      }
      const saved = JSON.parse(JSON.stringify(prepared.source));
      assert.deepEqual(raw(saved), raw(full.source), 'native v2 save/reopen is exact');
      const history = new HistoryStack(6, 8 * 1024 * 1024);
      history.reset('before', JSON.stringify({ layer:source }));
      history.push('Content-Aware Fill', JSON.stringify({ layer:saved }));
      assert.equal(history.canUndo(), true);
      assert.deepEqual(raw(JSON.parse(history.undo().snapshot).layer), originalRaw);
      assert.deepEqual(raw(JSON.parse(history.redo().snapshot).layer), raw(full.source));
    }
    const v1 = JSON.parse(JSON.stringify(serializePixelBufferSource(pixelBuffer)));
    assert.deepEqual(raw(v1), originalRaw, 'legacy v1 .zpe stays byte-exact');
  }
});

test('003X/6c-5: compact reply rejects duplicate/out-of-range/wrong tile, native alpha corruption and preserves retry', async () => {
  for (const model of ['rgb', 'cmyk']) {
    const source = serializeTiledPixelBufferSource(native(model), { tileSize:32 });
    const before = JSON.stringify(source), beforeRaw = raw(source);
    const valid = runTiledInpaintWorkerJob({ ...jobFor(source), compactResult:true });
    const bad = [
      result => { result.tileUpdates.push({ ...result.tileUpdates[0] }); result.changedTiles++; },
      result => { result.tileUpdates[0].index = source.tiles.length; },
      result => { result.tileUpdates[0].index = 1; },
      result => { result.tileUpdates[0].dataUrl = 'data:broken'; },
      result => { result.source = source; },
    ];
    for (const corrupt of bad) {
      const reply = structuredClone(valid);
      corrupt(reply);
      await assert.rejects(prepareTiledInpaintWithWorker(source, {
        worker:{ async run() { return reply; } }, isAllowed:allowed,
      }), /invalid Worker result/, model + ': invalid patch fails closed');
      assert.equal(JSON.stringify(source), before, 'failure never publishes to source');
    }
    // A syntactically correct high-depth patch with a changed alpha bit must
    // still be rejected by the full native selected-pixel validator.
    const mutated = structuredClone(valid);
    const prefix = mutated.tileUpdates[0].dataUrl.indexOf('base64,') + 7;
    const bytes = Buffer.from(mutated.tileUpdates[0].dataUrl.slice(prefix), 'base64');
    const alphaByte = source.bitsPerChannel / 8;
    const stride = source.channels * alphaByte;
    const pixelOffset = (5 * source.tiles[0].width + 5) * stride;
    bytes[pixelOffset + stride - 1] ^= 1;
    mutated.tileUpdates[0].dataUrl =
      mutated.tileUpdates[0].dataUrl.slice(0, prefix) + bytes.toString('base64');
    await assert.rejects(prepareTiledInpaintWithWorker(source, {
      worker:{ async run() { return mutated; } }, isAllowed:allowed,
    }), /invalid Worker result/, 'alpha mutation must fail closed');
    assert.deepEqual(raw(source), beforeRaw);
    const good = await prepareTiledInpaintWithWorker(source, {
      worker:detachedWorker(), isAllowed:allowed,
    });
    assert.ok(good.changed > 0, 'retry after malformed later reply succeeds');
    assert.equal(JSON.stringify(source), before);
  }
});

test('003X/6c-5: compact result remains cancellation/stale/failure atomic; actual Node Worker sends a patch', async () => {
  const source = serializeTiledPixelBufferSource(native('cmyk'), { tileSize:32 });
  const before = JSON.stringify(source);
  let cancelled = false, calls = 0;
  const cancellation = await prepareTiledInpaintWithWorker(source, {
    isAllowed:allowed, isCancelled:() => cancelled,
    worker:{ async run(job) { calls++; cancelled = true; return runTiledInpaintWorkerJob(job); } },
  });
  assert.equal(cancellation.cancelled, true);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(source), before);
  await assert.rejects(prepareTiledInpaintWithWorker(source, {
    isAllowed:allowed, worker:{ async run() { throw new Error('injected Worker failure'); } },
  }), /injected Worker failure/);
  assert.equal(JSON.stringify(source), before);

  const client = createTiledInpaintWorkerJobController({
    createWorker:() => new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs', import.meta.url),
      { type:'module' }),
  });
  try {
    const actual = await prepareTiledInpaintWithWorker(source, { worker:client, isAllowed:allowed });
    assert.ok(actual.changed > 0);
    assert.deepEqual(raw(actual.source), raw((await prepareTiledInpaintWithWorker(source, {
      worker:detachedWorker(), isAllowed:allowed,
    })).source), 'actual Worker thread and simulated clone are bit-exact');
  } finally { client.cancel(); }
  assert.equal(JSON.stringify(source), before);
});
