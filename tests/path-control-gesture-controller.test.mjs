import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATH_CONTROL_GESTURE_RESULT,
  createPathControlGestureController,
} from '../src/interaction/path-control-gesture-controller.js';

function point(overrides = {}) {
  return {
    x: 10,
    y: 20,
    handleIn: { x:8, y:20 },
    handleOut: { x:12, y:20 },
    kind: 'smooth',
    ...overrides,
  };
}

function createHarness({
  source = 'shape',
  zoom = 2,
  pointValue = point(),
  documentPointToLayer = value => ({ ...value }),
} = {}) {
  const node = pointValue;
  const subpath = { closed:true, operation:'add', points:[node] };
  const layer = {
    id:'layer-1',
    type:'shape',
    shape:'path',
    pathPoints: source === 'shape' ? [node] : [],
    vectorMask: source === 'vector-mask' ? { subpaths:[subpath] } : null,
    locked:false,
    groupId:null,
  };
  const savedPath = {
    id:2007,
    name:'Work Path',
    subpaths:[subpath],
  };
  const documentValue = {
    width:400,
    height:300,
    groups:[],
    layers: source === 'document-path' ? [] : [layer],
    paths: source === 'document-path' ? [savedPath] : [],
  };
  let activeDocument = documentValue;
  let zoomValue = zoom;
  const commits = [];
  let refreshes = 0;
  let redraws = 0;

  const controller = createPathControlGestureController({
    state: { getDocument: () => activeDocument },
    transaction: { commit: label => commits.push(label) },
    runtime: {
      getZoom: () => zoomValue,
      refreshPreview: () => { refreshes += 1; },
      redrawOverlay: () => { redraws += 1; },
    },
    geometry: { documentPointToLayer },
  });

  const target = {
    source,
    layer: source === 'document-path' ? null : layer,
    documentPathIndex: source === 'document-path' ? 0 : null,
    subpathIndex: source === 'shape' ? null : 0,
    nodeIndex:0,
    control:'anchor',
  };

  return {
    controller,
    documentValue,
    layer,
    savedPath,
    subpath,
    node,
    target,
    commits,
    refreshes: () => refreshes,
    redraws: () => redraws,
    setActiveDocument: value => { activeDocument = value; },
    setZoom: value => { zoomValue = value; },
  };
}

test('shape anchor live move translates both handles and commits exactly one anchor history entry', () => {
  const h = createHarness();
  const gesture = h.controller.begin(h.documentValue, h.target, {x:10,y:20});
  assert.ok(gesture);

  assert.equal(
    h.controller.update(gesture, {x:14,y:26}),
    PATH_CONTROL_GESTURE_RESULT.UPDATED,
  );
  assert.deepEqual(h.node, {
    x:14,
    y:26,
    handleIn:{x:12,y:26},
    handleOut:{x:16,y:26},
    kind:'smooth',
  });
  assert.deepEqual(h.commits, []);

  assert.equal(
    h.controller.finish(gesture, {x:14,y:26}),
    PATH_CONTROL_GESTURE_RESULT.COMMITTED,
  );
  assert.deepEqual(h.commits, ['Переместить Bézier-узел']);
});

test('shape handle drag mirrors the opposite handle and Alt keeps the captured opposite handle unchanged', () => {
  const smooth = createHarness();
  smooth.target.control = 'handleOut';
  const smoothGesture = smooth.controller.begin(smooth.documentValue, smooth.target, {x:12,y:20});
  assert.equal(
    smooth.controller.update(smoothGesture, {x:16,y:24}),
    PATH_CONTROL_GESTURE_RESULT.UPDATED,
  );
  assert.deepEqual(smooth.node.handleOut, {x:16,y:24});
  assert.deepEqual(smooth.node.handleIn, {x:4,y:16});
  assert.equal(smooth.node.kind, 'smooth');
  assert.equal(
    smooth.controller.finish(smoothGesture, {x:16,y:24}),
    PATH_CONTROL_GESTURE_RESULT.COMMITTED,
  );
  assert.deepEqual(smooth.commits, ['Изменить Bézier-ручку']);

  const corner = createHarness();
  corner.target.control = 'handleOut';
  const cornerGesture = corner.controller.begin(corner.documentValue, corner.target, {x:12,y:20});
  corner.controller.update(cornerGesture, {x:15,y:23});
  assert.deepEqual(corner.node.handleIn, {x:5,y:17});
  assert.equal(
    corner.controller.update(cornerGesture, {x:17,y:25}, {altKey:true}),
    PATH_CONTROL_GESTURE_RESULT.UPDATED,
  );
  assert.deepEqual(corner.node.handleOut, {x:17,y:25});
  assert.deepEqual(corner.node.handleIn, {x:5,y:17});
  assert.equal(corner.node.kind, 'corner');
});

