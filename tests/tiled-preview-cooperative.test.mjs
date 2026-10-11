import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, forEachSerializedPixelBufferTile,
  forEachSerializedPixelBufferTileCooperative,
  inpaintTiledPixelBufferSourceFromIndices,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { createRasterEditController } from '../src/painting/controller.js';

function makeSource({model='rgb', bitsPerChannel=16} = {}) {
  const width = 16, height = 16;
  const channels = model === 'cmyk' ? 5 : 4;
  const Typed = bitsPerChannel === 32 ? Float32Array : Uint16Array;
  const data = new Typed(width * height * channels);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      data[pixel * channels + channel] = bitsPerChannel === 32
        ? (channel === channels - 1 ? 1 : .1 * (channel + 1))
        : (channel === channels - 1 ? 65535 : 9000 * (channel + 1));
    }
  }
  const damage = (7 * width + 7) * channels;
  data[damage] = bitsPerChannel === 32 ? 0.99 : 63000;
  return serializeTiledPixelBufferSource(createPixelBuffer({
    width, height, channels, model, bitsPerChannel,
    colorSpace:model === 'rgb' ? 'srgb' : 'device-cmyk', data,
  }), {tileSize:4});
}

test('Stage 003: cooperative tiled preview iteration preserves RGB16/CMYKA Float32 pixel and tile order', async () => {
  for (const options of [{model:'rgb',bitsPerChannel:16},{model:'cmyk',bitsPerChannel:32}]) {
    const source = makeSource(options);
    const snapshot = JSON.stringify(source), sync = [], asyncVisited = [];
    forEachSerializedPixelBufferTile(source, item => sync.push([item.x,item.y,item.width,item.height,[...item.buffer.data]]));
    let yields = 0;
    const completed = await forEachSerializedPixelBufferTileCooperative(source, item => {
      asyncVisited.push([item.x,item.y,item.width,item.height,[...item.buffer.data]]);
    }, {batchTiles:2, yieldControl:async () => { yields++; }});
    assert.equal(completed,true);
    assert.equal(yields,7);
    assert.deepEqual(asyncVisited,sync);
    assert.equal(JSON.stringify(source),snapshot);
  }
});

test('Stage 003: cancelled preview drops remaining native tiles; callbacks and source stay unchanged', async () => {
  const source = makeSource({model:'cmyk',bitsPerChannel:32});
  const before = JSON.stringify(source), visited = [];
  let cancelled = false, yields = 0;
  const completed = await forEachSerializedPixelBufferTileCooperative(source, item => {
    visited.push(item.index);
  }, {
    batchTiles:2, isCancelled:() => cancelled,
    yieldControl:async () => { yields++; cancelled = true; },
  });
  assert.equal(completed,false);
  assert.equal(yields,1);
  assert.deepEqual(visited,[0,1]);
  assert.equal(JSON.stringify(source),before);
  await assert.rejects(forEachSerializedPixelBufferTileCooperative(source,()=>{},{batchTiles:0}),/invalid callbacks/);
});

function canvasHarness({ onEncode = () => {} } = {}) {
  let encoded = 0, rendered = 0;
  return {
    documentRef:{
      createElement(tag) {
        assert.equal(tag,'canvas');
        return {
          width:0,height:0,
          getContext:() => ({
            createImageData:(w,h) => ({data:new Uint8ClampedArray(w*h*4)}),
            putImageData() { rendered++; },
          }),
          toDataURL() { encoded++; onEncode(); return 'data:image/png;base64,preview'; },
        };
      },
    },
    counts:() => ({encoded,rendered}),
  };
}

test('Stage 003: owner switch during tiled RGBA8 conversion discards partial canvas and native source', async () => {
  const source = makeSource();
  const before = JSON.stringify(source);
  const layer = {id:'a',name:'A',type:'raster',locked:false,groupId:null,
    width:16,height:16,highDepthSource:source,dataUrl:'data:image/png;base64,old',
    highDepthPreview:null,filters:{}};
  const owner = {width:16,height:16,layers:[layer],groups:[]};
  let current = owner, checkpoints = 0;
  const harness = canvasHarness();
  const editor = createRasterEditController({
    getDocument:() => current,
    documentRef:harness.documentRef,
    tiledInpaintWorker:{
      async run(job) { return inpaintTiledPixelBufferSourceFromIndices(job.source,job); },
      cancel() {},
    },
    previewYieldControl:async () => {
      checkpoints++;
      current = {width:16,height:16,layers:[],groups:[]};
    },
  });
  const outcome = await editor.persistTiledHighDepthInpaint(owner,layer,{
    isAllowed:(x,y) => x===7 && y===7,
  });
  assert.ok(checkpoints>=1);
  assert.equal(outcome.stale,true);
  assert.equal(outcome.applied,false);
  assert.equal(harness.counts().encoded,0);
  assert.equal(harness.counts().rendered,2);
  assert.equal(layer.highDepthSource,source);
  assert.equal(JSON.stringify(source),before);
  assert.equal(layer.dataUrl,'data:image/png;base64,old');
});

