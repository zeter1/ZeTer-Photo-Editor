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


export async function verifyMaskedPassThroughBackdrop(client, { evaluate, waitFor, assert }) {
  const loaded = await evaluate(client, `(() => {
    try {
    const bitmap = (rgba) => {
      const canvas = document.createElement('canvas');
      canvas.width = 4; canvas.height = 2;
      const context = canvas.getContext('2d');
      const pixels = context.createImageData(4, 2);
      for (let i = 0; i < 8; i++) {
        pixels.data.set(rgba(i % 4), i * 4);
      }
      context.putImageData(pixels, 0, 0);
      return canvas.toDataURL('image/png');
    };
    const project = {
      version: 1, name: 'Backdrop-sensitive masked pass through',
      width: 4, height: 2, background: '#0000ff',
      groups: [{
        id: 'pass-folder', name: 'Pass through folder', parentGroupId: null,
        visible: true, locked: false, collapsed: false,
        opacity: 1, blendMode: 'pass-through',
        mask: { enabled: true, dataUrl: bitmap(x => [255,255,255,x===0?255:x===1?128:0]),
          invert: false, density: 1, feather: 0, linked: true }
      }],
      layers: [{
        id: 'multiply-red', name: 'Multiply against actual blue', type: 'raster',
        x: 0, y: 0, width: 4, height: 2, scaleX: 1, scaleY: 1,
        rotation: 0, visible: true, locked: false,
        opacity: 1, blendMode: 'multiply', groupId: 'pass-folder',
        dataUrl: bitmap(() => [255,0,0,255])
      }],
      selectedLayerId: 'multiply-red'
    };
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(project)], 'masked-pass-through.zpe',
      {type:'application/json'}));
    const input = document.querySelector('#projectInput');
    input.files = transfer.files;
    const fileName = input.files[0]?.name;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return fileName;
    } catch(error) { return { error: String(error), stack: error?.stack }; }
  })()`);
  console.log('Backdrop test native input:', JSON.stringify(loaded));
  assert(loaded === 'masked-pass-through.zpe', 'real native project File input');
  const pixels = () => evaluate(client, `(() => {
    const ctx = document.querySelector('#editorCanvas').getContext('2d');
    return [0, 1, 3].map(x => Array.from(ctx.getImageData(x, 0, 1, 1).data));
  })()`);
  const near = (actual, expected) => actual?.length === 4 &&
    expected.every((value,index) => Math.abs(actual[index] - value) <= 1);
  await waitFor('pass-through folder applies multiply to actual backdrop then attenuates',
    async () => {
      const actual = await pixels();
      return near(actual[0], [0,0,0,255]) &&
        near(actual[1], [0,0,127,255]) &&
        near(actual[2], [0,0,255,255]);
    }, 10000);
  console.log('Masked Pass Through backdrop-aware native file:// exact RGBA PASS:',
    JSON.stringify(await pixels()));

  // Use the real Group Properties UI, not an injected document mutation.
  const changed = await evaluate(client, `(() => {
    const row = document.querySelector('[data-group-id="pass-folder"]');
    if (!row) return {error:'group row missing'};
    row.dispatchEvent(new MouseEvent('contextmenu',
      {bubbles:true,cancelable:true,clientX:30,clientY:30}));
    const button = [...document.querySelectorAll('#menuPopover .menu-item')]
      .find(el => el.textContent.includes('Параметры группы'));
    if (!button) return {error:'properties menu missing',items:[...document.querySelectorAll('#menuPopover .menu-item')].map(x=>x.textContent),row:row.outerHTML.slice(0,250)};
    button.click();
    const control = document.querySelector('select[name="maskEnabled"]');
    const modal = control?.closest('.modal');
    if (!modal || control.value !== 'enabled') return {error:'mask setting missing'};
    control.value = 'disabled';
    control.dispatchEvent(new Event('change',{bubbles:true}));
    modal.requestSubmit();
    return true;
  })()`);
  assert(changed === true, 'mask enable/disable is available in live Group Properties: '+JSON.stringify(changed));
  await waitFor('Properties disables backdrop mask', async () =>
    near((await pixels())[2], [0,0,0,255]), 12000);
  await evaluate(client, `document.querySelector('#undoBtn').click()`);
  await waitFor('Undo restores masked pass-through backdrop', async () =>
    near((await pixels())[2], [0,0,255,255]), 12000);
  await evaluate(client, `document.querySelector('#redoBtn').click()`);
  await waitFor('Redo reapplies pass-through without mask', async () =>
    near((await pixels())[2], [0,0,0,255]), 12000);
  await evaluate(client, `document.querySelector('#undoBtn').click()`);
  await waitFor('Undo ready for native project save', async () =>
    near((await pixels())[1], [0,0,127,255]), 12000);

  const saved = await evaluate(client, `(() => {
    window.__passThroughSaved = null;
    const previous = URL.createObjectURL;
    URL.createObjectURL = function(blob, ...args) {
      if (blob instanceof Blob && blob.type === 'application/json')
        window.__passThroughSaved = blob;
      return previous.call(URL,blob,...args);
    };
    window.__restorePassThroughUrl = () => { URL.createObjectURL = previous; };
    document.querySelector('[data-menu="file"]').click();
    const button = [...document.querySelectorAll('#menuPopover .menu-item')]
      .find(el => el.textContent.includes('Сохранить проект'));
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert(saved, 'real File > Save Project action');
  await waitFor('masked pass-through native ZPE saved', async () =>
    evaluate(client, `Boolean(window.__passThroughSaved)`), 12000);
  const persisted = await evaluate(client, `(async () => {
    const text = await window.__passThroughSaved.text();
    window.__restorePassThroughUrl?.();
    const stored = JSON.parse(text);
    const folder = stored.groups.find(group => group.id === 'pass-folder');
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'masked-pass-through-reopen.zpe',
      {type:'application/json'}));
    const input = document.querySelector('#projectInput');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return {blendMode:folder?.blendMode, enabled:folder?.mask?.enabled,
      bitmap:folder?.mask?.dataUrl?.startsWith('data:image/')};
  })()`);
  assert(persisted.blendMode === 'pass-through' && persisted.enabled === true &&
    persisted.bitmap, 'masked pass-through survives native ZPE: '+JSON.stringify(persisted));
  await waitFor('reopened pass-through exact pixels', async () =>
    near((await pixels())[0], [0,0,0,255]) &&
    near((await pixels())[1], [0,0,127,255]) &&
    near((await pixels())[2], [0,0,255,255]), 12000);
  console.log('Masked Pass Through Group Properties, Undo/Redo, native .zpe reopen PASS');
}
