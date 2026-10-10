import test from 'node:test';
import assert from 'node:assert/strict';
import { addLayer, createDocument, createRasterLayer } from '../src/core/state.js';
import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { createRasterCommandController } from '../src/painting/command-controller.js';

function canvasHarness(width = 4, height = 1, pixels = new Uint8ClampedArray(width * height * 4)) {
  const calls = { save:0, restore:0, stroke:0, clearRect:0, putImageData:0 };
  const context = {
    lineCap:'butt',
    lineJoin:'miter',
    lineWidth:1,
    globalAlpha:1,
    globalCompositeOperation:'source-over',
    strokeStyle:'#000000',
    save() { calls.save += 1; },
    restore() { calls.restore += 1; },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() { calls.stroke += 1; },
    clearRect() { calls.clearRect += 1; },
    getImageData() { return { data:pixels }; },
    putImageData() { calls.putImageData += 1; },
  };
  return { canvas:{ width, height }, context, calls, pixels };
}

function makeHarness({
  doc = createDocument({ width:4, height:1 }),
  selected = () => doc.layers.find(layer => layer.id === doc.selectedLayerId) || null,
  atPoint = point => selected(point),
  isEditableRasterLayer = layer => Boolean(layer) && layer.type === 'raster',
  selectionActive = false,
  selectionSnapshot = selectionActive ? { type:'rect', rect:{ x:0, y:0, width:1, height:1 } } : null,
  selectionContains = () => true,
  selectionPredicate = () => null,
  selectionIntersects = () => true,
  persistResult = true,
  highDepthPersistResult = true,
  tiledPersistResult = null,
  highDepthBuffer = null,
  pixels,
} = {}) {
  let persisting = false;
  let persistCalls = 0;
  const ensureCalls = [];
  const persistArgs = [];
  let resetPaintStateCalls = 0;
  let highDepthPersistCalls = 0;
  const highDepthPersistArgs = [];
  let tiledPersistCalls = 0;
  const tiledPersistArgs = [];
  const commits = [];
  const statuses = [];
  const clips = [];
  const canvas = canvasHarness(4, 1, pixels);

  const rasterEdit = {
    brushCanvas:null,
    brushContext:null,
    editableHighDepthBuffer() { return highDepthBuffer; },
    async persistTiledHighDepthMutation(owner, layer, visitor, options) {
      tiledPersistCalls += 1;
      tiledPersistArgs.push([owner, layer, visitor, options]);
      return typeof tiledPersistResult === 'function'
        ? tiledPersistResult(owner, layer, visitor, options)
        : tiledPersistResult;
    },
    async persistHighDepthMutation(owner, layer, buffer, options) {
      highDepthPersistCalls += 1;
      highDepthPersistArgs.push([owner, layer, buffer, options]);
      return typeof highDepthPersistResult === 'function'
        ? highDepthPersistResult(owner, layer, buffer, options)
        : highDepthPersistResult;
    },
    async ensureRasterBuffer(owner, layer) {
      ensureCalls.push([owner, layer]);
      this.brushCanvas = { ...canvas.canvas, width:layer.width, height:layer.height };
      this.brushContext = canvas.context;
      return { canvas:this.brushCanvas, ctx:this.brushContext };
    },
    async persistPaintLayer(owner, layer, options) {
      persistCalls += 1;
      persistArgs.push([owner, layer, options]);
      return typeof persistResult === 'function' ? persistResult(owner, layer, options) : persistResult;
    },
    clearBrushBuffer() {
      this.brushCanvas = null;
      this.brushContext = null;
    },
  };

  const controller = createRasterCommandController({
    rasterEdit,
    state:{
      getDocument:() => doc,
      isPersisting:() => persisting,
      beginPersist:() => {
        if (persisting) return false;
        persisting = true;
        return true;
      },
      endPersist:() => { persisting = false; },
      resetPaintState:() => { resetPaintStateCalls += 1; },
    },
    target:{
      selected,
      atPoint,
      isEditableRasterLayer,
      toLocal:point => ({ ...point }),
    },
    selection:{
      hasActive:() => selectionActive,
      captureSnapshot:() => selectionSnapshot,
      containsPoint:selectionContains,
      intersectsLayer:selectionIntersects,
      predicate:selectionPredicate,
      clipContext:(context, layer, snapshot) => clips.push([context, layer, snapshot]),
    },
    tools:{
      primaryColor:() => '#ff0000',
      brushSize:() => 6,
      opacity:() => 1,
      fillTolerance:() => 0,
      rgbToCmyk:() => [.1,.2,.3,.4],
    },
    ui:{
      setStatus:value => statuses.push(value),
      toast() {},
      render() {},
      commit:value => commits.push(value),
    },
  });

  return {
    controller,
    rasterEdit,
    canvas,
    commits,
    statuses,
    clips,
    getPersisting:() => persisting,
    getPersistCalls:() => persistCalls,
    getEnsureCalls:() => ensureCalls,
    getPersistArgs:() => persistArgs,
    getResetPaintStateCalls:() => resetPaintStateCalls,
    getHighDepthPersistCalls:() => highDepthPersistCalls,
    getHighDepthPersistArgs:() => highDepthPersistArgs,
    getTiledPersistCalls:() => tiledPersistCalls,
    getTiledPersistArgs:() => tiledPersistArgs,
  };
}

