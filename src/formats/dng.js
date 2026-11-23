import {dngCameraToLinearSrgb,applyDngColorMatrix,applyDngTonalControls} from './dng-color.js';
import {decodeDngLosslessJpeg} from './dng-lossless-jpeg.js';

// Bounded, dependency-free TIFF/DNG Bayer reader for offline file:// imports.
// Classic TIFF (II/MM), uncompressed 8/10/12/14/16-bit or bounded lossless JPEG SOF3 CFA strips/tiles.
// Unsupported RAW layouts fail explicitly instead of falling back to browser image decoders.
const dng_MAX_FILE_BYTES = 48 * 1024 * 1024;
const dng_MAX_PIXELS = 16_000_000;
const dng_TYPE_SIZE = { 1:1, 2:1, 3:2, 4:4, 5:8, 6:1, 7:1, 8:2, 9:4, 10:8, 11:4, 12:8 };
const dng_TAG = {
  width:256, height:257, bits:258, compression:259, photometric:262,
  stripOffsets:273, orientation:274, fillOrder:266, samples:277, rowsPerStrip:278, stripBytes:279, planar:284,
  subIfds:330, cfaDims:33421, cfaPattern:33422,
  tileWidth:322, tileLength:323, tileOffsets:324, tileBytes:325,
  dngVersion:50706, linearization:50712, blackRepeat:50713,
  black:50714, blackDeltaH:50715, blackDeltaV:50716, white:50717, neutral:50728, whiteXY:50729, activeArea:50829,
  defaultScale:50718, defaultCropOrigin:50719, defaultCropSize:50720, baselineExposure:50730,
  baselineExposureOffset:51109,
  colorMatrix1:50721, colorMatrix2:50722, cameraCalibration1:50723,
  cameraCalibration2:50724, analogBalance:50727,
  illuminant1:50778, illuminant2:50779, forwardMatrix1:50964, forwardMatrix2:50965,
  cameraCalibrationSignature:50931, profileCalibrationSignature:50932,
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
      // TIFF tile metadata is structural: invalid types/counts cannot fall back to strip mode.
      if([dng_TAG.tileWidth,dng_TAG.tileLength,dng_TAG.tileOffsets,dng_TAG.tileBytes].includes(tag) &&
        (type!==3&&type!==4 || count===0 || count>1024))
        dng_invalid('неверный TIFF Tile tag '+tag);
      // Unknown/oversized FillOrder must not silently use a different packed bit order.
      if(tag===dng_TAG.fillOrder && (type!==3 || count!==1))
        dng_invalid('FillOrder должен быть SHORT[1]');
      // Invalid LUT metadata must not be silently interpreted as identity.
      if(tag===dng_TAG.linearization && (type!==3 || count<2 || count>65536))
        dng_invalid('LinearizationTable должен быть SHORT[2..65536]');
      if(tag===dng_TAG.blackRepeat && (type!==3 || count!==2))
        dng_invalid('BlackLevelRepeatDim должен быть SHORT[2]');
      if(tag===dng_TAG.black && (![3,4,5].includes(type) || count<1 || count>64))
        dng_invalid('BlackLevel должен быть SHORT/LONG/RATIONAL[1..64]');
      // A bad BaselineExposure cannot be silently ignored as 0 EV.
      if(tag===dng_TAG.baselineExposure && (type!==10 || count!==1))
        dng_invalid('BaselineExposure должен быть SRATIONAL[1]');
      // A profile-authored EV offset is not interchangeable with user Exposure.
      if(tag===dng_TAG.baselineExposureOffset && (type!==10 || count!==1))
        dng_invalid('BaselineExposureOffset должен быть SRATIONAL[1]');
      // DNG BlackLevelDeltaH/V are signed rational offsets, one per ActiveArea
      // column/row. Even an unknown TIFF type/count must be rejected here.
      if((tag===dng_TAG.blackDeltaH||tag===dng_TAG.blackDeltaV) &&
        (type!==10 || count<1 || count>12000))
        dng_invalid('BlackLevelDeltaH/V должен быть SRATIONAL с допустимым count');
      if(!size || count > dng_MAX_PIXELS){
        // An invalid crop/scale tag must never silently become an uncropped preview.
        if([dng_TAG.defaultScale,dng_TAG.defaultCropOrigin,dng_TAG.defaultCropSize].includes(tag))
          dng_invalid('invalid DefaultCrop/DefaultScale TIFF tag '+tag);
        // Never interpret a malformed calibration tag as an uncalibrated image.
        if([50721,50722,50723,50724,50727,50728,50729,50778,50779,50964,50965,50931,50932].includes(tag))
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
  const compression=single(tags,dng_TAG.compression,1);
  dng_requireThat(compression===1 || compression===7,
    'поддерживается только uncompressed CFA или lossless JPEG SOF3 (Compression=7)');
  dng_requireThat(bits?.length===1 && (compression===1 ?
    [8,10,12,14,16].includes(bits[0]) : [8,10,12,14,16].includes(bits[0])),
    'неподдерживаемый BitsPerSample для uncompressed/JPEG Bayer');
  if(compression===1 && tags.has(dng_TAG.fillOrder))
    dng_requireThat(single(tags,dng_TAG.fillOrder,1)===1,
      'uncompressed Bayer поддерживает только FillOrder=1 (MSB-first)');
  dng_requireThat(single(tags,dng_TAG.samples,1)===1 && single(tags,dng_TAG.planar,1)===1, 'многоканальный CFA не поддерживается');
  const patternDims=values(tags,dng_TAG.cfaDims,2);
  const pattern=values(tags,dng_TAG.cfaPattern,16);
  dng_requireThat(patternDims?.[0]===2 && patternDims?.[1]===2 &&
    pattern?.length===4 && pattern.filter(c=>c===0).length===1 &&
    pattern.filter(c=>c===1).length===2 && pattern.filter(c=>c===2).length===1,
    'поддерживается только 2×2 Bayer RGGB/BGGR/GRBG/GBRG');
  // DNG stored sample code -> linear reference, before BlackLevel subtraction.
  // Table entries are unsigned 16-bit even for 8-bit stored Bayer samples.
  let linearization=null;
  if(tags.has(dng_TAG.linearization)){
    const entry=tags.get(dng_TAG.linearization);
    dng_requireThat(entry.type===3 && entry.count>=2 && entry.count<=2**bits[0],
      'LinearizationTable имеет неверный SHORT count для Bayer bits');
    linearization=new Uint16Array(entry.count);
    for(let i=0;i<entry.count;i++)linearization[i]=view.getUint16(entry.start+i*2,le);
  }
  // Deltas and BlackLevelRepeatDim both refer to original sensor coordinates.
  // Resolve ActiveArea before reading the per-column/per-row signed deltas.
  const activeArea=values(tags,dng_TAG.activeArea,4) ?? values(ifds[0],dng_TAG.activeArea,4) ?? [0,0,height,width];
  dng_requireThat(activeArea.length===4 && activeArea.every(Number.isInteger) &&
    activeArea[0]>=0 && activeArea[1]>=0 && activeArea[2]<=height && activeArea[3]<=width &&
    activeArea[2]-activeArea[0]>=2 && activeArea[3]-activeArea[1]>=2,
    'некорректная ActiveArea DNG');
  const activeWidth=activeArea[3]-activeArea[1], activeHeight=activeArea[2]-activeArea[0];
  // DNG BlackLevelRepeatDim is [rows,columns]. The repeating pattern starts
  // at ActiveArea top-left (in original sensor coordinates), not at (0,0)
  // or the rotated/cropped preview origin.
  const blackRepeat=values(tags,dng_TAG.blackRepeat,2) || [1,1];
  dng_requireThat(blackRepeat.length===2 && blackRepeat.every(v=>Number.isInteger(v)&&v>=1&&v<=8) &&
    blackRepeat[0]*blackRepeat[1]<=64, 'BlackLevelRepeatDim вне поддерживаемой сетки 1..8');
  const black=values(tags,dng_TAG.black,64) || [0];
  dng_requireThat(black.length===blackRepeat[0]*blackRepeat[1],
    'BlackLevel count не совпадает с BlackLevelRepeatDim');
  const blackDeltaH=values(tags,dng_TAG.blackDeltaH,activeWidth);
  const blackDeltaV=values(tags,dng_TAG.blackDeltaV,activeHeight);
  dng_requireThat(!blackDeltaH || blackDeltaH.length===activeWidth,
    'BlackLevelDeltaH count должен совпадать с шириной ActiveArea');
  dng_requireThat(!blackDeltaV || blackDeltaV.length===activeHeight,
    'BlackLevelDeltaV count должен совпадать с высотой ActiveArea');
  const white=values(tags,dng_TAG.white,4) || [2**bits[0]-1];
  dng_requireThat(white.length===1, 'неподдерживаемый WhiteLevel');
  // LinearizationTable produces 16-bit linear reference values even when the
  // stored CFA uses 8 bits. WhiteLevel/BlackLevel are in that *output* domain.
  const whiteLimit=linearization ? 65535 : 2**bits[0]-1;
  dng_requireThat(white[0]>0 && white[0]<=whiteLimit && black.every(v=>v>=0 && v<white[0]),
    'WhiteLevel/BlackLevel вне диапазона');
  // Validate the combined signed offset for every ActiveArea sensor site.
  // A negative delta is legal, but the resulting black must remain below
  // white and nonnegative for this bounded CFA normalizer.
  if(blackDeltaH||blackDeltaV){
    for(let y=activeArea[0];y<activeArea[2];y++)for(let x=activeArea[1];x<activeArea[3];x++){
      const row=(y-activeArea[0])%blackRepeat[0],col=(x-activeArea[1])%blackRepeat[1];
      const level=black[row*blackRepeat[1]+col]+(blackDeltaH?.[x-activeArea[1]]??0)+
        (blackDeltaV?.[y-activeArea[0]]??0);
      dng_requireThat(dng_finite(level)&&level>=0&&level<white[0],
        'WhiteLevel/BlackLevelDeltaH/V дают недопустимый BlackLevel');
    }
  }
  // The DNG spec permits AsShotNeutral OR AsShotWhiteXY, never both. The
  // latter is CIE xy and must be converted through AB*CC*CM, not used as
  // three direct camera multipliers.
  const hasNeutral=ifds[0].has(dng_TAG.neutral)||tags.has(dng_TAG.neutral);
  const hasWhiteXY=ifds[0].has(dng_TAG.whiteXY)||tags.has(dng_TAG.whiteXY);
  dng_requireThat(!(hasNeutral&&hasWhiteXY),
    'AsShotWhiteXY и AsShotNeutral взаимоисключающие');
  const neutralOwner=ifds[0].has(dng_TAG.neutral)?ifds[0]:tags;
  const whiteOwner=ifds[0].has(dng_TAG.whiteXY)?ifds[0]:tags;
  const neutral=hasNeutral?values(neutralOwner,dng_TAG.neutral,3):hasWhiteXY?null:[1,1,1];
  if(neutral)dng_requireThat(neutral.length===3 && neutral.every(v=>v>0 && dng_finite(v)),
    'ошибочный AsShotNeutral');
  const xyEntry=whiteOwner.get(dng_TAG.whiteXY);
  dng_requireThat(!xyEntry || (xyEntry.type===5 && xyEntry.count===2),
    'AsShotWhiteXY должен быть RATIONAL[2]');
  const whiteXY=xyEntry?values(whiteOwner,dng_TAG.whiteXY,2):null;
  if(whiteXY)dng_requireThat(whiteXY.every(v=>dng_finite(v)&&v>0&&v<1) &&
    whiteXY[0]+whiteXY[1]<1, 'некорректный AsShotWhiteXY');
  // DNG BaselineExposure is a signed camera default in EV, separate from the user's
  // editable Exposure. Accept it in IFD0 or the raw CFA IFD, never a thumbnail.
  const baselineOwner=ifds[0].has(dng_TAG.baselineExposure)?ifds[0]:tags;
  const baselineExposure=single(baselineOwner,dng_TAG.baselineExposure,0);
  dng_requireThat(dng_finite(baselineExposure) && baselineExposure>=-16 && baselineExposure<=16,
    'BaselineExposure вне безопасного диапазона ±16 EV');
  if(ifds[0]!==tags && ifds[0].has(dng_TAG.baselineExposure) && tags.has(dng_TAG.baselineExposure))
    dng_requireThat(single(tags,dng_TAG.baselineExposure)===baselineExposure,
      'конфликтующая BaselineExposure между IFD0 и CFA');
  // Bounded inline-camera-profile support: IFD0 (with CFA IFD fallback),
  // not external .dcp or ExtraCameraProfiles IFD selection.
  const offsetOwner=ifds[0].has(dng_TAG.baselineExposureOffset)?ifds[0]:tags;
  const baselineExposureOffset=single(offsetOwner,dng_TAG.baselineExposureOffset,0);
  dng_requireThat(dng_finite(baselineExposureOffset) &&
    baselineExposureOffset>=-16 && baselineExposureOffset<=16,
    'BaselineExposureOffset вне безопасного диапазона ±16 EV');
  if(ifds[0]!==tags && ifds[0].has(dng_TAG.baselineExposureOffset) && tags.has(dng_TAG.baselineExposureOffset))
    dng_requireThat(single(tags,dng_TAG.baselineExposureOffset)===baselineExposureOffset,
      'конфликтующая BaselineExposureOffset между IFD0 и CFA');
  // Colour tags live in IFD 0 or the CFA IFD, never rely on a thumbnail IFD.
  const colorTag = tag => ifds[0].has(tag) ? ifds[0] : tags;
  const matrix = (tag,label='ColorMatrix') => {
    const owner=colorTag(tag),entry=owner.get(tag);
    if(!entry)return null;
    dng_requireThat(entry.type===10 && entry.count===9,
      label+' должна быть SRATIONAL[9] (3×3)');
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
  // DNG profile matrices are signed rationals, camera analogue gain is unsigned rational.
  // Invalid profiles fail closed before publication of a document/layer.
  const forward1=matrix(dng_TAG.forwardMatrix1,'ForwardMatrix1');
  const forward2=matrix(dng_TAG.forwardMatrix2,'ForwardMatrix2');
  const calibration1=matrix(dng_TAG.cameraCalibration1,'CameraCalibration1');
  const calibration2=matrix(dng_TAG.cameraCalibration2,'CameraCalibration2');
  const analogEntry=colorTag(dng_TAG.analogBalance).get(dng_TAG.analogBalance);
  dng_requireThat(!analogEntry || (analogEntry.type===5 && analogEntry.count===3),
    'AnalogBalance должен быть RATIONAL[3]');
  const analogBalance=analogEntry?values(colorTag(dng_TAG.analogBalance),dng_TAG.analogBalance,3):null;
  // CameraCalibration is only authoritative if the UTF-8 signatures match.
  // Both absent means both default to empty (and therefore match), per DNG.
  const signature=tag=>{
    const owner=colorTag(tag),entry=owner.get(tag);
    if(!entry)return '';
    dng_requireThat([1,2].includes(entry.type)&&entry.count>=1&&entry.count<=256,
      'Camera/ProfileCalibrationSignature должен быть ASCII/BYTE[1..256]');
    const bytes=new Uint8Array(buffer,entry.start,entry.count);
    dng_requireThat(bytes[bytes.length-1]===0 && !bytes.subarray(0,-1).includes(0),
      'CalibrationSignature должен заканчиваться нулевым байтом');
    try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,-1));}
    catch{dng_invalid('неверная UTF-8 CalibrationSignature');}
  };
  const cameraSignature=signature(dng_TAG.cameraCalibrationSignature);
  const profileSignature=signature(dng_TAG.profileCalibrationSignature);
  dng_requireThat(matrix1 || ![forward1,forward2,calibration1,calibration2,analogBalance].some(Boolean),
    'ForwardMatrix/CameraCalibration/AnalogBalance без ColorMatrix1');
  dng_requireThat(!forward2 || forward1,'ForwardMatrix2 без ForwardMatrix1');
  dng_requireThat(!matrix1 || hasNeutral || hasWhiteXY,
    'нет AsShotNeutral или AsShotWhiteXY для ColorMatrix');
  dng_requireThat(matrix1 || !hasWhiteXY, 'AsShotWhiteXY требует ColorMatrix');
  const color=matrix1 ? {matrix1,matrix2,illuminant1,illuminant2,neutral,whiteXY,
    forward1,forward2,calibration1,calibration2,analogBalance,
    calibrationMatches:cameraSignature===profileSignature} : null;
  if(color)dngCameraToLinearSrgb(color); // Reject malformed/singular profiles before import.
  // DefaultScale defines output pixel aspect / dimensions, not a sensor crop.
  // Resample linear camera channels before ColorMatrix and the sRGB transfer.
  let defaultScale=[1,1];
  if(tags.has(dng_TAG.defaultScale)){
    const entry=tags.get(dng_TAG.defaultScale);
    dng_requireThat(entry.type===5&&entry.count===2,'DefaultScale должен быть RATIONAL[2]');
    defaultScale=values(tags,dng_TAG.defaultScale,2);
    dng_requireThat(defaultScale.every(v=>dng_finite(v)&&v>=0.125&&v<=8),
      'DefaultScale вне безопасного диапазона 1/8..8');
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
  const cropOrigin=defaultCropValues(dng_TAG.defaultCropOrigin,'DefaultCropOrigin') || [0,0];
  const cropSize=defaultCropValues(dng_TAG.defaultCropSize,'DefaultCropSize') || [activeWidth,activeHeight];
  dng_requireThat(cropOrigin.every(v=>dng_finite(v)&&v>=0) &&
    cropSize.every(v=>dng_finite(v)&&v>=2) &&
    cropOrigin[0]+cropSize[0]<=activeWidth && cropOrigin[1]+cropSize[1]<=activeHeight,
    'DefaultCrop выходит за ActiveArea или имеет неверные размеры');
  // Fractional crop/scale are evaluated once in original sensor coordinates.
  // The output pixel grid is rounded only after applying each scale component.
  const cropWindow=[activeArea[1]+cropOrigin[0],activeArea[0]+cropOrigin[1],cropSize[0],cropSize[1]];
  const cropWidth=Math.round(cropSize[0]*defaultScale[0]);
  const cropHeight=Math.round(cropSize[1]*defaultScale[1]);
  dng_requireThat(cropWidth>=2&&cropHeight>=2&&cropWidth<=12000&&cropHeight<=12000&&
    cropWidth*cropHeight<=dng_MAX_PIXELS,
    'DefaultCrop/DefaultScale имеют небезопасные выходные размеры');
  const orientation=single(ifds[0],dng_TAG.orientation,single(tags,dng_TAG.orientation,1));
  dng_requireThat(Number.isInteger(orientation) && orientation>=1 && orientation<=8,
    'неподдерживаемая Orientation DNG');
  const displayWidth=orientation>=5?cropHeight:cropWidth;
  const displayHeight=orientation>=5?cropWidth:cropHeight;
  // TIFF tiles and strips are mutually exclusive sensor layouts. Edge tiles
  // carry a full padded JPEG frame; padding never enters the Bayer pixel grid.
  const tileTags=[dng_TAG.tileWidth,dng_TAG.tileLength,dng_TAG.tileOffsets,dng_TAG.tileBytes];
  const tiled=tileTags.some(tag=>tags.has(tag));
  dng_requireThat(!tiled || (tileTags.every(tag=>tags.has(tag)) &&
    !tags.has(dng_TAG.stripOffsets) && !tags.has(dng_TAG.stripBytes) &&
    !tags.has(dng_TAG.rowsPerStrip)), 'неполный или смешанный TIFF Tile layout');
  const rowsPerStrip=tiled ? height : single(tags,dng_TAG.rowsPerStrip,height);
  dng_requireThat(Number.isInteger(rowsPerStrip) && rowsPerStrip>=1, 'неверный RowsPerStrip');
  const rowBytes=compression===1 ? Math.ceil(width*bits[0]/8) : 0;
  const compressedSamples=compression===7 ? new Uint16Array(width*height) : null;
  const tileWidth=tiled ? single(tags,dng_TAG.tileWidth,0) : 0;
  const tileHeight=tiled ? single(tags,dng_TAG.tileLength,0) : 0;
  // Each TIFF tile/strip row starts on a byte boundary. Edge tiles keep their
  // full padded physical width, although only useful pixels enter the sensor.
  const blockWidth=tiled?tileWidth:width;
  const blockRowBytes=compression===1 ? Math.ceil(blockWidth*bits[0]/8) : 0;
  dng_requireThat(!tiled || (Number.isInteger(tileWidth) && Number.isInteger(tileHeight) &&
    tileWidth>=2 && tileHeight>=1 && tileWidth<=12000 && tileHeight<=12000),
    'неверные TIFF TileWidth/TileLength');
  const chunks=tiled ? Math.ceil(width/tileWidth)*Math.ceil(height/tileHeight) :
    Math.ceil(height/rowsPerStrip);
  dng_requireThat(Number.isSafeInteger(chunks) && chunks>=1 && chunks<=1024,
    'слишком много TIFF Tile/Strip частей');
  const offsets=values(tags,tiled?dng_TAG.tileOffsets:dng_TAG.stripOffsets,1024);
  const byteCounts=values(tags,tiled?dng_TAG.tileBytes:dng_TAG.stripBytes,1024);
  dng_requireThat(offsets?.length===chunks && byteCounts?.length===chunks,
    tiled?'неверные TileOffsets/TileByteCounts':'неверные StripOffsets/StripByteCounts');
  for(let i=0;i<chunks;i++){
    const stripHeight=tiled?tileHeight:Math.min(rowsPerStrip,height-i*rowsPerStrip);
    const expected=compression===1 ? stripHeight*blockRowBytes : 16;
    dng_requireThat(Number.isInteger(offsets[i]) && Number.isInteger(byteCounts[i]) &&
      offsets[i]>=8 && (compression===1?byteCounts[i]===expected:byteCounts[i]>=expected) &&
      offsets[i]+byteCounts[i]<=buffer.byteLength,
      tiled?'усечённый или неверный TIFF Tile':'усечённая или некорректная Bayer-полоса');
    if(compressedSamples){
      const scanWidth=tiled?tileWidth:width;
      const scan=decodeDngLosslessJpeg(new Uint8Array(buffer,offsets[i],byteCounts[i]),
        {width:scanWidth,height:stripHeight,bits:bits[0]});
      if(tiled){
        const left=(i%Math.ceil(width/tileWidth))*tileWidth;
        const top=Math.floor(i/Math.ceil(width/tileWidth))*tileHeight;
        const usefulWidth=Math.min(tileWidth,width-left);
        const usefulHeight=Math.min(tileHeight,height-top);
        for(let y=0;y<usefulHeight;y++)
          compressedSamples.set(scan.subarray(y*tileWidth,y*tileWidth+usefulWidth),
            (top+y)*width+left);
      } else {
        compressedSamples.set(scan,i*rowsPerStrip*width);
      }
    }
  }
  return {width,height,displayWidth,displayHeight,orientation,activeArea,cropWindow,defaultScale,
    whiteBalanceSource:hasWhiteXY?'as-shot-white-xy':hasNeutral?'as-shot-neutral':'legacy-unspecified',
    bits:bits[0],compression,compressedSamples,pattern,black,blackRepeat,blackDeltaH,blackDeltaV,white:white[0],neutral,color,linearization,baselineExposure,baselineExposureOffset,
    tiled,tileWidth,tileHeight,offsets,rowsPerStrip,rowBytes,blockRowBytes,le,buffer};
}
export function developDng(source, {exposure=0, wbRed=1, wbBlue=1, highlights=0, shadows=0, contrast=0, demosaic='bilinear'}={}) {
  dng_requireThat(source && source.buffer instanceof ArrayBuffer, 'нет DNG-источника');
  dng_requireThat(dng_finite(source.baselineExposure) &&
    source.baselineExposure>=-16 && source.baselineExposure<=16,
    'неверная BaselineExposure DNG');
  dng_requireThat(dng_finite(source.baselineExposureOffset) &&
    source.baselineExposureOffset>=-16 && source.baselineExposureOffset<=16,
    'неверная BaselineExposureOffset DNG');
  dng_requireThat(dng_finite(exposure) && exposure>=-5 && exposure<=5 &&
    dng_finite(wbRed) && wbRed>=0.25 && wbRed<=4 &&
    dng_finite(wbBlue) && wbBlue>=0.25 && wbBlue<=4 &&
    dng_finite(highlights) && highlights>=-1 && highlights<=1 &&
    dng_finite(shadows) && shadows>=-1 && shadows<=1 &&
    typeof contrast==='number' && dng_finite(contrast) && contrast>=-1 && contrast<=1 &&
    (demosaic==='bilinear'||demosaic==='edge-aware-green'||demosaic==='edge-aware-rgb'), 'неверные параметры RAW-проявки');
  const {width,height,displayWidth,displayHeight,orientation,activeArea,cropWindow,defaultScale,
    bits,pattern,black,blackRepeat,blackDeltaH,blackDeltaV,white,neutral,color,linearization,baselineExposure,baselineExposureOffset,
    offsets,rowsPerStrip,rowBytes,blockRowBytes,le,buffer,compressedSamples,tiled,tileWidth,tileHeight}=source;
  const view=new DataView(buffer);
  const normalized=new Float32Array(width*height), channels=new Uint8Array(width*height);
  // Apply the camera's EV zero-point as a scene-linear gain, BEFORE tonal
  // adjustments and sRGB. The manual slider stays relative to this baseline.
  const exposureScale=2**(baselineExposure+baselineExposureOffset+exposure);
  for(let y=0;y<height;y++){
    const blockY=tiled?Math.floor(y/tileHeight):Math.floor(y/rowsPerStrip);
    const localRow=tiled?y%tileHeight:y-blockY*rowsPerStrip;
    for(let x=0;x<width;x++){
      const index=y*width+x,phase=(y&1)*2+(x&1);
      const block=tiled?blockY*Math.ceil(width/tileWidth)+Math.floor(x/tileWidth):blockY;
      const col=tiled?x%tileWidth:x;
      const byteOffset=offsets[block]+localRow*blockRowBytes;
      let stored;
      if(compressedSamples) stored=compressedSamples[index];
      else if(bits===8) stored=view.getUint8(byteOffset+col);
      else if(bits===16) stored=view.getUint16(byteOffset+col*2,le);
      else {
        // TIFF FillOrder=1: MSB-first packed 10/12/14-bit CFA samples.
        // Reset bit position on every scanline (and at tile boundaries).
        const startBit=col*bits,bitShift=startBit&7;
        const nbytes=Math.ceil((bitShift+bits)/8);
        const first=byteOffset+(startBit>>3);
        let word=0;
        for(let n=0;n<nbytes;n++)word=(word<<8)|view.getUint8(first+n);
        stored=(word>>>(nbytes*8-bitShift-bits))&((1<<bits)-1);
      }
      // Adobe DNG LUT semantics clamp sample indexes beyond the final entry.
      const sample=linearization ? linearization[Math.min(stored,linearization.length-1)] : stored;
      // Positive modulo also maps masked margins outside ActiveArea safely.
      const repeatY=((y-activeArea[0])%blackRepeat[0]+blackRepeat[0])%blackRepeat[0];
      const repeatX=((x-activeArea[1])%blackRepeat[1]+blackRepeat[1])%blackRepeat[1];
      const siteBlack=black[repeatY*blackRepeat[1]+repeatX];
      // Deltas are indexed by original ActiveArea columns/rows, never by
      // cropped, rescaled or rotated preview coordinates. Clamp the marginal
      // demosaic halo to the nearest active calibration column/row.
      const hx=blackDeltaH?.[dng_clamp(x-activeArea[1],0,blackDeltaH.length-1)]??0;
      const vy=blackDeltaV?.[dng_clamp(y-activeArea[0],0,blackDeltaV.length-1)]??0;
      const level=siteBlack+hx+vy;
      dng_requireThat(level>=0&&level<white,'WhiteLevel/BlackLevelDelta вне диапазона');
      normalized[index]=dng_clamp((sample-level)/(white-level),0,1);
      channels[index]=pattern[phase];
    }
  }
  const multipliers=color ? null : [(neutral[1]/neutral[0])*wbRed,1,(neutral[1]/neutral[2])*wbBlue];
  const colorTransform=dngCameraToLinearSrgb(color,{wbRed,wbBlue});
  const rgba=new Uint8ClampedArray(displayWidth*displayHeight*4);
  function sampleChannel(x,y,c){
    const index=y*width+x;
    if(channels[index]===c)return normalized[index];
    // In the opt-in RGB mode, interpolate camera-space R-G/B-G differences
    // rather than independent color intensities. This avoids luminance-edge
    // false colors while leaving original CFA samples untouched. All reads
    // are sensor-space, before fractional crop, white balance and color OETF.
    if(demosaic==='edge-aware-rgb' && c!==1 &&
       x>=2 && x<width-2 && y>=2 && y<height-2){
      const green=sampleChannel(x,y,1);
      if(channels[index]===1){
        // At green sites, the required color occupies exactly one CFA axis.
        const horizontal=channels[index-1]===c && channels[index+1]===c;
        const a=horizontal?index-1:index-width;
        const b=horizontal?index+1:index+width;
        if(channels[a]===c && channels[b]===c){
          const da=normalized[a]-sampleChannel(x-(horizontal?1:0),y-(horizontal?0:1),1);
          const db=normalized[b]-sampleChannel(x+(horizontal?1:0),y+(horizontal?0:1),1);
          return dng_clamp(green+(da+db)/2,0,1);
        }
      } else {
        // At the opposite CFA color, four diagonal same-color neighbors
        // have measured chroma; use their differences to interpolated G.
        const a=index-width-1,b=index-width+1,d=index+width-1,e=index+width+1;
        if(channels[a]===c && channels[b]===c &&
           channels[d]===c && channels[e]===c){
          const delta=(normalized[a]-sampleChannel(x-1,y-1,1)+
            normalized[b]-sampleChannel(x+1,y-1,1)+
            normalized[d]-sampleChannel(x-1,y+1,1)+
            normalized[e]-sampleChannel(x+1,y+1,1))/4;
          return dng_clamp(green+delta,0,1);
        }
      }
    }
    // An opt-in directional interpolation for green at red/blue Bayer sites.
    // Compare sensor-space directional differences and same-color second
    // neighbors; do not apply this correction after crop/rotation or OETF.
    // At a missing halo, retain the legacy bilinear boundary behavior.
    if((demosaic==='edge-aware-green'||demosaic==='edge-aware-rgb') && c===1 &&
       x>=2 && x<width-2 && y>=2 && y<height-2){
      const site=channels[index];
      const l=index-1,r=index+1,t=index-width,b=index+width;
      if(channels[l]===1 && channels[r]===1 && channels[t]===1 && channels[b]===1 &&
         channels[index-2]===site && channels[index+2]===site &&
         channels[index-2*width]===site && channels[index+2*width]===site){
        const correctionH=2*normalized[index]-normalized[index-2]-normalized[index+2];
        const correctionV=2*normalized[index]-normalized[index-2*width]-normalized[index+2*width];
        const horizontal=(normalized[l]+normalized[r])/2+correctionH/4;
        const vertical=(normalized[t]+normalized[b])/2+correctionV/4;
        const gradientH=Math.abs(normalized[l]-normalized[r])+Math.abs(correctionH);
        const gradientV=Math.abs(normalized[t]-normalized[b])+Math.abs(correctionV);
        return dng_clamp(gradientH<gradientV?horizontal:
          gradientV<gradientH?vertical:(horizontal+vertical)/2,0,1);
      }
    }
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
  const cropWidth=Math.round(sensorCropWidth*defaultScale[0]);
  const cropHeight=Math.round(sensorCropHeight*defaultScale[1]);
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
    const exposed=linear.map(v=>v*exposureScale);
    const toned=applyDngTonalControls(exposed,{highlights,shadows,contrast});
    for(let c=0;c<3;c++)rgba[index+c]=srgb(toned[c]);
    rgba[index+3]=255;
  }
  return {width:displayWidth,height:displayHeight,rgba,
    whiteBalanceSource:source.whiteBalanceSource,
    colorPipeline:color?.forward1?'forward-d50-v1':color?'matrix-d50-bradford-v1':'uncalibrated-bayer-preview',
    baselineExposure,baselineExposureOffset,development:{exposure,wbRed,wbBlue,highlights,shadows,contrast,
      ...(['edge-aware-green','edge-aware-rgb'].includes(demosaic)?{demosaic}: {})}};
}
export function decodeDng(buffer, development) {
  return developDng(inspectDng(buffer),development);
}
