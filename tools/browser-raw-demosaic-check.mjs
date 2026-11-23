import {fixture} from '../tests/fixtures/dng-fixture.mjs';
import {decodeDng} from '../src/formats/dng.js';

// Independent real-Chromium file:// path: browser file input -> editor UI ->
// pixel-bearing .zpe snapshot -> History/Undo/Redo -> reopen, no injected ports.
export async function verifyBrowserRawDemosaic({client,evaluate,waitFor,assert}){
  const raw=fixture({width:8,height:8,activeArea:[0,0,8,8],
    defaultCropOrigin:[2,2],defaultCropSize:[4,4],
    samples:x=>x<4?20:180});
  const b64=Buffer.from(raw).toString('base64');
  const oldHistory=await evaluate(client,"document.querySelectorAll('#historyList .history-row').length");
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+
    JSON.stringify(b64)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([bytes],"edge-green.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('demosaic RAW imported to Properties',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='bilinear' && document.querySelectorAll('#historyList .history-row').length>"+oldHistory),15000);
  const save=async(label)=>{
    const old=await evaluate(client,'window.__rawOutputBlobs.length');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await waitFor('demosaic '+label+' .zpe save',async()=>await evaluate(client,
      'window.__rawOutputBlobs.length')>old,15000);
    const selected=await evaluate(client,'(async()=>{const doc=JSON.parse(await window.__rawOutputBlobs.at(-1).text());const layer=doc.layers.find(l=>l.rawDng?.dataUrl?.split(",")[1]==='+JSON.stringify(b64)+');if(!layer)return null;const img=new Image();img.src=layer.dataUrl;await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(img,0,0);return {source:layer.rawDng.dataUrl.split(",")[1],mode:layer.rawDng.development.demosaic||"bilinear",rgba:[...ctx.getImageData(0,0,c.width,c.height).data]};})()');
    assert(selected?.source===b64,'actual .zpe retains unmodified DNG source for '+label);
    return selected;
  };
  const before=await save('bilinear');
  assert(before.mode==='bilinear'&&before.rgba.join(',')===Array.from(decodeDng(raw).rgba).join(','),
    'initial imported preview remains legacy bilinear');
  const prev=await evaluate(client,"document.querySelectorAll('#historyList .history-row').length");
  await evaluate(client,"(() => {const e=document.querySelector('[data-raw-demosaic]');e.value='edge-aware-green';e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('edge-aware mode commits History',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='edge-aware-green' && document.querySelectorAll('#historyList .history-row').length>"+prev),15000);
  const adjusted=await save('edge-aware');
  assert(adjusted.mode==='edge-aware-green' &&
    adjusted.rgba.join(',')===Array.from(decodeDng(raw,{demosaic:'edge-aware-green'}).rgba).join(',') &&
    adjusted.rgba.join(',')!==before.rgba.join(','),
    'actual browser mode changes developed pixel array, not only inspector');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('demosaic Undo mode',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='bilinear'"),15000);
  const undone=await save('undo');
  assert(undone.rgba.join(',')===before.rgba.join(',') && undone.mode==='bilinear',
    'Undo restores byte-identical legacy preview');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('demosaic Redo mode',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='edge-aware-green'"),15000);
  const redone=await save('redo');
  assert(redone.rgba.join(',')===adjusted.rgba.join(',') && redone.mode==='edge-aware-green',
    'Redo restores exact edge-aware raster');
  await evaluate(client,"(() => {const input=document.querySelector('#projectInput'),dt=new DataTransfer();dt.items.add(new File([window.__rawOutputBlobs.at(-1)],'edge-green-reopen.zpe',{type:'application/json'}));input.files=dt.files;const confirm=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event('change',{bubbles:true}));}finally{window.confirm=confirm;}return true;})()");
  await waitFor('demosaic .zpe reopens mode',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='edge-aware-green'"),15000);
  const reopened=await save('reopen');
  assert(reopened.rgba.join(',')===adjusted.rgba.join(',') && reopened.source===b64,
    'reopened project retains pixel-exact edge-aware preview and native bytes');
  const rgbHistory=await evaluate(client,"document.querySelectorAll('#historyList .history-row').length");
  await evaluate(client,"(() => {const e=document.querySelector('[data-raw-demosaic]');e.value='edge-aware-rgb';e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('green-guided RGB mode commits new History',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='edge-aware-rgb' && document.querySelectorAll('#historyList .history-row').length>"+rgbHistory),15000);
  const rgb=await save('green-guided rgb');
  assert(rgb.mode==='edge-aware-rgb' &&
    rgb.rgba.join(',')===Array.from(decodeDng(raw,{demosaic:'edge-aware-rgb'}).rgba).join(',') &&
    rgb.rgba.join(',')!==adjusted.rgba.join(','),
    'green-guided R/B mode produces real different browser pixels from green-only mode');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('RGB demosaic Undo',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='edge-aware-green'"),15000);
  const rgbUndo=await save('rgb undo');
  assert(rgbUndo.rgba.join(',')===adjusted.rgba.join(','),
    'Undo restores previous green-only pixels');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('RGB demosaic Redo',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='edge-aware-rgb'"),15000);
  const rgbRedo=await save('rgb redo');
  assert(rgbRedo.rgba.join(',')===rgb.rgba.join(','),
    'Redo restores full green-guided RGB preview');
  await evaluate(client,"(() => {const input=document.querySelector('#projectInput'),dt=new DataTransfer();dt.items.add(new File([window.__rawOutputBlobs.at(-1)],'rgb-reopen.zpe',{type:'application/json'}));input.files=dt.files;const confirm=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event('change',{bubbles:true}));}finally{window.confirm=confirm;}return true;})()");
  await waitFor('RGB demosaic .zpe reopens mode',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='edge-aware-rgb'"),15000);
  const rgbReopened=await save('rgb reopen');
  assert(rgbReopened.mode==='edge-aware-rgb' && rgbReopened.rgba.join(',')===rgb.rgba.join(',') &&
    rgbReopened.source===b64,'real .zpe roundtrip retains green-guided RGB pixels and original RAW bytes');
  await evaluate(client,"document.querySelector('[data-raw-reset]').click();true");
  await waitFor('demosaic Reset restores bilinear',async()=>await evaluate(client,
    "document.querySelector('[data-raw-demosaic]')?.value==='bilinear'"),15000);
  console.log('CAP-RAW-DNG-EDGE-GREEN + CHROMA-DEMOSAIC Chrome file:// FileInput, full RGBA, .zpe, Undo/Redo/reset PASS');
}
