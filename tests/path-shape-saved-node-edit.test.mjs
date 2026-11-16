import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathControlSurfaceController } from '../src/interaction/path-control-surface-controller.js';
import { PATH_CONTROL_COMMAND_RESULT as RESULT, createPathControlCommandController } from '../src/interaction/path-control-command-controller.js';

function nodes() {
  return [
    { x:0, y:0, handleIn:null, handleOut:{x:0,y:60}, kind:'corner' },
    { x:100, y:0, handleIn:{x:100,y:60}, handleOut:null, kind:'corner' },
    { x:100, y:100, handleIn:null, handleOut:null, kind:'corner' },
    { x:0, y:100, handleIn:null, handleOut:null, kind:'corner' },
  ];
}
function harness(source = 'shape', closed = true) {
  const points = nodes();
  const layer = {
    id:'shape-1', type:'shape', shape:'path', pathClosed:closed, pathPoints:points,
    x:10, y:20, locked:false, visible:true, groupId:'inner',
  };
  const subpath = { closed, operation:'add', points };
  const path = { id:2005, name:'Saved', subpaths:[subpath] };
  const owner = { layers:[layer], paths:source==='document-path' ? [path] : [],
    selectedLayerId:layer.id, groups:[
      {id:'inner',parentGroupId:'outer',locked:false,visible:true},
      {id:'outer',parentGroupId:null,locked:false,visible:true},
    ] };
  let active = owner, savedIndex = source === 'document-path' ? 0 : -1;
  const commits = [], statuses = [];
  const surface = createPathControlSurfaceController({
    state:{getDocument:()=>active,getDocumentPathEditIndex:()=>savedIndex,
      setDocumentPathEditIndex:index=>{savedIndex=index;},getVectorMaskEditLayerId:()=>null},
    runtime:{getCurrentTool:()=> 'pen',getZoom:()=>1,hasPenDraft:()=>false,
      hasActiveInteraction:()=>false,setCursor:()=>{}},
    geometry:{layerToDocument:p=>({x:p.x*2+10,y:p.y*2+20})},
  });
  const commands = createPathControlCommandController({
    state:{getDocument:()=>active},targets:{resolve:target=>surface.resolveTarget(target)},
    transaction:{commit:label=>commits.push(label)},ui:{setStatus:s=>statuses.push(s)},
  });
  const documentPoint = p => source === 'shape' ? {x:p.x*2+10,y:p.y*2+20} : p;
  return {source,owner,path,subpath,layer,points,surface,commands,commits,statuses,documentPoint,
    setActive:v=>{active=v;},setSavedIndex:v=>{savedIndex=v;}};
}
function bezier(p0,p1,p2,p3,t) {
  const q=1-t;
  return {x:q*q*q*p0.x+3*q*q*t*p1.x+3*q*t*t*p2.x+t*t*t*p3.x,
    y:q*q*q*p0.y+3*q*q*t*p1.y+3*q*t*t*p2.y+t*t*t*p3.y};
}
function segment(points,index) {
  const a=points[index], b=points[(index+1)%points.length];
  return t=>bezier(a,a.handleOut??a,b.handleIn??b,b,t);
}
function hitSegment(h,p) {return h.surface.hitSegment(h.documentPoint(p),2);}
function hitNode(h,p) {return h.surface.hit(h.documentPoint(p),2);}

