import test from 'node:test';
import assert from 'node:assert/strict';
import { compositeClippedAdjustmentPixels, compositeAdjustmentPixels, compositeClippedRasterPixels } from '../src/core/adjustments.js';

function rgba(...values) {
  return {data: Uint8ClampedArray.from(values)};
}

test('clipped adjustment changes the translucent base, not an opaque blue backdrop', () => {
  const target = rgba(128, 0, 127, 255);
  const base = rgba(255, 0, 0, 128);
  const inverted = rgba(0, 255, 255, 128);
  compositeClippedAdjustmentPixels(target, base, inverted);
  assert.deepEqual(Array.from(target.data), [0, 128, 255, 255]);
  assert.deepEqual(Array.from(base.data), [255, 0, 0, 128], 'clipping source is immutable');
});

test('clipped adjustment preserves partially transparent backdrop and group coverage', () => {
  const target = rgba(170, 0, 85, 192, 170, 0, 85, 192);
  const base = rgba(255, 0, 0, 128, 255, 0, 0, 128);
  const inverted = rgba(0, 255, 255, 128, 0, 255, 255, 64);
  compositeClippedAdjustmentPixels(target, base, inverted);
  assert.deepEqual(Array.from(target.data), [0, 170, 255, 192, 85, 85, 170, 192]);
});

test('clipped adjustment never creates pixels outside its base or from transparent background', () => {
  const target = rgba(0, 0, 255, 128, 0, 0, 0, 0);
  const base = rgba(0, 0, 0, 0, 0, 0, 0, 0);
  const effect = rgba(255, 255, 255, 255, 255, 255, 255, 255);
  compositeClippedAdjustmentPixels(target, base, effect);
  assert.deepEqual(Array.from(target.data), [0, 0, 255, 128, 0, 0, 0, 0]);
});

// PSD/PSB binary codec must preserve the editable nested adjustment structure;
// the browser compositor deliberately operates on the imported native fields.
import { encodePsd, encodePsb, decodePsd } from '../src/formats/psd.js';

for (const [format, encode] of [['PSD', encodePsd], ['PSB', encodePsb]]) {
  test(format + ' retains nested group mask, semitransparent base and clipped Invert records', async () => {
    const rgba = color => Uint8Array.from(Array.from({length:8}, () => color).flat());
    const mask = rgba([255,255,255,128]);
    const red = rgba([255,0,0,128]);
    const blue = rgba([0,0,255,128]);
    const fixture = {
      width:4,height:2,composite:blue,
      groups:[
        {key:'outer',name:'Outer Pass Through',blendMode:'pass-through',opacity:1,
          mask:{pixels:mask,x:0,y:0,width:4,height:2,defaultColor:255}},
        {key:'inner',parentKey:'outer',name:'Inner Pass Through',
          blendMode:'pass-through',opacity:1},
      ],
      layers:[
        {name:'Backdrop',x:0,y:0,width:4,height:2,pixels:blue,
          blendMode:'source-over',opacity:1,visible:true},
        {name:'Base',groupKey:'inner',x:0,y:0,width:4,height:2,pixels:red,
          blendMode:'source-over',opacity:1,visible:true},
        {name:'Clipped Invert',groupKey:'inner',x:0,y:0,width:0,height:0,
          blendMode:'source-over',opacity:1,visible:true,clipping:true,
          psdAdjustment:{kind:'invert',blocks:[{signature:'8BIM',key:'nvrt',
            data:new Uint8Array(0)}],channelIds:[]}},
      ],
    };
    const imported = await decodePsd(encode(fixture), {maxPixels:100,maxLayers:20});
    assert.equal(imported.groups.length,2);
    const outer = imported.groups.find(g => g.name === 'Outer Pass Through');
    const inner = imported.groups.find(g => g.name === 'Inner Pass Through');
    assert.ok(outer?.mask?.pixels,format+' native folder mask');
    assert.equal(inner?.parentKey,outer?.key,format+' nested group');
    assert.equal(imported.adjustmentLayers.length,1);
    assert.equal(imported.adjustmentLayers[0].clipping,true);
    assert.equal(imported.adjustmentLayers[0].psdAdjustment?.kind,'invert');
    assert.equal(imported.adjustmentLayers[0].groupKey,inner.key);
    const importedBase = imported.layers.find(l => l.name === 'Base');
    assert.equal(importedBase?.pixelBuffer?.data[3],128);
    assert.deepEqual(Array.from(outer.mask.pixels).filter((_,i)=>i%4===3),
      Array(8).fill(128));
  });
}