test('Shift+anchor begin promotes the existing gesture to handleOut semantics', () => {
  const h = createHarness({pointValue:point({handleIn:null,handleOut:null,kind:'corner'})});
  const gesture = h.controller.begin(h.documentValue, h.target, {x:10,y:20}, {shiftKey:true});
  assert.equal(gesture.control, 'handleOut');

  h.controller.update(gesture, {x:15,y:20});
  assert.deepEqual(h.node.handleOut, {x:15,y:20});
  assert.deepEqual(h.node.handleIn, {x:5,y:20});
  assert.equal(h.node.kind, 'smooth');
  h.controller.finish(gesture, {x:15,y:20});
  assert.deepEqual(h.commits, ['Изменить Bézier-ручку']);
});

test('vector-mask gesture resolves the exact layer/subpath/node and preserves both history labels', () => {
  const anchor = createHarness({source:'vector-mask'});
  let gesture = anchor.controller.begin(anchor.documentValue, anchor.target, {x:10,y:20});
  anchor.controller.update(gesture, {x:13,y:24});
  anchor.controller.finish(gesture, {x:13,y:24});
  assert.deepEqual(anchor.commits, ['Переместить узел векторной маски']);

  const handle = createHarness({source:'vector-mask'});
  handle.target.control = 'handleIn';
  gesture = handle.controller.begin(handle.documentValue, handle.target, {x:8,y:20});
  handle.controller.update(gesture, {x:6,y:18});
  handle.controller.finish(gesture, {x:6,y:18});
  assert.deepEqual(handle.commits, ['Изменить ручку векторной маски']);
});

test('saved document path follows stable path identity across reorder and preserves both history labels', () => {
  const anchor = createHarness({source:'document-path'});
  const gesture = anchor.controller.begin(anchor.documentValue, anchor.target, {x:10,y:20});
  anchor.documentValue.paths.unshift({id:2008,name:'Other',subpaths:[]});
  anchor.controller.update(gesture, {x:14,y:20});
  anchor.controller.finish(gesture, {x:14,y:20});
  assert.deepEqual(anchor.commits, ['Переместить узел сохранённого контура']);

  const handle = createHarness({source:'document-path'});
  handle.target.control = 'handleOut';
  const handleGesture = handle.controller.begin(handle.documentValue, handle.target, {x:12,y:20});
  handle.controller.update(handleGesture, {x:18,y:21});
  handle.controller.finish(handleGesture, {x:18,y:21});
  assert.deepEqual(handle.commits, ['Изменить ручку сохранённого контура']);
});

test('zoom-dependent sub-threshold motion restores baseline geometry and publishes zero history', () => {
  const h = createHarness({zoom:2});
  const baseline = structuredClone(h.node);
  const gesture = h.controller.begin(h.documentValue, h.target, {x:10,y:20});

  assert.equal(
    h.controller.update(gesture, {x:10.4,y:20}),
    PATH_CONTROL_GESTURE_RESULT.NOOP,
  );
  assert.deepEqual(h.node, baseline);
  assert.equal(
    h.controller.finish(gesture, {x:10.4,y:20}),
    PATH_CONTROL_GESTURE_RESULT.NOOP,
  );
  assert.deepEqual(h.node, baseline);
  assert.deepEqual(h.commits, []);
});

test('returning to the captured baseline after a real preview is a semantic no-op', () => {
  const h = createHarness();
  const baseline = structuredClone(h.node);
  const gesture = h.controller.begin(h.documentValue, h.target, {x:10,y:20});
  h.controller.update(gesture, {x:16,y:26});
  assert.notDeepEqual(h.node, baseline);

  assert.equal(
    h.controller.update(gesture, {x:10,y:20}),
    PATH_CONTROL_GESTURE_RESULT.NOOP,
  );
  assert.deepEqual(h.node, baseline);
  assert.equal(
    h.controller.finish(gesture, {x:10,y:20}),
    PATH_CONTROL_GESTURE_RESULT.NOOP,
  );
  assert.deepEqual(h.commits, []);
});

test('pointer release geometry is applied even when no final pointermove was delivered', () => {
  const h = createHarness();
  const gesture = h.controller.begin(h.documentValue, h.target, {x:10,y:20});
  assert.equal(
    h.controller.finish(gesture, {x:20,y:30}),
    PATH_CONTROL_GESTURE_RESULT.COMMITTED,
  );
  assert.deepEqual([h.node.x,h.node.y], [20,30]);
  assert.deepEqual(h.commits, ['Переместить Bézier-узел']);
});

test('cancel restores the exact captured node object without history', () => {
  const h = createHarness();
  const baseline = structuredClone(h.node);
  const nodeIdentity = h.node;
  const gesture = h.controller.begin(h.documentValue, h.target, {x:10,y:20});
  h.controller.update(gesture, {x:18,y:28});

  assert.equal(h.controller.cancel(gesture), PATH_CONTROL_GESTURE_RESULT.CANCELED);
  assert.equal(h.layer.pathPoints[0], nodeIdentity);
  assert.deepEqual(h.node, baseline);
  assert.deepEqual(h.commits, []);
});