test('line command creates one sparse raster target and keeps persistence/history outside main.js', async () => {
  const doc = createDocument({ width:8, height:6 });
  const harness = makeHarness({
    doc,
    selected:() => null,
    atPoint:() => null,
    isEditableRasterLayer:layer => Boolean(layer) && layer.type === 'raster',
  });

  assert.equal(await harness.controller.drawLine({ x:1, y:2 }, { x:6, y:4 }), true);
  assert.equal(doc.layers.length, 1);
  assert.equal(doc.layers[0].type, 'raster');
  assert.equal(doc.layers[0].name, 'Линии');
  assert.equal(doc.layers[0].dataUrl, null);
  assert.equal(doc.selectedLayerId, doc.layers[0].id);
  assert.equal(harness.canvas.calls.stroke, 1);
  assert.equal(harness.clips.length, 1);
  assert.equal(harness.getPersistCalls(), 1);
  assert.equal(harness.getPersisting(), false);
  assert.equal(harness.getEnsureCalls()[0][0], doc);
  assert.equal(harness.getEnsureCalls()[0][1], doc.layers[0]);
  assert.equal(harness.getPersistArgs()[0][0], doc);
  assert.equal(harness.getPersistArgs()[0][1], doc.layers[0]);
  assert.deepEqual(harness.commits, ['Нарисовать линию']);
});

test('Canvas8 command suppresses history and success feedback when persistence becomes stale', async () => {
  const doc = createDocument({ width:8, height:6 });
  const harness = makeHarness({
    doc,
    selected:() => null,
    atPoint:() => null,
    isEditableRasterLayer:layer => Boolean(layer) && layer.type === 'raster',
    persistResult:false,
  });

  assert.equal(await harness.controller.drawLine({ x:1, y:2 }, { x:6, y:4 }), false);
  assert.equal(harness.getPersistCalls(), 1);
  assert.equal(harness.getPersisting(), false);
  assert.deepEqual(harness.commits, []);
  assert.equal(harness.statuses.some(value => value.startsWith('Линия добавлена')), false);
});

test('fill command owns Canvas8 flood fill while honoring the injected selection predicate', async () => {
  const doc = createDocument({ width:4, height:1 });
  const layer = createRasterLayer({ name:'Pixels', width:4, height:1, dataUrl:null });
  addLayer(doc, layer);
  const pixels = new Uint8ClampedArray([
    255,255,255,255,
    255,255,255,255,
    255,255,255,255,
    255,255,255,255,
  ]);
  const harness = makeHarness({
    doc,
    pixels,
    selectionActive:true,
    selectionContains:() => true,
    selectionPredicate:() => x => x < 2,
  });

  assert.equal(await harness.controller.fillAt({ x:0, y:0 }), true);
  assert.deepEqual([...pixels.slice(0,4)], [255,0,0,255]);
  assert.deepEqual([...pixels.slice(4,8)], [255,0,0,255]);
  assert.deepEqual([...pixels.slice(8,12)], [255,255,255,255]);
  assert.equal(harness.canvas.calls.putImageData, 1);
  assert.equal(harness.getPersistCalls(), 1);
  assert.equal(harness.getPersisting(), false);
  assert.deepEqual(harness.commits, ['Заливка']);
});

