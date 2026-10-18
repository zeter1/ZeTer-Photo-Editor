import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/core/state.js';
import { createDocumentSessionController } from '../src/workspace/session-controller.js';

function harness({cancelPendingContentAwareFill = () => false, blockPendingDocumentEdit = () => false} = {}) {
  let sessions = [];
  let activeSessionId = '';
  let runtime = {
    doc:createDocument({name:'A',width:32,height:24}),
    history:null,
    zoom:.75,
    dirty:false,
    cropRect:null,
    selectionRect:null,
    selectionShape:null,
    selectedDocumentPathIndex:-1,
  };
  const events = [];
  const controller = createDocumentSessionController({
    getSessions:() => sessions,
    getActiveSessionId:() => activeSessionId,
    setActiveSessionId:value => { activeSessionId = value; },
    getRuntimeState:() => runtime,
    applyRuntimeState:value => { runtime = { ...runtime, ...value, selectedDocumentPathIndex:value.selectedPathIndex }; },
    cloneSelectionShape:shape => shape ? structuredClone(shape) : null,
    cancelPendingContentAwareFill,
    blockPendingDocumentEdit,
    updateAll:() => events.push('update'),
    fitToView:() => events.push('fit'),
    setStatus:value => events.push(value),
    toast:value => events.push(value),
    queueRecovery:() => events.push('recovery'),
  });
  return {
    controller,
    events,
    get sessions(){ return sessions; },
    set sessions(value){ sessions = value; },
    get activeSessionId(){ return activeSessionId; },
    set activeSessionId(value){ activeSessionId = value; },
    get runtime(){ return runtime; },
    set runtime(value){ runtime = value; },
  };
}

test('workspace controller owns session history snapshots and live runtime synchronization', () => {
  const h = harness();
  const session = h.controller.buildSession(h.runtime.doc);
  h.sessions = [session];
  h.activeSessionId = session.id;
  h.runtime = {
    ...h.runtime,
    history:session.history,
    zoom:1.25,
    dirty:true,
    cropRect:{x:1,y:2,width:3,height:4},
    selectionShape:{type:'rect',rect:{x:2,y:3,width:4,height:5}},
    selectedDocumentPathIndex:2,
  };
  h.controller.syncCurrentSession();
  assert.equal(session.zoom,1.25);
  assert.equal(session.dirty,true);
  assert.deepEqual(session.cropRect,{x:1,y:2,width:3,height:4});
  assert.deepEqual(session.selectionShape,{type:'rect',rect:{x:2,y:3,width:4,height:5}});
  assert.equal(session.selectedPathIndex,2);
});

test('workspace controller creates unique untitled tabs and activates the new session', () => {
  const h = harness();
  const first = h.controller.buildSession(h.runtime.doc);
  h.sessions = [first];
  h.activeSessionId = first.id;
  h.runtime = { ...h.runtime, history:first.history };
  h.controller.addDocumentTab();
  assert.equal(h.sessions.length,2);
  assert.equal(h.sessions[1].doc.name,'Без имени');
  h.controller.addDocumentTab();
  assert.equal(h.sessions[2].doc.name,'Без имени 2');
  assert.equal(h.activeSessionId,h.sessions[2].id);
  assert.ok(h.events.includes('fit'));
});

test('workspace controller refuses to close a parent while smart-object child tabs exist', () => {
  const h = harness();
  const parent = h.controller.buildSession(h.runtime.doc);
  const child = h.controller.buildSession(createDocument({name:'Child'}), {
    smartObjectLink:{parentSessionId:parent.id,layerId:'layer-1'},
  });
  h.sessions = [parent,child];
  h.activeSessionId = parent.id;
  h.runtime = { ...h.runtime, history:parent.history };
  h.controller.closeDocumentTab(parent.id);
  assert.equal(h.sessions.length,2);
  assert.ok(h.events.some(value => String(value).includes('Сначала закройте вкладки содержимого')));
});

