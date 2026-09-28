import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewportController } from '../src/workspace/viewport-controller.js';

function createHarness({
  zoom = 0.75,
  session = { zoom },
  documentValue = { width: 400, height: 200 },
  viewportRect = { width: 1000, height: 700 },
  overlayRect = { left: 20, top: 10 },
  canvasPoint = { x: 60, y: 40 },
} = {}) {
  let liveZoom = zoom;
  let pendingFrame = null;
  const calls = { resize: 0, overlay: 0, status: [], points: [], scrollTo: [] };
  const viewport = {
    scrollLeft: 100,
    scrollTop: 50,
    getBoundingClientRect: () => viewportRect,
    scrollTo(value) {
      calls.scrollTo.push(value);
      this.scrollLeft = value.left;
      this.scrollTop = value.top;
    },
  };
  const overlay = { getBoundingClientRect: () => overlayRect };
  const controller = createViewportController({
    state: {
      getZoom: () => liveZoom,
      setZoom: value => { liveZoom = value; },
      getCurrentSession: () => session,
      getDocument: () => documentValue,
    },
    geometry: {
      clientPointToCanvas: (clientX, clientY) => {
        calls.points.push([clientX, clientY]);
        return canvasPoint;
      },
    },
    view: {
      viewport,
      overlay,
      updateCanvasSize: () => { calls.resize += 1; },
      drawOverlay: () => { calls.overlay += 1; },
      requestFrame: callback => { pendingFrame = callback; },
    },
    ui: { setStatus: message => calls.status.push(message) },
  });
  return {
    controller, calls, viewport,
    getZoom: () => liveZoom,
    runFrame: () => { const callback = pendingFrame; pendingFrame = null; callback?.(); },
    hasPendingFrame: () => Boolean(pendingFrame),
  };
}

test('setZoom clamps to the canonical 10%-1600% range and syncs the active session', () => {
  const session = { zoom: 0.75 };
  const h = createHarness({ session });
  h.controller.setZoom(99);
  assert.equal(h.getZoom(), 16);
  assert.equal(session.zoom, 16);
  assert.equal(h.calls.resize, 1);
  assert.equal(h.calls.overlay, 1);
  assert.deepEqual(h.calls.status, ['Масштаб 1600%']);
  h.controller.setZoom(-5);
  assert.equal(h.getZoom(), 0.1);
  assert.equal(session.zoom, 0.1);
  assert.deepEqual(h.calls.status, ['Масштаб 1600%', 'Масштаб 10%']);
});

test('semantic no-op zoom does not redraw or publish status', () => {
  const session = { zoom: 0.75 };
  const h = createHarness({ session });
  h.controller.setZoom(0.7500005);
  assert.equal(h.getZoom(), 0.75);
  assert.equal(session.zoom, 0.75);
  assert.equal(h.calls.resize, 0);
  assert.equal(h.calls.overlay, 0);
  assert.deepEqual(h.calls.status, []);
});

test('silent zoom still updates live/session state and canvas geometry', () => {
  const session = { zoom: 0.75 };
  const h = createHarness({ session });
  h.controller.setZoom(1.25, false);
  assert.equal(h.getZoom(), 1.25);
  assert.equal(session.zoom, 1.25);
  assert.equal(h.calls.resize, 1);
  assert.equal(h.calls.overlay, 1);
  assert.deepEqual(h.calls.status, []);
});

test('zoom without an active session still updates live runtime safely', () => {
  const h = createHarness({ session: null });
  h.controller.setZoom(2);
  assert.equal(h.getZoom(), 2);
  assert.equal(h.calls.resize, 1);
  assert.equal(h.calls.overlay, 1);
});

test('point-anchored zoom defers scroll correction until the next animation frame', () => {
  const h = createHarness({ zoom: 1 });
  h.controller.setZoomAtClientPoint(2, 100, 90);
  assert.equal(h.getZoom(), 2);
  assert.deepEqual(h.calls.points, [[100, 90]]);
  assert.equal(h.hasPendingFrame(), true);
  assert.equal(h.viewport.scrollLeft, 100);
  assert.equal(h.viewport.scrollTop, 50);
  assert.deepEqual(h.calls.status, ['Масштаб 200%']);
  h.runFrame();
  assert.equal(h.viewport.scrollLeft, 140);
  assert.equal(h.viewport.scrollTop, 50);
});

test('point-anchored semantic no-op keeps scroll and schedules no frame', () => {
  const h = createHarness({ zoom: 1 });
  h.controller.setZoomAtClientPoint(1, 100, 90);
  assert.deepEqual(h.calls.points, [[100, 90]]);
  assert.equal(h.hasPendingFrame(), false);
  assert.equal(h.viewport.scrollLeft, 100);
  assert.equal(h.viewport.scrollTop, 50);
  assert.deepEqual(h.calls.status, []);
});

test('fitToView uses the existing 90px fit policy and resets viewport scroll', () => {
  const session = { zoom: 0.75 };
  const h = createHarness({ session });
  h.controller.fitToView();
  assert.equal(h.getZoom(), 2.275);
  assert.equal(session.zoom, 2.275);
  assert.deepEqual(h.calls.scrollTo, [{ left: 0, top: 0 }]);
  assert.equal(h.viewport.scrollLeft, 0);
  assert.equal(h.viewport.scrollTop, 0);
  assert.deepEqual(h.calls.status, ['Масштаб 228%']);
});
