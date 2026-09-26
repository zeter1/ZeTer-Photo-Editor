import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/core/state.js';
import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { createPsdImportController } from '../src/document/psd-import-controller.js';

function parsedRgb16() {
  return {
    width:2,height:1,colorMode:3,bitsPerChannel:16,warnings:[],
    fillLayers:[],adjustmentLayers:[],groups:[{
      key:'group-1',parentKey:null,name:'Imported group',visible:true,collapsed:false,
      opacity:0.75,blendMode:'pass-through',
    }],
    paths:[{name:'Saved path',resourceId:2000,subpaths:[]}],
    linkedLayerBlocks:[],iccProfile:null,iccUntagged:false,
    composite:null,compositePixelBuffer:null,
    layers:[{
      name:'Pixels',x:0,y:0,width:2,height:1,visible:true,opacity:1,
      blendMode:'source-over',clipping:false,groupKey:'group-1',stackIndex:0,
      transparencyProtected:false,mask:null,vectorMask:null,
      psdText:null,psdShape:null,psdSmartObject:null,
      pixelBuffer:createPixelBuffer({
        width:2,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',
        data:new Uint16Array([65535,0,0,65535, 0,32768,65535,65535]),
      }),
    }],
  };
}

function harness({ decodePsd=async()=>parsedRgb16() }={}) {
  const original=createDocument({name:'Original',width:4,height:4});
  original.proofProfile={kind:'untagged',untagged:true};
  let current=original;
  const historyEntry={id:'history'};
  let sessionId='session-1';
  let changeSerial=1;
  const published=[];
  const statuses=[];
  const toasts=[];
  const controller=createPsdImportController({
    codec:{decodePsd},
    runtime:{
      getDocument:()=>current,
      getActiveSessionId:()=>sessionId,
      getHistoryEntry:()=>historyEntry,
      getChangeSerial:()=>changeSerial,
      canReplaceDocument:()=>true,
      blockPendingDocumentEdit:()=>false,
      publishDocument:(next,meta)=>published.push({next,meta}),
    },
    profiles:{profileBytes:()=>null},
    rendering:{rgbaPixelsToDataUrl:async()=> 'data:image/png;base64,AAAA'},
    semantics:{
      importPsdAdjustmentMetadata:()=>null,
      importPsdVectorMask:()=>null,
      canMapPsdSolidShape:()=>false,
      importPsdEmbeddedAssetDocument:async()=>null,
      importPsdShapeMetadata:()=>null,
      importPsdTextMetadata:()=>null,
      importPsdSmartObjectMetadata:()=>null,
      psdOpaqueBlockToState:block=>block,
    },
    ui:{
      setStatus:value=>statuses.push(value),
      toast:(message,type)=>toasts.push({message,type}),
      alert:()=>{},
      consoleRef:{warn:()=>{},error:()=>{}},
    },
  });
  return {
    controller,original,published,statuses,toasts,
    setCurrent:value=>{current=value;},
    setSession:value=>{sessionId=value;},
    bumpChange:()=>{changeSerial+=1;},
  };
}

function file(name='sample.psd') {
  return {name,size:1024,arrayBuffer:async()=>new ArrayBuffer(8)};
}

test('decoded RGB16 payload maps to canonical layers/groups/paths while preserving native precision', async () => {
  const h=harness();
  await h.controller.open(file());

  assert.equal(h.published.length,1);
  const {next,meta}=h.published[0];
  assert.equal(meta.label,'Импорт PSD/PSB');
  assert.equal(next.name,'sample');
  assert.equal(next.layers.length,1);
  assert.equal(next.layers[0].type,'raster');
  assert.equal(next.layers[0].highDepthSource.bitsPerChannel,16);
  assert.equal(next.layers[0].groupId,next.groups[0].id);
  assert.equal(next.groups[0].name,'Imported group');
  assert.equal(next.groups[0].opacity,0.75);
  assert.equal(next.paths.length,1);
  assert.equal(next.paths[0].name,'Saved path');
  assert.equal(next.selectedLayerId,next.layers[0].id);
  assert.deepEqual(next.proofProfile,h.original.proofProfile);
  assert.ok(h.toasts.some(item=>item.message.includes('PSD/PSB открыт')));
});

test('late decode never publishes into a different document/session context', async () => {
  let release;
  const decoded=new Promise(resolve=>{ release=resolve; });
  const h=harness({decodePsd:()=>decoded});
  const opening=h.controller.open(file('late.psb'));
  h.setCurrent(createDocument({name:'Other'}));
  h.setSession('session-2');
  release(parsedRgb16());
  await opening;

  assert.equal(h.published.length,0);
  assert.ok(h.statuses.some(value=>value.includes('Импорт PSD/PSB отменён')));
  assert.ok(h.toasts.some(item=>item.type==='warn'));
});

test('oversized PSD/PSB is rejected before codec work starts', async () => {
  let decodeCalls=0;
  const h=harness({decodePsd:async()=>{decodeCalls+=1;return parsedRgb16();}});
  await h.controller.open({name:'huge.psb',size:513*1024*1024,arrayBuffer:async()=>new ArrayBuffer(0)});
  assert.equal(decodeCalls,0);
  assert.equal(h.published.length,0);
  assert.ok(h.statuses.some(value=>value.includes('512 МБ')));
});
