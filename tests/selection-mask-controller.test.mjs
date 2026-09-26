import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  addLayer,
  createAdjustmentLayer,
  createDocument,
  createRasterLayer,
} from '../src/core/state.js';
import { createSelectionMaskController } from '../src/selection/mask-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  return { promise, resolve, reject };
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.isConnected = true;
    this.textContent = '';
    this.className = '';
    this.width = 0;
    this.height = 0;
  }
  append(...nodes) { this.children.push(...nodes); }
  prepend(node) { this.children.unshift(node); }
  setAttribute() {}
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatch(type) { for (const callback of this.listeners.get(type) || []) callback({ target:this }); }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

class FakeCanvasContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.filled = false;
    this.lastImageData = null;
    this.fillStyle = '';
    this.imageSmoothingEnabled = false;
    this.imageSmoothingQuality = 'low';
  }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  rect() {}
  ellipse() {}
  scale() {}
  setTransform() {}
  clearRect() {}
  drawImage() {}
  fill() { this.filled = true; }
  getImageData(_x, _y, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    if (this.filled) {
      for (let index = 0; index < width * height; index += 1) data[index * 4 + 3] = 255;
    }
    return { data };
  }
  createImageData(width, height) { return { data:new Uint8ClampedArray(width * height * 4) }; }
  putImageData(imageData) { this.lastImageData = imageData; }
}

class FakeCanvas extends FakeElement {
  constructor() {
    super('canvas');
    this.context = new FakeCanvasContext(this);
  }
  getContext() { return this.context; }
  toDataURL() { return `data:image/png;base64,${this.width}x${this.height}`; }
}

function createFakeDocument() {
  const canvases = [];
  return {
    canvases,
    createElement(tagName) {
      if (tagName === 'canvas') {
        const canvas = new FakeCanvas();
        canvases.push(canvas);
        return canvas;
      }
      return new FakeElement(tagName);
    },
  };
}

function FakeFormData() {
  return new Map([
    ['viewMode', 'mask'],
    ['smooth', '0'],
    ['shift', '0'],
    ['edgeRadius', '0'],
    ['edgeStrength', '60'],
    ['smartRadius', 'yes'],
    ['feather', '0'],
    ['contrast', '0'],
    ['invert', 'no'],
  ]);
}

function refineValues(overrides = {}) {
  return {
    viewMode:'mask',
    smooth:'0',
    shift:'0',
    edgeRadius:'0',
    edgeStrength:'60',
    smartRadius:'yes',
    feather:'0',
    contrast:'0',
    invert:'no',
    ...overrides,
  };
}

function harness({
  layer = createRasterLayer({ name:'Layer', width:16, height:12, dataUrl:null }),
  renderLayer = async () => {},
  documentWidth = 64,
  documentHeight = 48,
} = {}) {
  const documentValue = createDocument({ name:'mask-controller', width:documentWidth, height:documentHeight });
  addLayer(documentValue, layer);
  documentValue.selectedLayerId = layer.id;
  let activeDocument = documentValue;
  let selectedLayer = layer;
  let selectionShape = { type:'rect', x:1, y:1, width:8, height:6 };
  let modalConfig = null;
  const commits = [];
  const statuses = [];
  const toasts = [];
  const fakeDocument = createFakeDocument();
  const scheduledFrames = new Map();
  const cancelledFrames = [];
  let nextFrameId = 0;

  const controller = createSelectionMaskController({
    state:{
      getDocument:() => activeDocument,
      getSelectedLayer:() => selectedLayer,
      commit:label => commits.push(label),
    },
    selection:{
      getSelectionShape:() => selectionShape ? structuredClone(selectionShape) : null,
      traceDocumentSelectionPath:(ctx, shape) => {
        if (!shape) return false;
        ctx.beginPath();
        ctx.rect(0, 0, activeDocument.width, activeDocument.height);
        ctx.closePath();
        return true;
      },
      selectionPolygonForLayer:(_layer, shape) => shape ? [
        { x:0, y:0 },
        { x:8, y:0 },
        { x:8, y:6 },
        { x:0, y:6 },
      ] : null,
    },
    rendering:{ renderLayer, getSourceCanvas:() => new FakeCanvas() },
    ui:{
      showModal:config => { modalConfig = config; },
      setStatus:value => statuses.push(value),
      toast:(message, tone) => toasts.push([message, tone]),
      documentRef:fakeDocument,
      FormDataClass:FakeFormData,
      requestFrame:callback => {
        nextFrameId += 1;
        scheduledFrames.set(nextFrameId, callback);
        return nextFrameId;
      },
      cancelFrame:id => {
        cancelledFrames.push(id);
        scheduledFrames.delete(id);
      },
      consoleRef:{ error() {} },
    },
  });

  return {
    controller,
    documentValue,
    layer,
    commits,
    statuses,
    toasts,
    fakeDocument,
    scheduledFrames,
    cancelledFrames,
    getModalConfig:() => modalConfig,
    setActiveDocument:value => { activeDocument = value; },
    setSelectedLayer:value => { selectedLayer = value; },
    setSelectionShape:value => { selectionShape = value; },
  };
}

