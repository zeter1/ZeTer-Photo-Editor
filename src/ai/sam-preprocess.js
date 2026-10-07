// Brush marks are prompts, never an outline or a clipping mask.
export function prepareSamPrompts({width,height,data,mask},{square=false}={}){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>8_000_000||data?.length!==width*height*4||mask?.length!==width*height)throw new Error('Некорректный размер слоя или подсказки');
  const chosen=[],labels=[],n=width*height,visited=new Uint8Array(n),queue=new Int32Array(n);
  // One seed deep INSIDE each substantial painted region. Farthest brush-edge
  // sampling treated accidental background fringe as mandatory foreground.
  for(const label of [1,2]){
    const distance=new Uint16Array(n);
    for(let i=0;i<n;i++)if(mask[i]===label&&data[i*4+3])distance[i]=65534;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x;if(distance[i])distance[i]=Math.min(distance[i],x?distance[i-1]+1:1,y?distance[i-width]+1:1);
    }
    for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
      const i=y*width+x;if(distance[i])distance[i]=Math.min(distance[i],x+1<width?distance[i+1]+1:1,y+1<height?distance[i+width]+1:1);
    }
    visited.fill(0);const regions=[];
    for(let start=0;start<n;start++)if(distance[start]&&!visited[start]){
      let head=0,tail=1,best=start;queue[0]=start;visited[start]=1;
      while(head<tail){const i=queue[head++],x=i%width;
        if(distance[i]>distance[best])best=i;
        const neighbors=[x?i-1:-1,x+1<width?i+1:-1,i-width,i+width];
        for(const j of neighbors)if(j>=0&&j<n&&distance[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}
      }
      const candidates=[];const step=Math.max(1,Math.ceil(tail/2048));
      for(let k=0;k<tail;k+=step)if(distance[queue[k]]>=Math.max(1,distance[best]*.45))candidates.push(queue[k]);
      regions.push({count:tail,index:best,depth:distance[best],candidates});
    }
    regions.sort((a,b)=>b.count-a.count);
    for(const region of regions.slice(0,label===1?4:8)){
      if(label===1&&regions[0].count>=16&&region.count<16)continue;
      chosen.push([region.index%width,Math.floor(region.index/width)]);labels.push(label===1?1:0);
      // Several well-separated INTERIOR seeds prevent selecting just a detail
      // (a car door/trunk), while excluding the uncertain brush fringe.
      const picked=[region.index],spacing=Math.max(12,Math.min(width,height)/10)**2;
      const squared=(a,b)=>(a%width-b%width)**2+(Math.floor(a/width)-Math.floor(b/width))**2;
      while(picked.length<(label===1?3:2)&&chosen.length<24){
        let next=-1,farthest=0;
        for(const candidate of region.candidates){const d=Math.min(...picked.map(i=>squared(i,candidate)));if(d>farthest){farthest=d;next=candidate;}}
        if(next<0||farthest<spacing)break;
        picked.push(next);chosen.push([next%width,Math.floor(next/width)]);labels.push(label===1?1:0);
      }
    }
  }
  if(!labels.includes(1))throw new Error('Кистью «Сохранить объект» отметьте видимую часть нужного объекта');
  const scale=1024/Math.max(width,height),resizedWidth=square?1024:Math.max(1,Math.round(width*scale)),resizedHeight=square?1024:Math.max(1,Math.round(height*scale));
  const points=new Float32Array(chosen.flatMap(([x,y])=>[x*resizedWidth/width,y*resizedHeight/height]));
  return {points,labels:new Int32Array(labels),resizedWidth,resizedHeight};
}

export function prepareSamImage(rgba,width,height){
  if(width<1||height<1||width>1024||height>1024||rgba?.length!==width*height*4)throw new Error('Некорректный вход нейросети');
  const n=1024*1024,input=new Float32Array(3*n),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let k=0;k<3;k++){
    const i=(y*width+x)*4,alpha=rgba[i+3]/255;
    input[k*n+y*1024+x]=((rgba[i+k]*alpha+255*(1-alpha))/255-mean[k])/std[k];
  }
  return input;
}

function sample(values,offset,x,y){
  x=Math.max(0,Math.min(255,x));y=Math.max(0,Math.min(255,y));
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(255,x0+1),y1=Math.min(255,y0+1),fx=x-x0,fy=y-y0;
  return (values[offset+y0*256+x0]*(1-fx)+values[offset+y0*256+x1]*fx)*(1-fy)+(values[offset+y1*256+x0]*(1-fx)+values[offset+y1*256+x1]*fx)*fy;
}

