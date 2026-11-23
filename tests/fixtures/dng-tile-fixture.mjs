// Synthetic TIFF tiled DNG. The complete TIFF IFD and real SOF3 tile entropy
// are independently assembled from the strip fixture; not camera-authored RAW.
import {fixture} from './dng-fixture.mjs';

export function tiledDng(options={},tileOptions={}){
  const width=options.width||8,height=options.height||6,bits=options.bits||8;
  const tileWidth=tileOptions.tileWidth||4,tileLength=tileOptions.tileLength||4;
  const compression=tileOptions.compression??7;
  if(tileWidth%2||tileLength%2||compression!==1||
    !(compression===1?[8,10,12,14,16]:[8,16]).includes(bits))
    throw Error('Tile fixture requires even Bayer tiles and supported bit depth');
  const pattern=options.pattern||[0,1,1,2];
  const source=fixture({...options,width,height,bits,compression:1});
  const sourceView=new DataView(source);
  const le=sourceView.getUint8(0)===73;
  const get16=(p)=>sourceView.getUint16(p,le);
  const get32=(p)=>sourceView.getUint32(p,le);
  const set16=(v,p,n)=>v.setUint16(p,n,le);
  const set32=(v,p,n)=>v.setUint32(p,n,le);
  const chunks=[];
  for(let ty=0;ty<Math.ceil(height/tileLength);ty++)
    for(let tx=0;tx<Math.ceil(width/tileWidth);tx++){
      const offsetX=tx*tileWidth,offsetY=ty*tileLength;
      const sample=(x,y,c)=>{
        const gx=Math.min(width-1,offsetX+x),gy=Math.min(height-1,offsetY+y);
        const channel=pattern[(gy&1)*2+(gx&1)];
        const generator=options.samples;
        const value=typeof generator==='function' ? generator(gx,gy,channel) :
          (generator||(bits===8?[100,50,25]:[25000,12000,5000]))[channel];
        return value;
      };
      {
        const bytesPerRow=Math.ceil(tileWidth*bits/8);
        const data=new Uint8Array(bytesPerRow*tileLength),v=new DataView(data.buffer);
        for(let y=0;y<tileLength;y++)for(let x=0;x<tileWidth;x++){
          const c=pattern[(y&1)*2+(x&1)],value=sample(x,y,c),p=y*bytesPerRow+x*(bits/8);
          if(bits===8)v.setUint8(p,value);
          else if(bits===16)v.setUint16(p,value,le);
          else for(let bit=0;bit<bits;bit++){
            const index=y*bytesPerRow+((x*bits+bit)>>3);
            if((value>>(bits-1-bit))&1)data[index]|=1<<(7-((x*bits+bit)&7));
          }
        }
        chunks.push(data);
      }
    }
  const originIfd=get32(4),entryCount=get16(originIfd);
  const entries=[];
  for(let i=0;i<entryCount;i++){
    const p=originIfd+2+i*12,tag=get16(p);
    if([273,278,279].includes(tag))continue;
    entries.push({tag,type:get16(p+2),count:get32(p+4),
      raw:new Uint8Array(source,p+8,4).slice()});
  }
  for(const tag of [322,323,324,325])
    entries.push({tag,type:4,count:[322,323].includes(tag)?1:chunks.length,
      raw:new Uint8Array(4)});
  entries.sort((a,b)=>a.tag-b.tag);
  const newIfd=source.byteLength,ifdSize=2+entries.length*12+4;
  const offsetTable=newIfd+ifdSize,countTable=offsetTable+chunks.length*4;
  const dataStart=countTable+chunks.length*4;
  const finalBytes=dataStart+chunks.reduce((sum,chunk)=>sum+chunk.length,0);
  const result=new Uint8Array(finalBytes),v=new DataView(result.buffer);
  result.set(new Uint8Array(source));
  set32(v,4,newIfd);set16(v,newIfd,entries.length);
  let dataAt=dataStart;
  const offsets=[];
  for(const chunk of chunks){
    offsets.push(dataAt);result.set(chunk,dataAt);dataAt+=chunk.length;
  }
  entries.forEach((entry,i)=>{
    const p=newIfd+2+i*12;
    set16(v,p,entry.tag);set16(v,p+2,entry.type);set32(v,p+4,entry.count);
    if(entry.tag===259)set16(v,p+8,compression);
    else if(entry.tag===322)set32(v,p+8,tileWidth);
    else if(entry.tag===323)set32(v,p+8,tileLength);
    else if(entry.tag===324||entry.tag===325){
      const values=entry.tag===324?offsets:chunks.map(chunk=>chunk.length);
      if(chunks.length===1)set32(v,p+8,values[0]);
      else set32(v,p+8,entry.tag===324?offsetTable:countTable);
    }else result.set(entry.raw,p+8);
  });
  set32(v,newIfd+2+entries.length*12,0);
  if(chunks.length>1)
    for(let i=0;i<chunks.length;i++){
      set32(v,offsetTable+i*4,offsets[i]);
      set32(v,countTable+i*4,chunks[i].length);
    }
  return {buffer:result.buffer,uncompressed:source,tileCount:chunks.length,
    tileWidth,tileLength,ifd:newIfd,offsets};
}
