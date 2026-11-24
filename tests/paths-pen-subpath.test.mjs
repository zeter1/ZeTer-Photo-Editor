import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathsController } from '../src/ui/paths-controller.js';

const anchors = () => [
  { x: 3, y: 4, handleIn: null, handleOut: { x: 5, y: 4 }, kind: 'smooth' },
  { x: 20, y: 4, handleIn: { x: 18, y: 4 }, handleOut: null, kind: 'corner' },
  { x: 20, y: 20, handleIn: null, handleOut: null, kind: 'corner' },
];

function fixture() {
  const path = {
    id: 2000, name: 'Editable', fillStartsWithAllPixels: false,
    subpaths: [{ operation: 'add', closed: true, fillRule: 'non-zero', points: anchors() }],
  };
  const owner = { paths: [path] };
  const commits = [];
  const statuses = [];
  let activeOwner = owner;
  const controller = createPathsController({
    state: { getDocument: () => activeOwner, commit: title => commits.push(title) },
    ui: { setStatus: value => statuses.push(value) },
  });
  controller.setSelectedIndex(0);
  return { owner, path, controller, commits, statuses, switchOwner: next => { activeOwner = next; } };
}

test('Pen appends a real closed cubic Bézier subpath for every vector boolean operation', () => {
  for (const operation of ['add', 'subtract', 'intersect', 'exclude']) {
    const { owner, path, controller, commits } = fixture();
    const points = anchors();
    assert.equal(controller.appendPenSubpath(points, { index: 0, expectedDocument: owner, closed: true, operation }), true);
    assert.equal(path.subpaths.length, 2);
    assert.equal(path.subpaths[1].operation, operation);
    assert.deepEqual(path.subpaths[1].points, points);
    assert.notEqual(path.subpaths[1].points, points);
    assert.equal(path.id, 2000);
    assert.equal(commits.length, 1);
    points[0].x = 999;
    assert.equal(path.subpaths[1].points[0].x, 3);
  }
});

test('Pen rejects invalid geometry, nonclosed mask contours, unsupported operations and stale owners atomically', () => {
  const { owner, path, controller, commits, switchOwner } = fixture();
  const original = structuredClone(path);
  for (const [points, options] of [
    [anchors().slice(0, 2), { closed: true }],
    [anchors(), { closed: false }],
    [anchors(), { closed: true, operation: 'replace' }],
    [[...anchors().slice(0, 2), { x: Infinity, y: 2 }], { closed: true }],
    [[...anchors().slice(0, 2), { x: 4, y: 2, handleIn: { x: NaN, y: 0 } }], { closed: true }],
    [anchors(), { closed: true, index: 1 }],
  ]) {
    assert.equal(controller.appendPenSubpath(points, { index: 0, expectedDocument: owner, ...options }), false);
    assert.deepEqual(path, original);
  }
  switchOwner({ paths: [structuredClone(path)] });
  assert.equal(controller.appendPenSubpath(anchors(), { index: 0, expectedDocument: owner, closed: true }), false);
  assert.deepEqual(path, original);
  assert.deepEqual(commits, []);
});
