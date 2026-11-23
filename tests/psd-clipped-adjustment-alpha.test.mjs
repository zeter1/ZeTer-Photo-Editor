import test from 'node:test';
import assert from 'node:assert/strict';
import { compositeClippedAdjustmentPixels } from '../src/core/adjustments.js';

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
