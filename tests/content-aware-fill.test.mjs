import test from 'node:test';
import assert from 'node:assert/strict';
import { inpaintSelectedSamples } from '../src/core/inpaint.js';
import { createPixelBuffer, inpaintPixelBuffer } from '../src/core/pixel-buffer.js';

test('content-aware inpainting fills a selected RGBA8 hole from immutable surrounding donors', () => {
  const pixels = new Uint8ClampedArray([
    10,20,30,255,
    20,30,40,255,
    250,0,0,255,
    220,230,240,255,
    230,240,250,255,
  ]);
  assert.equal(inpaintSelectedSamples(pixels, 5, 1, 4, { isAllowed:x => x === 2 }), 1);
  assert.deepEqual([...pixels.slice(8,12)], [120,130,140,255]);
});

test('content-aware inpainting grows from both boundaries without making synthesized pixels donor authority', () => {
  const pixels = new Uint8ClampedArray([
    0,0,0,255, 20,20,20,255, 255,0,0,255, 255,0,0,255,
    255,0,0,255, 220,220,220,255, 240,240,240,255,
  ]);
  assert.equal(inpaintSelectedSamples(pixels, 7, 1, 4, { isAllowed:x => x >= 2 && x <= 4 }), 3);
  for (const x of [2,3,4]) {
    const offset=x*4;
    assert.equal(pixels[offset],pixels[offset+1]);
    assert.equal(pixels[offset+1],pixels[offset+2]);
    assert.equal(pixels[offset+3],255);
  }
  assert.ok(pixels[8] < pixels[12] && pixels[12] < pixels[16]);
});

test('content-aware inpainting leaves a fully selected layer untouched because no donors exist', () => {
  const pixels=new Uint8ClampedArray([10,20,30,255,40,50,60,255]);
  const before=[...pixels];
  assert.equal(inpaintSelectedSamples(pixels,2,1,4,{isAllowed:()=>true}),0);
  assert.deepEqual([...pixels],before);
});

test('content-aware PixelBuffer path preserves Float32 CMYK sample domain', () => {
  const buffer=createPixelBuffer({
    width:3,height:1,model:'cmyk',channels:5,bitsPerChannel:32,colorSpace:'cmyk-unmanaged',
    data:new Float32Array([.1,.2,.3,.4,1, 9,9,9,9,1, .9,.8,.7,.6,1]),
  });
  assert.equal(inpaintPixelBuffer(buffer,{isAllowed:x=>x===1}),1);
  for(let channel=5;channel<9;channel+=1) assert.ok(Math.abs(buffer.data[channel]-.5)<1e-6);
  assert.ok(Math.abs(buffer.data[9]-1)<1e-6);
  assert.equal(buffer.data.constructor,Float32Array);
});

test('content-aware PatchMatch refinement preserves a repeated stripe texture deterministically', () => {
  const width=9,height=5;
  const pristine=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y+=1){
    for(let x=0;x<width;x+=1){
      const offset=(y*width+x)*4;
      const value=x%2?230:20;
      pristine[offset]=value;
      pristine[offset+1]=value;
      pristine[offset+2]=value;
      pristine[offset+3]=255;
    }
  }
  const selected=(x,y)=>x>=3&&x<=5&&y>=1&&y<=3;
  const corrupted=()=>{
    const pixels=new Uint8ClampedArray(pristine);
    for(let y=1;y<=3;y+=1){
      for(let x=3;x<=5;x+=1){
        const offset=(y*width+x)*4;
        pixels[offset]=100;
        pixels[offset+1]=0;
        pixels[offset+2]=200;
        pixels[offset+3]=255;
      }
    }
    return pixels;
  };

  const first=corrupted();
  const second=corrupted();
  assert.equal(inpaintSelectedSamples(first,width,height,4,{isAllowed:selected}),9);
  assert.equal(inpaintSelectedSamples(second,width,height,4,{isAllowed:selected}),9);
  assert.deepEqual([...first],[...second]);

  for(let y=1;y<=3;y+=1){
    for(let x=3;x<=5;x+=1){
      const offset=(y*width+x)*4;
      assert.deepEqual([...first.slice(offset,offset+4)],[...pristine.slice(offset,offset+4)]);
    }
  }
});

test('content-aware fill can keep the bounded boundary-only fallback for large selections', () => {
  const pixels=new Uint8ClampedArray([
    0,0,0,255, 30,30,30,255, 250,0,0,255,
    240,0,0,255, 220,220,220,255, 250,250,250,255,
    10,10,10,255, 40,40,40,255, 70,70,70,255,
  ]);
  const selected=(x,y)=>x===1&&y<=1;
  assert.equal(inpaintSelectedSamples(pixels,3,3,4,{
    isAllowed:selected,
    patchMatchMaxFillPixels:1,
  }),2);
  assert.equal(pixels.constructor,Uint8ClampedArray);
  assert.equal(pixels[7],255);
  assert.equal(pixels[19],255);
});
