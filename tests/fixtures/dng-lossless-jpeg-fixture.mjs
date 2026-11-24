// Deterministic synthetic SOF3/Huffman encoder for pixel tests only.
// This is NOT a camera-authored or externally independent LibRaw reference.
import {fixture} from './dng-fixture.mjs';

export function encodeSyntheticLosslessJpeg({width,height,bits,values,predictor=1,pointTransform=0,components=1,restartInterval=0,scanMode='interleaved',scanOrder=null}) {
  if(![1,2,4].includes(components)||width%components!==0)throw Error('invalid synthetic component layout');
  if(!Number.isInteger(restartInterval)||restartInterval<0||restartInterval>65535)
    throw Error('invalid synthetic restart interval');
  const frameWidth=width/components;
  const out=[0xff,0xd8];
  function marker(id,payload) {
    const length=payload.length+2;
    out.push(0xff,id,length>>8,length&255,...payload);
  }
  marker(0xc3,[bits,height>>8,height&255,frameWidth>>8,frameWidth&255,components,
    ...Array.from({length:components},(_,c)=>[c+1,0x11,0]).flat()]);
  // Two different DC Huffman table IDs test per-component table selection.
  const tableBytes=Array.from({length:16},(_,i)=>i===4?17:0);
  const categories=Array.from({length:17},(_,i)=>i);
  marker(0xc4,[0,...tableBytes,...categories,
    ...(components===1?[]:[1,...tableBytes,...categories])]);
  if(restartInterval)marker(0xdd,[restartInterval>>8,restartInterval&255]);
  if(!['interleaved','planar','paired','mixed'].includes(scanMode) ||
    (['paired','mixed'].includes(scanMode) && components!==4))
    throw Error('invalid synthetic scan mode');
  const order=scanOrder || Array.from({length:components},(_,c)=>c);
  if(order.length!==components || new Set(order).size!==components ||
    order.some(c=>!Number.isInteger(c)||c<0||c>=components))
    throw Error('invalid synthetic scan order');
  const groups=scanMode==='planar'&&components>1
    ? order.map(c=>[c]) : scanMode==='paired'
      ? [order.slice(0,2),order.slice(2,4)] : scanMode==='mixed'
        ? [order.slice(0,1),order.slice(1,3),order.slice(3,4)] : [order];
  const samples=new Uint16Array(width*height);
  let current=0,used=0;
  function pushBit(bit) {
    current=(current<<1)|bit;
    if(++used===8) {
      out.push(current);
      if(current===0xff)out.push(0); // JPEG entropy byte stuffing
      current=0;used=0;
    }
  }
  function pushBits(value,count) {
    for(let i=count-1;i>=0;i--)pushBit((value>>i)&1);
  }
  for(const group of groups) {
    marker(0xda,[group.length,...group.map(c=>[c+1,(c&1)<<4]).flat(),
      predictor,0,pointTransform]);
    current=0;used=0;
  for(let y=0;y<height;y++)for(let x=0;x<frameWidth;x++){
    const mcu=y*frameWidth+x;
    if(restartInterval&&mcu>0&&mcu%restartInterval===0){
      if(used)for(let i=8-used;i>0;i--)pushBit(1);
      out.push(0xff,0xd0+((mcu/restartInterval-1)%8));
    }
    for(const c of group) {
    const index=mcu*components+c,value=values[index]>>pointTransform;
    samples[index]=value;
    const left=x?samples[index-components]:0;
    const above=y?samples[index-width]:0;
    const diagonal=x&&y?samples[index-width-components]:0;
    let estimate;
    if((restartInterval&&mcu%restartInterval===0)||(!x&&!y))estimate=1<<(bits-pointTransform-1);
    else if(!y)estimate=left;
    else if(!x)estimate=above;
    else switch(predictor) {
      case 1:estimate=left;break;
      case 2:estimate=above;break;
      case 3:estimate=diagonal;break;
      case 4:estimate=left+above-diagonal;break;
      case 5:estimate=left+((above-diagonal)>>1);break;
      case 6:estimate=above+((left-diagonal)>>1);break;
      case 7:estimate=(left+above)>>1;break;
      default:throw Error('invalid fixture predictor');
    }
    const diff=value-estimate;
    const category=diff===0?0:Math.floor(Math.log2(Math.abs(diff)))+1;
    if(category>16 || (category===16 && diff!==-32768))
      throw Error('fixture difference outside lossless JPEG precision');
    pushBits(category,5);
    // JPEG lossless category 16 means -32768 and carries no magnitude bits.
    if(category&&category!==16)pushBits(diff>=0?diff:diff+((1<<category)-1),category);
    }
  }
  if(used) {
    const padding=8-used;
    for(let i=0;i<padding;i++)pushBit(1);
  }
  }
  out.push(0xff,0xd9);
  return Uint8Array.from(out);
}

