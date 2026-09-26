import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refineMaskAlpha, refineMaskEdgeAware, composeMaskPreviewRgba } from '../src/core/pixels.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const maskController = await readFile(new URL('../src/selection/mask-controller.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

const mask = (width,height,points) => {
  const alpha=new Uint8ClampedArray(width*height);
  for(const [x,y,value=255] of points) alpha[y*width+x]=value;
  return alpha;
};

test('selection refinement expands and contracts masks deterministically',()=>{
  const expanded=refineMaskAlpha(mask(5,5,[[2,2]]),5,5,{shift:1});
  const selected=[];
  for(let y=0;y<5;y+=1)for(let x=0;x<5;x+=1)if(expanded[y*5+x]===255)selected.push([x,y]);
  assert.equal(selected.length,9);
  assert.deepEqual(selected[0],[1,1]);
  assert.deepEqual(selected.at(-1),[3,3]);

  const block=[];
  for(let y=1;y<=3;y+=1)for(let x=1;x<=3;x+=1)block.push([x,y]);
  const contracted=refineMaskAlpha(mask(5,5,block),5,5,{shift:-1});
  assert.equal(contracted.reduce((sum,value)=>sum+(value===255),0),1);
  assert.equal(contracted[2*5+2],255);
});

test('selection smoothing removes isolated one-pixel noise',()=>{
  const refined=refineMaskAlpha(mask(5,5,[[2,2]]),5,5,{smooth:1});
  assert.equal(refined.every(value=>value===0),true);
});

test('selection feather creates soft alpha and contrast tightens that transition',()=>{
  const block=[];
  for(let y=1;y<=3;y+=1)for(let x=1;x<=3;x+=1)block.push([x,y]);
  const soft=refineMaskAlpha(mask(5,5,block),5,5,{feather:2});
  assert.ok(soft.some(value=>value>0&&value<255));
  const contrasted=refineMaskAlpha(soft,5,5,{contrast:100});
  const softDistance=Math.abs(soft[2*5+0]-128);
  const contrastedDistance=Math.abs(contrasted[2*5+0]-128);
  assert.ok(contrastedDistance>=softDistance);
});

test('selection refinement can invert the output mask',()=>{
  const source=mask(2,1,[[0,0]]);
  assert.deepEqual([...refineMaskAlpha(source,2,1,{invert:true})],[0,255]);
});


test('edge-aware refinement recovers a subject-colored strand just outside a rough mask',()=>{
  const width=7,height=3;
  const alpha=new Uint8ClampedArray(width*height);
  const rgba=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y+=1){
    for(let x=0;x<width;x+=1){
      const index=y*width+x;
      alpha[index]=x<=2?255:0;
      const subject=x<=3;
      const offset=index*4;
      rgba[offset]=subject?220:20;
      rgba[offset+1]=subject?45:70;
      rgba[offset+2]=subject?35:220;
      rgba[offset+3]=255;
    }
  }
  const refined=refineMaskEdgeAware(alpha,rgba,width,height,{radius:1,strength:100,smart:true});
  assert.ok(refined[1*width+3]>128,'subject-colored fringe should be recovered');
  assert.ok(refined[1*width+4]<64,'background should remain excluded');
});

test('smart radius stays conservative when foreground and background colors are indistinguishable',()=>{
  const width=7,height=3;
  const alpha=new Uint8ClampedArray(width*height);
  const rgba=new Uint8ClampedArray(width*height*4);
  for(let index=0;index<width*height;index+=1){
    alpha[index]=(index%width)<=2?255:0;
    const offset=index*4;
    rgba[offset]=rgba[offset+1]=rgba[offset+2]=120;
    rgba[offset+3]=255;
  }
  const refined=refineMaskEdgeAware(alpha,rgba,width,height,{radius:1,strength:100,smart:true});
  assert.deepEqual([...refined],[...alpha]);
});

