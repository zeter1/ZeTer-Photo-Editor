import test from 'node:test';
import assert from 'node:assert/strict';
import { addLayer, createDocument, createRasterLayer } from '../src/core/state.js';
import { PIXEL_BUFFER_TILED_SOURCE_KIND } from '../src/core/pixel-buffer.js';
import { createRasterCommandController } from '../src/painting/command-controller.js';
import { createDocumentSessionController } from '../src/workspace/session-controller.js';

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function commandHarness() {
  const documents = ['First', 'Second'].map(name => {
    const doc = createDocument({ name, width:8, height:8 });
    const layer = createRasterLayer({ name:'Native', width:8, height:8 });
    layer.highDepthSource = { kind:PIXEL_BUFFER_TILED_SOURCE_KIND };
    addLayer(doc, layer);
    return doc;
  });
  let currentDoc = documents[0], lease = null, cancellations = 0;
  const pending = [], commits = [], statuses = [], clears = [];
  const controller = createRasterCommandController({
    rasterEdit: {
      persistTiledHighDepthInpaint(doc, layer) {
        const completion = deferred();
        pending.push({ doc, layer, ...completion });
        return completion.promise;
      },
      cancelTiledInpaint() { cancellations += 1; },
      clearBrushBuffer() { clears.push('brush'); },
      clearHighDepthPaintState() { clears.push('native'); },
    },
    state: {
      getDocument:() => currentDoc,
      isPersisting:() => Boolean(lease),
      beginPersist:() => {
        if (lease) return false;
        return (lease = {});
      },
      endPersist:token => { if (token === lease) lease = null; },
      resetPaintState:() => clears.push('reset'),
    },
    target: {
      selected:() => currentDoc.layers[0],
      isEditableRasterLayer:layer => layer?.type === 'raster',
      atPoint:() => null,
      toLocal:point => point,
    },
    selection: { captureSnapshot:() => ({ type:'rect' }), predicate:() => () => true },
    tools: {
      primaryColor:() => '#000000', brushSize:() => 1, opacity:() => 1,
      fillTolerance:() => 0, rgbToCmyk:() => [0, 0, 0, 0],
    },
    ui: {
      setStatus:value => statuses.push(value),
      commit:label => commits.push({ document:currentDoc.name, label }),
      toast() {}, render() {},
    },
  });
  return {
    documents, pending, commits, statuses, clears, controller,
    get lease() { return lease; },
    get cancellations() { return cancellations; },
    setActiveDoc(value) { currentDoc = value; },
  };
}

test('010D-B active tab switch cancels native Worker and stale finally cannot release the next lease', async () => {
  const h = commandHarness();
  const first = h.controller.contentAwareFill({ isAllowed:() => true });
  assert.equal(h.pending.length, 1);
  const oldLease = h.lease;
  assert.equal(h.controller.cancelPendingContentAwareFill(), true);
  assert.equal(h.controller.cancelPendingContentAwareFill(), false);
  assert.equal(h.cancellations, 1);
  assert.equal(h.lease, null);
  h.setActiveDoc(h.documents[1]);
  const second = h.controller.contentAwareFill({ isAllowed:() => true });
  assert.equal(h.pending.length, 2);
  assert.notEqual(h.lease, oldLease);
  const newLease = h.lease;
  const statusesBeforeOldReply = h.statuses.length;
  h.pending[0].resolve({ applied:true, stale:false, filled:1, changed:1, changedTiles:1 });
  assert.equal(await first, false);
  assert.equal(h.lease, newLease, 'stale first finally must not unlock second document');
  assert.equal(h.statuses.length, statusesBeforeOldReply, 'cancelled job must not publish status');
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.clears, [], 'cancelled job must not clear new document cache');
  h.pending[1].resolve({ applied:true, stale:false, filled:1, changed:1, changedTiles:1 });
  assert.equal(await second, true);
  assert.equal(h.lease, null);
  assert.deepEqual(h.commits, [{ document:'Second', label:'Контент-заливка' }]);
});

test('010D-B cancellation does not revoke unrelated or completed operations', async () => {
  const h = commandHarness();
  assert.equal(h.controller.cancelPendingContentAwareFill(), false);
  const running = h.controller.contentAwareFill({ isAllowed:() => true });
  h.pending[0].resolve({ applied:false, stale:false, filled:1, changed:0, changedTiles:0 });
  assert.equal(await running, false);
  assert.equal(h.controller.cancelPendingContentAwareFill(), false);
  assert.equal(h.cancellations, 0);
});

test('010D-B session activation validates destination and retains non-inpaint busy guard', () => {
  const h = commandHarness();
  let busy = true, revoked = 0, activeId = '';
  const sessions = [];
  let runtime = { doc:h.documents[0], history:null, zoom:1, dirty:false,
    cropRect:null, selectionRect:null, selectionShape:null, selectedDocumentPathIndex:-1 };
  const sessionController = createDocumentSessionController({
    getSessions:() => sessions,
    getActiveSessionId:() => activeId,
    setActiveSessionId:value => { activeId = value; },
    getRuntimeState:() => runtime,
    applyRuntimeState:value => { runtime={...runtime,...value}; },
    cloneSelectionShape:value => value,
    cancelPendingContentAwareFill:() => { revoked += 1; if (revoked === 1) busy = false; },
    blockPendingDocumentEdit:() => busy,
  });
  const first = sessionController.buildSession(h.documents[0]);
  const second = sessionController.buildSession(h.documents[1]);
  sessions.push(first, second);
  activeId = first.id;
  runtime.history = first.history;
  sessionController.activateDocumentTab('not-a-session');
  assert.equal(revoked, 0, 'invalid tab must not cancel Worker');
  sessionController.activateDocumentTab(second.id);
  assert.equal(activeId, second.id);
  assert.equal(revoked, 1);
  busy = true;
  sessionController.activateDocumentTab(first.id);
  assert.equal(activeId, second.id, 'non-cancellable busy work still blocks switch');
  assert.equal(revoked, 2);
});
