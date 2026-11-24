import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPixelBuffer,serializeTiledPixelBufferSource} from '../src/core/pixel-buffer.js';
import {bytesToDataUrl,dataUrlToBytes} from '../src/core/io.js';
import {createRasterCommandController} from '../src/painting/command-controller.js';
import {createRasterEditController} from '../src/painting/controller.js';

function deferred(){
  let resolve;
  const promise=new Promise(done=>{resolve=done;});
  return {promise,resolve};
}
function sampleDocument(){
  const samples=new Uint16Array(4*4*4);
  for(let i=0;i<16;i++)samples.set([22000,30000,37000,65535],i*4);
  const source=serializeTiledPixelBufferSource(createPixelBuffer({
    width:4,height:4,model:'rgb',channels:4,bitsPerChannel:16,
    colorSpace:'srgb',data:samples,
  }),{tileSize:2});
  const layer={id:'photo',type:'raster',name:'Photo',width:4,height:4,
    highDepthSource:source,highDepthPreview:null,dataUrl:'data:image/png;base64,old',
    filters:{},locked:false,groupId:null};
  const doc={id:'document',width:4,height:4,layers:[layer],groups:[],selectedLayerId:layer.id};
  return {doc,layer,source};
}

test('037C-3b-2b/3: explicit cancel revokes generation/lease; late result cannot commit or unlock new job',async()=>{
  const {doc,layer}=sampleDocument();
  const pending=[],commits=[];
  let cancelledWorker=0,currentLease=null,paintReset=0;
  const rasterEdit={
    clearBrushBuffer(){},
    cancelTiledInpaint(){cancelledWorker++;},
    editableHighDepthBuffer(){throw Error('no contiguous fallback');},
    persistTiledHighDepthInpaint(owner,target,options){
      assert.equal(owner,doc);assert.equal(target,layer);
      assert.equal(options.isAllowed(1,1),true);
      const next=deferred();
      pending.push({next,guard:options.isContinuationCurrent});
      return next.promise;
    },
  };
  const commands=createRasterCommandController({
    rasterEdit,
    state:{
      getDocument:()=>doc,isPersisting:()=>currentLease!==null,
      beginPersist:()=>currentLease?false:(currentLease={}),
      endPersist:lease=>{if(currentLease===lease)currentLease=null;},
      resetPaintState:()=>{paintReset++;},
    },
    target:{
      selected:()=>layer,atPoint:()=>layer,
      isEditableRasterLayer:value=>value===layer,toLocal:point=>point,
    },
    selection:{
      captureSnapshot:()=>({type:'rect'}),intersectsLayer:()=>true,predicate:()=>()=>true,
    },
    tools:{
      primaryColor:()=> '#000000',brushSize:()=>1,opacity:()=>1,
      fillTolerance:()=>0,rgbToCmyk:()=>[0,0,0,0],
    },
    ui:{setStatus(){},commit:value=>commits.push(value)},
  });
  assert.equal(commands.cancelPendingContentAwareFill(),false);
  const first=commands.contentAwareFill({isAllowed:(x,y)=>x===1&&y===1});
  assert.equal(pending.length,1);
  assert.equal(pending[0].guard(),true);
  assert.equal(commands.cancelPendingContentAwareFill(),true);
  assert.equal(commands.cancelPendingContentAwareFill(),false);
  assert.equal(pending[0].guard(),false);
  assert.equal(currentLease,null);
  assert.equal(cancelledWorker,1);

  const second=commands.contentAwareFill({isAllowed:(x,y)=>x===1&&y===1});
  assert.equal(pending.length,2);
  assert.equal(pending[1].guard(),true);
  const newerLease=currentLease;
  pending[0].next.resolve({changed:1,filled:1,changedTiles:1,applied:true,stale:false});
  assert.equal(await first,false);
  assert.equal(currentLease,newerLease,'old finally cannot release a newer lease');
  assert.deepEqual(commits,[]);
  pending[1].next.resolve({changed:1,filled:1,changedTiles:1,applied:true,stale:false});
  assert.equal(await second,true);
  assert.equal(currentLease,null);
  assert.deepEqual(commits,['Контент-заливка']);
  assert.equal(paintReset,1);
  assert.equal(commands.cancelPendingContentAwareFill(),false);
});

test('037C-3b-2b/3: completed native Worker cannot publish tiles while preview awaits after cancel',async()=>{
  const {doc,layer,source}=sampleDocument();
  const originalPreview=layer.dataUrl;
  const enteredPreview=deferred(),resumePreview=deferred();
  let current=true,workerRuns=0;
  const worker={
    cancel(){return false;}, // Worker already replied; only publication guard can help.
    async run(job){
      workerRuns++;
      assert.deepEqual([...job.selectedIndices],[5]);
      // Protocol-valid RGBA16 byte mutation isolates the post-Worker preview race.
      const tiles=job.source.tiles.map(tile=>({...tile}));
      const bytes=dataUrlToBytes(tiles[0].dataUrl,{maxBytes:tiles[0].rawBytes});
      bytes[3*8]^=1; // x=1,y=1 in first 2x2 RGBA16 tile
      tiles[0].dataUrl=bytesToDataUrl(bytes,'application/x-zeter-pixel-buffer-tile');
      return {source:{...job.source,tiles},changed:1,filled:1,changedTiles:1,loadedTiles:1};
    },
  };
  const docRef={createElement(tag){
    assert.equal(tag,'canvas');
    return {width:0,height:0,toDataURL:()=> 'data:image/png;base64,next',
      getContext:()=>({
        createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
        putImageData(){},
      }),
    };
  }};
  let yields=0;
  const paint=createRasterEditController({
    getDocument:()=>doc,documentRef:docRef,tiledInpaintWorker:worker,
    previewYieldControl:()=>{yields++;enteredPreview.resolve();return resumePreview.promise;},
  });
  const options={isAllowed:(x,y)=>x===1&&y===1,isContinuationCurrent:()=>current};
  const first=paint.persistTiledHighDepthInpaint(doc,layer,options);
  await enteredPreview.promise;
  assert.equal(workerRuns,1);
  assert.ok(yields>=1);
  current=false;
  resumePreview.resolve();
  const stopped=await first;
  assert.equal(stopped.applied,false);assert.equal(stopped.stale,true);
  assert.equal(layer.highDepthSource,source);
  assert.equal(layer.dataUrl,originalPreview);
  current=true;
  const fresh=await paint.persistTiledHighDepthInpaint(doc,layer,options);
  assert.equal(fresh.applied,true);assert.equal(fresh.stale,false);
  assert.equal(workerRuns,2);
  assert.notEqual(layer.highDepthSource,source);
  assert.equal(layer.dataUrl,'data:image/png;base64,next');
});

test('037C-3b-2b/3: public Escape cancellation precedes object-mask reset and deselection',async()=>{
  const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  const keydown=main.slice(main.indexOf("window.addEventListener('keydown'"),
    main.indexOf("window.addEventListener('keyup'"));
  const cancel=keydown.indexOf('rasterCommands.cancelPendingContentAwareFill()');
  assert.ok(cancel>keydown.indexOf('if(cropGestures.hasDraft())'));
  assert.ok(cancel<keydown.indexOf('if(toolRemoval().hasMask())'));
  assert.ok(cancel<keydown.indexOf('if(selectionRect){deselectPixels()'));
  assert.match(keydown,/setStatus\('Контент-заливка отменена'\)/);
  assert.match(keydown,/!pointerLifecycle\?\.hasActivePointer\(\)/);
});