test('selection clear keeps native high-depth samples and uses the shared reset bridge', async () => {
  const doc = createDocument({ width:2, height:1 });
  const layer = createRasterLayer({ name:'HDR', width:2, height:1, dataUrl:null });
  layer.highDepthSource = { model:'rgb' };
  addLayer(doc, layer);

  const buffer = createPixelBuffer({
    width:2,
    height:1,
    model:'rgb',
    channels:4,
    bitsPerChannel:32,
    colorSpace:'linear-rgb-unmanaged',
    data:new Float32Array([1,0,0,1, 0,1,0,1]),
  });
  const harness = makeHarness({
    doc,
    selectionActive:true,
    selectionPredicate:() => x => x === 1,
    selectionIntersects:() => true,
    highDepthBuffer:buffer,
  });

  assert.equal(await harness.controller.clearSelection(), true);
  assert.equal(buffer.data[3], 1);
  assert.equal(buffer.data[7], 0);
  assert.equal(harness.getHighDepthPersistCalls(), 1);
  assert.equal(harness.getHighDepthPersistArgs()[0][0], doc);
  assert.equal(harness.getHighDepthPersistArgs()[0][1], layer);
  assert.equal(harness.getHighDepthPersistArgs()[0][2], buffer);
  assert.equal(harness.getResetPaintStateCalls(), 1);
  assert.equal(harness.getPersistCalls(), 0);
  assert.equal(harness.getPersisting(), false);
  assert.deepEqual(harness.commits, ['Очистить выделение']);
});

test('fill raises the shared pending-edit guard before asynchronous raster preparation', async () => {
  const doc = createDocument({ width:4, height:1 });
  const layer = createRasterLayer({ name:'Async', width:4, height:1, dataUrl:null });
  addLayer(doc, layer);
  let releaseDecode;
  const harness = makeHarness({ doc });
  harness.rasterEdit.ensureRasterBuffer = function ensureRasterBuffer() {
    return new Promise(resolve => {
      releaseDecode = () => {
        this.brushCanvas = harness.canvas.canvas;
        this.brushContext = harness.canvas.context;
        resolve();
      };
    });
  };

  const pending = harness.controller.fillAt({ x:0, y:0 });
  assert.equal(harness.getPersisting(), true);
  assert.equal(typeof releaseDecode, 'function');
  releaseDecode();
  await pending;
  assert.equal(harness.getPersisting(), false);
});


test('native high-depth line, fill and selection clear suppress publication feedback when ownership becomes stale', async () => {
  const makeNative = ({ selectionActive = false, selectionPredicate = () => null } = {}) => {
    const doc = createDocument({ width:2, height:1 });
    const layer = createRasterLayer({ name:'HDR', width:2, height:1, dataUrl:null });
    layer.highDepthSource = { model:'rgb' };
    addLayer(doc, layer);
    const buffer = createPixelBuffer({
      width:2,
      height:1,
      model:'rgb',
      channels:4,
      bitsPerChannel:32,
      colorSpace:'linear-rgb-unmanaged',
      data:new Float32Array([0,0,0,1, 0,0,0,1]),
    });
    return {
      harness:makeHarness({
        doc,
        selectionActive,
        selectionPredicate,
        selectionIntersects:() => true,
        highDepthBuffer:buffer,
        highDepthPersistResult:false,
      }),
    };
  };

  {
    const { harness } = makeNative();
    assert.equal(await harness.controller.drawLine({ x:.5, y:.5 }, { x:1.5, y:.5 }), false);
    assert.equal(harness.getHighDepthPersistCalls(), 1);
    assert.deepEqual(harness.commits, []);
    assert.equal(harness.statuses.some(value => value.startsWith('Линия добавлена')), false);
    assert.equal(harness.getPersisting(), false);
  }

  {
    const { harness } = makeNative();
    assert.equal(await harness.controller.fillAt({ x:0, y:0 }), false);
    assert.equal(harness.getHighDepthPersistCalls(), 1);
    assert.deepEqual(harness.commits, []);
    assert.equal(harness.statuses.some(value => value.startsWith('High-depth заливка:')), false);
    assert.equal(harness.getPersisting(), false);
  }

  {
    const { harness } = makeNative({ selectionActive:true, selectionPredicate:() => () => true });
    assert.equal(await harness.controller.clearSelection(), false);
    assert.equal(harness.getHighDepthPersistCalls(), 1);
    assert.deepEqual(harness.commits, []);
    assert.equal(harness.statuses.some(value => value.includes('high-depth:')), false);
    assert.equal(harness.getPersisting(), false);
  }
});

