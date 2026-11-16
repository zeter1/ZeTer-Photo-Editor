import {fixture} from '../tests/fixtures/dng-fixture.mjs';
import {decodeDng} from '../src/formats/dng.js';
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
  // A second real FileInput exercises sensor-coordinate ActiveArea and a 90° pixel rotation.
  // The native sensor is 6x4, but the cropped + oriented rendered raster is 3x4.
  const orientedRaw=fixture({width:6,height:4,activeArea:[1,1,4,5],orientation:6});
  const orientedEncoded=Buffer.from(orientedRaw).toString('base64');
  const expected=decodeDng(orientedRaw);
  const historyBefore=(await getState()).history.length;
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(orientedEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),transfer=new DataTransfer();transfer.items.add(new File([bytes],"oriented-sensor.dng",{type:"image/x-adobe-dng"}));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('oriented DNG imported as new layer',async()=>{
    const state=await getState();return state?.history.length>historyBefore;
  },15000);
  const beforeOrientedSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('oriented DNG .zpe Blob',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeOrientedSave,15000);
  const orientedProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const orientedLayer=orientedProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===orientedEncoded);
  assert(orientedLayer&&orientedLayer.width===3&&orientedLayer.height===4,'real UI uses cropped/rotated dimensions');
  assert(orientedLayer.rawDng.width===6&&orientedLayer.rawDng.height===4,
    'original unrotated sensor dimensions survive .zpe');
  const preview=await evaluate(client,'(async()=>{const image=new Image();image.src='+JSON.stringify(orientedLayer.dataUrl)+';await image.decode();const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(image,0,0);return {width:c.width,height:c.height,pixel:Array.from(ctx.getImageData(0,0,1,1).data)};})()');
  assert(preview.width===expected.width&&preview.height===expected.height &&
    preview.pixel.join(',')===Array.from(expected.rgba.slice(0,4)).join(','),
    'actual browser PNG raster matches oriented Bayer output');
  // Wait for a NEW history commit: the first RAW import already produced a matching
  // history label, while the input value changes before the async PNG preview is saved.
  const orientedHistoryBefore=(await getState()).history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-exposure]');input.value='1';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('re-development of oriented RAW commits fresh History',async()=>{
    const state=await getState();
    return state?.exposure==='1' && state.history.length>orientedHistoryBefore;
  },15000);
  const beforeSave2=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('re-developed oriented .zpe',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeSave2,15000);
  const developedProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const developedLayer=developedProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===orientedEncoded);
  assert(developedLayer?.rawDng.development.exposure===1 && developedLayer.width===3 &&
    developedLayer.height===4 && developedLayer.dataUrl!==orientedLayer.dataUrl,
    'oriented RAW re-development changes pixels, retains native source and preview geometry');
  console.log('CAP-RAW-DNG Chrome file:// RAW import/develop/Undo-Redo/.zpe/PNG-PSD-PSB plus ActiveArea/Orientation pixel oracle PASS');
}
