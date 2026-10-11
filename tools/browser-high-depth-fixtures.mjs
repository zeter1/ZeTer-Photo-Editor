import { createPixelBuffer } from '../src/core/pixel-buffer.js';
import { encodePsd, encodePsb } from '../src/formats/psd.js';

// ZeTer-authored fixtures: transport/precision smoke tests, not independent Adobe goldens.
const cases = {
  rgb16: {
    filename:'stage003-browser-rgb16.psd',
    version:1, bitsPerChannel:16, ArrayType:Uint16Array,
    colorSpace:'srgb', encode:encodePsd,
    normal:[10_000,20_000,30_000,65_535],
    damaged:[59_000,1_000,1_000,65_535],
  },
  rgb32psb: {
    filename:'stage003-browser-rgb32.psb',
    version:2, bitsPerChannel:32, ArrayType:Float32Array,
    colorSpace:'linear-rgb-unmanaged', encode:encodePsb,
    normal:[0.125,0.25,0.375,1],
    damaged:[4,0.0625,0.0625,1],
  },
};

export function createBrowserHighDepthFixture(key) {
  const config=cases[key];
  if (!config) throw new RangeError('Unknown browser high-depth fixture: '+key);
  const width=8,height=8,channels=4,defectX=4,defectY=4;
  const samples=new config.ArrayType(width*height*channels);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    samples.set(x===defectX&&y===defectY?config.damaged:config.normal,
      (y*width+x)*channels);
  }
  const pixels=createPixelBuffer({
    width,height,model:'rgb',channels,
    bitsPerChannel:config.bitsPerChannel,colorSpace:config.colorSpace,data:samples,
  });
  const bytes=config.encode({
    width,height,bitsPerChannel:config.bitsPerChannel,compositePixelBuffer:pixels,
    layers:[{name:'Stage 003 native layer',x:0,y:0,width,height,pixelBuffer:pixels,
      opacity:1,blendMode:'source-over',visible:true}],
  });
  return {
    filename:config.filename,bytes,version:config.version,
    bitsPerChannel:config.bitsPerChannel,width,height,channels,
    defectX,defectY,
    normal:config.normal,damaged:config.damaged,
    nativeArrayType:config.ArrayType.name,
  };
}