test('refineMaskAlpha applies edge detection before feather/contrast when a source is provided',()=>{
  const width=7,height=3;
  const alpha=new Uint8ClampedArray(width*height);
  const rgba=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){
    const index=y*width+x;alpha[index]=x<=2?255:0;
    const offset=index*4;const subject=x<=3;
    rgba[offset]=subject?230:10;rgba[offset+1]=subject?40:80;rgba[offset+2]=subject?30:230;rgba[offset+3]=255;
  }
  const refined=refineMaskAlpha(alpha,width,height,{edgeRadius:1,edgeStrength:100,smartRadius:true,sourceRgba:rgba});
  assert.ok(refined[1*width+3]>128);
});


test('Select & Mask preview compositor supports mask, overlay, black and white views',()=>{
  const source=Uint8ClampedArray.from([
    100,150,200,255,
    50,100,150,128,
  ]);
  const maskAlpha=Uint8ClampedArray.from([255,0]);

  assert.deepEqual(
    [...composeMaskPreviewRgba(source,maskAlpha,2,1,{mode:'mask'})],
    [255,255,255,255, 0,0,0,255],
  );

  const black=composeMaskPreviewRgba(source,maskAlpha,2,1,{mode:'black'});
  assert.deepEqual([...black.slice(0,4)],[100,150,200,255]);
  assert.deepEqual([...black.slice(4,8)],[0,0,0,255]);

  const white=composeMaskPreviewRgba(source,maskAlpha,2,1,{mode:'white'});
  assert.deepEqual([...white.slice(0,4)],[100,150,200,255]);
  assert.deepEqual([...white.slice(4,8)],[255,255,255,255]);

  const overlay=composeMaskPreviewRgba(source,maskAlpha,2,1,{mode:'overlay',overlay:[255,0,0],overlayOpacity:1});
  assert.deepEqual([...overlay.slice(0,4)],[100,150,200,255]);
  assert.deepEqual([...overlay.slice(4,8)],[255,0,0,255]);
});

test('Select & Mask Stage 9a is routed through the canonical raster-mask controller',()=>{
  assert.match(main,/createSelectionMaskController/);
  assert.match(maskController,/refineMaskAlpha/);
  assert.match(maskController,/async function refineSelectionToLayerMask\(\)/);
  assert.match(maskController,/Уточнить выделение → маска/);
  assert.match(maskController,/pixels\s*>\s*12_000_000/);
  assert.match(maskController,/selectionMaskDataUrlForOwner\(layer, options/);
});

test('Select & Mask Stage 9b keeps non-destructive preview lifecycle in the canonical owner',()=>{
  assert.match(maskController,/function selectionRefineOptionsFromValues\(/);
  assert.match(maskController,/async function buildSelectionRefinePreviewSource\(/);
  assert.match(maskController,/async function attachSelectionRefinePreview\(/);
  assert.match(maskController,/const previewOwners = new WeakMap\(\)/);
  assert.match(maskController,/modal\.previewCleanup = \(\) =>/);
  assert.match(maskController,/requestFrame\(renderPreview\)/);
  assert.match(maskController,/документ изменится только после применения/i);
  assert.match(maskController,/const replacing = Boolean\(layer\.mask\)/);
  assert.match(styles,/\.selection-refine-preview/);
  assert.match(styles,/\.selection-refine-modal/);
});

test('Select & Mask Stage 9c keeps bounded edge-aware refinement in the canonical owner',()=>{
  assert.match(maskController,/async function selectionRefineSourceRgba\(/);
  assert.match(maskController,/detectionRadius > 0/);
  assert.match(maskController,/sourceRgba/);
  assert.match(maskController,/name:'edgeRadius'/);
  assert.match(maskController,/name:'edgeStrength'/);
  assert.match(maskController,/name:'smartRadius'/);
  assert.match(maskController,/pixels \* Math\.max\(1, detectionRadius\) > 48_000_000/);
});

test('Select & Mask Stage 9d exposes professional preview modes without mutating output settings',()=>{
  assert.match(maskController,/name:'viewMode'/);
  assert.match(maskController,/Чёрно-белая маска/);
  assert.match(maskController,/Наложение/);
  assert.match(maskController,/На чёрном/);
  assert.match(maskController,/На белом/);
  assert.match(maskController,/composeMaskPreviewRgba\(/);
  assert.match(maskController,/mode:values\.viewMode \|\| 'mask'/);
});
