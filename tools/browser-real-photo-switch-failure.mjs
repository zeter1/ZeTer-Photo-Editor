// 037C-3b-2a: real pinned PSD16/PSB32, Chromium file:// UI cancellation.
// The *real* browser Worker reaches its native job postMessage. This opt-in
// harness then withholds only that postMessage to deterministically keep the
// job in flight while a PUBLIC document-tab switch revokes its owner.
// Late reply is deliberately injected after termination; this does NOT claim
// actual mid-kernel completion or memory-cap testing.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createPinnedPhotoNativeFixture} from './real-photo-native-fixtures.mjs';
import {createWideConnectedUiPolygon} from './browser-wide-connected-ui-polygon.mjs';
import {assertEqualNativeTiles} from './browser-wide-connected-native-evidence.mjs';

const ROOT=path.resolve(new URL('..',import.meta.url).pathname);
const FORMATS={psd16:{bits:16,key:'rgb16'},psb32:{bits:32,key:'float32'}};

export function validateRealPhotoSwitchFailureReceipt(r,pins,manifest){
  const fail=()=>{throw new TypeError('037C-3b-2a: invalid genuine-photo cancellation receipt');};
  const fmt=FORMATS[r?.format],d=pins?.documents?.[r?.format];
  if(!fmt || !d || r.kind!=='zpe-real-photo-browser-cancel-switch-v1' ||
    r.status!=='public-tab-switch-terminated-no-publication' ||
    r.runIndex!==1 || r.protocol!=='file:' ||
    r.inputFileSha256!==d.fileSha256 || r.nativeDefectSha256!==d.nativeSha256 ||
    r.nativeDefectSha256!==manifest?.native?.[fmt.key]?.damagedSha256 ||
    r.sourcePhotoSha256!==manifest?.sourceSha256 ||
    r.bitsPerChannel!==fmt.bits || r.selectedPixels!==8288 ||
    r.workerRequests!==1 || r.workerTerminations!==1 ||
    r.actualNativeWorkerJobIntercepted!==true ||
    r.jobHeldBeforeKernelDispatch!==true ||
    r.publicTabSwitchRevokedOwner!==true ||
    r.lateMessageInjectedAfterTermination!==true ||
    r.lateMessageIgnored!==true ||
    r.nativeBytesUnchanged!==true || r.originalHistoryUnchanged!==true ||
    r.secondTabHistoryUnchanged!==true ||
    r.actualMidKernelCancellationVerified!==false ||
    r.memoryCapVerified!==false || r.photoshopCompatibilityVerified!==false ||
    !Number.isSafeInteger(r.startedAtUnixMs) || r.startedAtUnixMs<=0 ||
    !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs<0) fail();
  return r;
}

export function validateRealPhotoSwitchFailureSet(receipts,pins,manifest){
  if(!Array.isArray(receipts) || receipts.length!==2)
    throw new TypeError('037C-3b-2a: expected two independent format receipts');
  const formats=new Set(),starts=new Set();
  for(const receipt of receipts){
    validateRealPhotoSwitchFailureReceipt(receipt,pins,manifest);
    if(formats.has(receipt.format) || starts.has(receipt.startedAtUnixMs))
      throw new TypeError('037C-3b-2a: duplicate format or session');
    formats.add(receipt.format);starts.add(receipt.startedAtUnixMs);
  }
  if(!formats.has('psd16') || !formats.has('psb32'))
    throw new TypeError('037C-3b-2a: both native depths required');
  return {kind:'zpe-real-photo-browser-cancel-switch-set-v1',runs:2,formats:[...formats].sort(),
    actualMidKernelCancellationVerified:false,memoryCapVerified:false};
}

