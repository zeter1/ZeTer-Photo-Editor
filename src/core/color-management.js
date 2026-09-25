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


function iccAlign4(value) {
  return (Number(value) + 3) & ~3;
}

function iccS15Fixed16(view, offset) {
  return view.getInt32(offset, false) / 65536;
}

function iccReadCurve(profile, offset, limit, label = 'ICC curve') {
  const {bytes,view}=profile;
  iccSpan(offset,12,limit,label);
  const type=iccAscii(bytes,offset,4);
  if(type==='curv'){
    const count=view.getUint32(offset+8,false);
    if(count>65536)throw new ColorManagementError(label+': слишком много curve samples','ICC_CURVE_LIMIT');
    const rawSize=count===0?12:count===1?14:12+count*2;
    iccSpan(offset,rawSize,limit,label);
    if(count===0)return{size:iccAlign4(rawSize),apply:value=>iccClamp01(value)};
    if(count===1){
      const gamma=view.getUint16(offset+12,false)/256;
      return{size:iccAlign4(rawSize),apply:value=>iccClamp01(value)**gamma};
    }
    const table=new Float32Array(count);
    for(let index=0;index<count;index+=1)table[index]=view.getUint16(offset+12+index*2,false)/65535;
    return{
      size:iccAlign4(rawSize),
      apply(value){
        const position=iccClamp01(value)*(count-1);
        const lower=Math.floor(position),upper=Math.min(count-1,lower+1),t=position-lower;
        return table[lower]*(1-t)+table[upper]*t;
      },
    };
  }
  if(type==='para'){
    const functionType=view.getUint16(offset+8,false);
    const parameterCounts=[1,3,4,5,7];
    const count=parameterCounts[functionType];
    if(count==null)throw new ColorManagementError(label+': неподдерживаемый parametric curve type '+functionType,'ICC_PARAMETRIC_CURVE');
    const rawSize=12+count*4;
    iccSpan(offset,rawSize,limit,label);
    const p=[];
    for(let index=0;index<count;index+=1)p.push(iccS15Fixed16(view,offset+12+index*4));
    const apply=value=>{
      const x=iccClamp01(value);
      if(functionType===0)return iccClamp01(x**p[0]);
      if(functionType===1){
        const [g,a,b]=p;
        return iccClamp01(x>=-b/a?(a*x+b)**g:0);
      }
      if(functionType===2){
        const [g,a,b,c]=p;
        return iccClamp01(x>=-b/a?(a*x+b)**g+c:c);
      }
      if(functionType===3){
        const [g,a,b,c,d]=p;
        return iccClamp01(x>=d?(a*x+b)**g:c*x);
      }
      const [g,a,b,c,d,e,f]=p;
      return iccClamp01(x>=d?(a*x+b)**g+e:c*x+f);
    };
    return{size:iccAlign4(rawSize),apply};
  }
  throw new ColorManagementError(label+': curve type '+JSON.stringify(type)+' не поддерживается','ICC_CURVE_TYPE');
}

function iccReadSequentialCurves(profile, tag, relativeOffset, count, label) {
  if(!relativeOffset)return null;
  const start=tag.offset+relativeOffset;
  const limit=tag.offset+tag.size;
  iccSpan(start,12,limit,label);
  const curves=[];
  let cursor=start;
  for(let index=0;index<count;index+=1){
    const curve=iccReadCurve(profile,cursor,limit,label+' #'+(index+1));
    curves.push(curve);
    cursor+=curve.size;
    if(cursor>limit)throw new ColorManagementError(label+': curve set выходит за границы tag','ICC_CURVE_RANGE');
  }
  return curves;
}

function iccApplyCurves(curves, values) {
  if(!curves)return Array.from(values);
  if(curves.length!==values.length)throw new ColorManagementError('ICC curve-set channel mismatch','ICC_CURVE_CHANNELS');
  return values.map((value,index)=>curves[index].apply(value));
}

function iccInterpolateClut(data, grid, outputs, values, { clampInput = true } = {}) {
  const inputs=grid.length;
  if(values.length!==inputs)throw new ColorManagementError('ICC CLUT input channel mismatch','ICC_CLUT_CHANNELS');
  if(inputs<1||inputs>8)throw new ColorManagementError('ICC CLUT dimensions outside safe range 1..8','ICC_CLUT_DIMENSIONS');
  const lower=new Int32Array(inputs),upper=new Int32Array(inputs),fraction=new Float64Array(inputs);
  for(let channel=0;channel<inputs;channel+=1){
    const normalized=clampInput?iccClamp01(values[channel]):Number(values[channel]);
    const value=Number.isFinite(normalized)?normalized:0;
    const position=Math.max(0,Math.min(1,value))*(grid[channel]-1);
    lower[channel]=Math.floor(position);
    upper[channel]=Math.min(grid[channel]-1,lower[channel]+1);
    fraction[channel]=position-lower[channel];
  }
  const result=new Float64Array(outputs);
  const corners=1<<inputs;
  for(let corner=0;corner<corners;corner+=1){
    let weight=1,node=0;
    for(let channel=0;channel<inputs;channel+=1){
      const high=(corner&(1<<channel))!==0;
      const coordinate=high?upper[channel]:lower[channel];
      weight*=high?fraction[channel]:1-fraction[channel];
      node=node*grid[channel]+coordinate;
    }
    if(weight===0)continue;
    const offset=node*outputs;
    for(let output=0;output<outputs;output+=1)result[output]+=data[offset+output]*weight;
  }
  return Array.from(result);
}

