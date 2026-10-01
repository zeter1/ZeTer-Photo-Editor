import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryPanelController } from '../src/ui/history-panel-controller.js';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.type = '';
    this.className = '';
    this.textContent = '';
    this.title = '';
    this.disabled = false;
    this.onclick = null;
    this.scrollTop = 0;
    this.scrollHeight = 0;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  click() {
    if (this.disabled) return false;
    this.onclick?.({ currentTarget:this });
    return true;
  }
}
class FakeDocument {
  createElement(tagName) { return new FakeElement(tagName); }
}

function createHarness(initialHistory) {
  const container = new FakeElement('div');
  const jumps = [];
  let activeHistory = initialHistory;
  const controller = createHistoryPanelController({
    container,
    state: { getHistory: () => activeHistory },
    commands: { jumpToHistory: index => jumps.push(index) },
    documentRef: new FakeDocument(),
  });
  return {
    controller,
    container,
    jumps,
    setHistory(value) { activeHistory = value; },
  };
}

test('history panel fails fast when a required bridge is missing', () => {
  const history = { entries:[], index:-1 };
  const documentRef = new FakeDocument();
  assert.throws(() => createHistoryPanelController(), /history panel container is required/);
  assert.throws(
    () => createHistoryPanelController({ container:new FakeElement(), commands:{ jumpToHistory(){} }, documentRef }),
    /history panel history bridge is required/,
  );
  assert.throws(
    () => createHistoryPanelController({ container:new FakeElement(), state:{ getHistory:() => history }, documentRef }),
    /history panel jump command is required/,
  );
  assert.throws(
    () => createHistoryPanelController({
      container:new FakeElement(),
      state:{ getHistory:() => history },
      commands:{ jumpToHistory(){} },
      documentRef:{},
    }),
    /history panel document bridge is required/,
  );
});

test('empty history clears rows and still scrolls to the bottom', () => {
  const h = createHarness({ entries:[], index:-1 });
  h.container.children.push(new FakeElement('button'));
  h.container.scrollHeight = 73;

  h.controller.render();

  assert.deepEqual(h.container.children, []);
  assert.equal(h.container.scrollTop, 73);
  assert.deepEqual(h.jumps, []);
});

test('history rows preserve order, marker, classes, titles and disabled current state', () => {
  const h = createHarness({
    entries:[{label:'Открытие'}, {label:'Кисть'}, {label:'Поворот'}],
    index:1,
  });
  h.container.scrollHeight = 144;

  h.controller.render();

  assert.equal(h.container.children.length, 3);
  assert.deepEqual(
    h.container.children.map(row => ({
      type:row.type,
      className:row.className,
      textContent:row.textContent,
      title:row.title,
      disabled:row.disabled,
    })),
    [
      { type:'button', className:'history-row', textContent:'Открытие', title:'Перейти к этому состоянию', disabled:false },
      { type:'button', className:'history-row current', textContent:'● Кисть', title:'Текущее состояние', disabled:true },
      { type:'button', className:'history-row', textContent:'Поворот', title:'Перейти к этому состоянию', disabled:false },
    ],
  );
  assert.equal(h.container.scrollTop, 144);

  assert.equal(h.container.children[0].click(), true);
  assert.equal(h.container.children[1].click(), false);
  assert.equal(h.container.children[2].click(), true);
  assert.deepEqual(h.jumps, [0, 2]);
});

test('each render resolves the live history binding instead of capturing the initial session stack', () => {
  const h = createHarness({
    entries:[{label:'First session'}],
    index:0,
  });
  h.controller.render();
  const firstRow = h.container.children[0];

  h.setHistory({
    entries:[{label:'Second base'}, {label:'Second edit'}],
    index:1,
  });
  h.controller.render();

  assert.notEqual(h.container.children[0], firstRow);
  assert.deepEqual(h.container.children.map(row => row.textContent), ['Second base', '● Second edit']);
  h.container.children[0].click();
  assert.deepEqual(h.jumps, [0]);
});
