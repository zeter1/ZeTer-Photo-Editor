// Focused real file:// browser regression for new editable Adjustment layers.
// The loaded editor is the production bundle; no source state or renderer is mocked.
export async function verifyBrowserAdjustmentCreation({ client, evaluate, waitFor, assert }) {
  function importFixture() {
    const layer = {
      id:'adjustment-fixture',type:'shape',name:'Gray source',shape:'rectangle',
      x:0,y:0,width:64,height:64,scaleX:1,scaleY:1,rotation:0,
      fill:'#808080',stroke:'transparent',strokeWidth:0,radius:0,
      visible:true,locked:false,opacity:1,blendMode:'source-over',
    };
    const project={version:1,name:'Adjustment create E2E',width:64,height:64,
      background:'transparent',selectedLayerId:layer.id,groups:[],layers:[layer]};
    const input=document.querySelector('#projectInput'),transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(project)],'adjustment-source.zpe',
      {type:'application/json'}));
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return {layers:project.layers.length,source:layer.fill};
  }
  function pixel() {
    const canvas=document.querySelector('#editorCanvas');
    if(!canvas || canvas.width!==64 || canvas.height!==64)return null;
    const data=canvas.getContext('2d').getImageData(32,32,1,1).data;
    return {r:data[0],g:data[1],b:data[2],a:data[3]};
  }
  function createLevels() {
    document.querySelector('.menu-button[data-menu="layer"]').click();
    const item=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(button=>button.textContent.includes('Новый корректирующий слой'));
    if(!item || item.disabled)return {error:'Layer creation menu missing'};
    item.click();
    const form=document.querySelector('form.modal');
    const select=form?.querySelector('select[name="kind"]');
    if(!select)return {error:'Type selection modal missing'};
    const kinds=[...select.options].map(option=>option.value);
    select.value='levels';
    form.requestSubmit();
    return {kinds};
  }
  function updateGamma() {
    const input=document.querySelector('[data-adjustment-prop="master.gamma"]');
    if(!input)return {error:'Levels inspector missing'};
    input.value='2';
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return {value:input.value};
  }
  function history() {
    return {
      rows:[...document.querySelectorAll('#historyList .history-row')].map(row=>row.textContent),
      current:document.querySelector('#historyList .history-row.current')?.textContent||'',
      selected:document.querySelector('.layer-row.selected')?.textContent||'',
      gamma:document.querySelector('[data-adjustment-prop="master.gamma"]')?.value,
    };
  }
  function captureSave() {
    const original=URL.createObjectURL;
    window.__adjOriginalCreateUrl=original;
    URL.createObjectURL=function(blob) {
      if(blob instanceof Blob && blob.type==='application/json')window.__adjSavedBlob=blob;
      return original.call(this,blob);
    };
  }
  async function readSaved() {
    URL.createObjectURL=window.__adjOriginalCreateUrl;
    const blob=window.__adjSavedBlob;
    if(!blob)return {error:'Save did not create JSON blob'};
    const project=JSON.parse(await blob.text());
    return {layerCount:project.layers.length,
      shape:project.layers.find(layer=>layer.id==='adjustment-fixture')?.fill,
      adjustment:project.layers.find(layer=>layer.type==='adjustment')?.adjustment};
  }
  function reopenSaved() {
    const input=document.querySelector('#projectInput'),transfer=new DataTransfer();
    transfer.items.add(new File([window.__adjSavedBlob],'adjustment-reopen.zpe',
      {type:'application/json'}));
    input.files=transfer.files;
    const prev=window.confirm; window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=prev;}
  }

  const fixture=await evaluate(client,'('+importFixture.toString()+')()');
  assert(fixture?.layers===1,'The input must be a real editable shape project',JSON.stringify(fixture));
  await waitFor('Adjustment fixture render',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r===128 && p.g===128 && p.b===128;
  });
  const before=await evaluate(client,'('+pixel.toString()+')()');
  const opened=await evaluate(client,'('+createLevels.toString()+')()');
  assert(opened?.kinds?.includes('levels') && opened.kinds.includes('curves') &&
    opened.kinds.includes('exposure') && opened.kinds.includes('invert'),
    'Type picker must expose editable real adjustment kinds',JSON.stringify(opened));
  await waitFor('new Levels selection',async()=>{
    const h=await evaluate(client,'('+history.toString()+')()');
    return h.selected.includes('Уровни') && h.gamma==='1';
  });
  const neutral=await evaluate(client,'('+pixel.toString()+')()');
  assert(neutral?.r===before.r && neutral.g===before.g,
    'New neutral Levels must not destroy source preview',JSON.stringify({before,neutral}));
  const edited=await evaluate(client,'('+updateGamma.toString()+')()');
  assert(edited?.value==='2','Levels gamma field must be editable',JSON.stringify(edited));
  await waitFor('visible Levels correction',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r>=175 && p.r<=185 && p.g===p.r && p.b===p.r;
  });
  const committed=await evaluate(client,'('+history.toString()+')()');
  assert(committed.rows.length===3 && committed.current.includes('Изменить Photoshop adjustment'),
    'Creation + edit must add exactly two History records',JSON.stringify(committed));
  await evaluate(client,"document.querySelector('#undoBtn').click(); true");
  await waitFor('Levels Undo',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r===128;
  });
  await evaluate(client,"document.querySelector('#redoBtn').click(); true");
  await waitFor('Levels Redo',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r>=175 && p.r<=185;
  });
  await evaluate(client,'('+captureSave.toString()+')()');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',
    windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',
    windowsVirtualKeyCode:83,modifiers:2});
  const saved=await evaluate(client,'('+readSaved.toString()+')()');
  assert(saved.layerCount===2 && saved.shape==='#808080' &&
    saved.adjustment?.kind==='levels' && saved.adjustment?.master?.gamma===2,
    'Real Ctrl+S .zpe Blob must preserve source and editable Levels',JSON.stringify(saved));
  await evaluate(client,'('+reopenSaved.toString()+')()');
  await waitFor('Levels .zpe reopen',async()=>{
    const h=await evaluate(client,'('+history.toString()+')()');
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return h.selected.includes('Уровни') && h.gamma==='2' && p?.r>=175 && p.r<=185;
  });
  // Interactive Curves is a real pointer UI on top of the same persisted adjustment model.
  function openCurves() {
    document.querySelector('.menu-button[data-menu="layer"]').click();
    const item=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(button=>button.textContent.includes('Новый корректирующий слой'));
    if(!item || item.disabled)return {error:'Curves Layer menu disabled'};
    item.click();
    const form=document.querySelector('form.modal');
    const select=form?.querySelector('select[name="kind"]');
    if(!select)return {error:'Curves type picker missing'};
    select.value='curves';
    form.requestSubmit();
    return {kind:'curves'};
  }
  function curvesPointerTarget() {
    const graph=document.querySelector('[data-adjustment-curve-graph="0"]');
    if(!graph)return {error:'Interactive Curves graph missing'};
    graph.scrollIntoView({block:'center',inline:'nearest'});
    const rect=graph.getBoundingClientRect();
    return {x:rect.left+rect.width*.5,y:rect.top+rect.height*(1-194/255)};
  }
  function curvesStatus() {
    return {
      rows:document.querySelectorAll('#historyList .history-row').length,
      field:document.querySelector('[data-adjustment-curve-channel="0"]')?.value,
      selected:document.querySelector('.layer-row.selected')?.textContent||'',
    };
  }
  async function curvesSaved() {
    URL.createObjectURL=window.__adjOriginalCreateUrl;
    const blob=window.__adjSavedBlob;
    if(!blob)return {error:'Curves save did not create a Blob'};
    const project=JSON.parse(await blob.text());
    return {
      shape:project.layers.find(layer=>layer.id==='adjustment-fixture')?.fill,
      curves:project.layers.find(layer=>layer.adjustment?.kind==='curves')?.adjustment,
    };
  }
  // Start a fresh gray document so Curves pixel oracles are independent of Levels.
  await evaluate(client,'('+importFixture.toString()+')()');
  await waitFor('fresh Curves source',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r===128 && p.g===128 && p.b===128;
  });
  const createdCurves=await evaluate(client,'('+openCurves.toString()+')()');
  assert(createdCurves.kind==='curves','Create real Curves through Layer menu',JSON.stringify(createdCurves));
  await waitFor('Curves inspector',async()=>{
    const s=await evaluate(client,'('+curvesStatus.toString()+')()');
    return s.selected.includes('Кривые') && s.field==='0:0, 255:255';
  });
  const beforeCurve=await evaluate(client,'('+curvesStatus.toString()+')()');
  const target=await evaluate(client,'('+curvesPointerTarget.toString()+')()');
  assert(Number.isFinite(target.x)&&Number.isFinite(target.y),
    'Curves graph must be visible and pointer-ready',JSON.stringify(target));
  await client.send('Input.dispatchMouseEvent',{type:'mousePressed',
    x:target.x,y:target.y,button:'left',clickCount:1});
  await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',
    x:target.x,y:target.y,button:'left',clickCount:1});
  await waitFor('Curves graph pixel update',async()=>{
    const s=await evaluate(client,'('+curvesStatus.toString()+')()');
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return s.field?.split(',').length===3 && p?.r>=185 && p.r<=201;
  });
  const curveEdited=await evaluate(client,'('+curvesStatus.toString()+')()');
  assert(curveEdited.rows===beforeCurve.rows+1,
    'Curves pointer gesture must commit one History step',JSON.stringify({beforeCurve,curveEdited}));
  await evaluate(client,"document.querySelector('#undoBtn').click(); true");
  await waitFor('Curves pointer Undo',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    const s=await evaluate(client,'('+curvesStatus.toString()+')()');
    return p?.r===128 && s.field==='0:0, 255:255';
  });
  await evaluate(client,"document.querySelector('#redoBtn').click(); true");
  await waitFor('Curves pointer Redo',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r>=185 && p.r<=201;
  });
  // Move an existing anchor with a true CDP pointer drag. One gesture, one History step.
  function curveDragPositions() {
    const graph=document.querySelector('[data-adjustment-curve-graph="0"]');
    graph.scrollIntoView({block:'center',inline:'nearest'});
    const handle=graph.querySelector('[data-curve-handle="1"]');
    if(!handle)return {error:'Added anchor handle missing'};
    const dot=handle.getBoundingClientRect(),rect=graph.getBoundingClientRect();
    return {
      from:{x:dot.left+dot.width/2,y:dot.top+dot.height/2},
      to:{x:dot.left+dot.width/2,y:rect.top+rect.height*(1-216/255)},
    };
  }
  const startDrag=await evaluate(client,'('+curvesStatus.toString()+')()');
  const drag=await evaluate(client,'('+curveDragPositions.toString()+')()');
  assert(drag.from&&drag.to,'Existing Curves point must be draggable',JSON.stringify(drag));
  await client.send('Input.dispatchMouseEvent',{type:'mousePressed',
    x:drag.from.x,y:drag.from.y,button:'left',clickCount:1});
  await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',
    x:drag.to.x,y:drag.to.y,button:'left'});
  await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',
    x:drag.to.x,y:drag.to.y,button:'left',clickCount:1});
  await waitFor('Curves drag pixel update',async()=>{
    const s=await evaluate(client,'('+curvesStatus.toString()+')()');
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return s.field?.split(',').length===3 && p?.r>=204 && p.r<=226;
  });
  const endDrag=await evaluate(client,'('+curvesStatus.toString()+')()');
  assert(endDrag.rows===startDrag.rows+1,
    'A complete anchor drag must make exactly one History step',JSON.stringify({startDrag,endDrag}));
  await evaluate(client,"document.querySelector('#undoBtn').click(); true");
  await waitFor('Curves drag Undo',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r>=185 && p.r<=201;
  });
  await evaluate(client,"document.querySelector('#redoBtn').click(); true");
  await waitFor('Curves drag Redo',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r>=204 && p.r<=226;
  });
  await evaluate(client,'('+captureSave.toString()+')()');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',
    windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',
    windowsVirtualKeyCode:83,modifiers:2});
  const curvesProject=await evaluate(client,'('+curvesSaved.toString()+')()');
  assert(curvesProject.shape==='#808080'&&curvesProject.curves?.channels?.[0]?.points?.length===3,
    'Curves .zpe must preserve original source and new editable point',JSON.stringify(curvesProject));
  await evaluate(client,'('+reopenSaved.toString()+')()');
  await waitFor('Curves .zpe reopen',async()=>{
    const s=await evaluate(client,'('+curvesStatus.toString()+')()');
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return s.selected.includes('Кривые') && s.field?.split(',').length===3 &&
      p?.r>=204 && p.r<=226;
  });
  // The existing Hue/Saturation shader already supports Colorize; the user needs
  // a real persisted inspector control instead of a hidden JSON-only flag.
  await evaluate(client,'('+importFixture.toString()+')()');
  await waitFor('fresh Colorize source',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r===128 && p.g===128 && p.b===128;
  });
  function createHueSaturation() {
    document.querySelector('.menu-button[data-menu="layer"]').click();
    const item=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(button=>button.textContent.includes('Новый корректирующий слой'));
    if(!item||item.disabled)return {error:'Hue/Saturation menu missing'};
    item.click();
    const form=document.querySelector('form.modal');
    const select=form?.querySelector('select[name="kind"]');
    if(!select)return {error:'Hue/Saturation picker missing'};
    select.value='hue-saturation';
    form.requestSubmit();
    return {kind:'hue-saturation'};
  }
  function setHueSaturation() {
    const hue=document.querySelector('[data-adjustment-prop="hue"]');
    const saturation=document.querySelector('[data-adjustment-prop="saturation"]');
    const colorize=document.querySelector('[data-adjustment-colorize]');
    if(!hue||!saturation||!colorize)return {error:'Hue/Saturation inspector missing'};
    hue.value='120';hue.dispatchEvent(new Event('change',{bubbles:true}));
    const liveSaturation=document.querySelector('[data-adjustment-prop="saturation"]');
    liveSaturation.value='100';
    liveSaturation.dispatchEvent(new Event('change',{bubbles:true}));
    return {colorize:document.querySelector('[data-adjustment-colorize]')?.checked};
  }
  function colorizeStatus() {
    return {
      rows:document.querySelectorAll('#historyList .history-row').length,
      selected:document.querySelector('.layer-row.selected')?.textContent||'',
      enabled:document.querySelector('[data-adjustment-colorize]')?.checked,
      saturation:document.querySelector('[data-adjustment-prop="saturation"]')?.value,
    };
  }
  function toggleColorize() {
    const input=document.querySelector('[data-adjustment-colorize]');
    if(!input)return {error:'Colorize checkbox missing'};
    input.checked=true;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return {checked:input.checked};
  }
  const createdHue=await evaluate(client,'('+createHueSaturation.toString()+')()');
  assert(createdHue?.kind==='hue-saturation','Create editable Hue/Saturation layer',JSON.stringify(createdHue));
  await waitFor('Hue/Saturation inspector',async()=>{
    const s=await evaluate(client,'('+colorizeStatus.toString()+')()');
    return s.selected.includes('насыщенность')&&s.enabled===false;
  });
  const configuredHue=await evaluate(client,'('+setHueSaturation.toString()+')()');
  assert(configuredHue?.colorize===false,'Hue/Saturation starts in uncolorized mode',JSON.stringify(configuredHue));
  await waitFor('uncolorized gray remains gray',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.r===128&&p.g===128&&p.b===128;
  });
  const colorizeBefore=await evaluate(client,'('+colorizeStatus.toString()+')()');
  const switched=await evaluate(client,'('+toggleColorize.toString()+')()');
  assert(switched?.checked===true,'Colorize inspector toggle enabled',JSON.stringify(switched));
  await waitFor('Colorize changes real RGB pixels',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return p?.g>=250&&p.r<=5&&p.b<=5&&p.a===255;
  });
  const colorizeAfter=await evaluate(client,'('+colorizeStatus.toString()+')()');
  assert(colorizeAfter.rows===colorizeBefore.rows+1,
    'Colorize checkbox must produce one History entry',JSON.stringify({colorizeBefore,colorizeAfter}));
  await evaluate(client,"document.querySelector('#undoBtn').click(); true");
  await waitFor('Colorize Undo',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    const s=await evaluate(client,'('+colorizeStatus.toString()+')()');
    return s.enabled===false&&p?.r===128&&p.g===128&&p.b===128;
  });
  await evaluate(client,"document.querySelector('#redoBtn').click(); true");
  await waitFor('Colorize Redo',async()=>{
    const p=await evaluate(client,'('+pixel.toString()+')()');
    const s=await evaluate(client,'('+colorizeStatus.toString()+')()');
    return s.enabled===true&&p?.g>=250&&p.r<=5&&p.b<=5;
  });
  await evaluate(client,'('+captureSave.toString()+')()');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',
    windowsVirtualKeyCode:83,modifiers:2});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',
    windowsVirtualKeyCode:83,modifiers:2});
  const colorizedSaved=await evaluate(client,'('+readSaved.toString()+')()');
  assert(colorizedSaved.shape==='#808080'&&
    colorizedSaved.adjustment?.kind==='hue-saturation'&&
    colorizedSaved.adjustment?.colorize===true&&
    colorizedSaved.adjustment?.hue===120&&colorizedSaved.adjustment?.saturation===100,
    'Ctrl+S Blob must persist editable Hue/Saturation Colorize and untouched source',
    JSON.stringify(colorizedSaved));
  await evaluate(client,'('+reopenSaved.toString()+')()');
  await waitFor('Colorize .zpe reopen',async()=>{
    const s=await evaluate(client,'('+colorizeStatus.toString()+')()');
    const p=await evaluate(client,'('+pixel.toString()+')()');
    return s.enabled===true&&s.saturation==='100'&&
      p?.g>=250&&p.r<=5&&p.b<=5;
  });
  console.log('CAP-ADJ real Chrome file:// Levels / Curves / Colorize, pixel / History / Undo / .zpe PASS');
}
