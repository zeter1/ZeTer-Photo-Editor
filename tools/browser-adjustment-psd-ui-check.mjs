import { decodePsd } from '../src/formats/psd.js';
// CAP-ADJ-PSD-UI: production file:// browser, real Layer menu, Export and Open flows.
// The only fixture is a gray editable source; no codec, editor state or render mocks.
export async function verifyBrowserAdjustmentPsdUi({ client, evaluate, waitFor, assert }) {
  const run = fn => evaluate(client, '(' + fn.toString() + ')()');
  function loadGraySource() {
    const shape = { id:'ui-gray-source', type:'shape', name:'UI gray source',
      shape:'rect', x:0, y:0, width:64, height:64, scaleX:1, scaleY:1,
      rotation:0, fill:'#808080', stroke:'transparent', strokeWidth:0,
      visible:true, locked:false, opacity:1, blendMode:'source-over' };
    const source = { version:1, name:'Adjustment PSD UI', width:64, height:64,
      background:'transparent', selectedLayerId:shape.id, groups:[], layers:[shape] };
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(source)], 'ui-source.zpe',
      { type:'application/json' }));
    const input = document.querySelector('#projectInput');
    input.files = transfer.files;
    const original = window.confirm; window.confirm = () => true;
    try { input.dispatchEvent(new Event('change', { bubbles:true })); }
    finally { window.confirm = original; }
    return true;
  }
  function pixels() {
    const canvas = document.querySelector('#editorCanvas');
    if (!canvas || canvas.width !== 64 || canvas.height !== 64) return null;
    const data = canvas.getContext('2d').getImageData(32,32,1,1).data;
    return [...data];
  }
  function createLevels() {
    document.querySelector('.menu-button[data-menu="layer"]').click();
    const menu = [...document.querySelectorAll('#menuPopover .menu-item')]
      .find(item=>item.textContent.includes('Новый корректирующий слой'));
    if (!menu || menu.disabled) return 'menu missing';
    menu.click();
    const form=document.querySelector('form.modal');
    if (!form?.elements.kind) return 'picker missing';
    form.elements.kind.value='levels';
    form.requestSubmit();
    return 'created';
  }
  function createCurves() {
    document.querySelector('.menu-button[data-menu="layer"]').click();
    const menu = [...document.querySelectorAll('#menuPopover .menu-item')]
      .find(item=>item.textContent.includes('Новый корректирующий слой'));
    if (!menu || menu.disabled) return 'menu missing';
    menu.click();
    const form=document.querySelector('form.modal');
    if (!form?.elements.kind) return 'picker missing';
    form.elements.kind.value='curves';
    form.requestSubmit();
    return 'created';
  }
  function changeLevels() {
    const input=document.querySelector('[data-adjustment-prop="master.gamma"]');
    if (!input) return null;
    input.value='2';
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function changeImportedGamma() {
    const input=document.querySelector('[data-adjustment-prop="master.gamma"]');
    if (!input) return false;
    input.value='3'; input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function changeCurvesRed() {
    const input=document.querySelector('[data-adjustment-curve-channel="1"]');
    if (!input) return null;
    input.value='0:0, 128:210, 255:255';
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function inspect() {
    return { rows:document.querySelectorAll('#historyList .history-row').length,
      current:document.querySelector('#historyList .history-row.current')?.textContent||'',
      selected:document.querySelector('.layer-row.selected')?.textContent||'',
      gamma:document.querySelector('[data-adjustment-prop="master.gamma"]')?.value,
      redCurve:document.querySelector('[data-adjustment-curve-channel="1"]')?.value,
      layers:[...document.querySelectorAll('.layer-row')].map(row=>row.textContent.trim()) };
  }
  function selectLevels() {
    const row=[...document.querySelectorAll('.layer-row')]
      .find(node=>node.textContent.includes('Уровни'));
    if (!row) return false;
    row.click();
    return true;
  }
  function selectCurves() {
    const row=[...document.querySelectorAll('.layer-row')]
      .find(node=>node.textContent.includes('Кривые'));
    if (!row) return false;
    row.click();
    return true;
  }
  function enableExportCapture() {
    window.__adjUiExportBlobs=[];
    window.__adjUiDownloads=[];
    window.__adjUiOriginalUrl=URL.createObjectURL;
    URL.createObjectURL=function(blob) {
      if (blob instanceof Blob && blob.type==='application/json')
        window.__adjUiProjectBlob=blob;
      else if (blob instanceof Blob) window.__adjUiExportBlobs.push(blob);
      return window.__adjUiOriginalUrl.call(this,blob);
    };
    window.__adjUiOriginalClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function() {
      if (/\.(psd|psb)$/i.test(this.download||'')) window.__adjUiDownloads.push(this.download);
      return window.__adjUiOriginalClick.call(this);
    };
    return true;
  }
  function exportPsd() {
    document.querySelector('#exportQuickBtn').click();
    const form=document.querySelector('form.modal');
    const select=form?.elements.format;
    if (!select) return 'missing export modal';
    select.value='image/vnd.adobe.photoshop';
    form.requestSubmit();
    return 'submitted PSD';
  }
  function exportPsb() {
    document.querySelector('#exportQuickBtn').click();
    const form=document.querySelector('form.modal');
    const select=form?.elements.format;
    if (!select) return 'missing export modal';
    select.value='psb';
    form.requestSubmit();
    return 'submitted PSB';
  }
  function exportStatus() {
    return { names:window.__adjUiDownloads||[],
      sizes:(window.__adjUiExportBlobs||[]).map(blob=>blob.size),
      types:(window.__adjUiExportBlobs||[]).map(blob=>blob.type) };
  }
  function importLatestExport() {
    const blobs=window.__adjUiExportBlobs;
    const names=window.__adjUiDownloads;
    if (!blobs?.length || blobs.length!==names.length) return false;
    const file=new File([blobs.at(-1)],names.at(-1),{
      type:blobs.at(-1).type||'application/octet-stream' });
    const transfer=new DataTransfer();
    transfer.items.add(file);
    const input=document.querySelector('#fileInput');
    input.files=transfer.files;
    const original=window.confirm;
    window.confirm=()=>true;
    try { input.dispatchEvent(new Event('change',{bubbles:true})); }
    finally { window.confirm=original; }
    return true;
  }
  function saveProjectCapture() {
    window.__adjUiProjectBlob=null;
    return true;
  }
  async function readProject() {
    const blob=window.__adjUiProjectBlob;
    if (!blob) return null;
    const project=JSON.parse(await blob.text());
    const adjustments=project.layers.filter(layer=>layer.type==='adjustment');
    return { width:project.width,height:project.height,
      names:project.layers.map(layer=>layer.name),
      adjustments:adjustments.map(layer=>({
        kind:layer.adjustment?.kind,
        gamma:layer.adjustment?.master?.gamma,
        redCurve:layer.adjustment?.channels?.find(channel=>channel.id===1)?.points,
        native:!!layer.psdAdjustment,
        clipping:layer.clipping,
        hasMask:!!layer.mask,hasVectorMask:!!layer.vectorMask,
      })) };
  }
  await run(loadGraySource);
  await waitFor('gray fixture visible',async()=>{
    const p=await run(pixels);return p?.[0]===128&&p[3]===255;
  });
  assert(await run(createLevels)==='created','Levels must be created by actual Layer menu');
  await waitFor('Levels UI selected',async()=>{
    const s=await run(inspect);return s.selected.includes('Уровни')&&s.gamma==='1';
  });
  assert(await run(changeLevels),'Levels Master gamma must be editable');
  await waitFor('Levels render',async()=>{
    const p=await run(pixels);return p?.[0]>=175&&p[0]<=185&&p[1]===p[0];
  });
  assert(await run(createCurves)==='created','Curves must be created by actual Layer menu');
  await waitFor('Curves UI selected',async()=>{
    const s=await run(inspect);return s.selected.includes('Кривые')&&s.redCurve==='0:0, 255:255';
  });
  assert(await run(changeCurvesRed),'Curves RGB red input must be editable');
  await waitFor('Curves red-only render',async()=>{
    const p=await run(pixels);return p?.[0]>p[1]+10&&p[1]>=175&&p[3]===255;
  });
  const reference=await run(pixels);
  const before=await run(inspect);
  assert(before.rows===5,'Creating and editing two adjustments must publish four History entries',JSON.stringify(before));
  assert(await run(enableExportCapture),'Capture actual downloaded binary Blobs');
  for (const [format, action] of [['PSD',exportPsd],['PSB',exportPsb]]) {
    const index=format==='PSD'?0:1;
    assert((await run(action))==='submitted '+format,'Real Export modal '+format);
    await waitFor(format+' download Blob',async()=>{
      const s=await run(exportStatus);
      return s.names.length===index+1 && s.sizes[index]>100 &&
        s.names[index].endsWith('.'+format.toLowerCase());
    });
    const download=await run(exportStatus);
    assert(download.sizes[index]>100,format+' must create binary download',JSON.stringify(download));
    assert(await run(importLatestExport),'Open downloaded '+format+' through real fileInput');
    await waitFor(format+' reimported adjustment rows',async()=>{
      const s=await run(inspect);
      return s.layers.some(name=>name.includes('Уровни')) &&
        s.layers.some(name=>name.includes('Кривые')) && s.rows===1;
    });
    await waitFor(format+' visible rendered pixels',async()=>{
      const p=await run(pixels);return p&&p[3]===255&&p[0]>p[1]+10;
    });
    const reopened=await run(pixels);
    assert(reference.every((value,i)=>Math.abs(value-reopened[i])<=5),
      format+' reimport must preserve visible pixels/alpha',JSON.stringify({reference,reopened}));
    await run(saveProjectCapture);
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',
      windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',
      windowsVirtualKeyCode:83,modifiers:2});
    // The JSON save is captured by the existing URL.createObjectURL observer.
    const saved=await run(readProject);
    assert(saved?.adjustments?.length===2 &&
      saved.adjustments.some(a=>a.kind==='levels'&&Math.abs(a.gamma-2)<.02&&a.native) &&
      saved.adjustments.some(a=>a.kind==='curves'&&a.redCurve?.length===3&&a.native),
      format+' import must retain editable native Levels/Curves metadata',JSON.stringify(saved));
    assert(await run(selectLevels),format+' Levels visible in real Layers UI');
    await waitFor(format+' Levels inspector',async()=> (await run(inspect)).gamma==='2');
    assert(await run(changeImportedGamma),format+' Levels inspector accepts edit');
    await waitFor(format+' edit adds History',async()=>{
      const s=await run(inspect);return s.rows===2&&s.gamma==='3';
    });
    await evaluate(client,"document.querySelector('#undoBtn').click();true");
    assert(await run(selectLevels),format+' Undo: Levels layer remains selectable');
    await waitFor(format+' Undo',async()=> (await run(inspect)).gamma==='2');
    await evaluate(client,"document.querySelector('#redoBtn').click();true");
    assert(await run(selectLevels),format+' Redo: Levels layer remains selectable');
    await waitFor(format+' Redo',async()=> (await run(inspect)).gamma==='3');
    if(format==='PSD') {
      // Return to the same original source before the PSB test.
      await run(loadGraySource);
      await waitFor('PSB source reset',async()=> (await run(pixels))?.[0]===128);
      assert(await run(createLevels)==='created','Recreate Levels for independent PSB');
      await waitFor('PSB Levels selected',async()=> (await run(inspect)).gamma==='1');
      await run(changeLevels);
      await waitFor('PSB Levels render',async()=> (await run(pixels))?.[0]>=175);
      assert(await run(createCurves)==='created','Recreate Curves for independent PSB');
      await waitFor('PSB Curves selected',async()=> (await run(inspect)).redCurve==='0:0, 255:255');
      await run(changeCurvesRed);
      await waitFor('PSB Curves render',async()=>{const p=await run(pixels);return p?.[0]>p?.[1]+10;});
    }
  }
  // Separate structural route: grouped clipped adjustment with intersecting
  // raster and vector masks must survive the same real export/import UI.
  function loadMaskedFixture() {
    const mask=document.createElement('canvas'); mask.width=64; mask.height=64;
    const ctx=mask.getContext('2d'); ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,64,32);
    const shape=(id,fill,groupId=null)=>({
      id,name:id,type:'shape',shape:'rect',x:0,y:0,width:64,height:64,
      scaleX:1,scaleY:1,rotation:0,fill,stroke:'transparent',strokeWidth:0,
      visible:true,locked:false,opacity:1,blendMode:'source-over',groupId });
    const adjustment={id:'ui-masked-levels',name:'UI masked Levels',type:'adjustment',
      groupId:'ui-masked-group',visible:true,locked:false,opacity:1,
      blendMode:'source-over',clipping:true,
      adjustment:{kind:'levels',master:{inputBlack:0,inputWhite:255,gamma:2,
        outputBlack:0,outputWhite:255},channels:[]},
      mask:{enabled:true,density:1,feather:0,invert:false,dataUrl:mask.toDataURL('image/png')},
      vectorMask:{enabled:true,invert:false,subpaths:[{
        operation:'add',closed:true,
        points:[{x:0,y:0},{x:32,y:0},{x:32,y:64},{x:0,y:64}]
      }]},
    };
    const source={version:1,name:'UI masked group',width:64,height:64,
      background:'transparent',selectedLayerId:adjustment.id,
      groups:[{id:'ui-masked-group',name:'UI masked group',
        visible:true,opacity:1,blendMode:'pass-through'}],
      layers:[shape('ui-bottom-gray','#808080'),
        shape('ui-clipping-base','#404040','ui-masked-group'),adjustment]};
    const transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(source)],'ui-masked.zpe',
      {type:'application/json'}));
    const input=document.querySelector('#projectInput');input.files=transfer.files;
    const original=window.confirm;window.confirm=()=>true;
    try {input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=original;}
    return true;
  }
  function maskedPixels() {
    const canvas=document.querySelector('#editorCanvas'),ctx=canvas.getContext('2d');
    const sample=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
    return {topLeft:sample(16,16),topRight:sample(48,16),
      bottomLeft:sample(16,48),bottomRight:sample(48,48)};
  }
  async function maskedProject() {
    if(!window.__adjUiProjectBlob)return null;
    const doc=JSON.parse(await window.__adjUiProjectBlob.text());
    const adjustment=doc.layers.find(layer=>layer.adjustment?.kind==='levels');
    return {groups:doc.groups.map(group=>group.name),
      adjustment:{groupId:adjustment?.groupId,clipping:adjustment?.clipping,
        gamma:adjustment?.adjustment?.master?.gamma,
        native:!!adjustment?.psdAdjustment,
        raster:!!adjustment?.mask?.dataUrl,
        vector:adjustment?.vectorMask?.subpaths?.length}};
  }
  function reopenMaskedProject() {
    if(!window.__adjUiProjectBlob)return false;
    const input=document.querySelector('#projectInput'),transfer=new DataTransfer();
    transfer.items.add(new File([window.__adjUiProjectBlob],'masked-native-reopen.zpe',
      {type:'application/json'}));
    input.files=transfer.files;
    const original=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=original;}
    return true;
  }
  for(const [format,action] of [['PSD',exportPsd],['PSB',exportPsb]]) {
    await run(loadMaskedFixture);
    await waitFor(format+' masked fixture',async()=>{
      const s=await run(inspect);
      return s.selected.includes('UI masked Levels')&&s.gamma==='2';
    });
    await waitFor(format+' masked baseline',async()=>{
      const p=await run(maskedPixels);
      return p?.topLeft[0]>=122&&p.topLeft[0]<=135
        &&p.topRight[0]===64&&p.bottomLeft[0]===64&&p.bottomRight[0]===64;
    });
    const before=await run(maskedPixels);
    const index=(await run(exportStatus)).names.length;
    assert((await run(action))==='submitted '+format,'Masked '+format+' export via UI');
    await waitFor(format+' masked download',async()=>{
      const s=await run(exportStatus);
      return s.names.length===index+1 && s.sizes[index]>100 &&
        s.names[index].endsWith('.'+format.toLowerCase());
    });
    const exportedBytes=await evaluate(client,'(async()=>Array.from(new Uint8Array(await window.__adjUiExportBlobs.at(-1).arrayBuffer())))()');
    const parsed=await decodePsd(Uint8Array.from(exportedBytes),{maxPixels:5000,maxLayers:20});
    const native=parsed.adjustmentLayers?.[0];
    const nativeMask=native?.mask?.pixels;
    assert(parsed.adjustmentLayers?.length===1 && parsed.groups?.length===1 &&
      native.psdAdjustment?.blocks?.some(block=>block.key==='levl') &&
      native.psdAdjustment?.parsed?.kind==='levels' && native.clipping &&
      native.groupKey && native.vectorMask?.subpaths?.length===1 &&
      nativeMask?.[(16*64+16)*4+3]===255 &&
      nativeMask?.[(48*64+16)*4+3]===0,
      format+' binary must retain native Levels, group/clipping and full-document mask',
      JSON.stringify({layers:parsed.adjustmentLayers?.length,groups:parsed.groups?.length,
        maskAlpha:nativeMask?.[(16*64+16)*4+3]}));
    assert(await run(importLatestExport),'Masked '+format+' open via fileInput');
    await waitFor(format+' masked reimport',async()=>{
      const s=await run(inspect);
      return s.layers.some(name=>name.includes('UI masked Levels'))&&s.rows===1&&
        s.current.includes('Импорт PSD/PSB');
    });
    const after=await run(maskedPixels);
    assert(Object.keys(before).every(key=>before[key].every((v,i)=>Math.abs(v-after[key][i])<=6)),
      'Masked '+format+' composite pixels/alpha must match before export',JSON.stringify({before,after}));
    await run(saveProjectCapture);
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',
      windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',
      windowsVirtualKeyCode:83,modifiers:2});
    const saved=await run(maskedProject);
    assert(saved?.groups?.length===1 && saved.adjustment?.groupId &&
      saved.adjustment.clipping && saved.adjustment.raster &&
      saved.adjustment.vector===1 && saved.adjustment.native &&
      saved.adjustment.gamma===2,
      'Masked '+format+' must keep editable Levels, group, clipping and both masks',
      JSON.stringify(saved));
    assert(await run(reopenMaskedProject),'Reopen masked '+format+' export as genuine .zpe');
    await waitFor(format+' masked .zpe reopen',async()=>{
      const state=await run(inspect),pix=await run(maskedPixels);
      return state.current.includes('Открыть проект')&&state.rows===1&&
        state.layers.some(name=>name.includes('UI masked Levels'))&&
        Object.keys(before).every(key=>before[key].every((v,i)=>Math.abs(v-pix[key][i])<=6));
    });
  }
  await evaluate(client,"URL.createObjectURL=window.__adjUiOriginalUrl;HTMLAnchorElement.prototype.click=window.__adjUiOriginalClick;true");
  console.log('CAP-ADJ-PSD-UI production Chrome file:// Layers -> PSD/PSB export -> import native editable PASS');
}
