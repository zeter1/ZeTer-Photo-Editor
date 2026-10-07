// Transient, layer-local brush mask. Pixel publication belongs to rasterCommands.
export function createObjectRemovalController({ state, geometry, commands, ui, documentRef=globalThis.document,toolName='Удаление объектов',historyLabel='Удалить объект',successMessage='Объект удалён · Ctrl+Z — отменить',previewColor=[255,84,148],negativePreviewColor=[255,91,105],strokeHistory=false } = {}) {
  let draft=null, stroke=null, busy=false, preview=null, previewDirty=false, operation=null;
  const undoStrokes=[],redoStrokes=[];
  const historyBudget=32*1024*1024,maxHistory=32;
  const transformKey = layer => [layer.x,layer.y,layer.width,layer.height,layer.scaleX,layer.scaleY,layer.rotation].join('|');
  function valid() {
    return draft && state.getDocument()===draft.doc && state.selected()===draft.layer &&
      draft.doc.layers.includes(draft.layer) && state.isEditable(draft.layer) &&
      state.getSerial()===draft.serial && transformKey(draft.layer)===draft.transform;
  }
  function notify() { ui?.changed?.({hasMask:Boolean(draft?.count),busy,active:Boolean(stroke)}); }
  function discard() { draft=null;stroke=null;preview=null;previewDirty=false;undoStrokes.length=redoStrokes.length=0;notify(); }
  function validate() { if(draft&&!valid())discard(); return Boolean(draft); }
  function reset() { if(busy)return false;discard();return true; }
  function hasMask() { validate();return Boolean(draft?.count); }
  function snapshot() { return validate()?{width:draft.width,height:draft.height,data:draft.data.slice()}:null; }
  function canUndo() { return validate()&&!busy&&!stroke&&undoStrokes.length>0; }
  function canRedo() { return validate()&&!busy&&!stroke&&redoStrokes.length>0; }
  function travel(from,to) {
    if(!validate()||busy||stroke||!from.length)return false;
    to.push({data:draft.data,count:draft.count});
    const previous=from.pop();draft.data=previous.data;draft.count=previous.count;previewDirty=true;notify();return true;
  }

  function paint(start,end,diameter) {
    if(!validate())return;
    const radius=Math.max(.5,Math.min(160,Number(diameter)||1)/2);
    const {width,height,data}=draft;
    const left=Math.max(0,Math.floor(Math.min(start.x,end.x)-radius));
    const right=Math.min(width-1,Math.ceil(Math.max(start.x,end.x)+radius));
    const top=Math.max(0,Math.floor(Math.min(start.y,end.y)-radius));
    const bottom=Math.min(height-1,Math.ceil(Math.max(start.y,end.y)+radius));
    const dx=end.x-start.x,dy=end.y-start.y,length2=dx*dx+dy*dy;
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++) {
      const t=length2?Math.max(0,Math.min(1,((x+.5-start.x)*dx+(y+.5-start.y)*dy)/length2)):0;
      if((x+.5-start.x-t*dx)**2+(y+.5-start.y-t*dy)**2>radius*radius)continue;
      if(geometry.isAllowed&&!geometry.isAllowed({x:x+.5,y:y+.5},draft.layer))continue;
      const index=y*width+x;
      const mark=stroke?.mark||1;
      if(data[index]!==mark){if(!data[index])draft.count++;data[index]=mark;previewDirty=true;if(stroke)stroke.changed=true;}
    }
  }
  function local(point) {
    const value=geometry.toLocal(point,draft.layer);
    return value&&Number.isFinite(value.x)&&Number.isFinite(value.y)?value:null;
  }
  function begin(point,diameter,mark=1) {
    if(busy||stroke)return false;
    validate();
    const doc=state.getDocument(),layer=state.selected();
    if(!doc?.layers.includes(layer)||!state.isEditable(layer)){
      ui?.setStatus?.(`${toolName}: выберите незаблокированный растровый слой`);return false;
    }
    if(!draft){
      const width=Number(layer.width),height=Number(layer.height);
      if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>8_000_000){
        ui?.setStatus?.(`${toolName}: слой должен быть не больше 8 млн пикселей`);return false;
      }
      draft={doc,layer,width,height,data:new Uint8Array(width*height),count:0,serial:state.getSerial(),transform:transformKey(layer)};
    }
    const p=local(point);if(!p)return false;
    stroke={last:p,before:draft.data.slice(),count:draft.count,mark:mark===2?2:1,changed:false};
    paint(p,p,diameter);notify();return true;
  }
  function move(point,diameter) {
    if(!stroke||busy||!validate())return;
    const p=local(point);if(!p)return;
    paint(stroke.last,p,diameter);if(stroke)stroke.last=p;
  }
  function finish(point,diameter) {
    move(point,diameter);
    if(strokeHistory&&stroke?.changed&&validate()){
      redoStrokes.length=0;undoStrokes.push({data:stroke.before,count:stroke.count});
      const limit=Math.min(maxHistory,Math.floor(historyBudget/draft.data.byteLength));
      while(undoStrokes.length>limit)undoStrokes.shift();
    }
    stroke=null;notify();
  }
  function cancel() {
    if(stroke&&validate()){draft.data=stroke.before;draft.count=stroke.count;previewDirty=true;}
    stroke=null;notify();
  }
  async function remove() {
    if(busy||stroke||!hasMask())return false;
    const owner=draft,mask=owner.data.slice();
    operation=new AbortController();busy=true;notify();
    try {
      const applied=await commands.remove({
        ownerDocument:owner.doc,ownerLayer:owner.layer,historyLabel,
        mask:{width:owner.width,height:owner.height,data:mask},signal:operation.signal,
        isCurrent:()=>draft===owner && Boolean(valid()),
        isAllowed:(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<owner.width&&y<owner.height&&Boolean(mask[y*owner.width+x]),
      });
      if(applied){discard();ui?.setStatus?.(successMessage);}
      return Boolean(applied);
    } finally { operation=null;busy=false;notify(); }
  }
  function draw(ctx) {
    if(!hasMask()||!documentRef)return;
    if(!preview){preview=documentRef.createElement('canvas');preview.width=draft.width;preview.height=draft.height;previewDirty=true;}
    if(previewDirty){
      const pc=preview.getContext('2d'),image=pc.createImageData(draft.width,draft.height);
      for(let i=0;i<draft.data.length;i++)if(draft.data[i]){const color=draft.data[i]===2?negativePreviewColor:previewColor;image.data[i*4]=color[0];image.data[i*4+1]=color[1];image.data[i*4+2]=color[2];image.data[i*4+3]=112;}
      pc.putImageData(image,0,0);previewDirty=false;
    }
    const p=geometry.toDocument({x:0,y:0},draft.layer),px=geometry.toDocument({x:1,y:0},draft.layer),py=geometry.toDocument({x:0,y:1},draft.layer);
    ctx.save();ctx.transform(px.x-p.x,px.y-p.y,py.x-p.x,py.y-p.y,p.x,p.y);ctx.drawImage(preview,0,0);ctx.restore();
  }
  return {begin,move,finish,cancel,reset,hasMask,snapshot,remove,draw,canUndo,canRedo,undo:()=>travel(undoStrokes,redoStrokes),redo:()=>travel(redoStrokes,undoStrokes),isBusy:()=>busy,isDrawing:()=>Boolean(stroke),abort:()=>operation?.abort()};
}
