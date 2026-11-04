import test from 'node:test';
import assert from 'node:assert/strict';
import { inpaintSelectedSamples } from '../src/core/inpaint.js';
import { createRasterCommandController } from '../src/painting/command-controller.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture({ width = 7, height = 7, pausePersist = false } = {}) {
  const original = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    original.set([(index * 47) % 251, (index * 13) % 251, (index * 29) % 251, 255], index * 4);
  }
  let staged = null;
  let saved = null;
  let lease = null;
  let writes = 0;
  const entered = deferred();
  const resume = deferred();
  const layer = { id: 'rgba8', type: 'raster', highDepthSource: null, dataUrl: 'before', width, height };
  const doc = { id: 'doc', width, height, layers: [layer], selectedLayerId: layer.id };
  const commits = [];
  const ctx = {
    getImageData: () => ({ data: new Uint8ClampedArray(original), width, height }),
    putImageData: image => { staged = new Uint8ClampedArray(image.data); },
  };
  const commands = createRasterCommandController({
    rasterEdit: {
      clearBrushBuffer() {},
      cancelTiledInpaint() {},
      async ensureRasterBuffer() { return { canvas: { width, height }, ctx }; },
      async persistPaintLayer(owner, selected, options) {
        entered.resolve();
        if (pausePersist) await resume.promise;
        if (options?.isContinuationCurrent && !options.isContinuationCurrent()) return false;
        writes++;
        saved = new Uint8ClampedArray(staged);
        selected.dataUrl = 'after';
        return true;
      },
    },
    state: {
      getDocument: () => doc,
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
    ui: { commit: label => commits.push(label), setStatus() {}, render() {} },
  });
  return {
    original, doc, layer, commands, commits, entered, resume,
    get writes() { return writes; }, get saved() { return saved; }, get lease() { return lease; },
  };
}

test('003X/6c-9: cancelled RGBA8 fill cannot publish after delayed canvas encoding', async () => {
  const f = fixture({ pausePersist: true });
  const pending = f.commands.contentAwareFill({ isAllowed: (x, y) => x === 3 && y === 3 });
  await f.entered.promise;
  assert.equal(f.commands.cancelPendingContentAwareFill(), true);
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