function cleanContour(binary,prepared){
  const n=65536,visited=new Uint8Array(n),queue=new Int32Array(n),positive=new Set(),negative=new Set();
  for(let p=0;p<prepared.points.length/2;p++){
    const x=Math.max(0,Math.min(255,Math.floor(prepared.points[p*2]/4))),y=Math.max(0,Math.min(255,Math.floor(prepared.points[p*2+1]/4)));
    (prepared.labels?.[p]===0?negative:positive).add(y*256+x);
  }
  // Drop only tiny unprompted speckles. A real paw/tail can be disconnected
  // at model resolution, so a substantial unprompted component must survive.
  // Fill only tiny enclosed pinholes; large/explicitly excluded holes stay.
  for(const foreground of [1,0]){
    visited.fill(0);
    for(let start=0;start<n;start++)if(binary[start]===foreground&&!visited[start]){
      let head=0,tail=1,touchesBorder=false,seed=false,excluded=false;queue[0]=start;visited[start]=1;
      while(head<tail){const i=queue[head++],x=i%256,y=i>>8;
        touchesBorder||=x===0||x===255||y===0||y===255;seed||=positive.has(i);excluded||=negative.has(i);
        for(const j of [x?i-1:-1,x<255?i+1:-1,i-256,i+256])if(j>=0&&j<n&&binary[j]===foreground&&!visited[j]){visited[j]=1;queue[tail++]=j;}
      }
      if(foreground&&!seed&&tail<=16||!foreground&&!touchesBorder&&!excluded&&tail<=16)for(let k=0;k<tail;k++)binary[queue[k]]=foreground?0:1;
    }
  }
  return binary;
}

export function mergeSamMask({width,height,data},prepared,{masks,scores}={},options={}){
  if(!(masks instanceof Float32Array)||masks.length!==3*256*256||!(scores instanceof Float32Array)||scores.length!==3||!masks.every(Number.isFinite)||!scores.every(Number.isFinite))throw new Error('Нейросеть вернула некорректный результат');
  const {resizedWidth,resizedHeight}=prepared;let best=-1,quality=-Infinity;
  for(let k=0;k<3;k++){
    let positives=0,hits=0,negatives=0,excluded=0;
    for(let p=0;p<prepared.points.length/2;p++){
      const inside=sample(masks,k*65536,prepared.points[p*2]/4-.5,prepared.points[p*2+1]/4-.5)>0;
      if(prepared.labels?.[p]===0){negatives++;if(!inside)excluded++;}else{positives++;if(inside)hits++;}
    }
    if(hits===positives&&excluded===negatives&&scores[k]>quality){best=k;quality=scores[k];}
  }
  if(best<0)throw new Error('Подсказки противоречат результату. Отметьте объект зелёной кистью, лишний фон — красной');
  const binary=new Uint8Array(65536);
  for(let i=0;i<binary.length;i++)binary[i]=masks[best*65536+i]>0?1:0;
  cleanContour(binary,prepared);
  const n=width*height,hard=new Uint8Array(n),result=new Uint8ClampedArray(data);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)hard[y*width+x]=sample(binary,0,(x+.5)*resizedWidth/width/4-.5,(y+.5)*resizedHeight/height/4-.5)>=.5?1:0;
  // Distance to the opposite class gives edge-only feathering in ORIGINAL
  // pixels. Confidence/logit noise never makes the object's interior translucent.
  const feather=Math.max(0,Math.min(3,Number(options.feather) || 0)),distance=feather?new Float32Array(n).fill(8):null;
  if(distance){
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x;if(x&&hard[i]!==hard[i-1]||x+1<width&&hard[i]!==hard[i+1]||y&&hard[i]!==hard[i-width]||y+1<height&&hard[i]!==hard[i+width])distance[i]=.5;
      if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);if(y)distance[i]=Math.min(distance[i],distance[i-width]+1);
    }
    for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;if(x+1<width)distance[i]=Math.min(distance[i],distance[i+1]+1);if(y+1<height)distance[i]=Math.min(distance[i],distance[i+width]+1);}
  }
  let kept=0,removed=0;
  for(let i=0;i<n;i++){
    const coverage=distance?Math.max(0,Math.min(1,.5+(hard[i]?1:-1)*distance[i]/feather)):hard[i];
    result[i*4+3]=Math.round(data[i*4+3]*coverage);if(result[i*4+3])kept++;if(result[i*4+3]<data[i*4+3])removed++;
  }
  if(!kept)throw new Error('Нейросеть не нашла объект. Уточните подсказку');
  if(!removed)throw new Error('Нейросеть выделила весь слой. Добавьте красную подсказку на фон');
  return result;
}