export function losslessJpegDngFixture({le=true,bits=12,width=4,height=4,
  samples=null,pattern=[0,1,1,2],predictor=1,pointTransform=0,components=1,restartInterval=0,scanMode='interleaved',scanOrder=null,...options}={}) {
  const pixels=Array.from({length:width*height},(_,i)=>{
    const x=i%width,y=Math.floor(i/width),channel=pattern[(y&1)*2+(x&1)];
    const preset=bits===8?[100,50,25]:[800,400,200];
    return typeof samples==='function'?samples(x,y,channel):
      (samples||preset)[channel];
  });
  const jpeg=encodeSyntheticLosslessJpeg({width,height,bits,values:pixels,predictor,pointTransform,components,restartInterval,scanMode,scanOrder});
  const raw=fixture({le,bits:bits===8?8:16,compression:7,width,height,
    pattern,samples:bits===8?[100,50,25]:[800,400,200],
    whiteLevel:options.whiteLevel??(2**bits-1),...options});
  const view=new DataView(raw),entries=view.getUint16(8,le);
  function entry(tag){
    for(let i=0;i<entries;i++) {
      const pos=10+i*12;
      if(view.getUint16(pos,le)===tag)return pos;
    }
    throw Error('no synthetic TIFF tag '+tag);
  }
  const offset=view.getUint32(entry(273)+8,le);
  const result=new ArrayBuffer(offset+jpeg.length);
  new Uint8Array(result).set(new Uint8Array(raw,0,offset));
  const updated=new DataView(result);
  updated.setUint16(entry(258)+8,bits,le);
  updated.setUint32(entry(279)+8,jpeg.length,le);
  new Uint8Array(result,offset).set(jpeg);
  return result;
}


// Synthetic TIFF tile layout: replaces the fixture's strip-only IFD entries
// with TileWidth/TileLength/TileOffsets/TileByteCounts. Edge tiles are padded.
export function tiledLosslessJpegDngFixture({le=true,bits=12,width=8,height=6,
  tileWidth=4,tileLength=3,components=1,restartInterval=0,predictor=1,
  scanMode='interleaved',scanOrder=null,samples=null,pattern=[0,1,1,2],...options}={}) {
  if(tileWidth%components || tileWidth<1 || tileLength<1)throw Error('invalid tile fixture geometry');
  const sample=(x,y)=> {
    if(x>=width||y>=height)return 0;
    const channel=pattern[(y&1)*2+(x&1)];
    return typeof samples==='function'?samples(x,y,channel):
      (samples||[800,400,200])[channel];
  };
  const tileCols=Math.ceil(width/tileWidth),tileRows=Math.ceil(height/tileLength);
  const tiles=[];
  for(let ty=0;ty<tileRows;ty++)for(let tx=0;tx<tileCols;tx++){
    const values=[];
    for(let y=0;y<tileLength;y++)for(let x=0;x<tileWidth;x++)
      values.push(sample(tx*tileWidth+x,ty*tileLength+y));
    tiles.push(encodeSyntheticLosslessJpeg({width:tileWidth,height:tileLength,bits,values,
      predictor,components,restartInterval,scanMode,scanOrder}));
  }
  const base=fixture({le,bits:bits===8?8:16,compression:7,width,height,pattern,
    whiteLevel:options.whiteLevel??(2**bits-1),samples,...options});
  const original=new DataView(base);
  const n=original.getUint16(8,le);
  const entry=tag=>{
    for(let i=0;i<n;i++){
      const p=10+i*12;
      if(original.getUint16(p,le)===tag)return p;
    }
    throw Error('missing original IFD tag '+tag);
  };
  const widthEntry=entry(284),heightEntry=entry(278);
  const offsetsEntry=entry(273),countsEntry=entry(279);
  const bitsEntry=entry(258);
  const prefix=original.getUint32(offsetsEntry+8,le);
  const tableStart=(prefix+3)&~3, count=tiles.length;
  const offsetsStart=tableStart,countsStart=count>1?tableStart+count*4:tableStart;
  let payloadStart=tableStart+(count>1?count*8:0);
  const total=payloadStart+tiles.reduce((sum,b)=>sum+b.length,0);
  const buffer=new ArrayBuffer(total),data=new Uint8Array(buffer);
  data.set(new Uint8Array(base,0,prefix));
  const view=new DataView(buffer);
  const set16=(p,v)=>view.setUint16(p,v,le);
  const set32=(p,v)=>view.setUint32(p,v,le);
  set16(widthEntry,322);set16(widthEntry+2,4);set32(widthEntry+8,tileWidth);
  set16(heightEntry,323);set32(heightEntry+8,tileLength);
  set16(offsetsEntry,324);set32(offsetsEntry+4,count);
  set16(countsEntry,325);set32(countsEntry+4,count);
  set16(bitsEntry+8,bits);
  if(count>1){set32(offsetsEntry+8,offsetsStart);set32(countsEntry+8,countsStart);}
  let at=payloadStart;
  for(let i=0;i<count;i++){
    if(count===1){set32(offsetsEntry+8,at);set32(countsEntry+8,tiles[i].length);}
    else {set32(offsetsStart+i*4,at);set32(countsStart+i*4,tiles[i].length);}
    data.set(tiles[i],at);at+=tiles[i].length;
  }
  return buffer;
}