test('successive clipped adjustments share their corrected base colors without leaking backdrop', () => {
  const parent = rgba(170, 0, 85, 192);
  const stack = rgba(255, 0, 0, 128);
  const first = rgba(0, 255, 255, 128);
  compositeClippedAdjustmentPixels(parent, stack, first);
  compositeAdjustmentPixels(stack, first);
  assert.deepEqual(Array.from(parent.data), [0, 170, 255, 192]);
  assert.deepEqual(Array.from(stack.data), [0, 255, 255, 128]);

  const second = rgba(255, 0, 255, 128);
  compositeClippedAdjustmentPixels(parent, stack, second);
  compositeAdjustmentPixels(stack, second);
  assert.deepEqual(Array.from(parent.data), [170, 0, 255, 192]);
  assert.deepEqual(Array.from(stack.data), [255, 0, 255, 128]);
});

test('clipped Multiply raster updates the reusable stack, not backdrop alpha', () => {
  const target = rgba(170, 0, 85, 192);
  const stack = rgba(255, 0, 0, 128);
  const overlay = rgba(0, 0, 255, 255);
  compositeClippedRasterPixels(target, stack, overlay, { blendMode: 'multiply' });
  assert.deepEqual(Array.from(target.data), [0, 0, 85, 192]);
  assert.deepEqual(Array.from(stack.data), [0, 0, 0, 128]);
  const inverted = rgba(255, 255, 255, 128);
  compositeClippedAdjustmentPixels(target, stack, inverted);
  compositeAdjustmentPixels(stack, inverted);
  assert.deepEqual(Array.from(target.data), [170, 170, 255, 192]);
  assert.deepEqual(Array.from(stack.data), [255, 255, 255, 128]);
});

test('clipped Screen raster respects partial opacity and never doubles base alpha', () => {
  const target = rgba(170, 0, 85, 192, 0, 0, 255, 128);
  const stack = rgba(255, 0, 0, 128, 0, 0, 0, 0);
  const overlay = rgba(0, 0, 255, 128, 255, 255, 255, 255);
  compositeClippedRasterPixels(target, stack, overlay, { blendMode: 'screen' });
  assert.deepEqual(Array.from(target.data), [170, 0, 170, 192, 0, 0, 255, 128]);
  assert.deepEqual(Array.from(stack.data), [255, 0, 128, 128, 0, 0, 0, 0]);
});

test('clipped raster does not alter a stack with zero overlay mask alpha', () => {
  const target = rgba(170, 0, 85, 192);
  const stack = rgba(255, 0, 0, 128);
  compositeClippedRasterPixels(target, stack, rgba(0, 0, 255, 0), { blendMode: 'screen' });
  assert.deepEqual(Array.from(target.data), [170, 0, 85, 192]);
  assert.deepEqual(Array.from(stack.data), [255, 0, 0, 128]);
});

for (const [format, encode] of [['PSD', encodePsd], ['PSB', encodePsb]]) {
  for (const mode of ['multiply', 'screen']) {
    test(format + ' preserves native nested clipped raster ' + mode + ' then Invert', async () => {
      const pixel = rgba => Uint8Array.from(Array.from({length:8}, () => rgba).flat());
      const mask = pixel([255,255,255,128]);
      const fixture = {
        width:4,height:2,composite:pixel([0,0,255,128]),
        groups:[
          {key:'outer',name:'Masked outer',blendMode:'pass-through',
            mask:{pixels:mask,x:0,y:0,width:4,height:2,defaultColor:255}},
          {key:'inner',name:'Inner',parentKey:'outer',blendMode:'pass-through'},
        ],
        layers:[
          {name:'Backdrop',x:0,y:0,width:4,height:2,pixels:pixel([0,0,255,128]),
            blendMode:'source-over',visible:true},
          {name:'Base',groupKey:'inner',x:0,y:0,width:4,height:2,
            pixels:pixel([255,0,0,128]),blendMode:'source-over',visible:true},
          {name:'Overlay',groupKey:'inner',x:0,y:0,width:4,height:2,
            pixels:pixel([0,0,255,255]),blendMode:mode,opacity:.5,
            visible:true,clipping:true},
          {name:'Invert',groupKey:'inner',x:0,y:0,width:0,height:0,
            clipping:true,visible:true,blendMode:'source-over',
            psdAdjustment:{kind:'invert',blocks:[{signature:'8BIM',
              key:'nvrt',data:new Uint8Array(0)}],channelIds:[]}},
        ],
      };
      const parsed = await decodePsd(encode(fixture), {maxPixels:100,maxLayers:20});
      const outer = parsed.groups.find(x => x.name === 'Masked outer');
      const inner = parsed.groups.find(x => x.name === 'Inner');
      const overlay = parsed.layers.find(x => x.name === 'Overlay');
      const invert = parsed.adjustmentLayers.find(x => x.name === 'Invert');
      assert.ok(outer?.mask?.pixels, 'editable native folder mask');
      assert.equal(inner?.parentKey, outer.key);
      assert.equal(overlay?.groupKey, inner.key);
      assert.equal(overlay?.clipping, true);
      assert.equal(overlay?.blendMode, mode);
      assert.ok(Math.abs(overlay.opacity - .5) < .005);
      assert.equal(overlay?.pixelBuffer?.data[2], 255);
      assert.equal(invert?.clipping, true);
      assert.equal(invert?.groupKey, inner.key);
      assert.equal(invert?.psdAdjustment?.kind, 'invert');
    });
  }
}

