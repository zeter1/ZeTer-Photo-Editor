import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/core/state.js';
import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { createPsdImportController } from '../src/document/psd-import-controller.js';

function deferred() {
  let resolve,reject;
  const promise = new Promise((done,fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

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

function harness({
  decodePsd=async()=>parsedRgb16(),
  rgbaPixelsToDataUrl=async()=> 'data:image/png;base64,AAAA',
  importPsdEmbeddedAssetDocument=async()=>null,
  canReplaceDocument=()=>true,
  blockPendingDocumentEdit=()=>false,
}={}) {
  const original=createDocument({name:'Original',width:4,height:4});
  original.proofProfile={kind:'untagged',untagged:true};
  let current=original;
  let historyEntry={id:'history'};
  let sessionId='session-1';
  let changeSerial=1;
  let replaceChecks=0;
  const published=[];
  const statuses=[];
  const toasts=[];
  const alerts=[];
  const errors=[];
  const controller=createPsdImportController({
    codec:{decodePsd},
    runtime:{
      getDocument:()=>current,
      getActiveSessionId:()=>sessionId,
      getHistoryEntry:()=>historyEntry,
      getChangeSerial:()=>changeSerial,
      canReplaceDocument:()=>{replaceChecks+=1;return canReplaceDocument();},
      blockPendingDocumentEdit,
      publishDocument:(next,meta)=>published.push({next,meta}),
    },
    profiles:{profileBytes:()=>null},
    rendering:{rgbaPixelsToDataUrl},
    semantics:{
      importPsdAdjustmentMetadata:()=>null,
      importPsdVectorMask:()=>null,
      canMapPsdSolidShape:()=>false,
      importPsdEmbeddedAssetDocument,
      importPsdShapeMetadata:()=>null,
      importPsdTextMetadata:()=>null,
      importPsdSmartObjectMetadata:()=>null,
      psdOpaqueBlockToState:block=>block,
    },
    ui:{
      setStatus:value=>statuses.push(value),
      toast:(message,type)=>toasts.push({message,type}),
      alert:message=>alerts.push(message),
      consoleRef:{warn:()=>{},error:(...args)=>errors.push(args)},
    },
  });
  return {
    controller,original,published,statuses,toasts,alerts,errors,
    setCurrent:value=>{current=value;},
    setSession:value=>{sessionId=value;},
    setHistoryEntry:value=>{historyEntry=value;},
    bumpChange:()=>{changeSerial+=1;},
    getReplaceChecks:()=>replaceChecks,
  };
}

function file(name='sample.psd') {
  return {name,size:1024,arrayBuffer:async()=>new ArrayBuffer(8)};
}

function assertStaleImport(h) {
  assert.equal(h.published.length,0);
  assert.equal(h.statuses.at(-1),'Импорт PSD/PSB отменён: документ изменился во время декодирования');
  assert.deepEqual(h.toasts.at(-1),{
    message:'Повторите импорт PSD/PSB в нужной вкладке',
    type:'warn',
  });
}

test('decoded RGB16 payload maps to canonical layers/groups/paths while preserving native precision', async () => {
  const h=harness();
  await h.controller.open(file());

  assert.equal(h.getReplaceChecks(),1);
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
  const decode=deferred();
  const started=deferred();
  const h=harness({decodePsd:()=>{
    started.resolve();
    return decode.promise;
  }});
  const opening=h.controller.open(file('late.psb'));
  await started.promise;
  h.setCurrent(createDocument({name:'Other'}));
  h.setSession('session-2');
  decode.resolve(parsedRgb16());
  await opening;

  assertStaleImport(h);
});

test('late decode rejects a new change epoch on the same document and session', async () => {
  const decode=deferred();
  const started=deferred();
  const h=harness({decodePsd:()=>{
    started.resolve();
    return decode.promise;
  }});
  const opening=h.controller.open(file('same-document.psd'));
  await started.promise;
  h.bumpChange();
  decode.resolve(parsedRgb16());
  await opening;

  assertStaleImport(h);
});

test('late decode rejects replacement of the same-document history owner', async () => {
  const decode=deferred();
  const started=deferred();
  const h=harness({decodePsd:()=>{
    started.resolve();
    return decode.promise;
  }});
  const opening=h.controller.open(file('history-owner.psd'));
  await started.promise;
  h.setHistoryEntry({id:'replacement-history'});
  decode.resolve(parsedRgb16());
  await opening;

  assertStaleImport(h);
});

test('late raster preparation rejects a change epoch that advances after decode', async () => {
  const encoding=deferred();
  const encodingStarted=deferred();
  const h=harness({
    rgbaPixelsToDataUrl:()=>{
      encodingStarted.resolve();
      return encoding.promise;
    },
  });
  const opening=h.controller.open(file('late-raster.psd'));
  await encodingStarted.promise;
  h.bumpChange();
  encoding.resolve('data:image/png;base64,AAAA');
  await opening;

  assertStaleImport(h);
});


test('newer authorized PSD import supersedes an older decode before publication', async () => {
  const decodeA=deferred();
  const decodeB=deferred();
  const startedA=deferred();
  const startedB=deferred();
  let calls=0;
  const h=harness({decodePsd:()=>{
    calls+=1;
    if(calls===1){startedA.resolve();return decodeA.promise;}
    startedB.resolve();return decodeB.promise;
  }});

  const openingA=h.controller.open(file('a.psd'));
  await startedA.promise;
  const openingB=h.controller.open(file('b.psd'));
  await startedB.promise;

  decodeA.resolve(parsedRgb16());
  await openingA;
  assert.equal(h.published.length,0);

  decodeB.resolve(parsedRgb16());
  await openingB;
  assert.equal(h.published.length,1);
  assert.equal(h.published[0].next.name,'b');
});

test('late superseded PSD completion cannot overwrite newer success UI', async () => {
  const decodeA=deferred();
  const decodeB=deferred();
  const startedA=deferred();
  const startedB=deferred();
  let calls=0;
  const h=harness({decodePsd:()=>{
    calls+=1;
    if(calls===1){startedA.resolve();return decodeA.promise;}
    startedB.resolve();return decodeB.promise;
  }});

  const openingA=h.controller.open(file('old.psd'));
  await startedA.promise;
  const openingB=h.controller.open(file('new.psd'));
  await startedB.promise;

  decodeB.resolve(parsedRgb16());
  await openingB;
  const finalStatus=h.statuses.at(-1);
  const finalToasts=structuredClone(h.toasts);
  const finalAlerts=structuredClone(h.alerts);
  const finalErrors=structuredClone(h.errors);

  decodeA.resolve(parsedRgb16());
  await openingA;

  assert.equal(h.published.length,1);
  assert.equal(h.published[0].next.name,'new');
  assert.equal(h.statuses.at(-1),finalStatus);
  assert.deepEqual(h.toasts,finalToasts);
  assert.deepEqual(h.alerts,finalAlerts);
  assert.deepEqual(h.errors,finalErrors);
});

test('superseded PSD failure is silent while the newer import remains authoritative', async () => {
  const decodeA=deferred();
  const decodeB=deferred();
  const startedA=deferred();
  const startedB=deferred();
  let calls=0;
  const h=harness({decodePsd:()=>{
    calls+=1;
    if(calls===1){startedA.resolve();return decodeA.promise;}
    startedB.resolve();return decodeB.promise;
  }});

  const openingA=h.controller.open(file('old-error.psd'));
  await startedA.promise;
  const openingB=h.controller.open(file('new-ok.psd'));
  await startedB.promise;

  decodeA.reject(new Error('superseded decode failure'));
  await openingA;
  assert.equal(h.published.length,0);
  assert.equal(h.alerts.length,0);
  assert.equal(h.errors.length,0);
  assert.equal(h.toasts.some(item=>item.type==='error'),false);
  assert.notEqual(h.statuses.at(-1),'Ошибка импорта PSD/PSB');

  decodeB.resolve(parsedRgb16());
  await openingB;
  assert.equal(h.published.length,1);
  assert.equal(h.published[0].next.name,'new-ok');
});

test('failed newer PSD import keeps authority over older late success and failure', async () => {
  for (const olderOutcome of ['success','failure']) {
    const olderDecode=deferred();
    const newerDecode=deferred();
    const olderStarted=deferred();
    const newerStarted=deferred();
    let calls=0;
    const h=harness({decodePsd:()=>{
      calls+=1;
      if(calls===1){olderStarted.resolve();return olderDecode.promise;}
      newerStarted.resolve();
      return newerDecode.promise;
    }});

    const olderOpen=h.controller.open(file(`older-${olderOutcome}.psd`));
    await olderStarted.promise;
    const newerOpen=h.controller.open(file('newer-corrupt.psd'));
    await newerStarted.promise;

    newerDecode.reject(new Error('newer decode rejected'));
    await newerOpen;
    assert.equal(calls,2);
    assert.equal(h.published.length,0);
    assert.equal(h.statuses.at(-1),'Ошибка импорта PSD/PSB');
    assert.equal(h.alerts.length,1);
    assert.match(h.alerts[0],/newer decode rejected/);
    assert.equal(h.toasts.at(-1)?.type,'error');
    assert.equal(h.errors.length,1);
    assert.equal(h.errors[0][1].name,'newer-corrupt.psd');

    const statuses=structuredClone(h.statuses);
    const toasts=structuredClone(h.toasts);
    const alerts=structuredClone(h.alerts);
    const loggedError=h.errors[0][1].error;
    if(olderOutcome==='failure'){
      olderDecode.reject(new Error('superseded decode rejected'));
    }else{
      olderDecode.resolve(parsedRgb16());
    }
    await olderOpen;

    assert.equal(h.published.length,0,`older ${olderOutcome} must not publish a document`);
    assert.deepEqual(h.statuses,statuses,`older ${olderOutcome} must not append or replace status`);
    assert.deepEqual(h.toasts,toasts,`older ${olderOutcome} must not replace toasts`);
    assert.deepEqual(h.alerts,alerts,`older ${olderOutcome} must not replace alert`);
    assert.equal(h.errors.length,1,`older ${olderOutcome} must not log another error`);
    assert.strictEqual(h.errors[0][1].error,loggedError);
  }
});


test('failed newer PSD import cannot be overwritten by older delayed raster success or failure', async () => {
  for (const olderOutcome of ['success','failure']) {
    const raster=deferred();
    const rasterStarted=deferred();
    const newerDecode=deferred();
    const newerStarted=deferred();
    let decodes=0;
    const h=harness({
      decodePsd:()=>{
        decodes+=1;
        if(decodes===1)return parsedRgb16();
        newerStarted.resolve();
        return newerDecode.promise;
      },
      rgbaPixelsToDataUrl:()=>{
        rasterStarted.resolve();
        return raster.promise;
      },
    });

    const olderOpen=h.controller.open(file(`older-raster-${olderOutcome}.psd`));
    await rasterStarted.promise;
    const newerOpen=h.controller.open(file('newer-corrupt-raster.psb'));
    await newerStarted.promise;

    newerDecode.reject(new Error('newer decode rejected during older raster preparation'));
    await newerOpen;
    assert.equal(decodes,2);
    assert.equal(h.published.length,0);
    assert.equal(h.statuses.at(-1),'Ошибка импорта PSD/PSB');
    assert.equal(h.errors.length,1);
    assert.equal(h.errors[0][1].name,'newer-corrupt-raster.psb');

    const statuses=structuredClone(h.statuses);
    const toasts=structuredClone(h.toasts);
    const alerts=structuredClone(h.alerts);
    const newerError=h.errors[0][1].error;
    if(olderOutcome==='failure'){
      raster.reject(new Error('superseded raster encode rejected'));
    }else{
      raster.resolve('data:image/png;base64,AAAA');
    }
    await olderOpen;

    assert.equal(h.published.length,0,`older raster ${olderOutcome} must not publish`);
    assert.deepEqual(h.statuses,statuses,`older raster ${olderOutcome} must not change statuses`);
    assert.deepEqual(h.toasts,toasts,`older raster ${olderOutcome} must not change toasts`);
    assert.deepEqual(h.alerts,alerts,`older raster ${olderOutcome} must not change alerts`);
    assert.equal(h.errors.length,1,`older raster ${olderOutcome} must not log another error`);
    assert.strictEqual(h.errors[0][1].error,newerError);
  }
});

test('rejected newer replacement preflight does not supersede an authorized PSD import', async () => {
  const decodeA=deferred();
  const startedA=deferred();
  let decodeCalls=0;
  let replacementAttempt=0;
  const h=harness({
    decodePsd:()=>{
      decodeCalls+=1;
      startedA.resolve();
      return decodeA.promise;
    },
    canReplaceDocument:()=>{
      replacementAttempt+=1;
      return replacementAttempt===1;
    },
  });

  const openingA=h.controller.open(file('authorized.psd'));
  await startedA.promise;
  await h.controller.open(file('rejected.psd'));

  assert.equal(h.getReplaceChecks(),2);
  assert.equal(decodeCalls,1);

  decodeA.resolve(parsedRgb16());
  await openingA;
  assert.equal(h.published.length,1);
  assert.equal(h.published[0].next.name,'authorized');
});

test('oversized PSD/PSB is rejected before codec work starts', async () => {
  let decodeCalls=0;
  const h=harness({decodePsd:async()=>{decodeCalls+=1;return parsedRgb16();}});
  await h.controller.open({name:'huge.psb',size:513*1024*1024,arrayBuffer:async()=>new ArrayBuffer(0)});
  assert.equal(decodeCalls,0);
  assert.equal(h.published.length,0);
  assert.ok(h.statuses.some(value=>value.includes('512 МБ')));
});
