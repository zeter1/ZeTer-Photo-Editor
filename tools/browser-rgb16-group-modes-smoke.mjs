import { createPixelBuffer, deserializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { encodePsd, decodePsd } from '../src/formats/psd.js';

// Live Chromium file://, actual UI import, blend control, History, save and export.
// The synthetic fixture has native words not representable by an 8-bit expansion.
export async function verifyRgb16GroupModesUi(client, ports) {
  await verifyGroupModesUi(client,ports,false);
  await verifyGroupModesUi(client,ports,true);
  await verifyGroupModesUi(client,ports,'contrast');
  await verifyGroupModesUi(client,ports,'remaining');
}
async function verifyGroupModesUi(client, {evaluate,waitFor,assert}, separable) {
  const modes=separable==='remaining'?[['darken',[39,58,117,255]],['lighten',[117,78,117,255]],['difference',[97,58,58,255]],['exclusion',[106,85,122,255]],['soft-light',[55,59,114,255]]]:separable==='contrast'?[['overlay',[49,51,112,255]],['hard-light',[96,51,112,255]]]:separable?[['multiply',[34,45,85,255]],['screen',[121,91,148,255]]]:[['color',[105,46,105,255]],['hue',[80,60,99,255]],['saturation',[23,82,140,255]],['luminosity',[51,90,129,255]]];
  const [previousMode,previousPreview]=modes.at(-2),[finalMode,finalPreview]=modes.at(-1);
  const run=fn=>evaluate(client,'('+fn.toString()+')()');
  const pixels=words=>createPixelBuffer({width:2,height:2,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:Uint16Array.from(Array.from({length:4},()=>words).flat())});
  const bottom=[1000,2000,3000,65535], top=[50000,10000,30000,65535], outer=[10000,20000,30000,65535];
  const fixture=encodePsd({width:2,height:2,bitsPerChannel:16,colorMode:3,
    groups:[{key:'g',name:'RGB16 group modes',blendMode:'source-over',opacity:128/255,visible:true}],
    layers:[{groupKey:'g',name:'RGB16 Group Modes top',x:0,y:0,width:2,height:2,pixelBuffer:pixels(top),blendMode:'source-over',opacity:1,visible:true},
      {groupKey:'g',name:'RGB16 Group Modes base',x:0,y:0,width:2,height:2,pixelBuffer:pixels(bottom),blendMode:'source-over',opacity:1,visible:true},
      {name:'RGB16 Group Modes outer',x:0,y:0,width:2,height:2,pixelBuffer:pixels(outer),blendMode:'source-over',opacity:1,visible:true}],
    compositePixelBuffer:pixels(top)});
  assert(await evaluate(client,`(() => {
    const bytes=Uint8Array.from(atob(${JSON.stringify(Buffer.from(fixture).toString('base64'))}),c=>c.charCodeAt(0));
    const t=new DataTransfer();t.items.add(new File([bytes],'rgb16-group-modes-oracle.psd',{type:'image/vnd.adobe.photoshop'}));
    const input=document.querySelector('#fileInput');input.files=t.files;
    window.confirm=()=>true;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
  })()`),'RGB16 native fixture dispatched');
  await waitFor('RGB16 Group Modes native import',()=>evaluate(client,`document.querySelector('#statusText')?.textContent?.startsWith('PSD/PSB импортирован') && [...document.querySelectorAll('.layer-row')].some(r=>r.textContent.includes('RGB16 Group Modes top')) && document.querySelector('#editorCanvas').width===2`),16000);
  const selectTop=()=>run(()=>{
    const row=[...document.querySelectorAll('.layer-row')].find(x=>x.textContent.includes('RGB16 Group Modes top'));
    if(!row)return false;row.click();return true;
  });
  const value=()=>evaluate(client,"[...document.querySelectorAll('.layer-group-name')].find(x=>x.textContent.includes('RGB16 group modes'))?.title || ''");
  const preview=async want=>{
    const actual=await evaluate(client,"Array.from(document.querySelector('#editorCanvas').getContext('2d').getImageData(0,0,1,1).data)");
    return actual?.length===4&&want.every((v,i)=>Math.abs(v-actual[i])<=2);
  };
  await waitFor('RGB16 group Normal preview',async()=> (await value()).includes('source-over')&&await preview([117,58,117,255]),12000);
  function setGroupMode(mode){
    const row=[...document.querySelectorAll('.layer-group-row')].find(x=>x.textContent.includes('RGB16 group modes'));
    if(!row)return false;
    row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:30,clientY:30}));
    const action=[...document.querySelectorAll('#menuPopover .menu-item')].find(x=>x.textContent.includes('Параметры группы'));
    if(!action||action.disabled)return false;action.click();
    const form=document.querySelector('.modal[aria-label="Параметры группы"]');
    const select=form?.elements?.blendMode;
    if(!select||![...select.options].some(o=>o.value===mode))return false;
    select.value=mode;form.elements.opacity.value='50';form.requestSubmit();return true;
  }
  for(const [mode,expected] of modes){
    assert(await evaluate(client,'('+setGroupMode.toString()+')('+JSON.stringify(mode)+')'),'actual group Properties '+mode);
    await waitFor('RGB16 group '+mode,async()=> (await value()).includes(mode)&&await preview(expected),12000);
  }
  await evaluate(client,"document.querySelector('#undoBtn').click()");
  await waitFor('RGB16 group Undo',async()=> (await value()).includes(previousMode)&&await preview(previousPreview),12000);
  await evaluate(client,"document.querySelector('#redoBtn').click()");
  await waitFor('RGB16 group Redo',async()=> (await value()).includes(finalMode)&&await preview(finalPreview),12000);
  assert(await run(()=>{
    const state={downloads:[],urls:new Map(),url:URL.createObjectURL,click:HTMLAnchorElement.prototype.click};
    window.__rgb16GroupModesCapture=state;
    URL.createObjectURL=function(blob,...args){const url=state.url.call(URL,blob,...args);if(blob instanceof Blob)state.urls.set(url,blob);return url;};
    HTMLAnchorElement.prototype.click=function(...args){
      const blob=state.urls.get(this.href);
      if(blob&&this.download)state.downloads.push({blob,name:this.download});
      return state.click.apply(this,args);
    };return true;
  }),'capture actual downloads');
  try {
    const save=()=>run(()=>{
      document.querySelector('[data-menu="file"]').click();
      const action=[...document.querySelectorAll('#menuPopover .menu-item')].find(x=>x.textContent.includes('Сохранить проект'));
      if(!action||action.disabled)return false;action.click();return true;
    });
    const saved=async()=>run(async()=>{
      const item=window.__rgb16GroupModesCapture.downloads.filter(d=>/\.zpe$/i.test(d.name)).at(-1);
      return item?JSON.parse(await item.blob.text()):null;
    });
    assert(await save(),'save RGB16 .zpe through File menu');
    await waitFor('RGB16 saved .zpe',async()=>Boolean(await saved()),12000);
    const project=await saved();
    const group=project.groups.find(g=>g.name==='RGB16 group modes');
    assert(group?.blendMode===finalMode&&Math.abs(group.opacity-.5)<1e-6,'saved native group opacity');
    assert(project.layers.filter(l=>l.groupId===group.id).length===2,'saved group membership');
    for(const [name,expected,blendMode] of [['RGB16 Group Modes top',top,'source-over'],['RGB16 Group Modes base',bottom,'source-over']]){
      const l=project.layers.find(x=>x.name===name);
      assert(l?.blendMode===blendMode&&l.highDepthSource?.bitsPerChannel===16,'saved '+name+' mode and depth');
      const data=deserializePixelBufferSource(l.highDepthSource).data;
      assert(JSON.stringify([...data.slice(0,4)])===JSON.stringify(expected),'saved '+name+' exact native words');
    }
    assert(await run(()=>{
      const item=window.__rgb16GroupModesCapture.downloads.filter(d=>/\.zpe$/i.test(d.name)).at(-1);
      if(!item)return false;const t=new DataTransfer();t.items.add(new File([item.blob],'rgb16-group-modes-reopened.zpe',{type:'application/json'}));
      const input=document.querySelector('#projectInput');input.files=t.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
    }),'reopen saved .zpe');
    await waitFor('RGB16 reopened .zpe',async()=>await evaluate(client,"document.querySelector('#statusText')?.textContent==='Проект открыт'")&&await preview(finalPreview),16000);
    assert(await selectTop(),'select reopened top');
    await waitFor('RGB16 reopened final mode',async()=>(await value()).includes(finalMode),12000);
    for(const [format,version] of [['psd',1],['psb',2]]){
      assert(await evaluate(client,`(() => {
        document.querySelector('#exportQuickBtn').click();
        const modal=document.querySelector('form.modal');const field=modal?.elements?.format;
        if(!field)return false;field.value=${JSON.stringify(format==='psd'?'image/vnd.adobe.photoshop':'psb')};modal.requestSubmit();return true;
      })()`),format+' actual Export modal');
      const download=()=>evaluate(client,`(async()=>{
        const item=window.__rgb16GroupModesCapture.downloads.filter(d=>d.name.toLowerCase().endsWith('.'+${JSON.stringify(format)})).at(-1);
        if(!item)return null;const bytes=new Uint8Array(await item.blob.arrayBuffer());
        return {name:item.name,encoded:btoa(String.fromCharCode(...bytes))};
      })()`);
      await waitFor(format+' native RGB16 binary',async()=>Boolean(await download()),16000);
      const exported=await download();
      const bytes=Uint8Array.from(Buffer.from(exported.encoded,'base64'));
      const parsed=await decodePsd(bytes,{maxPixels:64,maxLayers:8});
      assert(parsed.version===version&&parsed.bitsPerChannel===16&&parsed.layers.length===3,format+' native layered structure');
      assert(parsed.groups[0]?.blendMode===finalMode&&Math.abs(parsed.groups[0].opacity-128/255)<1e-9,format+' editable group mode and encoded opacity');
      const words=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-34,34);
      // PSB is exported after PSD reimport: folder opacity is now the PSD byte 128/255.
      const expected=[0,...(separable==='remaining'?(version===1?[14053,15172,29313,65535]:[14069,15153,29310,65535]):separable==='contrast'?(version===1?[24603,13052,28733,65535]:[24660,13025,28728,65535]):separable?(version===1?[31185,23474,38133,65535]:[31268,23488,38165,65535]):(version===1?[13050,23050,33050,65535]:[13062,23062,33062,65535])).flatMap(v=>[v,v,v,v])];
      assert(expected.every((v,i)=>words.getUint16(i*2,false)===v),format+' exact raw composite plane words');
      for(const [name,expectedWords,blend] of [['RGB16 Group Modes top',top,'source-over'],['RGB16 Group Modes base',bottom,'source-over']]){
        const layer=parsed.layers.find(l=>l.name===name);
        assert(layer?.blendMode===blend&&JSON.stringify([...layer.pixelBuffer.data.slice(0,4)])===JSON.stringify(expectedWords),format+' editable '+name+' exact native words');
      }
      assert(await evaluate(client,`(() => {
        const item=window.__rgb16GroupModesCapture.downloads.filter(d=>d.name.toLowerCase().endsWith('.'+${JSON.stringify(format)})).at(-1);
        if(!item)return false;const t=new DataTransfer();t.items.add(new File([item.blob],'rgb16-group-modes-roundtrip.'+${JSON.stringify(format)},{type:'application/octet-stream'}));
        const input=document.querySelector('#fileInput');input.files=t.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
      })()`),format+' reimport native export');
      await waitFor(format+' native reimport preview',async()=>await evaluate(client,"document.querySelector('#statusText')?.textContent?.startsWith('PSD/PSB импортирован')")&&await preview(finalPreview),16000);
      assert(await selectTop(),format+' select reimported top');
      await waitFor(format+' reimported editable final mode',async()=>(await value()).includes(finalMode),12000);
      console.log(format.toUpperCase()+' RGB16 Group Modes exact merged and editable native words, UI import/export, History, ZPE PASS');
    }
  } finally {
    await run(()=>{const state=window.__rgb16GroupModesCapture;if(state){URL.createObjectURL=state.url;HTMLAnchorElement.prototype.click=state.click;delete window.__rgb16GroupModesCapture;}return true;});
  }
}
