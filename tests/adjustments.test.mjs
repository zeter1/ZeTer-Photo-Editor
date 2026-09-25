import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAdjustmentPixels, compositeAdjustmentPixels, sanitizeAdjustmentModel, adjustmentModelEqual } from '../src/core/adjustments.js';
import { sanitizeProject } from '../src/core/state.js';

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


test('Stage 16c sanitizes Invert, Posterize and Threshold parameters',()=>{
  assert.deepEqual(sanitizeAdjustmentModel({kind:'invert',garbage:true}),{kind:'invert'});
  assert.deepEqual(sanitizeAdjustmentModel({kind:'posterize',levels:1}),{kind:'posterize',levels:2});
  assert.deepEqual(sanitizeAdjustmentModel({kind:'threshold',level:999}),{kind:'threshold',level:255});
});

test('Stage 16c renders Invert, Posterize and Threshold while preserving alpha',()=>{
  const inverted=pixel(10,20,30,77);
  applyAdjustmentPixels(inverted,{kind:'invert'});
  assert.deepEqual([...inverted.data],[245,235,225,77]);

  const posterized=pixel(64,128,192,91);
  applyAdjustmentPixels(posterized,{kind:'posterize',levels:4});
  assert.deepEqual([...posterized.data],[85,170,255,91]);

  const thresholded=pixel(200,120,100,63);
  applyAdjustmentPixels(thresholded,{kind:'threshold',level:128});
  assert.deepEqual([...thresholded.data],[255,255,255,63]);
});

test('Stage 16c project sanitizer preserves native simple adjustment metadata',()=>{
  const sanitized=sanitizeProject({
    width:2,height:1,name:'Adjustment persistence',background:'transparent',groups:[],selectedLayerId:'adj-1',
    layers:[{
      id:'adj-1',type:'adjustment',name:'Invert',visible:true,opacity:1,
      adjustment:{kind:'invert'},
      psdAdjustment:{
        kind:'invert',baseline:{kind:'invert'},channelIds:[-1,0,1,2],
        blocks:[{signature:'8BIM',key:'nvrt',dataUrl:'data:application/octet-stream;base64,'}],
      },
    }],
  });
  assert.deepEqual(sanitized.layers[0].adjustment,{kind:'invert'});
  assert.equal(sanitized.layers[0].psdAdjustment.kind,'invert');
  assert.equal(sanitized.layers[0].psdAdjustment.blocks[0].key,'nvrt');
});


test('adjustment compositing preserves semi-transparent destination alpha and mask coverage',()=>{
  const full={data:new Uint8ClampedArray([100,100,100,128])};
  compositeAdjustmentPixels(full,{data:new Uint8ClampedArray([200,50,0,128])},{opacity:1,blendMode:'source-over'});
  assert.deepEqual([...full.data],[200,50,0,128]);

  const masked={data:new Uint8ClampedArray([100,100,100,128])};
  compositeAdjustmentPixels(masked,{data:new Uint8ClampedArray([200,50,0,64])},{opacity:.5,blendMode:'source-over'});
  assert.deepEqual([...masked.data],[125,88,75,128]);
});

test('adjustment compositing applies supported blend modes without changing alpha',()=>{
  const base={data:new Uint8ClampedArray([128,128,128,77])};
  compositeAdjustmentPixels(base,{data:new Uint8ClampedArray([128,128,128,77])},{blendMode:'multiply'});
  assert.deepEqual([...base.data],[64,64,64,77]);
});
