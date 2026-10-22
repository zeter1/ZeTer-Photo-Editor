import { createBrowserHighDepthFixture } from './browser-high-depth-fixtures.mjs';
import { inspectNativeSelectedPixelChanges } from './browser-native-selection-integrity.mjs';
import { saveBrowserNearCapEvidence, validateBrowserNearCapEvidence } from './browser-near-cap-evidence.mjs';
import {
  saveBrowserDenseNearCapEvidence, validateBrowserDenseNearCapEvidence,
  BROWSER_DENSE_NEAR_CAP_LIMITATIONS,
} from './browser-dense-near-cap-evidence.mjs';
import {
  saveBrowserDenseCancelEvidence, validateBrowserDenseCancelEvidence,
  BROWSER_DENSE_CANCEL_LIMITATIONS,
} from './browser-dense-cancel-evidence.mjs';
import {
  saveBrowserDenseOwnerEvidence, validateBrowserDenseOwnerEvidence,
  BROWSER_DENSE_OWNER_LIMITATIONS,
} from './browser-dense-owner-evidence.mjs';
import {
  saveBrowserDenseCloseEvidence, validateBrowserDenseCloseEvidence,
  BROWSER_DENSE_CLOSE_LIMITATIONS,
} from './browser-dense-close-evidence.mjs';
import {
  saveBrowserDenseReplaceEvidence, validateBrowserDenseReplaceEvidence,
  BROWSER_DENSE_REPLACE_LIMITATIONS,
} from './browser-dense-replace-evidence.mjs';

