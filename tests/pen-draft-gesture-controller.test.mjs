import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PEN_DRAFT_BEGIN_RESULT,
  PEN_DRAFT_GESTURE_RESULT,
  createPenDraftGestureController,
} from '../src/interaction/pen-draft-gesture-controller.js';

function createHarness(initialZoom = 1) {
  let zoom = initialZoom;
  const controller = createPenDraftGestureController({
    runtime: { getZoom: () => zoom },
  });
  return {
    controller,
    setZoom(value) { zoom = value; },
  };
}

function begin(controller, point, options = {}) {
  const outcome = controller.beginPoint(point, options);
  assert.equal(outcome.result, PEN_DRAFT_BEGIN_RESULT.STARTED);
  assert.ok(controller.isGesture(outcome.gesture));
  return outcome;
}

test('new Pen draft creates isolated corner nodes and read-only snapshots', () => {
  const { controller } = createHarness();
  const first = begin(controller, { x: 10, y: 20 });
  assert.equal(first.status, 'Перо: клик — угловая точка, тяните — гладкая, Alt+drag — независимая ручка');
  assert.deepEqual(controller.snapshot(), {
    points: [{ x: 10, y: 20, handleIn: null, handleOut: null, kind: 'corner' }],
    hover: { x: 10, y: 20 },
  });
  assert.equal(controller.finish(first.gesture, { x: 10, y: 20 }).status, 'Перо: угловая точка');

  const second = begin(controller, { x: 30, y: 40 });
  assert.equal(controller.snapshot().points.length, 2);
  const external = controller.snapshot();
  external.points[0].x = 999;
  assert.equal(controller.snapshot().points[0].x, 10);
  controller.finish(second.gesture, { x: 30, y: 40 });
});

test('double-click finish intent keeps the 4 / zoom proximity rule without persisting anything', () => {
  const { controller } = createHarness(2);
  const first = begin(controller, { x: 0, y: 0 });
  controller.finish(first.gesture, { x: 0, y: 0 });
  const second = begin(controller, { x: 20, y: 0 });
  controller.finish(second.gesture, { x: 20, y: 0 });

  const finish = controller.beginPoint({ x: 21.9, y: 0 }, { finish: true });
  assert.equal(finish.result, PEN_DRAFT_BEGIN_RESULT.FINISH_REQUESTED);
  assert.equal(finish.gesture, null);
  assert.equal(controller.snapshot().points.length, 2);

  const outside = controller.beginPoint({ x: 22.1, y: 0 }, { finish: true });
  assert.equal(outside.result, PEN_DRAFT_BEGIN_RESULT.STARTED);
  assert.equal(controller.snapshot().points.length, 3);
});


test('Pen closes by clicking its initial anchor without appending a duplicate node', () => {
  const {controller,setZoom} = createHarness(2);
  for(const point of [{x:10,y:10},{x:50,y:10},{x:30,y:45}]){
    const {gesture}=begin(controller,point);
    controller.finish(gesture,point);
  }
  const before=controller.snapshot().points;
  assert.equal(controller.canCloseAt({x:12.9,y:10}),true);
  assert.equal(controller.canCloseAt({x:13.1,y:10}),false);
  assert.equal(controller.updateIdleHover({x:12,y:11}),true);
  assert.deepEqual(controller.snapshot().hover,{x:10,y:10});
  assert.deepEqual(controller.beginPoint({x:12,y:11}),{
    result:PEN_DRAFT_BEGIN_RESULT.CLOSE_REQUESTED,gesture:null,status:null,
  });
  assert.deepEqual(controller.snapshot().points,before);
  assert.equal(controller.consumePoints().length,3);
  assert.equal(controller.hasDraft(),false);
  setZoom(4);
  assert.equal(controller.canCloseAt({x:10,y:10}),false);
});

test('Pen closure needs three nodes; double-click finish and invalid points still work', () => {
  const {controller}=createHarness();
  const first=begin(controller,{x:5,y:5});
  controller.finish(first.gesture,{x:5,y:5});
  const second=begin(controller,{x:35,y:5});
  controller.finish(second.gesture,{x:35,y:5});
  assert.equal(controller.canCloseAt({x:5,y:5}),false);
  assert.equal(controller.beginPoint({x:35,y:5},{finish:true}).result,
    PEN_DRAFT_BEGIN_RESULT.FINISH_REQUESTED);
  assert.equal(controller.snapshot().points.length,2);
  const third=begin(controller,{x:35,y:25});
  controller.finish(third.gesture,{x:35,y:25});
  assert.equal(controller.beginPoint({x:5,y:5},{finish:true}).result,
    PEN_DRAFT_BEGIN_RESULT.CLOSE_REQUESTED);
  assert.equal(controller.beginPoint({x:Infinity,y:5}).result,
    PEN_DRAFT_BEGIN_RESULT.INVALID);
  assert.equal(controller.canCloseAt({x:Infinity,y:5}),false);
  assert.equal(controller.snapshot().points.length,3);
  controller.reset();
  assert.equal(controller.canCloseAt({x:5,y:5}),false);
});

test('finish intent reports the existing minimum-point status for a one-point draft', () => {
  const { controller } = createHarness();
  const first = begin(controller, { x: 5, y: 5 });
  controller.finish(first.gesture, { x: 5, y: 5 });
  const outcome = controller.beginPoint({ x: 7, y: 5 }, { finish: true });
  assert.equal(outcome.result, PEN_DRAFT_BEGIN_RESULT.TOO_SHORT);
  assert.equal(outcome.status, 'Перо: для контура нужно минимум 2 точки');
  assert.equal(controller.snapshot().points.length, 1);
});

