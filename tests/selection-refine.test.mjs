import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refineMaskAlpha } from '../src/core/pixels.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

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

test('Select & Mask Stage 9a is wired to layer masks with bounded processing',()=>{
  assert.match(main,/refineMaskAlpha/);
  assert.match(main,/async function refineSelectionToLayerMask\(\)/);
  assert.match(main,/Уточнить выделение → маска/);
  assert.match(main,/pixels>12_000_000/);
  assert.match(main,/selectionMaskDataUrl\(layer,options\)/);
});
