import { isPixelBuffer } from './pixel-buffer.js';

export class ColorManagementError extends Error {
  constructor(message, code = 'COLOR_MANAGEMENT_ERROR') {
    super(message);
    this.name = 'ColorManagementError';
    this.code = code;
  }
}

const ICC_D50 = Object.freeze([0.96422, 1, 0.82521]);

function iccBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new ColorManagementError('ICC transform ожидал бинарный профиль', 'ICC_BUFFER');
}

function iccAscii(bytes, offset, size) {
  if (offset < 0 || size < 0 || offset + size > bytes.length) throw new ColorManagementError('ICC profile truncated', 'ICC_TRUNCATED');
  let out = '';
  for (let i=0;i<size;i+=1) out += String.fromCharCode(bytes[offset+i]);
  return out;
}

function iccSpan(offset, size, limit, label) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > limit) {
    throw new ColorManagementError(label + ': диапазон выходит за границы ICC profile', 'ICC_TAG_RANGE');
  }
}

function iccClamp01(value) {
  const number=Number(value);
  return Number.isFinite(number) ? Math.min(1,Math.max(0,number)) : 0;
}

function iccParseProfile(bytesLike) {
  const bytes=iccBytes(bytesLike);
  if(bytes.length<132)throw new ColorManagementError('ICC profile короче обязательного header/tag table', 'ICC_TRUNCATED');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(iccAscii(bytes,36,4)!=='acsp')throw new ColorManagementError('ICC profile не содержит сигнатуру acsp', 'ICC_SIGNATURE');
  const declared=view.getUint32(0,false);
  if(declared<132||declared>bytes.length)throw new ColorManagementError('ICC profile declared size повреждён', 'ICC_SIZE');
  const colorSpace=iccAscii(bytes,16,4);
  const pcs=iccAscii(bytes,20,4);
  if(colorSpace!=='CMYK')throw new ColorManagementError('ICC profile не является CMYK input profile', 'ICC_COLOR_SPACE');
  if(pcs!=='Lab '&&pcs!=='XYZ ')throw new ColorManagementError('ICC profile использует неподдерживаемый PCS '+JSON.stringify(pcs), 'ICC_PCS');
  const count=view.getUint32(128,false);
  if(count>4096)throw new ColorManagementError('ICC profile содержит слишком много tags', 'ICC_TAG_LIMIT');
  iccSpan(132,count*12,declared,'ICC tag table');
  const tags=new Map();
  for(let index=0;index<count;index+=1){
    const entry=132+index*12;
    const signature=iccAscii(bytes,entry,4);
    const offset=view.getUint32(entry+4,false);
    const size=view.getUint32(entry+8,false);
    iccSpan(offset,size,declared,'ICC tag '+signature);
    if(!tags.has(signature))tags.set(signature,{signature,offset,size});
  }
  return{bytes,view,declared,colorSpace,pcs,tags};
}

function iccReadMft(profile, tag) {
  const {bytes,view,pcs}=profile;
  if(tag.size<52)throw new ColorManagementError('ICC '+tag.signature+' LUT слишком короткий', 'ICC_LUT_TRUNCATED');
  const start=tag.offset,end=start+tag.size;
  const type=iccAscii(bytes,start,4);
  if(type!=='mft1'&&type!=='mft2'){
    throw new ColorManagementError('ICC '+tag.signature+' использует '+JSON.stringify(type)+', Stage 13a поддерживает mft1/mft2', 'ICC_LUT_TYPE');
  }
  const inputs=bytes[start+8],outputs=bytes[start+9],grid=bytes[start+10];
  if(inputs!==4||outputs!==3)throw new ColorManagementError('ICC CMYK LUT ожидает 4 input / 3 output channels', 'ICC_LUT_CHANNELS');
  if(grid<2||grid>33)throw new ColorManagementError('ICC LUT grid points вне безопасного диапазона 2..33', 'ICC_LUT_GRID');
  if(type==='mft1'&&pcs==='XYZ '){
    throw new ColorManagementError('mft1 + PCSXYZ не имеет переносимого 8-bit PCS encoding; нужен mft2/mAB profile', 'ICC_LUT8_XYZ');
  }

  let inputEntries=256,outputEntries=256,cursor=start+48,bytesPerEntry=1;
  if(type==='mft2'){
    inputEntries=view.getUint16(start+48,false);
    outputEntries=view.getUint16(start+50,false);
    if(inputEntries<2||outputEntries<2||inputEntries>4096||outputEntries>4096){
      throw new ColorManagementError('ICC mft2 table entry count вне безопасного диапазона', 'ICC_LUT_TABLE');
    }
    cursor=start+52;
    bytesPerEntry=2;
  }
  const clutNodes=grid**inputs;
  const inputSamples=inputs*inputEntries;
  const clutSamples=clutNodes*outputs;
  const outputSamples=outputs*outputEntries;
  const required=(cursor-start)+(inputSamples+clutSamples+outputSamples)*bytesPerEntry;
  if(required>tag.size)throw new ColorManagementError('ICC LUT tables/CLUT обрезаны', 'ICC_LUT_TRUNCATED');

  const readSample=offset=>type==='mft1'?bytes[offset]/255:view.getUint16(offset,false)/65535;
  const inputTable=new Float32Array(inputSamples);
  for(let i=0;i<inputSamples;i+=1)inputTable[i]=readSample(cursor+i*bytesPerEntry);
  cursor+=inputSamples*bytesPerEntry;
  const clut=new Float32Array(clutSamples);
  for(let i=0;i<clutSamples;i+=1)clut[i]=readSample(cursor+i*bytesPerEntry);
  cursor+=clutSamples*bytesPerEntry;
  const outputTable=new Float32Array(outputSamples);
  for(let i=0;i<outputSamples;i+=1)outputTable[i]=readSample(cursor+i*bytesPerEntry);

  return{type,tag:tag.signature,pcs,inputs,outputs,grid,inputEntries,outputEntries,inputTable,clut,outputTable};
}

