import {fixture} from '../tests/fixtures/dng-fixture.mjs';
import {losslessJpegDngFixture,tiledLosslessJpegDngFixture} from '../tests/fixtures/dng-lossless-jpeg-fixture.mjs';
import {decodeDng} from '../src/formats/dng.js';
import {decodePsd} from '../src/formats/psd.js';

export async function verifyBrowserRawDng({client,evaluate,waitFor,assert}) {
  // Synthetic TIFF/DNG with a real signed-rational ColorMatrix IFD.
  const calibratedBytes=fixture({matrix1:[0.9,0.1,0,0.1,1,0,0,0.1,1],illuminant1:21,
    samples:[40,30,20],baselineExposure:0.5});
  const encoded=Buffer.from(calibratedBytes).toString('base64');
  const getState=()=>evaluate(client,"(() => {const canvas=document.querySelector('#editorCanvas');if(!canvas||canvas.width!==4||canvas.height!==4)return null;const rgba=[...canvas.getContext('2d').getImageData(0,0,1,1).data];return {rgba,exposure:document.querySelector('[data-raw-exposure]')?.value,wbRed:document.querySelector('[data-raw-wb-red]')?.value,history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent)};})()");
  const incoming=await evaluate(client,'(() => {const binary=atob('+JSON.stringify(encoded)+');const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const input=document.querySelector("#fileInput");const transfer=new DataTransfer();transfer.items.add(new File([bytes],"camera-sensor.dng",{type:"image/x-adobe-dng"}));input.files=transfer.files;const received={name:input.files[0]?.name,length:input.files[0]?.size};input.dispatchEvent(new Event("change",{bubbles:true}));return received;})()');
  console.log('DNG browser: dispatched',JSON.stringify(incoming));
  assert(incoming.name==='camera-sensor.dng'&&incoming.length===calibratedBytes.byteLength,'Chrome file:// receives calibrated DNG bytes',JSON.stringify(incoming));
  await waitFor('DNG imported to canvas and inspector',async()=>{
    const s=await getState();return s?.exposure==='0'&&s.rgba[3]===255&&s.rgba[0]>s.rgba[2];
  },15000);
  console.log('DNG browser: imported');
  const original=await getState();
  assert(original.rgba.join(',')===Array.from(decodeDng(calibratedBytes).rgba.slice(0,4)).join(','),
    'Chrome file:// renders ColorMatrix-calibrated pixels, not old uncalibrated fallback');
  assert(await evaluate(client,"document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent?.includes('ColorMatrix')"),
    'RAW Properties distinguishes calibrated matrix pipeline from uncalibrated preview');
  assert(await evaluate(client,"document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent?.includes('BaselineExposure+0.50 EV')"),
    'real RAW Properties displays camera BaselineExposure separately from editable user EV');
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
  assert(layer?.rawDng?.dataUrl?.startsWith('data:application/x-adobe-dng;base64,') &&
    layer.rawDng.development.exposure===1 && layer.rawDng.colorPipeline==='matrix-d50-bradford-v1' &&
    layer.rawDng.baselineExposure===0.5,
    'actual .zpe retains RAW source, exposure and calibrated pipeline provenance');
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
  // Display-only clipping warning: real canvas pixels differ, saved RAW raster does not.
  const historyBeforeClipping=(await getState()).history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-exposure]');input.value='5';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('RAW overexposure re-develop has committed',async()=>{
    const s=await getState();return s?.exposure==='5'&&s.history.length>historyBeforeClipping;
  },15000);
  const unmarked=await getState();
  const historyBeforeToggle=unmarked.history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-clipping-warning]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('display clipping warning colors the real canvas',async()=>{
    const s=await getState();
    const summary=await evaluate(client,"document.querySelector('[data-raw-clipping-summary]')?.textContent");
    return summary?.includes('Света:')&&s?.rgba.join(',')!==unmarked.rgba.join(',');
  },15000);
  const marked=await getState();
  assert(marked.history.length===historyBeforeToggle,'view-only warning does not create History entries');
  const beforeClipSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('clipping mode saved .zpe without overlay',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeClipSave,15000);
  const clipProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const clipLayer=clipProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===encoded);
  assert(clipLayer?.rawDng.development.exposure===5,'view-only clipping toggle does not change RAW develop params');
  const clipRaster=await evaluate(client,'(async()=>{const src='+JSON.stringify(clipLayer.dataUrl)+';const image=new Image();image.src=src;await image.decode();const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(image,0,0);return Array.from(ctx.getImageData(0,0,1,1).data);})()');
  assert(clipRaster.join(',')===unmarked.rgba.join(',')&&clipRaster.join(',')!==marked.rgba.join(','),
    'saved .zpe PNG pixels exclude display-only diagnostic magenta/cyan overlay');
  const beforeWarnExport=await evaluate(client,'window.__rawOutputBlobs.length');
  assert(await evaluate(client,'(() => {document.querySelector("#exportQuickBtn").click();const form=document.querySelector("form.modal");if(!form?.elements.format)return false;form.elements.format.value="image/png";form.requestSubmit();return true;})()'),
    'RAW PNG export remains usable while clipping display warning is on');
  await waitFor('PNG exported with clipping warning active',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeWarnExport,15000);
  const exportedRawPixel=await evaluate(client,'(async()=>{const blob=window.__rawOutputBlobs.at(-1);const bitmap=await createImageBitmap(blob);const c=document.createElement("canvas");c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext("2d");ctx.drawImage(bitmap,0,0);const pixel=Array.from(ctx.getImageData(0,0,1,1).data);bitmap.close();return pixel;})()');
  assert(exportedRawPixel.join(',')===unmarked.rgba.join(','),
    'actual exported PNG ignores the magenta/cyan screen warning');
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-clipping-warning]');input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('clipping warning off restores true display pixels',async()=>{
    const s=await getState();return s?.rgba.join(',')===unmarked.rgba.join(',');
  },15000);
  assert((await getState()).history.length===historyBeforeToggle,'clipping toggle off does not commit History');
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
  // Fractional DefaultCrop plus non-square-pixel DefaultScale, real FileInput,
  // calibrated pixels, saved RAW provenance, re-develop and History.
  const croppedRaw=fixture({width:8,height:6,activeArea:[1,1,6,7],
    defaultCropOrigin:[1.5,1],defaultCropSize:[4,3],defaultScale:[2,1],orientation:6,
    matrix1:[0.9,0.1,0,0.1,1,0,0,0.1,1],illuminant1:21,
    samples:(x,y,c)=>25+x*9+y*5+c*20});
  const croppedEncoded=Buffer.from(croppedRaw).toString('base64');
  const cropOracle=decodeDng(croppedRaw);
  const beforeCropHistory=(await getState()).history.length;
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(croppedEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),transfer=new DataTransfer();transfer.items.add(new File([bytes],"fractional-crop.dng",{type:"image/x-adobe-dng"}));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('fractional DefaultCrop import commits History',async()=>{
    const s=await getState();
    return s?.exposure==='0'&&s.history.length>beforeCropHistory;
  },15000);
  assert(await evaluate(client,"document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent?.includes('DefaultScale 2×1')"),
    'real RAW Properties shows applied non-square pixel DefaultScale');
  const beforeCropSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('fractionally cropped .zpe',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeCropSave,15000);
  const cropProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const cropLayer=cropProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===croppedEncoded);
  assert(cropLayer?.width===3&&cropLayer?.height===8&&cropLayer.rawDng.width===8&&cropLayer.rawDng.height===6&&
    cropLayer.rawDng.defaultScale?.join(',')==='2,1',
    'fractional crop + DefaultScale + Orientation renders 3x8 and stores sensor provenance');
  const cropRendered=await evaluate(client,'(async()=>{const src='+JSON.stringify(cropLayer.dataUrl)+';const image=new Image();image.src=src;await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);return {width:canvas.width,height:canvas.height,rgba:[...ctx.getImageData(0,0,canvas.width,canvas.height).data]};})()');
  assert(cropRendered.width===cropOracle.width&&cropRendered.height===cropOracle.height &&
    cropRendered.rgba.join(',')===Array.from(cropOracle.rgba).join(','),
    'actual Chromium DNG crop pixels match independent Node TIFF/CFA oracle');
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),transfer=new DataTransfer();transfer.items.add(new File(['+JSON.stringify(JSON.stringify(cropProject))+'],"crop-reopen.zpe",{type:"application/json"}));input.files=transfer.files;const original=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=original;}return true;})()');
  await waitFor('fractional crop .zpe reopen restores RAW controls',async()=>{
    const s=await getState();return s?.exposure==='0';
  },15000);
  const beforeCropEditHistory=(await getState()).history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-exposure]');input.value='1';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('fractional crop redevelop history',async()=>{
    const s=await getState();return s?.exposure==='1'&&s.history.length>beforeCropEditHistory;
  },15000);
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('fractional crop Undo',async()=> (await getState())?.exposure==='0');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('fractional crop Redo',async()=> (await getState())?.exposure==='1');
  const beforeEditedCropSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('fractional crop re-developed save',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeEditedCropSave,15000);
  const editedCropProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const editedCrop=editedCropProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===croppedEncoded);
  assert(editedCrop?.width===3&&editedCrop?.height===8&&
    editedCrop.rawDng.defaultScale?.join(',')==='2,1'&&
    editedCrop.rawDng.development.exposure===1&&editedCrop.dataUrl!==cropLayer.dataUrl,
    'crop RAW Undo/Redo and .zpe export retain native DNG while regenerating actual pixels');
  // Camera code values are not always linear: verify a real Chromium import
  // applies LinearizationTable before BlackLevel rather than showing identity.
  const lut=Array.from({length:256},(_,i)=>i*200);
  // 8-bit stored samples expand to 16-bit linear domain; WhiteLevel must be
  // interpreted after the LUT, not constrained to the original 8-bit codes.
  const lutRaw=fixture({linearizationTable:lut,samples:[100,100,100],
    blackLevel:2000,whiteLevel:40000});
  const lutEncoded=Buffer.from(lutRaw).toString('base64');
  const lutOracle=decodeDng(lutRaw);
  assert(Array.from(lutOracle.rgba.slice(0,4)).join(',')==='183,183,183,255',
    '16-bit LUT plus BlackLevel/WhiteLevel has an independent gamma pixel oracle');
  const beforeLutHistory=await evaluate(client,'document.querySelectorAll("#historyList .history-row").length');
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(lutEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([bytes],"linear-sensor.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('LinearizationTable RAW real file import and Properties',async()=>
    await evaluate(client,'document.querySelectorAll("#historyList .history-row").length')>beforeLutHistory &&
    await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("LinearizationTable (до BlackLevel)")'),15000);
  const beforeLutSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('LinearizationTable .zpe Blob',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeLutSave,15000);
  const lutProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const lutLayer=lutProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===lutEncoded);
  assert(lutLayer?.rawDng.linearizationTable===true && lutLayer.rawDng.width===4 && lutLayer.rawDng.height===4,
    'real .zpe retains original linearized DNG bytes and provenance');
  const browserLut=await evaluate(client,'(async()=>{const img=new Image();img.src='+JSON.stringify(lutLayer.dataUrl)+';await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(img,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data]})()');
  assert(browserLut.join(',')===Array.from(lutOracle.rgba).join(','),
    'Chromium exported layer pixels exactly match node LUT->black->sRGB oracle');
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(lutProject))+'],"lut-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('LUT .zpe reopen with native source and Properties',async()=>
    await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("LinearizationTable (до BlackLevel)")'),15000);
  const lutRestored=await getState();
  const beforeLutAdjustHistory=lutRestored.history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-exposure]');input.value='1';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('LinearizationTable RAW re-develop commits History',async()=>{
    const s=await getState();
    return s?.exposure==='1'&&s.history.length>beforeLutAdjustHistory;
  },15000);
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('LinearizationTable RAW Undo restores exposure',async()=>
    (await getState())?.exposure==='0',15000);
  const beforeUndoSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('LUT undo .zpe',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeUndoSave,15000);
  const lutUndoProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const lutUndoLayer=lutUndoProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===lutEncoded);
  assert(lutUndoLayer?.dataUrl===lutLayer.dataUrl &&
    lutUndoLayer.rawDng.development.exposure===0,
    'actual RAW LUT Undo restores identical raster source and development state');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('LinearizationTable RAW Redo restores exposure',async()=>
    (await getState())?.exposure==='1',15000);
  const beforeRedoSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('LUT redo .zpe',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>beforeRedoSave,15000);
  const lutRedoProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const lutRedoLayer=lutRedoProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===lutEncoded);
  assert(lutRedoLayer?.rawDng.development.exposure===1 &&
    lutRedoLayer.rawDng.linearizationTable===true && lutRedoLayer.dataUrl!==lutLayer.dataUrl,
    'RAW LUT Redo edits actual raster while preserving original DNG and provenance');
  const redoPixel=await evaluate(client,'(async()=>{const img=new Image();img.src='+JSON.stringify(lutRedoLayer.dataUrl)+';await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(img,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data]})()');
  assert(redoPixel.join(',')===Array.from(decodeDng(lutRaw,{exposure:1}).rgba).join(','),
    'Chromium LUT Redo PNG layer equals re-developed Node pixel oracle');
  // Actual Chrome file:// input of SOF3-compressed 12-bit CFA, not a PNG fallback.
  const jpegRaw=losslessJpegDngFixture({bits:12,matrix1:[0.9,0.1,0,0.1,1,0,0,0.1,1],
    samples:[800,400,200],orientation:6});
  const jpegEncoded=Buffer.from(jpegRaw).toString('base64');
  const jpegExpected=decodeDng(jpegRaw);
  const beforeJpeg=(await getState()).history.length;
  await evaluate(client,'(() => {const b=Uint8Array.from(atob('+JSON.stringify(jpegEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([b],"jpeg-lossless.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  try {
    await waitFor('SOF3 JPEG DNG file:// import / inspector / History',async()=>{
      const s=await getState();
      return s?.history.length>beforeJpeg &&
        await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("Lossless JPEG SOF3")');
    },15000);
  } catch(error) {
    console.log('SOF3 JPEG diagnostic',JSON.stringify(await evaluate(client,'(() => ({history:document.querySelectorAll("#historyList .history-row").length,properties:document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.slice(0,350),status:document.querySelector("#statusText")?.textContent,canvas:document.querySelector("#editorCanvas")?.width,toast:document.querySelector(".toast")?.textContent}))()')));
    throw error;
  }
  const saveJpeg=async()=>{
    const before=await evaluate(client,'window.__rawOutputBlobs.length');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await waitFor('SOF3 .zpe Blob',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>before,15000);
    return await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  };
  const jpegProject=await saveJpeg();
  const jpegLayer=jpegProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===jpegEncoded);
  assert(jpegLayer?.rawDng?.compression===7 && jpegLayer.rawDng.width===4 &&
    jpegLayer.rawDng.height===4 && jpegLayer.width===4 && jpegLayer.height===4,
    'compressed native RAW .zpe provenance and geometry');
  const jpegPixels=await evaluate(client,'(async()=>{const image=new Image();image.src='+JSON.stringify(jpegLayer.dataUrl)+';await image.decode();const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const cx=c.getContext("2d");cx.drawImage(image,0,0);return [...cx.getImageData(0,0,c.width,c.height).data]})()');
  assert(jpegPixels.join(',')===Array.from(jpegExpected.rgba).join(','),
    'Chrome real compressed CFA layer pixels match Node SOF3 RGB oracle');
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(jpegProject))+'],"jpeg-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('SOF3 .zpe reopen inspector',async()=>
    await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("Lossless JPEG SOF3")'),15000);
  const jpegBeforeEdit=(await getState()).history.length;
  await evaluate(client,'(() => {const input=document.querySelector("[data-raw-exposure]");input.value="1";input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('compressed DNG exposure / History',async()=>{
    const s=await getState();return s?.exposure==='1'&&s.history.length>jpegBeforeEdit;
  },15000);
  const editedJpeg=await saveJpeg();
  const jpegEditedLayer=editedJpeg.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===jpegEncoded);
  assert(jpegEditedLayer?.dataUrl!==jpegLayer.dataUrl &&
    jpegEditedLayer.rawDng.development.exposure===1,
    'SOF3 compressed source retained while re-developing pixels');
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('SOF3 Undo',async()=>(await getState())?.exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('SOF3 Redo',async()=>(await getState())?.exposure==='1',15000);
  // Multi-component SOF3 CFA (4 DC channels interleaved across each sensor row).
  // Verify the user-visible pixel pipeline, immutable compressed bytes and saved project.
  const multiRaw=losslessJpegDngFixture({components:4,bits:12,width:4,height:4,
    samples:(x,y,c)=>480+x*23+y*18+c*38,orientation:1});
  const multiEncoded=Buffer.from(multiRaw).toString('base64');
  const multiOracle=decodeDng(multiRaw);
  const multiState=()=>evaluate(client,'(() => {const c=document.querySelector("#editorCanvas");return {w:c?.width,h:c?.height,exposure:document.querySelector("[data-raw-exposure]")?.value,history:document.querySelectorAll("#historyList .history-row").length}})()');
  const beforeMulti=(await multiState()).history;
  await evaluate(client,'(() => {const b=Uint8Array.from(atob('+JSON.stringify(multiEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([b],"four-component-sof3.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('4-component SOF3 import through Chrome FileInput',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.history>beforeMulti&&s.exposure==='0';
  },15000);
  const multiProject=await saveJpeg();
  const multiLayer=multiProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===multiEncoded);
  assert(multiLayer?.width===4&&multiLayer.height===4&&multiLayer.rawDng?.compression===7,
    'multi-component .zpe contains exact compressed RAW and sensor dimensions');
  const multiPixels=await evaluate(client,'(async()=>{const img=new Image();img.src='+JSON.stringify(multiLayer.dataUrl)+';await img.decode();const c=document.createElement("canvas");c.width=4;c.height=4;const cx=c.getContext("2d");cx.drawImage(img,0,0);return [...cx.getImageData(0,0,4,4).data]})()');
  assert(multiPixels.join(',')===Array.from(multiOracle.rgba).join(','),
    'real Chrome PNG layer matches multi-component TIFF SOF3 pixel oracle');
  const historyBeforeMultiReopen=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(multiProject))+'],"multi-sof3-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('multi-component .zpe reopened as a fresh document, not stale input state',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&
      s.history<historyBeforeMultiReopen;
  },15000);
  const beforeMultiEdit=(await multiState()).history;
  await evaluate(client,'(() => {const i=document.querySelector("[data-raw-exposure]");i.value="1";i.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('multi-component RAW exposure and History',async()=>{
    const s=await multiState();return s.exposure==='1'&&s.history>beforeMultiEdit;
  },15000);
  const editedMulti=await saveJpeg();
  const editedMultiLayer=editedMulti.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===multiEncoded);
  assert(editedMultiLayer?.dataUrl!==multiLayer.dataUrl&&editedMultiLayer.rawDng.development.exposure===1,
    'multi-component exposure re-develops pixels while preserving original SOF3 stream');
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('multi-component RAW Undo',async()=>(await multiState()).exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('multi-component RAW Redo',async()=>(await multiState()).exposure==='1',15000);

  // New bounded integration: TIFF edge tiles + DRI/RSTn SOF3 4-component CFA.
  // Real file:// FileInput, project native-byte retention, History and re-development.
  const tiledRaw=tiledLosslessJpegDngFixture({bits:12,width:4,height:4,
    tileWidth:4,tileLength:3,components:4,restartInterval:2,
    samples:(x,y,c)=>480+x*20+y*17+c*36});
  const tiledEncoded=Buffer.from(tiledRaw).toString('base64');
  const tiledOracle=decodeDng(tiledRaw);
  const tiledBefore=(await multiState()).history;
  await evaluate(client,'(() => {const b=Uint8Array.from(atob('+JSON.stringify(tiledEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([b],"tiled-restart-sof3.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('TIFF tiled JPEG with RSTn through real Chromium FileInput',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&s.history>tiledBefore;
  },15000);
  const tiledProject=await saveJpeg();
  const tiledLayer=tiledProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===tiledEncoded);
  assert(tiledLayer?.rawDng.compression===7&&tiledLayer.width===4&&
    tiledLayer.height===4&&tiledLayer.rawDng.width===4&&tiledLayer.rawDng.height===4,
    'actual .zpe keeps TIFF tiled/restart compressed source bytes and sensor dimensions');
  const tiledPixels=await evaluate(client,'(async()=>{const image=new Image();image.src='+JSON.stringify(tiledLayer.dataUrl)+';await image.decode();const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const cx=c.getContext("2d");cx.drawImage(image,0,0);return [...cx.getImageData(0,0,c.width,c.height).data]})()');
  assert(tiledPixels.join(',')===Array.from(tiledOracle.rgba).join(','),
    'Chromium TIFF tiled+RSTn CFA preview equals Node pixel oracle, no tile seam/phase shift');
  const beforeTiledReopen=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(tiledProject))+'],"tiled-restart-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('TIFF tiled+RSTn .zpe reopened with original RAW pixels',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&
      s.history<beforeTiledReopen;
  },15000);
  const beforeTiledEdit=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("[data-raw-exposure]");input.value="1";input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('tiled+RSTn RAW exposure adds History',async()=>{
    const s=await multiState();return s.exposure==='1'&&s.history>beforeTiledEdit;
  },15000);
  const updatedTiledProject=await saveJpeg();
  const updatedTiledLayer=updatedTiledProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===tiledEncoded);
  assert(updatedTiledLayer?.dataUrl!==tiledLayer.dataUrl&&
    updatedTiledLayer.rawDng.development.exposure===1,
    'TIFF tiled+RSTn RAW exposure produces new raster but preserves original DNG');
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('tiled+RSTn RAW Undo',async()=>(await multiState()).exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('tiled+RSTn RAW Redo',async()=>(await multiState()).exposure==='1',15000);

  // SOF3 independent SOS scans (out of order), tiled CFA and restart intervals.
  // Test through the public file input and persisted .zpe, not only a JS decoder.
  const planarRaw=tiledLosslessJpegDngFixture({bits:12,width:4,height:4,
    tileWidth:4,tileLength:3,components:4,scanMode:'planar',scanOrder:[3,1,0,2],
    restartInterval:2,samples:(x,y,c)=>520+x*24+y*15+c*31});
  const planarEncoded=Buffer.from(planarRaw).toString('base64');
  const planarExpected=decodeDng(planarRaw);
  const beforePlanar=(await multiState()).history;
  await evaluate(client,'(() => {const b=Uint8Array.from(atob('+JSON.stringify(planarEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([b],"multiscan-sof3.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('SOF3 multi-SOS tiled DNG imported through real FileInput',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&s.history>beforePlanar;
  },15000);
  const planarProject=await saveJpeg();
  const planarLayer=planarProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===planarEncoded);
  assert(planarLayer?.rawDng?.compression===7 && planarLayer.width===4 && planarLayer.height===4,
    'planar SOF3 .zpe must retain exact RAW JPEG bytes and sensor dimensions');
  const planarPixels=await evaluate(client,'(async()=>{const image=new Image();image.src='+JSON.stringify(planarLayer.dataUrl)+';await image.decode();const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(image,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data]})()');
  assert(planarPixels.join(',')===Array.from(planarExpected.rgba).join(','),
    'real Chromium multi-SOS image pixels must match RAW decode oracle');
  const beforePlanarReopen=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(planarProject))+'],"multiscan-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('SOF3 multi-SOS project reopens as unchanged RAW',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&s.history<beforePlanarReopen;
  },15000);
  const beforePlanarEdit=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("[data-raw-exposure]");input.value="1";input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('SOF3 multi-SOS exposure creates History entry',async()=>{
    const s=await multiState();return s.exposure==='1'&&s.history>beforePlanarEdit;
  },15000);
  const adjustedPlanar=await saveJpeg();
  const adjustedPlanarLayer=adjustedPlanar.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===planarEncoded);
  assert(adjustedPlanarLayer?.dataUrl!==planarLayer.dataUrl&&
    adjustedPlanarLayer.rawDng.development.exposure===1,
    'SOF3 multi-SOS re-development changes raster only, preserving RAW provenance');
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('SOF3 multi-SOS Undo',async()=>(await multiState()).exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('SOF3 multi-SOS Redo',async()=>(await multiState()).exposure==='1',15000);
  // SOF3 two disjoint paired (2+2) SOS groups: real browser import and saved
  // image bytes, not an isolated entropy-decoder assertion.
  const pairedRaw=tiledLosslessJpegDngFixture({bits:12,width:4,height:4,
    tileWidth:4,tileLength:3,components:4,scanMode:'paired',scanOrder:[2,0,3,1],
    restartInterval:2,samples:(x,y,c)=>550+x*21+y*17+c*32});
  const pairedEncoded=Buffer.from(pairedRaw).toString('base64');
  const pairedExpected=decodeDng(pairedRaw);
  const beforePaired=(await multiState()).history;
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(pairedEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([bytes],"paired-sof3.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('paired SOF3 two-SOS FileInput / History',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&s.history>beforePaired;
  },15000);
  const pairedProject=await saveJpeg();
  const pairedLayer=pairedProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===pairedEncoded);
  assert(pairedLayer?.rawDng.compression===7&&pairedLayer.rawDng.width===4&&
    pairedLayer.rawDng.height===4&&pairedLayer.width===4&&pairedLayer.height===4,
    'paired SOF3 .zpe retained exact original compressed DNG and sensor geometry');
  const pairedPixels=await evaluate(client,'(async()=>{const image=new Image();image.src='+JSON.stringify(pairedLayer.dataUrl)+';await image.decode();const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(image,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data]})()');
  assert(pairedPixels.join(',')===Array.from(pairedExpected.rgba).join(','),
    'actual Chrome paired SOF3 output pixels match decoded native CFA oracle');
  const beforePairedReopen=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(pairedProject))+'],"paired-sof3-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('paired SOF3 .zpe reopen',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&s.history<beforePairedReopen;
  },15000);
  const beforePairedEdit=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("[data-raw-exposure]");input.value="1";input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('paired SOF3 exposure / History',async()=>{
    const s=await multiState();return s.exposure==='1'&&s.history>beforePairedEdit;
  },15000);
  const pairedEdited=await saveJpeg();
  const pairedEditedLayer=pairedEdited.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===pairedEncoded);
  assert(pairedEditedLayer?.dataUrl!==pairedLayer.dataUrl&&
    pairedEditedLayer.rawDng.development.exposure===1,
    'paired SOF3 exposure changes developed pixels without changing compressed RAW source');
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('paired SOF3 Undo',async()=>(await multiState()).exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('paired SOF3 Redo',async()=>(await multiState()).exposure==='1',15000);
  // Real browser FileInput with a 1+2+1 mixed SOS, independent scan entropy
  // and DRI/RSTn. Source bytes persist through .zpe, not just the preview.
  const mixedRaw=tiledLosslessJpegDngFixture({bits:12,width:4,height:4,
    tileWidth:4,tileLength:3,components:4,scanMode:'mixed',scanOrder:[3,0,2,1],
    restartInterval:2,samples:(x,y,c)=>520+x*23+y*11+c*29});
  const mixedEncoded=Buffer.from(mixedRaw).toString('base64');
  const mixedExpected=decodeDng(mixedRaw);
  const beforeMixed=(await multiState()).history;
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(mixedEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([bytes],"mixed-sof3.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('mixed SOF3 1+2+1 FileInput / History',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&s.history>beforeMixed;
  },15000);
  const mixedProject=await saveJpeg();
  const mixedLayer=mixedProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===mixedEncoded);
  assert(mixedLayer?.rawDng.compression===7&&mixedLayer.rawDng.width===4&&
    mixedLayer.rawDng.height===4&&mixedLayer.width===4&&mixedLayer.height===4,
    'mixed SOF3 .zpe preserves complete original 1+2+1 DNG and sensor geometry');
  const mixedPixels=await evaluate(client,'(async()=>{const image=new Image();image.src='+JSON.stringify(mixedLayer.dataUrl)+';await image.decode();const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(image,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data]})()');
  assert(mixedPixels.join(',')===Array.from(mixedExpected.rgba).join(','),
    'actual Chrome mixed SOS output pixels match decoded original CFA');
  const beforeMixedReopen=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(mixedProject))+'],"mixed-sof3-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('mixed SOF3 .zpe reopen',async()=>{
    const s=await multiState();return s.w===4&&s.h===4&&s.exposure==='0'&&s.history<beforeMixedReopen;
  },15000);
  const beforeMixedEdit=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("[data-raw-exposure]");input.value="1";input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('mixed SOF3 exposure / History',async()=>{
    const s=await multiState();return s.exposure==='1'&&s.history>beforeMixedEdit;
  },15000);
  const mixedEdited=await saveJpeg();
  const mixedEditedLayer=mixedEdited.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===mixedEncoded);
  assert(mixedEditedLayer?.dataUrl!==mixedLayer.dataUrl&&
    mixedEditedLayer.rawDng.development.exposure===1,
    'mixed SOF3 exposure updates developed pixels without changing source DNG');
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('mixed SOF3 Undo',async()=>(await multiState()).exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('mixed SOF3 Redo',async()=>(await multiState()).exposure==='1',15000);
  // Non-2x2 BlackLevelRepeatDim must affect the real Bayer pixels, not merely metadata.
  const blackLevels=[0,8,16,24,32,40,48,56];
  const blackBytes=fixture({width:4,height:4,blackRepeatDim:[2,4],blackLevel:blackLevels,
    samples:(x,y)=>100+blackLevels[(y%2)*4+x%4]/2});
  const blackEncoded=Buffer.from(blackBytes).toString('base64');
  const blackBefore=(await multiState()).history;
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(blackEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([bytes],"per-site-blacklevel.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('BlackLevel 4x2 real RAW import and Properties',async()=>{
    const s=await multiState();
    return s.w===4&&s.h===4&&s.history>blackBefore&&s.exposure==='0'&&
      await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("Sensor grid 4×2")');
  },15000);
  const blackProject=await saveJpeg();
  const blackLayer=blackProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===blackEncoded);
  assert(blackLayer?.rawDng.blackRepeatDim?.join(',')==='2,4'&&
    blackLayer.rawDng.width===4&&blackLayer.rawDng.height===4,
    'real .zpe retains unchanged DNG and non-2x2 sensor BlackLevel provenance');
  const blackPixels=await evaluate(client,'(async()=>{const image=new Image();image.src='+JSON.stringify(blackLayer.dataUrl)+';await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);return [...ctx.getImageData(0,0,canvas.width,canvas.height).data]})()');
  const midGray=Math.round(255*(1.055*0.5**(1/2.4)-0.055));
  for(let i=0;i<blackPixels.length;i+=4)
    assert(blackPixels.slice(i,i+4).join(',')===[midGray,midGray,midGray,255].join(','),
      'Chrome pixels have sensor-site black subtraction before Bayer demosaic');
  const beforeBlackReopen=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(blackProject))+'],"blacklevel-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('BlackLevel .zpe reopen',async()=>{
    const s=await multiState();return s.exposure==='0'&&s.history<beforeBlackReopen&&
      await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("Sensor grid 4×2")');
  },15000);
  const beforeBlackEdit=(await multiState()).history;
  await evaluate(client,'(() => {const e=document.querySelector("[data-raw-exposure]");e.value="1";e.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('BlackLevel RAW exposure history',async()=>{
    const s=await multiState();return s.exposure==='1'&&s.history>beforeBlackEdit;
  },15000);
  const editedBlack=await saveJpeg();
  const editedBlackLayer=editedBlack.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===blackEncoded);
  assert(editedBlackLayer?.rawDng.blackRepeatDim?.join(',')==='2,4'&&
    editedBlackLayer.rawDng.development.exposure===1&&editedBlackLayer.dataUrl!==blackLayer.dataUrl,
    'BlackLevel re-develop changes raster pixels while retaining original CFA source');
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('BlackLevel RAW Undo',async()=>(await multiState()).exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('BlackLevel RAW Redo',async()=>(await multiState()).exposure==='1',15000);
  // Signed BlackLevelDeltaH/V must affect actual Chrome image pixels in sensor
  // space, and survive .zpe + History without replacing the native DNG bytes.
  const deltaGrid=[20,24,28,32,36,40,44,48];
  const deltaH=[-2,0,2,4],deltaV=[-2,0,2,4];
  const deltaBytes=fixture({width:4,height:4,blackRepeatDim:[2,4],blackLevel:deltaGrid,
    blackDeltaH:deltaH,blackDeltaV:deltaV,
    samples:(x,y)=>Math.round((200+deltaGrid[(y%2)*4+x]+deltaH[x]+deltaV[y])/2)});
  const deltaEncoded=Buffer.from(deltaBytes).toString('base64');
  const deltaBefore=(await multiState()).history;
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(deltaEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([bytes],"sensor-black-delta.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('BlackLevelDeltaH/V real RAW input + Properties',async()=>{
    const s=await multiState();
    return s.w===4&&s.h===4&&s.history>deltaBefore&&s.exposure==='0'&&
      await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("H: sensor columns · V: sensor rows")');
  },15000);
  const deltaProject=await saveJpeg();
  const deltaLayer=deltaProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===deltaEncoded);
  assert(deltaLayer?.rawDng.blackDeltaH===true&&deltaLayer.rawDng.blackDeltaV===true&&
    deltaLayer.rawDng.blackRepeatDim?.join(',')==='2,4',
    'real .zpe persists native DNG plus both sensor delta provenance flags');
  const deltaPixels=await evaluate(client,'(async()=>{const image=new Image();image.src='+JSON.stringify(deltaLayer.dataUrl)+';await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);return [...ctx.getImageData(0,0,canvas.width,canvas.height).data]})()');
  for(let i=0;i<deltaPixels.length;i+=4)
    assert(deltaPixels.slice(i,i+4).join(',')===[midGray,midGray,midGray,255].join(','),
      'Chrome pixel oracle: site black + signed H/V must yield exactly 50% linear gray');
  const beforeDeltaReopen=(await multiState()).history;
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(deltaProject))+'],"black-delta-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('BlackLevelDelta .zpe reopen',async()=>{
    const s=await multiState();
    return s.exposure==='0'&&s.history<beforeDeltaReopen&&
      await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("H: sensor columns · V: sensor rows")');
  },15000);
  const beforeDeltaEdit=(await multiState()).history;
  await evaluate(client,'(() => {const e=document.querySelector("[data-raw-exposure]");e.value="1";e.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('BlackLevelDelta exposure and History',async()=>{
    const s=await multiState();return s.exposure==='1'&&s.history>beforeDeltaEdit;
  },15000);
  const deltaEdited=await saveJpeg();
  const deltaEditedLayer=deltaEdited.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===deltaEncoded);
  assert(deltaEditedLayer?.rawDng.blackDeltaH===true&&deltaEditedLayer.rawDng.blackDeltaV===true&&
    deltaEditedLayer.dataUrl!==deltaLayer.dataUrl,
    'RAW re-develop preserves DNG and metadata while changing developed pixels');
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('BlackLevelDelta Undo',async()=>(await multiState()).exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('BlackLevelDelta Redo',async()=>(await multiState()).exposure==='1',15000);
  // Existing packed TIFF decoder ported into current BlackLevel/SOF3 stack.
  // Compare *actual* Chrome-imported pixels to a separately 16-bit encoded
  // CFA fixture; both synthetic, neither is a camera-authored RAW oracle.
  const packedOptions={width:4,height:4,whiteLevel:4095,
    blackRepeatDim:[2,2],blackLevel:[10,20,30,40],
    blackDeltaH:[0,1,2,3],blackDeltaV:[0,-1,1,0],
    matrix1:[0.9,0.1,0,0.1,1,0,0,0.1,1],illuminant1:21,
    samples:(x,y,c)=>450+x*17+y*29+c*135};
  const packedRaw=fixture({...packedOptions,bits:12});
  const packedOracle=decodeDng(fixture({...packedOptions,bits:16}));
  assert([...decodeDng(packedRaw).rgba].join(',')===[...packedOracle.rgba].join(','),
    'packed 12-bit CFA matches independent 16-bit fixture');
  const packedEncoded=Buffer.from(packedRaw).toString('base64');
  const beforePacked=(await multiState()).history;
  await evaluate(client,'(() => {const b=Uint8Array.from(atob('+JSON.stringify(packedEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([b],"packed-12bit.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('packed 12-bit TIFF DNG real FileInput / Properties',async()=>{
    const st=await multiState();
    return st.w===4&&st.h===4&&st.exposure==='0'&&st.history>beforePacked&&
      await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("12 бит · TIFF uncompressed")');
  },15000);
  const packedProject=await saveJpeg();
  const packedLayer=packedProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===packedEncoded);
  assert(packedLayer?.rawDng.bits===12&&packedLayer.rawDng.compression===1&&
    packedLayer.rawDng.blackDeltaH===true&&packedLayer.rawDng.blackDeltaV===true,
    'RAW .zpe stores unchanged original packed bytes and sensor calibration flags');
  const packedPixels=await evaluate(client,'(async()=>{const i=new Image();i.src='+JSON.stringify(packedLayer.dataUrl)+';await i.decode();const c=document.createElement("canvas");c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext("2d");x.drawImage(i,0,0);return [...x.getImageData(0,0,4,4).data]})()');
  assert(packedPixels.join(',')===[...packedOracle.rgba].join(','),
    'real Chrome developed PNG matches 16-bit CFA pixel oracle');
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(JSON.stringify(packedProject))+'],"packed-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('packed 12-bit .zpe reopens RAW Properties',async()=> (await multiState()).exposure==='0'&&
    await evaluate(client,'document.querySelector("[data-raw-exposure]")?.closest(".prop-grid")?.textContent?.includes("12 бит · TIFF uncompressed")'),15000);
  const packedEditBefore=(await multiState()).history;
  await evaluate(client,'(() => {const e=document.querySelector("[data-raw-exposure]");e.value="1";e.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('packed 12-bit RAW History/exposure',async()=> (await multiState()).exposure==='1'&&
    (await multiState()).history>packedEditBefore,15000);
  await evaluate(client,'document.querySelector("#undoBtn").click();true');
  await waitFor('packed 12-bit RAW Undo',async()=>(await multiState()).exposure==='0',15000);
  await evaluate(client,'document.querySelector("#redoBtn").click();true');
  await waitFor('packed 12-bit RAW Redo',async()=>(await multiState()).exposure==='1',15000);
  // ForwardMatrix is a real colour path: FileInput -> calibrated pixels ->
  // RAW inspector -> non-destructive develop/History -> immutable .zpe reopen.
  const forwardRaw=fixture({matrix1:[1,0,0,0,1,0,0,0,1],
    forward1:[0.7,0.26422,0,0.2,0.8,0,0.1,0.2,0.52521],
    calibration1:[1,0.2,0,0,1,0,0,0,1],
    analogBalance:[1.25,0.8,1.1],cameraSignature:'matchedSig',
    profileSignature:'matchedSig',neutral:[0.75,1,0.9],samples:[40,35,20]});
  const forwardOracle=decodeDng(forwardRaw);
  const forwardEncoded=Buffer.from(forwardRaw).toString('base64');
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(forwardEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),transfer=new DataTransfer();transfer.items.add(new File([bytes],"forward-profile.dng",{type:"image/x-adobe-dng"}));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('ForwardMatrix DNG loads in Chromium',async()=>{
    const s=await getState();
    // The existing layered project composites prior opaque RAW layers too.
    // A per-layer oracle is checked below against the actual saved PNG.
    return s?.exposure==='0' && await evaluate(client,"document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent?.includes('ForwardMatrix')");
  },15000);
  const beforeForwardHistory=(await getState()).history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-exposure]');input.value='1';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('ForwardMatrix exposure commits new History entry',async()=>{
    const s=await getState();return s?.exposure==='1'&&s.history.length>beforeForwardHistory;
  },15000);
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('ForwardMatrix Undo restores exposure',async()=>{
    const s=await getState();return s?.exposure==='0';
  },15000);
  // Existing opaque layers can cover the canvas. Inspect the actual imported
  // RAW layer instead of incorrectly equating the composite with its pixels.
  const forwardBeforeUndoSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('ForwardMatrix Undo .zpe saved',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>forwardBeforeUndoSave,15000);
  const forwardUndoProject=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  const forwardUndoLayer=forwardUndoProject.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===forwardEncoded);
  assert(forwardUndoLayer?.rawDng.development.exposure===0,'ForwardMatrix Undo preserves native source');
  const forwardUndoPixels=await evaluate(client,'(async()=>{const img=new Image();img.src='+JSON.stringify(forwardUndoLayer.dataUrl)+';await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(img,0,0);return [...ctx.getImageData(0,0,4,4).data];})()');
  assert(forwardUndoPixels.join(',')===Array.from(forwardOracle.rgba).join(','),
    'real Chromium RAW layer Undo restores calibrated ForwardMatrix pixels');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('ForwardMatrix Redo restores exposure',async()=>{
    const s=await getState();return s?.exposure==='1';
  },15000);
  const forwardBeforeSave=await evaluate(client,'window.__rawOutputBlobs.length');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
  await waitFor('ForwardMatrix .zpe saved',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>forwardBeforeSave,15000);
  const forwardSaved=await evaluate(client,"(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()");
  const forwardLayer=forwardSaved.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===forwardEncoded);
  assert(forwardLayer?.rawDng?.colorPipeline==='forward-d50-v1' &&
    forwardLayer.rawDng.development.exposure===1 &&
    forwardLayer.rawDng.dataUrl.split(',')[1]===forwardEncoded,
    'ForwardMatrix .zpe preserves rendering provenance and unmodified camera bytes');
  const forwardLayerPixels=await evaluate(client,'(async()=>{const img=new Image();img.src='+JSON.stringify(forwardLayer.dataUrl)+';await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(img,0,0);return [...ctx.getImageData(0,0,4,4).data];})()');
  assert(forwardLayerPixels.join(',')===Array.from(decodeDng(forwardRaw,{exposure:1}).rgba).join(','),
    'actual Chrome ForwardMatrix RAW layer matches independent Node TIFF profile oracle');
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),transfer=new DataTransfer();transfer.items.add(new File(['+JSON.stringify(JSON.stringify(forwardSaved))+'],"forward-reopen.zpe",{type:"application/json"}));input.files=transfer.files;const previous=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=previous;}return true;})()');
  await waitFor('ForwardMatrix .zpe reopens with pixels and controls',async()=>{
    const s=await getState();return s?.exposure==='1' &&
      await evaluate(client,"document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent?.includes('ForwardMatrix')");
  },15000);
  // Tonal development is not a cosmetic CSS filter: test the RAW layer's
  // decoded PNG against independent Node linear-domain Bayer development.
  const tonalRaw=fixture({matrix1:[0.9,0.1,0,0.1,1,0,0,0.1,1],illuminant1:21,
    samples:(x,y)=>x+y<3?35:145});
  const tonalEncoded=Buffer.from(tonalRaw).toString('base64');
  const tonalBase=decodeDng(tonalRaw);
  const tonalShadowOracle=decodeDng(tonalRaw,{shadows:1});
  const tonalBothOracle=decodeDng(tonalRaw,{shadows:1,highlights:-1});
  assert(Array.from(tonalBase.rgba).join(',')!==Array.from(tonalShadowOracle.rgba).join(',') &&
    Array.from(tonalShadowOracle.rgba).join(',')!==Array.from(tonalBothOracle.rgba).join(','),
    'RAW fixture contains pixels affected by both linear tonal controls');
  const beforeTonalImport=(await getState()).history.length;
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+JSON.stringify(tonalEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),transfer=new DataTransfer();transfer.items.add(new File([bytes],"tonal-sensor.dng",{type:"image/x-adobe-dng"}));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('linear tone RAW import and Properties controls',async()=>{
    const s=await getState();
    return s?.history.length>beforeTonalImport &&
      await evaluate(client,"document.querySelector('[data-raw-highlights]')?.value==='0' && document.querySelector('[data-raw-shadows]')?.value==='0'");
  },15000);
  async function captureTonal(){
    const before=await evaluate(client,'window.__rawOutputBlobs.length');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await waitFor('tonal .zpe save Blob',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>before,15000);
    const project=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
    const layer=project.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===tonalEncoded);
    assert(layer&&layer.rawDng.dataUrl.split(',')[1]===tonalEncoded,
      'Chrome .zpe tone editing retains exact source DNG bytes');
    const pixels=await evaluate(client,'(async()=>{const img=new Image();img.src='+JSON.stringify(layer.dataUrl)+';await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(img,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data];})()');
    return {project,layer,pixels};
  }
  const rawTonalBaseline=await captureTonal();
  assert(rawTonalBaseline.pixels.join(',')===Array.from(tonalBase.rgba).join(','),
    'Chrome default tonal rendering exact Bayer oracle');
  const beforeShadows=(await getState()).history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-shadows]');input.value='1';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('RAW shadows commit into History',async()=>{
    const s=await getState();return s?.history.length>beforeShadows &&
      await evaluate(client,"document.querySelector('[data-raw-shadows]')?.value==='1'");
  },15000);
  const shadowSaved=await captureTonal();
  assert(shadowSaved.layer.rawDng.development.shadows===1 &&
    shadowSaved.layer.rawDng.development.highlights===0 &&
    shadowSaved.pixels.join(',')===Array.from(tonalShadowOracle.rgba).join(','),
    'Chrome shadows change real linear-developed RAW bitmap and .zpe parameters');
  const beforeHighlights=(await getState()).history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-highlights]');input.value='-1';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('RAW highlights commit into History',async()=>{
    const s=await getState();return s?.history.length>beforeHighlights &&
      await evaluate(client,"document.querySelector('[data-raw-highlights]')?.value==='-1'");
  },15000);
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('RAW highlights Undo restores zero control',async()=>
    await evaluate(client,"document.querySelector('[data-raw-highlights]')?.value==='0' && document.querySelector('[data-raw-shadows]')?.value==='1'"),15000);
  const tonalUndo=await captureTonal();
  assert(tonalUndo.pixels.join(',')===Array.from(tonalShadowOracle.rgba).join(','),
    'RAW Undo restores actual shadow-only pixels');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('RAW highlights Redo restores minus one',async()=>
    await evaluate(client,"document.querySelector('[data-raw-highlights]')?.value==='-1' && document.querySelector('[data-raw-shadows]')?.value==='1'"),15000);
  const tonalSaved=await captureTonal();
  assert(tonalSaved.layer.rawDng.development.highlights===-1 &&
    tonalSaved.layer.rawDng.development.shadows===1 &&
    tonalSaved.pixels.join(',')===Array.from(tonalBothOracle.rgba).join(','),
    'RAW Redo stores exact highlights/shadows calibrated pixels and .zpe metadata');
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),transfer=new DataTransfer();transfer.items.add(new File(['+JSON.stringify(JSON.stringify(tonalSaved.project))+'],"tonal-reopen.zpe",{type:"application/json"}));input.files=transfer.files;const previous=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=previous;}return true;})()');
  await waitFor('tonal .zpe reopen restores UI and source',async()=>
    await evaluate(client,"document.querySelector('[data-raw-highlights]')?.value==='-1' && document.querySelector('[data-raw-shadows]')?.value==='1'"),15000);
  const tonalReopened=await captureTonal();
  assert(tonalReopened.pixels.join(',')===Array.from(tonalBothOracle.rgba).join(','),
    'RAW .zpe reopen retains actual tonal-developed pixels');
  // RAW contrast must change the actual developed PNG, not only canvas CSS.
  const contrastAmount=0.8;
  const contrastOracle=decodeDng(tonalRaw,{shadows:1,highlights:-1,contrast:contrastAmount});
  const beforeContrast=(await getState()).history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-contrast]');input.value='0.8';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('linear contrast commit in RAW Properties',async()=>{
    const state=await getState();
    return state?.history.length>beforeContrast &&
      await evaluate(client,"document.querySelector('[data-raw-contrast]')?.value==='0.8'");
  },15000);
  const contrastSaved=await captureTonal();
  assert(contrastSaved.layer.rawDng.development.contrast===contrastAmount &&
    contrastSaved.pixels.join(',')===Array.from(contrastOracle.rgba).join(','),
    'RAW contrast modifies native scene-linear develop output and .zpe recipe');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('RAW contrast Undo restores neutral UI',async()=>
    await evaluate(client,"document.querySelector('[data-raw-contrast]')?.value==='0'"),15000);
  assert((await captureTonal()).pixels.join(',')===Array.from(tonalBothOracle.rgba).join(','),
    'RAW contrast Undo restores previous actual RGB pixels');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('RAW contrast Redo restores edited UI',async()=>
    await evaluate(client,"document.querySelector('[data-raw-contrast]')?.value==='0.8'"),15000);
  const contrastRedone=await captureTonal();
  assert(contrastRedone.pixels.join(',')===Array.from(contrastOracle.rgba).join(','),
    'RAW contrast Redo restores exact developed RGB pixels');
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),transfer=new DataTransfer();transfer.items.add(new File(['+JSON.stringify(JSON.stringify(contrastRedone.project))+'],"contrast-reopen.zpe",{type:"application/json"}));input.files=transfer.files;const previous=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=previous;}return true;})()');
  await waitFor('RAW contrast .zpe reopen retains control',async()=>
    await evaluate(client,"document.querySelector('[data-raw-contrast]')?.value==='0.8'"),15000);
  assert((await captureTonal()).pixels.join(',')===Array.from(contrastOracle.rgba).join(','),
    'RAW contrast .zpe reopen retains preview and original sensor bytes');
  const beforeResetContrast=(await getState()).history.length;
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-contrast]');input.value='0';input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('RAW contrast neutral reset before preset regressions',async()=>
    (await getState())?.history.length>beforeResetContrast &&
    await evaluate(client,"document.querySelector('[data-raw-contrast]')?.value==='0'"),15000);
  // Presets are persisted per browser, while applied development remains in .zpe.
  await evaluate(client,"(() => {const input=document.querySelector('[data-raw-preset-name]');input.value='Studio Shadows';document.querySelector('[data-raw-preset-save]').click();return true;})()");
  assert(await evaluate(client,"document.querySelector('[data-raw-preset-select]')?.value==='Studio Shadows'"),
    'RAW preset saved and selectable in real Chromium Properties');
  assert(await evaluate(client,"JSON.parse(localStorage.getItem('zeter.rawDevelopmentPresets.v1')).presets.some(p=>p.name==='Studio Shadows'&&p.development.shadows===1&&p.development.highlights===-1)"),
    'RAW preset persists its actual parameters to localStorage, not a screenshot');
  await evaluate(client,"document.querySelector('[data-raw-reset]').click();true");
  await waitFor('RAW preset fixture reset committed',async()=>await evaluate(client,
    "document.querySelector('[data-raw-shadows]')?.value==='0' && document.querySelector('[data-raw-highlights]')?.value==='0'"),15000);
  const beforePresetApply=(await getState()).history.length;
  await evaluate(client,"(() => {const selector=document.querySelector('[data-raw-preset-select]');selector.value='Studio Shadows';selector.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-raw-preset-apply]').click();return true;})()");
  await waitFor('RAW preset one History commit and re-develop',async()=>{
    const s=await getState();
    return s.history.length===beforePresetApply+1 &&
      await evaluate(client,"document.querySelector('[data-raw-shadows]')?.value==='1' && document.querySelector('[data-raw-highlights]')?.value==='-1'");
  },15000);
  const appliedPreset=await captureTonal();
  assert(appliedPreset.pixels.join(',')===Array.from(tonalBothOracle.rgba).join(',') &&
    appliedPreset.layer.rawDng.development.shadows===1 &&
    appliedPreset.layer.rawDng.development.highlights===-1,
    'preset applies actual linear RAW pixels and persists development to .zpe');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('RAW preset single Undo',async()=>await evaluate(client,
    "document.querySelector('[data-raw-shadows]')?.value==='0' && document.querySelector('[data-raw-highlights]')?.value==='0'"),15000);
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('RAW preset single Redo',async()=>await evaluate(client,
    "document.querySelector('[data-raw-shadows]')?.value==='1' && document.querySelector('[data-raw-highlights]')?.value==='-1'"),15000);
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),transfer=new DataTransfer();transfer.items.add(new File(['+
    JSON.stringify(JSON.stringify(appliedPreset.project))+'],"preset-reopen.zpe",{type:"application/json"}));input.files=transfer.files;const prior=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=prior;}return true;})()');
  await waitFor('RAW preset reopened .zpe and local library',async()=>await evaluate(client,
    "document.querySelector('[data-raw-highlights]')?.value==='-1' && document.querySelector('[data-raw-preset-select] option[value=\"Studio Shadows\"]')!==null"),15000);
  const presetReopened=await captureTonal();
  assert(presetReopened.pixels.join(',')===Array.from(tonalBothOracle.rgba).join(','),
    'RAW preset .zpe reopened pixel oracle survives app re-render');
  // Export a real downloaded Blob, delete the browser library, then import using a real file input.
  const blobsBeforePresets=await evaluate(client,'window.__rawOutputBlobs.length');
  await evaluate(client,"document.querySelector('[data-raw-preset-export]').click();true");
  await waitFor('RAW preset JSON export Blob',async()=>await evaluate(client,
    'window.__rawOutputBlobs.length')>blobsBeforePresets,15000);
  const portablePresets=await evaluate(client,
    '(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
  assert(portablePresets.format==='zeter-raw-development-presets' && portablePresets.schema===1 &&
    portablePresets.presets?.length===1 && portablePresets.presets[0].name==='Studio Shadows' &&
    !JSON.stringify(portablePresets).includes('data:application/x-adobe-dng'),
    'real UI JSON contains only transferable RAW settings, never sensor bytes');
  await evaluate(client,"(() => {const p=document.querySelector('[data-raw-preset-select]');p.value='Studio Shadows';p.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-raw-preset-delete]').click();return true;})()");
  assert(await evaluate(client,"!JSON.parse(localStorage.getItem('zeter.rawDevelopmentPresets.v1')).presets.some(p=>p.name==='Studio Shadows')"),
    'RAW preset deletion removes only its local browser recipe');
  const transferPresetFile=async text=>evaluate(client,'(() => {const input=document.querySelector("[data-raw-preset-file]"),t=new DataTransfer();t.items.add(new File(['+
    JSON.stringify(text)+'],"transfer.json",{type:"application/json"}));input.files=t.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  const tampered={...portablePresets,presets:[{name:'Malicious',
    development:{...portablePresets.presets[0].development,dataUrl:'fake-DNG'}}]};
  await transferPresetFile(JSON.stringify(tampered));
  await evaluate(client,'new Promise(resolve=>setTimeout(resolve,200))');
  assert(await evaluate(client,"JSON.parse(localStorage.getItem('zeter.rawDevelopmentPresets.v1')).presets.length===0"),
    'invalid portable payload cannot partially overwrite browser presets');
  await evaluate(client,'(() => {window.__rawPresetConfirmCalled=false;window.__oldRawPresetConfirm=window.confirm;window.confirm=()=>{window.__rawPresetConfirmCalled=true;return false;};return true;})()');
  await transferPresetFile(JSON.stringify(portablePresets));
  await evaluate(client,'new Promise(resolve=>setTimeout(resolve,200))');
  assert(await evaluate(client,"window.__rawPresetConfirmCalled && JSON.parse(localStorage.getItem('zeter.rawDevelopmentPresets.v1')).presets.length===0"),
    'cancelled RAW preset import must leave existing library unchanged');
  await evaluate(client,'(() => {window.__rawPresetConfirmCalled=false;window.confirm=()=>{window.__rawPresetConfirmCalled=true;return true;};return true;})()');
  await transferPresetFile(JSON.stringify(portablePresets));
  await waitFor('RAW portable preset imported from user-visible file input',async()=>await evaluate(client,
    "document.querySelector('[data-raw-preset-select] option[value=\\\"Studio Shadows\\\"]')!==null"),15000);
  assert(await evaluate(client,
    "window.__rawPresetConfirmCalled===true && JSON.parse(localStorage.getItem('zeter.rawDevelopmentPresets.v1')).presets[0].development.shadows===1"),
    'RAW file import needs explicit confirmation and persists exact tone settings');
  await evaluate(client,'(() => {window.confirm=window.__oldRawPresetConfirm;return true;})()');
  await evaluate(client,"document.querySelector('[data-raw-reset]').click();true");
  await waitFor('RAW reset before imported preset apply',async()=>await evaluate(client,
    "document.querySelector('[data-raw-shadows]')?.value==='0' && document.querySelector('[data-raw-highlights]')?.value==='0'"),15000);
  const beforePortableApply=(await getState()).history.length;
  await evaluate(client,"(() => {const select=document.querySelector('[data-raw-preset-select]');select.value='Studio Shadows';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-raw-preset-apply]').click();return true;})()");
  await waitFor('Imported RAW preset real re-develop and one History commit',async()=>{
    const state=await getState();
    return state.history.length===beforePortableApply+1 &&
      await evaluate(client,"document.querySelector('[data-raw-shadows]')?.value==='1'");
  },15000);
  assert((await captureTonal()).pixels.join(',')===Array.from(tonalBothOracle.rgba).join(','),
    'imported portable recipe reproduces calibrated RAW pixel oracle without modifying DNG');
  await evaluate(client,"document.querySelector('[data-raw-reset]').click();true");
  await waitFor('RAW reset clears both tonal controls',async()=>
    await evaluate(client,"document.querySelector('[data-raw-highlights]')?.value==='0' && document.querySelector('[data-raw-shadows]')?.value==='0'"),15000);
  // Real Chromium file:// import of the alternate DNG capture white point:
  // AsShotWhiteXY (CIE xy) without AsShotNeutral. Native bytes stay authoritative.
  const whiteXYRaw=fixture({matrix1:[1,0,0,0,1,0,0,0,1],neutral:null,
    whiteXY:[0.3457,0.3585],samples:[70,55,40]});
  const whiteXYEncoded=Buffer.from(whiteXYRaw).toString('base64');
  const xyExpected=decodeDng(whiteXYRaw);
  const xyHistoryBefore=await evaluate(client,"document.querySelectorAll('#historyList .history-row').length");
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+
    JSON.stringify(whiteXYEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([bytes],"white-xy.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('real AsShotWhiteXY DNG imported with Properties',async()=>{
    const ui=await evaluate(client,"(() => ({history:document.querySelectorAll('#historyList .history-row').length,props:document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent||''}))()");
    return ui?.history>xyHistoryBefore && ui.props.includes('AsShotWhiteXY');
  },15000);
  const captureWhiteXY=async()=>{
    const before=await evaluate(client,'window.__rawOutputBlobs.length');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await waitFor('AsShotWhiteXY .zpe Blob',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>before,15000);
    const saved=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
    const raw=saved.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===whiteXYEncoded);
    assert(raw?.rawDng?.whiteBalanceSource==='as-shot-white-xy' &&
      raw.rawDng.dataUrl.split(',')[1]===whiteXYEncoded,
      'Chrome .zpe preserves AsShotWhiteXY provenance and byte-identical sensor source');
    const pixels=await evaluate(client,'(async()=>{const img=new Image();img.src='+JSON.stringify(raw.dataUrl)+';await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(img,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data];})()');
    return {saved,raw,pixels};
  };
  const xyBeforeEdit=await captureWhiteXY();
  assert(xyBeforeEdit.pixels.join(',')===Array.from(xyExpected.rgba).join(','),
    'real Chrome AsShotWhiteXY preview equals sensor calibrated pixel oracle');
  const xyHistoryEdit=await evaluate(client,"document.querySelectorAll('#historyList .history-row').length");
  await evaluate(client,"(() => {const n=document.querySelector('[data-raw-exposure]');n.value='1';n.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('AsShotWhiteXY exposure commits History',async()=>{
    const v=await evaluate(client,"(() => ({exposure:document.querySelector('[data-raw-exposure]')?.value,history:document.querySelectorAll('#historyList .history-row').length}))()");
    return v?.exposure==='1'&&v.history>xyHistoryEdit;
  },15000);
  const xyExposed=await captureWhiteXY();
  assert(xyExposed.raw.rawDng.development.exposure===1 &&
    xyExposed.pixels.join(',')===Array.from(decodeDng(whiteXYRaw,{exposure:1}).rgba).join(','),
    'AsShotWhiteXY exposure re-develops actual calibrated pixels in Chrome');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('AsShotWhiteXY Undo',async()=>await evaluate(client,
    "document.querySelector('[data-raw-exposure]')?.value==='0'"),15000);
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('AsShotWhiteXY Redo',async()=>await evaluate(client,
    "document.querySelector('[data-raw-exposure]')?.value==='1'"),15000);
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+
    JSON.stringify(JSON.stringify(xyExposed.saved))+'],"white-xy-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('AsShotWhiteXY .zpe reopen retains native WB source',async()=>await evaluate(client,
    "document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent?.includes('AsShotWhiteXY') && document.querySelector('[data-raw-exposure]')?.value==='1'"),15000);
  const xyReopened=await captureWhiteXY();
  assert(xyReopened.pixels.join(',')===xyExposed.pixels.join(','),
    'AsShotWhiteXY .zpe reopen preserves pixel-exact developed display');
  // Inline camera profile BaselineExposureOffset is additive scene-linear EV.
  const profileRaw=fixture({matrix1:[1,0,0,0,1,0,0,0,1],
    samples:[40,35,25],baselineExposure:0.5,baselineExposureOffset:-0.75});
  const profileEncoded=Buffer.from(profileRaw).toString('base64');
  const profileHistoryBefore=await evaluate(client,"document.querySelectorAll('#historyList .history-row').length");
  await evaluate(client,'(() => {const bytes=Uint8Array.from(atob('+
    JSON.stringify(profileEncoded)+'),c=>c.charCodeAt(0));const input=document.querySelector("#fileInput"),dt=new DataTransfer();dt.items.add(new File([bytes],"profile-offset.dng",{type:"image/x-adobe-dng"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('real profile-offset DNG in Properties',async()=>{
    const ui=await evaluate(client,"(() => ({history:document.querySelectorAll('#historyList .history-row').length,props:document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent||''}))()");
    return ui?.history>profileHistoryBefore && ui.props.includes('BaselineExposureOffset-0.75 EV');
  },15000);
  const captureProfile=async()=>{
    const before=await evaluate(client,'window.__rawOutputBlobs.length');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await waitFor('profile offset .zpe Blob',async()=>await evaluate(client,'window.__rawOutputBlobs.length')>before,15000);
    const saved=await evaluate(client,'(async()=>JSON.parse(await window.__rawOutputBlobs.at(-1).text()))()');
    const layer=saved.layers.find(l=>l.rawDng?.dataUrl.split(',')[1]===profileEncoded);
    assert(layer?.rawDng?.baselineExposure===0.5 && layer?.rawDng?.baselineExposureOffset===-0.75,
      'real Chrome .zpe retains both camera and profile EV provenance');
    const pixels=await evaluate(client,'(async()=>{const img=new Image();img.src='+
      JSON.stringify(layer.dataUrl)+';await img.decode();const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(img,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data];})()');
    return {saved,layer,pixels};
  };
  const profileOriginal=await captureProfile();
  assert(profileOriginal.pixels.join(',')===Array.from(decodeDng(profileRaw).rgba).join(','),
    'real Chrome preview applies signed profile EV before transfer and keeps original DNG bytes');
  const profileHistoryEdit=await evaluate(client,"document.querySelectorAll('#historyList .history-row').length");
  await evaluate(client,"(() => {const n=document.querySelector('[data-raw-exposure]');n.value='1';n.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('profile offset exposure commits a new History entry',async()=>{
    const state=await evaluate(client,"(() => ({exposure:document.querySelector('[data-raw-exposure]')?.value,history:document.querySelectorAll('#historyList .history-row').length}))()");
    return state?.exposure==='1'&&state.history>profileHistoryEdit;
  },15000);
  const profileExposed=await captureProfile();
  assert(profileExposed.pixels.join(',')===Array.from(decodeDng(profileRaw,{exposure:1}).rgba).join(','),
    'profile offset + user exposure regenerate calibrated pixels');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('profile offset Undo returns manual EV to zero',async()=>
    await evaluate(client,"document.querySelector('[data-raw-exposure]')?.value==='0'"),15000);
  const profileUndone=await captureProfile();
  assert(profileUndone.pixels.join(',')===profileOriginal.pixels.join(','),
    'profile offset Undo restores pixel-exact developed RAW');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('profile offset Redo restores manual EV',async()=>
    await evaluate(client,"document.querySelector('[data-raw-exposure]')?.value==='1'"),15000);
  const profileRedone=await captureProfile();
  assert(profileRedone.pixels.join(',')===profileExposed.pixels.join(','),
    'profile offset Redo restores pixel-exact developed RAW');
  await evaluate(client,'(() => {const input=document.querySelector("#projectInput"),dt=new DataTransfer();dt.items.add(new File(['+
    JSON.stringify(JSON.stringify(profileExposed.saved))+'],"profile-offset-reopen.zpe",{type:"application/json"}));input.files=dt.files;const old=window.confirm;window.confirm=()=>true;try{input.dispatchEvent(new Event("change",{bubbles:true}));}finally{window.confirm=old;}return true;})()');
  await waitFor('profile offset .zpe reopen restores native metadata and controls',async()=>await evaluate(client,
    "document.querySelector('[data-raw-exposure]')?.closest('.prop-grid')?.textContent?.includes('BaselineExposureOffset-0.75 EV') && document.querySelector('[data-raw-exposure]')?.value==='1'"),15000);
  const profileReopened=await captureProfile();
  assert(profileReopened.pixels.join(',')===profileExposed.pixels.join(',') &&
    profileReopened.layer.rawDng.dataUrl.split(',')[1]===profileEncoded,
    'real Chrome .zpe reopen preserves calibrated pixels and byte-identical source');
  const {verifyBrowserRawDemosaic}=await import('./browser-raw-demosaic-check.mjs');
  await verifyBrowserRawDemosaic({client,evaluate,waitFor,assert});
  // Real file:// 9 MP editor canvas, deliberately synthetic PNG preview with
  // preserved small DNG metadata. This tests display tiling, NOT camera pixels.
  const largePreview=await evaluate(client,`(() => {
    const c=document.createElement('canvas');c.width=3001;c.height=3001;
    const ctx=c.getContext('2d');ctx.fillStyle='#b0b0b0';ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,32,32);
    ctx.fillStyle='#000000';ctx.fillRect(200,200,32,32);
    const base=${JSON.stringify(profileExposed.layer)};
    const layer={...base,id:'raw-9mp-display-tiling',name:'Synthetic 9MP RAW display',
      x:0,y:0,width:c.width,height:c.height,dataUrl:c.toDataURL('image/png')};
    const project={version:1,name:'Synthetic 9MP display-tile probe',width:c.width,height:c.height,
      background:'transparent',selectedLayerId:layer.id,groups:[],layers:[layer]};
    const input=document.querySelector('#projectInput'),dt=new DataTransfer();
    dt.items.add(new File([JSON.stringify(project)],'raw-9mp-display.zpe',{type:'application/json'}));
    input.files=dt.files;const previous=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}finally{window.confirm=previous;}
    return {width:c.width,height:c.height};
  })()`);
  assert(largePreview.width*largePreview.height>8_000_000,'fixture exceeds old 8 MP guard');
  await waitFor('9 MP RAW display project opened',async()=>await evaluate(client,
    "document.querySelector('#editorCanvas')?.width===3001 && document.querySelector('#editorCanvas')?.height===3001 && !!document.querySelector('[data-raw-clipping-warning]')"),30000);
  const largeHistory=await evaluate(client,"document.querySelectorAll('#historyList .history-row').length");
  const largeBefore=await evaluate(client,"(() => {const c=document.querySelector('#editorCanvas').getContext('2d');return {white:[...c.getImageData(0,0,1,1).data],black:[...c.getImageData(200,200,1,1).data]};})()");
  assert(largeBefore.white.join(',')==='255,255,255,255'&&largeBefore.black.join(',')==='0,0,0,255',
    'large editor preview source contains known white and black reference pixels');
  await evaluate(client,"(() => {const box=document.querySelector('[data-raw-clipping-warning]');box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('9 MP tiled display warning completes',async()=>await evaluate(client,
    "(() => {const c=document.querySelector('#editorCanvas').getContext('2d'),s=document.querySelector('[data-raw-clipping-summary]')?.textContent||'';return s.includes('Света:') && [...c.getImageData(0,0,1,1).data].join(',')==='255,128,255,255' && [...c.getImageData(200,200,1,1).data].join(',')==='0,128,128,255';})()"),30000);
  assert(await evaluate(client,"document.querySelectorAll('#historyList .history-row').length")===largeHistory,
    '9 MP display-only clipping does not commit History');
  await evaluate(client,"(() => {const box=document.querySelector('[data-raw-clipping-warning]');box.checked=false;box.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await waitFor('9 MP warning disabled restores original pixels',async()=>await evaluate(client,
    "(() => {const c=document.querySelector('#editorCanvas').getContext('2d');return [...c.getImageData(0,0,1,1).data].join(',')==='255,255,255,255' && [...c.getImageData(200,200,1,1).data].join(',')==='0,0,0,255';})()"),30000);
  console.log('CAP-RAW-DNG-DISPLAY-CLIPPING 9MP real Chromium file:// tiled overlay/on/off/History PASS (synthetic preview)');
  console.log('CAP-RAW-DNG-BASELINE-OFFSET Chromium file:// profile EV, original bytes, pixel oracle, History Undo/Redo and .zpe PASS');
  console.log('CAP-RAW-DNG-ASSHOT-WHITE-XY Chromium file:// CIE xy -> camera neutral, Properties, .zpe, native byte/pixel oracle, exposure History Undo/Redo PASS');
  console.log('CAP-RAW-DNG-DEVELOP-PRESETS Chrome file:// save/apply localStorage, one History commit, exact pixel oracle, Undo/Redo, .zpe reopen and delete PASS');
  console.log('CAP-RAW-DNG-PRESET-EXPORT-IMPORT Chrome file:// JSON Blob, tampered/cancel no-op, file import, calibrated pixels + History PASS');
  console.log('DNG browser: scene-linear Highlights/Shadows/Contrast, real pixels, Undo/Redo, reset and .zpe reopen PASS');
  console.log('DNG browser: ForwardMatrix with camera calibration/analog gain, History/.zpe PASS');
  console.log('CAP-RAW-DNG-PACKED-BAYER Chromium file:// packed CFA 12-bit/BlackLevelDelta, pixel oracle, .zpe, History/Undo/Redo PASS');
  console.log('CAP-RAW-DNG-BLACKLEVEL-DELTA Chromium file:// sensor H/V, pixel oracle, .zpe, History/Undo/Redo PASS');
  console.log('CAP-RAW-DNG-BLACKLEVEL-REPEAT Chromium file:// 4x2 sensor black, pixels, Properties, .zpe, Undo/Redo PASS');
  console.log('CAP-RAW-DNG-JPEG-MIXED-SCANS Chromium file:// 1+2+1 TIFF tiles/RSTn, pixels/.zpe/History/Undo/Redo PASS');
  console.log('CAP-RAW-DNG-JPEG-PARTIAL-SCANS Chromium file:// paired SOS 2+2, tile/RST, exact pixels/.zpe, History, Undo/Redo PASS');
  console.log('CAP-RAW-DNG-JPEG-MULTISCAN Chromium file:// 4 separate SOS, TIFF tiles, RSTn, pixels, .zpe, History PASS');
  console.log('CAP-RAW-DNG-JPEG-RESTART-TILED Chromium file:// FileInput, pixels, .zpe, exposure, History, Undo/Redo PASS');
  console.log('CAP-RAW-DNG multi-component SOF3 Chrome file:// 4-component pixel/.zpe/exposure/Undo/Redo PASS');
  console.log('CAP-RAW-DNG SOF3 lossless JPEG Chrome file:// FileInput, pixels, .zpe, exposure/Undo/Redo PASS');
  console.log('CAP-RAW-DNG Chrome file:// ColorMatrix, DefaultCrop/Scale, LinearizationTable, Orientation, History, .zpe, Undo/Redo, PNG/PSD/PSB PASS');
}
