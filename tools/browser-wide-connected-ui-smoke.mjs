// 036B: true Chromium file:// UI PSD16/PSB32 -> polygon selection -> native
// Worker -> public Save Project -> exact high-depth/Undo/Redo oracle.
// The fixtures are ZeTer-generated. Never call this Photoshop cross-app parity.
import { createBrowserHighDepthFixture } from './browser-high-depth-fixtures.mjs';
import { createWideConnectedUiPolygon } from './browser-wide-connected-ui-polygon.mjs';
import {
  createWideConnectedRoiIndices,decodeNativeSource,assertEqualNativeTiles,
  verifyWideConnectedNativeRoundTrip,
} from './browser-wide-connected-native-evidence.mjs';
import { inspectNativeSelectedPixelChanges } from './browser-native-selection-integrity.mjs';
import { measureKnownNativeConnectedRoiQuality } from './complex-roi-native-quality.mjs';

export async function verifyBrowserWideConnectedNativeUi(client,{
  evaluate,waitFor,assert,fixtureKey='rgb16wide',
}={}) {
  if (!['rgb16wide','rgb32psbwide'].includes(fixtureKey)) throw new TypeError('036B: unsupported native fixture');
  const fixture=createBrowserHighDepthFixture(fixtureKey);
  const offset=fixture.wideOrigin;
  const polygon=createWideConnectedUiPolygon(fixture.width,fixture.height,{x:offset,y:offset});
  // Test fixture coordinates, not a private editor runtime read.
  const polygonJson=JSON.stringify(polygon);
  const meta={
    filename:fixture.filename,width:fixture.width,height:fixture.height,
    bits:fixture.bitsPerChannel,normal:fixture.normal,offset,
  };
  const started=Date.now();
  await evaluate(client,'window.__wide036={meta:'+JSON.stringify(meta)+',polygon:'+polygonJson+',snapshots:{},jobs:0};window.__wide036Parts=[];true');
  // CDP message size stays bounded even for the 16 MiB Float32 PSB source.
  const base64=Buffer.from(fixture.bytes).toString('base64');
  for(let start=0;start<base64.length;start+=192*1024) {
    await evaluate(client,'(() => {const raw=atob('+JSON.stringify(base64.slice(start,start+192*1024))+
      ');window.__wide036Parts.push(Uint8Array.from(raw,c=>c.charCodeAt(0)));return true;})()');
  }
  function importThroughUi(){
    const input=document.querySelector('#fileInput'),transfer=new DataTransfer();
    transfer.items.add(new File(window.__wide036Parts,window.__wide036.meta.filename,{
      type:'image/vnd.adobe.photoshop'}));
    delete window.__wide036Parts;
    input.files=transfer.files;
    const count=input.files[0]?.size;
    const previous=window.confirm;
    window.confirm=()=>true;
    try {input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally {window.confirm=previous;}
    return {name:input.files[0]?.name,bytes:count};
  }
  const imported=await evaluate(client,'('+importThroughUi.toString()+')()');
  assert(imported.name===fixture.filename && imported.bytes===fixture.bytes.length,
    '036B: public PSD/PSB file input lost native bytes',JSON.stringify(imported));
  await waitFor('036B native PSD/PSB UI import',()=>evaluate(client,
    'document.querySelector("#editorCanvas").width===1025 && '+
    'document.querySelector("#statusText")?.textContent?.startsWith("PSD/PSB импортирован")'),45000);
  const importedMs=Date.now()-started;

  // Only the application's public File > Save Project JSON supplies pixel
  // evidence. No private editor runtime variable is read or injected.
  async function saveSource(label){
    let saved=null;
    const old=URL.createObjectURL;
    URL.createObjectURL=function(blob,...args){
      if(blob instanceof Blob && blob.type==='application/json') saved=blob;
      return old.call(URL,blob,...args);
    };
    try{
      document.querySelector('.menu-button[data-menu="file"]').click();
      const save=[...document.querySelectorAll('#menuPopover .menu-item')].find(
        item=>item.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
      if(!save || save.disabled)return {error:'Save Project unavailable'};
      save.click();
      if(!saved)return {error:'Save Project did not publish JSON'};
      const project=JSON.parse(await saved.text());
      const source=project.layers.find(layer=>layer.name==='Stage 003 native layer')?.highDepthSource;
      if(!source)return {error:'native source missing from public project'};
      window.__wide036.snapshots[label]=source;
      return {label,kind:source.kind,bits:source.bitsPerChannel,
        rawBytes:source.rawBytes,tileCount:source.tiles?.length};
    }finally{URL.createObjectURL=old;}
  }
  const snapshot=label=>evaluate(client,'('+saveSource.toString()+')('+JSON.stringify(label)+')');
  const baseline=await snapshot('original');
  assert(baseline.kind==='zpe-pixel-buffer-source-v2' &&
    baseline.bits===fixture.bitsPerChannel &&
    baseline.rawBytes===fixture.width*fixture.height*fixture.channels*(fixture.bitsPerChannel/8) &&
    baseline.tileCount>1,'036B: exact public high-depth baseline missing',JSON.stringify(baseline));

  // Draw the 10-vertex wide shape by actual CDP mouse events on the editor
  // overlay. Raster predicate uses pixel centers; the .25px diagonal bridges
  // the islands without including any neighbouring pixel centers.
  function setupPolygon(){
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
    const polygon=window.__wide036.polygon;
    const points=polygon.points.map(p=>({
      x:rect.left+p.x*rect.width/overlay.width,
      y:rect.top+p.y*rect.height/overlay.height,
    }));
    return {canvasWidth:overlay.width,canvasHeight:overlay.height,points,
      hits:points.map(p=>document.elementFromPoint(p.x,p.y)?.id),
      inWindow:points.every(p=>p.x>0&&p.y>0&&p.x<innerWidth&&p.y<innerHeight)};
  }
  const view=await evaluate(client,'('+setupPolygon.toString()+')()');
  assert(view.canvasWidth===fixture.width && view.canvasHeight===fixture.height &&
    view.inWindow && view.hits.every(hit=>hit==='overlayCanvas'),
    '036B: real 10-vertex polygon must be visible on overlay',JSON.stringify(view));
  for (const p of view.points) {
    await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,button:'left',buttons:0});
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',buttons:0,clickCount:1});
  }
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',
    windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',
    windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  const selected=await evaluate(client,'document.querySelector("#statusText")?.textContent');
  assert(selected?.includes('Многоугольное выделение: 10 точек'),
    '036B: UI polygon gesture did not finish',JSON.stringify(selected));

  function hookWorker(){
    const old=Worker.prototype.postMessage;
    window.__wide036.restore=()=>{Worker.prototype.postMessage=old;};
    Worker.prototype.postMessage=function(job,...args){
      if(job?.selectedIndices instanceof Uint32Array &&
        job?.source?.kind==='zpe-pixel-buffer-source-v2'){
        window.__wide036.jobs++;
        window.__wide036.selectedIndices=Uint32Array.from(job.selectedIndices);
      }
      return old.call(this,job,...args);
    };
    return true;
  }
  await evaluate(client,'('+hookWorker.toString()+')()');
  const filledAt=Date.now();
  function fillFromMenu(){
    document.querySelector('.menu-button[data-menu="edit"]').click();
    const action=[...document.querySelectorAll('#menuPopover .menu-item')].find(
      item=>item.querySelector('span')?.textContent==='Контент-заливка выделения');
    const enabled=!!action&&!action.disabled;
    if(enabled)action.click();
    return {enabled};
  }
  const invoked=await evaluate(client,'('+fillFromMenu.toString()+')()');
  assert(invoked.enabled,'036B: UI Content-Aware Fill unavailable',JSON.stringify(invoked));
  function done(){
    const state=window.__wide036;
    return state.jobs===1 &&
      document.querySelector('#statusText')?.textContent?.includes('tiled ') &&
      [...document.querySelectorAll('#historyList .history-row')]
        .filter(row=>row.textContent.includes('Контент-заливка')).length===1;
  }
  await waitFor('036B wide native Worker + history',()=>evaluate(client,'('+done.toString()+')()'),90000);
  await snapshot('filled');
  const filledMs=Date.now()-filledAt;

  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('036B Undo preview',()=>evaluate(client,
    'document.querySelector("#editorCanvas").getContext("2d").getImageData('+
    (offset+40)+','+(offset+40)+',1,1).data[0]>150'),30000);
  await snapshot('undone');
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('036B Redo preview',()=>evaluate(client,
    'document.querySelector("#editorCanvas").getContext("2d").getImageData('+
    (offset+40)+','+(offset+40)+',1,1).data[0]<150'),30000);
  await snapshot('redone');

  // All four full sources remain in the page; no multi-MiB CDP response.
  // Inject precisely the production geometry and test-only native oracles.
  const expression='(() => {\nconst TILE_PREFIX='+JSON.stringify('data:application/x-zeter-pixel-buffer-tile;base64,')+
    '; const MAX_PIXELS=2000000;\n'+
    createWideConnectedRoiIndices.toString()+'\n'+
    decodeNativeSource.toString()+'\n'+assertEqualNativeTiles.toString()+'\n'+
    inspectNativeSelectedPixelChanges.toString()+'\n'+
    measureKnownNativeConnectedRoiQuality.toString()+'\n'+
    verifyWideConnectedNativeRoundTrip.toString()+'\n'+
    'const s=window.__wide036;return verifyWideConnectedNativeRoundTrip({'+
    'original:s.snapshots.original,filled:s.snapshots.filled,'+
    'undone:s.snapshots.undone,redone:s.snapshots.redone,'+
    'selectedIndices:s.selectedIndices,clean:s.meta.normal,'+
    'offsetX:s.meta.offset,offsetY:s.meta.offset});\n})()';
  const report=await evaluate(client,expression);
  assert(report.kind==='zpe-browser-wide-connected-native-evidence-v1' &&
    report.selectedPixels===8288 && report.changedSelectedPixels>0 &&
    report.outsideSelectionAndAlphaUnchanged &&
    report.undoNativeBytesExact && report.redoNativeBytesExact &&
    report.repaired.mae<report.baseline.mae,
    '036B: genuine browser native source/selection/Undo/Redo oracle failed',
    JSON.stringify(report));
  console.log('036B Chromium wide connected ROI:',JSON.stringify({
    fixture:fixture.filename,format:fixture.bitsPerChannel===16?'PSD16':'PSB32',
    importedMs,fillAndPreviewMs:filledMs,quality:report,
    note:'ZeTer synthetic reference; no operation peak RSS / Worker PID attribution',
  }));
  await evaluate(client,'window.__wide036.restore?.();delete window.__wide036;true');
  return report;
}
