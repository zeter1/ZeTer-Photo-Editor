import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathControlSurfaceController } from '../src/interaction/path-control-surface-controller.js';
import { PATH_CONTROL_COMMAND_RESULT as RESULT, createPathControlCommandController } from '../src/interaction/path-control-command-controller.js';

function harness() {
  const nodes = [
    {x:0,y:0,handleOut:{x:0,y:60},handleIn:null,kind:'corner'},
    {x:100,y:0,handleIn:{x:100,y:60},handleOut:null,kind:'corner'},
    {x:100,y:100,handleIn:null,handleOut:null,kind:'corner'},
    {x:0,y:100,handleIn:null,handleOut:null,kind:'corner'},
  ];
  const mask={enabled:true,subpaths:[{operation:'add',closed:true,points:nodes}]};
  const layer={id:'adjustment-1',type:'adjustment',locked:false,visible:true,groupId:'group-a',vectorMask:mask};
  const owner={layers:[layer],groups:[
    {id:'group-a',parentGroupId:'group-b',locked:false,visible:true},
    {id:'group-b',parentGroupId:null,locked:false,visible:true},
  ],paths:[],selectedLayerId:layer.id};
  let live=owner;
  const commits=[];
  const surface=createPathControlSurfaceController({
    state:{getDocument:()=>live,getDocumentPathEditIndex:()=>-1,setDocumentPathEditIndex:()=>{},getVectorMaskEditLayerId:()=>layer.id},
    runtime:{getCurrentTool:()=> 'pen',getZoom:()=>1,hasPenDraft:()=>false,hasActiveInteraction:()=>false,setCursor:()=>{}},
    geometry:{layerToDocument:point=>({x:point.x,y:point.y})},
  });
  const commands=createPathControlCommandController({
    state:{getDocument:()=>live},
    targets:{resolve:target=>surface.resolveTarget(target)},
    transaction:{commit:label=>commits.push(label)},
    ui:{setStatus:()=>{}},
  });
  return {nodes,mask,layer,owner,surface,commands,commits,setDocument:value=>{live=value;}};
}
function bezier(p0,p1,p2,p3,t){
  const q=1-t;
  return {x:q*q*q*p0.x+3*q*q*t*p1.x+3*q*t*t*p2.x+t*t*t*p3.x,
    y:q*q*q*p0.y+3*q*q*t*p1.y+3*q*t*t*p2.y+t*t*t*p3.y};
}
function curve(points,index){
  const a=points[index],b=points[(index+1)%points.length];
  return t=>bezier(a,a.handleOut??a,b.handleIn??b,b,t);
}

test('cubic hit plus De Casteljau insertion preserve every sampled point on the curve',()=>{
  const h=harness();
  const original=curve(h.nodes,0);
  const samples=Array.from({length:101},(_,i)=>original(i/100));
  const hit=h.surface.hitSegment({x:50,y:45});
  assert.equal(hit?.segmentIndex,0);
  assert.ok(Math.abs(hit.t-0.5)<0.01);
  assert.equal(h.commands.insertMaskNode(h.owner,hit),RESULT.COMMITTED);
  assert.equal(h.nodes.length,5);
  const left=curve(h.nodes,0),right=curve(h.nodes,1);
  for(let i=0;i<=100;i++){
    const t=i/100,local=t<=hit.t?t/hit.t:(t-hit.t)/(1-hit.t);
    const actual=t<=hit.t?left(local):right(local);
    assert.ok(Math.hypot(actual.x-samples[i].x,actual.y-samples[i].y)<1e-8,'sample '+i);
  }
  assert.equal(h.commits.length,1);
  assert.equal(h.nodes[1].kind,'smooth');
});

test('anchor deletion preserves cubic handles and valid closed polygon',()=>{
  const h=harness();
  assert.equal(h.commands.insertMaskNode(h.owner,h.surface.hitSegment({x:50,y:45})),RESULT.COMMITTED);
  const hit=h.surface.hit({x:h.nodes[1].x,y:h.nodes[1].y},2);
  assert.equal(hit?.control,'anchor');
  assert.equal(h.commands.deleteMaskNode(h.owner,hit),RESULT.COMMITTED);
  assert.equal(h.nodes.length,4);
  assert.ok(h.nodes[0].handleOut && h.nodes[1].handleIn);
  assert.equal(h.commits.length,2);
});

