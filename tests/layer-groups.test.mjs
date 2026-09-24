import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createDocument, createShapeLayer, createLayerGroup, addLayer, addLayerGroup,
  removeLayerGroup, moveLayerIntoGroup, moveLayer, duplicateLayer, removeLayer, sanitizeProject,
  isLayerVisible, isLayerLocked,
} from '../src/core/state.js';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('layers can be moved into a group and duplicated without losing membership',()=>{
  const doc=createDocument();
  const a=addLayer(doc,createShapeLayer({name:'a'}));
  const b=addLayer(doc,createShapeLayer({name:'b'}));
  const group=addLayerGroup(doc,createLayerGroup({name:'Group'}));
  assert.equal(moveLayerIntoGroup(doc,a.id,group.id),true);
  assert.equal(a.groupId,group.id);
  const copy=duplicateLayer(doc,a.id);
  assert.equal(copy.groupId,group.id);
  assert.equal(b.groupId,null);
});

test('removing a group keeps its layers and only clears membership',()=>{
  const doc=createDocument();
  const layer=addLayer(doc,createShapeLayer({name:'kept'}));
  const group=addLayerGroup(doc,createLayerGroup());
  moveLayerIntoGroup(doc,layer.id,group.id);
  assert.ok(removeLayerGroup(doc,group.id));
  assert.equal(doc.layers.length,1);
  assert.equal(doc.layers[0].name,'kept');
  assert.equal(doc.layers[0].groupId,null);
  assert.equal(doc.groups.length,0);
});

test('layer ordering treats a grouped block as one top-level block for ungrouped layers',()=>{
  const doc=createDocument();
  const low=addLayer(doc,createShapeLayer({name:'low'}));
  const g1=addLayer(doc,createShapeLayer({name:'g1'}));
  const g2=addLayer(doc,createShapeLayer({name:'g2'}));
  const high=addLayer(doc,createShapeLayer({name:'high'}));
  const group=addLayerGroup(doc,createLayerGroup());
  moveLayerIntoGroup(doc,g1.id,group.id);
  moveLayerIntoGroup(doc,g2.id,group.id);
  // Normalize to low, group members, high.
  doc.layers=[low,g1,g2,high];
  assert.equal(moveLayer(doc,low.id,1),true);
  assert.deepEqual(doc.layers.map(l=>l.name),['g1','g2','low','high']);
  assert.equal(moveLayer(doc,high.id,-1),true);
  assert.deepEqual(doc.layers.map(l=>l.name),['g1','g2','high','low']);
});

test('project sanitizer preserves valid groups and drops orphaned group references',()=>{
  const safe=sanitizeProject({
    version:1,name:'x',width:640,height:480,background:'transparent',
    groups:[{id:'group-a',name:'Photos',collapsed:true}],
    layers:[
      {id:'one',type:'shape',name:'one',groupId:'group-a'},
      {id:'two',type:'shape',name:'two',groupId:'missing'},
    ],
    selectedLayerId:'one',
  });
  assert.equal(safe.groups.length,1);
  assert.equal(safe.groups[0].name,'Photos');
  assert.equal(safe.groups[0].collapsed,true);
  assert.equal(safe.groups[0].visible,true);
  assert.equal(safe.groups[0].locked,false);
  assert.equal(safe.layers[0].groupId,'group-a');
  assert.equal(safe.layers[1].groupId,null);
});


test('group visibility and locking are inherited by member layers',()=>{
  const doc=createDocument();
  const layer=addLayer(doc,createShapeLayer({name:'member',visible:true,locked:false}));
  const group=addLayerGroup(doc,createLayerGroup({name:'Protected'}));
  assert.equal(moveLayerIntoGroup(doc,layer.id,group.id),true);
  assert.equal(isLayerVisible(doc,layer),true);
  assert.equal(isLayerLocked(doc,layer),false);

  group.visible=false;
  assert.equal(isLayerVisible(doc,layer),false);
  layer.visible=false;
  group.visible=true;
  assert.equal(isLayerVisible(doc,layer),false);

  layer.visible=true;
  group.locked=true;
  assert.equal(isLayerLocked(doc,layer),true);
  assert.equal(moveLayer(doc,layer.id,1),false);
  assert.equal(moveLayerIntoGroup(doc,layer.id,null),false);
  assert.equal(duplicateLayer(doc,layer.id),null);
  assert.equal(removeLayer(doc,layer.id),null);
  assert.equal(doc.layers.length,1);
  assert.equal(removeLayerGroup(doc,group.id),null);
});