// The following functions execute in a real CDP browser page, not in Node.
// The only document readback is the public File -> Save Project route.
async function publicNativeSnapshot(label){
  const s=window.__photoFailure;
  let blob=null;
  const original=URL.createObjectURL;
  URL.createObjectURL=function(value,...args){
    if(value instanceof Blob && value.type==='application/json') blob=value;
    return original.call(URL,value,...args);
  };
  try{
    document.querySelector('.menu-button[data-menu="file"]').click();
    const save=[...document.querySelectorAll('#menuPopover .menu-item')].find(
      b=>b.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
    if(!save || save.disabled) throw Error('037C-3b-2a public Save Project unavailable');
    save.click();
    if(!blob) throw Error('037C-3b-2a no public .zpe JSON');
    const project=JSON.parse(await blob.text());
    const source=project.layers?.find(
      l=>l.name==='Pinned photo defect (8-bit derived)')?.highDepthSource;
    if(source?.kind!=='zpe-pixel-buffer-source-v2' ||
      source.width!==1025 || source.height!==1025 || source.channels!==4 ||
      source.bitsPerChannel!==s.bits || source.model!=='rgb' ||
      !Array.isArray(source.tiles) || source.tiles.length<2)
      throw Error('037C-3b-2a invalid native public snapshot');
    s.snapshots[label]=source;
    return {bits:source.bitsPerChannel,tiles:source.tiles.length};
  } finally {URL.createObjectURL=original;}
}
function prepareTabs(){
  const tabs=()=>[...document.querySelectorAll('#docTabs .doc-tab')];
  if(tabs().length!==1) throw Error('037C-3b-2a requires isolated first document');
  document.querySelector('#addDocTabBtn').click();
  if(tabs().length!==2 || tabs()[1]?.getAttribute('aria-selected')!=='true')
    throw Error('037C-3b-2a second document tab not created');
  const secondHistory=[...document.querySelectorAll('#historyList .history-row')]
    .map(r=>r.textContent);
  tabs()[0].click();
  if(tabs()[0]?.getAttribute('aria-selected')!=='true')
    throw Error('037C-3b-2a original tab not active');
  return {secondHistory};
}
function setupPolygon(){
  const s=window.__photoFailure;
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
function installHeldNativeWorker(){
  const s=window.__photoFailure;
  const post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate;
  s.restore=()=>{
    Worker.prototype.postMessage=post;
    Worker.prototype.terminate=terminate;
  };
  Worker.prototype.postMessage=function(job,...args){
    if(job?.selectedIndices instanceof Uint32Array &&
      job?.source?.kind==='zpe-pixel-buffer-source-v2'){
      s.workerRequests++;
      s.worker=this;s.jobId=job.id;
      s.selectionMatched=job.selectedIndices.length===s.expectedIndices.length &&
        job.selectedIndices.every((v,i)=>v===s.expectedIndices[i]);
      // Hold the real job after ready, before kernel dispatch. This is an
      // intentionally controlled in-flight cancellation, not a synthetic PSD.
      return;
    }
    return post.call(this,job,...args);
  };
  Worker.prototype.terminate=function(...args){
    if(this===s.worker) s.workerTerminations++;
    return terminate.apply(this,args);
  };
  return true;
}
function invokeFill(){
  document.querySelector('.menu-button[data-menu="edit"]').click();
  const action=[...document.querySelectorAll('#menuPopover .menu-item')].find(
    b=>b.querySelector('span')?.textContent==='Контент-заливка выделения');
  if(!action || action.disabled) return false;
  action.click();return true;
}
function switchTab(){
  const tabs=[...document.querySelectorAll('#docTabs .doc-tab')];
  tabs[1]?.click();
  return tabs[1]?.getAttribute('aria-selected')==='true';
}
function injectLateAndReturnToOriginal(){
  const s=window.__photoFailure;
  if(s.workerTerminations!==1 || s.workerRequests!==1 || !s.worker ||
     !Number.isSafeInteger(s.jobId))
    throw Error('037C-3b-2a cancellation not observed before late injection');
  const worker=s.worker;
  const delivered=worker.dispatchEvent(new MessageEvent('message',{
    data:{id:s.jobId,ok:true,result:{source:s.snapshots.before,
      changed:1,filled:8288,changedTiles:1,loadedTiles:1}},
  }));
  const secondHistory=[...document.querySelectorAll('#historyList .history-row')]
    .map(r=>r.textContent);
  const tabs=[...document.querySelectorAll('#docTabs .doc-tab')];
  tabs[0].click();
  return {delivered,secondHistory,firstSelected:tabs[0]?.getAttribute('aria-selected')};
}
function compareSnapshots(){
  const s=window.__photoFailure;
  const before=s.snapshots.before,after=s.snapshots.after;
  // Exact public v2 native tile base64 equality: all pixels, all alpha and
  // metadata, including unchanged tiles; NOT Canvas8 pixels.
  const proof=window.__photoFailureAssertNative(before,after,'037C cancelled worker');
  const history=[...document.querySelectorAll('#historyList .history-row')]
    .map(r=>r.textContent);
  return {nativeExact:proof===true,historyExact:
    JSON.stringify(history)===JSON.stringify(s.historyBefore),
    fillHistoryEntries:history.filter(x=>x.includes('Контент-заливка')).length};
}

export async function verifyGenuinePhotoUiSwitchFailure(client,{
  evaluate,waitFor,assert,format,runIndex,sourceDir,artifactDir,baseline,
}={}){
  const fmt=FORMATS[format];
  if(!fmt || runIndex!==1 || !sourceDir || !artifactDir ||
    !baseline?.publicSaveNativeMatchedFrozenPin || baseline.nativeDefectSha256?.length!==64)
    throw new TypeError('037C-3b-2a needs genuine pinned photo baseline');
  const [pins,manifest,rgba]=await Promise.all([
    readFile(path.join(ROOT,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(ROOT,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readFile(path.join(sourceDir,'..','decoded.rgba')),
  ]);
  const admitted=createPinnedPhotoNativeFixture({rgba,width:manifest.decoded.width,
    height:manifest.decoded.height,expectedRgbaSha256:manifest.decoded.sha256,
    bitsPerChannel:fmt.bits,
    expectedReferenceSha256:manifest.native[fmt.key].cleanSha256});
  assert(admitted.admitted && admitted.selectedIndices.length===8288 &&
    baseline.nativeDefectSha256===pins.documents[format].nativeSha256,
    '037C-3b-2a genuine photo independent pins unavailable');
  const started=Date.now();
  const polygon=createWideConnectedUiPolygon(1025,1025,admitted.roiOrigin);
  await evaluate(client,'window.__photoFailure={bits:'+fmt.bits+
    ',polygon:'+JSON.stringify(polygon)+',expectedIndices:'+
    JSON.stringify(Array.from(admitted.selectedIndices))+
    ',snapshots:{},workerRequests:0,workerTerminations:0};true');
  const snapshot=label=>evaluate(client,'('+publicNativeSnapshot.toString()+')('+JSON.stringify(label)+')');
  try{
    const before=await snapshot('before');
    assert(before.tiles>1 && before.bits===fmt.bits,'037C-3b-2a invalid initial native tiles');
    const tabs=await evaluate(client,'('+prepareTabs.toString()+')()');
    const view=await evaluate(client,'('+setupPolygon.toString()+')()');
    assert(view.width===1025 && view.height===1025 && view.inWindow &&
      view.hits.every(x=>x==='overlayCanvas'),
      '037C-3b-2a polygon not visible in Chromium',JSON.stringify(view));
    for(const point of view.points){
      await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y,button:'left',buttons:0});
      await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
      await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
    }
    for(const type of ['keyDown','keyUp']) await client.send('Input.dispatchKeyEvent',{
      type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    const selection=await evaluate(client,
      'document.querySelector("#statusText")?.textContent');
    assert(selection?.includes('Многоугольное выделение: 10 точек'),
      '037C-3b-2a polygon selection not committed',selection);
    // Browser-side comparison function has no access to the private app state.
    await evaluate(client,'window.__photoFailureAssertNative=('+assertEqualNativeTiles.toString()+
      ');window.__photoFailure.historyBefore=[...document.querySelectorAll("#historyList .history-row")].map(r=>r.textContent);true');
    // assertEqualNativeTiles throws on mismatch; wrapper returns a boolean.
    await evaluate(client,'window.__photoFailureAssertNative=((f)=>((a,b,label)=>{f(a,b,label);return true}))(window.__photoFailureAssertNative);true');
    await evaluate(client,'('+installHeldNativeWorker.toString()+')()');
    assert(await evaluate(client,'('+invokeFill.toString()+')()'),
      '037C-3b-2a UI native fill disabled');
    await waitFor('037C-3b-2a actual native Worker posted held job',()=>evaluate(client,
      'window.__photoFailure?.workerRequests===1'),30000);
    const tracked=await evaluate(client,
      '({selected:window.__photoFailure.selectionMatched,terminated:window.__photoFailure.workerTerminations})');
    assert(tracked.selected===true && tracked.terminated===0,
      '037C-3b-2a genuine ROI job not intercepted',JSON.stringify(tracked));
    assert(await evaluate(client,'('+switchTab.toString()+')()'),
      '037C-3b-2a public document tab switch blocked');
    await waitFor('037C-3b-2a native Worker terminated on session switch',
      ()=>evaluate(client,'window.__photoFailure?.workerTerminations===1'),10000);
    const late=await evaluate(client,'('+injectLateAndReturnToOriginal.toString()+')()');
    assert(late.delivered===true && late.firstSelected==='true' &&
      JSON.stringify(late.secondHistory)===JSON.stringify(tabs.secondHistory),
      '037C-3b-2a late signal / other document history check failed',JSON.stringify(late));
    await evaluate(client,'new Promise(resolve=>setTimeout(resolve,120))');
    await snapshot('after');
    const compared=await evaluate(client,'('+compareSnapshots.toString()+')()');
    assert(compared.nativeExact===true && compared.historyExact===true &&
      compared.fillHistoryEntries===0,'037C-3b-2a cancelled photo source/history changed',
      JSON.stringify(compared));
    const receipt={
      kind:'zpe-real-photo-browser-cancel-switch-v1',
      status:'public-tab-switch-terminated-no-publication',
      format,runIndex,protocol:'file:',
      inputFileSha256:baseline.inputFileSha256,
      nativeDefectSha256:baseline.nativeDefectSha256,
      sourcePhotoSha256:manifest.sourceSha256,
      bitsPerChannel:fmt.bits,selectedPixels:8288,
      workerRequests:1,workerTerminations:1,
      actualNativeWorkerJobIntercepted:true,jobHeldBeforeKernelDispatch:true,
      publicTabSwitchRevokedOwner:true,lateMessageInjectedAfterTermination:true,
      lateMessageIgnored:true,nativeBytesUnchanged:true,originalHistoryUnchanged:true,
      secondTabHistoryUnchanged:true,
      actualMidKernelCancellationVerified:false,memoryCapVerified:false,
      photoshopCompatibilityVerified:false,
      startedAtUnixMs:started,elapsedMs:Date.now()-started,
    };
    validateRealPhotoSwitchFailureReceipt(receipt,pins,manifest);
    await mkdir(artifactDir,{recursive:true});
    const output=path.join(artifactDir,'real-photo-'+format+'-failure-run-1.json');
    await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    console.log('037C-3b-2a real photo Chromium cancellation:',JSON.stringify({output,...receipt}));
    return receipt;
  } finally{
    await evaluate(client,'window.__photoFailure?.restore?.();'+
      'delete window.__photoFailure;delete window.__photoFailureAssertNative;true');
  }
}