function iccTableLookup(table, entries, channel, value) {
  const position=iccClamp01(value)*(entries-1);
  const lower=Math.floor(position),upper=Math.min(entries-1,lower+1),t=position-lower;
  const base=channel*entries;
  return table[base+lower]*(1-t)+table[base+upper]*t;
}

function iccApplyLut(lut, c, m, y, k) {
  const source=[c,m,y,k];
  const mapped=new Float64Array(4);
  for(let channel=0;channel<4;channel+=1){
    mapped[channel]=iccTableLookup(lut.inputTable,lut.inputEntries,channel,source[channel]);
  }
  const lower=new Int32Array(4),upper=new Int32Array(4),fraction=new Float64Array(4);
  for(let channel=0;channel<4;channel+=1){
    const position=iccClamp01(mapped[channel])*(lut.grid-1);
    lower[channel]=Math.floor(position);
    upper[channel]=Math.min(lut.grid-1,lower[channel]+1);
    fraction[channel]=position-lower[channel];
  }
  const pcsRaw=new Float64Array(3);
  for(let corner=0;corner<16;corner+=1){
    let weight=1,node=0;
    for(let channel=0;channel<4;channel+=1){
      const high=(corner&(1<<channel))!==0;
      const coordinate=high?upper[channel]:lower[channel];
      weight*=high?fraction[channel]:1-fraction[channel];
      node=node*lut.grid+coordinate;
    }
    if(weight===0)continue;
    const offset=node*3;
    pcsRaw[0]+=lut.clut[offset]*weight;
    pcsRaw[1]+=lut.clut[offset+1]*weight;
    pcsRaw[2]+=lut.clut[offset+2]*weight;
  }
  const output=new Float64Array(3);
  for(let channel=0;channel<3;channel+=1){
    output[channel]=iccTableLookup(lut.outputTable,lut.outputEntries,channel,pcsRaw[channel]);
  }
  return output;
}

function iccLabToXyzD50(l, a, b) {
  const fy=(l+16)/116;
  const fx=fy+a/500;
  const fz=fy-b/200;
  const delta=6/29;
  const inverse=t=>t>delta?t**3:3*delta*delta*(t-4/29);
  return[
    ICC_D50[0]*inverse(fx),
    ICC_D50[1]*inverse(fy),
    ICC_D50[2]*inverse(fz),
  ];
}

function iccXyzD50ToD65(x, y, z) {
  return[
    0.9555766*x-0.0230393*y+0.0631636*z,
    -0.0282895*x+1.0099416*y+0.0210077*z,
    0.0122982*x-0.0204830*y+1.3299098*z,
  ];
}

function iccLinearToSrgb(value) {
  const v=Math.max(0,Number(value)||0);
  return v<=0.0031308?12.92*v:1.055*(v**(1/2.4))-0.055;
}

function iccXyzD65ToSrgb(x, y, z) {
  const red=3.2404542*x-1.5371385*y-0.4985314*z;
  const green=-0.9692660*x+1.8760108*y+0.0415560*z;
  const blue=0.0556434*x-0.2040259*y+1.0572252*z;
  return[
    iccClamp01(iccLinearToSrgb(red)),
    iccClamp01(iccLinearToSrgb(green)),
    iccClamp01(iccLinearToSrgb(blue)),
  ];
}

