import { decodePsd } from '../src/formats/psd.js';

// Real Chromium file:// pointer commands, document rendering, History, .zpe,
// and native Saved Path records in PSD/PSB. This is a self-round-trip, not Adobe provenance.
export async function verifyBrowserPathNodeEdit({ client, evaluate, waitFor, assert }) {
  const run = fn => evaluate(client, '(' + fn.toString() + ')()');
  const load = () => {
    const nodes = [
      {x:12,y:12,handleIn:null,handleOut:{x:12,y:44},kind:'corner'},
      {x:84,y:12,handleIn:{x:84,y:44},handleOut:null,kind:'corner'},
      {x:84,y:84,handleIn:null,handleOut:null,kind:'corner'},
      {x:12,y:84,handleIn:null,handleOut:null,kind:'corner'},
    ];
    const layer={id:'shape-path-edit',name:'Editable Shape Path',type:'shape',shape:'path',
      x:0,y:0,width:96,height:96,scaleX:1,scaleY:1,rotation:0,
      pathClosed:true,pathPoints:nodes,fill:'#ee5511',stroke:'transparent',
      strokeWidth:0,visible:true,locked:false,opacity:1,blendMode:'source-over'};
    const path={id:2005,name:'Native Saved Path',fillStartsWithAllPixels:false,
      subpaths:[{operation:'add',closed:true,fillRule:'non-zero',
        points:structuredClone(nodes)}]};
    const project={version:1,name:'Pen Node Edit Chrome',width:96,height:96,
      background:'transparent',selectedLayerId:layer.id,groups:[],layers:[layer],paths:[path]};
    const input=document.querySelector('#projectInput'),transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(project)],'node-edit.zpe',{type:'application/json'}));
    input.files=transfer.files;
    const original=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=original;}
    return true;
  };
  const state = () => {
    const canvas=document.querySelector('#editorCanvas');
    if(!canvas||canvas.width!==96)return null;
    const data=canvas.getContext('2d').getImageData(0,0,96,96).data;
    let hash=2166136261;
    for(const c of data)hash=Math.imul(hash^c,16777619);
    return {hash:hash>>>0,inside:[...canvas.getContext('2d').getImageData(50,65,1,1).data],
      outside:[...canvas.getContext('2d').getImageData(3,3,1,1).data],
      history:[...document.querySelectorAll('#historyList .history-row')].map(r=>r.textContent),
      selected:document.querySelector('.layer-row.selected')?.textContent||'',
      paths:document.querySelectorAll('#pathsList .path-row').length};
  };
  assert(await run(load),'load real Shape and Saved Path via .zpe input');
  await waitFor('editable Shape and Saved Path loaded',async()=>{
    const s=await run(state);return s?.selected.includes('Editable Shape Path')&&s.paths===1&&
      s.inside[3]>200&&s.outside[3]===0;
  });
  const initial=await run(state);
  const rect=await evaluate(client,`(() => {
    document.querySelector('[data-tool="pen"]').click();
    const r=document.querySelector('#overlayCanvas').getBoundingClientRect();
    return {x:r.left,y:r.top,width:r.width,height:r.height,
      tool:document.querySelector('[data-tool="pen"]')?.classList.contains('active')};
  })()`);
  assert(rect.tool && rect.width>0 && rect.height>0,'real Pen overlay available');
  const click=async([x,y],modifiers=0)=>{
    const p={x:rect.x+x*rect.width/96,y:rect.y+y*rect.height/96};
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,
      button:'left',buttons:1,clickCount:1,modifiers});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,
      button:'left',buttons:0,clickCount:1,modifiers});
  };
  await evaluate(client,`(() => {
    window.__pathNodeExports=[];
    const original=URL.createObjectURL;window.__pathNodeOriginal=original;
    URL.createObjectURL=function(blob){window.__pathNodeExports.push(blob);return original.call(this,blob);};
  })()`);
  const save=async()=>{
    const before=await evaluate(client,'window.__pathNodeExports.length');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',
      windowsVirtualKeyCode:83,modifiers:2});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',
      windowsVirtualKeyCode:83,modifiers:2});
    await waitFor('actual .zpe Blob',async()=>(await evaluate(client,'window.__pathNodeExports.length'))>before);
    return evaluate(client,`(async()=>JSON.parse(await window.__pathNodeExports.at(-1).text()))()`);
  };
  const shapePoints=p=>p?.layers?.find(l=>l.id==='shape-path-edit')?.pathPoints;
  const savedPoints=p=>p?.paths?.find(x=>x.id===2005)?.subpaths?.[0]?.points;
  await click([48,36],2); // Ctrl on cubic of Shape Path.
  await waitFor('Shape insert History',async()=>(await run(state))?.history.some(x=>x.includes('Добавить Bézier-узел')));
  const shapeInsert=await save();
  assert(shapePoints(shapeInsert)?.length===5 && savedPoints(shapeInsert)?.length===4,
    'Shape Ctrl inserts only editable shape node');
  const inserted=shapePoints(shapeInsert)[1];
  assert(Math.abs(inserted.x-48)<1 && Math.abs(inserted.y-36)<1,
    'exact split anchor stored in actual .zpe');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  const shapeUndo=await save();
  assert(shapePoints(shapeUndo)?.length===4,'Shape Undo restores 4 nodes');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  const shapeRedo=await save();
  assert(shapePoints(shapeRedo)?.length===5,'Shape Redo restores 5 editable nodes');
  const splitPixels=await run(state);
  assert(splitPixels.inside[3]>200 && splitPixels.outside[3]===0,
    'Shape split keeps real inside/outside RGBA composite');
  await click([inserted.x,inserted.y],3); // Ctrl+Alt deletes inserted Shape anchor.
  await waitFor('Shape delete History',async()=>(await run(state))?.history.some(x=>x.includes('Удалить Bézier-узел')));
  const shapeDelete=await save();
  assert(shapePoints(shapeDelete)?.length===4,'Shape Ctrl+Alt deletes node');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  assert(shapePoints(await save())?.length===5,'Shape delete Undo restores node');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  assert(shapePoints(await save())?.length===4,'Shape delete Redo restores deletion');

  const editSaved=async()=>evaluate(client,`(() => {
    const row=document.querySelector('#pathsList .path-row');if(!row)return false;
    row.click();
    const edit=document.querySelector('#editPathBtn');if(!edit||edit.disabled)return false;
    edit.click();
    return document.querySelector('[data-tool="pen"]')?.classList.contains('active');
  })()`);
  assert(await editSaved(),'real Paths Edit enters Saved Path mode');
  const shapeBeforeSaved=(await run(state)).hash;
  await click([48,36],2);
  await waitFor('Saved Path insert History',async()=>(await run(state))?.history.some(x=>x.includes('Добавить узел сохранённого контура')));
  const savedInsert=await save();
  assert(savedPoints(savedInsert)?.length===5 && shapePoints(savedInsert)?.length===4,
    'Saved Path Ctrl modifies only native Saved Path');
  assert((await run(state)).hash===shapeBeforeSaved,
    'Saved Path editing does not alter raster composite until applied');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  assert(savedPoints(await save())?.length===4,'Saved Path Undo restores 4 nodes');
  await evaluate(client,"document.querySelector('#redoBtn').click();true");
  assert(savedPoints(await save())?.length===5,'Saved Path Redo restores 5 nodes');

  assert(await editSaved(),'Saved Path edit mode restored after save/History');
  const savedAnchor=savedPoints(savedInsert)[1];
  await click([savedAnchor.x,savedAnchor.y],3);
  const savedDelete=await save();
  assert(savedPoints(savedDelete)?.length===4,'Saved Path Ctrl+Alt removes anchor');
  await evaluate(client,"document.querySelector('#undoBtn').click();true");
  const final=await save();
  assert(savedPoints(final)?.length===5,'Saved Path delete Undo restores native cubic');
  assert((await run(state)).hash===shapeBeforeSaved,'Saved Path edit never mutates Shape RGBA');

  assert(await evaluate(client,`(() => {
    const blob=window.__pathNodeExports.at(-1),transfer=new DataTransfer();
    transfer.items.add(new File([blob],'path-node-reopen.zpe',{type:'application/json'}));
    const input=document.querySelector('#projectInput');input.files=transfer.files;
    const original=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=original;}
    return true;
  })()`),'reopen actual downloaded .zpe');
  await waitFor('.zpe reopened Shape and Saved Path',async()=>{
    const s=await run(state);return s?.paths===1&&s.hash===shapeBeforeSaved&&s.selected.includes('Editable Shape Path');
  });
  assert(shapePoints(await save())?.length===4 && savedPoints(await save())?.length===5,
    'reopened .zpe preserves editable nodes in both independent paths');

  for(const format of ['image/vnd.adobe.photoshop','psb']){
    const before=await evaluate(client,'window.__pathNodeExports.length');
    assert(await evaluate(client,`(() => {
      document.querySelector('#exportQuickBtn').click();
      const form=document.querySelector('form.modal');if(!form?.elements.format)return false;
      form.elements.format.value=${JSON.stringify(format)};
      form.requestSubmit();return true;
    })()`),'real '+format+' export dialog');
    await waitFor('native bytes '+format,async()=>await evaluate(client,'window.__pathNodeExports.length')>before);
    const bytes=await evaluate(client,`(async()=>Array.from(new Uint8Array(
      await window.__pathNodeExports.at(-1).arrayBuffer())))()`);
    const decoded=await decodePsd(Uint8Array.from(bytes),{maxPixels:20000,maxLayers:20});
    const path=decoded.paths?.find(path=>path.id===2005);
    assert(path?.subpaths?.[0]?.points?.length===5,
      format+' contains native editable 5-node Saved Path');
    assert(await evaluate(client,`(() => {
      const blob=window.__pathNodeExports.at(-1),transfer=new DataTransfer();
      transfer.items.add(new File([blob],${JSON.stringify(format==='psb'?'node-edit.psb':'node-edit.psd')},
        {type:'application/octet-stream'}));
      const input=document.querySelector('#fileInput');input.files=transfer.files;
      const original=window.confirm;window.confirm=()=>true;
      try{input.dispatchEvent(new Event('change',{bubbles:true}));}
      finally{window.confirm=original;}
      return true;
    })()`),'native import through fileInput');
    await waitFor('reimport editable Saved Path '+format,async()=> (await run(state))?.paths===1);
    assert(savedPoints(await save())?.length===5,
      format+' import keeps native Saved Path editing points');
  }
  await evaluate(client,'URL.createObjectURL=window.__pathNodeOriginal;true');
  console.log('CAP-BEZ-PATH-NODE-EDIT Chrome file:// Shape/Saved pointer, RGBA, Undo/Redo, .zpe, PSD+PSB PASS');
}
