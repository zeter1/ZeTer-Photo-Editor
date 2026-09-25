import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refineMaskAlpha, refineMaskEdgeAware } from '../src/core/pixels.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
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

test('Select & Mask Stage 9a is wired to layer masks with bounded processing',()=>{
  assert.match(main,/refineMaskAlpha/);
  assert.match(main,/async function refineSelectionToLayerMask\(\)/);
  assert.match(main,/Уточнить выделение → маска/);
  assert.match(main,/pixels>12_000_000/);
  assert.match(main,/selectionMaskDataUrl\(layer,options\)/);
});


test('Select & Mask Stage 9b provides a non-destructive live mask preview',()=>{
  assert.match(main,/function selectionRefineOptionsFromValues\(/);
  assert.match(main,/function buildSelectionRefinePreviewSource\(/);
  assert.match(main,/function attachSelectionRefinePreview\(/);
  assert.match(main,/onMount:\(\{modal,body\}\)=>\{void attachSelectionRefinePreview\(modal,body,layer,scale\)/);
  assert.match(main,/requestAnimationFrame\(renderPreview\)/);
  assert.match(main,/document changed only after application|документ изменится только после применения/i);
  assert.match(main,/const replacing=Boolean\(layer\.mask\)/);
  assert.match(styles,/\.selection-refine-preview/);
  assert.match(styles,/\.selection-refine-modal/);
});


test('Select & Mask Stage 9c adds edge detection radius and smart radius to preview and final masks',()=>{
  assert.match(main,/async function selectionRefineSourceRgba\(/);
  assert.match(main,/sourceRgba=detectionRadius>0\?await selectionRefineSourceRgba/);
  assert.match(main,/sourceRgba:source\.sourceRgba/);
  assert.match(main,/name:'edgeRadius'/);
  assert.match(main,/name:'edgeStrength'/);
  assert.match(main,/name:'smartRadius'/);
  assert.match(main,/pixels\*Math\.max\(1,detectionRadius\)>48_000_000/);
});
