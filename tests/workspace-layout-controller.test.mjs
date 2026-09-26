import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceLayoutController } from '../src/ui/workspace-layout-controller.js';

function classList(initial = []) {
  const values = new Set(initial);
  return {
    toggle(name, force) {
      if (force === undefined) force = !values.has(name);
      if (force) values.add(name);
      else values.delete(name);
      return force;
    },
    contains:name => values.has(name),
  };
}

function makeToggle(name = 'История') {
  const attributes = new Map();
  const listeners = new Map();
  return {
    title:'',
    setAttribute:(key,value) => attributes.set(key,String(value)),
    getAttribute:key => attributes.get(key) ?? null,
    querySelector:selector => selector === 'strong' ? { textContent:name } : null,
    addEventListener:(type,handler) => listeners.set(type,handler),
    click:() => listeners.get('click')?.(),
  };
}

function makePanel(id, name = 'История') {
  const toggle = makeToggle(name);
  const panel = {
    dataset:{ panelId:id },
    classList:classList(),
    querySelector:selector => selector === ':scope > header .panel-toggle' ? toggle : null,
  };
  return { panel, toggle };
}

test('collapse state restores current panels and migrates legacy color-effects state', () => {
  const storage = {
    getItem:() => JSON.stringify({ panels:['history'], propertySections:['color-effects'] }),
    setItem:() => {},
  };
  const controller = createWorkspaceLayoutController({ storage });
  assert.deepEqual(controller.readCollapseState().sort(), ['effects','history']);
  assert.deepEqual(controller.getCollapsedPanelIds().sort(), ['effects','history']);
});

test('invalid persisted collapse JSON is contained at the UI boundary', () => {
  const warnings = [];
  const controller = createWorkspaceLayoutController({
    storage:{ getItem:() => '{bad-json' },
    consoleRef:{ warn:(...args) => warnings.push(args) },
  });
  assert.deepEqual(controller.readCollapseState(), []);
  assert.equal(warnings.length, 1);
});

test('collapsing a panel updates accessibility state and persists the canonical panel list', () => {
  let saved = null;
  const storage = { getItem:() => null, setItem:(_key,value) => { saved = JSON.parse(value); } };
  const { panel, toggle } = makePanel('history');
  const controller = createWorkspaceLayoutController({ storage, panelCards:[panel] });

  assert.equal(controller.setPanelCollapsed(panel, true), true);
  assert.equal(panel.classList.contains('is-collapsed'), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.match(toggle.title, /Развернуть/);
  assert.deepEqual(saved, { panels:['history'] });

  controller.setPanelCollapsed(panel, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.match(toggle.title, /Свернуть/);
  assert.deepEqual(saved, { panels:[] });
});

test('initialization applies persisted state and wires the panel toggle through the controller', () => {
  const values = new Map([['ui', JSON.stringify({ panels:['history'] })]]);
  const storage = {
    getItem:key => values.get(key) ?? null,
    setItem:(key,value) => values.set(key,value),
  };
  const { panel, toggle } = makePanel('history');
  const controller = createWorkspaceLayoutController({ storage, storageKey:'ui', panelCards:[panel] });

  assert.equal(controller.initCollapsiblePanels(), 1);
  assert.equal(panel.classList.contains('is-collapsed'), true);
  toggle.click();
  assert.equal(panel.classList.contains('is-collapsed'), false);
  assert.deepEqual(JSON.parse(values.get('ui')), { panels:[] });
});

test('canvas mode hides chrome and preserves the same canvas point at the viewport center', () => {
  const workspace = { classList:classList() };
  const attributes = new Map();
  const toolbar = { setAttribute:(key,value) => attributes.set(`toolbar:${key}`,String(value)) };
  const rightPanel = { setAttribute:(key,value) => attributes.set(`right:${key}`,String(value)) };
  const viewport = {
    scrollLeft:0,
    scrollTop:0,
    getBoundingClientRect:() => ({ left:0, top:0, width:200, height:100 }),
  };
  const overlay = { getBoundingClientRect:() => ({ left:20, top:10 }) };
  const frames = [];
  const statuses = [];
  const controller = createWorkspaceLayoutController({
    workspace, toolbar, rightPanel, viewport, overlay,
    clientPointToCanvas:() => ({ x:50, y:25 }),
    getZoom:() => 2,
    requestFrame:callback => frames.push(callback),
    setStatus:value => statuses.push(value),
  });

  assert.equal(controller.togglePanels(), false);
  assert.equal(workspace.classList.contains('panels-hidden'), true);
  assert.equal(attributes.get('toolbar:aria-hidden'), 'true');
  assert.equal(attributes.get('right:aria-hidden'), 'true');
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(viewport.scrollLeft, 20);
  assert.equal(viewport.scrollTop, 10);
  assert.equal(statuses.at(-1), 'Режим холста: панели скрыты');

  assert.equal(controller.togglePanels(), true);
  assert.equal(workspace.classList.contains('panels-hidden'), false);
  assert.equal(attributes.get('toolbar:aria-hidden'), 'false');
  assert.equal(attributes.get('right:aria-hidden'), 'false');
});
