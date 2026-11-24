// Production Chromium file://: actual Export modal -> binary download -> File input.
// A separately masked clipped raster and nested folder must survive PSD and PSB.
export async function verifyNativeClippedUiRoundTrips(client, harness, {mode, expected, near, chained = false, effect = {kind:'invert'}, effectName = 'Clipped Invert', baseMode = 'source-over'}) {
  const {evaluate, waitFor, assert}=harness;
  const run=fn=>evaluate(client,'('+fn.toString()+')()');
  function captureDownloads() {
    if(window.__clipNativeCapture){
      const state=window.__clipNativeCapture;
      state.binary=[];state.names=[];state.project=null;
      return true;
    }
    const state={binary:[],names:[],project:null};
    window.__clipNativeCapture=state;
    const originalUrl=URL.createObjectURL;
    URL.createObjectURL=function(blob,...args){
      if(blob instanceof Blob) {
        if(blob.type==='application/json')state.project=blob;
        else state.binary.push(blob);
      }
      return originalUrl.call(URL,blob,...args);
    };
    const originalClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(...args){
      if(/\.(psd|psb)$/i.test(this.download||''))state.names.push(this.download);
      return originalClick.apply(this,args);
    };
    return true;
  }
  function submitPsd() {
    document.querySelector('#exportQuickBtn')?.click();
    const modal=document.querySelector('form.modal');
    const format=modal?.elements?.format;
    if(!format)return false;
    format.value=window.__clipNativeRequestedFormat;
    modal.requestSubmit();
    return true;
  }
  async function exportState() {
    const state=window.__clipNativeCapture;
    if(!state?.binary?.length)return null;
    const blob=state.binary.at(-1);
    const bytes=new Uint8Array(await blob.arrayBuffer());
    return {count:state.binary.length,name:state.names.at(-1),
      size:blob.size,signature:String.fromCharCode(...bytes.slice(0,4)),
      version:bytes[4]*256+bytes[5]};
  }
  function reopenBinary() {
    const state=window.__clipNativeCapture;
    if(state.binary.length!==state.names.length)return false;
    const binary=state.binary.at(-1);
    const name=state.names.at(-1);
    const transfer=new DataTransfer();
    transfer.items.add(new File([binary],name,{type:'application/octet-stream'}));
    const input=document.querySelector('#fileInput');
    input.files=transfer.files;
    window.confirm=()=>true;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function importedIdentity() {
    const row=[...document.querySelectorAll('[data-group-id]')]
      .find(x=>x.textContent.includes('Masked Pass Through'));
    return {id:row?.getAttribute('data-group-id'),
      layers:document.querySelectorAll('.layer-row').length};
  }
  function currentPixels() {
    const canvas=document.querySelector('#editorCanvas');
    if(!canvas||canvas.width!==4||canvas.height!==2)return null;
    return Array.from({length:4},(_,x)=>
      Array.from(canvas.getContext('2d').getImageData(x,0,1,1).data));
  }
  function disableGroupMask() {
    const row=[...document.querySelectorAll('[data-group-id]')]
      .find(x=>x.textContent.includes('Masked Pass Through'));
    if(!row)return false;
    row.dispatchEvent(new MouseEvent('contextmenu',
      {bubbles:true,cancelable:true,clientX:30,clientY:30}));
    const action=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(x=>x.textContent.includes('Параметры группы'));
    if(!action)return false;
    action.click();
    const form=document.querySelector('.modal[aria-label="Параметры группы"]');
    const mask=form?.querySelector('select[name="maskEnabled"]');
    if(!mask)return false;
    mask.value='disabled';
    mask.dispatchEvent(new Event('change',{bubbles:true}));
    form.requestSubmit();
    return true;
  }
  function saveProject() {
    window.__clipNativeCapture.project=null;
    document.querySelector('[data-menu="file"]').click();
    const action=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(x=>x.textContent.includes('Сохранить проект'));
    if(!action||action.disabled)return false;
    action.click();
    return true;
  }
  async function savedStructure() {
    const blob=window.__clipNativeCapture?.project;
    if(!blob)return null;
    const doc=JSON.parse(await blob.text());
    const outer=doc.groups.find(g=>g.name==='Masked Pass Through');
    const inner=doc.groups.find(g=>g.name==='Nested Pass Through');
    const base=doc.layers.find(l=>l.name==='Translucent red');
    const overlay=doc.layers.find(l=>l.name==='Clipped blue raster');
    const levels=doc.layers.find(l=>l.name==='Clipped Levels');
    const effect=doc.layers.find(l=>l.name===window.__clipNativeEffectName);
    return {groups:doc.groups.length,layers:doc.layers.length,outer:!!outer,
      outerMask:!!outer?.mask?.dataUrl,inner:!!inner,
      parent:inner?.parentGroupId===outer?.id,base:base?.type,baseBlend:base?.blendMode,
      clipped:overlay?.clipping,blend:overlay?.blendMode,opacity:overlay?.opacity,
      overlayMask:!!overlay?.mask?.dataUrl,maskEnabled:overlay?.mask?.enabled,
      effect:effect?.adjustment?.kind,effectModel:effect?.adjustment,effectClipped:effect?.clipping,
      levels:levels?.adjustment?.kind,levelsClip:levels?.clipping,
      levelsMaster:levels?.adjustment?.master,ordered:!levels||doc.layers.indexOf(levels)<doc.layers.indexOf(effect)};
  }
  function reopenProject() {
    const blob=window.__clipNativeCapture?.project;
    if(!blob)return false;
    const transfer=new DataTransfer();
    transfer.items.add(new File([blob],'native-roundtrip.zpe',{type:'application/json'}));
    const input=document.querySelector('#projectInput');
    input.files=transfer.files;window.confirm=()=>true;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  await evaluate(client,'window.__clipNativeEffectName='+JSON.stringify(effectName));
  assert(await run(captureDownloads),'install binary download observer');
  for(const [index,format] of ['PSD','PSB'].entries()) {
    await evaluate(client,'window.__clipNativeRequestedFormat='+JSON.stringify(format==='PSD'?'image/vnd.adobe.photoshop':'psb'));
    assert(await run(submitPsd),format+' native Export dialog');
    await waitFor(format+' PSD binary from actual Export',async()=>{
      const result=await run(exportState);
      return result?.count===index+1&&result?.name?.endsWith('.'+format.toLowerCase())
        &&result.size>100&&result.signature==='8BPS'&&result.version===(format==='PSD'?1:2);
    },16000);
    const previous=await run(importedIdentity);
    assert(await run(reopenBinary),format+' binary delivered to native file input');
    await waitFor(format+' native import publishes new document',async()=>{
      const state=await run(importedIdentity);
      return state.id&&state.id!==previous.id&&state.layers===(chained?5:4);
    },16000);
    await waitFor(format+' nested mask/clipped composite RGBA',async()=>{
      const pixels=await run(currentPixels);
      return pixels&&pixels.length===expected.length&&
        expected.every((want,i)=>near(pixels[i],want));
    },16000);
    assert(await run(disableGroupMask),format+' editable native group mask in Properties');
    await waitFor(format+' group mask disable changes visible pixels',async()=>{
      const px=await run(currentPixels);
      return px&&near(px[2],expected[0]);
    },12000);
    await evaluate(client,"document.querySelector('#undoBtn').click()");
    await waitFor(format+' native Undo restores folder mask',async()=>{
      const px=await run(currentPixels);return px&&near(px[2],expected[2]);
    },12000);
    await evaluate(client,"document.querySelector('#redoBtn').click()");
    await waitFor(format+' native Redo disables folder mask',async()=>{
      const px=await run(currentPixels);return px&&near(px[2],expected[0]);
    },12000);
    await evaluate(client,"document.querySelector('#undoBtn').click()");
    await waitFor(format+' restore mask before ZPE',async()=>{
      const px=await run(currentPixels);return px&&near(px[2],expected[2]);
    },12000);
    assert(await run(saveProject),format+' File menu saves editable .zpe');
    await waitFor(format+' .zpe JSON Blob',async()=>Boolean(await run(savedStructure)),12000);
    const saved=await run(savedStructure);
    assert(saved?.groups===2&&saved.layers===(chained?5:4)&&saved.outer&&saved.outerMask&&
      saved.inner&&saved.parent&&saved.base==='raster'&&saved.baseBlend===baseMode&&saved.clipped===true&&
      saved.blend===mode&&saved.overlayMask&&saved.maskEnabled!==false&&
      saved.effect===effect.kind&&Object.entries(effect).every(([k,v])=>saved.effectModel?.[k]===v)&&saved.effectClipped===true&&
      (!chained||(saved.levels==='levels'&&saved.levelsClip===true&&saved.ordered&&
        saved.levelsMaster?.outputBlack===32&&saved.levelsMaster?.outputWhite===224))&&
      Math.abs(saved.opacity-(mode==='multiply'?1:.5))<.01,
      format+' retains editable native masked clipped stack: '+JSON.stringify(saved));
    assert(await run(reopenProject),format+' .zpe File Input reopen');
    await waitFor(format+' re-saved project pixel parity',async()=>{
      const pixels=await run(currentPixels);
      return pixels&&expected.every((want,i)=>near(pixels[i],want));
    },16000);
    console.log(format+' '+baseMode+' base / '+mode+' '+effect.kind+' native UI export/reimport, mask, History, ZPE PASS');
  }
}