function iccReadMab(profile, tag) {
  const {bytes,view,pcs}=profile;
  const start=tag.offset,end=start+tag.size;
  if(tag.size<32)throw new ColorManagementError('ICC '+tag.signature+' mAB tag слишком короткий','ICC_MAB_TRUNCATED');
  if(iccAscii(bytes,start,4)!=='mAB ')throw new ColorManagementError('ICC '+tag.signature+' не является lutAToBType','ICC_MAB_TYPE');
  const inputs=bytes[start+8],outputs=bytes[start+9];
  if(inputs!==4||outputs!==3)throw new ColorManagementError('ICC CMYK mAB ожидает 4 input / 3 output channels','ICC_MAB_CHANNELS');
  const bOffset=view.getUint32(start+12,false);
  const matrixOffset=view.getUint32(start+16,false);
  const mOffset=view.getUint32(start+20,false);
  const clutOffset=view.getUint32(start+24,false);
  const aOffset=view.getUint32(start+28,false);
  for(const [name,offset] of [['B',bOffset],['matrix',matrixOffset],['M',mOffset],['CLUT',clutOffset],['A',aOffset]]){
    if(offset)iccSpan(start+offset,4,end,'ICC mAB '+name);
  }
  const aCurves=iccReadSequentialCurves(profile,tag,aOffset,inputs,'ICC mAB A curve');
  const mCurves=iccReadSequentialCurves(profile,tag,mOffset,outputs,'ICC mAB M curve');
  const bCurves=iccReadSequentialCurves(profile,tag,bOffset,outputs,'ICC mAB B curve');

  let clut=null;
  if(clutOffset){
    const clutStart=start+clutOffset;
    iccSpan(clutStart,20,end,'ICC mAB CLUT');
    const grid=[];
    for(let index=0;index<inputs;index+=1){
      const points=bytes[clutStart+index];
      if(points<2||points>65)throw new ColorManagementError('ICC mAB CLUT grid outside safe range 2..65','ICC_MAB_GRID');
      grid.push(points);
    }
    const precision=bytes[clutStart+16];
    if(precision!==1&&precision!==2)throw new ColorManagementError('ICC mAB CLUT precision должен быть 1 или 2 bytes','ICC_MAB_PRECISION');
    const nodes=grid.reduce((product,value)=>product*value,1);
    const samples=nodes*outputs;
    const dataStart=clutStart+20;
    iccSpan(dataStart,samples*precision,end,'ICC mAB CLUT data');
    const data=new Float32Array(samples);
    for(let index=0;index<samples;index+=1){
      data[index]=precision===1?bytes[dataStart+index]/255:view.getUint16(dataStart+index*2,false)/65535;
    }
    clut={grid,outputs,data};
  }
  if(inputs!==outputs&&!clut)throw new ColorManagementError('ICC mAB с разным числом channels требует CLUT','ICC_MAB_CLUT_REQUIRED');

  let matrix=null;
  if(matrixOffset){
    const matrixStart=start+matrixOffset;
    iccSpan(matrixStart,48,end,'ICC mAB matrix');
    const coefficients=new Float64Array(12);
    for(let index=0;index<12;index+=1)coefficients[index]=iccS15Fixed16(view,matrixStart+index*4);
    matrix=coefficients;
  }
  return{type:'mAB ',tag:tag.signature,pcs,inputs,outputs,aCurves,mCurves,bCurves,clut,matrix};
}

function iccApplyMab(transform, c, m, y, k) {
  let values=iccApplyCurves(transform.aCurves,[c,m,y,k]);
  if(transform.clut)values=iccInterpolateClut(transform.clut.data,transform.clut.grid,transform.clut.outputs,values);
  values=iccApplyCurves(transform.mCurves,values);
  if(transform.matrix){
    if(values.length!==3)throw new ColorManagementError('ICC mAB matrix требует 3 channels','ICC_MAB_MATRIX_CHANNELS');
    const q=transform.matrix;
    values=[
      q[0]*values[0]+q[1]*values[1]+q[2]*values[2]+q[9],
      q[3]*values[0]+q[4]*values[1]+q[5]*values[2]+q[10],
      q[6]*values[0]+q[7]*values[1]+q[8]*values[2]+q[11],
    ];
  }
  return iccApplyCurves(transform.bCurves,values).map(iccClamp01);
}

function iccReadMpeFormulaSegment(profile,start,limit,label) {
  const {bytes,view}=profile;
  iccSpan(start,12,limit,label);
  if(iccAscii(bytes,start,4)!=='parf')throw new ColorManagementError(label+': ожидался parf','ICC_MPE_CURVE_SEGMENT');
  const type=view.getUint16(start+8,false);
  const counts=[4,5,5];
  const count=counts[type];
  if(count==null)throw new ColorManagementError(label+': неподдерживаемая formula type '+type,'ICC_MPE_CURVE_FORMULA');
  iccSpan(start+12,count*4,limit,label+' params');
  const p=[];for(let i=0;i<count;i+=1)p.push(view.getFloat32(start+12+i*4,false));
  const apply=value=>{
    const x=Number(value);
    if(!Number.isFinite(x))return 0;
    if(type===0){
      const [g,a,b,c]=p;
      return (a*x+b)**g+c;
    }
    if(type===1){
      const [g,a,b,c,d]=p;
      const inside=b*(x**g)+c;
      return inside>0?a*Math.log10(inside)+d:0;
    }
    const [a,b,c,d,e]=p;
    return a*(b**(c*x+d))+e;
  };
  return{type:'parf',size:12+count*4,apply};
}

function iccReadMpeSampleSegment(profile,start,limit,label) {
  const {bytes,view}=profile;
  iccSpan(start,12,limit,label);
  if(iccAscii(bytes,start,4)!=='samf')throw new ColorManagementError(label+': ожидался samf','ICC_MPE_CURVE_SEGMENT');
  const count=view.getUint32(start+8,false);
  if(count<1||count>65536)throw new ColorManagementError(label+': sampled curve count вне safe range','ICC_MPE_CURVE_SAMPLES');
  iccSpan(start+12,count*4,limit,label+' samples');
  const samples=new Float32Array(count);
  for(let i=0;i<count;i+=1)samples[i]=view.getFloat32(start+12+i*4,false);
  return{type:'samf',size:12+count*4,samples};
}

