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
  rgb32psblarge: {
    filename:'stage003-browser-large-rgb32.psb',
    version:2, bitsPerChannel:32, ArrayType:Float32Array,
    colorSpace:'linear-rgb-unmanaged', encode:encodePsb,
    normal:[0.125,0.25,0.375,1],
    damaged:[4,0.0625,0.0625,1],
  },
  'rgb32psblarge-alt': {
    filename:'stage003-browser-large-rgb32-independent.psb',
    version:2, bitsPerChannel:32, ArrayType:Float32Array,
    colorSpace:'linear-rgb-unmanaged', encode:encodePsb,
    normal:[0.1875,0.3125,0.4375,1],
    damaged:[3,0.03125,0.125,1],
  },
  rgb16large: {
    filename:'stage003-browser-large-rgb16.psd',
    version:1, bitsPerChannel:16, ArrayType:Uint16Array,
    colorSpace:'srgb', encode:encodePsd,
    normal:[10_000,20_000,30_000,65_535],
    damaged:[59_000,1_000,1_000,65_535],
  },
};

export function createBrowserHighDepthFixture(key) {
  const config=cases[key];
  if (!config) throw new RangeError('Unknown browser high-depth fixture: '+key);
  // A 1025² RGBA16 / RGBA32 raster exceeds the 8 MiB v2 threshold.
  // Keep the conventional 8×8 fixtures small for fast precision smoke tests.
  const large=key==='rgb16large'||key==='rgb32psblarge'||key==='rgb32psblarge-alt';
  const width=large?1025:8,height=large?1025:8,channels=4;
  const defectX=large?Math.floor(width/2):4,defectY=large?Math.floor(height/2):4;
  const samples=new config.ArrayType(width*height*channels);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const defect=large
      ? Math.abs(x-defectX)<=2 && Math.abs(y-defectY)<=2
      : x===defectX&&y===defectY;
    samples.set(defect?config.damaged:config.normal,
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
    nativeArrayType:config.ArrayType.name,large,
  };
}
