import { createPixelBuffer, deserializePixelBufferSource } from '../src/core/pixel-buffer.js';
import { encodePsd, decodePsd } from '../src/formats/psd.js';

// Live Chromium file://, actual UI import, blend control, History, save and export.
// The synthetic fixture has native words not representable by an 8-bit expansion.
export async function verifyRgb16SaturationUi(client, {evaluate,waitFor,assert}) {
  const run=fn=>evaluate(client,'('+fn.toString()+')()');
  const pixels=words=>createPixelBuffer({width:2,height:2,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:Uint16Array.from(Array.from({length:4},()=>words).flat())});
  const bottom=[15000,30000,45000,65535], top=[60000,10000,10000,65535];
  const fixture=encodePsd({width:2,height:2,bitsPerChannel:16,colorMode:3,
    layers:[{name:'RGB16 Saturation top',x:0,y:0,width:2,height:2,pixelBuffer:pixels(top),blendMode:'source-over',opacity:1,visible:true},
      {name:'RGB16 Saturation base',x:0,y:0,width:2,height:2,pixelBuffer:pixels(bottom),blendMode:'source-over',opacity:1,visible:true}],
    compositePixelBuffer:pixels(top)});
  assert(await evaluate(client,`(() => {
    const bytes=Uint8Array.from(atob(${JSON.stringify(Buffer.from(fixture).toString('base64'))}),c=>c.charCodeAt(0));
    const t=new DataTransfer();t.items.add(new File([bytes],'rgb16-saturation-oracle.psd',{type:'image/vnd.adobe.photoshop'}));
    const input=document.querySelector('#fileInput');input.files=t.files;
    window.confirm=()=>true;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
  })()`),'RGB16 native fixture dispatched');
  await waitFor('RGB16 Saturation native import',()=>evaluate(client,`document.querySelector('#statusText')?.textContent?.startsWith('PSD/PSB импортирован') && document.querySelectorAll('.layer-row').length===2 && document.querySelector('#editorCanvas').width===2`),16000);
  const selectTop=()=>run(()=>{
    const row=[...document.querySelectorAll('.layer-row')].find(x=>x.textContent.includes('RGB16 Saturation top'));
    if(!row)return false;row.click();return true;
  });
  const value=()=>evaluate(client,"document.querySelector('#blendMode')?.value");
  const preview=async want=>{
    const actual=await evaluate(client,"Array.from(document.querySelector('#editorCanvas').getContext('2d').getImageData(0,0,1,1).data)");
    return actual?.length===4&&want.every((v,i)=>Math.abs(v-actual[i])<=2);
  };
  assert(await selectTop(),'select native top layer');
  await waitFor('RGB16 Normal preview',async()=>await value()==='source-over'&&await preview([233,39,39,255]),12000);
  assert(await run(()=>{
    const select=document.querySelector('#blendMode');if(!select||select.disabled)return false;
    select.value='saturation';select.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }),'actual Saturation dropdown');
  await waitFor('RGB16 Saturation display',async()=>await value()==='saturation'&&await preview([27,124,222,255]),12000);
  await evaluate(client,"document.querySelector('#undoBtn').click()");
  await waitFor('RGB16 Saturation Undo',async()=>await value()==='source-over'&&await preview([233,39,39,255]),12000);
  await evaluate(client,"document.querySelector('#redoBtn').click()");
  await waitFor('RGB16 Saturation Redo',async()=>await value()==='saturation'&&await preview([27,124,222,255]),12000);

  assert(await run(()=>{
    const state={downloads:[],urls:new Map(),url:URL.createObjectURL,click:HTMLAnchorElement.prototype.click};
    window.__rgb16SaturationCapture=state;
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
      const item=window.__rgb16SaturationCapture.downloads.filter(d=>/\.zpe$/i.test(d.name)).at(-1);
      return item?JSON.parse(await item.blob.text()):null;
    });
    assert(await save(),'save RGB16 .zpe through File menu');
    await waitFor('RGB16 saved .zpe',async()=>Boolean(await saved()),12000);
    const project=await saved();
    for(const [name,expected,blendMode] of [['RGB16 Saturation top',top,'saturation'],['RGB16 Saturation base',bottom,'source-over']]){
      const l=project.layers.find(x=>x.name===name);
      assert(l?.blendMode===blendMode&&l.highDepthSource?.bitsPerChannel===16,'saved '+name+' mode and depth');
      const data=deserializePixelBufferSource(l.highDepthSource).data;
      assert(JSON.stringify([...data.slice(0,4)])===JSON.stringify(expected),'saved '+name+' exact native words');
    }
    assert(await run(()=>{
      const item=window.__rgb16SaturationCapture.downloads.filter(d=>/\.zpe$/i.test(d.name)).at(-1);
      if(!item)return false;const t=new DataTransfer();t.items.add(new File([item.blob],'rgb16-saturation-reopened.zpe',{type:'application/json'}));
      const input=document.querySelector('#projectInput');input.files=t.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
    }),'reopen saved .zpe');
    await waitFor('RGB16 reopened .zpe',async()=>await evaluate(client,"document.querySelector('#statusText')?.textContent==='Проект открыт'")&&await preview([27,124,222,255]),16000);
    assert(await selectTop(),'select reopened top');
    await waitFor('RGB16 reopened Saturation',async()=>await value()==='saturation',12000);
    for(const [format,version] of [['psd',1],['psb',2]]){
      assert(await evaluate(client,`(() => {
        document.querySelector('#exportQuickBtn').click();
        const modal=document.querySelector('form.modal');const field=modal?.elements?.format;
        if(!field)return false;field.value=${JSON.stringify(format==='psd'?'image/vnd.adobe.photoshop':'psb')};modal.requestSubmit();return true;
      })()`),format+' actual Export modal');
      const download=()=>evaluate(client,`(async()=>{
        const item=window.__rgb16SaturationCapture.downloads.filter(d=>d.name.toLowerCase().endsWith('.'+${JSON.stringify(format)})).at(-1);
        if(!item)return null;const bytes=new Uint8Array(await item.blob.arrayBuffer());
        return {name:item.name,encoded:btoa(String.fromCharCode(...bytes))};
      })()`);
      await waitFor(format+' native RGB16 binary',async()=>Boolean(await download()),16000);
      const exported=await download();
      const bytes=Uint8Array.from(Buffer.from(exported.encoded,'base64'));
      const parsed=await decodePsd(bytes,{maxPixels:64,maxLayers:8});
      assert(parsed.version===version&&parsed.bitsPerChannel===16&&parsed.layers.length===2,format+' native layered structure');
      const words=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-34,34);
      const expected=[0,...[6900,31900,56900,65535].flatMap(v=>[v,v,v,v])];
      assert(expected.every((v,i)=>words.getUint16(i*2,false)===v),format+' exact raw composite plane words');
      for(const [name,expectedWords,blend] of [['RGB16 Saturation top',top,'saturation'],['RGB16 Saturation base',bottom,'source-over']]){
        const layer=parsed.layers.find(l=>l.name===name);
        assert(layer?.blendMode===blend&&JSON.stringify([...layer.pixelBuffer.data.slice(0,4)])===JSON.stringify(expectedWords),format+' editable '+name+' exact native words');
      }
      assert(await evaluate(client,`(() => {
        const item=window.__rgb16SaturationCapture.downloads.filter(d=>d.name.toLowerCase().endsWith('.'+${JSON.stringify(format)})).at(-1);
        if(!item)return false;const t=new DataTransfer();t.items.add(new File([item.blob],'rgb16-saturation-roundtrip.'+${JSON.stringify(format)},{type:'application/octet-stream'}));
        const input=document.querySelector('#fileInput');input.files=t.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
      })()`),format+' reimport native export');
      await waitFor(format+' native reimport preview',async()=>await evaluate(client,"document.querySelector('#statusText')?.textContent?.startsWith('PSD/PSB импортирован')")&&await preview([27,124,222,255]),16000);
      assert(await selectTop(),format+' select reimported top');
      await waitFor(format+' reimported editable Saturation',async()=>await value()==='saturation',12000);
      console.log(format.toUpperCase()+' RGB16 Saturation exact merged and editable native words, UI import/export, History, ZPE PASS');
    }
  } finally {
    await run(()=>{const state=window.__rgb16SaturationCapture;if(state){URL.createObjectURL=state.url;HTMLAnchorElement.prototype.click=state.click;delete window.__rgb16SaturationCapture;}return true;});
  }
}
