import test from 'node:test';
import assert from 'node:assert/strict';
import { inpaintSelectedSamples } from '../src/core/inpaint.js';
import { createRasterCommandController } from '../src/painting/command-controller.js';
import { createRasterEditController } from '../src/painting/controller.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture({ width = 7, height = 7, pausePersist = false, rejectPersist = false, replaceCacheBeforeError = false } = {}) {
  const original = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    original.set([(index * 47) % 251, (index * 13) % 251, (index * 29) % 251, 255], index * 4);
  }
  let staged = null;
  let saved = null;
  let lease = null;
  let writes = 0;
  let cached = null;
  let discarded = 0;
  let failNextPersist = rejectPersist;
  const entered = deferred();
  const resume = deferred();
  const layer = { id: 'rgba8', type: 'raster', highDepthSource: null, dataUrl: 'before', width, height };
  const doc = { id: 'doc', width, height, layers: [layer], selectedLayerId: layer.id };
  let activeDoc = doc;
  const commits = [];
  const pendingStates = [];
  const ctx = {
    getImageData: () => ({ data: new Uint8ClampedArray(original), width, height }),
    putImageData: image => { staged = new Uint8ClampedArray(image.data); },
  };
  const commands = createRasterCommandController({
    rasterEdit: {
      clearBrushBuffer() { cached = null; },
      discardRasterBuffer(owner, selected, canvas) {
        if (owner !== doc || selected !== layer || cached?.canvas !== canvas) return false;
        cached = null;
        discarded++;
        return true;
      },
      cancelTiledInpaint() {},
      async ensureRasterBuffer() { return cached ??= { canvas: { width, height }, ctx }; },
      async persistPaintLayer(owner, selected, options) {
        entered.resolve();
        if (pausePersist) await resume.promise;
        if (failNextPersist) {
          failNextPersist = false;
          if (replaceCacheBeforeError) cached = { canvas: { width, height }, ctx };
          throw new Error('PNG encode failure');
        }
        if (options?.isContinuationCurrent && !options.isContinuationCurrent()) return false;
        writes++;
        saved = new Uint8ClampedArray(staged);
        selected.dataUrl = 'after';
        return true;
      },
    },
    state: {
      getDocument: () => activeDoc,
      isPersisting: () => lease !== null,
      beginPersist: () => lease ? false : (lease = {}),
      endPersist: token => { if (lease === token) lease = null; },
    },
    target: {
      selected: () => layer,
      atPoint: () => layer,
      toLocal: point => point,
      isEditableRasterLayer: value => value === layer,
    },
    selection: {
      captureSnapshot: () => ({ type: 'rect' }),
      intersectsLayer: () => true,
      predicate: () => () => true,
    },
    tools: {
      primaryColor: () => '#000000', brushSize: () => 1, opacity: () => 1,
      fillTolerance: () => 0, rgbToCmyk: () => [0, 0, 0, 0],
    },
    ui: { commit: label => commits.push(label), setStatus() {}, render() {},
      onContentAwarePendingChange: active => pendingStates.push(active) },
  });
  return {
    original, doc, layer, commands, commits, pendingStates, entered, resume,
    setActiveDoc: value => { activeDoc = value; },
    get writes() { return writes; }, get saved() { return saved; }, get lease() { return lease; },
    get cached() { return cached; }, get discarded() { return discarded; },
  };
}

test('003X/6c-9: cancelled RGBA8 fill cannot publish after delayed canvas encoding', async () => {
  const f = fixture({ pausePersist: true });
  const pending = f.commands.contentAwareFill({ isAllowed: (x, y) => x === 3 && y === 3 });
  await f.entered.promise;
  assert.equal(f.commands.cancelPendingContentAwareFill(), true);
  assert.equal(f.cached, null, 'cancel must discard the staged preview before allowing another edit');
  assert.equal(f.discarded, 1);
  f.resume.resolve();
  assert.equal(await pending, false);
  assert.equal(f.layer.dataUrl, 'before');
  assert.equal(f.writes, 0);
  assert.deepEqual(f.commits, []);
  assert.equal(f.lease, null);
});

