const clampAdjustment=(value,min,max,fallback=0)=>{
  const number=Number(value);
  return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
};
const intAdjustment=(value,min,max,fallback=0)=>Math.round(clampAdjustment(value,min,max,fallback));

function sanitizeLevelRecord(value={}) {
  const inputBlack=intAdjustment(value.inputBlack,0,253,0);
  const inputWhite=Math.max(inputBlack+2,intAdjustment(value.inputWhite,2,255,255));
  const outputBlack=intAdjustment(value.outputBlack,0,255,0);
  const outputWhite=intAdjustment(value.outputWhite,0,255,255);
  return{
    inputBlack,
    inputWhite:Math.min(255,inputWhite),
    gamma:clampAdjustment(value.gamma,.1,9.99,1),
    outputBlack,
    outputWhite,
  };
}

function sanitizeCurvePoints(points) {
  const clean=(Array.isArray(points)?points:[])
    .slice(0,19)
    .map(point=>({
      input:intAdjustment(point?.input,0,255,0),
      output:intAdjustment(point?.output,0,255,0),
    }))
    .sort((a,b)=>a.input-b.input||a.output-b.output);
  const unique=[];
  for(const point of clean){
    if(unique.length&&unique.at(-1).input===point.input)unique[unique.length-1]=point;
    else unique.push(point);
  }
  return unique;
}

export function sanitizeAdjustmentModel(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const kind=String(value.kind||'');
  if(kind==='brightness-contrast'){
    return{kind,brightness:intAdjustment(value.brightness,-150,150,0),contrast:intAdjustment(value.contrast,-100,100,0),legacy:value.legacy===true};
  }
  if(kind==='exposure'){
    return{kind,exposure:clampAdjustment(value.exposure,-20,20,0),offset:clampAdjustment(value.offset,-2,2,0),gamma:clampAdjustment(value.gamma,.1,10,1)};
  }
  if(kind==='hue-saturation'){
    return{kind,hue:intAdjustment(value.hue,-180,180,0),saturation:intAdjustment(value.saturation,-100,100,0),lightness:intAdjustment(value.lightness,-100,100,0),colorize:value.colorize===true};
  }
  if(kind==='invert')return{kind};
  if(kind==='posterize')return{kind,levels:intAdjustment(value.levels,2,255,4)};
  if(kind==='threshold')return{kind,level:intAdjustment(value.level,1,255,128)};
  if(kind==='levels'){
    const channels=Array.isArray(value.channels)?value.channels.slice(0,8).map((entry,index)=>({
      id:intAdjustment(entry?.id,-1,32,index),
      ...sanitizeLevelRecord(entry),
    })):[];
    return{kind,master:sanitizeLevelRecord(value.master),channels};
  }
  if(kind==='curves'){
    const channels=(Array.isArray(value.channels)?value.channels:[]).slice(0,16).map((entry,index)=>({
      id:intAdjustment(entry?.id,0,31,index),
      points:sanitizeCurvePoints(entry?.points),
    })).filter(entry=>entry.points.length>=2);
    return{kind,channels};
  }
  return null;
}

function applyBrightnessContrast01(value,brightness,contrast) {
  const bright=Math.max(-1,Math.min(1,brightness/150));
  let x=bright>=0?value+(1-value)*bright:value*(1+bright);
  const c=Math.max(-254,Math.min(254,contrast*2.54));
  const factor=(259*(c+255))/(255*(259-c));
  x=factor*(x-.5)+.5;
  return Math.max(0,Math.min(1,x));
}

function rgbToHsl(r,g,b) {
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  let h=0;
  if(delta){
    if(max===r)h=((g-b)/delta)%6;
    else if(max===g)h=(b-r)/delta+2;
    else h=(r-g)/delta+4;
    h*=60;if(h<0)h+=360;
  }
  const l=(max+min)/2;
  const s=delta===0?0:delta/(1-Math.abs(2*l-1));
  return[h,s,l];
}
function hslToRgb(h,s,l) {
  const c=(1-Math.abs(2*l-1))*s;
  const hp=((h%360)+360)%360/60;
  const x=c*(1-Math.abs((hp%2)-1));
  let r=0,g=0,b=0;
  if(hp<1){r=c;g=x}else if(hp<2){r=x;g=c}else if(hp<3){g=c;b=x}else if(hp<4){g=x;b=c}else if(hp<5){r=x;b=c}else{r=c;b=x}
  const m=l-c/2;
  return[r+m,g+m,b+m];
}

function applyLevels01(value,record) {
  const inputBlack=record.inputBlack/255,inputWhite=record.inputWhite/255;
  let x=(value-inputBlack)/Math.max(1/255,inputWhite-inputBlack);
  x=Math.max(0,Math.min(1,x));
  x=Math.pow(x,1/Math.max(.1,record.gamma));
  const outputBlack=record.outputBlack/255,outputWhite=record.outputWhite/255;
  return Math.max(0,Math.min(1,outputBlack+x*(outputWhite-outputBlack)));
}

function curveValue(value,points) {
  if(!points?.length)return value;
  const x=Math.max(0,Math.min(255,value*255));
  if(x<=points[0].input)return points[0].output/255;
  if(x>=points.at(-1).input)return points.at(-1).output/255;
  for(let index=1;index<points.length;index+=1){
    const right=points[index],left=points[index-1];
    if(x<=right.input){
      const t=(x-left.input)/Math.max(1,right.input-left.input);
      return Math.max(0,Math.min(1,(left.output+(right.output-left.output)*t)/255));
    }
  }
  return value;
}

