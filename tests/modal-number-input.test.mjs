import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const source=main.slice(main.indexOf('function normalizeNumberInput('),main.indexOf('\nfunction showModal(',main.indexOf('function normalizeNumberInput(')));
const context={clamp:(value,min,max)=>Math.max(min,Math.min(max,value))};
vm.runInNewContext(`${source}\nglobalThis.normalize=normalizeNumberInput;`,context);

function input(value,{min='',max='',step='',initial=''}={}){
  return {value:String(value),valueAsNumber:Number(value),min,max,step,dataset:{initialValue:String(initial)}};
}

test('modal numbers use the closest allowed step and stay within limits',()=>{
  const spacing=input(1.275,{min:'0.8',max:'3',step:'0.01',initial:1.18});
  context.normalize(spacing);
  assert.equal(spacing.value,'1.28');

  const letterSpacing=input(1.27,{min:'-5',max:'20',step:'0.5',initial:0});
  context.normalize(letterSpacing);
  assert.equal(letterSpacing.value,'1.5');

  const width=input(12001,{min:'1',max:'12000',initial:564});
  context.normalize(width);
  assert.equal(width.value,'12000');
});

test('empty numeric modal field restores its starting value',()=>{
  const spacing=input('',{min:'0.8',max:'3',step:'0.01',initial:1.18});
  spacing.valueAsNumber=NaN;
  context.normalize(spacing);
  assert.equal(spacing.value,'1.18');
});