import {fixture} from '../tests/fixtures/dng-fixture.mjs';
import {decodePsd} from '../src/formats/psd.js';

export async function verifyBrowserRawDng({client,evaluate,waitFor,assert}) {
  const encoded=Buffer.from(fixture()).toString('base64');
  const getState=()=>evaluate(client,"(() => {const canvas=document.querySelector('#editorCanvas');if(!canvas||canvas.width!==4||canvas.height!==4)return null;const rgba=[...canvas.getContext('2d').getImageData(0,0,1,1).data];return {rgba,exposure:document.querySelector('[data-raw-exposure]')?.value,wbRed:document.querySelector('[data-raw-wb-red]')?.value,history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent)};})()");
  const incoming=await evaluate(client,'(() => {const binary=atob('+JSON.stringify(encoded)+');const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const input=document.querySelector("#fileInput");const transfer=new DataTransfer();transfer.items.add(new File([bytes],"camera-sensor.dng",{type:"image/x-adobe-dng"}));input.files=transfer.files;const received={name:input.files[0]?.name,length:input.files[0]?.size};input.dispatchEvent(new Event("change",{bubbles:true}));return received;})()');
  console.log('DNG browser: dispatched',JSON.stringify(incoming));
  assert(incoming.name==='camera-sensor.dng'&&incoming.length===Buffer.from(fixture()).length,'Chrome file:// receives DNG bytes',JSON.stringify(incoming));
  await waitFor('DNG imported to canvas and inspector',async()=>{
    const s=await getState();return s?.exposure==='0'&&s.rgba[3]===255&&s.rgba[0]>s.rgba[2];
  },15000);
  console.log('DNG browser: imported');
  const original=await getState();
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-exposure]');input.value='1';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('RAW exposure changes real canvas',async()=>{
    const s=await getState();return s?.exposure==='1'&&s.rgba[0]>original.rgba[0]&&s.history.some(h=>h.includes('RAW: экспозиция'));
  },15000);
  console.log('DNG browser: adjusted');
  const adjusted=await getState();
  assert(adjusted.rgba[0]>original.rgba[0],'RAW exposure changed RGBA pixels');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('RAW Undo restores pixels and property',async()=>{
    const s=await getState();return s?.exposure==='0'&&s.rgba[0]===original.rgba[0];
  });
  console.log('DNG browser: undo');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('RAW Redo restores developed pixels',async()=>{
    const s=await getState();return s?.exposure==='1'&&s.rgba[0]===adjusted.rgba[0];
  });
  console.log('DNG browser: redo');
  await evaluate(client,"(() => {window.__rawOutputBlobs=[];const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.__rawOutputBlobs.push(blob);return original.call(this,blob);};return true;})()");
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('RAW .zpe Blob',async()=>Boolean(await evaluate(client,'window.__rawOutputBlobs?.length')));
  console.log('DNG browser: saved',JSON.stringify(await evaluate(client,'window.__rawOutputBlobs.map(b=>({size:b.size,type:b.type}))')));
  const saved=await evaluate(client,"(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()");
  console.log('DNG browser: parsed JSON',saved?.layers?.length);
  const layer=saved.layers?.find(l=>l.rawDng);
  assert(layer?.rawDng?.dataUrl?.startsWith('data:application/x-adobe-dng;base64,') && layer.rawDng.development.exposure===1,'actual .zpe retains source and exposure');
  assert(layer.rawDng.dataUrl.split(',')[1]===encoded,'source DNG is byte-for-byte unchanged');
  await evaluate(client,'(() => {const data='+JSON.stringify(saved)+';const input=document.querySelector("#projectInput"),transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(data)],"raw-reopen.zpe",{type:"application/json"}));input.files=transfer.files;const oldConfirm=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=oldConfirm;}return true;})()');
  console.log('DNG browser: reopen dispatched');
  await waitFor('RAW .zpe reopen retains preview and develop params',async()=>{
    const s=await getState();return s?.exposure==='1'&&s.rgba[0]===adjusted.rgba[0];
  },15000);
  const beforeWb=await getState();
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-wb-red]');input.value='0.5';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('RAW white balance changes red channel in real Chrome',async()=>{
    const s=await getState();
    return s?.wbRed==='0.5' && s.rgba[0]<beforeWb.rgba[0] && s.rgba[3]===255;
  },15000);
  // Export rendered RAW from real editor UI, never misrepresent as native editable RAW.
  for (const format of ['image/png','image/vnd.adobe.photoshop','psb']) {
    const before=await evaluate(client,'window.__rawOutputBlobs.length');
    assert(await evaluate(client,'(() => {document.querySelector("#exportQuickBtn").click();const form=document.querySelector("form.modal");if(!form?.elements.format)return false;form.elements.format.value='+JSON.stringify(format)+';form.requestSubmit();return true;})()'),
      'actual export modal for '+format);
    await waitFor('RAW export Blob '+format,async()=>await evaluate(client,'window.__rawOutputBlobs.length')>before,15000);
    const exported=await evaluate(client,'(async()=>Array.from(new Uint8Array(await window.__rawOutputBlobs.at(-1).arrayBuffer())))()');
    assert(Array.isArray(exported) && exported.length>30,'RAW export must have real file bytes '+format);
    if (format==='image/png') {
      assert(exported.slice(0,8).join(',')==='137,80,78,71,13,10,26,10','RAW exported real PNG signature');
    } else {
      const parsed=await decodePsd(Uint8Array.from(exported),{maxPixels:20000,maxLayers:20});
      assert(parsed.width===4&&parsed.height===4&&parsed.layers?.length===1,
        format+' contains developed 4x4 raster layer');
    }
  }
  console.log('CAP-RAW-DNG Chrome file:// import, exposure, Undo/Redo, .zpe source/reopen and PNG/PSD/PSB UI export PASS');
}
