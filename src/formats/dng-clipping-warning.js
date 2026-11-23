// Display-only RAW clipping warning. Mutates a caller-owned ImageData buffer;
// do not pass native sensor samples, layer previews or export buffers here.
export function markDisplayClippingWarning(rgba) {
  if (!(rgba instanceof Uint8ClampedArray) || rgba.length % 4 !== 0)
    throw new TypeError('Expected Uint8ClampedArray RGBA display pixels');
  let highlights=0,shadows=0,eligible=0;
  for(let i=0;i<rgba.length;i+=4){
    const r=rgba[i],g=rgba[i+1],b=rgba[i+2];
    // Transparent / antialiased edge pixels are not reliable clipping evidence.
    if(rgba[i+3]<128)continue;
    eligible++;
    const high=r>=254||g>=254||b>=254;
    const low=r<=1&&g<=1&&b<=1;
    if(!high&&!low)continue;
    if(high)highlights++;
    else shadows++;
    // Magenta indicates at least one clipped output channel; cyan marks black.
    // A warning is NOT camera sensor saturation or highlight reconstruction.
    const marker=high?[255,0,255]:[0,255,255];
    rgba[i]=Math.round((r+marker[0])/2);
    rgba[i+1]=Math.round((g+marker[1])/2);
    rgba[i+2]=Math.round((b+marker[2])/2);
  }
  return {highlights,shadows,eligible};
}

/**
 * Mark only the visible Canvas, in bounded readback tiles. This never edits
 * RAW samples or the document render buffer; a newer render cancels the scan.
 * A tile is at most 1 MiB of RGBA regardless of image aspect ratio.
 */
export async function markDisplayClippingWarningOnCanvas(context,{
  width,height,maxTilePixels=262144,
  shouldContinue=()=>true,
  yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0)),
}={}) {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
     width<=0||height<=0||!Number.isSafeInteger(width*height))
    throw new RangeError('Invalid display canvas dimensions');
  if(typeof context?.getImageData!=='function'||typeof context?.putImageData!=='function')
    throw new TypeError('Display canvas context must provide getImageData and putImageData');
  if(!Number.isSafeInteger(maxTilePixels)||maxTilePixels<2||maxTilePixels>262144)
    throw new RangeError('Invalid bounded RGBA tile size');
  if(typeof shouldContinue!=='function'||typeof yieldFrame!=='function')
    throw new TypeError('Display scan callbacks must be functions');
  const tileWidth=Math.min(width,maxTilePixels);
  const tileHeight=Math.max(1,Math.floor(maxTilePixels/tileWidth));
  const summary={highlights:0,shadows:0,eligible:0};
  for(let y=0;y<height;y+=tileHeight){
    const h=Math.min(tileHeight,height-y);
    for(let x=0;x<width;x+=tileWidth){
      if(!shouldContinue())return null;
      const w=Math.min(tileWidth,width-x);
      const image=context.getImageData(x,y,w,h);
      const result=markDisplayClippingWarning(image.data);
      if(!shouldContinue())return null;
      if(result.highlights||result.shadows)context.putImageData(image,x,y);
      summary.highlights+=result.highlights;
      summary.shadows+=result.shadows;
      summary.eligible+=result.eligible;
      if(y+h<height||x+w<width){
        await yieldFrame();
      }
    }
  }
  return shouldContinue()?summary:null;
}
