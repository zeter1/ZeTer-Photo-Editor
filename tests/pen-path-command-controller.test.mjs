import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PEN_PATH_COMMAND_RESULT,
  PEN_PATH_NOOP_REASON,
  createPenPathCommandController,
} from '../src/interaction/pen-path-command-controller.js';

function createOwner() {
  return { layers:[], selectedLayerId:null, updatedAt:'' };
}
function harness(getDocument = null) {
  const owner=createOwner();
  const commits=[];
  return {
    owner,
    commits,
    controller:createPenPathCommandController({
      state:{ getDocument:getDocument ?? (() => owner) },
      transaction:{ commit:label => commits.push(label) },
    }),
  };
}

test('Pen path publication validates required bridges', () => {
  assert.throws(() => createPenPathCommandController(), /state bridge is required/);
  assert.throws(
    () => createPenPathCommandController({state:{getDocument:()=>null}}),
    /transaction bridge is required/,
  );
});

test('too-short, degenerate and invalid finalized drafts publish no layer or history', () => {
  const {owner, commits, controller}=harness();
  assert.deepEqual(
    controller.publish(owner,[{x:10,y:20}]),
    {result:PEN_PATH_COMMAND_RESULT.NOOP,reason:PEN_PATH_NOOP_REASON.TOO_SHORT},
  );
  assert.deepEqual(
    controller.publish(owner,[
      {x:10,y:10,handleIn:null,handleOut:null,kind:'corner'},
      {x:10.5,y:10.5,handleIn:null,handleOut:null,kind:'corner'},
    ]),
    {result:PEN_PATH_COMMAND_RESULT.NOOP,reason:PEN_PATH_NOOP_REASON.DEGENERATE},
  );
  assert.deepEqual(
    controller.publish(owner,[
      {x:10,y:10,handleIn:null,handleOut:null,kind:'corner'},
      {x:30,y:30,handleIn:{x:Number.NaN,y:20},handleOut:null,kind:'corner'},
    ]),
    {result:PEN_PATH_COMMAND_RESULT.NOOP,reason:PEN_PATH_NOOP_REASON.INVALID_POINT},
  );
  assert.equal(owner.layers.length,0);
  assert.deepEqual(commits,[]);
});

test('publication includes handle bounds, localizes nodes and maps style exactly once', () => {
  const {owner, commits, controller}=harness();
  const points=[
    {x:10,y:20,handleIn:{x:5,y:15},handleOut:{x:15,y:25},kind:'smooth'},
    {x:30,y:40,handleIn:{x:25,y:35},handleOut:{x:35,y:45},kind:'unexpected'},
  ];
  const original=structuredClone(points);
  const outcome=controller.publish(owner,points,{
    pathClosed:true,stroke:'#123456',strokeWidth:'0.25',opacity:0.37,
  });
  assert.equal(outcome.result,PEN_PATH_COMMAND_RESULT.COMMITTED);
  assert.equal(owner.layers.length,1);
  assert.equal(owner.selectedLayerId,owner.layers[0].id);
  assert.deepEqual(commits,['Добавить Bézier-контур']);
  assert.deepEqual(points,original);
  const layer=owner.layers[0];
  assert.equal(layer.name,'Контур');
  assert.equal(layer.type,'shape');
  assert.equal(layer.shape,'path');
  assert.deepEqual(
    {x:layer.x,y:layer.y,width:layer.width,height:layer.height},
    {x:5,y:15,width:30,height:30},
  );
  assert.equal(layer.pathClosed,true);
  assert.equal(layer.fill,'transparent');
  assert.equal(layer.stroke,'#123456');
  assert.equal(layer.strokeWidth,1);
  assert.equal(layer.opacity,0.37);
  assert.deepEqual(layer.pathPoints,[
    {x:5,y:5,handleIn:{x:0,y:0},handleOut:{x:10,y:10},kind:'smooth'},
    {x:25,y:25,handleIn:{x:20,y:20},handleOut:{x:30,y:30},kind:'corner'},
  ]);
});

test('open path preserves a non-clamped stroke width', () => {
  const {owner, commits, controller}=harness();
  const outcome=controller.publish(owner,[
    {x:1,y:2,handleIn:null,handleOut:null,kind:'corner'},
    {x:11,y:12,handleIn:null,handleOut:null,kind:'corner'},
  ],{pathClosed:false,stroke:'#abcdef',strokeWidth:'7',opacity:1});
  assert.equal(outcome.result,PEN_PATH_COMMAND_RESULT.COMMITTED);
  assert.equal(owner.layers[0].pathClosed,false);
  assert.equal(owner.layers[0].strokeWidth,7);
  assert.deepEqual(commits,['Добавить Bézier-контур']);
});

test('stale owner and pre-write owner replacement are rejected atomically', () => {
  const points=[
    {x:0,y:0,handleIn:null,handleOut:null,kind:'corner'},
    {x:10,y:10,handleIn:null,handleOut:null,kind:'corner'},
  ];
  const stale=createOwner(), active=createOwner(), staleCommits=[];
  const staleController=createPenPathCommandController({
    state:{getDocument:()=>active},
    transaction:{commit:label=>staleCommits.push(label)},
  });
  assert.deepEqual(staleController.publish(stale,points),{result:PEN_PATH_COMMAND_RESULT.REJECTED});
  assert.equal(stale.layers.length,0);
  assert.deepEqual(staleCommits,[]);

  const owner=createOwner(), replacement=createOwner(), commits=[];
  let reads=0;
  const controller=createPenPathCommandController({
    state:{getDocument:()=>++reads===1?owner:replacement},
    transaction:{commit:label=>commits.push(label)},
  });
  assert.deepEqual(controller.publish(owner,points),{result:PEN_PATH_COMMAND_RESULT.REJECTED});
  assert.equal(owner.layers.length,0);
  assert.equal(replacement.layers.length,0);
  assert.deepEqual(commits,[]);
});