function iccLutOutputToSrgb(lut, raw) {
  let xyz;
  if(lut.pcs==='Lab '){
    let l,a,b;
    if(lut.type==='mft1'){
      l=iccClamp01(raw[0])*100;
      a=iccClamp01(raw[1])*255-128;
      b=iccClamp01(raw[2])*255-128;
    }else{
      const lCode=iccClamp01(raw[0])*65535;
      const aCode=iccClamp01(raw[1])*65535;
      const bCode=iccClamp01(raw[2])*65535;
      l=Math.min(100,Math.max(0,lCode*100/65280));
      a=Math.min(127,Math.max(-128,aCode/256-128));
      b=Math.min(127,Math.max(-128,bCode/256-128));
    }
    xyz=iccLabToXyzD50(l,a,b);
  }else{
    const scale=65535/32768;
    xyz=[raw[0]*scale,raw[1]*scale,raw[2]*scale];
  }
  return iccXyzD65ToSrgb(...iccXyzD50ToD65(...xyz));
}

function iccDeviceCmykFallback(c,m,y,k) {
  const cyan=iccClamp01(c),magenta=iccClamp01(m),yellow=iccClamp01(y),black=iccClamp01(k);
  return[
    (1-cyan)*(1-black),
    (1-magenta)*(1-black),
    (1-yellow)*(1-black),
  ];
}

export function createCmykToSrgbTransform(profileBytes = null, { intent = 'perceptual' } = {}) {
  const fallback=warning=>({
    managed:false,
    method:'device-cmyk-fallback',
    intent:'fallback',
    tag:null,
    pcs:null,
    warning,
    apply:iccDeviceCmykFallback,
  });
  if(!profileBytes)return fallback('ICC profile отсутствует; используется unmanaged Device CMYK approximation');
  try{
    const profile=iccParseProfile(profileBytes);
    const preferred=intent==='relative'?'A2B1':intent==='saturation'?'A2B2':'A2B0';
    const tag=profile.tags.get(preferred)||profile.tags.get('A2B0');
    if(!tag)throw new ColorManagementError('ICC profile не содержит A2B0/A2B1/A2B2 device-to-PCS transform', 'ICC_A2B_MISSING');
    const lut=iccReadMft(profile,tag);
    return{
      managed:true,
      method:lut.type==='mft1'?'icc-lut8':'icc-lut16',
      intent:preferred==='A2B1'?'relative':preferred==='A2B2'?'saturation':'perceptual',
      tag:tag.signature,
      pcs:profile.pcs.trim(),
      warning:null,
      apply(c,m,y,k){
        const raw=iccApplyLut(lut,iccClamp01(c),iccClamp01(m),iccClamp01(y),iccClamp01(k));
        return iccLutOutputToSrgb(lut,raw);
      },
    };
  }catch(error){
    const detail=error instanceof Error?error.message:String(error);
    return fallback('ICC CMYK transform недоступен ('+detail+'); используется unmanaged Device CMYK approximation');
  }
}

function iccPixelSample01(buffer,index) {
  if(buffer.bitsPerChannel===8)return buffer.data[index]/255;
  if(buffer.bitsPerChannel===16)return buffer.data[index]/65535;
  return iccClamp01(buffer.data[index]);
}

export function cmykPixelBufferToRgba8Preview(buffer, transform = null) {
  if(!isPixelBuffer(buffer)||buffer.model!=='cmyk'||![4,5].includes(buffer.channels)){
    throw new ColorManagementError('CMYK preview требует 4/5-channel CMYK PixelBuffer', 'CMYK_PIXEL_BUFFER');
  }
  const converter=transform&&typeof transform.apply==='function'?transform:createCmykToSrgbTransform();
  const rgba=new Uint8ClampedArray(buffer.width*buffer.height*4);
  const hasAlpha=buffer.channels===5;
  for(let pixel=0;pixel<buffer.width*buffer.height;pixel+=1){
    const source=pixel*buffer.channels,target=pixel*4;
    const rgb=converter.apply(
      iccPixelSample01(buffer,source),
      iccPixelSample01(buffer,source+1),
      iccPixelSample01(buffer,source+2),
      iccPixelSample01(buffer,source+3),
    );
    rgba[target]=Math.round(iccClamp01(rgb[0])*255);
    rgba[target+1]=Math.round(iccClamp01(rgb[1])*255);
    rgba[target+2]=Math.round(iccClamp01(rgb[2])*255);
    rgba[target+3]=hasAlpha?Math.round(iccPixelSample01(buffer,source+4)*255):255;
  }
  return rgba;
}
