import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectionPixelBounds } from '../src/core/geometry.js';
import { createSelectionClipboardController } from '../src/selection/clipboard-controller.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const clipboard = await readFile(new URL('../src/selection/clipboard-controller.js', import.meta.url), 'utf8');
const clipboardCopyCut = await readFile(new URL('../src/selection/clipboard-copy-cut-controller.js', import.meta.url), 'utf8');
const mutations = await readFile(new URL('../src/selection/raster-mutation-controller.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('selectionPixelBounds keeps every touched pixel while clipping to the document', () => {
  assert.deepEqual(
    selectionPixelBounds({ x:10.2, y:20.7, width:5.1, height:8.1 }, 100, 80),
    { x:10, y:20, width:6, height:9 },
  );
  assert.deepEqual(
    selectionPixelBounds({ x:-3.4, y:75.2, width:12.1, height:10 }, 100, 80),
    { x:0, y:75, width:9, height:5 },
  );
  assert.equal(selectionPixelBounds({ x:100, y:10, width:5, height:5 }, 100, 80), null);
});

test('selection tool exposes merged and selected-layer clipboard modes', () => {
  assert.match(index, /id="selectionCopyMode"/);
  assert.match(index, /value="merged">Со всех видимых слоёв/);
  assert.match(index, /value="selected">С выбранного слоя/);
  assert.match(main, /let selectionCopyMode = 'merged'/);
  assert.match(main, /\.marquee-only/);
});

