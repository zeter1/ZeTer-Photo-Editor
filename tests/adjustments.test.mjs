import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAdjustmentPixels, sanitizeAdjustmentModel, adjustmentModelEqual } from '../src/core/adjustments.js';

function pixel(r,g,b,a=255){return {data:new Uint8ClampedArray([r,g,b,a])};}

test('Stage 16a adjustment sanitizer bounds production parameters',()=>{
  assert.deepEqual(sanitizeAdjustmentModel({kind:'brightness-contrast',brightness:999,contrast:-999}),{
    kind:'brightness-contrast',brightness:150,contrast:-100,legacy:false,
  });
  assert.deepEqual(sanitizeAdjustmentModel({kind:'exposure',exposure:99,offset:-99,gamma:0}),{
    kind:'exposure',exposure:20,offset:-2,gamma:.1,
  });
  const levels=sanitizeAdjustmentModel({kind:'levels',master:{inputBlack:250,inputWhite:20,gamma:50,outputBlack:-4,outputWhite:999}});
  assert.equal(levels.master.inputBlack,250);
  assert.equal(levels.master.inputWhite,252);
  assert.equal(levels.master.gamma,9.99);
  assert.equal(levels.master.outputBlack,0);
  assert.equal(levels.master.outputWhite,255);
});

test('Stage 16a exposure and levels semantic renderer changes RGB but preserves alpha',()=>{
  const exposure=pixel(64,128,192,77);
  applyAdjustmentPixels(exposure,{kind:'exposure',exposure:1,offset:0,gamma:1});
  assert.deepEqual([...exposure.data],[128,255,255,77]);

  const levels=pixel(64,128,192,99);
  applyAdjustmentPixels(levels,{kind:'levels',master:{inputBlack:64,inputWhite:192,gamma:1,outputBlack:0,outputWhite:255},channels:[]});
  assert.deepEqual([...levels.data],[0,128,255,99]);
});

test('Stage 16a hue/saturation and curves renderer follows bounded semantic model',()=>{
  const hue=pixel(255,0,0);
  applyAdjustmentPixels(hue,{kind:'hue-saturation',hue:120,saturation:0,lightness:0,colorize:false});
  assert.ok(hue.data[1]>240);
  assert.ok(hue.data[0]<15);
  assert.ok(hue.data[2]<15);

  const curves=pixel(64,128,192);
  applyAdjustmentPixels(curves,{kind:'curves',channels:[{id:0,points:[{input:0,output:255},{input:255,output:0}]}]});
  assert.deepEqual([...curves.data.slice(0,3)],[191,127,63]);
});

test('Stage 16a semantic equality ignores untrusted extra fields after normalization',()=>{
  assert.equal(adjustmentModelEqual(
    {kind:'exposure',exposure:1,offset:.1,gamma:1,garbage:'x'},
    {kind:'exposure',exposure:1,offset:.1,gamma:1}
  ),true);
});

test('Stage 16b Levels applies channel-specific records after master and Curves applies master + RGB channels',()=>{
  const levels=pixel(64,128,192);
  applyAdjustmentPixels(levels,{
    kind:'levels',
    master:{inputBlack:0,inputWhite:255,gamma:1,outputBlack:0,outputWhite:255},
    channels:[
      {id:1,inputBlack:64,inputWhite:255,gamma:1,outputBlack:0,outputWhite:255},
      {id:2,inputBlack:0,inputWhite:128,gamma:1,outputBlack:0,outputWhite:255},
      {id:3,inputBlack:0,inputWhite:255,gamma:1,outputBlack:0,outputWhite:128},
    ],
  });
  assert.deepEqual([...levels.data.slice(0,3)],[0,255,96]);

  const curves=pixel(64,128,192);
  applyAdjustmentPixels(curves,{
    kind:'curves',
    channels:[
      {id:0,points:[{input:0,output:0},{input:255,output:255}]},
      {id:1,points:[{input:0,output:255},{input:255,output:0}]},
      {id:2,points:[{input:0,output:0},{input:255,output:128}]},
      {id:3,points:[{input:0,output:64},{input:255,output:255}]},
    ],
  });
  assert.equal(curves.data[0],191);
  assert.ok(curves.data[1]>=63&&curves.data[1]<=65);
  assert.ok(curves.data[2]>=207&&curves.data[2]<=209);
});

