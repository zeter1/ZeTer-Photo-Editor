// 037C-2: actual file:// Chromium on independently pinned photo-derived PSD16/PSB32.
// Public UI only; no editor-private document state is used as an oracle.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createPinnedPhotoNativeFixture} from './real-photo-native-fixtures.mjs';
import {createWideConnectedUiPolygon} from './browser-wide-connected-ui-polygon.mjs';
import {createWideConnectedRoiIndices,decodeNativeSource,assertEqualNativeTiles}
  from './browser-wide-connected-native-evidence.mjs';
import {inspectNativeSelectedPixelChanges} from './browser-native-selection-integrity.mjs';
import {verifyBrowserRealPhotoRoiQuality} from './browser-real-photo-quality.mjs';
import {validateRealPhotoWorkerReceipt} from './verify-browser-real-photo-worker-artifacts.mjs';

function captureProject(stage) {
  const s=window.__photo037cRepair;
  if(!s || !['original','filled','undone','redone','reopened'].includes(stage))
    throw Error('037C-2 snapshot stage unavailable');
  let blob=null;
  const old=URL.createObjectURL;
  URL.createObjectURL=function(value,...args) {
    if(value instanceof Blob && value.type==='application/json') blob=value;
    return old.call(URL,value,...args);
  };
  try {
    document.querySelector('.menu-button[data-menu="file"]').click();
    const save=[...document.querySelectorAll('#menuPopover .menu-item')].find(
      b=>b.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
    if(!save || save.disabled) throw Error('037C-2 public Save Project unavailable');
    save.click();
    if(!blob) throw Error('037C-2 public Save Project did not publish JSON');
    return blob.text().then(text=>{
      const project=JSON.parse(text);
      const source=project.layers?.find(l=>l.name==='Pinned photo defect (8-bit derived)')?.highDepthSource;
      if(!source || source.kind!=='zpe-pixel-buffer-source-v2' ||
         source.width!==1025 || source.height!==1025 || source.channels!==4 ||
         source.bitsPerChannel!==s.bits || source.model!=='rgb')
        throw Error('037C-2 native layer missing after '+stage);
      s.snapshots[stage]=source;
      if(stage==='redone') s.reopenBlob=blob;
      return {stage,bits:source.bitsPerChannel,tiles:source.tiles?.length};
    });
  } finally {URL.createObjectURL=old;}
}

function setupPolygon(){
  const s=window.__photo037cRepair;
  const zoom=document.querySelector('#zoomRange');
  zoom.value='100';zoom.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('[data-tool="marquee"]').click();
  const type=document.querySelector('#selectionType');
  type.value='polygon';type.dispatchEvent(new Event('change',{bubbles:true}));
  document.querySelector('#canvasShell').scrollIntoView({block:'center',inline:'center'});
  const viewport=document.querySelector('#stageViewport');
  viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;
  viewport.scrollTop=(viewport.scrollHeight-viewport.clientHeight)/2;
  const overlay=document.querySelector('#overlayCanvas'),rect=overlay.getBoundingClientRect();
  const points=s.polygon.points.map(p=>({
    x:rect.left+p.x*rect.width/overlay.width,
    y:rect.top+p.y*rect.height/overlay.height,
  }));
  return {width:overlay.width,height:overlay.height,points,
    hits:points.map(p=>document.elementFromPoint(p.x,p.y)?.id),
    inWindow:points.every(p=>p.x>0&&p.y>0&&p.x<innerWidth&&p.y<innerHeight)};
}
function interceptWorker() {
  const s=window.__photo037cRepair;
  const old=Worker.prototype.postMessage;
  s.restoreWorker=()=>{Worker.prototype.postMessage=old;};
  Worker.prototype.postMessage=function(job,...args) {
    if(job?.selectedIndices instanceof Uint32Array &&
       job?.source?.kind==='zpe-pixel-buffer-source-v2'){
      s.workerRequests++;
      s.selectedIndices=Uint32Array.from(job.selectedIndices);
    }
    return old.call(this,job,...args);
  };
  return true;
}
function invokeFill(){
  document.querySelector('.menu-button[data-menu="edit"]').click();
  const action=[...document.querySelectorAll('#menuPopover .menu-item')].find(
    b=>b.querySelector('span')?.textContent==='Контент-заливка выделения');
  const enabled=!!action && !action.disabled;
  if(enabled) action.click();
  return {enabled};
}
function reopenFromPublicFileInput() {
  const s=window.__photo037cRepair;
  if(!(s.reopenBlob instanceof Blob)) throw Error('037C-2 no public saved project Blob');
  const input=document.querySelector('#fileInput'),transfer=new DataTransfer();
  transfer.items.add(new File([s.reopenBlob],'photo-reopened.zpe',{type:'application/json'}));
  input.files=transfer.files;
  // The application's file input may be synchronously reset by its change
  // handler, so freeze received File metadata BEFORE dispatching that event.
  const received={filename:input.files[0]?.name,size:input.files[0]?.size};
  const old=window.confirm;
  window.confirm=()=>true;
  try {input.dispatchEvent(new Event('change',{bubbles:true}));}
  finally {window.confirm=old;}
  return received;
}

export async function verifyGenuinePhotoUiWorker(client,{
  evaluate,waitFor,assert,format,runIndex,sourceDir,artifactDir,baseline,onStage,
}={}) {
  if(!['psd16','psb32'].includes(format)||![1,2,3].includes(runIndex)||
      !baseline?.publicSaveNativeMatchedFrozenPin||!sourceDir||!artifactDir)
    throw new TypeError('037C-2 missing verified photo UI import baseline');
  const root=path.resolve(new URL('..',import.meta.url).pathname);
  const [manifest,pins,rgba]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(sourceDir,'..','decoded.rgba')),
  ]);
  const bits=format==='psd16'?16:32;
  const nativeKey=bits===16?'rgb16':'float32';
  const admitted=createPinnedPhotoNativeFixture({
    rgba,width:manifest.decoded.width,height:manifest.decoded.height,
    expectedRgbaSha256:manifest.decoded.sha256,bitsPerChannel:bits,
    expectedReferenceSha256:manifest.native[nativeKey].cleanSha256,
  });
  assert(admitted.admitted && admitted.selectedIndices.length===8288 &&
    admitted.width===1025 && admitted.height===1025 &&
    baseline.nativeDefectSha256===manifest.native[nativeKey].damagedSha256,
    '037C-2 independent clean/damaged photo pin failed');

  // Only 8288 known-clean ROI pixels cross CDP. The original ~4-million-word
  // clean reference is verified against the frozen SHA in Node before this.
  const cleanSelected=new (bits===16?Uint16Array:Float32Array)(8288*4);
  admitted.selectedIndices.forEach((pixel,i)=>{
    cleanSelected.set(admitted.clean.subarray(pixel*4,pixel*4+4),i*4);
  });
  const origin=admitted.roiOrigin;
  const polygon=createWideConnectedUiPolygon(1025,1025,origin);
  const started=Date.now();
  await evaluate(client,'window.__photo037cRepair={bits:'+bits+
    ',polygon:'+JSON.stringify(polygon)+
    ',snapshots:{},workerRequests:0,cleanSelected:'+JSON.stringify(Array.from(cleanSelected))+'};true');
  const stage=name=>evaluate(client,'('+captureProject.toString()+')('+JSON.stringify(name)+')');
  try {
    const original=await stage('original');
    assert(original.tiles>1 && original.bits===bits,'037C-2 public native baseline absent');
    const view=await evaluate(client,'('+setupPolygon.toString()+')()');
    assert(view.width===1025 && view.height===1025 && view.inWindow &&
      view.hits.every(hit=>hit==='overlayCanvas'),
      '037C-2 real photo polygon vertices not visible on UI',JSON.stringify(view));
    for(const point of view.points) {
      await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y,button:'left',buttons:0});
      await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
      await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
    }
    for(const type of ['keyDown','keyUp']) await client.send('Input.dispatchKeyEvent',{
      type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    assert((await evaluate(client,'document.querySelector("#statusText")?.textContent'))?.includes('Многоугольное выделение: 10 точек'),
      '037C-2 selection not completed through UI');
    await evaluate(client,'('+interceptWorker.toString()+')()');
    await onStage?.('before-fill');
    const fillStarted=Date.now();
    const invoked=await evaluate(client,'('+invokeFill.toString()+')()');
    assert(invoked.enabled,'037C-2 public Content-Aware Fill unavailable');
    await waitFor('037C-2 real-photo native Worker completion',()=>evaluate(client,
      'window.__photo037cRepair?.workerRequests===1 && '+
      'document.querySelector("#statusText")?.textContent?.includes("tiled ") && '+
      '[...document.querySelectorAll("#historyList .history-row")].filter('+
      'r=>r.textContent.includes("Контент-заливка")).length===1'),120000);
    const fillElapsedMs=Date.now()-fillStarted;
    await stage('filled');
    await onStage?.('after-fill');
    await evaluate(client,'document.querySelector("#undoBtn").click();true');
    await waitFor('037C-2 undo restored',()=>evaluate(client,
      'document.querySelector("#statusText")?.textContent?.startsWith("Отменено")'),30000);
    await stage('undone');
    await onStage?.('after-undo');
    await evaluate(client,'document.querySelector("#redoBtn").click();true');
    await waitFor('037C-2 redo restored',()=>evaluate(client,
      'document.querySelector("#statusText")?.textContent?.startsWith("Повторено")'),30000);
    await stage('redone');
    await onStage?.('after-redo');
    const reopened=await evaluate(client,'('+reopenFromPublicFileInput.toString()+')()');
    assert(reopened.filename==='photo-reopened.zpe' && reopened.size>10000,
      '037C-2 public reopen did not use saved project');
    await waitFor('037C-2 public .zpe reopen',()=>evaluate(client,
      'document.querySelector("#statusText")?.textContent==="Проект открыт"'),60000);
    await stage('reopened');
    await onStage?.('after-reopen');

    // Execute every comparison on the *saved* public native tile snapshots,
    // never private application runtime state or the 8-bit canvas preview.
    const expression='(() => {const TILE_PREFIX='+JSON.stringify(
      'data:application/x-zeter-pixel-buffer-tile;base64,')+
      ';const MAX_PIXELS=2000000;\n'+createWideConnectedRoiIndices.toString()+'\n'+
      decodeNativeSource.toString()+'\n'+assertEqualNativeTiles.toString()+'\n'+
      inspectNativeSelectedPixelChanges.toString()+'\n'+
      verifyBrowserRealPhotoRoiQuality.toString()+'\n'+
      'const s=window.__photo037cRepair,a=s.snapshots;'+
      'const expected=createWideConnectedRoiIndices(1025,1025,{x:'+origin.x+',y:'+origin.y+'});'+
      'const Type=s.bits===16?Uint16Array:Float32Array;'+
      'const integrity=inspectNativeSelectedPixelChanges(a.original,a.filled,s.selectedIndices);'+
      'const quality=verifyBrowserRealPhotoRoiQuality({'+
      'before:decodeNativeSource(a.original),after:decodeNativeSource(a.filled),'+
      'selectedIndices:s.selectedIndices,expectedIndices:expected,'+
      'cleanSelected:new Type(s.cleanSelected),bitsPerChannel:s.bits});'+
      'assertEqualNativeTiles(a.original,a.undone,"photo Undo");'+
      'assertEqualNativeTiles(a.filled,a.redone,"photo Redo");'+
      'assertEqualNativeTiles(a.filled,a.reopened,"photo reopen");'+
      'return {quality,changedTiles:integrity.changedTiles,workerRequests:s.workerRequests,'+
      'undoNativeBytesExact:true,redoNativeBytesExact:true,reopenNativeBytesExact:true};})()';
    const result=await evaluate(client,expression);
    assert(result.workerRequests===1 && result.changedTiles>=2 &&
      result.quality?.changedSelectedPixels>0 &&
      result.undoNativeBytesExact && result.redoNativeBytesExact &&
      result.reopenNativeBytesExact,
      '037C-2 real-photo Worker/quality/Undo/Redo/reopen proof failed',JSON.stringify(result));
    const receipt={
      kind:'zpe-real-photo-browser-native-worker-v1',
      status:'ui-worker-quality-undo-redo-reopen-verified',format,runIndex,
      protocol:'file:',inputFileSha256:baseline.inputFileSha256,
      sourcePhotoSha256:manifest.sourceSha256,
      nativeDefectSha256:baseline.nativeDefectSha256,
      cleanReferenceSha256:admitted.referenceNativeSha256,
      bitsPerChannel:bits,selectedPixels:result.quality.selectedPixels,
      changedSelectedPixels:result.quality.changedSelectedPixels,
      changedTiles:result.changedTiles,scoredSamples:result.quality.scoredSamples,
      baseline:result.quality.baseline,repaired:result.quality.repaired,
      outsideSelectionAndAlphaNativeWordsExact:true,
      workerRequests:result.workerRequests,
      undoNativeBytesExact:true,redoNativeBytesExact:true,reopenNativeBytesExact:true,
      workerVerified:true,qualityVerified:true,undoRedoVerified:true,
      processPeakRssBytes:null,workerPidMapping:'unknown',
      photoshopCompatibilityVerified:false,sourcePrecisionBits:8,
      startedAtUnixMs:started,fillElapsedMs,totalElapsedMs:Date.now()-started,
    };
    validateRealPhotoWorkerReceipt(receipt,pins,manifest);
    await mkdir(artifactDir,{recursive:true});
    const output=path.join(artifactDir,'real-photo-'+format+'-worker-run-'+runIndex+'.json');
    await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    console.log('037C-2 real photo UI Worker:',JSON.stringify({output,...receipt}));
    return receipt;
  } finally {
    await evaluate(client,'window.__photo037cRepair?.restoreWorker?.();delete window.__photo037cRepair;true');
  }
}
