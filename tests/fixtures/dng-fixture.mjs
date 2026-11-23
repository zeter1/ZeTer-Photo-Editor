// Synthetic *TIFF-formatted* DNG fixture, not camera-authored RAW provenance.
export function fixture({le=true,bits=8,compression=1,pattern=[0,1,1,2],truncated=false,
  width=4,height=4,orientation=null,activeArea=null,matrix1=null,matrix2=null,
  illuminant1=21,illuminant2=17,neutral=[1,1,1],whiteXY=null,samples=null,
  defaultCropOrigin=null,defaultCropSize=null,cropOriginType=5,cropSizeType=5,defaultScale=null,
  linearizationTable=null,blackLevel=0,blackRepeatDim=null,blackType=3,whiteLevel=null,
  blackDeltaH=null,blackDeltaV=null,fillOrder=null,forward1=null,forward2=null,calibration1=null,calibration2=null,
  analogBalance=null,cameraSignature=null,profileSignature=null,baselineExposure=null,baselineExposureOffset=null}={}){
  const rowBytes=Math.ceil(width*bits/8);
  const blackValues=Array.isArray(blackLevel)?blackLevel:[blackLevel];
  const blackBytes=blackValues.length*({3:2,4:4,5:8}[blackType]||2);
  const blackExternal=blackBytes>4;
  const entries=[
    [256,4,1,width],[257,4,1,height],[258,3,1,bits],
    [259,3,1,compression],[262,3,1,32803],[273,4,1,0],
    [277,3,1,1],[278,4,1,height],[279,4,1,rowBytes*height],
    [284,3,1,1],[33421,3,2,[2,2]],[33422,1,4,pattern],
    [50706,1,4,[1,4,0,0]],[50714,blackType,blackValues.length,blackExternal?0:(blackValues.length===1?blackValues[0]:blackValues)],[50717,3,1,whiteLevel??(bits===8?200:bits===16?50000:2**bits-1)],
    ...(neutral===null?[]:[[50728,5,3,0]]),
    ...(whiteXY===null?[]:[[50729,5,2,0]])
  ];
  if(fillOrder!==null)entries.push([266,3,1,fillOrder]);
  if(blackRepeatDim!==null)entries.push([50713,3,2,blackRepeatDim]);
  if(blackDeltaH!==null)entries.push([50715,10,blackDeltaH.length,0]);
  if(blackDeltaV!==null)entries.push([50716,10,blackDeltaV.length,0]);
  if(orientation!==null)entries.push([274,3,1,orientation]);
  if(activeArea!==null)entries.push([50829,4,4,0]);
  if(defaultScale!==null)entries.push([50718,5,2,0]);
  if(linearizationTable!==null)entries.push([50712,3,linearizationTable.length,
    linearizationTable.length<=2?linearizationTable:0]);
  if(defaultCropOrigin!==null)entries.push([50719,cropOriginType,2,cropOriginType===3?defaultCropOrigin:0]);
  if(defaultCropSize!==null)entries.push([50720,cropSizeType,2,cropSizeType===3?defaultCropSize:0]);
  if(matrix1!==null)entries.push([50721,10,9,0],[50778,3,1,illuminant1]);
  if(matrix2!==null)entries.push([50722,10,9,0],[50779,3,1,illuminant2]);
  if(forward1!==null)entries.push([50964,10,9,0]);
  if(forward2!==null)entries.push([50965,10,9,0]);
  if(calibration1!==null)entries.push([50723,10,9,0]);
  if(calibration2!==null)entries.push([50724,10,9,0]);
  if(analogBalance!==null)entries.push([50727,5,3,0]);
  if(cameraSignature!==null)entries.push([50931,2,cameraSignature.length+1,0]);
  if(profileSignature!==null)entries.push([50932,2,profileSignature.length+1,0]);
  if(baselineExposure!==null)entries.push([50730,10,1,0]);
  if(baselineExposureOffset!==null)entries.push([51109,10,1,0]);
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
  const neutralOffset=neutral===null?null:allocate(50728,24);
  const whiteXYOffset=whiteXY===null?null:allocate(50729,16);
  const blackOffset=blackExternal?allocate(50714,blackBytes):null;
  const activeOffset=activeArea===null?null:allocate(50829,16);
  const deltaHOffset=blackDeltaH===null?null:allocate(50715,blackDeltaH.length*8);
  const deltaVOffset=blackDeltaV===null?null:allocate(50716,blackDeltaV.length*8);
  const scaleOffset=defaultScale===null?null:allocate(50718,16);
  const linearizationOffset=linearizationTable===null||linearizationTable.length<=2?
    null:allocate(50712,linearizationTable.length*2);
  const cropOriginOffset=defaultCropOrigin===null||cropOriginType===3?null:allocate(50719,cropOriginType===5?16:8);
  const cropSizeOffset=defaultCropSize===null||cropSizeType===3?null:allocate(50720,cropSizeType===5?16:8);
  const matrix1Offset=matrix1===null?null:allocate(50721,72);
  const matrix2Offset=matrix2===null?null:allocate(50722,72);
  const forward1Offset=forward1===null?null:allocate(50964,72);
  const forward2Offset=forward2===null?null:allocate(50965,72);
  const calibration1Offset=calibration1===null?null:allocate(50723,72);
  const calibration2Offset=calibration2===null?null:allocate(50724,72);
  const analogBalanceOffset=analogBalance===null?null:allocate(50727,24);
  const cameraSignatureOffset=cameraSignature===null?null:allocate(50931,cameraSignature.length+1);
  const profileSignatureOffset=profileSignature===null?null:allocate(50932,profileSignature.length+1);
  const baselineExposureValueOffset=baselineExposure===null?null:allocate(50730,8);
  const profileOffsetValueOffset=baselineExposureOffset===null?null:allocate(51109,8);
  const stripOffset=next;
  entries.find(e=>e[0]===273)[3]=stripOffset;
  const b=new ArrayBuffer(stripOffset+rowBytes*height-(truncated?1:0));
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
    }else if(type===3&&count===1)set16(p+8,value);
    else set32(p+8,value);
  });
  set32(8+2+entries.length*12,0);
  if(neutralOffset!==null)for(let i=0;i<3;i++){
    set32(neutralOffset+i*8,Math.round(neutral[i]*100000));
    set32(neutralOffset+i*8+4,100000);
  }
  if(whiteXYOffset!==null)for(let i=0;i<2;i++){
    set32(whiteXYOffset+i*8,Math.round(whiteXY[i]*1000000));
    set32(whiteXYOffset+i*8+4,1000000);
  }
  if(blackOffset!==null)for(let i=0;i<blackValues.length;i++){
    const value=blackValues[i];
    if(blackType===3)set16(blackOffset+i*2,value);
    else if(blackType===4)set32(blackOffset+i*4,value);
    else if(blackType===5){set32(blackOffset+i*8,Math.round(value*1000));set32(blackOffset+i*8+4,1000);}
  }
  if(activeOffset!==null)for(let i=0;i<4;i++)set32(activeOffset+i*4,activeArea[i]);
  function writeDelta(offset,values){
    if(offset===null)return;
    values.forEach((value,i)=>{
      v.setInt32(offset+i*8,Math.round(value*1000),le);
      v.setInt32(offset+i*8+4,1000,le);
    });
  }
  writeDelta(deltaHOffset,blackDeltaH);
  writeDelta(deltaVOffset,blackDeltaV);
  if(baselineExposureValueOffset!==null){
    v.setInt32(baselineExposureValueOffset,Math.round(baselineExposure*1000),le);
    v.setInt32(baselineExposureValueOffset+4,1000,le);
  }
  if(profileOffsetValueOffset!==null){
    v.setInt32(profileOffsetValueOffset,Math.round(baselineExposureOffset*1000),le);
    v.setInt32(profileOffsetValueOffset+4,1000,le);
  }
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
  if(linearizationOffset!==null)linearizationTable.forEach((value,i)=>set16(linearizationOffset+i*2,value));
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
  writeMatrix(forward1Offset,forward1);
  writeMatrix(forward2Offset,forward2);
  writeMatrix(calibration1Offset,calibration1);
  writeMatrix(calibration2Offset,calibration2);
  if(analogBalanceOffset!==null)analogBalance.forEach((value,i)=>{
    set32(analogBalanceOffset+i*8,Math.round(value*100000));
    set32(analogBalanceOffset+i*8+4,100000);
  });
  for(const [offset,value] of [[cameraSignatureOffset,cameraSignature],[profileSignatureOffset,profileSignature]]){
    if(offset!==null){
      for(let i=0;i<value.length;i++)v.setUint8(offset+i,value.charCodeAt(i));
      v.setUint8(offset+value.length,0);
    }
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const channel=pattern[(y&1)*2+(x&1)];
    const sample=typeof samples==='function'?samples(x,y,channel):
      (samples||(bits===8?[100,50,25]:[25000,12000,5000]))[channel];
    const p=stripOffset+y*rowBytes+x*(bits/8);
    if(bits===8 && p<b.byteLength)v.setUint8(p,sample);
    else if(bits===16 && p+2<=b.byteLength)set16(p,sample);
    else if([10,12,14].includes(bits))for(let bit=0;bit<bits;bit++){
      const absoluteBit=x*bits+bit,at=stripOffset+y*rowBytes+(absoluteBit>>3);
      if(at>=b.byteLength)break;
      if((sample>>(bits-1-bit))&1)v.setUint8(at,v.getUint8(at)|(1<<(7-(absoluteBit&7))));
    }
  }
  return b;
}