import { psdAdjustmentNativePlan } from '../src/document/psd-native-metadata-plans.js';

test('ZPE-created clipped Invert exports editable native Photoshop nvrt in PSD and PSB', async () => {
  const plan=psdAdjustmentNativePlan({
    type:'adjustment',adjustment:{kind:'invert'},styles:null,filters:{},
  });
  assert.equal(plan.eligible,true,plan.reason);
  assert.equal(plan.metadata.blocks.length,1);
  assert.equal(plan.metadata.blocks[0].key,'nvrt');
  assert.equal(plan.metadata.blocks[0].data.byteLength,0);
  const color=rgba=>Uint8Array.from([rgba[0],rgba[1],rgba[2],rgba[3]]);
  for(const [format,encode] of [['PSD',encodePsd],['PSB',encodePsb]]) {
    const binary=encode({
      width:1,height:1,composite:color([0,255,255,255]),
      groups:[],layers:[
        {name:'Base',x:0,y:0,width:1,height:1,pixels:color([255,0,0,255]),
          blendMode:'source-over',visible:true},
        {name:'Editable Invert',x:0,y:0,width:0,height:0,
          clipping:true,visible:true,psdAdjustment:plan.metadata},
      ],
    });
    const decoded=await decodePsd(binary,{maxPixels:16,maxLayers:8});
    const invert=decoded.adjustmentLayers.find(layer=>layer.name==='Editable Invert');
    assert.equal(invert?.clipping,true,format+' keeps clipping');
    assert.equal(invert?.psdAdjustment?.kind,'invert',format+' keeps editable type');
    assert.deepEqual(invert?.psdAdjustment?.parsed,{kind:'invert'});
  }
});


// ZPE-created native simple adjustments have a big-endian u16 and two reserved bytes.
for (const [model,key,value] of [
  [{kind:'posterize',levels:7},'post',7],
  [{kind:'threshold',level:173},'thrs',173],
]) {
  test('new editable '+model.kind+' writes native PSD and PSB',async()=>{
    const plan=psdAdjustmentNativePlan({type:'adjustment',adjustment:model,styles:null,filters:{}});
    assert.equal(plan.eligible,true,plan.reason);
    assert.equal(plan.metadata.blocks[0].key,key);
    assert.deepEqual([...plan.metadata.blocks[0].data],[0,value,0,0]);
    for (const encode of [encodePsd,encodePsb]) {
      const decoded=await decodePsd(encode({width:1,height:1,composite:new Uint8Array([0,0,0,255]),
        layers:[{name:'base',x:0,y:0,width:1,height:1,pixels:new Uint8Array([127,127,127,255]),visible:true},
          {name:model.kind,x:0,y:0,width:0,height:0,clipping:true,visible:true,psdAdjustment:plan.metadata}]}),
        {maxPixels:16,maxLayers:8});
      assert.equal(decoded.adjustmentLayers.length,1);
      assert.equal(decoded.adjustmentLayers[0].clipping,true);
      assert.deepEqual(decoded.adjustmentLayers[0].psdAdjustment.parsed,model);
    }
  });
}