test('refine option normalization preserves bounds and preview scale conversion', () => {
  const h = harness();
  assert.deepEqual(
    h.controller.selectionRefineOptionsFromValues({
      smooth:99, shift:-99, edgeRadius:99, edgeStrength:150, smartRadius:'no',
      feather:99, contrast:-5, invert:'yes',
    }, 2),
    {
      smooth:16, shift:-32, edgeRadius:6, edgeStrength:100, smartRadius:false,
      feather:32, contrast:0, invert:true,
    },
  );
});

test('selection masks keep layer-local dimensions while adjustment masks use document dimensions', async () => {
  const regular = harness({
    layer:createRasterLayer({ name:'Raster', width:17, height:11, dataUrl:null }),
    documentWidth:80,
    documentHeight:60,
  });
  assert.equal(await regular.controller.selectionMaskDataUrl(regular.layer), 'data:image/png;base64,17x11');

  const adjustmentLayer = createAdjustmentLayer({ name:'Adjustment', width:5, height:5 });
  const adjustment = harness({ layer:adjustmentLayer, documentWidth:80, documentHeight:60 });
  assert.equal(await adjustment.controller.selectionMaskDataUrl(adjustment.layer), 'data:image/png;base64,80x60');
});

test('selection mask refinement preserves 12 MP and edge-work safety limits', async () => {
  const tooLarge = harness({
    layer:createRasterLayer({ name:'Large', width:4000, height:4000, dataUrl:null }),
    documentWidth:4000,
    documentHeight:4000,
  });
  await assert.rejects(() => tooLarge.controller.selectionMaskDataUrl(tooLarge.layer, { smooth:1 }), /12 МП/);

  const heavyEdge = harness({
    layer:createRasterLayer({ name:'Heavy', width:3000, height:3000, dataUrl:null }),
    documentWidth:3000,
    documentHeight:3000,
  });
  await assert.rejects(() => heavyEdge.controller.selectionMaskDataUrl(heavyEdge.layer, { edgeRadius:6 }), /Умный радиус слишком тяжёлый/);
});

test('add mask from selection publishes one mask and one history commit', async () => {
  const h = harness();
  assert.equal(await h.controller.addSelectedLayerMask(true), true);
  assert.equal(h.layer.mask?.dataUrl, 'data:image/png;base64,16x12');
  assert.deepEqual(h.commits, ['Добавить маску из выделения']);
  assert.equal(h.statuses.at(-1), 'Маска слоя создана из текущего выделения');
});

test('document switch during async add-mask encoding publishes nothing', async () => {
  const h = harness();
  const pending = h.controller.addSelectedLayerMask(true);
  h.setActiveDocument(createDocument({ name:'replacement', width:10, height:10 }));
  assert.equal(await pending, false);
  assert.equal(h.layer.mask, null);
  assert.deepEqual(h.commits, []);
});

async function openRefineModal(h) {
  assert.equal(await h.controller.refineSelectionToLayerMask(), true);
  const config = h.getModalConfig();
  assert.ok(config);
  return config;
}

