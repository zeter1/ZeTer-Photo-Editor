// Synthetic *TIFF-formatted* DNG fixture, not camera-authored RAW provenance.
export function fixture({le=true,bits=8,compression=1,pattern=[0,1,1,2],truncated=false,
  width=4,height=4,orientation=null,activeArea=null,matrix1=null,matrix2=null,
  illuminant1=21,illuminant2=17,neutral=[1,1,1],samples=null,
  defaultCropOrigin=null,defaultCropSize=null,cropOriginType=5,cropSizeType=5,defaultScale=null}={}){
  const entries=[
    [256,4,1,width],[257,4,1,height],[258,3,1,bits],
    [259,3,1,compression],[262,3,1,32803],[273,4,1,0],
    [277,3,1,1],[278,4,1,height],[279,4,1,width*height*(bits/8)],
    [284,3,1,1],[33421,3,2,[2,2]],[33422,1,4,pattern],
    [50706,1,4,[1,4,0,0]],[50714,3,1,0],[50717,3,1,bits===8?200:50000],
    [50728,5,3,0]
  ];
  if(orientation!==null)entries.push([274,3,1,orientation]);
  if(activeArea!==null)entries.push([50829,4,4,0]);
  if(defaultScale!==null)entries.push([50718,5,2,0]);
  if(defaultCropOrigin!==null)entries.push([50719,cropOriginType,2,cropOriginType===3?defaultCropOrigin:0]);
  if(defaultCropSize!==null)entries.push([50720,cropSizeType,2,cropSizeType===3?defaultCropSize:0]);
  if(matrix1!==null)entries.push([50721,10,9,0],[50778,3,1,illuminant1]);
  if(matrix2!==null)entries.push([50722,10,9,0],[50779,3,1,illuminant2]);
  const ifdSize=2+entries.length*12+4;
  let next=8+ifdSize;
  const allocate=(tag,size)=>{
    const entry=entries.find(e=>e[0]===tag);
    if(!entry)return null;
    const offset=next;
    entry[3]=offset;
    next+=size;
    return offset;
  };
  const neutralOffset=allocate(50728,24);
  const activeOffset=activeArea===null?null:allocate(50829,16);
  const scaleOffset=defaultScale===null?null:allocate(50718,16);
  const cropOriginOffset=defaultCropOrigin===null||cropOriginType===3?null:allocate(50719,cropOriginType===5?16:8);
  const cropSizeOffset=defaultCropSize===null||cropSizeType===3?null:allocate(50720,cropSizeType===5?16:8);
  const matrix1Offset=matrix1===null?null:allocate(50721,72);
  const matrix2Offset=matrix2===null?null:allocate(50722,72);
  const stripOffset=next;
  entries.find(e=>e[0]===273)[3]=stripOffset;
  const b=new ArrayBuffer(stripOffset+width*height*(bits/8)-(truncated?1:0));
  const v=new DataView(b);
  const set16=(p,n)=>v.setUint16(p,n,le);
  const set32=(p,n)=>v.setUint32(p,n,le);
  v.setUint8(0,le?73:77);v.setUint8(1,le?73:77);set16(2,42);set32(4,8);
  set16(8,entries.length);
  entries.forEach(([tag,type,count,value],i)=>{
    const p=10+i*12;set16(p,tag);set16(p+2,type);set32(p+4,count);
    if(Array.isArray(value)){
      if(type===3)value.forEach((n,j)=>set16(p+8+j*2,n));
      else value.forEach((n,j)=>v.setUint8(p+8+j,n));
    }else if(type===3)set16(p+8,value);
    else set32(p+8,value);
  });
  set32(8+2+entries.length*12,0);
  for(let i=0;i<3;i++){
    set32(neutralOffset+i*8,Math.round(neutral[i]*100000));
    set32(neutralOffset+i*8+4,100000);
  }
  if(activeOffset!==null)for(let i=0;i<4;i++)set32(activeOffset+i*4,activeArea[i]);
  function writeCrop(offset,values,type){
    if(offset===null)return;
    for(let i=0;i<2;i++){
      if(type===4)set32(offset+i*4,values[i]);
      else if(type===5){
        set32(offset+i*8,Math.round(values[i]*1000));
        set32(offset+i*8+4,1000);
      }
    }
  }
  writeCrop(scaleOffset,defaultScale,5);
  writeCrop(cropOriginOffset,defaultCropOrigin,cropOriginType);
  writeCrop(cropSizeOffset,defaultCropSize,cropSizeType);
  function writeMatrix(offset,m){
    if(offset===null)return;
    for(let i=0;i<9;i++){
      v.setInt32(offset+i*8,Math.round(m[i]*100000),le);
      v.setInt32(offset+i*8+4,100000,le);
    }
  }
  writeMatrix(matrix1Offset,matrix1);
  writeMatrix(matrix2Offset,matrix2);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const channel=pattern[(y&1)*2+(x&1)];
    const sample=typeof samples==='function'?samples(x,y,channel):
      (samples||(bits===8?[100,50,25]:[25000,12000,5000]))[channel];
    const p=stripOffset+(y*width+x)*(bits/8);
    if(p+bits/8<=b.byteLength){if(bits===8)v.setUint8(p,sample);else set16(p,sample);}
  }
  return b;
}
