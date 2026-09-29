import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryNavigationController } from '../src/workspace/history-navigation-controller.js';

function createHarness({
  blocked = false,
  history = null,
} = {}) {
  const events = [];
  let activeHistory = history || {
    undo: () => null,
    redo: () => null,
    jump: () => null,
  };
  let documentValue = { id:'initial' };

  const controller = createHistoryNavigationController({
    state: {
      getHistory: () => activeHistory,
      setDocument: value => {
        documentValue = value;
        events.push(['document', value]);
      },
    },
    guard: {
      blockPendingDocumentEdit: () => {
        events.push(['guard']);
        return blocked;
      },
    },
    restore: {
      restoreDocument: snapshot => {
        events.push(['restore', snapshot]);
        return { restored:snapshot };
      },
    },
    transient: {
      clearSelection: () => events.push(['selection']),
      clearRasterEdit: () => events.push(['raster']),
      resetCrop: () => events.push(['crop']),
    },
    runtime: {
      updateAll: () => events.push(['update']),
      markDirty: value => events.push(['dirty', value]),
      setStatus: value => events.push(['status', value]),
    },
  });

  return {
    controller,
    events,
    get documentValue() { return documentValue; },
    set history(value) { activeHistory = value; },
  };
}

test('history navigation fails fast when a required bridge is missing', () => {
  assert.throws(
    () => createHistoryNavigationController(),
    /history navigation history bridge is required/,
  );
});

test('pending edits block undo, redo and jump before touching history or runtime state', () => {
  const historyEvents = [];
  const h = createHarness({
    blocked:true,
    history:{
      undo:() => { historyEvents.push('undo'); return {label:'u',snapshot:'u'}; },
      redo:() => { historyEvents.push('redo'); return {label:'r',snapshot:'r'}; },
      jump:index => { historyEvents.push(['jump',index]); return {label:'j',snapshot:'j'}; },
    },
  });

  assert.equal(h.controller.undo(), false);
  assert.equal(h.controller.redo(), false);
  assert.equal(h.controller.jumpToHistory(2), false);
  assert.deepEqual(historyEvents, []);
  assert.deepEqual(h.events, [['guard'], ['guard'], ['guard']]);
  assert.deepEqual(h.documentValue, { id:'initial' });
});

test('undo and redo semantic no-ops publish nothing after the guard/history call', () => {
  const historyEvents = [];
  const h = createHarness({
    history:{
      undo:() => { historyEvents.push('undo'); return null; },
      redo:() => { historyEvents.push('redo'); return null; },
      jump:() => null,
    },
  });

  assert.equal(h.controller.undo(), false);
  assert.equal(h.controller.redo(), false);
  assert.deepEqual(historyEvents, ['undo','redo']);
  assert.deepEqual(h.events, [['guard'], ['guard']]);
});

test('undo restores snapshot then preserves selection/raster/update/dirty/status publication order', () => {
  const h = createHarness({
    history:{
      undo:() => ({label:'Шаг назад',snapshot:'undo-snapshot'}),
      redo:() => null,
      jump:() => null,
    },
  });

  assert.equal(h.controller.undo(), true);
  assert.deepEqual(h.documentValue, { restored:'undo-snapshot' });
  assert.deepEqual(h.events, [
    ['guard'],
    ['restore','undo-snapshot'],
    ['document',{restored:'undo-snapshot'}],
    ['selection'],
    ['raster'],
    ['update'],
    ['dirty',true],
    ['status','Отменено → Шаг назад'],
  ]);
});

test('redo restores snapshot with the same cleanup/publication contract and exact status', () => {
  const h = createHarness({
    history:{
      undo:() => null,
      redo:() => ({label:'Шаг вперёд',snapshot:'redo-snapshot'}),
      jump:() => null,
    },
  });

  assert.equal(h.controller.redo(), true);
  assert.deepEqual(h.events, [
    ['guard'],
    ['restore','redo-snapshot'],
    ['document',{restored:'redo-snapshot'}],
    ['selection'],
    ['raster'],
    ['update'],
    ['dirty',true],
    ['status','Повторено → Шаг вперёд'],
  ]);
});

test('history jump forwards the index and preserves raster/crop/selection cleanup order', () => {
  const historyEvents = [];
  const h = createHarness({
    history:{
      undo:() => null,
      redo:() => null,
      jump:index => {
        historyEvents.push(['jump',index]);
        return {label:'Target',snapshot:'jump-snapshot'};
      },
    },
  });

  assert.equal(h.controller.jumpToHistory('3'), true);
  assert.deepEqual(historyEvents, [['jump','3']]);
  assert.deepEqual(h.events, [
    ['guard'],
    ['restore','jump-snapshot'],
    ['document',{restored:'jump-snapshot'}],
    ['raster'],
    ['crop'],
    ['selection'],
    ['update'],
    ['dirty',true],
    ['status','История → Target'],
  ]);
});

test('history binding is resolved at command time instead of captured during composition', () => {
  const calls = [];
  const first = {
    undo:() => { calls.push('first'); return {label:'first',snapshot:'first'}; },
    redo:() => null,
    jump:() => null,
  };
  const second = {
    undo:() => { calls.push('second'); return {label:'second',snapshot:'second'}; },
    redo:() => null,
    jump:() => null,
  };
  const h = createHarness({ history:first });

  h.history = second;
  assert.equal(h.controller.undo(), true);
  assert.deepEqual(calls, ['second']);
  assert.deepEqual(h.documentValue, { restored:'second' });
});