test('final refined Apply drops a late result after document switch', async () => {
  const gate = deferred();
  const h = harness({ renderLayer:async () => gate.promise });
  const config = await openRefineModal(h);
  const pending = config.onSubmit(refineValues({ edgeRadius:'1' }));
  h.setActiveDocument(createDocument({ name:'replacement', width:10, height:10 }));
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(h.layer.mask, null);
  assert.deepEqual(h.commits, []);
});

test('final refined Apply drops a late result after selected layer changes', async () => {
  const gate = deferred();
  const h = harness({ renderLayer:async () => gate.promise });
  const config = await openRefineModal(h);
  const pending = config.onSubmit(refineValues({ edgeRadius:'1' }));
  h.setSelectedLayer(createRasterLayer({ name:'Other', width:8, height:8, dataUrl:null }));
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(h.layer.mask, null);
  assert.deepEqual(h.commits, []);
});

test('final refined Apply drops a late result when the target becomes locked', async () => {
  const gate = deferred();
  const h = harness({ renderLayer:async () => gate.promise });
  const config = await openRefineModal(h);
  const pending = config.onSubmit(refineValues({ edgeRadius:'1' }));
  h.layer.locked = true;
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(h.layer.mask, null);
  assert.deepEqual(h.commits, []);
});

test('valid refined Apply publishes exactly one mask and one history entry', async () => {
  const h = harness();
  const config = await openRefineModal(h);
  assert.equal(await config.onSubmit(refineValues()), true);
  assert.ok(h.layer.mask);
  assert.deepEqual(h.commits, ['Создать уточнённую маску слоя']);
  assert.match(h.statuses.at(-1), /^Маска уточнена:/);
});

test('stale preview preparation cannot bind listeners or publish into a switched document', async () => {
  const gate = deferred();
  const h = harness({ renderLayer:async () => gate.promise });
  const modal = new FakeElement('form');
  const body = new FakeElement('div');
  const pending = h.controller.attachSelectionRefinePreview(modal, body, h.layer, 1);
  h.setActiveDocument(createDocument({ name:'replacement', width:10, height:10 }));
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(modal.listenerCount('input'), 0);
  assert.equal(modal.listenerCount('change'), 0);
  assert.equal(h.scheduledFrames.size, 0);
});

test('preview cleanup cancels queued animation work and detaches listeners', async () => {
  const h = harness();
  const modal = new FakeElement('form');
  const body = new FakeElement('div');
  assert.equal(await h.controller.attachSelectionRefinePreview(modal, body, h.layer, 1), true);
  assert.equal(modal.listenerCount('input'), 1);
  assert.equal(modal.listenerCount('change'), 1);
  modal.dispatch('input');
  assert.equal(h.scheduledFrames.size, 1);
  modal.previewCleanup();
  assert.equal(h.scheduledFrames.size, 0);
  assert.equal(h.cancelledFrames.length, 1);
  assert.equal(modal.listenerCount('input'), 0);
  assert.equal(modal.listenerCount('change'), 0);
});

test('selection raster-mask policy has one owner and Smart Filter consumes its bridge', async () => {
  const [main, controller, build] = await Promise.all([
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/selection/mask-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../tools/build-bundle.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(main, /createSelectionMaskController/);
  assert.match(main, /selectionMaskDataUrl,/);
  assert.match(build, /src\/selection\/mask-controller\.js/);
  for (const definition of [
    'function selectionRefineSourceRgba(',
    'function selectionMaskDataUrl(',
    'function addSelectedLayerMask(',
    'function selectionRefineOptionsFromValues(',
    'function buildSelectionRefinePreviewSource(',
    'function attachSelectionRefinePreview(',
    'function refineSelectionToLayerMask(',
    'function removeSelectedLayerMask(',
  ]) {
    assert.equal(main.includes(definition), false, definition + ' must not drift back into main.js');
    assert.equal(controller.includes(definition), true, definition + ' must stay in the selection mask controller');
  }
});
