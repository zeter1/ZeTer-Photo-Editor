// CAP-ADJ-STACK: observable real file:// pixel tests; no mocked renderer or DOM.
export async function verifyBrowserAdjustmentStack({ client, evaluate, waitFor, assert }) {
  const load = async scenario => evaluate(client, `((scenario) => {
    const shape = (id, fill, width = 64, groupId = null) => ({
      id, name:id, type:'shape', shape:'rect', x:0,y:0,width,height:64,
      scaleX:1,scaleY:1,rotation:0,fill,stroke:'transparent',strokeWidth:0,
      visible:true,locked:false,opacity:1,blendMode:'source-over',groupId,
    });
    const nested = ['group','isolated','stack'].includes(scenario);
    const base = shape('clip-base',scenario==='isolated'?'#000000':'#404040',
      32,nested?'nested':null);
    const adjustment = {id:'stack-levels',name:'Stack Levels',type:'adjustment',
      visible:true,locked:false,opacity:1,blendMode:'source-over',clipping:true,
      adjustment:{kind:'levels',master:{inputBlack:0,inputWhite:255,gamma:2,
        outputBlack:0,outputWhite:255},channels:[]}};
    const groups = nested ? [
      {id:'outer',name:'Outer',visible:true,
        opacity:scenario==='isolated'?.5:1,blendMode:'pass-through'},
      {id:'nested',name:'Nested',parentGroupId:'outer',visible:true,
        opacity:1,blendMode:'pass-through'},
    ] : [];
    if (scenario==='hidden') base.visible=false;
    if (scenario==='masked') {
      base.width=64;
      const mask=document.createElement('canvas');mask.width=64;mask.height=64;
      const maskCtx=mask.getContext('2d');
      maskCtx.fillStyle='#fff';maskCtx.fillRect(0,0,64,32);
      adjustment.mask={enabled:true,dataUrl:mask.toDataURL('image/png'),
        density:1,feather:0,invert:false};
      adjustment.vectorMask={enabled:true,invert:false,subpaths:[{
        operation:'add',closed:true,points:[
          {x:0,y:0},{x:32,y:0},{x:32,y:64},{x:0,y:64}
        ]
      }]};
    }
    const layers=[shape('canvas-gray','#808080'),base,adjustment];
    if(scenario==='stack') layers.push({
      id:'stack-curves',name:'Red Curves',type:'adjustment',clipping:true,
      visible:true,locked:false,opacity:1,blendMode:'source-over',
      adjustment:{kind:'curves',channels:[{id:1,points:[
        {input:0,output:0},{input:255,output:0}
      ]}]},
    });
    const doc={version:1,name:'Stack '+scenario,width:64,height:64,
      background:'transparent',selectedLayerId:adjustment.id,groups,layers};
    const transfer=new DataTransfer();
    transfer.items.add(new File([JSON.stringify(doc)],scenario+'.zpe',
      {type:'application/json'}));
    const input=document.querySelector('#projectInput');
    input.files=transfer.files;
    const old=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=old;}
    return {scenario};
  })(${JSON.stringify(scenario)})`);
  const pixels = () => evaluate(client,`(() => {
    const c=document.querySelector('#editorCanvas'),ctx=c.getContext('2d');
    const sample=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
    return {w:c.width,h:c.height,topLeft:sample(16,16),
      topRight:sample(48,16),bottomLeft:sample(16,48),
      bottomRight:sample(48,48)};
  })()`);
  const ready = async label => {
    await waitFor(label+' project import',async()=>evaluate(client,
      "document.querySelector('.layer-row.selected')?.textContent.includes('Stack Levels')"));
    await waitFor(label+' actual pixels',async()=>{
      const p=await pixels();return p?.w===64&&p.h===64;
    });
  };
  const approx = (actual,expected,tol=5)=>Math.abs(actual-expected)<=tol;

  await load('hidden');
  await ready('hidden');
  await waitFor('Hidden clipping base must not leak Levels onto background',async()=>{
    const p=await pixels();
    return approx(p.topLeft[0],128)&&approx(p.topRight[0],128);
  });

  await load('group');
  await ready('group');
  await waitFor('Nested group as clipping base confines Levels to its alpha',async()=>{
    const p=await pixels();
    return approx(p.topLeft[0],128)&&approx(p.topRight[0],128)
      &&p.topLeft[3]===255&&p.topRight[3]===255;
  });
  const groupPixels=await pixels();
  assert(approx(groupPixels.topLeft[0],128)&&approx(groupPixels.topRight[0],128),
    'Group clipping must never alter pixels outside its bounds',JSON.stringify(groupPixels));

  await load('isolated');
  await ready('isolated');
  await waitFor('Isolated group opacity controls adjustment coverage',async()=>{
    const p=await pixels();
    return p.topLeft[0]>=91&&p.topLeft[0]<=101
      &&approx(p.topRight[0],128)&&p.topLeft[3]===255;
  });

  await load('stack');
  await ready('stack');
  await waitFor('Levels then channel Curves preserve stack order and clipping',async()=>{
    const p=await pixels();
    return p.topLeft[0]<=5&&approx(p.topLeft[1],128)
      &&approx(p.topLeft[2],128)&&approx(p.topRight[0],128);
  });

  await load('masked');
  await ready('masked');
  await waitFor('Raster and vector mask intersection scopes clipped Levels',async()=>{
    const p=await pixels();
    return approx(p.topLeft[0],128)&&approx(p.topRight[0],64)
      &&approx(p.bottomLeft[0],64)&&approx(p.bottomRight[0],64);
  });
  const maskedPixels=await pixels();
  assert(maskedPixels.topLeft[3]===255&&maskedPixels.bottomRight[3]===255,
    'Adjustment masks must not destroy background alpha',JSON.stringify(maskedPixels));
  const history = () => evaluate(client,`(() => ({
    rows:document.querySelectorAll('#historyList .history-row').length,
    gamma:document.querySelector('[data-adjustment-prop="master.gamma"]')?.value,
  }))()`);
  const initialHistory=await history();
  assert(initialHistory.gamma==='2',
    'Masked Levels should remain editable in the real inspector',JSON.stringify(initialHistory));
  const changed=await evaluate(client,`(() => {
    const input=document.querySelector('[data-adjustment-prop="master.gamma"]');
    if(!input)return false;
    input.value='3';input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  assert(changed,'Actual Levels gamma control must be editable');
  await waitFor('Masked Levels gamma edit updates real pixels and History',async()=>{
    const p=await pixels(),h=await history();
    return p.topLeft[0]>=157&&p.topLeft[0]<=165
      &&approx(p.topRight[0],64)&&h.rows===initialHistory.rows+1&&h.gamma==='3';
  });
  await evaluate(client,"document.querySelector('#undoBtn').click(); true");
  await waitFor('Masked Levels Undo',async()=>{
    const p=await pixels(),h=await history();
    return approx(p.topLeft[0],128)&&h.gamma==='2';
  });
  await evaluate(client,"document.querySelector('#redoBtn').click(); true");
  await waitFor('Masked Levels Redo',async()=>{
    const p=await pixels(),h=await history();
    return p.topLeft[0]>=157&&p.topLeft[0]<=165&&h.gamma==='3';
  });
  await evaluate(client,`(() => {
    window.__stackCreateObjectURL=URL.createObjectURL;
    URL.createObjectURL=function(blob){
      if(blob instanceof Blob&&blob.type==='application/json')window.__stackSavedBlob=blob;
      return window.__stackCreateObjectURL.call(this,blob);
    };
    return true;
  })()`);
  await client.send('Input.dispatchKeyEvent',{
    type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2,
  });
  await client.send('Input.dispatchKeyEvent',{
    type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83,modifiers:2,
  });
  const saved=await evaluate(client,`(async()=>{
    URL.createObjectURL=window.__stackCreateObjectURL;
    const blob=window.__stackSavedBlob;
    if(!blob)return null;
    const project=JSON.parse(await blob.text());
    const a=project.layers.find(layer=>layer.id==='stack-levels');
    return {gamma:a?.adjustment?.master?.gamma,
      rasterMask:!!a?.mask?.dataUrl,vectorPaths:a?.vectorMask?.subpaths?.length,
      clipping:a?.clipping,source:project.layers.find(layer=>layer.id==='clip-base')?.fill};
  })()`);
  assert(saved?.gamma===3&&saved.rasterMask&&saved.vectorPaths===1&&saved.clipping
    &&saved.source==='#404040',
    'Real Ctrl+S .zpe must retain editable Levels and raster/vector masks',JSON.stringify(saved));
  await evaluate(client,`(() => {
    const transfer=new DataTransfer();
    transfer.items.add(new File([window.__stackSavedBlob], 'stack-reopen.zpe',
      {type:'application/json'}));
    const input=document.querySelector('#projectInput');input.files=transfer.files;
    const old=window.confirm;window.confirm=()=>true;
    try{input.dispatchEvent(new Event('change',{bubbles:true}));}
    finally{window.confirm=old;}
    return true;
  })()`);
  await waitFor('Masked Levels .zpe reopen restores pixel and inspector',async()=>{
    const p=await pixels(),h=await history();
    return p.topLeft[0]>=157&&p.topLeft[0]<=165
      &&approx(p.topRight[0],64)&&approx(p.bottomLeft[0],64)
      &&h.gamma==='3'&&h.rows===1;
  });
  console.log('CAP-ADJ-STACK real Chrome file:// group/clip/mask/Levels+Curves/History/Undo/Redo/.zpe PASS');
}
