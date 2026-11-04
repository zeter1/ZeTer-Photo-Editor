import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, deserializePixelBufferSource, serializePixelBufferSource,
  inpaintPixelBuffer,
} from '../src/core/pixel-buffer.js';
import { createRasterCommandController } from '../src/painting/command-controller.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function harness({ width = 7, height = 7, model = 'rgb', depth = 16, persist } = {}) {
  const channels = model === 'rgb' ? 4 : 5;
  const Samples = depth === 16 ? Uint16Array : Float32Array;
  const data = new Samples(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < channels; c++) {
      data[i * channels + c] = depth === 16 ? 8000 + (c * 6500 + i * 127) % 40000
        : (c + 1) / 8 + (i % 13) / 100;
    }
  }
  if (depth === 32) {
    // Exact bytes, including a signaling NaN and negative zero on untouched pixels.
    const words = new Uint32Array(data.buffer);
    words[0] = 0x7f812345;
    words[(width * height - 1) * channels + 2] = 0x80000000;
  }
  const source = serializePixelBufferSource(createPixelBuffer({
    width, height, model, channels, bitsPerChannel:depth, data,
  }));
  const layer = { id:'native', type:'raster', highDepthSource:source, locked:false,
    width, height, dataUrl:'data:image/png;base64,old' };
  const doc = { id:'doc', width, height, layers:[layer], selectedLayerId:layer.id };
  let lease = null;
  const commits = [], statuses = [];
  let saved = 0;
  const rasterEdit = {
    clearBrushBuffer() {},
    cancelTiledInpaint() {},
    editableHighDepthBuffer:() => deserializePixelBufferSource(layer.highDepthSource),
    async persistHighDepthMutation(owner, target, buffer, options) {
      if (persist) return persist({ owner, target, buffer, options, layer, doc });
      saved += 1;
      layer.highDepthSource = serializePixelBufferSource(buffer);
      return true;
    },
  };
  const commands = createRasterCommandController({
    rasterEdit,
    state:{
      getDocument:()=>doc, isPersisting:()=>lease !== null,
      beginPersist:()=>lease ? false : (lease = {}),
      endPersist:token=>{ if (lease === token) lease = null; },
    },
    target:{
      selected:()=>layer, atPoint:()=>layer, toLocal:point=>point,
      isEditableRasterLayer:value=>value === layer && !value.locked,
    },
    selection:{ captureSnapshot:()=>({ type:'rect' }), intersectsLayer:()=>true,
      predicate:()=>()=>true },
    tools:{ primaryColor:()=> '#000000', brushSize:()=>1, opacity:()=>1,
      fillTolerance:()=>0, rgbToCmyk:()=>[0,0,0,0] },
    ui:{ commit:label=>commits.push(label), setStatus:value=>statuses.push(value), render() {} },
  });
  return { source, doc, layer, commands, commits, statuses,
    get saved() { return saved; }, get lease() { return lease; } };
}

test('003X/6c-9: a cancelled non-tiled RGB16 fill never publishes after delayed preview', async () => {
  const entered = deferred(), resume = deferred();
  const h = harness({ persist:async ({ options, buffer, layer }) => {
    entered.resolve();
    await resume.promise;
    if (options?.isContinuationCurrent && !options.isContinuationCurrent()) return false;
    layer.highDepthSource = serializePixelBufferSource(buffer);
    return true;
  } });
  const pending = h.commands.contentAwareFill({ isAllowed:(x,y)=>x===3 && y===3 });
  await entered.promise;
  assert.equal(h.commands.cancelPendingContentAwareFill(), true);
  resume.resolve();
  assert.equal(await pending, false);
  assert.equal(h.layer.highDepthSource, h.source, 'cancelled preview must not replace the original native source');
  assert.deepEqual(h.commits, [], 'no Undo entry for cancelled fill');
  assert.equal(h.lease, null);
});

test('003X/6c-9: synchronous cancellation during a large flat native scan skips publication', async () => {
  const h = harness({ width:256, height:256 });
  let requested = false;
  const result = await h.commands.contentAwareFill({
    isAllowed:(x,y)=>{
      if (!requested && y===65 && x===0) {
        requested = true;
        assert.equal(h.commands.cancelPendingContentAwareFill(), true);
      }
      return x===128 && y===128;
    },
  });
  assert.equal(requested, true);
  assert.equal(result, false);
  assert.equal(h.saved, 0);
  assert.equal(h.layer.highDepthSource, h.source);
  assert.deepEqual(h.commits, []);
});

for (const [model, depth] of [['rgb',16],['cmyk',32]]) {
  test(`003X/6c-9: successful contiguous ${model}/${depth} fill preserves native byte oracle`, async () => {
    const h = harness({ model, depth });
    const allowed = (x,y)=>x===3 && y===3;
    const expected = deserializePixelBufferSource(h.source);
    assert.ok(inpaintPixelBuffer(expected, { isAllowed:allowed }) > 0);
    assert.equal(await h.commands.contentAwareFill({ isAllowed:allowed }), true);
    assert.equal(h.saved, 1);
    assert.deepEqual(h.commits, ['Контент-заливка']);
    const observed = deserializePixelBufferSource(h.layer.highDepthSource);
    const bytes = buffer => [...new Uint8Array(buffer.data.buffer, buffer.data.byteOffset, buffer.data.byteLength)];
    assert.deepEqual(bytes(observed),bytes(expected));
    assert.equal(h.lease, null);
  });
}
