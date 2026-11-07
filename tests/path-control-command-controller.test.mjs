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


test('Alt+Shift anchor makes open Shape midpoint smooth with aligned neighbour tangents and one history entry', () => {
  const first = { x:0, y:0 };
  const middle = { x:12, y:6, handleIn:null, handleOut:null, kind:'corner' };
  const last = { x:30, y:0 };
  const points = [first, middle, last];
  const h = harness({ node:middle, resolve: () => ({
    source:'shape', node:middle, nodeIndex:1, points, closed:false, layer:null,
  }) });
  const before = structuredClone(points);
  assert.equal(h.controller.convertAnchorToSmooth(h.owner, h.target, { altKey:true, shiftKey:true }),
    PATH_CONTROL_COMMAND_RESULT.COMMITTED);
  assert.equal(middle.kind, 'smooth');
  assert.ok(middle.handleIn && middle.handleOut);
  const inVector = { x:middle.x - middle.handleIn.x, y:middle.y - middle.handleIn.y };
  const outVector = { x:middle.handleOut.x - middle.x, y:middle.handleOut.y - middle.y };
  assert.ok(Math.abs(inVector.x * outVector.y - inVector.y * outVector.x) < 1e-9);
  assert.ok(inVector.x * outVector.x + inVector.y * outVector.y > 0);
  assert.ok(Math.abs(Math.hypot(inVector.x, inVector.y) - Math.hypot(12, 6) / 3) < 1e-9);
  assert.ok(Math.abs(Math.hypot(outVector.x, outVector.y) - Math.hypot(18, -6) / 3) < 1e-9);
  assert.deepEqual(points[0], before[0]);
  assert.deepEqual(points[2], before[2]);
  assert.deepEqual(h.commits, ['Сгладить Bézier-узел']);
});

test('open endpoints only generate the used tangent; closed vector masks wrap', () => {
  for (const index of [0, 2]) {
    const points = [
      { x:0, y:0, kind:'corner' },
      { x:12, y:0, kind:'corner' },
      { x:24, y:0, kind:'corner' },
    ];
    const node = points[index];
    const h = harness({ node, resolve: () => ({
      source:'document-path', node, nodeIndex:index, points, closed:false, layer:null,
    }) });
    assert.equal(h.controller.convertAnchorToSmooth(h.owner, h.target, { altKey:true, shiftKey:true }),
      PATH_CONTROL_COMMAND_RESULT.COMMITTED);
    assert.equal(node.handleIn === null, index === 0);
    assert.equal(node.handleOut === null, index === 2);
    assert.deepEqual(h.commits, ['Сгладить узел сохранённого контура']);
  }
  const points = [{x:0,y:0,kind:'corner'}, {x:12,y:0}, {x:12,y:12}];
  const h = harness({ source:'vector-mask', node:points[0], resolve: () => ({
    source:'vector-mask', node:points[0], nodeIndex:0, points, closed:true, layer:null,
  }) });
  assert.equal(h.controller.convertAnchorToSmooth(h.owner, h.target, { altKey:true, shiftKey:true }),
    PATH_CONTROL_COMMAND_RESULT.COMMITTED);
  assert.ok(points[0].handleIn && points[0].handleOut);
  assert.deepEqual(h.commits, ['Сгладить узел векторной маски']);
});

test('Alt+Shift smooth conversion ignores handles and missing modifiers without resolving', () => {
  const h = harness();
  h.target.control = 'handleIn';
  assert.equal(h.controller.convertAnchorToSmooth(h.owner, h.target, {altKey:true, shiftKey:true}),
    PATH_CONTROL_COMMAND_RESULT.IGNORED);
  h.target.control = 'anchor';
  assert.equal(h.controller.convertAnchorToSmooth(h.owner, h.target, {altKey:true, shiftKey:false}),
    PATH_CONTROL_COMMAND_RESULT.IGNORED);
  assert.equal(h.getResolveCalls(), 0);
});

test('smooth conversion no-ops repeated smooth and degenerate paths without changing geometry', () => {
  const points = [{x:0,y:0,kind:'corner'}, {x:0,y:0,kind:'corner'}];
  const h = harness({node:points[0], resolve:()=>({
    source:'shape',node:points[0],nodeIndex:0,points,closed:false,layer:null,
  })});
  assert.equal(h.controller.convertAnchorToSmooth(h.owner,h.target,{altKey:true,shiftKey:true}),
    PATH_CONTROL_COMMAND_RESULT.NOOP);
  assert.deepEqual(points[0],{x:0,y:0,kind:'corner'});
  assert.equal(h.commits.length,0);
  assert.match(h.statuses[0], /соседние узлы/);
  points[1].x = 10;
  assert.equal(h.controller.convertAnchorToSmooth(h.owner,h.target,{altKey:true,shiftKey:true}),
    PATH_CONTROL_COMMAND_RESULT.COMMITTED);
  const after = structuredClone(points[0]);
  assert.equal(h.controller.convertAnchorToSmooth(h.owner,h.target,{altKey:true,shiftKey:true}),
    PATH_CONTROL_COMMAND_RESULT.NOOP);
  assert.deepEqual(points[0],after);
  assert.deepEqual(h.commits,['Сгладить Bézier-узел']);
  assert.equal(h.statuses.at(-1),'Bézier-узел уже сглажен');
});

test('smooth conversion refuses stale owner, stale target and recursively locked layer', () => {
  const points=[{x:0,y:0,kind:'corner'},{x:10,y:10}];
  const h=harness({node:points[0],resolve:()=>({
    source:'shape',node:points[0],nodeIndex:0,points,closed:false,layer:h.layer,
  })});
  const request={altKey:true,shiftKey:true};
  assert.equal(h.controller.convertAnchorToSmooth({layers:[]},h.target,request),
    PATH_CONTROL_COMMAND_RESULT.REJECTED);
  h.layer.groupId='group-1';
  h.owner.groups.push({id:'group-1',locked:true,parentGroupId:null});
  assert.equal(h.controller.convertAnchorToSmooth(h.owner,h.target,request),
    PATH_CONTROL_COMMAND_RESULT.REJECTED);
  h.owner.groups[0].locked=false;
  assert.equal(h.controller.convertAnchorToSmooth(h.owner,h.target,request),
    PATH_CONTROL_COMMAND_RESULT.COMMITTED);
  assert.equal(h.commits.length,1);

  const rejected=harness({resolve:()=>null});
  assert.equal(rejected.controller.convertAnchorToSmooth(rejected.owner,rejected.target,request),
    PATH_CONTROL_COMMAND_RESULT.REJECTED);
  assert.deepEqual(rejected.commits,[]);
});
