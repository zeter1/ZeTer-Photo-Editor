import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointerLifecycleRouter } from '../src/interaction/pointer-lifecycle-router.js';

class FakePointerTarget {
  constructor() {
    this.handlers = new Map();
    this.captured = new Set();
    this.releases = [];
  }
  addEventListener(name, handler) { this.handlers.set(name, handler); }
  setPointerCapture(pointerId) { this.captured.add(pointerId); }
  hasPointerCapture(pointerId) { return this.captured.has(pointerId); }
  releasePointerCapture(pointerId) {
    if (!this.captured.has(pointerId)) {
      const error = new Error('pointer is not captured');
      error.name = 'NotFoundError';
      throw error;
    }
    this.captured.delete(pointerId);
    this.releases.push(pointerId);
  }
  dispatch(name, event) { return this.handlers.get(name)?.(event); }
}

test('router owns one active pointer and keeps idle hover routing available', () => {
  const target = new FakePointerTarget();
  const calls = [];
  const router = createPointerLifecycleRouter({
    target,
    shouldStartPointer: event => event.button === 0,
    onPointerDown: event => calls.push(['down', event.pointerId]),
    onPointerMove: event => calls.push(['move', event.pointerId]),
    onPointerUp: event => calls.push(['up', event.pointerId]),
  });

  target.dispatch('pointerdown', { pointerId:1, button:1 });
  assert.equal(router.hasActivePointer(), false);
  target.dispatch('pointerdown', { pointerId:1, button:0 });
  assert.equal(router.isActivePointer(1), true);
  assert.equal(target.hasPointerCapture(1), true);

  target.dispatch('pointerdown', { pointerId:2, button:0 });
  target.dispatch('pointermove', { pointerId:2 });
  target.dispatch('pointermove', { pointerId:1 });
  target.dispatch('pointerup', { pointerId:2 });
  assert.equal(router.isActivePointer(1), true);

  target.dispatch('pointerup', { pointerId:1 });
  assert.equal(router.hasActivePointer(), false);
  assert.equal(target.hasPointerCapture(1), false);
  assert.deepEqual(target.releases, [1]);

  target.dispatch('pointermove', { pointerId:2 });
  assert.deepEqual(calls, [['down',1],['move',1],['up',1],['move',2]]);
});

test('pointercancel releases capture and reports the cancellation reason', () => {
  const target = new FakePointerTarget();
  const cancellations = [];
  const router = createPointerLifecycleRouter({
    target,
    onPointerCancel: (event, context) => cancellations.push([event.pointerId, context.reason]),
  });
  target.dispatch('pointerdown', { pointerId:7 });
  target.dispatch('pointercancel', { pointerId:7 });
  assert.equal(router.hasActivePointer(), false);
  assert.deepEqual(target.releases, [7]);
  assert.deepEqual(cancellations, [[7, 'pointercancel']]);
});

test('unexpected lostpointercapture cancels the gesture without double releasing capture', () => {
  const target = new FakePointerTarget();
  const cancellations = [];
  const router = createPointerLifecycleRouter({
    target,
    onPointerCancel: (event, context) => cancellations.push([event.pointerId, context.reason]),
  });
  target.dispatch('pointerdown', { pointerId:9 });
  target.captured.delete(9);
  target.dispatch('lostpointercapture', { pointerId:9 });
  assert.equal(router.hasActivePointer(), false);
  assert.deepEqual(target.releases, []);
  assert.deepEqual(cancellations, [[9, 'lostpointercapture']]);
  target.dispatch('pointercancel', { pointerId:9 });
  assert.deepEqual(cancellations, [[9, 'lostpointercapture']]);
});

test('external release clears ownership and capture without synthesizing a domain cancel', () => {
  const target = new FakePointerTarget();
  const cancellations = [];
  const router = createPointerLifecycleRouter({
    target,
    onPointerCancel: (event, context) => cancellations.push([event.pointerId, context.reason]),
  });
  target.dispatch('pointerdown', { pointerId:10 });
  assert.equal(router.releaseActivePointer(), true);
  assert.equal(router.hasActivePointer(), false);
  assert.deepEqual(target.releases, [10]);
  target.dispatch('lostpointercapture', { pointerId:10 });
  assert.deepEqual(cancellations, []);
});

test('router releases ownership even when a pointerup callback rejects', async () => {
  const target = new FakePointerTarget();
  const router = createPointerLifecycleRouter({
    target,
    onPointerUp: async () => { throw new Error('release failure'); },
  });
  target.dispatch('pointerdown', { pointerId:11 });
  await assert.rejects(target.dispatch('pointerup', { pointerId:11 }), /release failure/);
  assert.equal(router.hasActivePointer(), false);
  assert.deepEqual(target.releases, [11]);
});