test('workspace controller restores each session saved-path selection through the runtime bridge',()=>{
  const h=harness();
  const first=h.controller.buildSession(h.runtime.doc);
  const second=h.controller.buildSession(createDocument({name:'B',width:40,height:30}));
  first.selectedPathIndex=1;
  second.selectedPathIndex=3;
  h.sessions=[first,second];

  h.activeSessionId=first.id;
  h.controller.loadSession(first);
  assert.equal(h.runtime.selectedDocumentPathIndex,1);

  h.activeSessionId=second.id;
  h.controller.loadSession(second);
  assert.equal(h.runtime.selectedDocumentPathIndex,3);
});

test('closing the active document revokes native Fill before owner removal and does not touch the surviving history', () => {
  let h;
  const cancellations=[];
  h=harness({blockPendingDocumentEdit:()=>cancellations.length===0,
    cancelPendingContentAwareFill:()=>{
    cancellations.push({active:h.activeSessionId,remaining:h.sessions.length});
    h.events.push('cancel');
    return true;
  }});
  const original=h.controller.buildSession(h.runtime.doc);
  const survivor=h.controller.buildSession(createDocument({name:'Survivor',width:40,height:30}));
  h.sessions=[original,survivor];
  h.activeSessionId=original.id;
  h.runtime={...h.runtime,history:original.history};
  const historyBefore=survivor.history.current();
  h.controller.closeDocumentTab(original.id);
  assert.deepEqual(cancellations,[{active:original.id,remaining:2}]);
  assert.equal(h.sessions.length,1);
  assert.equal(h.activeSessionId,survivor.id);
  assert.equal(h.runtime.doc,survivor.doc);
  assert.equal(survivor.history.current(),historyBefore);
  assert.ok(h.events.indexOf('cancel') < h.events.indexOf('update'));
});

test('a rejected dirty close never cancels the pending Fill or removes its owner', () => {
  let cancelled=0;
  const h=harness({cancelPendingContentAwareFill:()=>{cancelled++;return true;}});
  const original=h.controller.buildSession(h.runtime.doc);
  const survivor=h.controller.buildSession(createDocument({name:'Survivor'}));
  h.sessions=[original,survivor];h.activeSessionId=original.id;
  h.runtime={...h.runtime,history:original.history,dirty:true};
  const previous=globalThis.window;
  globalThis.window={confirm:()=>false};
  try{h.controller.closeDocumentTab(original.id);}
  finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
  assert.equal(cancelled,0);
  assert.deepEqual(h.sessions,[original,survivor]);
  assert.equal(h.activeSessionId,original.id);
});

test('closing an inactive tab without switching the active owner does not revoke its Fill', () => {
  let cancelled=0;
  const h=harness({cancelPendingContentAwareFill:()=>{cancelled++;return true;}});
  const a=h.controller.buildSession(h.runtime.doc);
  const b=h.controller.buildSession(createDocument({name:'B'}));
  const c=h.controller.buildSession(createDocument({name:'C'}));
  h.sessions=[a,b,c];h.activeSessionId=b.id;
  h.runtime={...h.runtime,doc:b.doc,history:b.history};
  h.controller.closeDocumentTab(a.id);
  assert.equal(cancelled,0);
  assert.equal(h.activeSessionId,b.id);
  assert.deepEqual(h.sessions,[b,c]);
});

test('non-cancellable pending paint blocks close even when Fill cancellation is unavailable', () => {
  let cancelCalls=0;
  const h=harness({blockPendingDocumentEdit:()=>true,
    cancelPendingContentAwareFill:()=>{cancelCalls++;return false;}});
  const a=h.controller.buildSession(h.runtime.doc);
  const b=h.controller.buildSession(createDocument({name:'B'}));
  h.sessions=[a,b];h.activeSessionId=a.id;
  h.runtime={...h.runtime,history:a.history};
  h.controller.closeDocumentTab(a.id);
  assert.equal(cancelCalls,1);
  assert.equal(h.sessions.length,2);
  assert.equal(h.activeSessionId,a.id);
});