test('stale document rejects update, finish and cancel without redirecting writes', () => {
  for (const operation of ['update','finish','cancel']) {
    const h = createHarness();
    const gesture = h.controller.begin(h.documentValue, h.target, {x:10,y:20});
    const replacementNode = point({x:100,y:200});
    const replacementLayer = {...h.layer,pathPoints:[replacementNode]};
    h.setActiveDocument({...h.documentValue,layers:[replacementLayer]});

    const result = operation === 'cancel'
      ? h.controller.cancel(gesture)
      : h.controller[operation](gesture, {x:30,y:40});
    assert.equal(result, PATH_CONTROL_GESTURE_RESULT.REJECTED);
    assert.deepEqual([replacementNode.x,replacementNode.y], [100,200]);
    assert.deepEqual(h.commits, []);
  }
});

test('same-ID layer replacement and missing layer are rejected', () => {
  const replaced = createHarness();
  const gesture = replaced.controller.begin(replaced.documentValue, replaced.target, {x:10,y:20});
  const impostorNode = point();
  replaced.documentValue.layers[0] = {...replaced.layer,pathPoints:[impostorNode]};
  assert.equal(
    replaced.controller.update(gesture, {x:20,y:30}),
    PATH_CONTROL_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual([impostorNode.x,impostorNode.y], [10,20]);

  const missing = createHarness();
  const missingGesture = missing.controller.begin(missing.documentValue, missing.target, {x:10,y:20});
  missing.documentValue.layers.length = 0;
  assert.equal(
    missing.controller.finish(missingGesture, {x:20,y:30}),
    PATH_CONTROL_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual(missing.commits, []);
});

test('same-ID saved-path replacement plus replaced subpath/node identities are rejected', () => {
  const pathReplacement = createHarness({source:'document-path'});
  const pathGesture = pathReplacement.controller.begin(pathReplacement.documentValue, pathReplacement.target, {x:10,y:20});
  const impostorNode = point();
  pathReplacement.documentValue.paths[0] = {
    id:pathReplacement.savedPath.id,
    name:'Replacement',
    subpaths:[{points:[impostorNode]}],
  };
  assert.equal(
    pathReplacement.controller.update(pathGesture, {x:20,y:30}),
    PATH_CONTROL_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual([impostorNode.x,impostorNode.y], [10,20]);

  const subpathReplacement = createHarness({source:'document-path'});
  const subpathGesture = subpathReplacement.controller.begin(subpathReplacement.documentValue, subpathReplacement.target, {x:10,y:20});
  subpathReplacement.savedPath.subpaths[0] = {points:[subpathReplacement.node]};
  assert.equal(
    subpathReplacement.controller.update(subpathGesture, {x:20,y:30}),
    PATH_CONTROL_GESTURE_RESULT.REJECTED,
  );

  const nodeReplacement = createHarness({source:'document-path'});
  const nodeGesture = nodeReplacement.controller.begin(nodeReplacement.documentValue, nodeReplacement.target, {x:10,y:20});
  const nodeImpostor = point();
  nodeReplacement.subpath.points[0] = nodeImpostor;
  assert.equal(
    nodeReplacement.controller.update(nodeGesture, {x:20,y:30}),
    PATH_CONTROL_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual([nodeImpostor.x,nodeImpostor.y], [10,20]);
});

test('recursive layer lock acquired mid-gesture blocks further writes and history', () => {
  const h = createHarness();
  h.layer.groupId = 'group-1';
  h.documentValue.groups = [{id:'group-1',locked:false,parentGroupId:null}];
  const gesture = h.controller.begin(h.documentValue, h.target, {x:10,y:20});
  h.controller.update(gesture, {x:16,y:26});
  const preview = structuredClone(h.node);

  h.documentValue.groups[0].locked = true;
  assert.equal(
    h.controller.update(gesture, {x:30,y:40}),
    PATH_CONTROL_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual(h.node, preview);
  assert.equal(
    h.controller.finish(gesture, {x:30,y:40}),
    PATH_CONTROL_GESTURE_RESULT.REJECTED,
  );
  assert.deepEqual(h.commits, []);
});

test('composition root delegates update/finalize/cancel and no longer owns path-control mutation or rollback', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /createPathControlGestureController/);
  assert.match(main, /pathControlGestures\.begin\(doc,hit,point,\{shiftKey:event\.shiftKey\}\)/);
  assert.match(main, /pathControlGestures\.update\(drag,p,\{altKey:e\.altKey\}\)/);
  assert.match(main, /pathControlGestures\.finish\(d,canvasPoint\(e,\{clampToDocument:false\}\),\{altKey:e\.altKey\}\)/);
  assert.equal((main.match(/pathControlGestures\.cancel\(d\)/g) || []).length, 2);
  assert.doesNotMatch(main, /restorePathControlDrag/);
  assert.doesNotMatch(main, /if \(drag\.kind === 'path-control'\)/);
});