function iccReadMpeCurve(profile,start,size,label) {
  const {bytes,view}=profile;
  const limit=start+size;
  iccSpan(start,size,profile.declared,label);
  if(size<12||iccAscii(bytes,start,4)!=='curf')throw new ColorManagementError(label+': ожидался curf','ICC_MPE_CURVE');
  const segments=view.getUint16(start+8,false);
  if(segments<1||segments>1024)throw new ColorManagementError(label+': segment count вне safe range','ICC_MPE_CURVE_SEGMENTS');
  const breakCount=segments-1;
  iccSpan(start+12,breakCount*4,limit,label+' breakpoints');
  const breaks=[];for(let i=0;i<breakCount;i+=1)breaks.push(view.getFloat32(start+12+i*4,false));
  for(let i=1;i<breaks.length;i+=1)if(breaks[i]<breaks[i-1])throw new ColorManagementError(label+': breakpoints убывают','ICC_MPE_CURVE_BREAKS');
  let cursor=start+12+breakCount*4;
  const parts=[];
  for(let index=0;index<segments;index+=1){
    iccSpan(cursor,4,limit,label+' segment '+(index+1));
    const type=iccAscii(bytes,cursor,4);
    let segment;
    if(type==='parf')segment=iccReadMpeFormulaSegment(profile,cursor,limit,label+' formula '+(index+1));
    else if(type==='samf'){
      if(index===0||index===segments-1)throw new ColorManagementError(label+': first/last curve segment должен быть formula','ICC_MPE_CURVE_ENDPOINT');
      segment=iccReadMpeSampleSegment(profile,cursor,limit,label+' sampled '+(index+1));
    }else throw new ColorManagementError(label+': segment type '+JSON.stringify(type)+' не поддерживается','ICC_MPE_CURVE_SEGMENT');
    parts.push(segment);cursor+=segment.size;
  }
  if(cursor>limit)throw new ColorManagementError(label+': segments выходят за curve size','ICC_MPE_CURVE_RANGE');
  const formulaAt=(index,x)=>parts[index].apply(x);
  return{
    apply(value){
      const x=Number(value);
      if(!Number.isFinite(x))return 0;
      let index=breaks.findIndex(bp=>x<=bp);
      if(index<0)index=segments-1;
      const part=parts[index];
      if(part.type==='parf')return formulaAt(index,x);
      const low=breaks[index-1],high=breaks[index];
      const left=formulaAt(index-1,low);
      if(!(high>low))return part.samples.at(-1)??left;
      const position=Math.max(0,Math.min(1,(x-low)/(high-low)))*part.samples.length;
      if(position<=0)return left;
      if(position>=part.samples.length)return part.samples[part.samples.length-1];
      const step=Math.floor(position);
      if(Math.abs(position-step)<1e-12&&step>0)return part.samples[step-1];
      const previous=step===0?left:part.samples[step-1];
      const current=part.samples[Math.min(part.samples.length-1,step)];
      const local=position-step;
      return previous*(1-local)+current*local;
    },
  };
}

function iccReadMpeCurveSet(profile,elementStart,size,p,q,label) {
  const {view}=profile,end=elementStart+size;
  if(p!==q)throw new ColorManagementError(label+': cvst требует p == q','ICC_MPE_CVST_CHANNELS');
  iccSpan(elementStart+12,p*8,end,label+' positions');
  const curves=[];
  for(let channel=0;channel<p;channel+=1){
    const entry=elementStart+12+channel*8;
    const relative=view.getUint32(entry,false),curveSize=view.getUint32(entry+4,false);
    if(relative<12+p*8)throw new ColorManagementError(label+': curve offset пересекает header','ICC_MPE_CVST_OFFSET');
    iccSpan(elementStart+relative,curveSize,end,label+' curve '+(channel+1));
    curves.push(iccReadMpeCurve(profile,elementStart+relative,curveSize,label+' curve '+(channel+1)));
  }
  return{type:'cvst',p,q,curves};
}