for(const source of ['shape','document-path']) {
  test(source+' cubic Ctrl insert retains 101 samples and source-specific history',()=>{
    const h=harness(source);
    const reference=segment(h.points,0);
    const samples=Array.from({length:101},(_,i)=>reference(i/100));
    const hit=hitSegment(h,{x:50,y:45});
    assert.equal(hit?.segmentIndex,0);
    assert.equal(hit?.source,source);
    assert.ok(Math.abs(hit.t-0.5)<0.01);
    assert.equal(h.commands.insertPathNode(h.owner,hit),RESULT.COMMITTED);
    assert.equal(h.points.length,5);
    const left=segment(h.points,0),right=segment(h.points,1);
    for(let i=0;i<=100;i++){
      const t=i/100,local=t<=hit.t?t/hit.t:(t-hit.t)/(1-hit.t);
      const actual=t<=hit.t?left(local):right(local);
      assert.ok(Math.hypot(actual.x-samples[i].x,actual.y-samples[i].y)<1e-8,'sample '+i);
    }
    assert.equal(h.points[1].kind,'smooth');
    assert.deepEqual(h.commits,[source==='shape'?'Добавить Bézier-узел':'Добавить узел сохранённого контура']);
    const anchor=hitNode(h,h.points[1]);
    assert.equal(anchor?.control,'anchor');
    assert.equal(h.commands.deletePathNode(h.owner,anchor),RESULT.COMMITTED);
    assert.equal(h.points.length,4);
    assert.ok(h.points[0].handleOut && h.points[1].handleIn);
    assert.equal(h.commits.length,2);
  });

  test(source+' closing cubic splits and preserves closed geometry',()=>{
    const h=harness(source);
    h.points[3].handleOut={x:-30,y:75};
    h.points[0].handleIn={x:-30,y:25};
    const hit=hitSegment(h,{x:-22.5,y:50});
    assert.equal(hit?.segmentIndex,3);
    const previous=segment(h.points,3)(0.5);
    assert.equal(h.commands.insertPathNode(h.owner,hit),RESULT.COMMITTED);
    assert.ok(Math.hypot(
      previous.x-segment(h.points,3)(0.5/hit.t).x,
      previous.y-segment(h.points,3)(0.5/hit.t).y,
    )<1e-8);
  });

  test(source+' closed triangle cannot lose an anchor',()=>{
    const h=harness(source);
    h.points.pop();
    const anchor=hitNode(h,{x:0,y:0});
    assert.equal(h.commands.deletePathNode(h.owner,anchor),RESULT.NOOP);
    assert.equal(h.points.length,3);
    assert.deepEqual(h.commits,[]);
  });

  test(source+' open path does not hit closing edge, two-point minimum',()=>{
    const h=harness(source,false);
    h.points[0].handleOut=null;h.points[1].handleIn=null;
    const before=structuredClone(h.points);
    assert.equal(hitSegment(h,{x:0,y:50}),null);
    assert.equal(h.commands.insertPathNode(h.owner,{
      ...h.surface.hitSegment(h.documentPoint({x:50,y:0}),2),
      segmentIndex:3,fromNode:h.points[3],toNode:h.points[0],t:0.5,
    }),RESULT.REJECTED);
    assert.deepEqual(h.points,before);
    h.points.splice(2,2);
    assert.equal(h.commands.deletePathNode(h.owner,hitNode(h,{x:0,y:0})),RESULT.NOOP);
    assert.deepEqual(h.commits,[]);
  });
}

test('Saved Paths rejects stale document, edit selection, ID, owner, subpath and points',()=>{
  for(const cause of ['owner','selection','id','path','subpath','points','node']){
    const h=harness('document-path');
    const hit=hitSegment(h,{x:50,y:45});
    const before=structuredClone(h.points);
    if(cause==='owner')h.setActive({...h.owner});
    if(cause==='selection')h.setSavedIndex(-1);
    if(cause==='id')h.path.id=2990;
    if(cause==='path')h.owner.paths[0]={...h.path};
    if(cause==='subpath')h.path.subpaths[0]={...h.subpath};
    if(cause==='points')h.subpath.points=[...h.points];
    if(cause==='node')h.points[0]={...h.points[0]};
    assert.equal(h.commands.insertPathNode(h.owner,hit),RESULT.REJECTED,cause);
    assert.deepEqual(h.points,before,cause);
    assert.deepEqual(h.commits,[],cause);
  }
});

test('Shape refuses changed selection, recursive lock, replacement shape and old group',()=>{
  for(const cause of ['selection','parent-lock','shape','group','closed']){
    const h=harness('shape');
    const hit=hitSegment(h,{x:50,y:45});
    const before=structuredClone(h.points);
    if(cause==='selection')h.owner.selectedLayerId='other';
    if(cause==='parent-lock')h.owner.groups[1].locked=true;
    if(cause==='shape')h.layer.pathPoints=[...h.points];
    if(cause==='group')h.layer.groupId='outer';
    if(cause==='closed')h.layer.pathClosed=false;
    assert.equal(h.commands.insertPathNode(h.owner,hit),RESULT.REJECTED,cause);
    assert.deepEqual(h.points,before,cause);
    assert.deepEqual(h.commits,[],cause);
  }
});

test('Captured delete rejects replacement Saved Path node and does not alter history',()=>{
  const h=harness('document-path');
  const hit=hitNode(h,{x:0,y:0});
  h.points[0]={...h.points[0]};
  assert.equal(h.commands.deletePathNode(h.owner,hit),RESULT.REJECTED);
  assert.deepEqual(h.commits,[]);
});

test('Shape has 1000-node protection and invalid insertion parameters are inert',()=>{
  const h=harness();
  const hit=hitSegment(h,{x:50,y:45});
  assert.equal(h.commands.insertPathNode(h.owner,{...hit,t:0}),RESULT.REJECTED);
  while(h.points.length<1000)h.points.push({x:200,y:200});
  assert.equal(h.commands.insertPathNode(h.owner,hit),RESULT.REJECTED);
  assert.deepEqual(h.commits,[]);
});
