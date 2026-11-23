// Independent real Chromium file:// oracle: isolated multiply group with a
// masked base and a raster clipping child. The production UI owns all state.
export async function verifyIsolatedRasterClipping(client, { evaluate, waitFor, assert }) {
  console.log('CAP-PSD clipping: importing fixture');
  const importResult = await evaluate(client, `(() => {
    window.confirm=()=>true;
    const make=(color,half=false)=>{
      const canvas=document.createElement('canvas');
      canvas.width=4; canvas.height=2;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle=color; ctx.fillRect(0,0,half?2:4,2);
      return canvas.toDataURL('image/png');
    };
    const common={type:'raster',x:0,y:0,width:4,height:2,scaleX:1,scaleY:1,
      rotation:0,opacity:1,visible:true,locked:false,
      blendMode:'source-over',groupId:'isolated-group'};
    const base={...common,id:'masked-base',name:'Masked base',dataUrl:make('#0000ff'),
      mask:{enabled:true,invert:false,linked:true,density:1,feather:0,
        dataUrl:make('#ffffff',true)}};
    const clipped={...common,id:'clipped-top',name:'Clipped red',clipping:true,
      dataUrl:make('#ff0000')};
    const project={version:1,name:'Isolated clipping oracle',width:4,height:2,
      background:'#ffffff',selectedLayerId:clipped.id,layers:[base,clipped],
      groups:[{id:'isolated-group',name:'Isolated multiply',visible:true,
        locked:false,collapsed:false,parentGroupId:null,opacity:.5,blendMode:'multiply'}]};
    const transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(project)],'isolated-clipping.zpe',
      {type:'application/json'}));
    const input=document.querySelector('#projectInput');
    input.files=transfer.files;
    const fileName=input.files[0]?.name;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return fileName;
  })()`);
  assert(importResult==='isolated-clipping.zpe','real .zpe import input');

  const pixels=()=>evaluate(client,`(() => {
    const canvas=document.querySelector('#editorCanvas'),ctx=canvas.getContext('2d');
    return {width:canvas.width,height:canvas.height,
      inside:Array.from(ctx.getImageData(0,0,1,1).data),
      outside:Array.from(ctx.getImageData(3,0,1,1).data),
      clipping:document.querySelector('[data-raster-clipping]')?.checked,
      selected:document.querySelector('.layer-row.selected')?.textContent||''};
  })()`);
  const white=p=>p?.outside?.[0]>=252&&p.outside[1]>=252&&
    p.outside[2]>=252&&p.outside[3]===255;
  const pink=a=>a?.[0]>=252&&a[1]>=123&&a[1]<=133&&
    a[2]>=123&&a[2]<=133&&a[3]===255;
  await waitFor('masked base isolated multiply pixel oracle',async()=>{
    const p=await pixels();
    return p.width===4&&p.height===2&&p.selected.includes('Clipped red')&&
      p.clipping===true&&white(p)&&pink(p.inside);
  },12000);
  const initial=await pixels();
  assert(await evaluate(client,`(() => {
    const input=document.querySelector('[data-raster-clipping]');
    if(!input||!input.checked)return false;
    input.click();return input.checked===false;
  })()`),'raster Properties toggle should be interactive');
  await waitFor('clipping disabled makes group visible outside base',async()=>{
    const p=await pixels();return pink(p.outside)&&p.clipping===false;
  },12000);

  await evaluate(client,`document.querySelector('#undoBtn').click()`);
  await waitFor('Undo clipping',async()=>white(await pixels()),12000);
  await evaluate(client,`document.querySelector('#redoBtn').click()`);
  await waitFor('Redo clipping',async()=>pink((await pixels()).outside),12000);
  await evaluate(client,`document.querySelector('#undoBtn').click()`);
  await waitFor('Undo before .zpe save',async()=>white(await pixels()),12000);

  const started=await evaluate(client,`(() => {
    window.__zpeClipSaved=null;
    const old=URL.createObjectURL;
    URL.createObjectURL=function(blob,...args) {
      if(blob instanceof Blob&&blob.type==='application/json')window.__zpeClipSaved=blob;
      return old.call(URL,blob,...args);
    };
    window.__zpeClipReset=()=>{URL.createObjectURL=old;};
    document.querySelector('[data-menu="file"]').click();
    const button=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(el=>el.textContent.includes('Сохранить проект'));
    if(!button||button.disabled)return false;
    button.click();return true;
  })()`);
  assert(started,'real File > Save Project action available');
  await waitFor('saved native project blob',async()=>evaluate(client,
    `Boolean(window.__zpeClipSaved)`),12000);
  const roundTrip=await evaluate(client,`(async () => {
    const text=await window.__zpeClipSaved.text();
    window.__zpeClipReset?.();
    const project=JSON.parse(text);
    const layer=project.layers.find(x=>x.id==='clipped-top');
    const base=project.layers.find(x=>x.id==='masked-base');
    const group=project.groups.find(x=>x.id==='isolated-group');
    const input=document.querySelector('#projectInput');
    const transfer=new DataTransfer();
    transfer.items.add(new File([text],'reopened-isolated-clipping.zpe',
      {type:'application/json'}));
    input.files=transfer.files;
    const fileName=input.files[0]?.name;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return {clipping:layer?.clipping,mask:!!base?.mask?.dataUrl,
      groupBlend:group?.blendMode,groupOpacity:group?.opacity,
      fileName};
  })()`);
  assert(roundTrip.clipping===true&&roundTrip.mask===true&&
    roundTrip.groupBlend==='multiply'&&roundTrip.groupOpacity===.5&&
    roundTrip.fileName==='reopened-isolated-clipping.zpe',
    'native group/mask/clipping must survive project save and real reopen');
  await waitFor('reopened exact image pixels',async()=>{
    const p=await pixels();return white(p)&&pink(p.inside)&&p.clipping===true;
  },12000);
  console.log('CAP-PSD Stage17a real Chromium file:// clipping, isolated group, mask, Undo/Redo and .zpe reopen PASS',JSON.stringify(initial));
}
