// Bounded DNG ColorMatrix workflow (3-colour Bayer, without ForwardMatrix).
// DNG ColorMatrix maps D50 XYZ -> unbalanced camera. White balance is a
// Bradford chromatic adaptation of the recovered camera-neutral illuminant.
// Not an ICC/ForwardMatrix or camera-accuracy guarantee.
const D50=[0.96422,1,0.82521], D65=[0.95047,1,1.08883];
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
function invert(m){
  if(!Array.isArray(m)||m.length!==9||m.some(v=>!Number.isFinite(v)))invalid('некорректная ColorMatrix');
  const [a,b,c,d,e,f,g,h,i]=m;
  const cof=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];
  const det=a*cof[0]+b*cof[3]+c*cof[6];
  const scale=Math.max(...m.map(Math.abs));
  if(!Number.isFinite(det)||scale===0||Math.abs(det)<=1e-8*scale**3)
    invalid('вырожденная ColorMatrix');
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
export function dngCameraToLinearSrgb(color,{wbRed=1,wbBlue=1}={}){
  if(!color)return null; // Legacy files without a calibration retain explicit preview fallback.
  const {matrix1,matrix2,illuminant1,illuminant2,neutral}=color;
  if(!ILLUMINANT_KELVIN[illuminant1])invalid('неподдерживаемый CalibrationIlluminant1');
  invert(matrix1); if(matrix2)invert(matrix2); // Validate each profile, not just its blend.
  if(!Number.isFinite(wbRed)||wbRed<=0||!Number.isFinite(wbBlue)||wbBlue<=0)
    invalid('неверные пользовательские WB gains');
  if(Boolean(matrix2)!==Boolean(illuminant2)|| (matrix2&&!ILLUMINANT_KELVIN[illuminant2]))
    invalid('неполная или неподдерживаемая двойная CalibrationIlluminant/ColorMatrix');
  if(matrix2&&illuminant1===illuminant2)invalid('совпадающие CalibrationIlluminant');
  // AsShotNeutral determines the capture illuminant. UI R/B gains are applied
  // in the camera domain *after* choosing the profile; recomputing a whitepoint
  // from arbitrary UI gains can yield non-physical Bradford cone responses.
  const white=[...neutral];
  if(white.some(v=>!Number.isFinite(v)||v<=0))invalid('неверный баланс белого DNG');
  let matrix=matrix1;
  if(matrix2){
    // Dual-illuminant reciprocal-K interpolation; iterative neutral -> xy -> CCT.
    // McCamy CCT is an approximation, not a colour-critical camera profile.
    let weight=0.5;
    for(let j=0;j<5;j++){
      matrix=matrix1.map((v,i)=>v*weight+matrix2[i]*(1-weight));
      const xyz=dot(invert(matrix),white);
      const kelvin=temperature(xyz);
      const t1=ILLUMINANT_KELVIN[illuminant1],t2=ILLUMINANT_KELVIN[illuminant2];
      weight=Math.max(0,Math.min(1,(1/kelvin-1/t2)/(1/t1-1/t2)));
    }
    matrix=matrix1.map((v,i)=>v*weight+matrix2[i]*(1-weight));
  }
  const cameraToXyz=invert(matrix);
  const illuminantXyz=dot(cameraToXyz,white);
  const xyzToD50=adapt(illuminantXyz,D50);
  const d50ToD65=adapt(D50,D65);
  const transform=multiply(XYZ_D65_TO_RGB,multiply(d50ToD65,multiply(xyzToD50,cameraToXyz)));
  if(transform.some(v=>!Number.isFinite(v)))invalid('неверное цветовое преобразование DNG');
  return multiply(transform,[wbRed,0,0,0,1,0,0,0,wbBlue]);
}
export function applyDngColorMatrix(transform,r,g,b){
  return dot(transform,[r,g,b]);
}
