// Bounded three-channel DNG colour pipeline. ForwardMatrix maps white-balanced
// reference-camera RGB directly to D50 PCS; ColorMatrix is the legacy fallback.
// Adobe DNG SDK's AB*CC mapping and FM*diag(1/referenceNeutral)*inverse(AB*CC)
// are used, but this remains a limited colour workflow, not camera parity.
const D50=[0.96422,1,0.82521], D65=[0.95047,1,1.08883];
const ID=[1,0,0,0,1,0,0,0,1];
const BRADFORD=[0.8951,0.2664,-0.1614,-0.7502,1.7135,0.0367,0.0389,-0.0685,1.0296];
const XYZ_D65_TO_RGB=[3.2404542,-1.5371385,-0.4985314,-0.969266,1.8760108,0.041556,0.0556434,-0.2040259,1.0572252];
const ILLUMINANT_KELVIN={1:5500,3:2856,17:2856,18:4874,19:6774,20:5503,21:6504,22:7504,23:5003,24:3200};
function invalid(message){throw new Error('DNG: '+message);}
function dot(a,b){return [0,1,2].map(r=>a[r*3]*b[0]+a[r*3+1]*b[1]+a[r*3+2]*b[2]);}
function multiply(a,b){
  const out=[];
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)
    out.push(a[r*3]*b[c]+a[r*3+1]*b[c+3]+a[r*3+2]*b[c+6]);
  return out;
}
function invert(m,label='ColorMatrix'){
  if(!Array.isArray(m)||m.length!==9||m.some(v=>!Number.isFinite(v)))
    invalid('некорректная '+label);
  const [a,b,c,d,e,f,g,h,i]=m;
  const cof=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];
  const det=a*cof[0]+b*cof[3]+c*cof[6];
  const scale=Math.max(...m.map(Math.abs));
  if(!Number.isFinite(det)||scale===0||Math.abs(det)<=1e-8*scale**3)
    invalid('вырожденная '+label);
  return cof.map(v=>v/det);
}
function adapt(src,dst){
  const from=dot(BRADFORD,src),to=dot(BRADFORD,dst);
  if(from.some(v=>v<=1e-7)||to.some(v=>v<=0))invalid('неверная точка белого DNG');
  const diag=[to[0]/from[0],to[1]/from[1],to[2]/from[2]];
  return multiply(invert(BRADFORD),BRADFORD.map((v,i)=>v*diag[Math.floor(i/3)]));
}
function temperature(xyz){
  const sum=xyz.reduce((a,b)=>a+b,0);
  if(sum<=1e-9)invalid('неверная точка белого DNG');
  const x=xyz[0]/sum,y=xyz[1]/sum;
  const n=(x-0.332)/(0.1858-y);
  const t=-449*n**3+3525*n**2-6823.3*n+5520.33;
  if(!Number.isFinite(t))invalid('неверная цветовая температура DNG');
  return Math.max(1667,Math.min(25000,t));
}
function normalizedForward(m){
  invert(m,'ForwardMatrix'); // A singular three-channel profile must not silently lose gamut.
  const out=[...m];
  for(let row=0;row<3;row++){
    const start=row*3,white=m[start]+m[start+1]+m[start+2];
    if(!Number.isFinite(white)||white<=1e-8)invalid('ForwardMatrix не отображает единичный белый в D50');
    for(let col=0;col<3;col++)out[start+col]*=D50[row]/white;
  }
  return out;
}
function lerp(a,b,weight){
  return a.map((v,i)=>v*weight+b[i]*(1-weight));
}
export function dngCameraToLinearSrgb(color,{wbRed=1,wbBlue=1}={}){
  if(!color)return null;
  const {matrix1,matrix2,illuminant1,illuminant2,neutral,whiteXY,
    forward1,forward2,calibration1,calibration2,analogBalance,calibrationMatches}=color;
  if(!ILLUMINANT_KELVIN[illuminant1])invalid('неподдерживаемый CalibrationIlluminant1');
  invert(matrix1); if(matrix2)invert(matrix2);
  if(!Number.isFinite(wbRed)||wbRed<=0||!Number.isFinite(wbBlue)||wbBlue<=0)
    invalid('неверные пользовательские WB gains');
  if(Boolean(matrix2)!==Boolean(illuminant2)||(matrix2&&!ILLUMINANT_KELVIN[illuminant2]))
    invalid('неполная или неподдерживаемая двойная CalibrationIlluminant/ColorMatrix');
  if(matrix2&&illuminant1===illuminant2)invalid('совпадающие CalibrationIlluminant');
  if(forward2&&!matrix2)invalid('ForwardMatrix2 без ColorMatrix2');
  if(calibration2&&!matrix2)invalid('CameraCalibration2 без ColorMatrix2');
  if(forward1)normalizedForward(forward1);
  if(forward2)normalizedForward(forward2);
  if(calibration1)invert(calibration1,'CameraCalibration');
  if(calibration2)invert(calibration2,'CameraCalibration');
  if(analogBalance&&(!Array.isArray(analogBalance)||analogBalance.length!==3||
     analogBalance.some(v=>!Number.isFinite(v)||v<=0||v>1024)))
    invalid('неверный AnalogBalance');
  if(whiteXY){
    if(neutral!==null||!Array.isArray(whiteXY)||whiteXY.length!==2||
      whiteXY.some(v=>!Number.isFinite(v)||v<=0||v>=1)||
      whiteXY[0]+whiteXY[1]>=1)invalid('неверный AsShotWhiteXY');
  }else if(!Array.isArray(neutral)||neutral.length!==3||
    neutral.some(v=>!Number.isFinite(v)||v<=0))invalid('неверный баланс белого DNG');
  const xyXyz=whiteXY ? [whiteXY[0]/whiteXY[1],1,
    (1-whiteXY[0]-whiteXY[1])/whiteXY[1]] : null;
  const ab=analogBalance||[1,1,1];
  const balance=[ab[0],0,0,0,ab[1],0,0,0,ab[2]];
  const hasCalibration=Boolean(calibrationMatches);
  const adjusted=(m,cc)=>multiply(balance,multiply(hasCalibration?(cc||ID):ID,m));
  const select=(weight)=>{
    const matrix=matrix2?lerp(matrix1,matrix2,weight):matrix1;
    const calibration=matrix2&&hasCalibration?
      lerp(calibration1||ID,calibration2||ID,weight):(hasCalibration?(calibration1||ID):ID);
    return {matrix,calibration,abcc:multiply(balance,calibration)};
  };
  let weight=1;
  if(matrix2&&xyXyz){
    // AsShotWhiteXY gives the white point directly, avoiding a circular
    // camera-neutral estimate. The two-light interpolation is approximate.
    const kelvin=temperature(xyXyz);
    const t1=ILLUMINANT_KELVIN[illuminant1],t2=ILLUMINANT_KELVIN[illuminant2];
    weight=Math.max(0,Math.min(1,(1/kelvin-1/t2)/(1/t1-1/t2)));
  }else if(matrix2){
    // Approximate reciprocal-Kelvin selection, iterating the calibrated XYZ to camera transform.
    weight=0.5;
    for(let j=0;j<5;j++){
      const {matrix,calibration}=select(weight);
      const xyz=dot(invert(adjusted(matrix,calibration)),neutral);
      const kelvin=temperature(xyz);
      const t1=ILLUMINANT_KELVIN[illuminant1],t2=ILLUMINANT_KELVIN[illuminant2];
      weight=Math.max(0,Math.min(1,(1/kelvin-1/t2)/(1/t1-1/t2)));
    }
  }
  const {matrix,abcc}=select(weight);
  // DNG: CameraNeutral = AB * CC * ColorMatrix * XYZ(xy,Y=1).
  // Resolve the interpolated calibration first, including signature gating.
  const cameraNeutral=xyXyz ? dot(multiply(abcc,matrix),xyXyz) : neutral;
  if(cameraNeutral.some(v=>!Number.isFinite(v)||v<=1e-7))
    invalid('AsShotWhiteXY: некорректная camera neutral');
  let cameraToD50;
  if(forward1){
    const forward=forward2?lerp(normalizedForward(forward1),normalizedForward(forward2),weight):
      normalizedForward(forward1);
    const individualToReference=invert(abcc,'AnalogBalance/CameraCalibration');
    const maxNeutral=Math.max(...cameraNeutral);
    const cameraWhite=cameraNeutral.map(v=>v/maxNeutral);
    const referenceNeutral=dot(individualToReference,cameraWhite);
    if(referenceNeutral.some(v=>!Number.isFinite(v)||v<=1e-7))
      invalid('ForwardMatrix: некорректная reference camera neutral');
    const invNeutral=[1/referenceNeutral[0],0,0,0,1/referenceNeutral[1],0,0,0,1/referenceNeutral[2]];
    cameraToD50=multiply(forward,multiply(invNeutral,individualToReference));
  }else{
    const cameraToXyz=invert(multiply(abcc,matrix));
    const illuminantXyz=dot(cameraToXyz,cameraNeutral);
    cameraToD50=multiply(adapt(illuminantXyz,D50),cameraToXyz);
  }
  const d50ToD65=adapt(D50,D65);
  const transform=multiply(XYZ_D65_TO_RGB,multiply(d50ToD65,cameraToD50));
  if(transform.some(v=>!Number.isFinite(v)))invalid('неверное цветовое преобразование DNG');
  return multiply(transform,[wbRed,0,0,0,1,0,0,0,wbBlue]);
}
// Luminance-selective, hue-preserving tonal controls applied to scene-linear
// RGB after colour calibration/exposure, *before* display sRGB transfer.
// Shadows affect darker pixels; highlights affect brighter ones. Contrast
// is a luminance S-curve. All preserve black and unit white, are monotonic
// for [-1, 1] amounts, and preserve RGB ratios.
// This is not raw highlight reconstruction from clipped sensor channels.
export function applyDngTonalControls(rgb,{highlights=0,shadows=0,contrast=0}={}){
  if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(v=>!Number.isFinite(v))||
     !Number.isFinite(highlights)||highlights < -1||highlights > 1||
     !Number.isFinite(shadows)||shadows < -1||shadows > 1||
     typeof contrast!=='number'||!Number.isFinite(contrast)||contrast < -1||contrast > 1)
    invalid('неверные параметры RAW тональной коррекции');
  if(highlights===0&&shadows===0&&contrast===0)return rgb;
  const luminance=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
  const y=Math.max(0,Math.min(1,luminance));
  if(y<=1e-8 || y>=1)return rgb;
  const lift=shadows*y*(1-y)*(1-y);
  const shoulder=highlights*y*y*(1-y);
  const tonal=y+lift+shoulder;
  // f(v)=v+c*v*(1-v)*(2*v-1) fixes 0, middle gray and 1, and stays monotonic.
  const contrasted=tonal+contrast*tonal*(1-tonal)*(2*tonal-1);
  const scale=Math.max(0,contrasted/y);
  return rgb.map(v=>v*scale);
}
export function applyDngColorMatrix(transform,r,g,b){
  return dot(transform,[r,g,b]);
}
