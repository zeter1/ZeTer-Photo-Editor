import {dngCameraToLinearSrgb,applyDngColorMatrix} from './dng-color.js';

// Bounded, dependency-free TIFF/DNG Bayer reader for offline file:// imports.
// Only classic TIFF (II/MM), uncompressed 8/16-bit single-plane CFA strips.
// Unsupported RAW layouts fail explicitly instead of falling back to browser image decoders.
const dng_MAX_FILE_BYTES = 48 * 1024 * 1024;
const dng_MAX_PIXELS = 16_000_000;
const dng_TYPE_SIZE = { 1:1, 2:1, 3:2, 4:4, 5:8, 6:1, 7:1, 8:2, 9:4, 10:8, 11:4, 12:8 };
const dng_TAG = {
  width:256, height:257, bits:258, compression:259, photometric:262,
  stripOffsets:273, orientation:274, samples:277, rowsPerStrip:278, stripBytes:279, planar:284,
  subIfds:330, cfaDims:33421, cfaPattern:33422,
  dngVersion:50706, linearization:50712, blackRepeat:50713,
  black:50714, white:50717, neutral:50728, activeArea:50829,
  defaultScale:50718, defaultCropOrigin:50719, defaultCropSize:50720,
  colorMatrix1:50721, colorMatrix2:50722, cameraCalibration1:50723,
  cameraCalibration2:50724, analogBalance:50727,
  illuminant1:50778, illuminant2:50779, forwardMatrix1:50964, forwardMatrix2:50965,
};
function dng_invalid(message) { throw new Error('DNG: ' + message); }
function dng_requireThat(ok, message) { if (!ok) dng_invalid(message); }
function dng_finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function dng_clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

