import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CROP_GESTURE_MIN_SIZE,
  createCropGestureController,
} from '../src/interaction/crop-gesture-controller.js';

function makeController(owner = { id:'doc-a' }) {
  let current = owner;
  return {
    owner,
    setCurrent(value) { current = value; },
    controller:createCropGestureController({
      state:{ getDocument:() => current },
    }),
  };
}

test('crop gesture requires an explicit document-state bridge', () => {
  assert.throws(() => createCropGestureController(), /state bridge/);
});

test('begin captures the exact owner and update normalizes reverse drags', () => {
  const { owner, controller } = makeController();
  const gesture = controller.begin(owner, { x:40, y:50 });

  assert.equal(gesture.owner, owner);
  assert.deepEqual(controller.snapshot(), { x:40, y:50, width:0, height:0 });

  const updated = controller.update(gesture, { x:10, y:15 });
  assert.deepEqual(updated, { x:10, y:15, width:30, height:35 });
  assert.ok(Object.isFrozen(updated));

  assert.throws(() => { updated.x = 999; }, TypeError);
  assert.deepEqual(controller.snapshot(), { x:10, y:15, width:30, height:35 });
});

test('session restore keeps only immutable crop presentation state and no active gesture', () => {
  const { owner, controller } = makeController();
  const restored = controller.restore({ x:3, y:4, width:50, height:60 });
  assert.deepEqual(restored, { x:3, y:4, width:50, height:60 });
  assert.ok(Object.isFrozen(restored));

  const staleGesture = controller.begin(owner, { x:1, y:1 });
  controller.restore({ x:8, y:9, width:20, height:25 });
  assert.equal(controller.update(staleGesture, { x:30, y:40 }), null);
  assert.deepEqual(controller.snapshot(), { x:8, y:9, width:20, height:25 });

  assert.throws(
    () => controller.restore({ x:0, y:0, width:-1, height:2 }),
    /non-negative geometry/,
  );
});

test('finish uses the actual release point and accepts the exact 10x10 boundary', () => {
  const { owner, controller } = makeController();
  const gesture = controller.begin(owner, { x:5, y:5 });
  controller.update(gesture, { x:7, y:7 });

  const result = controller.finish(gesture, {
    x:5 + CROP_GESTURE_MIN_SIZE,
    y:5 + CROP_GESTURE_MIN_SIZE,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.owner, owner);
  assert.deepEqual(result.rect, { x:5, y:5, width:10, height:10 });
  assert.ok(Object.isFrozen(result.rect));
  assert.deepEqual(controller.snapshot(), result.rect);
});

test('undersized and stale releases clear transient state without a persisted intent', () => {
  const { owner, controller, setCurrent } = makeController();
  const undersized = controller.begin(owner, { x:0, y:0 });
  assert.deepEqual(controller.finish(undersized, { x:9, y:30 }), {
    accepted:false,
    reason:'too-small',
  });
  assert.equal(controller.hasDraft(), false);

  const stale = controller.begin(owner, { x:0, y:0 });
  setCurrent({ id:'doc-b' });
  assert.deepEqual(controller.finish(stale, { x:30, y:30 }), {
    accepted:false,
    reason:'stale',
  });
  assert.equal(controller.hasDraft(), false);
});

test('cancel and reset are idempotent and reject cancellation of another gesture', () => {
  const { owner, controller } = makeController();
  const gesture = controller.begin(owner, { x:1, y:2 });
  assert.equal(controller.cancel({ kind:'crop' }), false);
  assert.equal(controller.hasDraft(), true);
  assert.equal(controller.cancel(gesture), true);
  assert.equal(controller.cancel(), true);
  assert.equal(controller.hasDraft(), false);

  controller.begin(owner, { x:4, y:5 });
  controller.reset();
  controller.reset();
  assert.equal(controller.hasDraft(), false);
});

test('crop overlay preserves dimming, frame, thirds and balanced canvas state', () => {
  const { controller } = makeController();
  controller.restore({ x:10, y:12, width:60, height:30 });

  const calls = [];
  const ctx = {
    save:() => calls.push(['save']),
    restore:() => calls.push(['restore']),
    fillRect:(...args) => calls.push(['fillRect', ...args]),
    clearRect:(...args) => calls.push(['clearRect', ...args]),
    strokeRect:(...args) => calls.push(['strokeRect', ...args]),
    setLineDash:value => calls.push(['dash', ...value]),
    beginPath:() => calls.push(['beginPath']),
    moveTo:(...args) => calls.push(['moveTo', ...args]),
    lineTo:(...args) => calls.push(['lineTo', ...args]),
    stroke:() => calls.push(['stroke']),
    set fillStyle(value) { calls.push(['fillStyle', value]); },
    set strokeStyle(value) { calls.push(['strokeStyle', value]); },
    set lineWidth(value) { calls.push(['lineWidth', value]); },
    set globalAlpha(value) { calls.push(['globalAlpha', value]); },
  };

  assert.equal(controller.draw(ctx, { zoom:2, width:100, height:80 }), true);
  assert.deepEqual(calls.slice(0, 9), [
    ['save'],
    ['fillStyle', '#0008'],
    ['fillRect', 0, 0, 100, 80],
    ['clearRect', 10, 12, 60, 30],
    ['strokeStyle', '#ffffff'],
    ['lineWidth', .5],
    ['dash', 4, 2.5],
    ['strokeRect', 10, 12, 60, 30],
    ['globalAlpha', .72],
  ]);
  assert.ok(calls.some(call => call[0] === 'dash' && call[1] === 2 && call[2] === 2.5));
  assert.ok(calls.some(call => call[0] === 'moveTo' && call[1] === 30 && call[2] === 12));
  assert.ok(calls.some(call => call[0] === 'moveTo' && call[1] === 50 && call[2] === 12));
  assert.ok(calls.some(call => call[0] === 'moveTo' && call[1] === 10 && call[2] === 22));
  assert.ok(calls.some(call => call[0] === 'moveTo' && call[1] === 10 && call[2] === 32));
  assert.deepEqual(calls.at(-1), ['restore']);
});

test('transient crop owner never mutates persisted document geometry or history', () => {
  const owner = Object.freeze({
    width:100,
    height:80,
    layers:Object.freeze([Object.freeze({ id:'layer-a', x:7, y:8 })]),
  });
  const { controller } = makeController(owner);
  const before = JSON.stringify(owner);

  const gesture = controller.begin(owner, { x:10, y:10 });
  controller.update(gesture, { x:70, y:50 });
  const result = controller.finish(gesture, { x:80, y:60 });

  assert.equal(result.accepted, true);
  assert.equal(JSON.stringify(owner), before);
  assert.equal('commit' in controller, false);
});
