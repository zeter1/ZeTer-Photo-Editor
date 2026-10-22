import { createBrowserHighDepthFixture } from './browser-high-depth-fixtures.mjs';
import { inspectNativeSelectedPixelChanges } from './browser-native-selection-integrity.mjs';
import { saveBrowserNearCapEvidence, validateBrowserNearCapEvidence } from './browser-near-cap-evidence.mjs';

// 003W/2b-2a: actual Chromium file:// PSD16/PSB32 import, UI marquee,
// production Blob Worker + History, and >2M refusal. The successful selection
// is intentionally small; near-2M successful dense CPU painting is STILL OPEN.
export async function verifyBrowserNearCapUi(client,{evaluate,waitFor,assert,fixtureKey}={}) {
  const fixture=createBrowserHighDepthFixture(fixtureKey);
  const format=fixture.version===1?'PSD16':'PSB32';
  assert(fixture.width===1450 && fixture.height===1400 &&
    fixture.width*fixture.height===2_030_000,
    '003W/2b-2a must load actual >2M high-depth native geometry');
  await client.send('Emulation.setDeviceMetricsOverride',{
    width:1280,height:900,deviceScaleFactor:1,mobile:false,
  });
  await evaluate(client,'window.__nearCapParts=[];window.__nearCapMeta='+
    JSON.stringify({filename:fixture.filename,width:fixture.width,height:fixture.height,
      x:fixture.defectX,y:fixture.defectY,bits:fixture.bitsPerChannel})+';true');
  const base64=Buffer.from(fixture.bytes).toString('base64');
  for(let offset=0;offset<base64.length;offset+=192*1024) {
    const part=base64.slice(offset,offset+192*1024);
    await evaluate(client,'(() => {const b=atob('+JSON.stringify(part)+
      ');window.__nearCapParts.push(Uint8Array.from(b,c=>c.charCodeAt(0)));return true})()');
  }
  function importFile() {
    const transfer=new DataTransfer();
    transfer.items.add(new File(window.__nearCapParts,window.__nearCapMeta.filename,{
      type:'image/vnd.adobe.photoshop',
    }));
    const input=document.querySelector('#fileInput');
    input.files=transfer.files;
    const size=input.files[0].size;
    delete window.__nearCapParts;
    const old=window.confirm;
    window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=old;}
    return size;
  }
  const size=await evaluate(client,'('+importFile.toString()+')()');
  assert(size===fixture.bytes.length,'003W/2b-2a PSD/PSB transport must be exact');
  await waitFor('003W/2b-2a actual PSD/PSB native import',
    ()=>evaluate(client,'(() => {const f=window.__nearCapMeta;return '+
      'document.querySelector("#editorCanvas").width===f.width && '+
      'document.querySelector("#editorCanvas").height===f.height && '+
      'document.querySelector("#statusText")?.textContent?.startsWith("PSD/PSB импортирован")})()'),
    60_000);

  function observeWorker() {
    const original=Worker.prototype.postMessage;
    let priorPulse=performance.now(),active=false;
    const observation={
      jobs:0,selectedPixels:0,selectedBytes:0,selected:null,
      pulseIntervalsMs:[],truncated:false,startedAtMs:0,
      heapBeforeBytes:null,heapAfterBytes:null,
    };
    const heap=()=>Number.isSafeInteger(performance.memory?.usedJSHeapSize)
      ?performance.memory.usedJSHeapSize:null;
    const interval=setInterval(()=>{
      const now=performance.now(),elapsed=now-priorPulse;
      priorPulse=now;
      if(active) {
        if(observation.pulseIntervalsMs.length<256)observation.pulseIntervalsMs.push(elapsed);
        else observation.truncated=true;
      }
    },8);
    Worker.prototype.postMessage=function(job,...rest) {
      if(job?.source?.kind==='zpe-pixel-buffer-source-v2' &&
          job.selectedIndices instanceof Uint32Array) {
        observation.jobs++;
        observation.selectedPixels=job.selectedIndices.length;
        observation.selectedBytes=job.selectedIndices.byteLength;
        observation.selected=Uint32Array.from(job.selectedIndices);
      }
      return original.call(this,job,...rest);
    };
    window.__nearCapWorkerObservation={
      begin(){observation.pulseIntervalsMs=[];observation.truncated=false;
        observation.startedAtMs=performance.now();observation.heapBeforeBytes=heap();active=true;},
      end(){active=false;observation.heapAfterBytes=heap();
        return {pulseIntervalsMs:[...observation.pulseIntervalsMs],
          truncated:observation.truncated,
          elapsedMs:performance.now()-observation.startedAtMs,
          heapBeforeBytes:observation.heapBeforeBytes,
          heapAfterBytes:observation.heapAfterBytes};},
      summary(){return {jobs:observation.jobs,selectedPixels:observation.selectedPixels,
        selectedBytes:observation.selectedBytes};},
      selected(){return observation.selected;},
      restore(){active=false;clearInterval(interval);Worker.prototype.postMessage=original;
        delete window.__nearCapWorkerObservation;},
    };
    return true;
  }
  await evaluate(client,'('+observeWorker.toString()+')()');

  // Each read goes through the real File > Save Project UI, without exposing
  // editor-private state; native tile payloads are compared in the page.
  function readNative() {
    let blob=null;
    const old=URL.createObjectURL;
    URL.createObjectURL=function(value,...rest){
      if(value instanceof Blob && value.type==='application/json')blob=value;
      return old.call(URL,value,...rest);
    };
    try {
      document.querySelector('.menu-button[data-menu="file"]').click();
      const item=[...document.querySelectorAll('#menuPopover .menu-item')].find(
        button=>button.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
      if(!item || item.disabled)return {error:'Save Project unavailable'};
      item.click();
      if(!blob)return {error:'Save Project yielded no JSON blob'};
      return blob.text().then(text=>{
        const project=JSON.parse(text),f=window.__nearCapMeta;
        const source=project.layers.find(l=>l.name==='Stage 003 native layer')?.highDepthSource;
        if(!source)return {error:'Native high-depth source lost'};
        const urls=source.tiles.map(tile=>tile.dataUrl);
        const equal=(target)=>target?.length===urls.length &&
          urls.every((value,i)=>target[i]===value);
        if(!window.__nearCapBaseline) {
          window.__nearCapBaseline=urls;
          window.__nearCapBaselineSource=source;
        }
        const baselineEqual=equal(window.__nearCapBaseline);
        const successEqual=equal(window.__nearCapSuccess);
        let quality=null,alphaUnchanged=null;
        if(window.__nearCapWorkerObservation?.selected() &&
          window.__nearCapBaselineSource) {
          quality=inspectNativeSelectedPixelChanges(
            window.__nearCapBaselineSource,source,
            window.__nearCapWorkerObservation.selected());
          alphaUnchanged=true;
          const before=window.__nearCapBaselineSource;
          const bytesPerSample=f.bits/8, stride=4*bytesPerSample;
          for(let i=0;i<source.tiles.length;i++){
            if(before.tiles[i].dataUrl===source.tiles[i].dataUrl)continue;
            const original=Uint8Array.from(atob(before.tiles[i].dataUrl.split(',')[1]),c=>c.charCodeAt(0));
            const changed=Uint8Array.from(atob(source.tiles[i].dataUrl.split(',')[1]),c=>c.charCodeAt(0));
            for(let off=3*bytesPerSample;off<original.length;off+=stride)
              for(let b=0;b<bytesPerSample;b++)
                if(original[off+b]!==changed[off+b])alphaUnchanged=false;
          }
        }
        if(window.__nearCapCaptureSuccess) {
          window.__nearCapSuccess=urls;
          delete window.__nearCapCaptureSuccess;
        }
        return {bits:source.bitsPerChannel,pixels:source.width*source.height,
          rawBytes:source.rawBytes,tiles:source.tiles.length,
          baselineEqual,successEqual,quality,alphaUnchanged};
      });
    } finally { URL.createObjectURL=old; }
  }
  const snapshot='(() => {\n'+inspectNativeSelectedPixelChanges.toString()+
    '\nreturn ('+readNative.toString()+')();\n})()';
  function setupSelection(large) {
    const f=window.__nearCapMeta;
    document.querySelector('[data-tool="marquee"]').click();
    const type=document.querySelector('#selectionType');
    type.value='rect';type.dispatchEvent(new Event('change',{bubbles:true}));
    const zoom=document.querySelector('#zoomRange');
    zoom.value=large?'25':'50';zoom.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#canvasShell').scrollIntoView({block:'center',inline:'center'});
    const viewport=document.querySelector('#stageViewport');
    viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;
    viewport.scrollTop=(viewport.scrollHeight-viewport.clientHeight)/2;
    const canvas=document.querySelector('#editorCanvas'),r=canvas.getBoundingClientRect();
    const toClient=(x,y)=>({x:r.left+r.width*x/f.width,y:r.top+r.height*y/f.height});
    const start=large?toClient(1,1):toClient(f.x-12,f.y-12);
    const end=large?toClient(f.width-4,f.height-2):toClient(f.x+12,f.y+12);
    const center=toClient(f.x,f.y);
    return {start,end,hit:document.elementFromPoint(center.x,center.y)?.id,
      within:start.x>0&&start.y>0&&end.x<innerWidth&&end.y<innerHeight,
      boundingPixels:(f.width-5)*(f.height-3),width:r.width,height:r.height};
  }
  async function draw(view) {
    const send=(type,point,buttons)=>client.send('Input.dispatchMouseEvent',{
      type,x:point.x,y:point.y,button:'left',buttons,clickCount:1,
    });
    await send('mouseMoved',view.start,0);
    await send('mousePressed',view.start,1);
    await send('mouseMoved',view.end,1);
    await send('mouseReleased',view.end,0);
  }
  function runFill() {
    document.querySelector('.menu-button[data-menu="edit"]').click();
    const item=[...document.querySelectorAll('#menuPopover .menu-item')].find(
      x=>x.querySelector('span')?.textContent==='Контент-заливка выделения');
    const enabled=Boolean(item&&!item.disabled);
    if(enabled)item.click();
    return enabled;
  }
  function ui() {
    const f=window.__nearCapMeta;
    return {pixel:Array.from(document.querySelector('#editorCanvas').getContext('2d')
        .getImageData(f.x,f.y,1,1).data),
      history:[...document.querySelectorAll('#historyList .history-row')].map(x=>x.textContent),
      status:document.querySelector('#statusText')?.textContent||''};
  }
  try {
    const baseline=await evaluate(client,snapshot);
    const originalPreview=await evaluate(client,'('+ui.toString()+')()');
    assert(baseline.bits===fixture.bitsPerChannel &&
      baseline.rawBytes===fixture.width*fixture.height*4*(fixture.bitsPerChannel/8) &&
      baseline.tiles>1 && baseline.baselineEqual,
      '003W/2b-2a initial native PSD/PSB source bytes/geometry',JSON.stringify(baseline));
    const sparseView=await evaluate(client,'('+setupSelection.toString()+')(false)');
    assert(sparseView.hit==='overlayCanvas' && sparseView.within,
      '003W/2b-2a sparse UI selection must be visible',JSON.stringify(sparseView));
    await draw(sparseView);
    assert(await evaluate(client,'('+runFill.toString()+')()'),
      '003W/2b-2a actual sparse menu command must be enabled');
    await waitFor('003W/2b-2a real sparse native Worker success',()=>evaluate(client,
      '(() => window.__nearCapWorkerObservation.summary().jobs===1 && '+
      'document.querySelector("#statusText")?.textContent?.includes("tiled "))()'),
      75_000);
    const sparse=await evaluate(client,'window.__nearCapWorkerObservation.summary()');
    assert(sparse.jobs===1 && sparse.selectedPixels>=1 && sparse.selectedPixels<=1024 &&
      sparse.selectedBytes===sparse.selectedPixels*4,
      '003W/2b-2a actual frozen sparse indices from production Worker',JSON.stringify(sparse));
    const filledPreview=await evaluate(client,'('+ui.toString()+')()');
    assert(JSON.stringify(filledPreview.pixel)!==JSON.stringify(originalPreview.pixel),
      '003W/2b-2a browser Worker must actually repaint defect preview',
      JSON.stringify({original:originalPreview.pixel,filled:filledPreview.pixel}));
    await evaluate(client,'window.__nearCapCaptureSuccess=true;true');
    const success=await evaluate(client,snapshot);
    assert(!success.error && !success.baselineEqual &&
      success.quality?.changedSelectedPixels>0 &&
      success.quality?.changedOutsideSelectionPixels===0 &&
      success.alphaUnchanged===true,
      '003W/2b-2a real Worker may change only selected native color bytes',
      JSON.stringify(success));
    await evaluate(client,"document.querySelector('#undoBtn').click();true");
    await waitFor('003W/2b-2a native Undo preview',()=>evaluate(client,
      '('+ui.toString()+')().pixel.join(",")==='+JSON.stringify(originalPreview.pixel.join(','))),30_000);
    const undo=await evaluate(client,snapshot);
    assert(undo.baselineEqual,'003W/2b-2a Undo must restore exact source tile bytes',JSON.stringify(undo));
    await evaluate(client,"document.querySelector('#redoBtn').click();true");
    await waitFor('003W/2b-2a native Redo preview',()=>evaluate(client,
      '('+ui.toString()+')().pixel.join(",")==='+JSON.stringify(filledPreview.pixel.join(','))),30_000);
    const redo=await evaluate(client,snapshot);
    assert(redo.successEqual && !redo.baselineEqual,
      '003W/2b-2a Redo must reproduce identical native tile payloads',JSON.stringify(redo));
    const uiBefore=await evaluate(client,'('+ui.toString()+')()');
    const largeView=await evaluate(client,'('+setupSelection.toString()+')(true)');
    assert(largeView.hit==='overlayCanvas' && largeView.within &&
      largeView.boundingPixels>2_000_000,
      '003W/2b-2a over-cap UI selection must be large and visible',JSON.stringify(largeView));
    await draw(largeView);
    const refusalBefore=await evaluate(client,'window.__nearCapWorkerObservation.summary()');
    assert(refusalBefore.jobs===1,'003W/2b-2a over-cap baseline must have only sparse Worker');
    await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
    assert(await evaluate(client,'('+runFill.toString()+')()'),
      '003W/2b-2a actual over-cap menu command must be enabled');
    await waitFor('003W/2b-2a production >2M safe refusal',()=>evaluate(client,
      'document.querySelector("#statusText")?.textContent?.startsWith('+
      JSON.stringify('Контент-заливка: выделено больше безопасного лимита 2000000 px')+')'),
      90_000);
    const timer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
    const refusalAfter=await evaluate(client,'window.__nearCapWorkerObservation.summary()');
    const uiAfter=await evaluate(client,'('+ui.toString()+')()');
    const afterNative=await evaluate(client,snapshot);
    const evidence={
      kind:'zpe-browser-near-cap-ui-v1',format,
      sourcePixels:fixture.width*fixture.height,
      sourceRawBytes:baseline.rawBytes,protocol:'file:',
      sparseSelectedPixels:sparse.selectedPixels,
      sparseSelectedBytes:sparse.selectedBytes,sparseWorkerJobs:sparse.jobs,
      sparseChangedNative:success.quality.changedSelectedPixels>0,
      sparseOutsideTilesUnchanged:success.quality.changedOutsideSelectionPixels===0,
      alphaUnchanged:success.alphaUnchanged,
      undoExact:undo.baselineEqual,redoExact:redo.successEqual,
      overCapWorkerJobsBefore:refusalBefore.jobs,overCapWorkerJobsAfter:refusalAfter.jobs,
      overCapStatus:uiAfter.status,
      overCapNativeUnchanged:afterNative.successEqual,
      overCapPreviewUnchanged:JSON.stringify(uiBefore.pixel)===JSON.stringify(uiAfter.pixel),
      overCapHistoryUnchanged:JSON.stringify(uiBefore.history)===JSON.stringify(uiAfter.history),
      sampledPulseIntervalsMs:timer.pulseIntervalsMs,requestedPulseMs:8,
      pulsesTruncated:timer.truncated,menuToRefusalMs:timer.elapsedMs,
      heapBeforeBytes:timer.heapBeforeBytes,heapAfterBytes:timer.heapAfterBytes,
      workerPidMapping:'unknown',operationPeakKnown:false,
      limitations:'Sparse Worker success and >2M refusal only; sampled renderer timer/heap, not continuous CPU, operation memory peak, Worker PID or dense near-2M completion.',
    };
    validateBrowserNearCapEvidence(evidence);
    const path=await saveBrowserNearCapEvidence(evidence,
      process.env.ZPE_BROWSER_NEAR_CAP_ARTIFACT_DIR);
    console.log('003W/2b-2a real Chromium near-cap UI:',JSON.stringify({path,evidence}));
    return evidence;
  } finally {
    await evaluate(client,'window.__nearCapWorkerObservation?.restore();'+
      'delete window.__nearCapBaseline;delete window.__nearCapBaselineSource;'+
      'delete window.__nearCapSuccess;delete window.__nearCapMeta;true').catch(()=>{});
  }
}
