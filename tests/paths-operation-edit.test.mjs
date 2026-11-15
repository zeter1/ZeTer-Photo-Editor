import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathsController } from '../src/ui/paths-controller.js';

const points = () => [
  { x: 0, y: 0, handleOut: { x: 2, y: 3 } },
  { x: 80, y: 0 },
  { x: 80, y: 80 },
  { x: 0, y: 80 },
];
const makePath = id => ({
  id, name: 'Saved', fillStartsWithAllPixels: false,
  subpaths: [
    { operation: 'add', closed: true, fillRule: 'non-zero', points: points() },
    { operation: 'subtract', closed: true, fillRule: 'non-zero', points: points() },
  ],
});
const select = () => ({
  disabled: false, value: '', options: [], onchange: null,
  replaceChildren(...options) { this.options = options; },
});

test('editing an existing subpath changes only its operation, supports four operations and re-Apply', () => {
  const path = makePath(2000), doc = { paths: [path] };
  const layer = { type: 'shape', vectorMask: null };
  const commits = [];
  const controller = createPathsController({
    state: { getDocument: () => doc, getSelectedLayer: () => layer, commit: label => commits.push(label) },
    vectors: { importVectorMask: value => structuredClone(value) },
  });
  controller.setSelectedIndex(0);
  const originalGeometry = structuredClone(path.subpaths[1].points);
  for (const operation of ['intersect', 'exclude', 'add', 'subtract']) {
    assert.equal(controller.changeSubpathOperation(0, 1, operation, { expectedDocument: doc, expectedPath: path }), true);
    assert.equal(path.subpaths[0].operation, 'add');
    assert.equal(path.subpaths[1].operation, operation);
    assert.deepEqual(path.subpaths[1].points, originalGeometry);
    assert.equal(controller.applySelectedDocumentPathAsVectorMask(), true);
    assert.equal(layer.vectorMask.subpaths[1].operation, operation);
  }
  assert.equal(commits.length, 8);
});

test('operation editing refuses wrong index, stale owner/path/subpath, invalid and no-op changes', () => {
  const path = makePath(2000), doc = { paths: [path] }, other = { paths: [makePath(2000)] };
  let active = doc;
  const commits = [];
  const controller = createPathsController({
    state: { getDocument: () => active, commit: label => commits.push(label) },
  });
  controller.setSelectedIndex(0);
  const snapshot = structuredClone(path);
  const context = { expectedDocument: doc, expectedPath: path, expectedSubpath: path.subpaths[1] };
  for (const [index, subpath, operation] of [[1, 1, 'add'], [0, 2, 'add'], [0, -1, 'add'],
    [0, 1, 'replace'], [0, 1, 'subtract']]) {
    assert.equal(controller.changeSubpathOperation(index, subpath, operation, context), false);
  }
  path.subpaths[1] = structuredClone(path.subpaths[1]);
  assert.equal(controller.changeSubpathOperation(0, 1, 'add', context), false);
  path.subpaths[1] = snapshot.subpaths[1];
  active = other;
  assert.equal(controller.changeSubpathOperation(0, 1, 'add', context), false);
  assert.deepEqual(path, snapshot);
  assert.deepEqual(other.paths[0], snapshot);
  assert.deepEqual(commits, []);
});

test('Paths controls select an exact existing subpath and guard late events after document switch', () => {
  const path = makePath(2000), doc = { paths: [path] }, other = { paths: [makePath(2000)] };
  const subpath = select(), operation = select(), commits = [];
  let active = doc;
  const controller = createPathsController({
    state: { getDocument: () => active, commit: label => commits.push(label) },
    ui: {
      controls: { subpath, subpathOperation: operation },
      documentRef: { createElement: () => ({ value: '', textContent: '' }) },
    },
  });
  controller.setSelectedIndex(0);
  controller.updatePathsPanel();
  assert.deepEqual(subpath.options.map(o => o.value), ['0', '1']);
  assert.equal(subpath.disabled, false);
  subpath.value = '1'; subpath.onchange();
  assert.equal(operation.value, 'subtract');
  operation.value = 'intersect'; operation.onchange();
  assert.equal(path.subpaths[1].operation, 'intersect');
  assert.equal(path.subpaths[0].operation, 'add');
  const stale = operation.onchange;
  active = other;
  operation.value = 'exclude'; stale();
  assert.equal(other.paths[0].subpaths[1].operation, 'subtract');
  assert.equal(path.subpaths[1].operation, 'intersect');
  assert.equal(commits.length, 1);
});
