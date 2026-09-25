import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createDocument } from '../src/core/state.js';
import { createDocumentSessionController } from '../src/workspace/session-controller.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const layerMenuFunction = main.slice(main.indexOf('function layerContextMenu(id) {'), main.indexOf('function groupContextMenu(id) {'));

test('renaming an inactive tab updates only its document and recovery history', () => {
  const active = { id:'active', doc:createDocument({name:'Активная'}), history:{push(){}}, dirty:false, zoom:.75 };
  const background = { id:'background', doc:createDocument({name:'Фоновая'}), history:{push(...args){this.last=args;}}, dirty:false, zoom:.75 };
  const sessions=[active,background];
  let activeSessionId='active', dialog, recoveryCalls=0;
  const controller=createDocumentSessionController({
    getSessions:()=>sessions,
    getActiveSessionId:()=>activeSessionId,
    setActiveSessionId:value=>{activeSessionId=value;},
    getRuntimeState:()=>({doc:active.doc,history:active.history,zoom:active.zoom,dirty:active.dirty,cropRect:null,selectionRect:null,selectionShape:null,selectedDocumentPathIndex:-1}),
    applyRuntimeState:()=>{},
    cloneSelectionShape:shape=>shape?structuredClone(shape):null,
    blockPendingDocumentEdit:()=>false,
    showModal:options=>{dialog=options;},
    queueRecovery:()=>{recoveryCalls++;},
    setStatus:()=>{},
    commit:()=>{throw new Error('Active document was changed');},
  });
  controller.renameDocumentTab('background');
  dialog.onSubmit({name:'Новое имя'});
  assert.equal(active.doc.name,'Активная');
  assert.equal(background.doc.name,'Новое имя');
  assert.equal(background.dirty,true);
  assert.equal(background.history.last[0],'Переименовать вкладку');
  assert.equal(JSON.parse(background.history.last[1]).name,'Новое имя');
  assert.equal(recoveryCalls,1);
});

test('duplicating a background tab keeps the active document and makes a recoverable copy', () => {
  const active = { id:'active', doc:createDocument({name:'Активная'}), history:{}, dirty:false, zoom:.8 };
  const background = { id:'background', doc:createDocument({name:'Фоновая'}), history:{}, dirty:false, zoom:1.5 };
  const sessions=[active,background];
  let activeSessionId='active', recoveryCalls=0;
  const controller=createDocumentSessionController({
    getSessions:()=>sessions,
    getActiveSessionId:()=>activeSessionId,
    setActiveSessionId:value=>{activeSessionId=value;},
    getRuntimeState:()=>({doc:active.doc,history:active.history,zoom:active.zoom,dirty:active.dirty,cropRect:null,selectionRect:null,selectionShape:null,selectedDocumentPathIndex:-1}),
    applyRuntimeState:()=>{},
    cloneSelectionShape:shape=>shape?structuredClone(shape):null,
    blockPendingDocumentEdit:()=>false,
    queueRecovery:()=>{recoveryCalls++;},
    setStatus:()=>{},
  });
  controller.duplicateDocumentTab('background');
  assert.equal(activeSessionId,'active');
  assert.equal(sessions[2].doc.name,'Фоновая — копия');
  assert.notEqual(sessions[2].doc,background.doc);
  assert.equal(sessions[2].dirty,true);
  assert.equal(sessions[2].zoom,1.5);
  assert.equal(recoveryCalls,1);
});
test('layer blending menu targets the clicked layer and disables edits when locked', () => {
  const layer={id:'target',locked:false};
  let opened;
  const context={
    doc:{layers:[layer],groups:[]}, selected:()=>layer,
    isLayerLocked:(_doc,item)=>item.locked,
    openBlendingOptions:item=>{opened=item;},
    toggleSelectedVisibility:()=>{}, toggleSelectedLock:()=>{}, rasterizeSelectedLayer:()=>{},
    addSelectedLayerMask:()=>{}, removeSelectedLayerMask:()=>{},
    applySelectionToVectorMask:()=>{}, editSelectedVectorMask:()=>{}, invertSelectedVectorMask:()=>{}, toggleSelectedVectorMask:()=>{}, removeSelectedVectorMask:()=>{},
    openSmartObjectContents:()=>{}, convertSelectedToSmartObject:()=>{}, openSmartFilterDialog:()=>{}, clearSmartFilters:()=>{},
    selectionShape:null,
  };
  vm.runInNewContext(`${layerMenuFunction}\nglobalThis.getMenu=layerContextMenu;`,context);
  const option=context.getMenu('target').find(item=>item[0]==='Параметры наложения…');
  assert.equal(option[3](),true);
  option[2]();
  assert.equal(opened,layer);
  layer.locked=true;
  assert.equal(option[3](),false);
});