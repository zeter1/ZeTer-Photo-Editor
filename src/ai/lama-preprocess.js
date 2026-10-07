// Fixed model contract: RGB 0..1 with masked pixels zeroed, mask=1 means erase.
export function prepareLamaInput({ width, height, data, mask }) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width<1 || height<1 || width*height>8_000_000 || data?.length!==width*height*4 || mask?.length!==width*height) throw new Error('Некорректный размер изображения или маски');
  let left=width,top=height,right=-1,bottom=-1,count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);count++;}
  if(!count || count===width*height)throw new Error('Закрасьте объект и оставьте вокруг него часть фона');
  const side=Math.min(Math.max(width,height),Math.max(256,(right-left+1)*2.5,(bottom-top+1)*2.5));
  const cw=Math.min(width,Math.ceil(side)),ch=Math.min(height,Math.ceil(side));
  const crop={x:Math.max(0,Math.min(width-cw,Math.round((left+right+1-cw)/2))),y:Math.max(0,Math.min(height-ch,Math.round((top+bottom+1-ch)/2))),width:cw,height:ch};
  const scale=512/Math.max(cw,ch),tw=Math.max(1,Math.round(cw*scale)),th=Math.max(1,Math.round(ch*scale)),ox=Math.floor((512-tw)/2),oy=Math.floor((512-th)/2);
  const n=512*512,input=new Float32Array(n*4),modelMask=new Uint8Array(n);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const sx=crop.x+Math.max(0,Math.min(cw-1,(x-ox+.5)*cw/tw-.5)),sy=crop.y+Math.max(0,Math.min(ch-1,(y-oy+.5)*ch/th-.5));
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=sx-x0,fy=sy-y0,i=y*512+x;
    for(let k=0;k<3;k++)input[k*n+i]=((data[(y0*width+x0)*4+k]*(1-fx)+data[(y0*width+x1)*4+k]*fx)*(1-fy)+(data[(y1*width+x0)*4+k]*(1-fx)+data[(y1*width+x1)*4+k]*fx)*fy)/255;
    // Conservative downsampling preserves even thin painted strokes.
    if(x>=ox&&x<ox+tw&&y>=oy&&y<oy+th){
      const xa=Math.max(crop.x,Math.floor(crop.x+(x-ox)*cw/tw)),xb=Math.min(crop.x+cw-1,Math.ceil(crop.x+(x-ox+1)*cw/tw)-1);
      const ya=Math.max(crop.y,Math.floor(crop.y+(y-oy)*ch/th)),yb=Math.min(crop.y+ch-1,Math.ceil(crop.y+(y-oy+1)*ch/th)-1);
      for(let yy=ya;yy<=yb&&!modelMask[i];yy++)for(let xx=xa;xx<=xb;xx++)if(mask[yy*width+xx]){modelMask[i]=1;break;}
    }
  }
  // Small model-only margin avoids sampling the object's rim; publication is still mask-only.
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=y*512+x;let marked=false;
    for(let yy=Math.max(0,y-3);yy<=Math.min(511,y+3)&&!marked;yy++)for(let xx=Math.max(0,x-3);xx<=Math.min(511,x+3);xx++)if(modelMask[yy*512+xx]){marked=true;break;}
    if(marked){input[i]=input[n+i]=input[2*n+i]=0;input[3*n+i]=1;}
  }
  return {input,crop,tw,th,ox,oy};
}

export function mergeLamaOutput({width,height,data,mask},prepared,output) {
  const n=512*512;
  if(!(output instanceof Float32Array)||output.length!==3*n||!output.every(Number.isFinite))throw new Error('Нейросеть вернула некорректный результат');
  const result=new Uint8ClampedArray(data),{crop,tw,th,ox,oy}=prepared;
  for(let y=crop.y;y<crop.y+crop.height;y++)for(let x=crop.x;x<crop.x+crop.width;x++)if(mask[y*width+x]){
    const sx=Math.max(0,Math.min(511,ox+(x-crop.x+.5)*tw/crop.width-.5)),sy=Math.max(0,Math.min(511,oy+(y-crop.y+.5)*th/crop.height-.5));
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(511,x0+1),y1=Math.min(511,y0+1),fx=sx-x0,fy=sy-y0;
    for(let k=0;k<3;k++){
      const off=k*n,value=(output[off+y0*512+x0]*(1-fx)+output[off+y0*512+x1]*fx)*(1-fy)+(output[off+y1*512+x0]*(1-fx)+output[off+y1*512+x1]*fx)*fy;
      result[(y*width+x)*4+k]=Math.round(Math.max(0,Math.min(1,value))*255);
    }
  }
  return result;
}