test('locked layers cannot be removed through the state API',()=>{
  const doc=createDocument();
  const layer=addLayer(doc,createShapeLayer({name:'locked',locked:true}));
  assert.equal(removeLayer(doc,layer.id),null);
  assert.equal(doc.layers.length,1);
});

test('project sanitizer preserves group visibility and lock state',()=>{
  const safe=sanitizeProject({
    version:1,name:'x',width:640,height:480,background:'transparent',
    groups:[{id:'group-a',name:'Hidden locked group',visible:false,locked:true,collapsed:false}],
    layers:[{id:'one',type:'shape',name:'one',groupId:'group-a',visible:true,locked:false}],
    selectedLayerId:'one',
  });
  assert.equal(safe.groups[0].visible,false);
  assert.equal(safe.groups[0].locked,true);
  assert.equal(isLayerVisible(safe,safe.layers[0]),false);
  assert.equal(isLayerLocked(safe,safe.layers[0]),true);
});

test('layer panel exposes rename and group controls with drag-to-group wiring',()=>{
  assert.match(html,/id="addGroupBtn"/);
  assert.match(html,/id="renameLayerBtn"/);
  assert.match(main,/function addGroup\(\)/);
  assert.match(main,/moveLayerIntoGroup\(doc, draggedId, group\.id\)/);
  assert.match(main,/function renameGroup\(group\)/);
  assert.match(main,/group\.visible = group\.visible === false/);
  assert.match(main,/group\.locked = !group\.locked/);
  assert.match(main,/isLayerLocked\(doc, layer\)/);
  assert.match(main,/if\(isLayerLocked\(doc,l\)\)\{setStatus\('Слой или его группа заблокированы'\);return;\}if\(duplicateLayer\(doc,l\.id\)\)commit\('Дублировать слой'\)/);
  assert.match(main,/\['Дублировать слой','Ctrl\+J',duplicateSelected,\(\)=>Boolean\(selected\(\)\)&&!isLayerLocked\(doc,selected\(\)\)\]/);
  assert.match(main,/\['Удалить слой','Delete',deleteSelected,\(\)=>Boolean\(selected\(\)\)&&!isLayerLocked\(doc,selected\(\)\)\]/);
  assert.ok(main.includes("const editable = Boolean(layer) && !isLayerLocked(doc, layer);"));
  assert.ok(main.includes("els.blend.disabled = !editable; els.layerOpacity.disabled = !editable;"));
  assert.ok(main.includes("['renameLayerBtn','duplicateLayerBtn','deleteLayerBtn','layerUpBtn','layerDownBtn','resetColorEffectsBtn']"));
  assert.ok(main.includes("['Переименовать слой','F2',()=>{const layer=selected();if(layer)renameLayer(layer);},()=>Boolean(selected())&&!isLayerLocked(doc,selected())]"));
  assert.ok(main.includes("['Заблокировать / разблокировать','',toggleSelectedLock,()=>{const layer=selected();return Boolean(layer)&&!doc.groups?.find(group=>group.id===layer.groupId)?.locked;}]"));
  assert.ok(main.includes("['Поднять слой','',()=>{if(moveLayer(doc,doc.selectedLayerId,1))commit('Поднять слой');},()=>Boolean(selected())&&!isLayerLocked(doc,selected())]"));
  assert.ok(main.includes("['Опустить слой','',()=>{if(moveLayer(doc,doc.selectedLayerId,-1))commit('Опустить слой');},()=>Boolean(selected())&&!isLayerLocked(doc,selected())]"));
  assert.match(main,/Переименовать слой/);
  assert.match(css,/\.layer-group-row\.drop-into/);
  assert.match(css,/\.layer-row\.in-group/);
  assert.match(css,/\.layer-group-row \{ grid-template-columns:/);
});