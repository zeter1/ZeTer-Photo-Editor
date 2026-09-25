import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/core/state.js';
import { createDocumentSessionController } from '../src/workspace/session-controller.js';

function harness() {
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