test('Stage 003: completed tiled preview publishes once with original high-depth precision', async () => {
  const source = makeSource({model:'cmyk',bitsPerChannel:32});
  const layer = {id:'a',name:'A',type:'raster',locked:false,groupId:null,
    width:16,height:16,highDepthSource:source,dataUrl:null,highDepthPreview:null,filters:{}};
  const owner = {width:16,height:16,layers:[layer],groups:[]};
  const harness = canvasHarness();
  let checkpoints = 0;
  const editor = createRasterEditController({
    getDocument:() => owner, documentRef:harness.documentRef,
    tiledInpaintWorker:{
      async run(job) { return inpaintTiledPixelBufferSourceFromIndices(job.source,job); },
      cancel() {},
    },
    previewYieldControl:async () => { checkpoints++; },
  });
  const result = await editor.persistTiledHighDepthInpaint(owner,layer,{
    isAllowed:(x,y)=>x===7&&y===7,
  });
  assert.equal(result.applied,true);
  assert.equal(result.changed,1);
  assert.equal(harness.counts().encoded,1);
  assert.equal(harness.counts().rendered,16);
  assert.equal(checkpoints,7);
  assert.notEqual(layer.highDepthSource,source);
  assert.equal(layer.highDepthSource.bitsPerChannel,32);
  assert.equal(layer.highDepthSource.model,'cmyk');
  assert.equal(layer.dataUrl,'data:image/png;base64,preview');
});

function tiledMutation(layer, editor, owner, options = {}) {
  return editor.persistTiledHighDepthMutation(owner,layer,({x,buffer})=>{
    if(x)return 0;
    buffer.data[0]=12345;
    return 1;
  },options);
}

test('Stage 003: new same-layer source during cooperative tiled preview cancels before PNG',async()=>{
  const source=makeSource(),newer=makeSource({model:'cmyk',bitsPerChannel:32});
  const layer={id:'a',name:'A',type:'raster',locked:false,groupId:null,width:16,height:16,
    highDepthSource:source,dataUrl:'data:image/png;base64,old',highDepthPreview:null,filters:{}};
  const owner={width:16,height:16,layers:[layer],groups:[]},harness=canvasHarness();
  let checkpoints=0;
  const editor=createRasterEditController({getDocument:()=>owner,documentRef:harness.documentRef,
    previewYieldControl:async()=>{if(++checkpoints===1){
      layer.highDepthSource=newer;
      layer.dataUrl='data:image/png;base64,newer';
    }},
  });
  const result=await tiledMutation(layer,editor,owner);
  assert.ok(checkpoints>=1);
  assert.equal(result.applied,false);
  assert.equal(result.stale,true);
  assert.equal(result.changed,1);
  assert.equal(harness.counts().encoded,0);
  assert.equal(layer.highDepthSource,newer);
  assert.equal(layer.dataUrl,'data:image/png;base64,newer');
});

test('Stage 003: source superseded during PNG encoding cannot overwrite newer tiled pixels',async()=>{
  const source=makeSource(),newer=makeSource({model:'cmyk',bitsPerChannel:32});
  const layer={id:'a',name:'A',type:'raster',locked:false,groupId:null,width:16,height:16,
    highDepthSource:source,dataUrl:'data:image/png;base64,old',highDepthPreview:null,filters:{}};
  const owner={width:16,height:16,layers:[layer],groups:[]};
  const harness=canvasHarness({onEncode:()=>{layer.highDepthSource=newer;
    layer.dataUrl='data:image/png;base64,newer';}});
  const editor=createRasterEditController({getDocument:()=>owner,
    documentRef:harness.documentRef,previewYieldControl:async()=>{}});
  const result=await tiledMutation(layer,editor,owner);
  assert.equal(harness.counts().encoded,1);
  assert.equal(result.applied,false);
  assert.equal(result.stale,true);
  assert.equal(layer.highDepthSource,newer);
  assert.equal(layer.dataUrl,'data:image/png;base64,newer');
});

test('Stage 003: revoked continuation abandons unfinished tiled preview without PNG',async()=>{
  const source=makeSource();
  const layer={id:'a',name:'A',type:'raster',locked:false,groupId:null,width:16,height:16,
    highDepthSource:source,dataUrl:'data:image/png;base64,old',highDepthPreview:null,filters:{}};
  const owner={width:16,height:16,layers:[layer],groups:[]},harness=canvasHarness();
  let current=true,checkpoints=0;
  const editor=createRasterEditController({getDocument:()=>owner,documentRef:harness.documentRef,
    previewYieldControl:async()=>{current=false;checkpoints++;}});
  const result=await tiledMutation(layer,editor,owner,{isContinuationCurrent:()=>current});
  assert.ok(checkpoints>=1);
  assert.equal(result.applied,false);
  assert.equal(result.stale,true);
  assert.equal(harness.counts().encoded,0);
  assert.equal(layer.highDepthSource,source);
  assert.equal(layer.dataUrl,'data:image/png;base64,old');
});