function iccReadMpe(profile, tag, { expectedInputs=null, expectedOutputs=null } = {}) {
  const {bytes,view,pcs}=profile;
  const start=tag.offset,end=start+tag.size;
  if(tag.size<24||iccAscii(bytes,start,4)!=='mpet')throw new ColorManagementError('ICC '+tag.signature+' не является multiProcessElementsType','ICC_MPE_TYPE');
  const inputs=view.getUint16(start+8,false),outputs=view.getUint16(start+10,false);
  const count=view.getUint32(start+12,false);
  if(expectedInputs!=null&&inputs!==expectedInputs)throw new ColorManagementError('ICC MPE input channels '+inputs+' != '+expectedInputs,'ICC_MPE_CHANNELS');
  if(expectedOutputs!=null&&outputs!==expectedOutputs)throw new ColorManagementError('ICC MPE output channels '+outputs+' != '+expectedOutputs,'ICC_MPE_CHANNELS');
  if(inputs<1||outputs<1||inputs>16||outputs>16)throw new ColorManagementError('ICC MPE channel count вне safe range 1..16','ICC_MPE_CHANNELS');
  if(count<1||count>32)throw new ColorManagementError('ICC MPE element count outside safe range 1..32','ICC_MPE_COUNT');
  iccSpan(start+16,count*8,end,'ICC MPE positions');
  const elements=[];
  let currentChannels=inputs;
  for(let index=0;index<count;index+=1){
    const entry=start+16+index*8;
    const relative=view.getUint32(entry,false),size=view.getUint32(entry+4,false);
    const elementStart=start+relative;
    iccSpan(elementStart,size,end,'ICC MPE element #'+(index+1));
    if(size<12)throw new ColorManagementError('ICC MPE element слишком короткий','ICC_MPE_ELEMENT');
    const type=iccAscii(bytes,elementStart,4);
    const p=view.getUint16(elementStart+8,false),q=view.getUint16(elementStart+10,false);
    if(p!==currentChannels)throw new ColorManagementError('ICC MPE element input channel mismatch','ICC_MPE_CHAIN');
    if(type==='matf'){
      const required=12+4*(p*q+q);
      if(size<required)throw new ColorManagementError('ICC MPE matrix обрезана','ICC_MPE_MATRIX');
      const coefficients=new Float32Array(p*q+q);
      for(let sample=0;sample<coefficients.length;sample+=1)coefficients[sample]=view.getFloat32(elementStart+12+sample*4,false);
      elements.push({type,p,q,coefficients});
    }else if(type==='clut'){
      const grid=[];
      for(let channel=0;channel<p;channel+=1){
        const points=bytes[elementStart+12+channel];
        if(points<2||points>65)throw new ColorManagementError('ICC MPE CLUT grid outside safe range 2..65','ICC_MPE_GRID');
        grid.push(points);
      }
      const nodes=grid.reduce((product,value)=>product*value,1);
      const samples=nodes*q;
      const dataStart=elementStart+28;
      if(size<28+samples*4)throw new ColorManagementError('ICC MPE CLUT data обрезаны','ICC_MPE_CLUT');
      const data=new Float32Array(samples);
      for(let sample=0;sample<samples;sample+=1)data[sample]=view.getFloat32(dataStart+sample*4,false);
      elements.push({type,p,q,grid,data});
    }else if(type==='cvst'){
      elements.push(iccReadMpeCurveSet(profile,elementStart,size,p,q,'ICC MPE cvst #'+(index+1)));
    }else if(type==='bACS'||type==='eACS'){
      if(p!==q)throw new ColorManagementError('ICC '+type+' требует p == q','ICC_MPE_ACS_CHANNELS');
      elements.push({type,p,q,passThrough:true});
    }else{
      throw new ColorManagementError('ICC MPE element '+JSON.stringify(type)+' пока не поддерживается; требуется fallback','ICC_MPE_ELEMENT_TYPE');
    }
    currentChannels=q;
  }
  if(currentChannels!==outputs)throw new ColorManagementError('ICC MPE final channel count mismatch','ICC_MPE_CHAIN');
  return{type:'mpet',tag:tag.signature,pcs,inputs,outputs,elements};
}

function iccApplyMpe(transform, ...inputValues) {
  if(inputValues.length!==transform.inputs)throw new ColorManagementError('ICC MPE apply input channel mismatch','ICC_MPE_APPLY_CHANNELS');
  let values=inputValues.map(value=>Number.isFinite(Number(value))?Number(value):0);
  for(const element of transform.elements){
    if(element.passThrough)continue;
    if(element.type==='matf'){
      const next=new Array(element.q).fill(0);
      const matrixCount=element.p*element.q;
      for(let row=0;row<element.q;row+=1){
        let value=element.coefficients[matrixCount+row];
        for(let column=0;column<element.p;column+=1)value+=element.coefficients[row*element.p+column]*values[column];
        next[row]=value;
      }
      values=next;
    }else if(element.type==='clut'){
      values=iccInterpolateClut(element.data,element.grid,element.q,values);
    }else if(element.type==='cvst'){
      values=values.map((value,index)=>element.curves[index].apply(value));
    }
  }
  return values;
}

