import test from 'node:test';
import assert from 'node:assert/strict';
import { addLayer, addLayerGroup, createDocument, createLayerGroup, createShapeLayer } from '../src/core/state.js';
import { createLayersPanelController } from '../src/ui/layers-panel-controller.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  set(value) { this.values = new Set(String(value || '').split(/\s+/).filter(Boolean)); }
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.values.has(name) : Boolean(force);
    if (next) this.values.add(name); else this.values.delete(name);
    return next;
  }
  toString() { return [...this.values].join(' '); }
}
class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase(); this.children=[]; this.dataset={}; this.attributes=new Map();
    this.listeners=new Map(); this.classList=new FakeClassList(); this.style={values:new Map(),setProperty:(key,value)=>this.style.values.set(key,String(value))};
    this.textContent=''; this.title=''; this.tabIndex=-1; this.disabled=false; this.draggable=false; this.rect={top:0,height:20}; this.focused=false;
  }
  set className(value){this.classList.set(value);} get className(){return this.classList.toString();}
  setAttribute(name,value){this.attributes.set(name,String(value));} getAttribute(name){return this.attributes.get(name)??null;}
  append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(handler);}
  removeEventListener(type,handler){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==handler));}
  emit(type,overrides={}){const event={target:this,currentTarget:this,clientY:0,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...overrides};for(const handler of [...(this.listeners.get(type)||[])])handler(event);return event;}
  querySelectorAll(selector){const wanted=new Set(selector.split(',').map(item=>item.trim().replace(/^\./,'')));const matches=[];const visit=node=>{for(const child of node.children){if([...wanted].some(name=>child.classList.contains(name)))matches.push(child);visit(child);}};visit(this);return matches;}
  getBoundingClientRect(){return this.rect;} focus(){this.focused=true;}
}
class FakeDocument { createElement(tagName){return new FakeElement(tagName);} }
function childWithClass(row,className){return row.children.find(child=>child.classList.contains(className))??null;}
function click(element){element.onclick?.({stopPropagation(){},preventDefault(){}});}
function createHarness(initialDocument){
  let activeDocument=initialDocument;const container=new FakeElement('div');const calls=[];const statuses=[];const frames=[];let controller;
  const record=name=>(owner,...args)=>{if(owner!==activeDocument)return false;calls.push([name,...args]);return true;};
  controller=createLayersPanelController({
    container,
    state:{getDocument:()=>activeDocument,selectLayer:(owner,layerId,{refresh=true}={})=>{if(owner!==activeDocument||!owner.layers.some(layer=>layer.id===layerId))return false;owner.selectedLayerId=layerId;calls.push(['select',layerId,refresh]);if(refresh)controller.render();return true;}},
    actions:{
      layer:{toggleVisibility:record('layer-visible'),toggleLock:record('layer-lock'),rename:record('layer-rename'),remove:record('layer-remove'),openSmartObject:record('smart-object'),openContextMenu:record('layer-menu')},
      group:{toggleVisibility:record('group-visible'),toggleLock:record('group-lock'),rename:record('group-rename'),remove:record('group-remove'),openContextMenu:record('group-menu')},
      drag:{moveLayerRelative:record('move-layer-relative'),moveLayerIntoGroup:record('move-layer-into-group'),moveGroupIntoGroup:record('move-group-into-group'),moveLayerToRoot:record('move-layer-root'),moveGroupToRoot:record('move-group-root')},
    },
    ui:{documentRef:new FakeDocument(),requestFrame:callback=>frames.push(callback),setStatus:value=>statuses.push(value)},
  });
  return {controller,container,calls,statuses,frames,setActiveDocument:value=>{activeDocument=value;}};
}
function makeGroupedDocument(){
  const doc=createDocument({name:'layers-test',width:64,height:64});const low=addLayer(doc,createShapeLayer({name:'Low'}));const nested=addLayer(doc,createShapeLayer({name:'Nested'}));const high=addLayer(doc,createShapeLayer({name:'High'}));
  const root=addLayerGroup(doc,createLayerGroup({name:'Root'}));const child=addLayerGroup(doc,createLayerGroup({name:'Child',parentGroupId:root.id}));nested.groupId=child.id;doc.layers=[low,nested,high];doc.selectedLayerId=high.id;return{doc,low,nested,high,root,child};
}
test('renders root display order, nested depth and collapse without changing membership',()=>{
  const{doc,low,nested,high,root,child}=makeGroupedDocument();const h=createHarness(doc);h.controller.render();
  assert.deepEqual(h.container.children.map(row=>row.dataset.id||'group:'+row.dataset.groupId),[high.id,'group:'+root.id,'group:'+child.id,nested.id,low.id]);
  assert.equal(h.controller.getGroupRow(root.id).style.values.get('--group-depth'),'0');assert.equal(h.controller.getGroupRow(child.id).style.values.get('--group-depth'),'1');assert.equal(h.controller.getLayerRow(nested.id).style.values.get('--layer-depth'),'2');
  root.collapsed=true;h.controller.render();assert.equal(h.controller.getGroupRow(child.id),null);assert.equal(h.controller.getLayerRow(nested.id),null);assert.equal(nested.groupId,child.id);
});
test('effective ancestor visibility/locking reaches nested rows and selected ARIA contract',()=>{
  const{doc,nested,high,root}=makeGroupedDocument();root.visible=false;root.locked=true;const h=createHarness(doc);h.controller.render();
  const nestedRow=h.controller.getLayerRow(nested.id);assert.equal(nestedRow.classList.contains('group-hidden'),true);assert.equal(nestedRow.classList.contains('group-locked'),true);assert.equal(nestedRow.draggable,false);
  const selected=h.controller.getLayerRow(high.id);assert.equal(selected.classList.contains('selected'),true);assert.equal(selected.getAttribute('aria-selected'),'true');assert.equal(selected.tabIndex,0);
});
test('layer/group buttons delegate semantic changes instead of owning history policy',()=>{
  const{doc,high,root}=makeGroupedDocument();const h=createHarness(doc);h.controller.render();const layerRow=h.controller.getLayerRow(high.id);click(childWithClass(layerRow,'layer-eye'));click(childWithClass(layerRow,'layer-lock'));
  const groupRow=h.controller.getGroupRow(root.id);click(childWithClass(groupRow,'layer-group-eye'));click(childWithClass(groupRow,'layer-group-lock'));click(childWithClass(groupRow,'layer-group-remove'));
  assert.deepEqual(h.calls.map(call=>call[0]),['layer-visible','layer-lock','group-visible','group-lock','group-remove']);
});
test('row selection, Smart Object delegation and stale rendered callbacks are exact-document guarded',()=>{
  const first=createDocument({width:32,height:32});const smart=addLayer(first,{...createShapeLayer({name:'Smart'}),type:'smart-object',previewDataUrl:'data:image/png;base64,AA=='});first.selectedLayerId=null;
  const second=createDocument({width:32,height:32});const h=createHarness(first);h.controller.render();const oldRow=h.controller.getLayerRow(smart.id);const oldThumb=childWithClass(oldRow,'layer-thumb');
  h.setActiveDocument(second);oldRow.onclick();oldThumb.ondblclick({stopPropagation(){}});assert.deepEqual(h.calls,[]);
  h.setActiveDocument(first);oldRow.onclick();childWithClass(h.controller.getLayerRow(smart.id),'layer-thumb').ondblclick({stopPropagation(){}});assert.deepEqual(h.calls.map(call=>call[0]),['select','smart-object']);
});
test('panel keyboard navigation keeps exact row actions and restores focus after refresh',()=>{
  const{doc,low,high}=makeGroupedDocument();const h=createHarness(doc);h.controller.render();h.controller.getLayerRow(high.id).emit('keydown',{key:'End',code:'End'});assert.equal(doc.selectedLayerId,low.id);assert.equal(h.frames.length,1);h.frames.shift()();assert.equal(h.controller.getLayerRow(low.id).focused,true);
  h.controller.getLayerRow(low.id).emit('keydown',{key:'ArrowUp',code:'ArrowUp'});assert.notEqual(doc.selectedLayerId,low.id);h.frames.shift()?.();const current=h.controller.getLayerRow(doc.selectedLayerId);current.emit('keydown',{key:'Enter',code:'Enter'});current.emit('keydown',{key:'F2',code:'F2'});current.emit('keydown',{key:'Delete',code:'Delete'});
  assert.equal(h.calls.filter(call=>call[0]==='layer-rename').length,2);assert.equal(h.calls.filter(call=>call[0]==='layer-remove').length,1);
});
test('layer midpoint drag delegates before/after reorder and always clears local drag state/decorations',()=>{
  const doc=createDocument({width:32,height:32});const a=addLayer(doc,createShapeLayer({name:'A'}));const b=addLayer(doc,createShapeLayer({name:'B'}));doc.selectedLayerId=b.id;const h=createHarness(doc);h.controller.render();
  const source=h.controller.getLayerRow(a.id);const target=h.controller.getLayerRow(b.id);target.rect={top:100,height:20};source.emit('dragstart',{dataTransfer:{effectAllowed:'',setData(){}}});target.emit('dragover',{clientY:101,dataTransfer:{dropEffect:''}});assert.equal(target.classList.contains('drop-before'),true);target.emit('drop',{clientY:101,dataTransfer:{dropEffect:''}});
  const move=h.calls.find(call=>call[0]==='move-layer-relative');assert.deepEqual(move.slice(1),[a.id,b.id,true]);assert.equal(source.classList.contains('dragging'),false);assert.equal(target.classList.contains('drop-before'),false);
});
test('locked target rejects relative drop without publishing a move',()=>{
  const doc=createDocument({width:32,height:32});const source=addLayer(doc,createShapeLayer({name:'Source'}));const target=addLayer(doc,createShapeLayer({name:'Locked',locked:true}));const h=createHarness(doc);h.controller.render();
  h.controller.getLayerRow(source.id).emit('dragstart',{dataTransfer:{setData(){}}});h.controller.getLayerRow(target.id).emit('drop',{clientY:0});assert.equal(h.calls.some(call=>call[0]==='move-layer-relative'),false);
});
test('layer/group drops into groups and root route through one local drag lifecycle',()=>{
  const{doc,low,root,child}=makeGroupedDocument();const h=createHarness(doc);h.controller.bind();h.controller.render();
  h.controller.getLayerRow(low.id).emit('dragstart',{dataTransfer:{setData(){}}});h.controller.getGroupRow(child.id).emit('drop',{});assert.ok(h.calls.some(call=>call[0]==='move-layer-into-group'&&call[1]===low.id&&call[2]===child.id));
  h.controller.render();h.controller.getGroupRow(child.id).emit('dragstart',{dataTransfer:{setData(){}}});h.controller.getGroupRow(root.id).emit('drop',{});assert.ok(h.calls.some(call=>call[0]==='move-group-into-group'&&call[1]===child.id&&call[2]===root.id));
  h.controller.render();h.controller.getLayerRow(low.id).emit('dragstart',{dataTransfer:{setData(){}}});h.container.emit('dragover',{target:h.container,dataTransfer:{dropEffect:''}});assert.equal(h.container.classList.contains('drop-root'),true);h.container.emit('drop',{target:h.container});assert.ok(h.calls.some(call=>call[0]==='move-layer-root'&&call[1]===low.id));assert.equal(h.container.classList.contains('drop-root'),false);
});
test('root listeners are idempotent/removable and stale-document drag cannot mutate the new tab',()=>{
  const{doc,low}=makeGroupedDocument();const other=createDocument({width:32,height:32});const h=createHarness(doc);assert.equal(h.controller.bind(),true);assert.equal(h.controller.bind(),false);h.controller.render();h.controller.getLayerRow(low.id).emit('dragstart',{dataTransfer:{setData(){}}});h.setActiveDocument(other);h.container.emit('drop',{target:h.container});assert.equal(h.calls.some(call=>call[0]==='move-layer-root'),false);
  assert.equal(h.controller.destroy(),true);assert.equal(h.controller.destroy(),false);const count=h.calls.length;h.container.emit('drop',{target:h.container});assert.equal(h.calls.length,count);
});
