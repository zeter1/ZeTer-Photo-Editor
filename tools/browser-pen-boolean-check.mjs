import { decodePsd } from '../src/formats/psd.js';
import { layerPixelToDocumentPoint } from '../src/core/geometry.js';

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
    // A real target layer is loaded, but no Saved Path is preinstalled: the Paths UI must create it.
    const project={version:1,name:'Pen boolean E2E',width:96,height:96,background:'transparent',
      selectedLayerId:rect.id,groups:[],paths:[],layers:[rect]};
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
    const s=await state();return s.rows===0&&s.selected.includes('Pen boolean raster target');
  });
  const start = await evaluate(client,`(() => {
    const create=document.querySelector('#newPathBtn');
    if(!create||create.disabled)return {error:'new path disabled'};
    create.click();
    document.querySelector('#penClosed').checked=true;
    document.querySelector('#penPathOperation').value='add';
    const el=document.querySelector('#overlayCanvas'),r=el.getBoundingClientRect();
    return {tool:document.querySelector('[data-tool="pen"]')?.classList.contains('active'),
      rows:document.querySelectorAll('#pathsList .path-row').length,
      applyDisabled:document.querySelector('#applyPathMaskBtn')?.disabled,
      x:r.left,y:r.top,width:r.width,height:r.height};
  })()`);
  assert(start.tool===true && start.rows===1 && start.applyDisabled
    && start.width>0 && start.height>0,'New Saved Path and Pen via real Paths UI',JSON.stringify(start));
  const clickPoint=async(x,y)=>{
    const point={x:start.x+x*start.width/96,y:start.y+y*start.height/96};
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
  };
  const finishPath = async () => {
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  };
  for(const [x,y] of [[8,8],[88,8],[88,88],[8,88]])await clickPoint(x,y);
  await finishPath();
  await waitFor('first Pen subpath committed to History',async()=>{
    const s=await state();return s.history.some(row=>row.includes('Добавить подпуть'));
  });
  await evaluate(client,"document.querySelector('#penPathOperation').value='subtract';true");
  for(const [x,y] of [[30,30],[70,30],[70,70],[30,70]])await clickPoint(x,y);
  await finishPath();
  await waitFor('second Pen subpath committed',async()=>{
    const s=await state();return s.history.filter(row=>row.includes('Добавить подпуть')).length===2;
  });
  // Real pointer gestures: create a short cubic handle, then drag the same anchor.
  // Before the nearest-control fix, the handle stole the second pointerdown.
  const dragPoint=async(from,to,modifiers=0)=>{
    const map=([x,y])=>({x:start.x+x*start.width/96,y:start.y+y*start.height/96});
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...map(from),button:'left',buttons:1,clickCount:1,modifiers});
    await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',...map(to),button:'left',buttons:1,modifiers});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...map(to),button:'left',buttons:0,clickCount:1,modifiers});
  };
  await dragPoint([8,8],[12,8],8); // Shift+anchor creates smooth handleOut at x=12.
  await waitFor('Saved Path cubic handle drag committed',async()=>
    (await state()).history.some(row=>row.includes('Изменить ручку сохранённого контура')));
  await dragPoint([8,8],[8,3]); // Anchor must win over its nearby handles.
  await waitFor('Saved Path anchor drag committed',async()=>
    (await state()).history.some(row=>row.includes('Переместить узел сохранённого контура')));
  assert(await evaluate(client,`(() => {
    const row=document.querySelector('#pathsList .path-row');row.click();
    const apply=document.querySelector('#applyPathMaskBtn');
    if(apply.disabled)return false;apply.click();return true;
  })()`),'Saved Path applied through Paths UI');
  await waitFor('real mask subtract alpha',async()=>{
    const p=await sample();return p?.outside[3]===255&&p?.inside[3]===0;
  });
  assert(await evaluate(client,`(() => {
    const sub=document.querySelector('#pathSubpathSelect');
    const op=document.querySelector('#pathSubpathOperation');
    if(sub.disabled||op.disabled||sub.options.length!==2)return false;
    sub.value='1';sub.dispatchEvent(new Event('change',{bubbles:true}));
    if(op.value!=='subtract')return false;
    op.value='add';op.dispatchEvent(new Event('change',{bubbles:true}));
    if(op.value!=='add')return false;
    document.querySelector('#applyPathMaskBtn').click();
    return true;
  })()`),'Change existing second subpath operation and reapply real mask');
  await waitFor('existing subpath changed from subtract to add in rendered alpha',async()=>{
    const p=await sample();return p?.outside[3]===255&&p?.inside[3]===255;
  });
  assert(await evaluate(client,`(() => {
    const op=document.querySelector('#pathSubpathOperation');
    if(op.disabled||op.value!=='add')return false;
    op.value='subtract';op.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#applyPathMaskBtn').click();
    return true;
  })()`),'Restore subtract operation with real Paths UI control');
  await waitFor('restored subtract operation in mask alpha',async()=>{
    const p=await sample();return p?.outside[3]===255&&p?.inside[3]===0;
  });
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('Undo restores previous add mask pixels',async()=>{
    const p=await sample();return p?.inside[3]===255&&p?.outside[3]===255;
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
      const maskedLayer=doc.layers.find(l=>l.vectorMask?.subpaths?.length===2);
      return {path:doc.paths?.[0],mask:maskedLayer?.vectorMask,
        maskLayer:maskedLayer && {x:maskedLayer.x,y:maskedLayer.y,width:maskedLayer.width,
          height:maskedLayer.height,scaleX:maskedLayer.scaleX,scaleY:maskedLayer.scaleY,rotation:maskedLayer.rotation},
        scaleX:maskedLayer?.scaleX??1,scaleY:maskedLayer?.scaleY??1};
    })()`);
  };
  const saved=await captureProject();
  assert(saved?.path?.subpaths?.length===2 &&
    saved.path.subpaths[1].operation==='subtract' &&
    saved.mask?.subpaths?.[1]?.operation==='subtract','genuine .zpe retains editable boolean subpath and mask',
    JSON.stringify(saved?.path?.subpaths?.map(s=>s.operation)));
  const near=(value,expected)=>Number.isFinite(value)&&Math.abs(value-expected)<0.2;
  const moved=saved?.path?.subpaths?.[0]?.points?.[0];
  assert(moved && near(moved.x,8) && near(moved.y,3)
    && near(moved.handleOut?.x,12) && near(moved.handleOut?.y,3)
    && near(moved.handleIn?.x,4) && near(moved.handleIn?.y,3),
    'real pointer anchor/handle drag persists exact editable cubic geometry in .zpe',JSON.stringify(moved));
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
    const nativePath=parsed.paths?.find(path=>path.subpaths?.length===2
      && path.subpaths[0].operation==='add' && path.subpaths[1].operation==='subtract'
      && path.subpaths.every(subpath=>subpath.points?.length===4));
    assert(nativePath,
      format+' must keep native Saved Path boolean and cubic geometry',
      JSON.stringify(parsed.paths?.map(path=>path.subpaths?.map(sub=>sub.operation))));
    const nativeNode=nativePath.subpaths[0].points[0];
    assert(near(nativeNode.x,8) && near(nativeNode.y,3)
      && near(nativeNode.handleOut?.x,12) && near(nativeNode.handleOut?.y,3)
      && near(nativeNode.handleIn?.x,4) && near(nativeNode.handleIn?.y,3),
      format+' native editable cubic geometry must match genuine UI anchor/handle drag',
      JSON.stringify(nativeNode));
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
  // Save baseline before entering mask edit mode: Ctrl+S resets active Pen edit authority.
  const beforeMaskDrag=await captureProject();
  // Directly edit an applied Vector Mask via the user's Layer menu, not the Saved Path.
  const maskEdit = await evaluate(client, `(() => {
    document.querySelector('[data-menu="layer"]').click();
    const edit=[...document.querySelectorAll('.menu-item')]
      .find(item=>item.textContent.includes('Редактировать векторную маску пером'));
    if(!edit||edit.disabled)return {error:'mask edit menu unavailable'};
    edit.click();
    return {pen:document.querySelector('[data-tool="pen"]')?.classList.contains('active')};
  })()`);
  assert(maskEdit.pen===true,'entered applied Vector Mask editor via real Layer menu',JSON.stringify(maskEdit));
  const maskAlpha=(x,y)=>evaluate(client,
    `(() => document.querySelector('#editorCanvas').getContext('2d')
      .getImageData(${x},${y},1,1).data[3])()`);
  assert((await maskAlpha(33,35))===0,'before direct mask drag the edge pixel is transparent');
  await dragPoint([30,30],[40,20]);
  await waitFor('direct Vector Mask anchor commit',async()=>
    (await state()).history.some(row=>row.includes('Переместить узел векторной маски')));
  await waitFor('direct mask drag updates alpha',async()=>await maskAlpha(33,35)===255);
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('Undo restores original mask alpha',async()=>await maskAlpha(33,35)===0);
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('Redo restores edited mask alpha',async()=>await maskAlpha(33,35)===255);
  const changed=await captureProject();
  const maskNode=changed?.mask?.subpaths?.[1]?.points?.[0];
  const savedNode=changed?.path?.subpaths?.[1]?.points?.[0];
  const originalMaskNode=beforeMaskDrag?.mask?.subpaths?.[1]?.points?.[0];
  // PSD import snaps coordinates to the native mask pixel grid. The CDP gesture
  // starts inside the hit radius, so CSS-to-canvas rounding may offset the delta.
  assert(maskNode && originalMaskNode
    && Math.abs((maskNode.x-originalMaskNode.x)-10/changed.scaleX)<2.1
    && Math.abs((maskNode.y-originalMaskNode.y)+10/changed.scaleY)<2.1
    && near(savedNode?.x,30) && near(savedNode?.y,30),
    'direct mask anchor geometry persists in .zpe; Saved Path remains unchanged',
    JSON.stringify({maskNode,originalMaskNode,savedNode,scaleX:changed.scaleX,scaleY:changed.scaleY}));
  // Operation editing now targets the already-applied mask, not the Saved Path.
  const maskOperationEdited=await evaluate(client, `(() => {
    document.querySelector('[data-menu="layer"]').click();
    const edit=[...document.querySelectorAll('.menu-item')]
      .find(item=>item.textContent.includes('Операция контура векторной маски'));
    if(!edit||edit.disabled)return {error:'operation menu unavailable'};
    edit.click();
    const form=document.querySelector('form.modal');
    if(!form?.elements.subpath||!form?.elements.operation)return {error:'operation dialog unavailable'};
    form.elements.subpath.value='1';
    form.elements.subpath.dispatchEvent(new Event('change',{bubbles:true}));
    if(form.elements.operation.value!=='subtract')return {error:'subpath operation was not synchronized'};
    form.elements.operation.value='add';
    form.requestSubmit();
    return {submitted:true};
  })()`);
  assert(maskOperationEdited.submitted===true,
    'real Layer menu directly changes applied Vector Mask operation',
    JSON.stringify(maskOperationEdited));
  await waitFor('applied mask operation updates rendered alpha immediately',
    async()=>await maskAlpha(50,50)===255);
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('Undo applied mask operation restores subtract hole',
    async()=>await maskAlpha(50,50)===0);
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('Redo applied mask operation restores opaque center',
    async()=>await maskAlpha(50,50)===255);
  const nativeMaskState=await captureProject();
  const finalMaskNode=nativeMaskState?.mask?.subpaths?.[1]?.points?.[0];
  assert(nativeMaskState?.mask?.subpaths?.[1]?.operation==='add'
    && near(finalMaskNode?.x,maskNode.x) && near(finalMaskNode?.y,maskNode.y)
    && nativeMaskState?.path?.subpaths?.[1]?.operation==='subtract',
    'zpe keeps independent editable Vector Mask operation + cubic geometry',
    JSON.stringify(nativeMaskState?.mask?.subpaths?.[1]));
  // Edit BOTH cubic handles of the already-applied mask through real Pen pointer gestures.
  // Compare the full rendered alpha plane rather than a synthetic geometry-only assertion.
  const originalHandleNode=nativeMaskState?.mask?.subpaths?.[0]?.points?.[0];
  assert(originalHandleNode?.handleIn && originalHandleNode?.handleOut,
    'reopened PSD/PSB mask retains both editable cubic handles');
  const maskLayer=nativeMaskState.maskLayer;
  const atDocument=point=>layerPixelToDocumentPoint(point,maskLayer);
  const alphaDigest=()=>evaluate(client,`(() => {
    const canvas=document.querySelector('#editorCanvas');
    const pixels=canvas.getContext('2d').getImageData(0,0,96,96).data;
    let hash=2166136261;
    for(let i=3;i<pixels.length;i+=4)hash=Math.imul(hash^pixels[i],16777619);
    return hash>>>0;
  })()`);
  const beforeHandlesAlpha=await alphaDigest();
  assert(await evaluate(client,`(() => {
    document.querySelector('[data-menu="layer"]').click();
    const edit=[...document.querySelectorAll('.menu-item')]
      .find(item=>item.textContent.includes('Редактировать векторную маску пером'));
    if(!edit||edit.disabled)return false;
    edit.click();
    return document.querySelector('[data-tool="pen"]')?.classList.contains('active');
  })()`),'re-enter applied Vector Mask Pen mode for handle edits');
  const outFrom=atDocument(originalHandleNode.handleOut);
  const outDestination=atDocument({x:originalHandleNode.x+28,y:originalHandleNode.y+35});
  await dragPoint([outFrom.x,outFrom.y],[outDestination.x,outDestination.y],1); // Alt keeps opposite handle independent
  await waitFor('direct applied-mask handle commit',async()=>
    (await state()).history.some(row=>row.includes('Изменить ручку векторной маски')));
  const afterOutAlpha=await alphaDigest();
  assert(afterOutAlpha!==beforeHandlesAlpha,'handleOut drag changes real rendered alpha');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('Undo handleOut restores exact alpha plane',async()=>await alphaDigest()===beforeHandlesAlpha);
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('Redo handleOut restores edited alpha plane',async()=>await alphaDigest()===afterOutAlpha);
  const inFrom=atDocument(originalHandleNode.handleIn);
  const inDestination=atDocument({x:originalHandleNode.x+33,y:originalHandleNode.y+45});
  await dragPoint([inFrom.x,inFrom.y],[inDestination.x,inDestination.y],1);
  const afterInAlpha=await alphaDigest();
  assert(afterInAlpha!==afterOutAlpha,'handleIn drag changes rendered alpha independently');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  await waitFor('Undo handleIn restores previous alpha',async()=>await alphaDigest()===afterOutAlpha);
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  await waitFor('Redo handleIn restores its alpha',async()=>await alphaDigest()===afterInAlpha);
  const editedHandlesState=await captureProject();
  const editedHandleNode=editedHandlesState?.mask?.subpaths?.[0]?.points?.[0];
  const closePoint=(a,b)=>a && b && Math.abs(a.x-b.x)<2.1 && Math.abs(a.y-b.y)<2.1;
  assert(closePoint(editedHandleNode?.handleOut,{x:originalHandleNode.x+28,y:originalHandleNode.y+35})
    && closePoint(editedHandleNode?.handleIn,{x:originalHandleNode.x+33,y:originalHandleNode.y+45})
    && editedHandlesState.path.subpaths[0].points[0].handleOut.x===saved.path.subpaths[0].points[0].handleOut.x,
    'both applied-mask handles persist in .zpe without mutating the independent Saved Path',
    JSON.stringify({before:originalHandleNode,after:editedHandleNode}));
  const documentMaskNode=layerPixelToDocumentPoint(finalMaskNode,nativeMaskState.maskLayer);
  for(const format of ['image/vnd.adobe.photoshop','psb']){
    const before=await evaluate(client,'window.__penBooleanExports.length');
    assert(await evaluate(client,`(() => {
      document.querySelector('#exportQuickBtn').click();
      const form=document.querySelector('form.modal');
      if(!form?.elements.format)return false;
      form.elements.format.value=${JSON.stringify(format)};
      form.requestSubmit();return true;
    })()`),'edited Vector Mask UI export '+format);
    await waitFor('edited Vector Mask PSD/PSB bytes '+format,async()=>
      await evaluate(client,'window.__penBooleanExports.length')>before);
    const bytes=await evaluate(client,`(async()=>Array.from(new Uint8Array(
      await window.__penBooleanExports.at(-1).arrayBuffer())))()`);
    const parsed=await decodePsd(Uint8Array.from(bytes),{maxPixels:20000,maxLayers:20});
    const imported=parsed.layers?.find(layer=>layer.vectorMask?.subpaths?.length===2)?.vectorMask;
    const node=imported?.subpaths?.[1]?.points?.[0];
    assert(imported?.subpaths?.[1]?.operation==='add'
      && node && near(node.x,documentMaskNode.x) && near(node.y,documentMaskNode.y),
      format+' native editable Vector Mask geometry + operation',
      JSON.stringify({node,expected:documentMaskNode,operation:imported?.subpaths?.[1]?.operation}));
    const nativeFirst=imported?.subpaths?.[0]?.points?.[0];
    const nativeExpectedIn=atDocument(editedHandleNode.handleIn);
    const nativeExpectedOut=atDocument(editedHandleNode.handleOut);
    assert(nativeFirst && near(nativeFirst.handleIn?.x,nativeExpectedIn.x)
      && near(nativeFirst.handleIn?.y,nativeExpectedIn.y)
      && near(nativeFirst.handleOut?.x,nativeExpectedOut.x)
      && near(nativeFirst.handleOut?.y,nativeExpectedOut.y),
      format+' persists both independently dragged applied-mask Bézier handles as native geometry',
      JSON.stringify({nativeFirst,nativeExpectedIn,nativeExpectedOut}));
  }
  await evaluate(client,'URL.createObjectURL=window.__penBooleanOriginalCreateUrl;true');
  console.log('CAP-BEZ UI Saved Path->Pen->edit existing boolean op->mask alpha->Undo/Redo/.zpe/PSD+PSB Chrome PASS');
}
