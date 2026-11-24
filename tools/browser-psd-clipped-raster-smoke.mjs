import { verifyNativeClippedUiRoundTrips } from './browser-psd-clipped-native-ui-check.mjs';

// Live Chromium: clipped raster Multiply/Screen -> clipped Invert in a nested
// masked Pass Through folder over translucent blue. Every pixel has an oracle.
export async function verifyClippedRasterStack(client, harness) {
  for (const alpha of [128,255,0]) {
    await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},'source-over','soft-light');
    await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},'soft-light');
  }
  if (process.env.ZPE_SOFT_LIGHT_CLIPPING_BASE_ONLY === '1') return;
  for (const blend of ['difference','exclusion']) {
    for (const alpha of [128,255,0]) {
      await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},'source-over',blend);
      await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},blend);
    }
  }
  if (process.env.ZPE_DIFFERENCE_EXCLUSION_CLIPPING_BASE_ONLY === '1') return;
  for (const blend of ['darken','lighten']) {
    for (const alpha of [128,255,0]) {
      await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},'source-over',blend);
      await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},blend);
    }
  }
  if (process.env.ZPE_DARKEN_LIGHTEN_CLIPPING_BASE_ONLY === '1') return;
  for (const blend of ['overlay','hard-light']) {
    for (const alpha of [128,255,0]) {
      await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},'source-over',blend);
      await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},blend);
    }
  }
  if (process.env.ZPE_CONTRAST_CLIPPING_BASE_ONLY === '1') return;
  for (const groupMode of ['multiply','screen']) {
    for (const alpha of [128,255,0]) await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},'source-over',groupMode);
  }
  if (process.env.ZPE_GROUP_CLIPPING_BASE_ONLY === '1') return;
  for (const baseMode of ['multiply','screen']) {
    for (const alpha of [0,128,255]) await verifyCase(client,harness,'screen',alpha,true,{kind:'invert'},baseMode);
  }
  for (const mode of ['multiply', 'screen']) {
    await verifyCase(client, harness, mode);
    for (const backdropAlpha of [0, 255]) await verifyCase(client, harness, mode, backdropAlpha, true);
  }
  for (const effect of [{kind:'posterize',levels:5},{kind:'threshold',level:80}]) {
    await verifyCase(client,harness,'multiply',0,true,effect);
  }
}