export function applyAdjustmentPixels(imageData,adjustment) {
  if(!imageData?.data)return imageData;
  const model=sanitizeAdjustmentModel(adjustment);
  if(!model)return imageData;
  const data=imageData.data;
  for(let index=0;index<data.length;index+=4){
    if(data[index+3]===0)continue;
    let r=data[index]/255,g=data[index+1]/255,b=data[index+2]/255;
    if(model.kind==='brightness-contrast'){
      r=applyBrightnessContrast01(r,model.brightness,model.contrast);
      g=applyBrightnessContrast01(g,model.brightness,model.contrast);
      b=applyBrightnessContrast01(b,model.brightness,model.contrast);
    }else if(model.kind==='exposure'){
      const scale=2**model.exposure,power=1/Math.max(.1,model.gamma);
      r=Math.pow(Math.max(0,r*scale+model.offset),power);
      g=Math.pow(Math.max(0,g*scale+model.offset),power);
      b=Math.pow(Math.max(0,b*scale+model.offset),power);
    }else if(model.kind==='hue-saturation'){
      let[h,s,l]=rgbToHsl(r,g,b);
      if(model.colorize){h=((model.hue%360)+360)%360;s=Math.max(0,Math.min(1,(model.saturation+100)/200));}
      else{h=(h+model.hue+360)%360;s=Math.max(0,Math.min(1,s*(1+model.saturation/100)));}
      l=Math.max(0,Math.min(1,l+model.lightness/100));
      [r,g,b]=hslToRgb(h,s,l);
    }else if(model.kind==='invert'){
      r=1-r;g=1-g;b=1-b;
    }else if(model.kind==='posterize'){
      const levels=model.levels;
      const correction=255/256;
      r=Math.floor(correction*r*levels)/(levels-1);
      g=Math.floor(correction*g*levels)/(levels-1);
      b=Math.floor(correction*b*levels)/(levels-1);
    }else if(model.kind==='threshold'){
      const luminance=Math.round((.3*r+.59*g+.11*b)*255);
      const value=luminance>=model.level?1:0;
      r=value;g=value;b=value;
    }else if(model.kind==='levels'){
      r=applyLevels01(r,model.master);g=applyLevels01(g,model.master);b=applyLevels01(b,model.master);
      const byId=new Map(model.channels.map(entry=>[entry.id,entry]));
      if(byId.has(1))r=applyLevels01(r,byId.get(1));
      if(byId.has(2))g=applyLevels01(g,byId.get(2));
      if(byId.has(3))b=applyLevels01(b,byId.get(3));
    }else if(model.kind==='curves'){
      const byId=new Map(model.channels.map(entry=>[entry.id,entry.points]));
      const master=byId.get(0);
      if(master){r=curveValue(r,master);g=curveValue(g,master);b=curveValue(b,master);}
      if(byId.has(1))r=curveValue(r,byId.get(1));
      if(byId.has(2))g=curveValue(g,byId.get(2));
      if(byId.has(3))b=curveValue(b,byId.get(3));
    }
    data[index]=Math.round(Math.max(0,Math.min(1,r))*255);
    data[index+1]=Math.round(Math.max(0,Math.min(1,g))*255);
    data[index+2]=Math.round(Math.max(0,Math.min(1,b))*255);
  }
  return imageData;
}

function blendAdjustmentChannel(base,effect,mode) {
  if(mode==='multiply')return base*effect;
  if(mode==='screen')return 1-(1-base)*(1-effect);
  if(mode==='overlay')return base<=.5?2*base*effect:1-2*(1-base)*(1-effect);
  if(mode==='darken')return Math.min(base,effect);
  if(mode==='lighten')return Math.max(base,effect);
  if(mode==='color-dodge')return effect>=1?1:Math.min(1,base/(1-effect));
  if(mode==='color-burn')return effect<=0?0:1-Math.min(1,(1-base)/effect);
  return effect;
}

export function compositeAdjustmentPixels(baseImageData,effectImageData,{opacity=1,blendMode='source-over'}={}) {
  if(!baseImageData?.data||!effectImageData?.data||baseImageData.data.length!==effectImageData.data.length)return baseImageData;
  const layerOpacity=clampAdjustment(opacity,0,1,1);
  if(layerOpacity<=0)return baseImageData;
  const base=baseImageData.data,effect=effectImageData.data;
  for(let index=0;index<base.length;index+=4){
    const baseAlpha=base[index+3];
    const effectAlpha=effect[index+3];
    if(baseAlpha<=0||effectAlpha<=0)continue;
    const coverage=Math.min(1,effectAlpha/baseAlpha)*layerOpacity;
    if(coverage<=0)continue;
    for(let channel=0;channel<3;channel+=1){
      const original=base[index+channel]/255;
      const adjusted=effect[index+channel]/255;
      const blended=blendAdjustmentChannel(original,adjusted,blendMode);
      base[index+channel]=Math.round(Math.max(0,Math.min(1,original+(blended-original)*coverage))*255);
    }
  }
  return baseImageData;
}

export function adjustmentModelEqual(left,right) {
  return JSON.stringify(sanitizeAdjustmentModel(left))===JSON.stringify(sanitizeAdjustmentModel(right));
}
