// Layer styles are stored with the layer, not baked into its source pixels.
export const LAYER_STYLE_FIELDS = Object.freeze({
  stroke: { label:'Обводка', fields:{size:['range',1,24,5],color:['color','#4f8cff'],opacity:['range',0,100,100]} },
  bevel: { label:'Тиснение', fields:{size:['range',1,24,6],strength:['range',0,100,60],angle:['range',0,360,135]} },
  innerShadow: { label:'Внутренняя тень', fields:{distance:['range',0,40,6],blur:['range',0,40,10],color:['color','#000000'],opacity:['range',0,100,55]} },
  innerGlow: { label:'Внутреннее свечение', fields:{blur:['range',1,40,12],color:['color','#ffffff'],opacity:['range',0,100,65]} },
  colorOverlay: { label:'Наложение цвета', fields:{color:['color','#4f8cff'],opacity:['range',0,100,100]} },
  gradientOverlay: { label:'Наложение градиента', fields:{color1:['color','#4f8cff'],color2:['color','#ff7ab6'],angle:['range',0,360,0],opacity:['range',0,100,100]} },
  patternOverlay: { label:'Наложение узора', fields:{pattern:['select',['stripes','dots','checker'],'stripes'],color:['color','#ffffff'],scale:['range',4,48,14],opacity:['range',0,100,70]} },
  outerGlow: { label:'Внешнее свечение', fields:{blur:['range',1,40,16],color:['color','#79aaff'],opacity:['range',0,100,70]} },
  dropShadow: { label:'Тень', fields:{distance:['range',0,80,12],blur:['range',0,40,16],angle:['range',0,360,135],color:['color','#000000'],opacity:['range',0,100,65]} },
});

export function createLayerStyles() {
  const result={fillOpacity:100};
  for(const [key,spec] of Object.entries(LAYER_STYLE_FIELDS)) {
    result[key]={enabled:false};
    for(const [field,rule] of Object.entries(spec.fields)) result[key][field]=rule[0]==='range'?rule[3]:rule[0]==='color'?rule[1]:rule[2];
  }
  return result;
}

export function sanitizeLayerStyles(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)) return null;
  const result=createLayerStyles();
  const fill=Number(value.fillOpacity);
  if(Number.isFinite(fill)) result.fillOpacity=Math.max(0,Math.min(100,Math.round(fill)));
  for(const [key,spec] of Object.entries(LAYER_STYLE_FIELDS)) {
    const input=value[key];
    if(!input || typeof input!=='object' || Array.isArray(input)) continue;
    result[key].enabled=input.enabled===true;
    for(const [field,rule] of Object.entries(spec.fields)) {
      const candidate=input[field];
      if(rule[0]==='range') {
        const number=Number(candidate);
        if(Number.isFinite(number))result[key][field]=Math.max(rule[1],Math.min(rule[2],Math.round(number)));
      } else if(rule[0]==='color') {
        if(typeof candidate==='string' && /^#[\da-f]{6}$/i.test(candidate)) result[key][field]=candidate.toLowerCase();
      } else if(rule[0]==='select' && rule[1].includes(candidate)) result[key][field]=candidate;
    }
  }
  return result;
}

export function hasLayerStyles(value) {
  return Boolean(value && (Number(value.fillOpacity)<100 || Object.keys(LAYER_STYLE_FIELDS).some(key=>value[key]?.enabled===true)));
}

export function layerStyleOutset(value) {
  const s=sanitizeLayerStyles(value);
  if(!s)return 0;
  return Math.max(0,
    s.stroke.enabled?s.stroke.size+2:0,
    s.outerGlow.enabled?s.outerGlow.blur*2+2:0,
    s.dropShadow.enabled?s.dropShadow.distance+s.dropShadow.blur*2+2:0,
    s.innerGlow.enabled?s.innerGlow.blur*2+2:0,
    s.innerShadow.enabled?s.innerShadow.distance+s.innerShadow.blur*2+2:0,
    s.bevel.enabled?s.bevel.size*3+2:0);
}

function canvas(width,height) {
  const item=document.createElement('canvas');
  item.width=width;item.height=height;
  return item;
}