function iccReadMft(profile, tag, { expectedInputs=null, expectedOutputs=null } = {}) {
  const {bytes,view,pcs}=profile;
  if(tag.size<52)throw new ColorManagementError('ICC '+tag.signature+' LUT слишком короткий', 'ICC_LUT_TRUNCATED');
  const start=tag.offset,end=start+tag.size;
  const type=iccAscii(bytes,start,4);
  if(type!=='mft1'&&type!=='mft2'){
    throw new ColorManagementError('ICC '+tag.signature+' использует '+JSON.stringify(type)+', Stage 13a поддерживает mft1/mft2', 'ICC_LUT_TYPE');
  }
  const inputs=bytes[start+8],outputs=bytes[start+9],grid=bytes[start+10];
  if(expectedInputs!=null&&inputs!==expectedInputs)throw new ColorManagementError('ICC LUT input channels '+inputs+' != '+expectedInputs,'ICC_LUT_CHANNELS');
  if(expectedOutputs!=null&&outputs!==expectedOutputs)throw new ColorManagementError('ICC LUT output channels '+outputs+' != '+expectedOutputs,'ICC_LUT_CHANNELS');
  if(inputs<1||outputs<1||inputs>16||outputs>16)throw new ColorManagementError('ICC LUT channel count вне safe range','ICC_LUT_CHANNELS');
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
  if(!Number.isSafeInteger(clutNodes)||clutNodes*outputs>8_000_000)throw new ColorManagementError('ICC LUT CLUT превышает safe sample budget','ICC_LUT_CLUT_LIMIT');
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

function iccApplyLut(lut, ...inputValues) {
  if(inputValues.length!==lut.inputs)throw new ColorManagementError('ICC LUT apply input channel mismatch','ICC_LUT_APPLY_CHANNELS');
  const mapped=new Float64Array(lut.inputs);
  for(let channel=0;channel<lut.inputs;channel+=1){
    mapped[channel]=iccTableLookup(lut.inputTable,lut.inputEntries,channel,inputValues[channel]);
  }
  const lower=new Int32Array(lut.inputs),upper=new Int32Array(lut.inputs),fraction=new Float64Array(lut.inputs);
  for(let channel=0;channel<lut.inputs;channel+=1){
    const position=iccClamp01(mapped[channel])*(lut.grid-1);
    lower[channel]=Math.floor(position);
    upper[channel]=Math.min(lut.grid-1,lower[channel]+1);
    fraction[channel]=position-lower[channel];
  }
  const raw=new Float64Array(lut.outputs);
  const corners=1<<lut.inputs;
  if(lut.inputs>20)throw new ColorManagementError('ICC LUT interpolation dimensions too large','ICC_LUT_DIMENSIONS');
  for(let corner=0;corner<corners;corner+=1){
    let weight=1,node=0;
    for(let channel=0;channel<lut.inputs;channel+=1){
      const high=(corner&(1<<channel))!==0;
      const coordinate=high?upper[channel]:lower[channel];
      weight*=high?fraction[channel]:1-fraction[channel];
      node=node*lut.grid+coordinate;
    }
    if(weight===0)continue;
    const offset=node*lut.outputs;
    for(let output=0;output<lut.outputs;output+=1)raw[output]+=lut.clut[offset+output]*weight;
  }
  const output=new Float64Array(lut.outputs);
  for(let channel=0;channel<lut.outputs;channel+=1){
    output[channel]=iccTableLookup(lut.outputTable,lut.outputEntries,channel,raw[channel]);
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


function iccNormalizedPcsToSrgb(pcs, raw) {
  if(pcs==='Lab '){
    const lCode=iccClamp01(raw[0])*65535;
    const aCode=iccClamp01(raw[1])*65535;
    const bCode=iccClamp01(raw[2])*65535;
    const l=Math.min(100,Math.max(0,lCode*100/65280));
    const a=Math.min(127,Math.max(-128,aCode/256-128));
    const b=Math.min(127,Math.max(-128,bCode/256-128));
    return iccXyzD65ToSrgb(...iccXyzD50ToD65(...iccLabToXyzD50(l,a,b)));
  }
  const scale=65535/32768;
  return iccXyzD65ToSrgb(...iccXyzD50ToD65(raw[0]*scale,raw[1]*scale,raw[2]*scale));
}

function iccFloatPcsToSrgb(pcs, raw) {
  if(pcs==='Lab '){
    return iccXyzD65ToSrgb(...iccXyzD50ToD65(...iccLabToXyzD50(Number(raw[0])||0,Number(raw[1])||0,Number(raw[2])||0)));
  }
  return iccXyzD65ToSrgb(...iccXyzD50ToD65(Number(raw[0])||0,Number(raw[1])||0,Number(raw[2])||0));
}

function iccIntentPlan(intent) {
  const normalized=['perceptual','relative','saturation','absolute'].includes(intent)?intent:'perceptual';
  if(normalized==='relative')return{requested:normalized,index:1,dTag:'D2B1',aTag:'A2B1'};
  if(normalized==='saturation')return{requested:normalized,index:2,dTag:'D2B2',aTag:'A2B2'};
  if(normalized==='absolute')return{requested:normalized,index:3,dTag:'D2B3',aTag:'A2B1'};
  return{requested:'perceptual',index:0,dTag:'D2B0',aTag:'A2B0'};
}

function iccResolveDeviceToPcs(profile, intent) {
  const plan=iccIntentPlan(intent);
  const warnings=[];
  let tag=profile.tags.get(plan.dTag);
  if(tag){
    const type=iccAscii(profile.bytes,tag.offset,4);
    if(type==='mpet'){
      return{transform:iccReadMpe(profile,tag,{expectedInputs:4,expectedOutputs:3}),kind:'mpet',tag:tag.signature,resolvedIntent:plan.requested,warnings};
    }
    warnings.push(plan.dTag+' найден, но имеет неподдерживаемый type '+JSON.stringify(type));
  }
  tag=profile.tags.get(plan.aTag);
  let resolvedIntent=plan.requested==='absolute'?'relative':plan.requested;
  if(plan.requested==='absolute'&&tag)warnings.push('Absolute intent: D2B3 отсутствует; использован relative A2B1 transform');
  if(!tag&&plan.aTag!=='A2B0'){
    tag=profile.tags.get('A2B0');
    if(tag){
      resolvedIntent='perceptual';
      warnings.push(plan.aTag+' отсутствует; использован A2B0 perceptual transform');
    }
  }
  if(!tag)throw new ColorManagementError('ICC profile не содержит подходящий D2B/A2B device-to-PCS transform','ICC_DEVICE_TO_PCS_MISSING');
  const type=iccAscii(profile.bytes,tag.offset,4);
  if(type==='mft1'||type==='mft2')return{transform:iccReadMft(profile,tag,{expectedInputs:4,expectedOutputs:3}),kind:type,tag:tag.signature,resolvedIntent,warnings};
  if(type==='mAB ')return{transform:iccReadMab(profile,tag),kind:type,tag:tag.signature,resolvedIntent,warnings};
  if(type==='mpet')return{transform:iccReadMpe(profile,tag,{expectedInputs:4,expectedOutputs:3}),kind:type,tag:tag.signature,resolvedIntent,warnings};
  throw new ColorManagementError('ICC '+tag.signature+' использует неподдерживаемый transform type '+JSON.stringify(type),'ICC_TRANSFORM_TYPE');
}


function iccXyzD50ToLab(x,y,z) {
  const delta=6/29;
  const f=t=>t>delta**3?t**(1/3):t/(3*delta*delta)+4/29;
  const fx=f(x/ICC_D50[0]),fy=f(y/ICC_D50[1]),fz=f(z/ICC_D50[2]);
  return[116*fy-16,500*(fx-fy),200*(fy-fz)];
}

function iccLutOutputToXyzD50(lut,raw) {
  if(lut.pcs==='Lab '){
    let l,a,b;
    if(lut.type==='mft1'){
      l=iccClamp01(raw[0])*100;a=iccClamp01(raw[1])*255-128;b=iccClamp01(raw[2])*255-128;
    }else{
      const lCode=iccClamp01(raw[0])*65535,aCode=iccClamp01(raw[1])*65535,bCode=iccClamp01(raw[2])*65535;
      l=Math.min(100,Math.max(0,lCode*100/65280));a=Math.min(127,Math.max(-128,aCode/256-128));b=Math.min(127,Math.max(-128,bCode/256-128));
    }
    return iccLabToXyzD50(l,a,b);
  }
  const scale=65535/32768;
  return[raw[0]*scale,raw[1]*scale,raw[2]*scale];
}

function iccNormalizedPcsToXyzD50(pcs,raw) {
  if(pcs==='Lab '){
    const lCode=iccClamp01(raw[0])*65535,aCode=iccClamp01(raw[1])*65535,bCode=iccClamp01(raw[2])*65535;
    return iccLabToXyzD50(Math.min(100,Math.max(0,lCode*100/65280)),Math.min(127,Math.max(-128,aCode/256-128)),Math.min(127,Math.max(-128,bCode/256-128)));
  }
  const scale=65535/32768;
  return[raw[0]*scale,raw[1]*scale,raw[2]*scale];
}

function iccFloatPcsToXyzD50(pcs,raw) {
  return pcs==='Lab '?iccLabToXyzD50(Number(raw[0])||0,Number(raw[1])||0,Number(raw[2])||0):[Number(raw[0])||0,Number(raw[1])||0,Number(raw[2])||0];
}

function iccXyzD50ToNormalizedPcs(pcs,xyz) {
  if(pcs==='Lab '){
    const [l,a,b]=iccXyzD50ToLab(...xyz);
    return[iccClamp01((l*65280/100)/65535),iccClamp01(((a+128)*256)/65535),iccClamp01(((b+128)*256)/65535)];
  }
  const scale=65535/32768;
  return xyz.map(value=>iccClamp01(value/scale));
}

function iccXyzD50ToFloatPcs(pcs,xyz) {
  return pcs==='Lab '?iccXyzD50ToLab(...xyz):xyz.map(Number);
}

function iccReadMba(profile,tag) {
  const {bytes,view,pcs}=profile;
  const start=tag.offset,end=start+tag.size;
  if(tag.size<32||iccAscii(bytes,start,4)!=='mBA ')throw new ColorManagementError('ICC '+tag.signature+' не является lutBToAType','ICC_MBA_TYPE');
  const inputs=bytes[start+8],outputs=bytes[start+9];
  if(inputs!==3||outputs!==4)throw new ColorManagementError('ICC CMYK output mBA ожидает PCS 3 input / CMYK 4 output','ICC_MBA_CHANNELS');
  const bOffset=view.getUint32(start+12,false),matrixOffset=view.getUint32(start+16,false),mOffset=view.getUint32(start+20,false),clutOffset=view.getUint32(start+24,false),aOffset=view.getUint32(start+28,false);
  for(const [name,offset] of [['B',bOffset],['matrix',matrixOffset],['M',mOffset],['CLUT',clutOffset],['A',aOffset]])if(offset)iccSpan(start+offset,4,end,'ICC mBA '+name);
  const bCurves=iccReadSequentialCurves(profile,tag,bOffset,inputs,'ICC mBA B curve');
  const mCurves=iccReadSequentialCurves(profile,tag,mOffset,inputs,'ICC mBA M curve');
  const aCurves=iccReadSequentialCurves(profile,tag,aOffset,outputs,'ICC mBA A curve');
  let matrix=null;
  if(matrixOffset){
    const matrixStart=start+matrixOffset;iccSpan(matrixStart,48,end,'ICC mBA matrix');
    matrix=new Float64Array(12);for(let i=0;i<12;i+=1)matrix[i]=iccS15Fixed16(view,matrixStart+i*4);
  }
  let clut=null;
  if(clutOffset){
    const clutStart=start+clutOffset;iccSpan(clutStart,20,end,'ICC mBA CLUT');
    const grid=[];for(let i=0;i<inputs;i+=1){const points=bytes[clutStart+i];if(points<2||points>65)throw new ColorManagementError('ICC mBA CLUT grid вне safe range','ICC_MBA_GRID');grid.push(points);}
    const precision=bytes[clutStart+16];if(precision!==1&&precision!==2)throw new ColorManagementError('ICC mBA CLUT precision должен быть 1 или 2','ICC_MBA_PRECISION');
    const nodes=grid.reduce((p,v)=>p*v,1),samples=nodes*outputs,dataStart=clutStart+20;
    iccSpan(dataStart,samples*precision,end,'ICC mBA CLUT data');
    const data=new Float32Array(samples);
    for(let i=0;i<samples;i+=1)data[i]=precision===1?bytes[dataStart+i]/255:view.getUint16(dataStart+i*2,false)/65535;
    clut={grid,outputs,data};
  }
  if(inputs!==outputs&&!clut)throw new ColorManagementError('ICC mBA 3→4 требует CLUT','ICC_MBA_CLUT_REQUIRED');
  return{type:'mBA ',tag:tag.signature,pcs,inputs,outputs,bCurves,matrix,mCurves,clut,aCurves};
}

function iccApplyMba(transform,values) {
  let out=iccApplyCurves(transform.bCurves,values);
  if(transform.matrix){
    const q=transform.matrix;
    out=[
      q[0]*out[0]+q[1]*out[1]+q[2]*out[2]+q[9],
      q[3]*out[0]+q[4]*out[1]+q[5]*out[2]+q[10],
      q[6]*out[0]+q[7]*out[1]+q[8]*out[2]+q[11],
    ].map(iccClamp01);
  }
  out=iccApplyCurves(transform.mCurves,out);
  if(transform.clut)out=iccInterpolateClut(transform.clut.data,transform.clut.grid,transform.clut.outputs,out);
  return iccApplyCurves(transform.aCurves,out).map(iccClamp01);
}

function iccOutputIntentPlan(intent) {
  const normalized=iccIntentPlan(intent).requested;
  if(normalized==='relative')return{requested:normalized,dTag:'B2D1',aTag:'B2A1'};
  if(normalized==='saturation')return{requested:normalized,dTag:'B2D2',aTag:'B2A2'};
  if(normalized==='absolute')return{requested:normalized,dTag:'B2D3',aTag:'B2A1'};
  return{requested:'perceptual',dTag:'B2D0',aTag:'B2A0'};
}

function iccResolvePcsToDevice(profile,intent) {
  const plan=iccOutputIntentPlan(intent),warnings=[];
  let tag=profile.tags.get(plan.dTag);
  if(tag){
    const type=iccAscii(profile.bytes,tag.offset,4);
    if(type==='mpet')return{transform:iccReadMpe(profile,tag,{expectedInputs:3,expectedOutputs:4}),kind:'mpet',tag:tag.signature,resolvedIntent:plan.requested,warnings};
    warnings.push(plan.dTag+' найден, но имеет неподдерживаемый type '+JSON.stringify(type));
  }
  tag=profile.tags.get(plan.aTag);
  let resolvedIntent=plan.requested==='absolute'?'relative':plan.requested;
  if(plan.requested==='absolute'&&tag)warnings.push('Absolute intent: B2D3 отсутствует; использован relative B2A1 transform');
  if(!tag&&plan.aTag!=='B2A0'){tag=profile.tags.get('B2A0');if(tag){resolvedIntent='perceptual';warnings.push(plan.aTag+' отсутствует; использован B2A0 perceptual transform');}}
  if(!tag)throw new ColorManagementError('ICC profile не содержит подходящий B2D/B2A PCS-to-device transform','ICC_PCS_TO_DEVICE_MISSING');
  const type=iccAscii(profile.bytes,tag.offset,4);
  if(type==='mBA ')return{transform:iccReadMba(profile,tag),kind:'mBA ',tag:tag.signature,resolvedIntent,warnings};
  if(type==='mft1'||type==='mft2')return{transform:iccReadMft(profile,tag,{expectedInputs:3,expectedOutputs:4}),kind:type,tag:tag.signature,resolvedIntent,warnings};
  if(type==='mpet')return{transform:iccReadMpe(profile,tag,{expectedInputs:3,expectedOutputs:4}),kind:type,tag:tag.signature,resolvedIntent,warnings};
  throw new ColorManagementError('ICC '+tag.signature+' uses unsupported PCS-to-device transform '+JSON.stringify(type),'ICC_PCS_TO_DEVICE_TYPE');
}

function iccDeviceToXyzTransform(profile,intent) {
  const resolved=iccResolveDeviceToPcs(profile,intent),transform=resolved.transform;
  return{
    ...resolved,
    apply(values){
      if(!Array.isArray(values)||values.length!==4)throw new ColorManagementError('CMYK→PCS ожидает 4 channels','ICC_DEVICE_INPUT');
      if(resolved.kind==='mft1'||resolved.kind==='mft2')return iccLutOutputToXyzD50(transform,iccApplyLut(transform,...values.map(iccClamp01)));
      if(resolved.kind==='mAB ')return iccNormalizedPcsToXyzD50(profile.pcs,iccApplyMab(transform,...values.map(iccClamp01)));
      return iccFloatPcsToXyzD50(profile.pcs,iccApplyMpe(transform,...values.map(iccClamp01)));
    },
  };
}

function iccPcsToDeviceTransform(profile,intent) {
  const resolved=iccResolvePcsToDevice(profile,intent),transform=resolved.transform;
  return{
    ...resolved,
    applyXyz(xyz){
      let values;
      if(resolved.kind==='mpet')values=iccApplyMpe(transform,...iccXyzD50ToFloatPcs(profile.pcs,xyz));
      else if(resolved.kind==='mBA ')values=iccApplyMba(transform,iccXyzD50ToNormalizedPcs(profile.pcs,xyz));
      else values=iccApplyLut(transform,...iccXyzD50ToNormalizedPcs(profile.pcs,xyz));
      return Array.from(values,iccClamp01);
    },
  };
}

function srgbToXyzD50(r,g,b) {
  const red=iccClamp01(r),green=iccClamp01(g),blue=iccClamp01(b);
  const lin=[red,green,blue].map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const x65=.4124564*lin[0]+.3575761*lin[1]+.1804375*lin[2];
  const y65=.2126729*lin[0]+.7151522*lin[1]+.0721750*lin[2];
  const z65=.0193339*lin[0]+.1191920*lin[1]+.9503041*lin[2];
  return[
    1.0478112*x65+.0228866*y65-.0501270*z65,
    .0295424*x65+.9904844*y65-.0170491*z65,
    -.0092345*x65+.0150436*y65+.7521316*z65,
  ];
}

function xyzD50ToSrgb(xyz) {
  return iccXyzD65ToSrgb(...iccXyzD50ToD65(...xyz));
}

function deviceCmykFromSrgb(r,g,b) {
  const red=iccClamp01(r),green=iccClamp01(g),blue=iccClamp01(b);
  const k=1-Math.max(red,green,blue);
  if(k>=1-1e-9)return[0,0,0,1];
  const denom=1-k;
  return[(1-red-k)/denom,(1-green-k)/denom,(1-blue-k)/denom,k].map(iccClamp01);
}

export function inspectCmykIccProfile(profileBytes) {
  const profile=iccParseProfile(profileBytes);
  return{colorSpace:profile.colorSpace.trim(),pcs:profile.pcs.trim(),tags:[...profile.tags.keys()].sort()};
}

export function createSrgbToCmykTransform(profileBytes=null,{intent='relative'}={}) {
  const requestedIntent=iccIntentPlan(intent).requested;
  const fallback=warning=>({managed:false,method:'srgb-device-cmyk-fallback',intent:'fallback',requestedIntent,tag:null,warning,apply:(r,g,b)=>deviceCmykFromSrgb(r,g,b)});
  if(!profileBytes)return fallback('CMYK ICC profile отсутствует; RGB editing color переводится через Device-CMYK fallback');
  try{
    const profile=iccParseProfile(profileBytes),output=iccPcsToDeviceTransform(profile,requestedIntent);
    return{managed:true,method:output.kind==='mpet'?'icc-b2d-mpe':output.kind==='mBA '?'icc-mba':'icc-b2a-lut',intent:output.resolvedIntent,requestedIntent,tag:output.tag,warning:output.warnings.length?output.warnings.join('; '):null,
      apply(r,g,b){return output.applyXyz(srgbToXyzD50(r,g,b));}};
  }catch(error){return fallback('RGB→CMYK ICC transform недоступен ('+(error?.message||error)+'); используется Device-CMYK fallback');}
}

function estimateProfileBlackY(profile) {
  try{
    const output=iccPcsToDeviceTransform(profile,'perceptual');
    const relative=iccDeviceToXyzTransform(profile,'relative');
    const deviceBlack=output.applyXyz([0,0,0]);
    return Math.max(0,Math.min(.999999,relative.apply(deviceBlack)[1]));
  }catch{
    try{return Math.max(0,Math.min(.999999,iccDeviceToXyzTransform(profile,'relative').apply([1,1,1,1])[1]));}
    catch{return 0;}
  }
}

function applyBlackPointCompensationXyz(xyz,sourceBlackY,destBlackY) {
  const denominator=1-sourceBlackY;
  if(!(denominator>1e-9))return xyz;
  const r=(1-destBlackY)/denominator;
  return[
    r*xyz[0]+(1-r)*ICC_D50[0],
    r*xyz[1]+(1-r)*ICC_D50[1],
    r*xyz[2]+(1-r)*ICC_D50[2],
  ];
}

export function createCmykSoftProofTransform(sourceProfileBytes,proofProfileBytes,{intent='relative',blackPointCompensation=true}={}) {
  const requestedIntent=iccIntentPlan(intent).requested;
  if(!sourceProfileBytes||!proofProfileBytes){
    const base=createCmykToSrgbTransform(sourceProfileBytes,{intent:requestedIntent});
    return{...base,softProof:false,blackPointCompensation:false,warning:'Soft proof profile отсутствует; используется обычный CMYK display transform'+(base.warning?' • '+base.warning:'')};
  }
  try{
    const source=iccParseProfile(sourceProfileBytes),proof=iccParseProfile(proofProfileBytes);
    const sourceIn=iccDeviceToXyzTransform(source,requestedIntent);
    const proofOut=iccPcsToDeviceTransform(proof,requestedIntent);
    const proofIn=iccDeviceToXyzTransform(proof,'relative');
    const sourceBlackY=blackPointCompensation?estimateProfileBlackY(source):0;
    const proofBlackY=blackPointCompensation?estimateProfileBlackY(proof):0;
    const warnings=[...sourceIn.warnings,...proofOut.warnings,...proofIn.warnings].filter(Boolean);
    return{
      managed:true,softProof:true,method:'icc-profile-to-profile-proof',intent:requestedIntent,requestedIntent,displaySpace:'srgb',
      blackPointCompensation:Boolean(blackPointCompensation),sourceTag:sourceIn.tag,proofOutputTag:proofOut.tag,proofInputTag:proofIn.tag,
      warning:warnings.length?warnings.join('; '):null,
      apply(c,m,y,k){
        let xyz=sourceIn.apply([iccClamp01(c),iccClamp01(m),iccClamp01(y),iccClamp01(k)]);
        if(blackPointCompensation)xyz=applyBlackPointCompensationXyz(xyz,sourceBlackY,proofBlackY);
        const proofDevice=proofOut.applyXyz(xyz);
        const simulated=proofIn.apply(proofDevice);
        return xyzD50ToSrgb(simulated);
      },
    };
  }catch(error){
    const base=createCmykToSrgbTransform(sourceProfileBytes,{intent:requestedIntent});
    return{...base,softProof:false,blackPointCompensation:false,warning:'Soft proof недоступен ('+(error?.message||error)+'); используется обычный CMYK display transform'+(base.warning?' • '+base.warning:'')};
  }
}

function iccDeviceCmykFallback(c,m,y,k) {
  const cyan=iccClamp01(c),magenta=iccClamp01(m),yellow=iccClamp01(y),black=iccClamp01(k);
  return[
    (1-cyan)*(1-black),
    (1-magenta)*(1-black),
    (1-yellow)*(1-black),
  ];
}

export function createCmykToSrgbTransform(profileBytes = null, { intent = 'perceptual', displaySpace = 'srgb' } = {}) {
  const requestedIntent=iccIntentPlan(intent).requested;
  const requestedDisplay=String(displaySpace||'srgb').toLowerCase();
  const fallback=warning=>({
    managed:false,
    method:'device-cmyk-fallback',
    intent:'fallback',
    requestedIntent,
    displaySpace:'srgb',
    tag:null,
    pcs:null,
    warning,
    apply:iccDeviceCmykFallback,
  });
  if(requestedDisplay!=='srgb')return fallback('Display space '+JSON.stringify(displaySpace)+' пока не поддерживается; доступен только sRGB display policy');
  if(!profileBytes)return fallback('ICC profile отсутствует; используется unmanaged Device CMYK approximation');
  try{
    const profile=iccParseProfile(profileBytes);
    const resolved=iccResolveDeviceToPcs(profile,requestedIntent);
    const warnings=[...resolved.warnings];
    const transform=resolved.transform;
    let method;
    if(resolved.kind==='mft1')method='icc-lut8';
    else if(resolved.kind==='mft2')method='icc-lut16';
    else if(resolved.kind==='mAB ')method='icc-mab';
    else method='icc-mpe';
    return{
      managed:true,
      method,
      intent:resolved.resolvedIntent,
      requestedIntent,
      displaySpace:'srgb',
      tag:resolved.tag,
      pcs:profile.pcs.trim(),
      warning:warnings.length?warnings.join('; '):null,
      apply(c,m,y,k){
        const inputs=[iccClamp01(c),iccClamp01(m),iccClamp01(y),iccClamp01(k)];
        if(resolved.kind==='mft1'||resolved.kind==='mft2'){
          return iccLutOutputToSrgb(transform,iccApplyLut(transform,...inputs));
        }
        if(resolved.kind==='mAB '){
          return iccNormalizedPcsToSrgb(profile.pcs,iccApplyMab(transform,...inputs));
        }
        return iccFloatPcsToSrgb(profile.pcs,iccApplyMpe(transform,...inputs));
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
