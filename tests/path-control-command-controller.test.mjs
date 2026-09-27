import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATH_CONTROL_COMMAND_RESULT,
  createPathControlCommandController,
} from '../src/interaction/path-control-command-controller.js';

function harness({
  source = 'shape',
  node = {
    x: 10,
    y: 20,
    handleIn: { x: 8, y: 20 },
    handleOut: { x: 12, y: 20 },
    kind: 'smooth',
  },
  layer = null,
  resolve = null,
} = {}) {
  const owner = { layers: [], groups: [], paths: [] };
  const resolvedLayer = layer ?? (
    source === 'document-path'
      ? null
      : { id: 'layer-1', type: source === 'shape' ? 'shape' : 'raster', locked: false, groupId: null }
  );
  if (resolvedLayer) owner.layers.push(resolvedLayer);
  const target = { source, control: 'anchor', nodeIndex: 0, layer: resolvedLayer };
  const commits = [];
  const statuses = [];
  let resolveCalls = 0;
  const controller = createPathControlCommandController({
    state: { getDocument: () => owner },
    targets: {
      resolve: value => {
        resolveCalls += 1;
        return resolve
          ? resolve(value)
          : { source, node, layer: resolvedLayer, nodeIndex: 0, control: value.control };
      },
    },
    transaction: { commit: label => commits.push(label) },
    ui: { setStatus: message => statuses.push(message) },
  });
  return {
    controller,
    owner,
    target,
    node,
    layer: resolvedLayer,
    commits,
    statuses,
    getResolveCalls: () => resolveCalls,
  };
}

test('Shape Alt-anchor conversion clears both handles, sets corner kind and publishes exact history', () => {
  const h = harness();
  assert.equal(
    h.controller.convertAnchorToCorner(h.owner, h.target, { altKey: true }),
    PATH_CONTROL_COMMAND_RESULT.COMMITTED,
  );
  assert.equal(h.node.handleIn, null);
  assert.equal(h.node.handleOut, null);
  assert.equal(h.node.kind, 'corner');
  assert.deepEqual(h.commits, ['Преобразовать Bézier-узел в угловой']);
  assert.deepEqual(h.statuses, []);
});

test('Vector Mask and Saved Path conversions keep source-specific history labels', () => {
  const cases = [
    ['vector-mask', 'Преобразовать узел векторной маски'],
    ['document-path', 'Преобразовать узел сохранённого контура'],
  ];
  for (const [source, label] of cases) {
    const h = harness({ source });
    assert.equal(
      h.controller.convertAnchorToCorner(h.owner, h.target, { altKey: true }),
      PATH_CONTROL_COMMAND_RESULT.COMMITTED,
      source,
    );
    assert.deepEqual(h.commits, [label], source);
  }
});

test('handle targets and non-Alt anchor intent are ignored without target resolution', () => {
  const h = harness();
  h.target.control = 'handleOut';
  assert.equal(
    h.controller.convertAnchorToCorner(h.owner, h.target, { altKey: true }),
    PATH_CONTROL_COMMAND_RESULT.IGNORED,
  );
  h.target.control = 'anchor';
  assert.equal(
    h.controller.convertAnchorToCorner(h.owner, h.target, { altKey: false }),
    PATH_CONTROL_COMMAND_RESULT.IGNORED,
  );
  assert.equal(h.getResolveCalls(), 0);
  assert.deepEqual(h.commits, []);
});

test('already-corner anchor is a semantic no-op with exact status and no history', () => {
  const node = { x: 1, y: 2, handleIn: null, handleOut: null, kind: 'corner' };
  const h = harness({ node });
  assert.equal(
    h.controller.convertAnchorToCorner(h.owner, h.target, { altKey: true }),
    PATH_CONTROL_COMMAND_RESULT.NOOP,
  );
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.statuses, ['Bézier-узел уже угловой']);
  assert.deepEqual(node, { x: 1, y: 2, handleIn: null, handleOut: null, kind: 'corner' });
});

test('stale or missing target is rejected without mutation, status or history', () => {
  const node = {
    x: 1,
    y: 2,
    handleIn: { x: 0, y: 2 },
    handleOut: { x: 2, y: 2 },
    kind: 'smooth',
  };
  const before = structuredClone(node);
  const h = harness({ node, resolve: () => null });
  assert.equal(
    h.controller.convertAnchorToCorner(h.owner, h.target, { altKey: true }),
    PATH_CONTROL_COMMAND_RESULT.REJECTED,
  );
  assert.deepEqual(node, before);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.statuses, []);
});

test('recursive layer lock is revalidated immediately before mutation', () => {
  const h = harness();
  h.layer.groupId = 'group-1';
  h.owner.groups.push({ id: 'group-1', locked: true, parentGroupId: null });
  const before = structuredClone(h.node);
  assert.equal(
    h.controller.convertAnchorToCorner(h.owner, h.target, { altKey: true }),
    PATH_CONTROL_COMMAND_RESULT.REJECTED,
  );
  assert.deepEqual(h.node, before);
  assert.deepEqual(h.commits, []);
});

test('command rejects an owner that is no longer the active document', () => {
  const h = harness();
  const staleOwner = { layers: [], groups: [], paths: [] };
  const before = structuredClone(h.node);
  assert.equal(
    h.controller.convertAnchorToCorner(staleOwner, h.target, { altKey: true }),
    PATH_CONTROL_COMMAND_RESULT.REJECTED,
  );
  assert.deepEqual(h.node, before);
  assert.equal(h.getResolveCalls(), 0);
  assert.deepEqual(h.commits, []);
});
