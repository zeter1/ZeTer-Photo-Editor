import { decodePsd } from '../src/formats/psd.js';

// Real Chromium file:// UI path: Pen clicks -> Saved Path boolean -> raster Vector Mask -> PSD/PSB.
export async function verifyBrowserPenBoolean({ client, evaluate, waitFor, assert }) {
  const run = fn => evaluate(client, '(' + fn.toString() + ')()');
  const sample = () => evaluate(client, `(() => {
    const canvas=document.querySelector('#editorCanvas');
    if(!canvas||canvas.width!==96)return null;
    const c=canvas.getContext('2d');
    return {inside:[...c.getImageData(50,50,1,1).data],
      outside:[...c.getImageData(12,12,1,1).data]};
  })()`);
  const state = () => evaluate(client, `(() => ({
    rows:document.querySelectorAll('#pathsList .path-row').length,
    history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent),
    current:document.querySelector('#historyList .history-row.current')?.textContent||'',
    selected:document.querySelector('.layer-row.selected')?.textContent||'',
  }))()`);
  const fixture = () => {
    const rect={id:'pen-mask-shape',type:'shape',name:'Pen boolean raster target',shape:'rect',
      x:0,y:0,width:96,height:96,scaleX:1,scaleY:1,rotation:0,fill:'#ff0000',
      stroke:'transparent',strokeWidth:0,visible:true,locked:false,opacity:1,blendMode:'source-over'};
    const path={id:2000,name:'Editable Pen boolean',fillStartsWithAllPixels:false,
      subpaths:[{operation:'add',closed:true,fillRule:'non-zero',points:[
        {x:0,y:0},{x:96,y:0},{x:96,y:96},{x:0,y:96}]}]};
    const project={version:1,name:'Pen boolean E2E',width:96,height:96,background:'transparent',
      selectedLayerId:rect.id,groups:[],paths:[path],layers:[rect]};
    const input=document.querySelector('#projectInput'),transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(project)],'pen-boolean.zpe',{type:'application/json'}));
    input.files=transfer.files;
    const original=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=original;}
    return true;
  };
  assert(await run(fixture),'real project import input');
  await waitFor('Pen boolean project loaded',async()=> {
    const s=await state();return s.rows===1&&s.selected.includes('Pen boolean raster target');
  });
  const start = await evaluate(client,`(() => {
    const row=document.querySelector('#pathsList .path-row');
    row.click(); const edit=document.querySelector('#editPathBtn');
    if(edit.disabled)return {error:'edit disabled'};
    edit.click();
    document.querySelector('#penClosed').checked=true;
    document.querySelector('#penPathOperation').value='subtract';
    const el=document.querySelector('#overlayCanvas'),r=el.getBoundingClientRect();
    return {tool:document.querySelector('[data-tool="pen"]')?.classList.contains('active'),
      x:r.left,y:r.top,width:r.width,height:r.height};
  })()`);
  assert(start.tool===true && start.width>0 && start.height>0,'Pen edit path via real Paths controls',JSON.stringify(start));
  const clickPoint=async(x,y)=>{
    const point={x:start.x+x*start.width/96,y:start.y+y*start.height/96};
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
  };
  for(const [x,y] of [[30,30],[70,30],[70,70],[30,70]])await clickPoint(x,y);
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await waitFor('Pen subpath committed to History',async()=>{
    const s=await state();return s.history.some(row=>row.includes('Добавить подпуть'));
  });
  assert(await evaluate(client,`(() => {
    const row=document.querySelector('#pathsList .path-row');row.click();
    const apply=document.querySelector('#applyPathMaskBtn');
    if(apply.disabled)return false;apply.click();return true;
  })()`),'Saved Path applied through Paths UI');
  await waitFor('real mask subtract alpha',async()=>{
    const p=await sample();return p?.outside[3]===255&&p?.inside[3]===0;
  });
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('Undo remove vector mask',async()=>{
    const p=await sample();return p?.inside[3]===255;
  });
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('Redo restore vector mask',async()=>{
    const p=await sample();return p?.inside[3]===0&&p?.outside[3]===255;
  });
  await evaluate(client,`(() => {
    window.__penBooleanExports=[];
    const create=URL.createObjectURL;
    window.__penBooleanOriginalCreateUrl=create;
    URL.createObjectURL=function(blob){window.__penBooleanExports.push(blob);return create.call(this,blob);};
    return true;
  })()`);
  const captureProject = async()=>{
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2});
    return evaluate(client,`(async()=>{
      const blob=window.__penBooleanExports.at(-1);if(!blob)return null;
      const doc=JSON.parse(await blob.text());
      return {path:doc.paths?.[0],mask:doc.layers.find(l=>l.id==='pen-mask-shape')?.vectorMask};
    })()`);
  };
  const saved=await captureProject();
  assert(saved?.path?.subpaths?.length===2 &&
    saved.path.subpaths[1].operation==='subtract' &&
    saved.mask?.subpaths?.[1]?.operation==='subtract','genuine .zpe retains editable boolean subpath and mask',
    JSON.stringify(saved?.path?.subpaths?.map(s=>s.operation)));
  assert(await evaluate(client,`(() => {
    const blob=window.__penBooleanExports.at(-1);
    if(!blob)return false;
    const input=document.querySelector('#projectInput'),files=new DataTransfer();
    files.items.add(new File([blob],'boolean-reopen.zpe',{type:'application/json'}));
    input.files=files.files;
    const prior=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=prior;}
    return true;
  })()`),'Reopen actual saved .zpe from UI');
  await waitFor('Saved Path and mask reloaded via .zpe',async()=>{
    const s=await state(),p=await sample();
    return s.rows===1 && s.history.length===1
      && p?.inside[3]===0 && p?.outside[3]===255;
  });
  for(const format of ['image/vnd.adobe.photoshop','psb']){
    const before=await evaluate(client,'window.__penBooleanExports.length');
    const submitted=await evaluate(client,`(() => {
      document.querySelector('#exportQuickBtn').click();
      const form=document.querySelector('form.modal');
      if(!form?.elements.format)return false;
      form.elements.format.value=${JSON.stringify(format)};
      form.requestSubmit();return true;
    })()`);
    assert(submitted,'real PSD/PSB export dialog '+format);
    await waitFor('PSD/PSB bytes '+format,async()=>await evaluate(client,
      'window.__penBooleanExports.length')>before);
    const bytes=await evaluate(client,`(async()=>Array.from(new Uint8Array(
      await window.__penBooleanExports.at(-1).arrayBuffer())))()`);
    const parsed=await decodePsd(Uint8Array.from(bytes),{maxPixels:20000,maxLayers:20});
    assert(parsed.paths?.some(path=>path.name==='Editable Pen boolean'
      && path.subpaths?.length===2 && path.subpaths[1].operation==='subtract'),
      format+' must keep native Saved Path boolean and cubic geometry',
      JSON.stringify(parsed.paths?.map(path=>path.subpaths?.map(sub=>sub.operation))));
    const imported=await evaluate(client,`(() => {
      const blob=window.__penBooleanExports.at(-1);
      const file=new File([blob],'boolean.${format==='psb'?'psb':'psd'}',
        {type:'application/octet-stream'});
      const input=document.querySelector('#fileInput'),transfer=new DataTransfer();
      transfer.items.add(file);input.files=transfer.files;
      const original=window.confirm;window.confirm=()=>true;
      try{input.dispatchEvent(new Event('change',{bubbles:true}));}
      finally{window.confirm=original;}
      return true;
    })()`);
    assert(imported,'Open exported PSD/PSB through fileInput');
    await waitFor('PSD/PSB imported boolean alpha '+format,async()=>{
      const p=await sample(),s=await state();
      return s.rows>=1 && p?.inside[3]===0 && p?.outside[3]===255;
    });
  }
  await evaluate(client,'URL.createObjectURL=window.__penBooleanOriginalCreateUrl;true');
  console.log('CAP-BEZ Pen->Saved Path subtract->Vector Mask->Undo/Redo/.zpe/PSD/PSB Chrome PASS');
}