test('handle updates preserve threshold, mirrored smooth handles and Alt-independent corner semantics', () => {
  const { controller } = createHarness(2);
  const { gesture } = begin(controller, { x: 10, y: 10 });

  assert.equal(controller.update(gesture, { x: 10.5, y: 10 }), PEN_DRAFT_GESTURE_RESULT.NOOP);
  assert.deepEqual(controller.snapshot().points[0], {
    x: 10, y: 10, handleIn: null, handleOut: null, kind: 'corner',
  });

  assert.equal(controller.update(gesture, { x: 12, y: 13 }), PEN_DRAFT_GESTURE_RESULT.UPDATED);
  assert.deepEqual(controller.snapshot().points[0], {
    x: 10,
    y: 10,
    handleIn: { x: 8, y: 7 },
    handleOut: { x: 12, y: 13 },
    kind: 'smooth',
  });

  assert.equal(
    controller.update(gesture, { x: 14, y: 10 }, { altKey: true }),
    PEN_DRAFT_GESTURE_RESULT.UPDATED,
  );
  assert.deepEqual(controller.snapshot().points[0], {
    x: 10,
    y: 10,
    handleIn: null,
    handleOut: { x: 14, y: 10 },
    kind: 'corner',
  });
});

test('release applies the final pointer coordinate and preserves exact Pen status classification', () => {
  const { controller } = createHarness();
  const smooth = begin(controller, { x: 10, y: 10 });
  const smoothRelease = controller.finish(smooth.gesture, { x: 15, y: 12 });
  assert.equal(smoothRelease.result, PEN_DRAFT_GESTURE_RESULT.FINISHED);
  assert.equal(smoothRelease.status, 'Перо: гладкая точка с симметричными ручками');
  assert.deepEqual(controller.snapshot().points[0].handleOut, { x: 15, y: 12 });

  controller.reset();
  const independent = begin(controller, { x: 20, y: 20 });
  const independentRelease = controller.finish(
    independent.gesture,
    { x: 25, y: 20 },
    { altKey: true },
  );
  assert.equal(independentRelease.status, 'Перо: угловая точка с независимой ручкой');
  assert.equal(controller.snapshot().points[0].kind, 'corner');

  controller.reset();
  const corner = begin(controller, { x: 30, y: 30 });
  assert.equal(
    controller.finish(corner.gesture, { x: 30.5, y: 30 }).status,
    'Перо: угловая точка',
  );
});

test('active-point cancellation removes exactly that transient node and empty drafts disappear', () => {
  const { controller } = createHarness();
  const first = begin(controller, { x: 0, y: 0 });
  controller.finish(first.gesture, { x: 0, y: 0 });
  const second = begin(controller, { x: 20, y: 0 });
  controller.update(second.gesture, { x: 24, y: 0 });

  assert.equal(controller.cancelPoint(second.gesture), PEN_DRAFT_GESTURE_RESULT.CANCELED);
  assert.deepEqual(controller.snapshot().points.map(point => point.x), [0]);

  controller.reset();
  const only = begin(controller, { x: 8, y: 8 });
  assert.equal(controller.cancelPoint(only.gesture), PEN_DRAFT_GESTURE_RESULT.CANCELED);
  assert.equal(controller.hasDraft(), false);
  assert.equal(controller.snapshot(), null);
});

test('whole-draft cancel, reset and consume use explicit transient ownership seams', () => {
  const { controller } = createHarness();
  const first = begin(controller, { x: 1, y: 2 });
  controller.finish(first.gesture, { x: 1, y: 2 });
  controller.updateIdleHover({ x: 9, y: 10 });
  assert.deepEqual(controller.snapshot().hover, { x: 9, y: 10 });
  assert.equal(controller.cancelDraft(), true);
  assert.equal(controller.hasDraft(), false);

  const second = begin(controller, { x: 3, y: 4 });
  controller.finish(second.gesture, { x: 3, y: 4 });
  const points = controller.consumePoints();
  assert.deepEqual(points, [
    { x: 3, y: 4, handleIn: null, handleOut: null, kind: 'corner' },
  ]);
  assert.equal(controller.hasDraft(), false);

  begin(controller, { x: 5, y: 6 });
  controller.reset();
  assert.equal(controller.snapshot(), null);
});

test('stale gestures cannot mutate a replacement draft with the same node index', () => {
  const { controller } = createHarness();
  const stale = begin(controller, { x: 1, y: 1 }).gesture;
  controller.reset();
  const current = begin(controller, { x: 10, y: 10 }).gesture;

  assert.equal(controller.update(stale, { x: 50, y: 50 }), PEN_DRAFT_GESTURE_RESULT.REJECTED);
  assert.deepEqual(controller.snapshot().points[0], {
    x: 10, y: 10, handleIn: null, handleOut: null, kind: 'corner',
  });
  controller.cancelPoint(current);
});

test('invalid points are rejected without creating or mutating a draft', () => {
  const { controller } = createHarness();
  assert.equal(
    controller.beginPoint({ x: Number.NaN, y: 1 }).result,
    PEN_DRAFT_BEGIN_RESULT.INVALID,
  );
  assert.equal(controller.snapshot(), null);

  const active = begin(controller, { x: 1, y: 1 }).gesture;
  assert.equal(
    controller.update(active, { x: Infinity, y: 2 }),
    PEN_DRAFT_GESTURE_RESULT.INVALID,
  );
  assert.equal(controller.snapshot().points[0].handleOut, null);
});
