// Real production Chromium file:// group-mask pixels, UI History and project IO.
export async function verifyGroupRasterMask(client, { evaluate, waitFor, assert }) {
  const loaded = await evaluate(client, `(() => {
    try {
    window.confirm=()=>true;
    const make=(color,half=false)=>{
      const c=document.createElement('canvas');c.width=4;c.height=2;
      const ctx=c.getContext('2d');
      ctx.fillStyle=color;ctx.fillRect(0,0,half?2:4,2);
      return c.toDataURL('image/png');
    };
    const ink={id:'group-ink',name:'Group ink',type:'raster',
      x:0,y:0,width:4,height:2,scaleX:1,scaleY:1,rotation:0,
      visible:true,locked:false,opacity:1,blendMode:'source-over',
      groupId:'masked-folder',dataUrl:make('#ff0000')};
    const group={id:'masked-folder',name:'Masked folder',parentGroupId:null,
      visible:true,locked:false,collapsed:false,opacity:.5,blendMode:'multiply',
      mask:{enabled:true,dataUrl:make('#ffffff',true),invert:false,density:1,feather:0,linked:true}};
    const project={version:1,name:'Group folder mask E2E',width:4,height:2,
      background:'#ffffff',groups:[group],layers:[ink],selectedLayerId:ink.id};
    const transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(project)],'group-raster-mask.zpe',{type:'application/json'}));
    const input=document.querySelector('#projectInput');
    input.files=transfer.files;
    const fileName=input.files[0]?.name;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return fileName;
    } catch(error) {return {error:String(error), stack:error?.stack};}
  })()`);
  console.log('Stage17b browser import returned:',JSON.stringify(loaded));
  assert(loaded==='group-raster-mask.zpe','real .zpe File input');
  const pixels=()=>evaluate(client,`(() => {
    const c=document.querySelector('#editorCanvas'),ctx=c.getContext('2d');
    return {width:c.width,height:c.height,
      left:Array.from(ctx.getImageData(0,0,1,1).data),
      right:Array.from(ctx.getImageData(3,0,1,1).data),
      folder:Boolean(document.querySelector('[data-group-id="masked-folder"]'))};
  })()`);
  const pink=p=>p?.[0]>=252&&p[1]>=123&&p[1]<=133&&p[2]>=123&&p[2]<=133&&p[3]===255;
  const white=p=>p?.[0]>=252&&p[1]>=252&&p[2]>=252&&p[3]===255;
  await waitFor('masked folder exact RGBA',async()=>{
    const p=await pixels();return p.width===4&&p.height===2&&p.folder&&pink(p.left)&&white(p.right);
  },12000);
  console.log('Stage17b folder mask initial pixel oracle:',JSON.stringify(await pixels()));
  const opened=await evaluate(client,`(() => {
    const row=document.querySelector('[data-group-id="masked-folder"]');
    if(!row)return {error:'no row'};
    row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:30,clientY:30}));
    const button=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(el=>el.textContent.includes('Параметры группы'));
    if(!button)return {error:'no menu',items:[...document.querySelectorAll('#menuPopover .menu-item')].map(el=>el.textContent)};
    button.click();
    const modal=document.querySelector('.modal[aria-label="Параметры группы"]');
    return {modal:!!modal,maskValue:modal?.querySelector('[name="maskEnabled"]')?.value};
  })()`);
  assert(opened?.modal&&opened.maskValue==='enabled','group context menu exposes folder mask toggle: '+JSON.stringify(opened));
  const disabled=await evaluate(client,`(() => {
    const modal=document.querySelector('.modal[aria-label="Параметры группы"]');
    const mask=modal?.querySelector('select[name="maskEnabled"]');
    if(!mask)return false;
    mask.value='disabled';mask.dispatchEvent(new Event('change',{bubbles:true}));
    modal.requestSubmit();return true;
  })()`);
  assert(disabled,'submit group Properties mask disabled');
  await waitFor('group mask disabled reveals right pixels',async()=>{
    const p=await pixels();return pink(p.left)&&pink(p.right);
  },12000);
  await evaluate(client,`document.querySelector('#undoBtn').click()`);
  await waitFor('Undo group mask',async()=>white((await pixels()).right),12000);
  await evaluate(client,`document.querySelector('#redoBtn').click()`);
  await waitFor('Redo group mask',async()=>pink((await pixels()).right),12000);
  await evaluate(client,`document.querySelector('#undoBtn').click()`);
  await waitFor('Undo before native project save',async()=>white((await pixels()).right),12000);
  const saving=await evaluate(client,`(() => {
    window.__groupMaskSaved=null;
    const original=URL.createObjectURL;
    URL.createObjectURL=function(blob,...args){
      if(blob instanceof Blob&&blob.type==='application/json')window.__groupMaskSaved=blob;
      return original.call(URL,blob,...args);
    };
    window.__restoreGroupMaskUrl=()=>{URL.createObjectURL=original;};
    document.querySelector('[data-menu="file"]').click();
    const button=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(el=>el.textContent.includes('Сохранить проект'));
    if(!button||button.disabled)return false;
    button.click();return true;
  })()`);
  assert(saving,'File > Save Project used real UI');
  await waitFor('native saved group project blob',async()=>
    evaluate(client,`Boolean(window.__groupMaskSaved)`),12000);
  const persisted=await evaluate(client,`(async()=>{
    const text=await window.__groupMaskSaved.text();
    window.__restoreGroupMaskUrl?.();
    const doc=JSON.parse(text);
    const group=doc.groups.find(g=>g.id==='masked-folder');
    const input=document.querySelector('#projectInput');
    const transfer=new DataTransfer();
    transfer.items.add(new File([text],'group-reopened.zpe',{type:'application/json'}));
    input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    return {enabled:group?.mask?.enabled,bitmap:group?.mask?.dataUrl?.startsWith('data:image/'),
      blendMode:group?.blendMode,opacity:group?.opacity};
  })()`);
  assert(persisted.enabled===true&&persisted.bitmap&&persisted.blendMode==='multiply'
    &&persisted.opacity===.5,'native group bitmap/controls persisted '+JSON.stringify(persisted));
  await waitFor('reopened masked group exact pixels',async()=>{
    const p=await pixels();return pink(p.left)&&white(p.right);
  },12000);
  console.log('CAP-PSD group raster mask Chromium file:// UI, Undo/Redo, .zpe reopen PASS');
}
