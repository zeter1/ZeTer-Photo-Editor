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
      if(!size || count > dng_MAX_PIXELS) continue;
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
  // ActiveArea uses sensor coordinates [top, left, bottom, right]; CFA phase remains sensor-relative.
  const activeArea=values(tags,dng_TAG.activeArea,4) ?? values(ifds[0],dng_TAG.activeArea,4) ?? [0,0,height,width];
  dng_requireThat(activeArea.length===4 && activeArea.every(Number.isInteger) &&
    activeArea[0]>=0 && activeArea[1]>=0 && activeArea[2]<=height && activeArea[3]<=width &&
    activeArea[2]-activeArea[0]>=2 && activeArea[3]-activeArea[1]>=2,
    'некорректная ActiveArea DNG');
  const orientation=single(ifds[0],dng_TAG.orientation,single(tags,dng_TAG.orientation,1));
  dng_requireThat(Number.isInteger(orientation) && orientation>=1 && orientation<=8,
    'неподдерживаемая Orientation DNG');
  const cropWidth=activeArea[3]-activeArea[1], cropHeight=activeArea[2]-activeArea[0];
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
  return {width,height,displayWidth,displayHeight,orientation,activeArea,
    bits:bits[0],pattern,black,blackRepeat,white:white[0],neutral,
    offsets,rowsPerStrip,rowBytes,le,buffer};
}
export function developDng(source, {exposure=0, wbRed=1, wbBlue=1}={}) {
  dng_requireThat(source && source.buffer instanceof ArrayBuffer, 'нет DNG-источника');
  dng_requireThat(dng_finite(exposure) && exposure>=-5 && exposure<=5 &&
    dng_finite(wbRed) && wbRed>=0.25 && wbRed<=4 &&
    dng_finite(wbBlue) && wbBlue>=0.25 && wbBlue<=4, 'неверные параметры RAW-проявки');
  const {width,height,displayWidth,displayHeight,orientation,activeArea,
    bits,pattern,black,blackRepeat,white,neutral,offsets,rowsPerStrip,rowBytes,le,buffer}=source;
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
  // Demosaic with uncropped sensor neighbors, then crop and orient the developed preview.
  // EXIF/TIFF orientation 1..8 is applied to pixels, not just to a display flag.
  const cropWidth=activeArea[3]-activeArea[1],cropHeight=activeArea[2]-activeArea[0];
  for(let y=activeArea[0];y<activeArea[2];y++)for(let x=activeArea[1];x<activeArea[3];x++){
    const cx=x-activeArea[1],cy=y-activeArea[0];
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
    for(let c=0;c<3;c++)rgba[index+c]=srgb(sampleChannel(x,y,c)*multipliers[c]*exposureScale);
    rgba[index+3]=255;
  }
  return {width:displayWidth,height:displayHeight,rgba,development:{exposure,wbRed,wbBlue}};
}
export function decodeDng(buffer, development) {
  return developDng(inspectDng(buffer),development);
}
