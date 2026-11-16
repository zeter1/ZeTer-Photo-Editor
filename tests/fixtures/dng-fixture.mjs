// Synthetic classic TIFF/DNG fixture with real IFD tags, strip bytes and R/G/B CFA.
export function fixture({le=true,bits=8,compression=1,pattern=[0,1,1,2],truncated=false}={}) {
  const width=4,height=4;
  const entries=[
    [256,4,1,width],[257,4,1,height],[258,3,1,bits],
    [259,3,1,compression],[262,3,1,32803],[273,4,1,0],
    [277,3,1,1],[278,4,1,height],[279,4,1,width*height*(bits/8)],
    [284,3,1,1],[33421,3,2,[2,2]],[33422,1,4,pattern],
    [50706,1,4,[1,4,0,0]],[50714,3,1,0],[50717,3,1,bits===8?200:50000],
    [50728,5,3,0]
  ];
  const ifdSize=2+entries.length*12+4, neutralOffset=8+ifdSize;
  const stripOffset=neutralOffset+24;
  entries.find(e=>e[0]===273)[3]=stripOffset;
  entries.find(e=>e[0]===50728)[3]=neutralOffset;
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
  for(let i=0;i<3;i++){set32(neutralOffset+i*8,1);set32(neutralOffset+i*8+4,1);}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const channel=pattern[(y&1)*2+(x&1)];
    const sample=(bits===8 ? [100,50,25]:[25000,12000,5000])[channel];
    const p=stripOffset+(y*width+x)*(bits/8);
    if(p+bits/8<=b.byteLength){if(bits===8)v.setUint8(p,sample);else set16(p,sample);}
  }
  return b;
}