// 003W/2b-2a: actual Chromium file:// PSD16/PSB32 import, UI marquee,
// production Blob Worker + History, and >2M refusal. The successful selection
// is intentionally small in legacy mode. Dense mode independently checks real near-2M Worker completion.
export async function verifyBrowserNearCapUi(client,{evaluate,waitFor,assert,fixtureKey,dense=false,cancelDense=false,switchDense=false,closeDense=false,replaceDense=false}={}) {
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
  if(switchDense||closeDense||replaceDense)await evaluate(client,'window.__nearCapKeepFile=true;true');
  const base64=Buffer.from(fixture.bytes).toString('base64');
  for(let offset=0;offset<base64.length;offset+=192*1024) {
    const part=base64.slice(offset,offset+192*1024);
    await evaluate(client,'(() => {const b=atob('+JSON.stringify(part)+
      ');window.__nearCapParts.push(Uint8Array.from(b,c=>c.charCodeAt(0)));return true})()');
  }
  function importFile() {
    const transfer=new DataTransfer();
    const file=window.__nearCapFixtureFile||new File(
      window.__nearCapParts,window.__nearCapMeta.filename,{type:'image/vnd.adobe.photoshop'});
    if(window.__nearCapKeepFile)window.__nearCapFixtureFile=file;
    transfer.items.add(file);
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
    const originalTerminate=Worker.prototype.terminate;
    const watched=new WeakSet();
    let priorPulse=performance.now(),active=false;
    const observation={
      jobs:0,selectedPixels:0,selectedBytes:0,selected:null,
      pulseIntervalsMs:[],truncated:false,startedAtMs:0,
      heapBeforeBytes:null,heapAfterBytes:null,
      replies:0,terminatedJobs:0,firstDispatchAtMs:null,firstTerminatedAtMs:null,
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
        if(observation.firstDispatchAtMs===null)observation.firstDispatchAtMs=performance.now();
        watched.add(this);
        this.addEventListener('message',()=>{observation.replies++;},{once:true});
        observation.selectedPixels=job.selectedIndices.length;
        observation.selectedBytes=job.selectedIndices.byteLength;
        observation.selected=Uint32Array.from(job.selectedIndices);
      }
      return original.call(this,job,...rest);
    };
    Worker.prototype.terminate=function(...args){
      if(watched.has(this)){
        observation.terminatedJobs++;
        if(observation.firstTerminatedAtMs===null)observation.firstTerminatedAtMs=performance.now();
        watched.delete(this);
      }
      return originalTerminate.apply(this,args);
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
        selectedBytes:observation.selectedBytes,replies:observation.replies,
        terminatedJobs:observation.terminatedJobs,
        firstDispatchAtMs:observation.firstDispatchAtMs,
        firstTerminatedAtMs:observation.firstTerminatedAtMs};},
      selected(){return observation.selected;},
      restore(){active=false;clearInterval(interval);Worker.prototype.postMessage=original;
        Worker.prototype.terminate=originalTerminate;
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
    const isWide=large===true||large==='dense',isDense=large==='dense';
    const start=isWide?toClient(isDense?10:1,isDense?10:1):toClient(f.x-12,f.y-12);
    const end=isWide?toClient(isDense?f.width-10:f.width-4,
      isDense?f.height-10:f.height-2):toClient(f.x+12,f.y+12);
    const center=toClient(f.x,f.y);
    return {start,end,hit:document.elementFromPoint(center.x,center.y)?.id,
      within:start.x>0&&start.y>0&&end.x<innerWidth&&end.y<innerHeight,
      boundingPixels:large==='dense'?(f.width-20)*(f.height-20):
        (f.width-5)*(f.height-3),width:r.width,height:r.height};
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
    await waitFor('003W/2b-2a original defect preview',()=>evaluate(client,
      '(() => {const f=window.__nearCapMeta;const p=document.querySelector("#editorCanvas")'+
      '.getContext("2d").getImageData(f.x,f.y,1,1).data;return p[0]>100&&p[0]>p[1]*2})()'),30_000);
    const baseline=await evaluate(client,snapshot);
    const originalPreview=await evaluate(client,'('+ui.toString()+')()');
    assert(baseline.bits===fixture.bitsPerChannel &&
      baseline.rawBytes===fixture.width*fixture.height*4*(fixture.bitsPerChannel/8) &&
      baseline.tiles>1 && baseline.baselineEqual,
      '003W/2b-2a initial native PSD/PSB source bytes/geometry',JSON.stringify(baseline));


    // 003W/2b-2f: File -> New is a different authorization/owner path from
    // close or tab switch. Refusal must not revoke a running native Worker.
    if(replaceDense){
      const sameUi=(a,b)=>JSON.stringify(a.pixel)===JSON.stringify(b.pixel) &&
        JSON.stringify(a.history)===JSON.stringify(b.history);
      const isDirty=await evaluate(client,
        'document.querySelector("#docTabs .doc-tab-shell .dirty-dot")?.hidden===false');
      assert(isDirty,'003W/2b-2f imported original must be dirty before File New');
      const view=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(view.hit==='overlayCanvas' && view.within &&
        view.boundingPixels>=1_900_000 && view.boundingPixels<=2_000_000,
        '003W/2b-2f genuine high-depth dense marquee',JSON.stringify(view));
      await draw(view);
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2f first native Fill menu is enabled');
      const workerExpr='window.__nearCapWorkerObservation.summary()';
      await waitFor('003W/2b-2f real dense original Worker dispatch',
        async()=>(await evaluate(client,workerExpr)).jobs===1,75_000);
      const first=await evaluate(client,workerExpr);
      assert(first.selectedPixels>=1_900_000&&first.selectedPixels<=2_000_000 &&
        first.selectedBytes===first.selectedPixels*4 &&
        first.replies===0 && first.terminatedJobs===0,
        '003W/2b-2f first Worker must still be in flight',JSON.stringify(first));

      // Two approvals occur in one browser task; the old CPU-bound Worker
      // cannot race its own answer between denial and replacement submission.
      function replaceWithNew(){
        const oldConfirm=window.confirm;
        const modal=()=>document.querySelector('.modal[aria-label="Новый документ"]');
        const launch=()=>{
          document.querySelector('.menu-button[data-menu="file"]').click();
          const item=[...document.querySelectorAll('#menuPopover .menu-item')].find(
            x=>x.querySelector('span')?.textContent?.startsWith('Новый'));
          if(!item||item.disabled)return false;
          item.click();return true;
        };
        let deniedPrompts=0,approvedPrompts=0,denied,approval;
        try{
          window.confirm=()=>{deniedPrompts++;return false;};
          const deniedClick=launch();
          denied={clicked:deniedClick,modalAbsent:!modal(),
            docWidth:document.querySelector('#editorCanvas').width,
            tabs:document.querySelectorAll('#docTabs .doc-tab').length,
            worker:window.__nearCapWorkerObservation.summary()};
          window.confirm=()=>{approvedPrompts++;return true;};
          const approvedClick=launch(),form=modal();
          let submitted=false;
          if(form){
            form.elements.namedItem('width').value='37';
            form.elements.namedItem('height').value='29';
            form.elements.namedItem('name').value='Worker replacement';
            form.requestSubmit();
            submitted=true;
          }
          approval={clicked:approvedClick,hadModal:Boolean(form),submitted,
            worker:window.__nearCapWorkerObservation.summary()};
        }finally{window.confirm=oldConfirm;}
        return {deniedPrompts,approvedPrompts,denied,approval};
      }
      const transaction=await evaluate(client,'('+replaceWithNew.toString()+')()');
      const cancelTimer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      assert(transaction.deniedPrompts===1 && transaction.approvedPrompts===1 &&
        transaction.denied.clicked && transaction.denied.modalAbsent &&
        transaction.denied.docWidth===fixture.width &&
        transaction.denied.tabs===1 && transaction.denied.worker.jobs===1 &&
        transaction.denied.worker.replies===0 &&
        transaction.denied.worker.terminatedJobs===0,
        '003W/2b-2f rejected dirty File New must keep native Worker alive',
        JSON.stringify(transaction));
      assert(transaction.approval.clicked && transaction.approval.hadModal &&
        transaction.approval.submitted &&
        transaction.approval.worker.jobs===1 &&
        transaction.approval.worker.replies===0 &&
        transaction.approval.worker.terminatedJobs===1 &&
        transaction.approval.worker.firstTerminatedAtMs>=first.firstDispatchAtMs,
        '003W/2b-2f accepted File New must terminate old Worker before reply',
        JSON.stringify(transaction));

      await waitFor('003W/2b-2f actual replacement creates 37x29 document',
        ()=>evaluate(client,'document.querySelector("#editorCanvas").width===37 && '+
          'document.querySelector("#editorCanvas").height===29 && '+
          'document.querySelectorAll("#docTabs .doc-tab").length===1'),30_000);
      const blank=await evaluate(client,snapshot);
      const blankUi=await evaluate(client,'('+ui.toString()+')()');
      const blankHistoryReset=blankUi.history.some(x=>x.includes('Новый документ')) &&
        !blankUi.history.some(x=>x.includes('Контент-заливка'));
      assert(blank.error==='Native high-depth source lost' && blankHistoryReset,
        '003W/2b-2f new blank document has no old native tiles/history',
        JSON.stringify({blank,blankUi}));
      await new Promise(resolve=>setTimeout(resolve,1_250));
      const settled=await evaluate(client,snapshot);
      const settledUi=await evaluate(client,'('+ui.toString()+')()');
      const settledWorker=await evaluate(client,workerExpr);
      const stable=settled.error===blank.error && sameUi(settledUi,blankUi) &&
        await evaluate(client,'document.querySelector("#editorCanvas").width===37 && '+
          'document.querySelector("#editorCanvas").height===29');
      assert(stable && settledWorker.jobs===1 && settledWorker.replies===0 &&
        settledWorker.terminatedJobs===1,
        '003W/2b-2f no stale result can mutate fresh blank document',
        JSON.stringify({settled,settledWorker}));

      // Blank Canvas8 is NOT a native high-depth retry. A new actual PSD/PSB
      // file import must own the second 1.9M+ source and successful Worker.
      await evaluate(client,'window.__nearCapBaseline=null;'+
        'window.__nearCapBaselineSource=null;window.__nearCapSuccess=null;true');
      assert(await evaluate(client,'('+importFile.toString()+')()')===fixture.bytes.length,
        '003W/2b-2f fresh native PSD/PSB file transport');
      await waitFor('003W/2b-2f new native PSD/PSB after approved File New',
        ()=>evaluate(client,'(() => {const f=window.__nearCapMeta;return '+
          'document.querySelector("#editorCanvas").width===f.width && '+
          'document.querySelector("#editorCanvas").height===f.height && '+
          'document.querySelector("#statusText")?.textContent?.startsWith("PSD/PSB импортирован")})()'),
        60_000);
      const reimport=await evaluate(client,snapshot);
      const reimportUi=await evaluate(client,'('+ui.toString()+')()');
      const reimportClean=reimportUi.history.every(x=>!x.includes('Контент-заливка'));
      assert(reimport.baselineEqual && reimport.bits===fixture.bitsPerChannel &&
        reimport.pixels===fixture.width*fixture.height && reimportClean,
        '003W/2b-2f separately reimported real native source/History',
        JSON.stringify({reimport,reimportUi}));

      const retryView=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(retryView.hit==='overlayCanvas' && retryView.within &&
        retryView.boundingPixels===view.boundingPixels,
        '003W/2b-2f replacement owner draws independent genuine dense marquee');
      await draw(retryView);
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2f cancelled lease permits new native Worker Fill');
      await waitFor('003W/2b-2f second fresh owner real dense Worker',
        async()=>(await evaluate(client,workerExpr)).jobs===2,75_000);
      const second=await evaluate(client,workerExpr);
      assert(second.selectedPixels===first.selectedPixels &&
        second.selectedBytes===first.selectedBytes && second.replies===0,
        '003W/2b-2f native retry must post same frozen Uint32 indices',
        JSON.stringify(second));
      await waitFor('003W/2b-2f genuine fresh native dense Worker completion',
        ()=>evaluate(client,'(() => window.__nearCapWorkerObservation.summary().jobs===2 && '+
          'document.querySelector("#statusText")?.textContent?.includes("tiled "))()'),205_000);
      const retryTimer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      const done=await evaluate(client,workerExpr);
      assert(done.jobs===2 && done.replies===1 && [1,2].includes(done.terminatedJobs),
        '003W/2b-2f only second native Worker may reply',JSON.stringify(done));
      await evaluate(client,'window.__nearCapCaptureSuccess=true;true');
      const success=await evaluate(client,snapshot);
      const successUi=await evaluate(client,'('+ui.toString()+')()');
      const fillCount=a=>a.filter(x=>x.includes('Контент-заливка')).length;
      const historyOnce=fillCount(successUi.history)===fillCount(reimportUi.history)+1;
      assert(!success.baselineEqual && 
        success.quality?.selectedPixels===second.selectedPixels &&
        success.quality.changedSelectedPixels>0 &&
        success.quality.changedOutsideSelectionPixels===0 &&
        success.alphaUnchanged===true && historyOnce,
        '003W/2b-2f fresh native retry selected-only colors, alpha and History',
        JSON.stringify({success,successUi}));
      await evaluate(client,"document.querySelector('#undoBtn').click();true");
      await waitFor('003W/2b-2f new-owner native Undo',
        async()=>(await evaluate(client,snapshot))?.baselineEqual===true,90_000);
      const undo=await evaluate(client,snapshot);
      await evaluate(client,"document.querySelector('#redoBtn').click();true");
      await waitFor('003W/2b-2f new-owner native Redo',
        async()=>(await evaluate(client,snapshot))?.successEqual===true,90_000);
      const redo=await evaluate(client,snapshot);
      await new Promise(resolve=>setTimeout(resolve,750));
      const final=await evaluate(client,workerExpr);
      const finalTabs=await evaluate(client,
        'document.querySelectorAll("#docTabs .doc-tab").length');
      assert(finalTabs===1&&final.jobs===2&&final.replies===1,
        '003W/2b-2f no late original Worker or ghost owner after Undo/Redo');

      const evidence={
        kind:'zpe-browser-dense-document-replacement-v1',format,protocol:'file:',
        sourcePixels:fixture.width*fixture.height,
        marqueeBoundingPixels:view.boundingPixels,
        selectedPixels:first.selectedPixels,selectedBytes:first.selectedBytes,
        deniedPromptCount:transaction.deniedPrompts,
        approvedPromptCount:transaction.approvedPrompts,
        deniedModalAbsent:transaction.denied.modalAbsent,
        deniedOwnerKept:transaction.denied.docWidth===fixture.width &&
          transaction.denied.tabs===1,
        deniedJobs:transaction.denied.worker.jobs,
        deniedReplies:transaction.denied.worker.replies,
        deniedTerminations:transaction.denied.worker.terminatedJobs,
        newModalSubmitted:transaction.approval.submitted,newWidth:37,newHeight:29,
        blankNativeRemoved:blank.error==='Native high-depth source lost',
        blankHistoryReset,blankStableAfterSettle:stable,
        terminatedBeforeReply:transaction.approval.worker.replies===0,
        terminationsAfterNew:transaction.approval.worker.terminatedJobs,
        oldRepliesAfterSettle:settledWorker.replies,
        reimportedHighDepth:reimport.bits===fixture.bitsPerChannel,
        reimportNativeBaselineExact:reimport.baselineEqual,
        reimportHistoryClean:reimportClean,
        retrySelectedPixels:second.selectedPixels,retrySelectedBytes:second.selectedBytes,
        retryChangedSelectedPixels:success.quality.changedSelectedPixels,
        retryOutsideUnchanged:success.quality.changedOutsideSelectionPixels===0,
        retryAlphaUnchanged:success.alphaUnchanged,retryHistoryOnce:historyOnce,
        undoExact:undo.baselineEqual,redoExact:redo.successEqual,
        finalTabs,finalWorkerJobs:final.jobs,finalWorkerReplies:final.replies,
        finalWorkerTerminations:final.terminatedJobs,
        firstDispatchToTerminationMs:transaction.approval.worker.firstTerminatedAtMs -
          first.firstDispatchAtMs,retryCompletionMs:retryTimer.elapsedMs,
        cancelPulseIntervalsMs:cancelTimer.pulseIntervalsMs,
        retryPulseIntervalsMs:retryTimer.pulseIntervalsMs,
        heapBeforeBytes:cancelTimer.heapBeforeBytes,
        heapAfterBytes:retryTimer.heapAfterBytes,
        workerPidMapping:'unknown',operationPeakKnown:false,
        limitations:BROWSER_DENSE_REPLACE_LIMITATIONS,
      };
      validateBrowserDenseReplaceEvidence(evidence);
      const saved=await saveBrowserDenseReplaceEvidence(evidence,
        process.env.ZPE_BROWSER_DENSE_REPLACE_ARTIFACT_DIR);
      console.log('003W/2b-2f genuine File New denial/replacement/fresh native retry:',
        JSON.stringify({saved,evidence}));
      return evidence;
    }

    // 003W/2b-2e: a rejected dirty close MUST preserve its in-flight owner.
    // A confirmed close MUST terminate the original genuine dense Blob Worker
    // and unblock a new native dense Fill in the remaining real PSD/PSB tab.
    if(closeDense){
      const uiExact=(a,b)=>JSON.stringify(a.pixel)===JSON.stringify(b.pixel) &&
        JSON.stringify(a.history)===JSON.stringify(b.history);
      assert(await evaluate(client,'document.querySelectorAll("#docTabs .doc-tab").length===1'),
        '003W/2b-2e first real imported native document');
      await evaluate(client,'window.__nearCapOriginalData={bytes:window.__nearCapBaseline,'+
        'source:window.__nearCapBaselineSource};'+
        'document.querySelector("#addDocTabBtn").click();true');
      await waitFor('003W/2b-2e second tab created',()=>evaluate(client,
        'document.querySelectorAll("#docTabs .doc-tab").length===2 && '+
        'document.querySelectorAll("#docTabs .doc-tab")[1].getAttribute("aria-selected")==="true"'),15_000);
      await evaluate(client,'window.__nearCapBaseline=null;'+
        'window.__nearCapBaselineSource=null;window.__nearCapSuccess=null;true');
      assert(await evaluate(client,'('+importFile.toString()+')()')===fixture.bytes.length,
        '003W/2b-2e second native PSD/PSB import transport');
      await waitFor('003W/2b-2e second real native import',()=>evaluate(client,
        'document.querySelector("#statusText")?.textContent?.startsWith("PSD/PSB импортирован")'),60_000);
      const secondary=await evaluate(client,snapshot);
      const secondaryUi=await evaluate(client,'('+ui.toString()+')()');
      assert(secondary.baselineEqual && secondary.bits===fixture.bitsPerChannel,
        '003W/2b-2e native survivor baseline',JSON.stringify(secondary));
      await evaluate(client,'window.__nearCapSurvivorData={bytes:window.__nearCapBaseline,'+
        'source:window.__nearCapBaselineSource};'+
        'document.querySelectorAll("#docTabs .doc-tab")[0].click();'+
        'window.__nearCapBaseline=window.__nearCapOriginalData.bytes;'+
        'window.__nearCapBaselineSource=window.__nearCapOriginalData.source;true');
      const original=await evaluate(client,snapshot);
      const originalUi=await evaluate(client,'('+ui.toString()+')()');
      assert(original.baselineEqual && uiExact(originalUi,originalPreview),
        '003W/2b-2e original native and History intact before close');
      const dirty=await evaluate(client,
        'document.querySelectorAll("#docTabs .doc-tab-shell")[0].querySelector(".dirty-dot")?.hidden===false');
      assert(dirty,'003W/2b-2e original owner must be dirty to test rejected close');
      const view=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(view.hit==='overlayCanvas' && view.within &&
        view.boundingPixels>=1_900_000 && view.boundingPixels<=2_000_000,
        '003W/2b-2e actual original dense UI selection',JSON.stringify(view));
      await draw(view);
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2e real first Fill menu enabled');
      const expr='window.__nearCapWorkerObservation.summary()';
      await waitFor('003W/2b-2e genuine dense original Worker dispatch',
        async()=>(await evaluate(client,expr)).jobs===1,75_000);
      const first=await evaluate(client,expr);
      assert(first.selectedPixels>=1_900_000 && first.selectedPixels<=2_000_000 &&
        first.selectedBytes===first.selectedPixels*4 &&
        first.replies===0 && first.terminatedJobs===0,
        '003W/2b-2e original Worker genuinely still in flight',JSON.stringify(first));
      // Keep refusal and acceptance within a single browser task so a fast
      // Worker cannot reply between the two synchronous close decisions.
      function closeOriginal(){
        const tabs=()=>[...document.querySelectorAll('#docTabs .doc-tab-shell')];
        const shell=tabs()[0],close=shell?.querySelector('.doc-tab-close');
        const oldConfirm=window.confirm;
        let refusedPromptCount=0,confirmedPromptCount=0;
        let refused,closed;
        try {
          window.confirm=()=>{refusedPromptCount++;return false;};
          close.click();
          refused={tabs:tabs().length,
            ownerActive:tabs()[0].querySelector('.doc-tab')?.getAttribute('aria-selected')==='true',
            worker:window.__nearCapWorkerObservation.summary()};
          window.confirm=()=>{confirmedPromptCount++;return true;};
          close.click();
          closed={tabs:tabs().length,originalTabGone:!document.contains(shell),
            survivorActive:tabs()[0]?.querySelector('.doc-tab')?.getAttribute('aria-selected')==='true',
            worker:window.__nearCapWorkerObservation.summary()};
        } finally {window.confirm=oldConfirm;}
        return {refusedPromptCount,confirmedPromptCount,refused,closed};
      }
      const closed=await evaluate(client,'('+closeOriginal.toString()+')()');
      const closeTimer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      assert(closed.refusedPromptCount===1 && closed.refused.tabs===2 &&
        closed.refused.ownerActive && closed.refused.worker.jobs===1 &&
        closed.refused.worker.replies===0 && closed.refused.worker.terminatedJobs===0,
        '003W/2b-2e rejecting dirty close must not revoke an active Worker',
        JSON.stringify(closed));
      assert(closed.confirmedPromptCount===1 && closed.closed.tabs===1 &&
        closed.closed.originalTabGone && closed.closed.survivorActive &&
        closed.closed.worker.jobs===1 && closed.closed.worker.replies===0 &&
        closed.closed.worker.terminatedJobs===1 &&
        closed.closed.worker.firstTerminatedAtMs>=first.firstDispatchAtMs,
        '003W/2b-2e confirmed close must remove original and terminate Worker',
        JSON.stringify(closed));
      await evaluate(client,'window.__nearCapBaseline=window.__nearCapSurvivorData.bytes;'+
        'window.__nearCapBaselineSource=window.__nearCapSurvivorData.source;true');
      const after=await evaluate(client,snapshot);
      const afterUi=await evaluate(client,'('+ui.toString()+')()');
      assert(after.baselineEqual && uiExact(afterUi,secondaryUi),
        '003W/2b-2e survivor native/preview/History after original close');
      await new Promise(resolve=>setTimeout(resolve,1_250));
      const settled=await evaluate(client,snapshot);
      const settledUi=await evaluate(client,'('+ui.toString()+')()');
      const preRetry=await evaluate(client,expr);
      assert(settled.baselineEqual && uiExact(settledUi,secondaryUi) &&
        preRetry.jobs===1 && preRetry.replies===0 && preRetry.terminatedJobs===1 &&
        await evaluate(client,'document.querySelectorAll("#docTabs .doc-tab").length===1'),
        '003W/2b-2e no stale worker reply, ghost tab or survivor mutation after settling');
      const retryView=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(retryView.hit==='overlayCanvas' && retryView.within &&
        retryView.boundingPixels===view.boundingPixels,
        '003W/2b-2e survivor draws independent dense marquee');
      await draw(retryView);
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2e cancelled owner must release paint persistence lease');
      await waitFor('003W/2b-2e genuine survivor dense Worker dispatch',
        async()=>(await evaluate(client,expr)).jobs===2,75_000);
      const second=await evaluate(client,expr);
      assert(second.selectedPixels===first.selectedPixels &&
        second.selectedBytes===first.selectedBytes && second.replies===0,
        '003W/2b-2e survivor must receive exact dense selection',JSON.stringify(second));
      await waitFor('003W/2b-2e real dense survivor Worker completion',
        ()=>evaluate(client,'(() => window.__nearCapWorkerObservation.summary().jobs===2 && '+
          'document.querySelector("#statusText")?.textContent?.includes("tiled "))()'),205_000);
      const retryTimer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      const done=await evaluate(client,expr);
      assert(done.jobs===2 && done.replies===1 &&
        done.terminatedJobs>=1 && done.terminatedJobs<=2,
        '003W/2b-2e original Worker must never reply');
      await evaluate(client,'window.__nearCapCaptureSuccess=true;true');
      const success=await evaluate(client,snapshot);
      const successUi=await evaluate(client,'('+ui.toString()+')()');
      assert(!success.baselineEqual &&
        success.quality?.selectedPixels===second.selectedPixels &&
        success.quality.changedSelectedPixels>0 &&
        success.quality.changedOutsideSelectionPixels===0 && success.alphaUnchanged,
        '003W/2b-2e survivor selected-only native color and alpha integrity',
        JSON.stringify(success));
      const fillCount=rows=>rows.filter(s=>s.includes('Контент-заливка')).length;
      assert(fillCount(successUi.history)===fillCount(secondaryUi.history)+1,
        '003W/2b-2e exactly one survivor History transaction');
      await evaluate(client,"document.querySelector('#undoBtn').click();true");
      await waitFor('003W/2b-2e survivor exact native Undo',
        async()=>(await evaluate(client,snapshot))?.baselineEqual===true,90_000);
      const undo=await evaluate(client,snapshot);
      await evaluate(client,"document.querySelector('#redoBtn').click();true");
      await waitFor('003W/2b-2e survivor exact native Redo',
        async()=>(await evaluate(client,snapshot))?.successEqual===true,90_000);
      const redo=await evaluate(client,snapshot);
      await new Promise(resolve=>setTimeout(resolve,750));
      const final=await evaluate(client,expr);
      const finalTabs=await evaluate(client,'document.querySelectorAll("#docTabs .doc-tab").length');
      assert(finalTabs===1 && final.jobs===2 && final.replies===1,
        '003W/2b-2e no ghost owner or late reply after survivor Redo');
      const evidence={
        kind:'zpe-browser-dense-owner-close-v1',format,protocol:'file:',
        sourcePixels:fixture.width*fixture.height,tabsBefore:2,
        refusedPromptCount:closed.refusedPromptCount,refusedTabs:closed.refused.tabs,
        refusedOwnerActive:closed.refused.ownerActive,
        refusedWorkerJobs:closed.refused.worker.jobs,
        refusedWorkerReplies:closed.refused.worker.replies,
        refusedWorkerTerminations:closed.refused.worker.terminatedJobs,
        confirmedPromptCount:closed.confirmedPromptCount,
        tabsAfterClose:closed.closed.tabs,originalTabGone:closed.closed.originalTabGone,
        remainingOwnerActive:closed.closed.survivorActive,
        selectedPixels:first.selectedPixels,selectedBytes:first.selectedBytes,
        jobsBeforeClose:first.jobs,repliesBeforeClose:first.replies,
        terminatedOnClose:closed.closed.worker.terminatedJobs,
        repliesAfterSettling:preRetry.replies,
        survivorNativeExact:after.baselineEqual,survivorUiExact:uiExact(afterUi,secondaryUi),
        settledNativeExact:settled.baselineEqual,
        settledUiExact:uiExact(settledUi,secondaryUi),
        dispatchToTerminationMs:closed.closed.worker.firstTerminatedAtMs-first.firstDispatchAtMs,
        closePulseIntervalsMs:closeTimer.pulseIntervalsMs,
        heapBeforeBytes:closeTimer.heapBeforeBytes,heapAfterBytes:closeTimer.heapAfterBytes,
        successorSelectedPixels:second.selectedPixels,successorSelectedBytes:second.selectedBytes,
        changedSelectedPixels:success.quality.changedSelectedPixels,
        outsideSelectionUnchanged:success.quality.changedOutsideSelectionPixels===0,
        alphaUnchanged:success.alphaUnchanged,
        retryHistoryOnce:fillCount(successUi.history)===fillCount(secondaryUi.history)+1,
        undoExact:undo.baselineEqual,redoExact:redo.successEqual,
        finalTabs,finalWorkerJobs:final.jobs,finalWorkerReplies:final.replies,
        finalWorkerTerminations:final.terminatedJobs,retryCompletionMs:retryTimer.elapsedMs,
        retryPulseIntervalsMs:retryTimer.pulseIntervalsMs,
        workerPidMapping:'unknown',operationPeakKnown:false,
        limitations:BROWSER_DENSE_CLOSE_LIMITATIONS,
      };
      validateBrowserDenseCloseEvidence(evidence);
      const saved=await saveBrowserDenseCloseEvidence(evidence,
        process.env.ZPE_BROWSER_DENSE_CLOSE_ARTIFACT_DIR);
      console.log('003W/2b-2e real dirty close refusal, termination and retry:',
        JSON.stringify({saved,evidence}));
      return evidence;
    }

    // 003W/2b-2d: actual high-depth documents and an in-flight 1.9M+ Worker.
    // Tab actions are normal UI clicks; Worker.postMessage/terminate are observed,
    // not mocked. This is the owner-switch isolation portion, not retry acceptance.
    if(switchDense){
      function tab(index){
        const saved=window.__nearCapTabBaselines;
        const current=window.__nearCapTabIndex;
        saved[current]={bytes:window.__nearCapBaseline,
          source:window.__nearCapBaselineSource,success:window.__nearCapSuccess};
        const targets=[...document.querySelectorAll('#docTabs .doc-tab')];
        targets[index].click();
        const next=saved[index]||{};
        window.__nearCapBaseline=next.bytes||null;
        window.__nearCapBaselineSource=next.source||null;
        window.__nearCapSuccess=next.success||null;
        window.__nearCapTabIndex=index;
        return document.querySelectorAll('#docTabs .doc-tab')[index]?.getAttribute('aria-selected')==='true';
      }
      const changeTab=index=>'('+tab.toString()+')('+index+')';
      const uiExact=(a,b)=>JSON.stringify(a.pixel)===JSON.stringify(b.pixel) &&
        JSON.stringify(a.history)===JSON.stringify(b.history);
      assert(await evaluate(client,'document.querySelectorAll("#docTabs .doc-tab").length===1'),
        '003W/2b-2d must begin with one imported PSD/PSB');
      await evaluate(client,'window.__nearCapTabIndex=0;window.__nearCapTabBaselines=['+
        '{bytes:window.__nearCapBaseline,source:window.__nearCapBaselineSource,success:null}];'+
        'document.querySelector("#addDocTabBtn").click();true');
      await waitFor('003W/2b-2d create second native document tab',()=>evaluate(client,
        'document.querySelectorAll("#docTabs .doc-tab").length===2 && '+
        'document.querySelectorAll("#docTabs .doc-tab")[1].getAttribute("aria-selected")==="true"'),15_000);
      await evaluate(client,'window.__nearCapTabIndex=1;window.__nearCapBaseline=null;'+
        'window.__nearCapBaselineSource=null;window.__nearCapSuccess=null;true');
      const imported=await evaluate(client,'('+importFile.toString()+')()');
      assert(imported===fixture.bytes.length,'003W/2b-2d second real PSD/PSB byte transport');
      await waitFor('003W/2b-2d secondary native Photoshop import',()=>evaluate(client,
        'document.querySelector("#statusText")?.textContent?.startsWith('+
        JSON.stringify('PSD/PSB импортирован')+')'),60_000);
      const secondary=await evaluate(client,snapshot);
      const secondaryUi=await evaluate(client,'('+ui.toString()+')()');
      assert(secondary.baselineEqual && secondary.bits===fixture.bitsPerChannel &&
        secondary.rawBytes===baseline.rawBytes && secondary.tiles===baseline.tiles,
        '003W/2b-2d secondary native document exact baseline',JSON.stringify(secondary));
      assert(await evaluate(client,changeTab(0)),'003W/2b-2d activate original tab');
      const originalAgain=await evaluate(client,snapshot);
      const originalUi=await evaluate(client,'('+ui.toString()+')()');
      assert(originalAgain.baselineEqual && uiExact(originalUi,originalPreview),
        '003W/2b-2d original baseline preserved after secondary import');
      const view=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(view.hit==='overlayCanvas' && view.within &&
        view.boundingPixels>=1_900_000 && view.boundingPixels<=2_000_000,
        '003W/2b-2d real dense original UI marquee',JSON.stringify(view));
      await draw(view);
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2d original Fill command enabled');
      const expr='window.__nearCapWorkerObservation.summary()';
      await waitFor('003W/2b-2d genuine dense Worker dispatch',
        async()=>(await evaluate(client,expr)).jobs===1,75_000);
      const inFlight=await evaluate(client,expr);
      assert(inFlight.selectedPixels>=1_900_000 && inFlight.selectedPixels<=2_000_000 &&
        inFlight.selectedBytes===inFlight.selectedPixels*4 &&
        inFlight.replies===0 && inFlight.terminatedJobs===0,
        '003W/2b-2d real Worker dispatched but not completed',JSON.stringify(inFlight));
      assert(await evaluate(client,changeTab(1)),
        '003W/2b-2d actual UI switch to independent second tab');
      const switched=await evaluate(client,expr);
      const timer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      assert(switched.jobs===1 && switched.replies===0 &&
        switched.terminatedJobs===1 && switched.firstTerminatedAtMs>=inFlight.firstDispatchAtMs,
        '003W/2b-2d in-flight original Worker terminated without reply',JSON.stringify(switched));
      const survivorAfter=await evaluate(client,snapshot);
      const survivorUi=await evaluate(client,'('+ui.toString()+')()');
      assert(survivorAfter.baselineEqual && uiExact(survivorUi,secondaryUi),
        '003W/2b-2d switching cannot mutate survivor native/preview/History');
      assert(await evaluate(client,changeTab(0)),
        '003W/2b-2d reactivate owner for native integrity check');
      const originalAfter=await evaluate(client,snapshot);
      const originalAfterUi=await evaluate(client,'('+ui.toString()+')()');
      assert(originalAfter.baselineEqual && uiExact(originalAfterUi,originalPreview),
        '003W/2b-2d original native/preview/History must remain exact');
      await new Promise(resolve=>setTimeout(resolve,1250));
      const originalSettled=await evaluate(client,snapshot);
      const originalSettledUi=await evaluate(client,'('+ui.toString()+')()');
      assert(await evaluate(client,changeTab(1)),
        '003W/2b-2d revisit survivor after bounded settling');
      const survivorSettled=await evaluate(client,snapshot);
      const survivorSettledUi=await evaluate(client,'('+ui.toString()+')()');
      const finished=await evaluate(client,expr);
      assert(originalSettled.baselineEqual && survivorSettled.baselineEqual &&
        uiExact(originalSettledUi,originalPreview) &&
        uiExact(survivorSettledUi,secondaryUi) && finished.replies===0 &&
        finished.terminatedJobs===1,
        '003W/2b-2d no stale native result in either tab after settling',JSON.stringify(finished));

      const retryView=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(retryView.hit==='overlayCanvas' && retryView.within &&
        retryView.boundingPixels===view.boundingPixels,
        '003W/2b-2d redraw dense selection in surviving document');
      await draw(retryView);
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2d survivor retry must use actual enabled menu Fill');
      await waitFor('003W/2b-2d successor real Worker postMessage',
        async()=>(await evaluate(client,expr)).jobs===2,75_000);
      const successor=await evaluate(client,expr);
      assert(successor.selectedPixels===inFlight.selectedPixels &&
        successor.selectedBytes===inFlight.selectedBytes && successor.replies===0,
        '003W/2b-2d successor must receive dense frozen native indices');
      await waitFor('003W/2b-2d second real dense Worker completes',
        ()=>evaluate(client,'(() => window.__nearCapWorkerObservation.summary().jobs===2 && '+
          'document.querySelector("#statusText")?.textContent?.includes("tiled "))()'),205_000);
      const retryTimer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      const successorDone=await evaluate(client,expr);
      assert(successorDone.jobs===2 && successorDone.replies===1 &&
        successorDone.terminatedJobs>=1 && successorDone.terminatedJobs<=2,
        '003W/2b-2d only successor Worker is authorized to publish',
        JSON.stringify(successorDone));
      await evaluate(client,'window.__nearCapCaptureSuccess=true;true');
      const success=await evaluate(client,snapshot);
      const successUi=await evaluate(client,'('+ui.toString()+')()');
      assert(!success.baselineEqual &&
        success.quality?.selectedPixels===successor.selectedPixels &&
        success.quality.changedSelectedPixels>0 &&
        success.quality.changedOutsideSelectionPixels===0 &&
        success.alphaUnchanged===true,
        '003W/2b-2d success changes selected native colors without alpha');
      const countFill=rows=>rows.filter(s=>s.includes('Контент-заливка')).length;
      assert(countFill(successUi.history)===countFill(secondaryUi.history)+1,
        '003W/2b-2d exactly one successful History entry in survivor');
      await evaluate(client,"document.querySelector('#undoBtn').click();true");
      await waitFor('003W/2b-2d exact survivor Undo',
        async()=>(await evaluate(client,snapshot))?.baselineEqual===true,90_000);
      const undo=await evaluate(client,snapshot);
      await evaluate(client,"document.querySelector('#redoBtn').click();true");
      await waitFor('003W/2b-2d exact survivor Redo',
        async()=>(await evaluate(client,snapshot))?.successEqual===true,90_000);
      const redo=await evaluate(client,snapshot);
      assert(await evaluate(client,changeTab(0)),
        '003W/2b-2d revisit original after successful survivor retry');
      const originalFinal=await evaluate(client,snapshot);
      const originalFinalUi=await evaluate(client,'('+ui.toString()+')()');
      await new Promise(resolve=>setTimeout(resolve,750));
      const allWorkers=await evaluate(client,expr);
      assert(originalFinal.baselineEqual && uiExact(originalFinalUi,originalPreview) &&
        allWorkers.jobs===2 && allWorkers.replies===1 &&
        allWorkers.terminatedJobs>=1 && allWorkers.terminatedJobs<=2,
        '003W/2b-2d no old reply or cross-tab mutation even after successor Redo');
      const evidence={kind:'zpe-browser-dense-owner-switch-v1',format,protocol:'file:',
        tabs:2,sourcePixels:fixture.width*fixture.height,
        selectedPixels:inFlight.selectedPixels,selectedBytes:inFlight.selectedBytes,
        workerJobs:finished.jobs,repliesBeforeSwitch:inFlight.replies,
        terminatedOnSwitch:switched.terminatedJobs,repliesAfterSettling:finished.replies,
        originalNativeExact:originalSettled.baselineEqual,
        originalUiExact:uiExact(originalAfterUi,originalPreview),
        survivorNativeExact:survivorSettled.baselineEqual,
        survivorUiExact:uiExact(survivorSettledUi,secondaryUi),
        dispatchToTerminationMs:switched.firstTerminatedAtMs-inFlight.firstDispatchAtMs,
        pulseIntervalsMs:timer.pulseIntervalsMs,heapBeforeBytes:timer.heapBeforeBytes,
        heapAfterBytes:timer.heapAfterBytes,
        successorSelectedPixels:successor.selectedPixels,
        successorSelectedBytes:successor.selectedBytes,
        changedSelectedPixels:success.quality.changedSelectedPixels,
        outsideSelectionUnchanged:success.quality.changedOutsideSelectionPixels===0,
        alphaUnchanged:success.alphaUnchanged,
        retryHistoryOnce:countFill(successUi.history)===countFill(secondaryUi.history)+1,
        undoExact:undo.baselineEqual,redoExact:redo.successEqual,
        originalFinalExact:originalFinal.baselineEqual&&uiExact(originalFinalUi,originalPreview),
        retryCompletionMs:retryTimer.elapsedMs,retryPulseIntervalsMs:retryTimer.pulseIntervalsMs,
        finalWorkerJobs:allWorkers.jobs,finalWorkerReplies:allWorkers.replies,
        finalWorkerTerminations:allWorkers.terminatedJobs,
        limitations:BROWSER_DENSE_OWNER_LIMITATIONS};
      validateBrowserDenseOwnerEvidence(evidence);
      const saved=await saveBrowserDenseOwnerEvidence(evidence,
        process.env.ZPE_BROWSER_DENSE_OWNER_ARTIFACT_DIR);
      console.log('003W/2b-2d genuine cross-document Worker switch:',
        JSON.stringify({saved,evidence}));
      return evidence;
    }
    // 003W/2b-2c: real near-cap Blob Worker after dispatch, real Escape,
    // bounded stale-result settling, then a second real dense Worker Fill.
    if(cancelDense){
      const view=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(view.hit==='overlayCanvas' && view.within &&
        view.boundingPixels>=1_900_000 && view.boundingPixels<=2_000_000,
        '003W/2b-2c dense UI marquee must be visible and bounded',JSON.stringify(view));
      await draw(view);
      const workerExpr='window.__nearCapWorkerObservation.summary()';
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2c first real dense Fill menu must be enabled');
      await waitFor('003W/2b-2c first real dense Worker postMessage',
        async()=>(await evaluate(client,workerExpr)).jobs===1,75_000);
      const first=await evaluate(client,workerExpr);
      assert(first.selectedPixels>=1_900_000 && first.selectedPixels<=2_000_000 &&
        first.selectedBytes===first.selectedPixels*4 &&
        first.replies===0 && first.terminatedJobs===0,
        '003W/2b-2c Worker must be in flight before Escape',JSON.stringify(first));
      await client.send('Input.dispatchKeyEvent',{
        type:'keyDown',key:'Escape',code:'Escape',
        windowsVirtualKeyCode:27,nativeVirtualKeyCode:27,
      });
      await client.send('Input.dispatchKeyEvent',{
        type:'keyUp',key:'Escape',code:'Escape',
        windowsVirtualKeyCode:27,nativeVirtualKeyCode:27,
      });
      await waitFor('003W/2b-2c genuine owner Escape acknowledgement',
        ()=>evaluate(client,'document.querySelector("#statusText")?.textContent==='+
          JSON.stringify('Контент-заливка отменена')),15_000);
      const stopped=await evaluate(client,workerExpr);
      const cancelledTimer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      assert(stopped.jobs===1 && stopped.replies===0 && stopped.terminatedJobs===1 &&
        stopped.firstTerminatedAtMs>=stopped.firstDispatchAtMs,
        '003W/2b-2c real Worker terminated before reply',JSON.stringify(stopped));
      const samePreview=state=>JSON.stringify(state.pixel)===JSON.stringify(originalPreview.pixel);
      const sameHistory=state=>JSON.stringify(state.history)===JSON.stringify(originalPreview.history);
      const afterCancel=await evaluate(client,snapshot);
      const cancelledUi=await evaluate(client,'('+ui.toString()+')()');
      assert(afterCancel.baselineEqual && samePreview(cancelledUi) && sameHistory(cancelledUi),
        '003W/2b-2c no partial native/preview/History after Escape',
        JSON.stringify({afterCancel,cancelledUi,originalPreview}));
      const settleStarted=Date.now();
      await new Promise(resolve=>setTimeout(resolve,1_250));
      const settledMs=Date.now()-settleStarted;
      const afterSettle=await evaluate(client,snapshot);
      const settledUi=await evaluate(client,'('+ui.toString()+')()');
      const beforeRetry=await evaluate(client,workerExpr);
      assert(afterSettle.baselineEqual && samePreview(settledUi) && sameHistory(settledUi) &&
        beforeRetry.jobs===1 && beforeRetry.replies===0 && beforeRetry.terminatedJobs===1,
        '003W/2b-2c cancelled result must remain uncommitted after settling',
        JSON.stringify({afterSettle,settledUi,beforeRetry}));
      // Supersede the cancelled job's selection owner before retry:
      // dense -> sparse -> freshly drawn dense, still no second Worker yet.
      const newerSparse=await evaluate(client,'('+setupSelection.toString()+')(false)');
      assert(newerSparse.hit==='overlayCanvas'&&newerSparse.within,
        '003W/2b-2c new sparse selection must be a real pointer gesture');
      await draw(newerSparse);
      const newerDense=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(newerDense.hit==='overlayCanvas'&&newerDense.within &&
        newerDense.boundingPixels===view.boundingPixels,
        '003W/2b-2c new dense selection must be independently redrawn');
      await draw(newerDense);
      const superseded=await evaluate(client,workerExpr);
      assert(superseded.jobs===1 && superseded.replies===0,
        '003W/2b-2c changing selection must not revive cancelled Worker',
        JSON.stringify(superseded));
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2c retry must be an enabled real menu Fill');
      await waitFor('003W/2b-2c second real dense Worker postMessage',
        async()=>(await evaluate(client,workerExpr)).jobs===2,75_000);
      const second=await evaluate(client,workerExpr);
      assert(second.selectedPixels===first.selectedPixels &&
        second.selectedBytes===first.selectedBytes && second.replies===0,
        '003W/2b-2c retry must dispatch same dense frozen selection',
        JSON.stringify(second));
      await waitFor('003W/2b-2c real retry Worker completion',
        ()=>evaluate(client,'(() => window.__nearCapWorkerObservation.summary().jobs===2 && '+
          'document.querySelector("#statusText")?.textContent?.includes("tiled "))()'),205_000);
      const retryTimer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      const finished=await evaluate(client,workerExpr);
      assert(finished.jobs===2 && finished.replies===1,
        '003W/2b-2c only successor Worker may reply',JSON.stringify(finished));
      await evaluate(client,'window.__nearCapCaptureSuccess=true;true');
      const success=await evaluate(client,snapshot);
      const successUi=await evaluate(client,'('+ui.toString()+')()');
      assert(!success.baselineEqual &&
        success.quality?.selectedPixels===second.selectedPixels &&
        success.quality.changedSelectedPixels>0 &&
        success.quality.changedOutsideSelectionPixels===0 &&
        success.alphaUnchanged===true,
        '003W/2b-2c retry changes only selected native colors, not alpha',
        JSON.stringify(success));
      const oldFillRows=originalPreview.history.filter(x=>x.includes('Контент-заливка')).length;
      const newFillRows=successUi.history.filter(x=>x.includes('Контент-заливка')).length;
      assert(newFillRows===oldFillRows+1,
        '003W/2b-2c History must contain exactly one retry Fill',JSON.stringify(successUi.history));
      await evaluate(client,"document.querySelector('#undoBtn').click();true");
      await waitFor('003W/2b-2c exact native Undo',async()=>
        (await evaluate(client,snapshot))?.baselineEqual===true,90_000);
      const undo=await evaluate(client,snapshot);
      await evaluate(client,"document.querySelector('#redoBtn').click();true");
      await waitFor('003W/2b-2c exact native Redo',async()=>
        (await evaluate(client,snapshot))?.successEqual===true,90_000);
      const redo=await evaluate(client,snapshot);
      await new Promise(resolve=>setTimeout(resolve,750));
      const finalWorker=await evaluate(client,workerExpr);
      assert(finalWorker.jobs===2 && finalWorker.replies===1,
        '003W/2b-2c no cancelled late reply after Undo/Redo',JSON.stringify(finalWorker));
      const evidence={
        kind:'zpe-browser-near-cap-dense-cancel-v1',format,protocol:'file:',
        sourcePixels:fixture.width*fixture.height,sourceRawBytes:baseline.rawBytes,
        marqueeBoundingPixels:view.boundingPixels,
        firstSelectedPixels:first.selectedPixels,firstSelectedBytes:first.selectedBytes,
        secondSelectedPixels:second.selectedPixels,secondSelectedBytes:second.selectedBytes,
        workerJobs:finalWorker.jobs,cancelAcknowledged:true,
        selectionReplacedAfterCancel:true,
        cancelBeforeReply:stopped.replies===0,
        terminatedJobsBeforeRetry:beforeRetry.terminatedJobs,
        repliesBeforeRetry:beforeRetry.replies,
        cancelNativeExact:afterCancel.baselineEqual,
        cancelPreviewExact:samePreview(cancelledUi),
        cancelHistoryExact:sameHistory(cancelledUi),
        settledNativeExact:afterSettle.baselineEqual,
        settledPreviewExact:samePreview(settledUi),
        settledHistoryExact:sameHistory(settledUi),
        retryChangedSelectedPixels:success.quality.changedSelectedPixels,
        retryOutsideUnchanged:success.quality.changedOutsideSelectionPixels===0,
        retryAlphaUnchanged:success.alphaUnchanged,
        retryUndoExact:undo.baselineEqual,retryRedoExact:redo.successEqual,
        retryHistoryOnce:newFillRows===oldFillRows+1,finalReplies:finalWorker.replies,
        firstDispatchToCancelMs:stopped.firstTerminatedAtMs-first.firstDispatchAtMs,
        cancelSettledMs:settledMs,retryMenuToCompletionMs:retryTimer.elapsedMs,
        requestedPulseMs:8,cancelPulseIntervalsMs:cancelledTimer.pulseIntervalsMs,
        retryPulseIntervalsMs:retryTimer.pulseIntervalsMs,
        cancelPulsesTruncated:cancelledTimer.truncated,
        retryPulsesTruncated:retryTimer.truncated,
        heapBeforeBytes:cancelledTimer.heapBeforeBytes,
        heapAfterBytes:retryTimer.heapAfterBytes,
        workerPidMapping:'unknown',operationPeakKnown:false,
        limitations:BROWSER_DENSE_CANCEL_LIMITATIONS,
      };
      validateBrowserDenseCancelEvidence(evidence);
      const saved=await saveBrowserDenseCancelEvidence(evidence,
        process.env.ZPE_BROWSER_DENSE_CANCEL_ARTIFACT_DIR);
      console.log('003W/2b-2c real dense Worker cancel and retry:',JSON.stringify({saved,evidence}));
      return evidence;
    }
    // A separate fresh-profile scenario: actual ~2M selected indices must
    // complete a production Worker job, not merely pass the UI safety scan.
    if (dense) {
      const view=await evaluate(client,'('+setupSelection.toString()+')("dense")');
      assert(view.hit==='overlayCanvas' && view.within &&
        view.boundingPixels>=1_900_000 && view.boundingPixels<=2_000_000,
        '003W/2b-2b dense marquee must be visible and inside the safety cap',
        JSON.stringify(view));
      await draw(view);
      await evaluate(client,'window.__nearCapWorkerObservation.begin();true');
      assert(await evaluate(client,'('+runFill.toString()+')()'),
        '003W/2b-2b actual dense Fill menu item must be enabled');
      // Dispatch evidence is independent from completion: a task can exceed
      // the 180 s production Worker watchdog, fail with an error status or
      // stall in UI selection freezing before postMessage. Log which phase
      // actually happened instead of reporting only an opaque 240 s timeout.
      const denseState='(() => ({worker:window.__nearCapWorkerObservation.summary(),'+
        'status:document.querySelector("#statusText")?.textContent||""}))()';
      try {
        await waitFor('003W/2b-2b dense production Worker dispatch',
          async()=>(await evaluate(client,denseState)).worker.jobs===1,75_000);
        const dispatched=await evaluate(client,denseState);
        console.log('003W/2b-2b '+format+' real dense Worker dispatched:',
          JSON.stringify(dispatched));
        assert(dispatched.worker.selectedPixels>=1_900_000 &&
          dispatched.worker.selectedPixels<=2_000_000 &&
          dispatched.worker.selectedBytes===dispatched.worker.selectedPixels*4,
          '003W/2b-2b actual dense frozen selection before kernel completion',
          JSON.stringify(dispatched));
        await waitFor('003W/2b-2b genuine dense production Worker completion',
          ()=>evaluate(client,'(() => window.__nearCapWorkerObservation.summary().jobs===1 && '+
            'document.querySelector("#statusText")?.textContent?.includes("tiled "))()'),
          205_000);
      } catch(error) {
        const observed=await evaluate(client,denseState).catch(e=>({readError:String(e)}));
        const elapsed=await evaluate(client,
          'window.__nearCapWorkerObservation.end()').catch(()=>null);
        throw new Error('003W/2b-2b failed genuine dense Worker phase: '+
          JSON.stringify({format,observed,elapsed,
            productionWorkerDeadlineMs:180_000,
            limitations:'No dense success, native output, or Undo/Redo claim'}),{cause:error});
      }
      const timer=await evaluate(client,'window.__nearCapWorkerObservation.end()');
      const worker=await evaluate(client,'window.__nearCapWorkerObservation.summary()');
      assert(worker.jobs===1 && worker.selectedPixels>=1_900_000 &&
        worker.selectedPixels<=2_000_000 &&
        worker.selectedBytes===worker.selectedPixels*4,
        '003W/2b-2b real dense Worker must receive bounded frozen Uint32 indices',
        JSON.stringify(worker));
      await evaluate(client,'window.__nearCapCaptureSuccess=true;true');
      const success=await evaluate(client,snapshot);
      assert(!success.error && !success.baselineEqual &&
        success.quality?.selectedPixels===worker.selectedPixels &&
        success.quality.changedSelectedPixels>0 &&
        success.quality.changedOutsideSelectionPixels===0 &&
        success.alphaUnchanged===true,
        '003W/2b-2b native changed pixels must be strictly selected colors',
        JSON.stringify(success));
      await evaluate(client,"document.querySelector('#undoBtn').click();true");
      await waitFor('003W/2b-2b exact dense native Undo',async()=>
        (await evaluate(client,snapshot))?.baselineEqual===true,90_000);
      const undo=await evaluate(client,snapshot);
      assert(undo.baselineEqual,'003W/2b-2b dense Undo must restore native bytes');
      await evaluate(client,"document.querySelector('#redoBtn').click();true");
      await waitFor('003W/2b-2b exact dense native Redo',async()=>
        (await evaluate(client,snapshot))?.successEqual===true,90_000);
      const redo=await evaluate(client,snapshot);
      assert(redo.successEqual && !redo.baselineEqual,
        '003W/2b-2b dense Redo must reproduce native bytes');
      const evidence={
        kind:'zpe-browser-near-cap-dense-v1',format,
        sourcePixels:fixture.width*fixture.height,sourceRawBytes:baseline.rawBytes,
        protocol:'file:',marqueeBoundingPixels:view.boundingPixels,
        selectedPixels:worker.selectedPixels,selectedBytes:worker.selectedBytes,
        workerJobs:worker.jobs,changedSelectedPixels:success.quality.changedSelectedPixels,
        outsideSelectionUnchanged:success.quality.changedOutsideSelectionPixels===0,
        alphaUnchanged:success.alphaUnchanged,
        undoExact:undo.baselineEqual,redoExact:redo.successEqual,
        sampledPulseIntervalsMs:timer.pulseIntervalsMs,requestedPulseMs:8,
        pulsesTruncated:timer.truncated,menuToCompletionMs:timer.elapsedMs,
        heapBeforeBytes:timer.heapBeforeBytes,heapAfterBytes:timer.heapAfterBytes,
        workerPidMapping:'unknown',operationPeakKnown:false,
        limitations:BROWSER_DENSE_NEAR_CAP_LIMITATIONS,
      };
      validateBrowserDenseNearCapEvidence(evidence);
      const path=await saveBrowserDenseNearCapEvidence(evidence,
        process.env.ZPE_BROWSER_DENSE_NEAR_CAP_ARTIFACT_DIR);
      console.log('003W/2b-2b real dense Chromium native Worker:',JSON.stringify({path,evidence}));
      return evidence;
    }
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
    // Exact persisted source is the primary precision/History oracle. Record
    // actual canvas values separately to identify HDR tone-map/cache divergence.
    await waitFor('003W/2b-2a exact native Undo',async()=>{
      const state=await evaluate(client,snapshot);
      return state?.baselineEqual===true;
    },45_000);
    const undo=await evaluate(client,snapshot);
    const undoPreview=await evaluate(client,'('+ui.toString()+')()');
    console.log('003W/2b-2a '+format+' Undo visual/native diagnostic:',JSON.stringify({
      originalPreview:originalPreview.pixel,filledPreview:filledPreview.pixel,
      undoPreview:undoPreview.pixel,sourceExact:undo.baselineEqual,
    }));
    assert(undo.baselineEqual,'003W/2b-2a Undo must restore exact source tile bytes',JSON.stringify(undo));
    await evaluate(client,"document.querySelector('#redoBtn').click();true");
    await waitFor('003W/2b-2a exact native Redo',async()=>{
      const state=await evaluate(client,snapshot);
      return state?.successEqual===true;
    },45_000);
    const redo=await evaluate(client,snapshot);
    const redoPreview=await evaluate(client,'('+ui.toString()+')()');
    console.log('003W/2b-2a '+format+' Redo visual/native diagnostic:',JSON.stringify({
      filledPreview:filledPreview.pixel,redoPreview:redoPreview.pixel,
      sourceExact:redo.successEqual,
    }));
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
