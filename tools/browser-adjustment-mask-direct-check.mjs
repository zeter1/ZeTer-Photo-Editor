import { decodePsd } from '../src/formats/psd.js';

// Actual Chrome file://, real project input, pointer controls, Layer menu, render,
// History, Ctrl+S and PSD/PSB export dialog (not mocked document/render calls).
export async function verifyBrowserAdjustmentMaskDirect({ client, evaluate, waitFor, assert }) {
  const run = fn => evaluate(client, '(' + fn.toString() + ')()');
  const loadFixture = () => {
    const rect=(id,fill,groupId=null)=>({id,name:id,type:'shape',shape:'rect',
      x:0,y:0,width:64,height:64,scaleX:1,scaleY:1,rotation:0,fill,
      stroke:'transparent',strokeWidth:0,visible:true,locked:false,
      opacity:1,blendMode:'source-over',groupId});
    const mask=points=>({enabled:true,invert:false,density:1,feather:0,subpaths:[
      {operation:'add',closed:true,points}]});
    const levels={id:'adjust-levels',name:'Grouped Levels',type:'adjustment',
      groupId:'nested',clipping:true,visible:true,locked:false,opacity:1,
      blendMode:'source-over',adjustment:{kind:'levels',master:{
        inputBlack:0,inputWhite:255,gamma:2,outputBlack:0,outputWhite:255},channels:[]},
      vectorMask:mask([{x:8,y:8,kind:'smooth',handleIn:{x:4,y:8},handleOut:{x:16,y:8}},
        {x:32,y:8},{x:32,y:56},{x:8,y:56}])};
    const curves={id:'adjust-curves',name:'Grouped Curves',type:'adjustment',
      groupId:'nested',clipping:true,visible:true,locked:false,opacity:1,
      blendMode:'source-over',adjustment:{kind:'curves',channels:[{id:1,points:[
        {input:0,output:0},{input:255,output:0}]}]},
      vectorMask:mask([{x:28,y:8,kind:'smooth',handleIn:{x:22,y:8},handleOut:{x:42,y:8}},
        {x:56,y:8},{x:56,y:56},{x:28,y:56}])};
    const doc={version:1,name:'Adjustment Vector Mask Direct',width:64,height:64,
      background:'transparent',selectedLayerId:levels.id,
      groups:[{id:'outer',name:'Outer',visible:true,locked:false,opacity:1,
        blendMode:'pass-through'}, {id:'nested',name:'Nested',parentGroupId:'outer',
        visible:true,locked:false,opacity:1,blendMode:'pass-through'}],
      layers:[rect('canvas-back','#404040'),rect('group-base','#404040','nested'),levels,curves]};
    const input=document.querySelector('#projectInput'),transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(doc)],'grouped-masks.zpe',{type:'application/json'}));
    input.files=transfer.files;
    const original=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=original;}
    return true;
  };
  const inspect=()=> {
    const canvas=document.querySelector('#editorCanvas');
    if(!canvas||canvas.width!==64||canvas.height!==64)return null;
    const ctx=canvas.getContext('2d');
    const rgba=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
    const data=ctx.getImageData(0,0,64,64).data;
    let hash=2166136261;
    for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619);
    return {hash:hash>>>0,levels:rgba(16,20),both:rgba(30,20),
      curves:rgba(48,20),unmasked:rgba(60,60),
      selected:document.querySelector('.layer-row.selected')?.textContent||'',
      history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent)};
  };
  assert(await run(loadFixture),'load nested Levels/Curves from real .zpe input');
  await waitFor('nested adjustment fixture visible',async()=>{
    const s=await run(inspect);return s?.selected.includes('Grouped Levels')
      &&s.levels[0]>s.unmasked[0]+30 && s.curves[0]<s.unmasked[0]-30;
  });
  const initial=await run(inspect);
  const rect=await evaluate(client,`(() => {
    const r=document.querySelector('#overlayCanvas').getBoundingClientRect();
    return {x:r.left,y:r.top,width:r.width,height:r.height};
  })()`);
  assert(rect.width>0&&rect.height>0,'real canvas rectangle');
  const drag=async(from,to,modifiers=0)=>{
    const map=([x,y])=>({x:rect.x+x*rect.width/64,y:rect.y+y*rect.height/64});
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...map(from),
      button:'left',buttons:1,clickCount:1,modifiers});
    await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',...map(to),
      button:'left',buttons:1,modifiers});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...map(to),
      button:'left',buttons:0,clickCount:1,modifiers});
  };
  const editMask=()=> {
    document.querySelector('[data-menu="layer"]').click();
    const item=[...document.querySelectorAll('.menu-item')]
      .find(el=>el.textContent.includes('Редактировать векторную маску пером'));
    if(!item||item.disabled)return false;
    item.click();
    return document.querySelector('[data-tool="pen"]')?.classList.contains('active');
  };
  assert(await run(editMask),'Layer menu enables Pen for applied Levels Vector Mask');
  await drag([8,8],[19,7]);
  await waitFor('Levels anchor updates grouped composite',async()=>{
    const s=await run(inspect);
    return s?.hash!==initial.hash&&s.history.some(h=>h.includes('Переместить узел векторной маски'));
  });
  const afterLevels=await run(inspect);
  assert(afterLevels.unmasked.every((v,i)=>v===initial.unmasked[i]),
    'drag changes masked correction, not lower unmasked pixels');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('Levels Undo restores exact RGBA',async()=>(await run(inspect))?.hash===initial.hash);
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('Levels Redo restores changed RGBA',async()=>(await run(inspect))?.hash===afterLevels.hash);
  assert(await evaluate(client,`(() => {
    const row=[...document.querySelectorAll('.layer-row')].find(el=>el.textContent.includes('Grouped Curves'));
    if(!row)return false;row.click();
    return document.querySelector('.layer-row.selected')?.textContent.includes('Grouped Curves');
  })()`),'select Curves using real Layers panel');
  assert(await run(editMask),'Layer menu enables Pen for applied Curves Vector Mask');
  await drag([42,8],[48,28],1); // Alt: move handleOut without mirroring handleIn.
  await waitFor('Curves handle changes masked RGB render',async()=>{
    const s=await run(inspect);
    return s?.hash!==afterLevels.hash&&s.history.some(h=>h.includes('Изменить ручку векторной маски'));
  });
  const afterBoth=await run(inspect);
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('Curves handle Undo restores RGBA',async()=>(await run(inspect))?.hash===afterLevels.hash);
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('Curves handle Redo restores RGBA',async()=>(await run(inspect))?.hash===afterBoth.hash);
  await evaluate(client,`(() => {
    window.__adjMaskBlobs=[];
    const original=URL.createObjectURL;window.__adjMaskOriginalUrl=original;
    URL.createObjectURL=function(blob){window.__adjMaskBlobs.push(blob);return original.call(this,blob);};
  })()`);
  const save=async()=>{
    const before=await evaluate(client,'window.__adjMaskBlobs.length');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',
      windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',
      windowsVirtualKeyCode:83,modifiers:2});
    await waitFor('project Blob downloaded',async()=>await evaluate(client,'window.__adjMaskBlobs.length')>before);
    return evaluate(client,`(async()=> {
      const doc=JSON.parse(await window.__adjMaskBlobs.at(-1).text());
      return {doc,levels:doc.layers.find(l=>l.adjustment?.kind==='levels'),
        curves:doc.layers.find(l=>l.adjustment?.kind==='curves')};
    })()`);
  };
  const click=async(point,modifiers)=>{
    const x=rect.x+point[0]*rect.width/64;
    const y=rect.y+point[1]*rect.height/64;
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,
      button:'left',buttons:1,clickCount:1,modifiers});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,
      button:'left',buttons:0,clickCount:1,modifiers});
  };
  // Real pointer insertion does not alter cubic alpha. Delete preserves the
  // neighbouring cubic controls; Undo/Redo must restore *editable* nodes.
  await evaluate(client,"window.__nodeBefore=Array.from(document.querySelector('#editorCanvas').getContext('2d').getImageData(0,0,64,64).data);true");
  await click([49,16],2); // Ctrl+click on the transformed Curves cubic segment.
  await waitFor('Curves cubic insert history',async()=>
    (await run(inspect))?.history.some(h=>h.includes('Добавить узел векторной маски')));
  const inserted=await save();
  assert(inserted.curves.vectorMask.subpaths[0].points.length===5,
    'Ctrl+click inserts a native Curves mask node');
  const nodeDiff=await evaluate(client,`(() => {const a=window.__nodeBefore,b=Array.from(document.querySelector('#editorCanvas').getContext('2d').getImageData(0,0,64,64).data);let changed=0,max=0,total=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){changed++;max=Math.max(max,d);total+=d;}}return {changed,max,total};})()`);
  // The mathematical cubic is exact (unit oracle); Chromium's per-segment
  // antialias tessellation may differ by a few boundary-channel values.
  assert(nodeDiff.max<=8 && nodeDiff.changed<=4,
    'splitting the cubic changes at most four antialiased channel samples');
  const afterInsertion=await run(inspect);
  assert(afterInsertion.unmasked.every((v,i)=>v===afterBoth.unmasked[i]),
    'inserting a Vector Mask node never changes unmasked lower pixels');
  const newNode=inserted.curves.vectorMask.subpaths[0].points[1];
  await click([newNode.x,newNode.y],3); // Ctrl+Alt+click existing anchor.
  const deleted=await save();
  assert(deleted.curves.vectorMask.subpaths[0].points.length===4,
    'Ctrl+Alt deletes the inserted node without flattening');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  const undoDelete=await save();
  assert(undoDelete.curves.vectorMask.subpaths[0].points.length===5,
    'Undo restores the exact editable inserted node');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  const redoDelete=await save();
  assert(redoDelete.curves.vectorMask.subpaths[0].points.length===4,
    'Redo restores the node deletion');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  const restoredInsert=await save();
  assert(restoredInsert.curves.vectorMask.subpaths[0].points.length===5 &&
    (await run(inspect)).hash===afterInsertion.hash,
    'Undo restores inserted cubic and matching RGBA before PSD/PSB export');
  const saved=await save();
  const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<2;
  assert(saved.levels?.vectorMask?.subpaths?.length===1 &&
    saved.curves?.vectorMask?.subpaths?.length===1 &&
    near(saved.levels.vectorMask.subpaths[0].points[0].x,19) &&
    saved.curves.vectorMask.subpaths[0].points.length===5 &&
    saved.curves.vectorMask.subpaths[0].points[1].kind==='smooth' &&
    saved.doc.groups.length===2,'real .zpe keeps grouped editable Levels/Curves masks',
    JSON.stringify({levels:saved.levels?.vectorMask,curves:saved.curves?.vectorMask}));
  assert(await evaluate(client,`(() => {
    const blob=window.__adjMaskBlobs.at(-1),files=new DataTransfer();
    files.items.add(new File([blob],'reopen-grouped.zpe',{type:'application/json'}));
    const input=document.querySelector('#projectInput');input.files=files.files;
    const old=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}finally{window.confirm=old;}
    return true;
  })()`),'reopen actual saved .zpe');
  await waitFor('.zpe round-trip matches composite',async()=>(await run(inspect))?.hash===afterInsertion.hash);
  for (const format of ['image/vnd.adobe.photoshop','psb']) {
    const before=await evaluate(client,'window.__adjMaskBlobs.length');
    assert(await evaluate(client,`(() => {
      document.querySelector('#exportQuickBtn').click();
      const form=document.querySelector('form.modal');if(!form?.elements.format)return false;
      form.elements.format.value=${JSON.stringify(format)};
      form.requestSubmit();return true;
    })()`),'native PSD/PSB export UI '+format);
    await waitFor('binary export '+format,async()=>await evaluate(client,'window.__adjMaskBlobs.length')>before);
    const bytes=await evaluate(client,`(async()=>Array.from(new Uint8Array(
      await window.__adjMaskBlobs.at(-1).arrayBuffer())))()`);
    const parsed=await decodePsd(Uint8Array.from(bytes),{maxPixels:20000,maxLayers:20});
    const adj=parsed.adjustmentLayers??[];
    assert(adj.length===2 && (parsed.groups?.length??0)>=2 &&
      adj.some(layer=>layer.psdAdjustment?.parsed?.kind==='levels' &&
        layer.vectorMask?.subpaths?.length===1) &&
      adj.some(layer=>layer.psdAdjustment?.parsed?.kind==='curves' &&
        layer.vectorMask?.subpaths?.length===1),
      format+' stores native editable adjustments and both vector masks',
      JSON.stringify({layers:adj.map(l=>({name:l.name,kind:l.psdAdjustment?.parsed?.kind,
        mask:l.vectorMask?.subpaths?.length})),groups:parsed.groups?.length}));
    assert(await evaluate(client,`(() => {
      const blob=window.__adjMaskBlobs.at(-1),files=new DataTransfer();
      files.items.add(new File([blob],'reimport.${format==='psb'?'psb':'psd'}',
        {type:'application/octet-stream'}));
      const input=document.querySelector('#fileInput');input.files=files.files;
      const old=window.confirm;window.confirm=()=>true;
      try{input.dispatchEvent(new Event('change',{bubbles:true}));}finally{window.confirm=old;}
      return true;
    })()`),'PSD/PSB real fileInput import');
    await waitFor('PSD/PSB group composite reimport '+format,async()=>{
      const s=await run(inspect);return s?.hash===afterInsertion.hash;
    });
    const imported=await save();
    assert(imported.levels?.vectorMask?.subpaths?.length===1 &&
      imported.curves?.vectorMask?.subpaths?.length===1 &&
      imported.doc.groups?.length>=2,
      format+' reimport .zpe keeps editable grouped masks');
  }
  await evaluate(client,'URL.createObjectURL=window.__adjMaskOriginalUrl;true');
  console.log('CAP-BEZ-MASK-ADJUSTMENT Chrome file:// Levels/Curves group/pointer/Undo/.zpe/PSD+PSB PASS');
}