test('003X/6c-9: RGBA8 kernel cancellation before completion leaves raster untouched', async () => {
  const f = fixture({ width: 256, height: 256 });
  let cancelled = false;
  const result = await f.commands.contentAwareFill({
    isAllowed: (x, y) => {
      if (!cancelled && y === 65 && x === 0) {
        cancelled = true;
        assert.equal(f.commands.cancelPendingContentAwareFill(), true);
      }
      return x === 128 && y === 128;
    },
  });
  assert.equal(cancelled, true);
  assert.equal(result, false);
  assert.equal(f.writes, 0);
  assert.equal(f.layer.dataUrl, 'before');
  assert.deepEqual(f.commits, []);
});

test('003X/6c-9: successful RGBA8 fill retains the deterministic byte result', async () => {
  const f = fixture();
  const allowed = (x, y) => x === 3 && y === 3;
  const expected = new Uint8ClampedArray(f.original);
  assert.ok(inpaintSelectedSamples(expected, 7, 7, 4, { isAllowed: allowed }) > 0);
  assert.equal(await f.commands.contentAwareFill({ isAllowed: allowed }), true);
  assert.deepEqual(f.saved, expected);
  assert.equal(f.writes, 1);
  assert.deepEqual(f.commits, ['Контент-заливка']);
  assert.equal(f.lease, null);
});

test('003X/6c-9: stale cancelled publication cannot discard a newer raster cache', async () => {
  const f = fixture({ pausePersist: true });
  const old = f.commands.contentAwareFill({ isAllowed: (x, y) => x === 3 && y === 3 });
  await f.entered.promise;
  const cancelledCanvas = f.cached.canvas;
  assert.equal(f.commands.cancelPendingContentAwareFill(), true);
  const next = f.commands.contentAwareFill({ isAllowed: (x, y) => x === 2 && y === 2 });
  f.resume.resolve();
  assert.equal(await old, false);
  assert.equal(await next, true);
  assert.notEqual(f.cached.canvas, cancelledCanvas);
  assert.equal(f.discarded, 1);
  assert.equal(f.writes, 1);
  assert.deepEqual(f.commits, ['Контент-заливка']);
});

test('003X/6c-9: real raster cache discards only its exact canvas identity', async () => {
  const layer = { id: 'target', type: 'raster', dataUrl: null, width: 4, height: 4 };
  const doc = { id: 'doc', layers: [layer] };
  const edit = createRasterEditController({
    getDocument: () => doc,
    documentRef: { createElement: () => ({ getContext: () => ({}) }) },
  });
  const first = await edit.ensureRasterBuffer(doc, layer);
  assert.equal(edit.brushCanvas, first.canvas);
  assert.equal(edit.discardRasterBuffer(doc, layer, {}), false);
  assert.equal(edit.brushCanvas, first.canvas);
  assert.equal(edit.discardRasterBuffer(doc, layer, first.canvas), true);
  assert.equal(edit.brushCanvas, null);
  const second = await edit.ensureRasterBuffer(doc, layer);
  assert.notEqual(second.canvas, first.canvas);
  assert.equal(edit.discardRasterBuffer(doc, layer, first.canvas), false);
  assert.equal(edit.brushCanvas, second.canvas);
});