async function verifyCase(client, { evaluate, waitFor, assert }, mode, backdropAlpha = 128, chained = false, effect = {kind:'invert'}, baseMode = 'source-over', groupMode = null) {
  const backdrop = (groupMode || baseMode) === 'soft-light' ? [180,48,220] : ['overlay','hard-light','darken','lighten','difference','exclusion'].includes(groupMode || baseMode) ? [64,180,220] : [0,0,255];
  const effectName='Clipped '+effect.kind[0].toUpperCase()+effect.kind.slice(1);
  const opened = await evaluate(client, `(() => {
    try {
      window.confirm = () => true;
      const bitmap = pixel => {
        const canvas = document.createElement('canvas');
        canvas.width = 4; canvas.height = 2;
        const context = canvas.getContext('2d');
        const image = context.createImageData(4, 2);
        for (let i = 0; i < 8; i++) image.data.set(pixel(i % 4), i * 4);
        context.putImageData(image, 0, 0);
        return canvas.toDataURL('image/png');
      };
      const base = {
        x:0,y:0,width:4,height:2,scaleX:1,scaleY:1,rotation:0,
        visible:true,locked:false,opacity:1,blendMode:'source-over'
      };
      const project = {
        version:1,name:'Clipped raster stack',
        width:4,height:2,background:'transparent',
        groups:[
          {id:'outer',name:'Masked Pass Through',parentGroupId:null,
            visible:true,locked:false,collapsed:false,opacity:1,blendMode:'pass-through',
            mask:{enabled:true,linked:true,invert:false,density:1,feather:0,
              dataUrl:bitmap(x=>[255,255,255,x===0||x===3?255:x===1?128:0])}},
          {id:'inner',name:'Nested Pass Through',parentGroupId:'outer',
            visible:true,locked:false,collapsed:false,opacity:${groupMode ? 0.5 : 1},blendMode:${JSON.stringify(groupMode || 'pass-through')},
            ...(${Boolean(groupMode)} ? {mask:{enabled:true,linked:true,invert:false,density:1,feather:0,
              dataUrl:bitmap(x=>[255,255,255,x===1?128:255])}} : {})}
        ],
        layers:[
          {...base,id:'blue-backdrop',name:'Translucent blue',type:'raster',
            groupId:null,dataUrl:bitmap(()=>[${backdrop.join(',')},${backdropAlpha}])},
          {...base,id:'red-base',name:'Translucent red',type:'raster',
            groupId:'inner',blendMode:${JSON.stringify(baseMode)},dataUrl:bitmap(()=>[255,0,0,128])},
           {...base,id:'overlay-blue',name:'Clipped blue raster',type:'raster',
             groupId:${JSON.stringify(groupMode?'outer':'inner')},clipping:true,blendMode:${JSON.stringify(mode)},
             opacity:${mode === 'multiply' ? 1 : 0.5},dataUrl:bitmap(()=>[0,0,255,255]),
             mask:{enabled:true,linked:true,invert:false,density:1,feather:0,
               dataUrl:bitmap(x=>[255,255,255,x===1?128:x===3?0:255])}},
          ...(${chained} ? [{...base,id:'levels-clipped',name:'Clipped Levels',type:'adjustment',
            groupId:${JSON.stringify(groupMode?'outer':'inner')},clipping:true,adjustment:{kind:'levels',
              master:{inputBlack:0,inputWhite:255,gamma:1,outputBlack:32,outputWhite:224}}}] : []),
          {...base,id:'invert-clipped',name:${JSON.stringify(effectName)},type:'adjustment',
            groupId:${JSON.stringify(groupMode?'outer':'inner')},clipping:true,adjustment:${JSON.stringify(effect)}}
        ],
        selectedLayerId:'invert-clipped'
      };
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(project)], 'nested-alpha.zpe',
        {type:'application/json'}));
      const input = document.querySelector('#projectInput');
      input.files = transfer.files;
      const filename = input.files[0]?.name;
      input.dispatchEvent(new Event('change', {bubbles:true}));
      return {filename};
    } catch(error) {return {error:String(error),stack:error?.stack};}
  })()`);
  assert(opened?.filename === 'nested-alpha.zpe', 'native ZPE File input: ' + JSON.stringify(opened));
  const pixels = () => evaluate(client, `(() => {
    const canvas = document.querySelector('#editorCanvas');
    const ctx = canvas.getContext('2d');
    return Array.from({length:4}, (_,x) =>
      Array.from(ctx.getImageData(x,0,1,1).data));
  })()`);
  const near = (got,want) => want.every((v,i) => Math.abs((got||[])[i]-v) <= 2);
  const expected = chained ? chainedOracle(mode, backdropAlpha, effect, groupMode || baseMode, groupMode, backdrop) : mode === 'multiply'
    ? [[170,170,255,192],[51,102,255,160],[0,0,255,128],[0,170,255,192]]
    : [[0,170,170,192],[0,102,229,160],[0,0,255,128],[0,170,255,192]];
  try { await waitFor('nested clipped adjustment respects partial background and folder mask',
    async () => {const actual = await pixels(); return expected.every((p,i) => near(actual[i],p));},
    12000); } catch (error) { console.error('expected',expected,'actual',await pixels()); throw error; }
  console.log('Nested PSD '+(groupMode ? groupMode+' folder base / ' : '')+'clipped '+effect.kind+' / backdrop '+backdropAlpha+' / chained '+chained+' RGBA:', JSON.stringify(await pixels()));

  const changed = await evaluate(client, `(() => {
    const row = document.querySelector('[data-group-id="outer"]');
    if (!row) return {error:'group row missing'};
    row.dispatchEvent(new MouseEvent('contextmenu',
      {bubbles:true,cancelable:true,clientX:30,clientY:30}));
    const item = [...document.querySelectorAll('#menuPopover .menu-item')]
      .find(x => x.textContent.includes('Параметры группы'));
    if (!item) return {error:'Properties menu missing'};
    item.click();
    const modal = document.querySelector('.modal[aria-label="Параметры группы"]');
    const mask = modal?.querySelector('select[name="maskEnabled"]');
    if (!mask || mask.value !== 'enabled') return {error:'mask control missing'};
    mask.value='disabled'; mask.dispatchEvent(new Event('change',{bubbles:true}));
    modal.requestSubmit(); return true;
  })()`);
  assert(changed === true, 'real Group Properties can disable folder mask: '+JSON.stringify(changed));
  await waitFor('disable mask reveals clipped correction everywhere',async() =>
    near((await pixels())[2],expected[0]),12000);
  await evaluate(client, `document.querySelector('#undoBtn').click()`);
  await waitFor('Undo restores folder alpha coverage', async() =>
    near((await pixels())[2], expected[2]),12000);
  await evaluate(client, `document.querySelector('#redoBtn').click()`);
  await waitFor('Redo disables folder mask again', async() =>
    near((await pixels())[2], expected[0]),12000);
  await evaluate(client, `document.querySelector('#undoBtn').click()`);
  await waitFor('Undo before project save',async() =>
    near((await pixels())[1],expected[1]),12000);

  const menu = await evaluate(client, `(() => {
    window.__nestedSaved = null;
    const old = URL.createObjectURL;
    URL.createObjectURL = function(blob,...args) {
      if (blob instanceof Blob && blob.type==='application/json') window.__nestedSaved=blob;
      return old.call(URL,blob,...args);
    };
    window.__nestedRestore = () => {URL.createObjectURL=old;};
    document.querySelector('[data-menu="file"]').click();
    const action=[...document.querySelectorAll('#menuPopover .menu-item')]
      .find(x=>x.textContent.includes('Сохранить проект'));
    if(!action || action.disabled) return false;
    action.click(); return true;
  })()`);
  assert(menu, 'real File > Save Project');
  await waitFor('native ZPE blob',async() => evaluate(client,`Boolean(window.__nestedSaved)`),12000);
  const persist = await evaluate(client, `(async() => {
    const text = await window.__nestedSaved.text();
    window.__nestedRestore?.();
    const data = JSON.parse(text);
    const outer = data.groups.find(g=>g.id==='outer');
    const inner = data.groups.find(g=>g.id==='inner');
    const adjustment = data.layers.find(l=>l.id==='invert-clipped');
    const levels = data.layers.find(l=>l.id==='levels-clipped');
    const overlay = data.layers.find(l=>l.id==='overlay-blue');
    const blue = data.layers.find(l=>l.id==='blue-backdrop');
    const base = data.layers.find(l=>l.id==='red-base');
    const transfer = new DataTransfer();
    transfer.items.add(new File([text],'nested-alpha-reopen.zpe',{type:'application/json'}));
    const input = document.querySelector('#projectInput');
    input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
    return {mask:outer?.mask?.enabled,maskBytes:outer?.mask?.dataUrl?.length,
      nested:inner?.parentGroupId,clipped:adjustment?.clipping,
      kind:adjustment?.adjustment?.kind,effectModel:adjustment?.adjustment,levels:levels?.adjustment?.master,levelsClip:levels?.clipping,blue:blue?.dataUrl?.startsWith('data:image/'),
      innerBlend:inner?.blendMode,innerOpacity:inner?.opacity,innerMask:!!inner?.mask?.dataUrl,groupScope:overlay?.groupId===outer?.id&&adjustment?.groupId===outer?.id&&levels?.groupId===outer?.id,baseBlend:base?.blendMode,rasterClip:overlay?.clipping,blend:overlay?.blendMode,opacity:overlay?.opacity,
      overlayMask:overlay?.mask?.dataUrl?.length,overlayMaskEnabled:overlay?.mask?.enabled};
  })()`);
  assert(persist.mask===true&&persist.maskBytes>50&&persist.nested==='outer'&&
    persist.clipped===true&&persist.kind===effect.kind&&Object.entries(effect).every(([k,v])=>persist.effectModel?.[k]===v)&&persist.blue&&
    (!chained || (persist.levelsClip===true&&persist.levels?.outputBlack===32&&persist.levels?.outputWhite===224))&&
    (!groupMode||(persist.innerBlend===groupMode&&Math.abs(persist.innerOpacity-.5)<.01&&persist.innerMask&&persist.groupScope))&&persist.baseBlend===baseMode&&persist.rasterClip===true&&persist.blend===mode&&
    persist.overlayMask>50&&persist.overlayMaskEnabled===true&&
    Math.abs(persist.opacity-(mode==='multiply'?1:0.5))<.01,
    'ZPE retained editable group/adjustment/raster: '+JSON.stringify(persist));
  await waitFor('native ZPE reopen retains exact nested pixels',async() => {
    const actual=await pixels();return expected.every((p,i)=>near(actual[i],p));
  },12000);
  console.log('Nested PSD clipped raster '+mode+' / adjustment / UI / History / ZPE PASS');
  await verifyNativeClippedUiRoundTrips(client,{evaluate,waitFor,assert},{mode,expected,near,chained,effect,effectName,baseMode,groupMode});
}

