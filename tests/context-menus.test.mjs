import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createDocument, snapshotDocument, restoreDocument, touch } from '../src/core/state.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const tabFunctions = main.slice(main.indexOf('function renameDocumentTab(id) {'), main.indexOf('function setPanelCollapsed('));
const layerMenuFunction = main.slice(main.indexOf('function layerContextMenu(id) {'), main.indexOf('function groupContextMenu(id) {'));

test('renaming an inactive tab updates only its document and recovery history', () => {
  const active = { id:'active', doc:createDocument({name:'Активная'}), history:{push(){}}, dirty:false };
  const background = { id:'background', doc:createDocument({name:'Фоновая'}), history:{push(...args){this.last=args;}}, dirty:false };
  let dialog, recoveryCalls=0, tabRenders=0;
  const context = {
    documentSessions:[active,background], activeSessionId:'active', doc:active.doc,
    blockPendingDocumentEdit:()=>false, showModal:options=>{dialog=options;},
    snapshotDocument, restoreDocument, touch,
    renderDocumentTabs:()=>{tabRenders++;}, queueRecovery:()=>{recoveryCalls++;},
    setStatus:()=>{}, commit:()=>{throw new Error('Active document was changed');},
  };
  vm.runInNewContext(`${tabFunctions}\nglobalThis.renameTab=renameDocumentTab;`,context);
  context.renameTab('background');
  dialog.onSubmit({name:'Новое имя'});
  assert.equal(active.doc.name,'Активная');
  assert.equal(background.doc.name,'Новое имя');
  assert.equal(background.dirty,true);
  assert.equal(background.history.last[0],'Переименовать вкладку');
  assert.equal(JSON.parse(background.history.last[1]).name,'Новое имя');
  assert.equal(recoveryCalls,1);
  assert.equal(tabRenders,1);
});

test('duplicating a background tab keeps the active document and makes a recoverable copy', () => {
  const active = { id:'active', doc:createDocument({name:'Активная'}), zoom:.8 };
  const background = { id:'background', doc:createDocument({name:'Фоновая'}), zoom:1.5 };
  let recoveryCalls=0;
  const context = {
    documentSessions:[active,background], activeSessionId:'active', doc:active.doc,
    blockPendingDocumentEdit:()=>false, syncCurrentSession:()=>{},
    snapshotDocument, restoreDocument,
    buildSession:(documentValue,options)=>({id:'copy',doc:documentValue,...options}),
    renderDocumentTabs:()=>{}, queueRecovery:()=>{recoveryCalls++;}, setStatus:()=>{},
  };
  vm.runInNewContext(`${tabFunctions}\nglobalThis.duplicateTab=duplicateDocumentTab;`,context);
  context.duplicateTab('background');
  assert.equal(context.activeSessionId,'active');
  assert.equal(context.doc,active.doc);
  assert.equal(context.documentSessions[2].doc.name,'Фоновая — копия');
  assert.notEqual(context.documentSessions[2].doc,background.doc);
  assert.equal(context.documentSessions[2].dirtyState,true);
  assert.equal(context.documentSessions[2].zoomLevel,1.5);
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
    applySelectionToVectorMask:()=>{}, invertSelectedVectorMask:()=>{}, toggleSelectedVectorMask:()=>{}, removeSelectedVectorMask:()=>{},
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