test('003X/6c-9: failed PNG encoding discards staged RGBA8 canvas before next edit', async () => {
  const f = fixture({ rejectPersist: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await f.commands.contentAwareFill({ isAllowed: (x, y) => x === 3 && y === 3 }), false);
  } finally {
    console.error = originalError;
  }
  assert.equal(f.layer.dataUrl, 'before');
  assert.equal(f.writes, 0);
  assert.deepEqual(f.commits, []);
  assert.equal(f.cached, null, 'failed encoding must not expose the stale modified canvas');
  assert.equal(f.discarded, 1);
  assert.equal(f.lease, null);
  assert.equal(await f.commands.contentAwareFill({ isAllowed: (x, y) => x === 2 && y === 2 }), true);
  assert.equal(f.writes, 1);
  assert.deepEqual(f.commits, ['Контент-заливка']);
});
test('003X/6c-9: rejected stale PNG cannot evict another canvas acquired during encoding', async () => {
  const f = fixture({ rejectPersist: true, replaceCacheBeforeError: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await f.commands.contentAwareFill({ isAllowed: (x, y) => x === 3 && y === 3 }), false);
  } finally {
    console.error = originalError;
  }
  assert.notEqual(f.cached, null, 'failure cleanup must not clear the newer canvas');
  assert.equal(f.discarded, 0, 'old canvas must not match the replacement');
  assert.equal(f.layer.dataUrl, 'before');
  assert.deepEqual(f.commits, []);
});


test('003X/6c-9: rejected PNG after a tab switch releases only the old raster canvas', async () => {
  const f = fixture({ pausePersist: true, rejectPersist: true });
  const old = f.commands.contentAwareFill({ isAllowed: (x, y) => x === 3 && y === 3 });
  await f.entered.promise;
  const oldCanvas = f.cached.canvas;
  f.setActiveDoc({ id: 'another-tab', layers: [] });
  f.resume.resolve();
  assert.equal(await old, false);
  assert.equal(f.cached, null, 'stale rejected encoding must not keep the dirty canvas for future edits');
  assert.equal(f.discarded, 1);
  assert.equal(f.layer.dataUrl, 'before');
  assert.equal(f.writes, 0);
  assert.deepEqual(f.commits, []);
  assert.equal(f.lease, null);
  assert.ok(oldCanvas);
});


test('003X/6c-9: visible Content-Aware cancellation follows owner start, Escape and completion', async () => {
  const f = fixture({ pausePersist:true });
  const pending = f.commands.contentAwareFill({ isAllowed:(x,y)=>x===3 && y===3 });
  await f.entered.promise;
  assert.deepEqual(f.pendingStates,[true], 'progress shown only after a real persist lease');
  assert.equal(f.commands.cancelPendingContentAwareFill(),true);
  assert.deepEqual(f.pendingStates,[true,false], 'cancellation hides progress immediately');
  f.resume.resolve();
  assert.equal(await pending,false);
  assert.deepEqual(f.pendingStates,[true,false], 'late finally must not emit another cancellation');
  assert.equal(f.layer.dataUrl,'before');
  assert.deepEqual(f.commits,[]);
});

test('003X/6c-9: stale cancelled fill cannot hide progress owned by successor', async () => {
  const f = fixture({ pausePersist:true });
  const old = f.commands.contentAwareFill({ isAllowed:(x,y)=>x===3 && y===3 });
  await f.entered.promise;
  assert.equal(f.commands.cancelPendingContentAwareFill(),true);
  const next = f.commands.contentAwareFill({ isAllowed:(x,y)=>x===2 && y===2 });
  assert.deepEqual(f.pendingStates,[true,false,true]);
  f.resume.resolve();
  assert.equal(await old,false);
  assert.equal(await next,true);
  assert.deepEqual(f.pendingStates,[true,false,true,false],
    'the superseded operation must not toggle the next operation progress');
  assert.equal(f.writes,1);
});

test('003X/6c-9: Content-Aware success and rejected calls keep progress truthful', async () => {
  const f = fixture();
  assert.equal(await f.commands.contentAwareFill({ isAllowed:(x,y)=>x===3 && y===3 }),true);
  assert.deepEqual(f.pendingStates,[true,false]);
  assert.equal(await f.commands.contentAwareFill({ ownerDocument:{ id:'foreign' },isAllowed:()=>true }),false);
  assert.deepEqual(f.pendingStates,[true,false], 'wrong-owner rejection never starts progress');
});