test('inherited group lock refuses both actions without mutation or history',()=>{
  const h=harness();
  const insert=h.surface.hitSegment({x:50,y:45});
  const remove=h.surface.hit({x:0,y:0},3);
  const before=structuredClone(h.nodes);
  h.owner.groups[1].locked=true;
  assert.equal(h.commands.insertMaskNode(h.owner,insert),RESULT.REJECTED);
  assert.equal(h.commands.deleteMaskNode(h.owner,remove),RESULT.REJECTED);
  assert.deepEqual(h.nodes,before);
  assert.deepEqual(h.commits,[]);
});

test('stale document, changed selection, replacement mask refuse old hit',()=>{
  for(const reason of ['document','selection','mask']){
    const h=harness();
    const target=h.surface.hitSegment({x:50,y:45});
    const before=structuredClone(h.nodes);
    if(reason==='document')h.setDocument({...h.owner});
    if(reason==='selection')h.owner.selectedLayerId='other';
    if(reason==='mask')h.layer.vectorMask={...h.mask,subpaths:[...h.mask.subpaths]};
    assert.equal(h.commands.insertMaskNode(h.owner,target),RESULT.REJECTED,reason);
    assert.deepEqual(h.nodes,before,reason);
    assert.deepEqual(h.commits,[],reason);
  }
});

test('three-point closed polygon may not lose an anchor',()=>{
  const h=harness();
  h.nodes.pop();
  const hit=h.surface.hit({x:0,y:0},2);
  assert.equal(h.commands.deleteMaskNode(h.owner,hit),RESULT.NOOP);
  assert.equal(h.nodes.length,3);
  assert.equal(h.commits.length,0);
});

test('closing cubic segment insert retains closed geometry and exact split',()=>{
  const h=harness();
  h.nodes[3].handleOut={x:-30,y:75};
  h.nodes[0].handleIn={x:-30,y:25};
  const hit=h.surface.hitSegment({x:-22.5,y:50});
  assert.equal(hit?.segmentIndex,3);
  const original=curve(h.nodes,3)(0.5);
  assert.equal(h.commands.insertMaskNode(h.owner,hit),RESULT.COMMITTED);
  const split=curve(h.nodes,3)(0.5/hit.t);
  assert.ok(Math.hypot(original.x-split.x,original.y-split.y)<1e-8);
  assert.equal(h.mask.subpaths[0].closed,true);
});

test('captured delete refuses a replacement node, group change or replaced subpath',()=>{
  for(const reason of ['node','group','subpath']){
    const h=harness();
    const target=h.surface.hit({x:0,y:0},3);
    const before=structuredClone(h.nodes);
    if(reason==='node')h.nodes[0]={...h.nodes[0]};
    if(reason==='group')h.layer.groupId='group-b';
    if(reason==='subpath')h.mask.subpaths[0]={...h.mask.subpaths[0],points:h.nodes};
    assert.equal(h.commands.deleteMaskNode(h.owner,target),RESULT.REJECTED,reason);
    assert.deepEqual(h.nodes,before,reason);
    assert.deepEqual(h.commits,[],reason);
  }
});

test('captured insert refuses changed group and replaced subpath without history',()=>{
  for(const reason of ['group','subpath']){
    const h=harness();
    const target=h.surface.hitSegment({x:50,y:45});
    const before=structuredClone(h.nodes);
    if(reason==='group')h.layer.groupId='group-b';
    if(reason==='subpath')h.mask.subpaths[0]={...h.mask.subpaths[0],points:h.nodes};
    assert.equal(h.commands.insertMaskNode(h.owner,target),RESULT.REJECTED,reason);
    assert.deepEqual(h.nodes,before,reason);
    assert.deepEqual(h.commits,[],reason);
  }
});