export function inspectDng(buffer) {
  dng_requireThat(buffer instanceof ArrayBuffer, 'ожидаются бинарные данные ArrayBuffer');
  dng_requireThat(buffer.byteLength >= 8 && buffer.byteLength <= dng_MAX_FILE_BYTES, 'недопустимый размер RAW-файла (максимум 48 МиБ)');
  const view = new DataView(buffer);
  const a = view.getUint8(0), b = view.getUint8(1);
  dng_requireThat((a === 73 && b === 73) || (a === 77 && b === 77), 'неверная сигнатура TIFF');
  const le = a === 73;
  const u16 = off => { dng_requireThat(off >= 0 && off + 2 <= buffer.byteLength, 'усечённый TIFF'); return view.getUint16(off,le); };
  const u32 = off => { dng_requireThat(off >= 0 && off + 4 <= buffer.byteLength, 'усечённый TIFF'); return view.getUint32(off,le); };
  dng_requireThat(u16(2) === 42, 'BigTIFF или неизвестный TIFF не поддерживается');
  const entriesAt = offset => {
    dng_requireThat(Number.isSafeInteger(offset) && offset >= 8 && offset + 2 <= buffer.byteLength, 'неверный IFD offset');
    const length=u16(offset);
    dng_requireThat(length <= 512 && offset + 2 + length * 12 + 4 <= buffer.byteLength, 'повреждённая или слишком большая IFD');
    const tags=new Map();
    for(let i=0;i<length;i++){
      const pos=offset+2+i*12;
      const tag=u16(pos), type=u16(pos+2), count=u32(pos+4);
      const size=dng_TYPE_SIZE[type];
      if(!size || count > dng_MAX_PIXELS){
        // An invalid crop/scale tag must never silently become an uncropped preview.
        if([dng_TAG.defaultScale,dng_TAG.defaultCropOrigin,dng_TAG.defaultCropSize].includes(tag))
          dng_invalid('invalid DefaultCrop/DefaultScale TIFF tag '+tag);
        // Never interpret a malformed calibration tag as an uncalibrated image.
        if([50721,50722,50723,50724,50727,50728,50778,50779,50964,50965].includes(tag))
          dng_invalid('неподдерживаемый тип или count цветового TIFF tag '+tag);
        continue;
      }
      const byteLength=count*size;
      dng_requireThat(Number.isSafeInteger(byteLength) && byteLength <= dng_MAX_FILE_BYTES, 'недопустимый TIFF tag');
      const start=byteLength <= 4 ? pos+8 : u32(pos+8);
      dng_requireThat(start >= 0 && start + byteLength <= buffer.byteLength, 'TIFF tag за границами файла');
      if(!tags.has(tag))tags.set(tag,{tag,type,count,start});
    }
    return {tags,next:u32(offset+2+length*12)};
  };
  const values = (tags, tag, limit=64) => {
    const e=tags.get(tag);
    if(!e) return null;
    dng_requireThat(e.count <= limit, 'слишком длинный TIFF tag ' + tag);
    const out=[];
    for(let i=0;i<e.count;i++){
      const p=e.start+i*dng_TYPE_SIZE[e.type];let value;
      if(e.type===1||e.type===7) value=view.getUint8(p);
      else if(e.type===3) value=view.getUint16(p,le);
      else if(e.type===4) value=view.getUint32(p,le);
      else if(e.type===5||e.type===10){
        const numerator=e.type===5 ? view.getUint32(p,le) : view.getInt32(p,le);
        const denominator=e.type===5 ? view.getUint32(p+4,le) : view.getInt32(p+4,le);
        dng_requireThat(denominator !== 0,'нулевой знаменатель TIFF rational');
        value=numerator/denominator;
      } else if(e.type===8) value=view.getInt16(p,le);
      else if(e.type===9) value=view.getInt32(p,le);
      else if(e.type===11) value=view.getFloat32(p,le);
      else if(e.type===12) value=view.getFloat64(p,le);
      else dng_invalid('неподдерживаемый тип TIFF tag ' + tag);
      dng_requireThat(dng_finite(value), 'нечисловое значение TIFF tag');
      out.push(value);
    }
    return out;
  };
  const single = (tags,tag,fallback) => values(tags,tag,1)?.[0] ?? fallback;
  const visited=new Set(), pending=[u32(4)], ifds=[];
  while(pending.length && visited.size < 20) {
    const offset=pending.shift();
    if(!offset || visited.has(offset)) continue;
    visited.add(offset);
    const {tags,next}=entriesAt(offset);
    ifds.push(tags);
    if(next) pending.push(next);
    const subs=values(tags,dng_TAG.subIfds,16) || [];
    for(const sub of subs) if(Number.isInteger(sub) && sub) pending.push(sub);
  }
  dng_requireThat(ifds.length > 0 && ifds[0].has(dng_TAG.dngVersion), 'нет обязательного DNGVersion: это не DNG');
  const dngVersion=values(ifds[0],dng_TAG.dngVersion,4);
  dng_requireThat(dngVersion.length === 4 && dngVersion[0] === 1, 'неподдерживаемая версия DNG');
  const tags=ifds.find(t=>single(t,dng_TAG.photometric,0)===32803);
  dng_requireThat(tags, 'нет Bayer CFA IFD (PhotometricInterpretation=32803)');
  const width=single(tags,dng_TAG.width,0), height=single(tags,dng_TAG.height,0);
  dng_requireThat(Number.isInteger(width) && Number.isInteger(height) && width >= 2 && height >= 2 &&
    width <= 12000 && height <= 12000 && width*height <= dng_MAX_PIXELS, 'небезопасные размеры Bayer изображения');
  const bits=values(tags,dng_TAG.bits,3);
  dng_requireThat(bits?.length===1 && (bits[0]===8 || bits[0]===16), 'поддерживаются только 8/16-bit uncompressed Bayer (не packed RAW)');
  dng_requireThat(single(tags,dng_TAG.compression,1)===1, 'сжатые DNG не поддерживаются');
  dng_requireThat(single(tags,dng_TAG.samples,1)===1 && single(tags,dng_TAG.planar,1)===1, 'многоканальный CFA не поддерживается');
  const patternDims=values(tags,dng_TAG.cfaDims,2);
  const pattern=values(tags,dng_TAG.cfaPattern,16);
  dng_requireThat(patternDims?.[0]===2 && patternDims?.[1]===2 &&
    pattern?.length===4 && pattern.filter(c=>c===0).length===1 &&
    pattern.filter(c=>c===1).length===2 && pattern.filter(c=>c===2).length===1,
    'поддерживается только 2×2 Bayer RGGB/BGGR/GRBG/GBRG');
  dng_requireThat(!tags.has(dng_TAG.linearization), 'DNG LinearizationTable пока не поддерживается');
  const blackRepeat=values(tags,dng_TAG.blackRepeat,2) || [1,1];
  dng_requireThat((blackRepeat[0]===1&&blackRepeat[1]===1)||
    (blackRepeat[0]===2&&blackRepeat[1]===2), 'неподдерживаемая сетка BlackLevel');
  const black=values(tags,dng_TAG.black,4) || [0];
  dng_requireThat(black.length===blackRepeat[0]*blackRepeat[1], 'неподдерживаемый BlackLevel');
  const white=values(tags,dng_TAG.white,4) || [2**bits[0]-1];
  dng_requireThat(white.length===1, 'неподдерживаемый WhiteLevel');
  dng_requireThat(white[0]>0 && white[0]<=2**bits[0]-1 && black.every(v=>v>=0 && v<white[0]),
    'WhiteLevel/BlackLevel вне диапазона');
  const neutral=values(ifds[0],dng_TAG.neutral,3) || values(tags,dng_TAG.neutral,3) || [1,1,1];
  dng_requireThat(neutral.length===3 && neutral.every(v=>v>0 && dng_finite(v)), 'ошибочный AsShotNeutral');
  // Colour tags live in IFD 0 or the CFA IFD, never rely on a thumbnail IFD.
  const colorTag = tag => ifds[0].has(tag) ? ifds[0] : tags;
  const matrix = tag => {
    const owner=colorTag(tag),entry=owner.get(tag);
    if(!entry)return null;
    dng_requireThat(entry.type===10 && entry.count===9,
      'ColorMatrix должна быть SRATIONAL[9] (3×3)');
    return values(owner,tag,9);
  };
  const matrix1=matrix(dng_TAG.colorMatrix1),matrix2=matrix(dng_TAG.colorMatrix2);
  dng_requireThat(!matrix2 || matrix1,'ColorMatrix2 без ColorMatrix1');
  const illuminant = tag => {
    const owner=colorTag(tag),entry=owner.get(tag);
    if(!entry)return null;
    dng_requireThat(entry.type===3 && entry.count===1,'CalibrationIlluminant должен быть SHORT');
    return values(owner,tag,1)[0];
  };
  const illuminant1=illuminant(dng_TAG.illuminant1);
  const illuminant2=illuminant(dng_TAG.illuminant2);
  // Avoid silently misapplying a profile with unimplemented transforms.
  if(matrix1)for(const tag of [dng_TAG.cameraCalibration1,dng_TAG.cameraCalibration2,
    dng_TAG.analogBalance,dng_TAG.forwardMatrix1,dng_TAG.forwardMatrix2])
    dng_requireThat(!colorTag(tag).has(tag),'CameraCalibration/AnalogBalance/ForwardMatrix пока не поддерживается');
  dng_requireThat(!matrix1 || Boolean(ifds[0].has(dng_TAG.neutral)||tags.has(dng_TAG.neutral)),
    'нет AsShotNeutral для ColorMatrix (AsShotWhiteXY пока не поддерживается)');
  const color=matrix1 ? {matrix1,matrix2,illuminant1,illuminant2,neutral} : null;
  if(color)dngCameraToLinearSrgb(color); // Reject malformed/singular profiles before import.
  // ActiveArea uses sensor coordinates [top, left, bottom, right]; CFA phase remains sensor-relative.
  const activeArea=values(tags,dng_TAG.activeArea,4) ?? values(ifds[0],dng_TAG.activeArea,4) ?? [0,0,height,width];
  dng_requireThat(activeArea.length===4 && activeArea.every(Number.isInteger) &&
    activeArea[0]>=0 && activeArea[1]>=0 && activeArea[2]<=height && activeArea[3]<=width &&
    activeArea[2]-activeArea[0]>=2 && activeArea[3]-activeArea[1]>=2,
    'некорректная ActiveArea DNG');
  // DefaultScale changes displayed geometry; reject unimplemented non-identity
  // scaling rather than silently producing a wrong aspect ratio.
  if(tags.has(dng_TAG.defaultScale)){
    const entry=tags.get(dng_TAG.defaultScale);
    dng_requireThat(entry.type===5&&entry.count===2,'DefaultScale должен быть RATIONAL[2]');
    const scale=values(tags,dng_TAG.defaultScale,2);
    dng_requireThat(scale[0]===1&&scale[1]===1,'DefaultScale не равен 1: масштабирование пока не поддерживается');
  }
  // DNG 1.6: DefaultCropOrigin [H,V] is relative to ActiveArea's top-left.
  // SHORT/LONG/RATIONAL are legal. Read from the raw CFA IFD, not a thumbnail.
  const defaultCropValues=(tag,label)=>{
    const entry=tags.get(tag);
    if(!entry)return null;
    dng_requireThat([3,4,5].includes(entry.type) && entry.count===2,
      label+' должен быть SHORT/LONG/RATIONAL[2]');
    return values(tags,tag,2);
  };
  const activeWidth=activeArea[3]-activeArea[1], activeHeight=activeArea[2]-activeArea[0];
  const cropOrigin=defaultCropValues(dng_TAG.defaultCropOrigin,'DefaultCropOrigin') || [0,0];
  const cropSize=defaultCropValues(dng_TAG.defaultCropSize,'DefaultCropSize') || [activeWidth,activeHeight];
  dng_requireThat(cropOrigin.every(v=>dng_finite(v)&&v>=0) &&
    cropSize.every(v=>dng_finite(v)&&v>=2) &&
    cropOrigin[0]+cropSize[0]<=activeWidth && cropOrigin[1]+cropSize[1]<=activeHeight,
    'DefaultCrop выходит за ActiveArea или имеет неверные размеры');
  // DNG fractional coordinates remain fractional until sampling. The preview
  // has an integral pixel grid, rounded once; never shift the Bayer sensor phase.
  const cropWindow=[activeArea[1]+cropOrigin[0],activeArea[0]+cropOrigin[1],cropSize[0],cropSize[1]];
  const cropWidth=Math.round(cropSize[0]),cropHeight=Math.round(cropSize[1]);
  dng_requireThat(cropWidth>=2&&cropHeight>=2&&cropWidth*cropHeight<=dng_MAX_PIXELS,
    'DefaultCrop имеет небезопасные размеры');
  const orientation=single(ifds[0],dng_TAG.orientation,single(tags,dng_TAG.orientation,1));
  dng_requireThat(Number.isInteger(orientation) && orientation>=1 && orientation<=8,
    'неподдерживаемая Orientation DNG');
  const displayWidth=orientation>=5?cropHeight:cropWidth;
  const displayHeight=orientation>=5?cropWidth:cropHeight;
  const rowsPerStrip=single(tags,dng_TAG.rowsPerStrip,height);
  dng_requireThat(Number.isInteger(rowsPerStrip) && rowsPerStrip>=1, 'неверный RowsPerStrip');
  const strips=Math.ceil(height/rowsPerStrip);
  dng_requireThat(strips<=height && strips<=1024, 'слишком много RAW-полос');
  const offsets=values(tags,dng_TAG.stripOffsets,1024), byteCounts=values(tags,dng_TAG.stripBytes,1024);
  dng_requireThat(offsets?.length===strips && byteCounts?.length===strips, 'неверные StripOffsets/StripByteCounts');
  const rowBytes=width*(bits[0]/8);
  for(let i=0;i<strips;i++){
    const expected=Math.min(rowsPerStrip,height-i*rowsPerStrip)*rowBytes;
    dng_requireThat(Number.isInteger(offsets[i]) && Number.isInteger(byteCounts[i]) &&
      offsets[i]>=8 && byteCounts[i]>=expected && offsets[i]+byteCounts[i]<=buffer.byteLength,
      'усечённая или некорректная Bayer-полоса');
  }
  return {width,height,displayWidth,displayHeight,orientation,activeArea,cropWindow,
    bits:bits[0],pattern,black,blackRepeat,white:white[0],neutral,color,
    offsets,rowsPerStrip,rowBytes,le,buffer};
}
export function developDng(source, {exposure=0, wbRed=1, wbBlue=1}={}) {
  dng_requireThat(source && source.buffer instanceof ArrayBuffer, 'нет DNG-источника');
  dng_requireThat(dng_finite(exposure) && exposure>=-5 && exposure<=5 &&
    dng_finite(wbRed) && wbRed>=0.25 && wbRed<=4 &&
    dng_finite(wbBlue) && wbBlue>=0.25 && wbBlue<=4, 'неверные параметры RAW-проявки');
  const {width,height,displayWidth,displayHeight,orientation,cropWindow,
    bits,pattern,black,blackRepeat,white,neutral,color,offsets,rowsPerStrip,rowBytes,le,buffer}=source;
  const view=new DataView(buffer);
  const normalized=new Float32Array(width*height), channels=new Uint8Array(width*height);
  const exposureScale=2**exposure;
  for(let y=0;y<height;y++){
    const strip=Math.floor(y/rowsPerStrip);
    const stripRow=y-strip*rowsPerStrip;
    for(let x=0;x<width;x++){
      const index=y*width+x,phase=(y&1)*2+(x&1);
      const pos=offsets[strip]+stripRow*rowBytes+x*(bits/8);
      const sample=bits===8?view.getUint8(pos):view.getUint16(pos,le);
      const level=black.length===1?black[0]:black[(y%blackRepeat[1])*blackRepeat[0]+(x%blackRepeat[0])];
      normalized[index]=dng_clamp((sample-level)/(white-level),0,1);
      channels[index]=pattern[phase];
    }
  }
  const multipliers=[(neutral[1]/neutral[0])*wbRed,1,(neutral[1]/neutral[2])*wbBlue];
  const colorTransform=dngCameraToLinearSrgb(color,{wbRed,wbBlue});
  const rgba=new Uint8ClampedArray(displayWidth*displayHeight*4);
  function sampleChannel(x,y,c){
    const index=y*width+x;
    if(channels[index]===c)return normalized[index];
    // Bilinear same-channel neighbors; widen only at edges/corners.
    for(let radius=1;radius<=2;radius++){
      let sum=0,n=0;
      for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
        const px=x+dx,py=y+dy;
        if(px<0||py<0||px>=width||py>=height)continue;
        const j=py*width+px;
        if(channels[j]===c){sum+=normalized[j];n++;}
      }
      if(n)return sum/n;
    }
    return normalized[index];
  }
  function srgb(linear){
    const v=dng_clamp(linear,0,1);
    return Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
  }
  // Demosaic in original sensor space (including margin neighbors), then sample
  // the exact fractional crop rectangle on its integer output pixel grid.
  // This interpolates *linear camera channels*, before ColorMatrix and sRGB OETF.
  const [left,top,sensorCropWidth,sensorCropHeight]=cropWindow;
  const cropWidth=Math.round(sensorCropWidth),cropHeight=Math.round(sensorCropHeight);
  const resampleChannel=(x,y,c)=>{
    if(Number.isInteger(x)&&Number.isInteger(y))return sampleChannel(x,y,c);
    const x0=Math.floor(x),y0=Math.floor(y),tx=x-x0,ty=y-y0;
    const a=dng_clamp(x0,0,width-1),b=dng_clamp(x0+1,0,width-1);
    const d=dng_clamp(y0,0,height-1),e=dng_clamp(y0+1,0,height-1);
    return (1-ty)*((1-tx)*sampleChannel(a,d,c)+tx*sampleChannel(b,d,c))+
      ty*((1-tx)*sampleChannel(a,e,c)+tx*sampleChannel(b,e,c));
  };
  // EXIF/TIFF orientation 1..8 is applied to developed pixels, not a CSS flag.
  for(let cy=0;cy<cropHeight;cy++)for(let cx=0;cx<cropWidth;cx++){
    const x=left+(cx+0.5)*(sensorCropWidth/cropWidth)-0.5;
    const y=top+(cy+0.5)*(sensorCropHeight/cropHeight)-0.5;
    let dx=cx,dy=cy;
    switch(orientation){
      case 2: dx=cropWidth-1-cx; break;
      case 3: dx=cropWidth-1-cx;dy=cropHeight-1-cy;break;
      case 4: dy=cropHeight-1-cy;break;
      case 5: dx=cy;dy=cx;break;
      case 6: dx=cropHeight-1-cy;dy=cx;break;
      case 7: dx=cropHeight-1-cy;dy=cropWidth-1-cx;break;
      case 8: dx=cy;dy=cropWidth-1-cx;break;
    }
    const index=(dy*displayWidth+dx)*4;
    const camera=[resampleChannel(x,y,0),resampleChannel(x,y,1),resampleChannel(x,y,2)];
    const linear=colorTransform ? applyDngColorMatrix(colorTransform,...camera) :
      camera.map((value,c)=>value*multipliers[c]);
    for(let c=0;c<3;c++)rgba[index+c]=srgb(linear[c]*exposureScale);
    rgba[index+3]=255;
  }
  return {width:displayWidth,height:displayHeight,rgba,
    colorPipeline:color?'matrix-d50-bradford-v1':'uncalibrated-bayer-preview',
    development:{exposure,wbRed,wbBlue}};
}
export function decodeDng(buffer, development) {
  return developDng(inspectDng(buffer),development);
}