test('selection clear accepts caller-owned target and frozen geometry',async()=>{
  const doc=createDocument({width:4,height:1}),layer=createRasterLayer({name:'P',width:4,height:1,dataUrl:null});addLayer(doc,layer);const snapshot={type:'ellipse',rect:{x:0,y:0,width:2,height:1}},seen=[];
  const h=makeHarness({doc,selectionActive:false,selectionIntersects:(l,s)=>{seen.push(s);return true;}});
  assert.equal(await h.controller.clearSelection({ownerDocument:doc,targetLayer:layer,selectionSnapshot:snapshot,historyLabel:'Clipboard cut'}),true);assert.deepEqual(seen,[snapshot]);assert.equal(h.clips[0][2],snapshot);assert.deepEqual(h.commits,['Clipboard cut']);
});
test('selection clear rejects caller target replaced by same id',async()=>{
  const doc=createDocument({width:4,height:1}),original=createRasterLayer({name:'O',width:4,height:1,dataUrl:null});addLayer(doc,original);const replacement={...original,name:'R'};doc.layers.splice(doc.layers.indexOf(original),1,replacement);doc.selectedLayerId=replacement.id;
  const h=makeHarness({doc,selected:()=>replacement});assert.equal(await h.controller.clearSelection({ownerDocument:doc,targetLayer:original,selectionSnapshot:{type:'rect',rect:{x:0,y:0,width:2,height:1}}}),false);assert.equal(h.getEnsureCalls().length,0);assert.deepEqual(h.commits,[]);
});


test('caller continuation ownership is forwarded into selected-layer Canvas persistence',async()=>{
  const doc=createDocument({width:4,height:1});
  const layer=createRasterLayer({name:'P',width:4,height:1,dataUrl:null});
  addLayer(doc,layer);
  let current=true,seenGuard=null;
  const h=makeHarness({
    doc,
    selectionActive:true,
    persistResult:(owner,target,options)=>{
      assert.equal(owner,doc);
      assert.equal(target,layer);
      seenGuard=options?.isContinuationCurrent;
      current=false;
      return false;
    },
  });
  assert.equal(await h.controller.clearSelection({
    ownerDocument:doc,
    targetLayer:layer,
    selectionSnapshot:{type:'rect',rect:{x:0,y:0,width:2,height:1}},
    isContinuationCurrent:()=>current,
  }),false);
  assert.equal(typeof seenGuard,'function');
  assert.equal(seenGuard(),false);
  assert.equal(h.rasterEdit.brushCanvas,null);
  assert.deepEqual(h.commits,[]);
  assert.equal(h.getPersisting(),false);
});


test('object removal uses its frozen brush mask without replacing the document selection',async()=>{
  const doc=createDocument({width:4,height:1});
  const layer=createRasterLayer({name:'Object',width:4,height:1,dataUrl:null});addLayer(doc,layer);
  const pixels=new Uint8ClampedArray([30,80,100,255, 255,0,0,255, 30,80,100,255, 30,80,100,255]);
  const h=makeHarness({doc,pixels,selectionActive:false,selectionIntersects:()=>false});
  assert.equal(await h.controller.contentAwareFill({ownerDocument:doc,ownerLayer:layer,isAllowed:x=>x===1,historyLabel:'Удалить объект'}),true);
  assert.deepEqual([...pixels],[30,80,100,255,30,80,100,255,30,80,100,255,30,80,100,255]);
  assert.deepEqual(h.commits,['Удалить объект']);
  assert.equal(h.getPersistCalls(),1);
});

test('object removal rejects a different document or same-id target before raster preparation',async()=>{
  const doc=createDocument({width:4,height:1});
  const layer=createRasterLayer({width:4,height:1,dataUrl:null});addLayer(doc,layer);
  const h=makeHarness({doc});
  assert.equal(await h.controller.contentAwareFill({ownerDocument:{...doc},ownerLayer:layer,isAllowed:()=>true}),false);
  assert.equal(await h.controller.contentAwareFill({ownerDocument:doc,ownerLayer:{...layer},isAllowed:()=>true}),false);
  assert.equal(h.getEnsureCalls().length,0); assert.deepEqual(h.commits,[]);
});

test('content-aware fill freezes selection geometry and persists Canvas8 exactly once',async()=>{
  const doc=createDocument({width:5,height:1});
  const layer=createRasterLayer({name:'Repair',width:5,height:1,dataUrl:null});addLayer(doc,layer);
  const pixels=new Uint8ClampedArray([10,20,30,255,20,30,40,255,250,0,0,255,220,230,240,255,230,240,250,255]);
  const snapshot={type:'rect',rect:{x:2,y:0,width:1,height:1}},seen=[];
  const h=makeHarness({doc,pixels,selectionActive:true,selectionSnapshot:snapshot,selectionPredicate:(target,captured)=>{assert.equal(target,layer);seen.push(captured);return x=>x===2;}});
  assert.equal(await h.controller.contentAwareFill(),true);
  assert.deepEqual(seen,[snapshot]);
  assert.deepEqual([...pixels.slice(8,12)],[120,130,140,255]);
  assert.equal(h.canvas.calls.putImageData,1);
  assert.equal(h.getPersistCalls(),1);
  assert.deepEqual(h.commits,['Контент-заливка']);
  assert.equal(h.getPersisting(),false);
});