// Independent scalar oracle: clipped overlay RGB, Levels output mapping,
// Invert, then premultiplied source-over with folder coverage.
function chainedOracle(mode, backdropAlpha, effect, baseMode, groupMode, backdrop) {
  return [255,128,255,0].map((mask,x) => {
    const coverage=[1,128/255,0,1][x];
    const rgb=mode==='multiply' ? [255-mask,0,0] : [255,0,Math.round(mask/2)];
    const leveled=rgb.map(v=>Math.round(32+192*v/255));
    const corrected=effect.kind==='posterize' ? leveled.map(v=>Math.round(Math.floor(v*effect.levels/256)*255/(effect.levels-1)))
      : effect.kind==='threshold' ? Array(3).fill(Math.round(.3*leveled[0]+.59*leveled[1]+.11*leveled[2])>=effect.level?255:0)
      : leveled.map(v=>255-v);
    const a=128/255*coverage*(groupMode ? .5*(x===1?128/255:1) : 1), b=backdropAlpha/255;
    const alpha=a+b*(1-a);
    if (!alpha) return [0,0,0,0];
    return [...corrected.map((v,c)=>{
      const back=backdrop[c];
      const blended=baseMode==='multiply'?v*back/255:baseMode==='screen'?255-(255-v)*(255-back)/255:
        baseMode==='overlay'?(back<=127.5?2*back*v/255:255-2*(255-back)*(255-v)/255):
        baseMode==='hard-light'?(v<=127.5?2*back*v/255:255-2*(255-back)*(255-v)/255):
        baseMode==='darken'?Math.min(v,back):baseMode==='lighten'?Math.max(v,back):
        baseMode==='difference'?Math.abs(back-v):baseMode==='exclusion'?back+v-2*back*v/255:
        baseMode==='soft-light'?softLightOracle(back/255,v/255)*255:v;
      return Math.round((a*((1-b)*v+b*blended)+back*b*(1-a))/alpha);
    }),Math.round(alpha*255)];
  });
}

// W3C separable Soft Light scalar, normalized to [0,1].
function softLightOracle(b,s) {
  if (s <= 0.5) return b - (1-2*s)*b*(1-b);
  const d = b <= 0.25 ? ((16*b-12)*b+4)*b : Math.sqrt(b);
  return b + (2*s-1)*(d-b);
}