test('Ctrl+C and Ctrl+X are wired to image clipboard commands', () => {
  assert.match(clipboardCopyCut, /function copySelection\(\) \{ return copySelectionToClipboard\(\); \}/);
  assert.match(clipboardCopyCut, /function cutSelection\(\) \{ return copySelectionToClipboard\(\{cut:true\}\); \}/);
  assert.match(main, /if\(ctrl&&e\.code==='KeyC'\)/);
  assert.match(main, /if\(ctrl&&e\.code==='KeyX'\)/);
  assert.match(main, /\['Копировать выделение','Ctrl\+C',copySelection/);
  assert.match(main, /\['Вырезать выделение','Ctrl\+X',cutSelection/);
  assert.match(main, /window\.addEventListener\('copy'/);
  assert.match(main, /window\.addEventListener\('cut'/);
});

test('merged clipboard mode renders the captured document and captured full selection shape', () => {
  const start = clipboardCopyCut.indexOf('async function renderSelectionMergedToPng(documentValue,bounds,selectionSnapshot) {');
  const end = clipboardCopyCut.indexOf('\n  function isClipboardContextCurrent', start);
  const fn = start >= 0 && end > start ? clipboardCopyCut.slice(start, end) : '';
  assert.match(fn, /await renderDocumentFn\(full,documentValue,\{checker:false\}\)/);
  assert.match(fn, /clipContextToDocumentSelection\(ctx,selectionSnapshot\)/);
  assert.match(fn, /ctx\.drawImage\(full,0,0\)/);
  assert.doesNotMatch(fn, /getDocument\(\)/);
});

test('clipboard writes PNG before cut mutates raster pixels', () => {
  const start = clipboardCopyCut.indexOf('async function copySelectionToClipboard({ cut = false } = {}) {');
  const end = clipboardCopyCut.indexOf('\n  function copySelection()', start);
  const fn = start >= 0 && end > start ? clipboardCopyCut.slice(start, end) : '';
  assert.match(fn, /new ClipboardItemClass\(\{'image\/png':pngBlob\}\)/);
  assert.match(fn, /await navigatorTarget\.clipboard\.write\(\[item\]\)/);
  assert.match(fn, /clearSelectionAcrossVisibleLayers/);
  assert.match(fn, /await clearSelectedPixels/);
  assert.ok(fn.indexOf('navigatorTarget.clipboard.write') < fn.indexOf('clearSelectionAcrossVisibleLayers'));
});


test('merged cut delegates destructive multi-layer work to the selection raster mutation controller', () => {
  assert.match(main, /clearAcrossVisibleLayers: clearSelectionAcrossVisibleLayers/);
  assert.match(mutations, /async function clearAcrossVisibleLayers\(/);
  assert.match(mutations, /layer\.type !== 'adjustment'/);
  assert.match(mutations, /await rasterizeLayer\(layer\)/);
  assert.match(mutations, /documentValue\.layers\.splice\(index, 1, working\)/);
});

test('transient Clipboard completion is identity-guarded before clearing selection or switching tools', () => {
  assert.match(clipboardCopyCut, /getSelectionShape\(\)===context\.selectionIdentity/);
  assert.match(clipboardCopyCut, /getCurrentTool\(\)===context\.tool/);
  assert.match(clipboardCopyCut, /ownerDocument:documentValue/);
  assert.match(clipboardCopyCut, /ownerSessionId:sessionId/);
  assert.match(clipboardCopyCut, /targetLayer:layer/);
});

function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};}
function createClipboardHarness({copyMode='merged',selectionShape:initialSelection={type:'ellipse',rect:{x:1,y:1,width:4,height:4}},documentValue:initialDocument,selectedLayer:initialLayer,renderDocumentImpl=async()=>{},writeImpl=async()=>{},clearMergedImpl=async()=>({cleared:1,locked:0,rasterized:0}),clearSelectedImpl=async()=>true}={}){
  const fallback=initialLayer||{id:'layer-1',type:'raster',name:'Layer',locked:false,visible:true};
  let documentValue=initialDocument||{id:'doc-1',width:16,height:12,layers:[fallback],selectedLayerId:fallback.id};
  let selectedLayer=initialLayer||fallback,sessionId='session-1',selectionShape=initialSelection,tool='marquee',selectionClearCount=0;
  const statuses=[],toasts=[],clips=[],mergedCuts=[],selectedCuts=[],renderDocuments=[];
  const documentTarget={createElement(){const ctx={clearRect(){},save(){},restore(){},translate(){},drawImage(){}};return{width:0,height:0,getContext:()=>ctx};}};
  class ClipboardItemStub{constructor(data){this.data=data;}}
  const controller=createSelectionClipboardController({
    getDocument:()=>documentValue,getActiveSessionId:()=>sessionId,getSelectionShape:()=>selectionShape,captureSelectionSnapshot:()=>selectionShape?structuredClone(selectionShape):null,
    getCopyMode:()=>copyMode,getSelectedLayer:()=>selectedLayer,getCurrentTool:()=>tool,isEditableRasterLayer:layer=>Boolean(layer)&&layer.type==='raster'&&!layer.locked&&documentValue.layers.includes(layer),
    clipContextToDocumentSelection:(ctx,shape)=>clips.push(shape),clearSelectionAcrossVisibleLayers:async options=>{mergedCuts.push(options);return clearMergedImpl(options);},
    clearSelectedPixels:async options=>{selectedCuts.push(options);return clearSelectedImpl(options);},clearSelectionState:()=>{selectionClearCount+=1;selectionShape=null;},setTool:v=>{tool=v;},
    setStatus:v=>statuses.push(v),toast:(message,type)=>toasts.push({message,type}),importImages:async()=>{},visibleCanvasCenter:()=>({x:0,y:0}),isImageFile:()=>false,documentTarget,
    navigatorTarget:{clipboard:{write:items=>writeImpl(items),read:async()=>[]}},ClipboardItemClass:ClipboardItemStub,FileClass:class{},
    renderDocumentFn:async(canvas,owner,options)=>{renderDocuments.push(owner);return renderDocumentImpl(canvas,owner,options);},renderLayerFn:async()=>{},canvasToPngBlobFn:async()=>({type:'image/png'}),setTimeoutFn:()=>1,clearTimeoutFn:()=>{},
  });
  return{controller,statuses,toasts,clips,mergedCuts,selectedCuts,renderDocuments,getDocument:()=>documentValue,setDocument:v=>{documentValue=v;},setSessionId:v=>{sessionId=v;},getSelectionShape:()=>selectionShape,setSelectionShape:v=>{selectionShape=v;},setSelectedLayer:v=>{selectedLayer=v;},getTool:()=>tool,setTool:v=>{tool=v;},getSelectionClearCount:()=>selectionClearCount};
}
test('merged copy keeps originating document and full selection across async render',async()=>{
  const started=deferred(),release=deferred();const h=createClipboardHarness({renderDocumentImpl:async(c,o)=>{started.resolve(o);await release.promise;}});
  const doc=h.getDocument(),original=h.getSelectionShape(),pending=h.controller.copySelection();assert.equal(await started.promise,doc);
  const newer={type:'polygon',points:[{x:1,y:1},{x:5,y:1},{x:1,y:5}]};h.setSelectionShape(newer);release.resolve();assert.equal(await pending,true);
  assert.equal(h.renderDocuments[0],doc);assert.deepEqual(h.clips[0],original);assert.notEqual(h.clips[0],original);assert.equal(h.getSelectionShape(),newer);assert.equal(h.getTool(),'marquee');assert.equal(h.getSelectionClearCount(),0);
});
test('merged cut hands frozen selection to clearing and preserves newer selection',async()=>{
  const started=deferred(),release=deferred();const h=createClipboardHarness({writeImpl:async()=>{started.resolve();await release.promise;}}),doc=h.getDocument(),original=structuredClone(h.getSelectionShape());
  const pending=h.controller.cutSelection();await started.promise;const newer={type:'polygon',points:[{x:1,y:1},{x:5,y:1},{x:1,y:5}]};h.setSelectionShape(newer);release.resolve();assert.equal(await pending,true);
  assert.equal(h.mergedCuts.length,1);assert.equal(h.mergedCuts[0].ownerDocument,doc);assert.equal(h.mergedCuts[0].ownerSessionId,'session-1');assert.deepEqual(h.mergedCuts[0].selectionSnapshot,original);assert.equal(h.getSelectionShape(),newer);assert.equal(h.getTool(),'marquee');
});
test('merged cut rejects same-id replacement document after Clipboard write',async()=>{
  const started=deferred(),release=deferred(),h=createClipboardHarness({writeImpl:async()=>{started.resolve();await release.promise;}}),original=h.getDocument(),pending=h.controller.cutSelection();await started.promise;
  const newer={type:'rect',rect:{x:7,y:2,width:3,height:3}};h.setDocument({id:original.id,width:16,height:12,layers:[],selectedLayerId:null});h.setSelectedLayer(null);h.setSelectionShape(newer);h.setTool('pen');release.resolve();
  assert.equal(await pending,false);assert.equal(h.mergedCuts.length,0);assert.equal(h.getSelectionShape(),newer);assert.equal(h.getTool(),'pen');assert.equal(h.getSelectionClearCount(),0);
});
test('selected cut rejects same-id replacement target after Clipboard write',async()=>{
  const started=deferred(),release=deferred(),layer={id:'layer-1',type:'raster',locked:false,visible:true},doc={id:'doc-1',width:16,height:12,layers:[layer],selectedLayerId:'layer-1'};
  const h=createClipboardHarness({copyMode:'selected',documentValue:doc,selectedLayer:layer,writeImpl:async()=>{started.resolve();await release.promise;}}),pending=h.controller.cutSelection();await started.promise;
  const replacement={...layer};doc.layers=[replacement];h.setSelectedLayer(replacement);release.resolve();assert.equal(await pending,false);assert.equal(h.selectedCuts.length,0);assert.equal(h.getSelectionClearCount(),0);
});
test('selected cut keeps original same-bounds geometry and leaves newer selection intact',async()=>{
  const started=deferred(),release=deferred(),layer={id:'layer-1',type:'raster',locked:false,visible:true},doc={id:'doc-1',width:16,height:12,layers:[layer],selectedLayerId:'layer-1'},original={type:'rect',rect:{x:1,y:1,width:4,height:4}};
  const h=createClipboardHarness({copyMode:'selected',documentValue:doc,selectedLayer:layer,selectionShape:original,writeImpl:async()=>{started.resolve();await release.promise;}}),pending=h.controller.cutSelection();await started.promise;
  const newer={type:'ellipse',rect:{x:1,y:1,width:4,height:4}};h.setSelectionShape(newer);release.resolve();assert.equal(await pending,true);assert.equal(h.selectedCuts[0].ownerDocument,doc);assert.equal(h.selectedCuts[0].targetLayer,layer);assert.deepEqual(h.selectedCuts[0].selectionSnapshot,original);assert.equal(h.getSelectionShape(),newer);assert.equal(h.getTool(),'marquee');
});
test('non-stale cut keeps Clipboard-before-mutation ordering and normal cleanup',async()=>{
  const order=[],h=createClipboardHarness({writeImpl:async()=>order.push('clipboard'),clearMergedImpl:async()=>{order.push('cut');return{cleared:1,locked:0,rasterized:0};}});
  assert.equal(await h.controller.cutSelection(),true);assert.deepEqual(order,['clipboard','cut']);assert.equal(h.getSelectionShape(),null);assert.equal(h.getTool(),'move');assert.equal(h.getSelectionClearCount(),1);
});
test('Clipboard write failure performs no cut or transient cleanup',async()=>{
  const h=createClipboardHarness({writeImpl:async()=>{throw new Error('denied');}}),warn=console.warn;console.warn=()=>{};let result;try{result=await h.controller.cutSelection();}finally{console.warn=warn;}
  assert.equal(result,false);assert.equal(h.mergedCuts.length,0);assert.equal(h.getSelectionClearCount(),0);assert.equal(h.getTool(),'marquee');assert.match(h.statuses.at(-1),/denied/);
});


test('clipboard async continuation is guarded by copy-cut-owner command generation', () => {
  assert.match(clipboardCopyCut, /let clipboardCommandGeneration=0;/);
  assert.match(clipboardCopyCut, /const commandGeneration=\+\+clipboardCommandGeneration;/);
  assert.match(clipboardCopyCut, /context\.commandGeneration===clipboardCommandGeneration/);
  assert.match(clipboardCopyCut, /if\(!isClipboardCommandCurrent\(context\)\)return false;/);
  assert.doesNotMatch(clipboard, /\bclipboardCommandGeneration\b/);
  assert.doesNotMatch(main, /\bclipboardCommandGeneration\b/);
});

test('clipboard facade keeps paste generation separate from copy-cut transaction ownership', () => {
  assert.match(clipboard, /createSelectionClipboardCopyCutController\(/);
  assert.match(clipboard, /let pasteGeneration=0;/);
  assert.doesNotMatch(clipboard, /async function copySelectionToClipboard\(/);
  assert.doesNotMatch(clipboardCopyCut, /\bpasteGeneration\b/);
  assert.doesNotMatch(clipboardCopyCut, /function readClipboardImageFiles\(/);
  assert.doesNotMatch(clipboardCopyCut, /function armPasteShortcutFallback\(/);
});

test('overlapping merged cuts let only the latest command continue when it completes first',async()=>{
  const firstStarted=deferred(),secondStarted=deferred(),writes=[];
  const h=createClipboardHarness({writeImpl:()=>{const gate=deferred();writes.push(gate);(writes.length===1?firstStarted:secondStarted).resolve();return gate.promise;}});
  const older=h.controller.cutSelection();await firstStarted.promise;
  const newer=h.controller.cutSelection();await secondStarted.promise;
  writes[1].resolve();assert.equal(await newer,true);
  writes[0].resolve();assert.equal(await older,false);
  assert.equal(h.mergedCuts.length,1);assert.equal(h.getSelectionClearCount(),1);assert.equal(h.getTool(),'move');
  assert.match(h.statuses.at(-1),/Вырезано/);
});

test('older Clipboard write resolving after a newer command starts cannot reach destructive continuation',async()=>{
  const firstStarted=deferred(),secondStarted=deferred(),writes=[];
  const h=createClipboardHarness({writeImpl:()=>{const gate=deferred();writes.push(gate);(writes.length===1?firstStarted:secondStarted).resolve();return gate.promise;}});
  const older=h.controller.cutSelection();await firstStarted.promise;
  const newer=h.controller.cutSelection();await secondStarted.promise;
  writes[0].resolve();assert.equal(await older,false);assert.equal(h.mergedCuts.length,0);
  writes[1].resolve();assert.equal(await newer,true);assert.equal(h.mergedCuts.length,1);
});

test('overlapping selected-layer cuts cannot both mutate the same exact layer',async()=>{
  const firstStarted=deferred(),secondStarted=deferred(),writes=[];
  const layer={id:'layer-1',type:'raster',locked:false,visible:true},doc={id:'doc-1',width:16,height:12,layers:[layer],selectedLayerId:'layer-1'};
  const h=createClipboardHarness({copyMode:'selected',documentValue:doc,selectedLayer:layer,writeImpl:()=>{const gate=deferred();writes.push(gate);(writes.length===1?firstStarted:secondStarted).resolve();return gate.promise;}});
  const older=h.controller.cutSelection();await firstStarted.promise;
  const newer=h.controller.cutSelection();await secondStarted.promise;
  writes[1].resolve();assert.equal(await newer,true);
  writes[0].resolve();assert.equal(await older,false);
  assert.equal(h.selectedCuts.length,1);assert.equal(h.selectedCuts[0].ownerDocument,doc);assert.equal(h.selectedCuts[0].targetLayer,layer);
});

test('latest command ownership makes Copy then Cut and Cut then Copy deterministic',async()=>{
  for(const [olderKind,newerKind,expectedCuts] of [['copy','cut',1],['cut','copy',0]]){
    const firstStarted=deferred(),secondStarted=deferred(),writes=[];
    const h=createClipboardHarness({writeImpl:()=>{const gate=deferred();writes.push(gate);(writes.length===1?firstStarted:secondStarted).resolve();return gate.promise;}});
    const older=h.controller[olderKind==='cut'?'cutSelection':'copySelection']();await firstStarted.promise;
    const newer=h.controller[newerKind==='cut'?'cutSelection':'copySelection']();await secondStarted.promise;
    writes[1].resolve();assert.equal(await newer,true);
    writes[0].resolve();assert.equal(await older,false);
    assert.equal(h.mergedCuts.length,expectedCuts,`${olderKind} -> ${newerKind}`);
  }
});

test('superseded Clipboard rejection cannot overwrite newer success status or toast',async()=>{
  const firstStarted=deferred(),oldWrite=deferred();let callCount=0;
  const h=createClipboardHarness({writeImpl:()=>{callCount+=1;if(callCount===1){firstStarted.resolve();return oldWrite.promise;}return Promise.resolve();}});
  const older=h.controller.copySelection();await firstStarted.promise;
  assert.equal(await h.controller.copySelection(),true);
  const latestStatus=h.statuses.at(-1),latestToast=h.toasts.at(-1);
  const warn=console.warn;console.warn=()=>{};try{oldWrite.reject(new Error('old denied'));assert.equal(await older,false);}finally{console.warn=warn;}
  assert.equal(h.statuses.at(-1),latestStatus);assert.deepEqual(h.toasts.at(-1),latestToast);
  assert.doesNotMatch(h.statuses.join('\n'),/old denied/);
});


test('newer Clipboard command cancels an older merged Cut still awaiting destructive preparation',async()=>{
  const destructiveStarted=deferred(),releaseDestructive=deferred();
  const h=createClipboardHarness({
    clearMergedImpl:async options=>{
      destructiveStarted.resolve(options);
      await releaseDestructive.promise;
      return options.isContinuationCurrent()?{cleared:1,locked:0,rasterized:0}:null;
    },
  });
  const older=h.controller.cutSelection();
  const destructiveOptions=await destructiveStarted.promise;
  assert.equal(destructiveOptions.isContinuationCurrent(),true);
  assert.equal(await h.controller.copySelection(),true);
  const latestStatus=h.statuses.at(-1),latestToast=h.toasts.at(-1);
  assert.equal(destructiveOptions.isContinuationCurrent(),false);
  releaseDestructive.resolve();
  assert.equal(await older,false);
  assert.equal(h.mergedCuts.length,1);
  assert.equal(h.statuses.at(-1),latestStatus);
  assert.deepEqual(h.toasts.at(-1),latestToast);
});