// The styled group is composited once by renderLayer, so layer opacity and blend mode
// apply to the whole effect rather than repeatedly to each style.
export async function renderLayerStyles(styles,width,height,paint,{contentBlur=0}={}) {
  const s=sanitizeLayerStyles(styles);
  const active=Object.entries(LAYER_STYLE_FIELDS).filter(([key])=>s[key].enabled).map(([key])=>key);
  const outside=Math.max(2,contentBlur*2+2,layerStyleOutset(s));
  // Bound temporary Canvas memory for large documents. All dimensions and radii
  // scale together; the saved source pixels and project data remain untouched.
  const scale=Math.min(1,Math.sqrt(16_000_000/((width+outside*2)*(height+outside*2))));
  const w=Math.max(1,Math.ceil(width*scale)),h=Math.max(1,Math.ceil(height*scale));
  const pad=Math.max(2,Math.ceil(outside*scale));
  const cw=w+pad*2,ch=h+pad*2;
  const source=canvas(cw,ch),sourceCtx=source.getContext('2d',{alpha:true});
  sourceCtx.scale(scale,scale);
  sourceCtx.translate(pad/scale,pad/scale);
  await paint(sourceCtx);
  const output=canvas(cw,ch),out=output.getContext('2d',{alpha:true});
  const scratch=canvas(cw,ch),temp=scratch.getContext('2d',{alpha:true});
  let inverse=null;
  const reset=()=>{temp.setTransform(1,0,0,1,0,0);temp.globalAlpha=1;temp.globalCompositeOperation='source-over';temp.filter='none';temp.shadowColor='transparent';temp.shadowBlur=0;temp.shadowOffsetX=0;temp.shadowOffsetY=0;temp.clearRect(0,0,cw,ch);};
  const commit=()=>out.drawImage(scratch,0,0);
  const tint=(color,opacity)=>{
    temp.globalCompositeOperation='source-in';temp.globalAlpha=opacity/100;temp.fillStyle=color;temp.fillRect(0,0,cw,ch);
  };
  const outer=(item,dx,dy)=>{
    reset();
    temp.shadowColor=item.color;temp.shadowBlur=item.blur*scale;
    temp.shadowOffsetX=dx*scale;temp.shadowOffsetY=dy*scale;
    temp.drawImage(source,0,0);
    temp.shadowColor='transparent';temp.shadowBlur=0;temp.shadowOffsetX=0;temp.shadowOffsetY=0;
    temp.globalCompositeOperation='destination-out';temp.drawImage(source,0,0);
    tint(item.color,item.opacity);commit();
  };
  const inner=(color,opacity,blur,dx,dy)=>{
    if(!inverse){
      inverse=canvas(cw,ch);
      const mask=inverse.getContext('2d',{alpha:true});
      mask.fillStyle='#fff';mask.fillRect(0,0,cw,ch);
      mask.globalCompositeOperation='destination-out';mask.drawImage(source,0,0);
    }
    reset();
    temp.shadowColor=color;temp.shadowBlur=blur*scale;
    temp.shadowOffsetX=dx*scale;temp.shadowOffsetY=dy*scale;
    temp.drawImage(inverse,0,0);
    temp.shadowColor='transparent';temp.shadowBlur=0;temp.shadowOffsetX=0;temp.shadowOffsetY=0;
    temp.globalCompositeOperation='destination-in';temp.drawImage(source,0,0);
    tint(color,opacity);commit();
  };
  if(active.includes('dropShadow')){
    const item=s.dropShadow,angle=item.angle*Math.PI/180;
    outer(item,Math.cos(angle)*item.distance,Math.sin(angle)*item.distance);
  }
  if(active.includes('outerGlow'))outer(s.outerGlow,0,0);
  if(active.includes('stroke')){
    const item=s.stroke;reset();
    for(let step=0;step<24;step++){
      const angle=step*Math.PI/12;
      temp.drawImage(source,Math.cos(angle)*item.size*scale,Math.sin(angle)*item.size*scale);
    }
    tint(item.color,item.opacity);
    temp.globalCompositeOperation='destination-out';temp.globalAlpha=1;temp.drawImage(source,0,0);
    commit();
  }
  out.globalAlpha=s.fillOpacity/100;out.drawImage(source,0,0);out.globalAlpha=1;
  const overlay=(item,fill)=>{
    reset();temp.drawImage(source,0,0);
    temp.globalCompositeOperation='source-in';temp.globalAlpha=item.opacity/100;
    temp.fillStyle=fill;temp.fillRect(0,0,cw,ch);commit();
  };
  if(active.includes('colorOverlay'))overlay(s.colorOverlay,s.colorOverlay.color);
  if(active.includes('gradientOverlay')){
    const item=s.gradientOverlay,angle=item.angle*Math.PI/180;
    const cx=pad+w/2,cy=pad+h/2,reach=Math.hypot(w,h)/2;
    const gradient=temp.createLinearGradient(cx-Math.cos(angle)*reach,cy-Math.sin(angle)*reach,cx+Math.cos(angle)*reach,cy+Math.sin(angle)*reach);
    gradient.addColorStop(0,item.color1);gradient.addColorStop(1,item.color2);
    overlay(item,gradient);
  }
  if(active.includes('patternOverlay')){
    const item=s.patternOverlay,size=Math.max(2,Math.round(item.scale*scale));
    const tile=canvas(size*2,size*2),tileCtx=tile.getContext('2d',{alpha:true});
    tileCtx.fillStyle=item.color;
    if(item.pattern==='checker'){tileCtx.fillRect(0,0,size,size);tileCtx.fillRect(size,size,size,size);}
    else if(item.pattern==='dots'){
      tileCtx.beginPath();tileCtx.arc(size/2,size/2,Math.max(1,size/3),0,Math.PI*2);tileCtx.arc(size*1.5,size*1.5,Math.max(1,size/3),0,Math.PI*2);tileCtx.fill();
    } else {for(let x=-size*2;x<size*4;x+=size){tileCtx.beginPath();tileCtx.moveTo(x,0);tileCtx.lineTo(x+size*2,size*2);tileCtx.lineTo(x+size*2+Math.max(1,size/3),size*2);tileCtx.lineTo(x+Math.max(1,size/3),0);tileCtx.closePath();tileCtx.fill();}}
    overlay(item,temp.createPattern(tile,'repeat'));
  }
  if(active.includes('innerGlow'))inner(s.innerGlow.color,s.innerGlow.opacity,s.innerGlow.blur,0,0);
  if(active.includes('innerShadow')){
    const item=s.innerShadow,angle=135*Math.PI/180;
    inner(item.color,item.opacity,item.blur,Math.cos(angle)*item.distance,Math.sin(angle)*item.distance);
  }
  if(active.includes('bevel')){
    const item=s.bevel,angle=item.angle*Math.PI/180,dx=Math.cos(angle)*item.size,dy=Math.sin(angle)*item.size;
    inner('#ffffff',item.strength,item.size,-dx,-dy);
    inner('#000000',item.strength,item.size,dx,dy);
  }
  return {canvas:output,x:-pad/scale,y:-pad/scale,width:cw/scale,height:ch/scale};
}