test('content-aware fill keeps native high-depth CMYK samples and exact high-depth persistence',async()=>{
  const doc=createDocument({width:3,height:1});
  const layer=createRasterLayer({name:'CMYK',width:3,height:1,dataUrl:null});layer.highDepthSource={model:'cmyk'};addLayer(doc,layer);
  const buffer=createPixelBuffer({width:3,height:1,model:'cmyk',channels:5,bitsPerChannel:32,colorSpace:'cmyk-unmanaged',data:new Float32Array([.1,.2,.3,.4,1,9,9,9,9,1,.9,.8,.7,.6,1])});
  const h=makeHarness({doc,selectionActive:true,selectionSnapshot:{type:'rect',rect:{x:1,y:0,width:1,height:1}},selectionPredicate:()=>x=>x===1,highDepthBuffer:buffer});
  assert.equal(await h.controller.contentAwareFill(),true);
  assert.equal(h.getHighDepthPersistCalls(),1);
  assert.equal(h.getPersistCalls(),0);
  assert.equal(h.getResetPaintStateCalls(),1);
  assert.deepEqual(h.commits,['Контент-заливка']);
  for(let channel=5;channel<9;channel+=1) assert.ok(Math.abs(buffer.data[channel]-.5)<1e-6);
  assert.equal(h.getPersisting(),false);
});


test('Stage 17b line and selection clear prefer the tiled mutation bridge over contiguous materialization',async()=>{
  const doc=createDocument({width:2,height:1});
  const layer=createRasterLayer({name:'Tiled HDR',width:2,height:1,dataUrl:null});
  layer.highDepthSource={kind:'zpe-pixel-buffer-source-v2',model:'rgb'};
  addLayer(doc,layer);
  const h=makeHarness({
    doc,selectionActive:true,selectionPredicate:()=>()=>true,selectionIntersects:()=>true,
    tiledPersistResult:{changed:2,changedTiles:1,applied:true,stale:false},
  });
  h.rasterEdit.editableHighDepthBuffer=()=>{throw new Error('contiguous high-depth fallback must not run');};
  assert.equal(await h.controller.drawLine({x:.5,y:.5},{x:1.5,y:.5}),true);
  assert.equal(await h.controller.clearSelection(),true);
  assert.equal(h.getTiledPersistCalls(),2);
  assert.equal(h.getHighDepthPersistCalls(),0);
  assert.equal(typeof h.getTiledPersistArgs()[0][2],'function');
  assert.equal(h.getTiledPersistArgs()[1][3].requireAlpha,true);
  assert.deepEqual(h.commits,['Нарисовать линию','Очистить выделение']);
  assert.equal(h.getPersisting(),false);
});

test('Stage 003: native tiled Content-Aware Fill uses the ROI owner, never contiguous fallback, and commits once', async () => {
  const doc = createDocument({ width:4, height:1 });
  const layer = createRasterLayer({ name:'Tiled', width:4, height:1, dataUrl:null });
  layer.highDepthSource = { kind:'zpe-pixel-buffer-source-v2', model:'rgb' };
  addLayer(doc, layer);
  const h = makeHarness({
    doc,
    selectionActive:true,
    selectionPredicate:()=>x => x === 1,
  });
  h.rasterEdit.editableHighDepthBuffer = () => { throw Error('full-plane decode is forbidden'); };
  const calls = [];
  h.rasterEdit.persistTiledHighDepthInpaint = async (owner, target, options) => {
    calls.push([owner, target, options]);
    return { changed:1, filled:1, changedTiles:1, applied:true, stale:false };
  };
  assert.equal(await h.controller.contentAwareFill(), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], doc);
  assert.equal(calls[0][1], layer);
  assert.equal(calls[0][2].isAllowed(1, 0), true);
  assert.equal(calls[0][2].isAllowed(0, 0), false);
  assert.deepEqual(h.commits, ['Контент-заливка']);
  assert.equal(h.getHighDepthPersistCalls(), 0);
  assert.equal(h.getResetPaintStateCalls(), 1);
  assert.equal(h.getPersisting(), false);

  h.rasterEdit.persistTiledHighDepthInpaint = async () => ({
    changed:1, filled:1, changedTiles:1, applied:false, stale:true,
  });
  assert.equal(await h.controller.contentAwareFill(), false);
  assert.deepEqual(h.commits, ['Контент-заливка']);
  assert.equal(h.getPersisting(), false);
});
