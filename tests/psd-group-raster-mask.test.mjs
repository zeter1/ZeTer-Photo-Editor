import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePsd, encodePsb, decodePsd } from '../src/formats/psd.js';
import { createDocument, createLayerGroup, sanitizeProject } from '../src/core/state.js';

const rgba = (...alpha) => Uint8Array.from(alpha.flatMap(a => [255, 255, 255, a]));
const pixel = Uint8Array.from([255, 0, 0, 255, 255, 0, 0, 255]);
const groupMask = { pixels: rgba(255, 0), x: 0, y: 0, width: 2, height: 1, defaultColor: 255 };
const options = {
  width: 2, height: 1, composite: pixel,
  groups: [{ key: 'folder', name: 'Folder mask', blendMode: 'multiply', opacity: 1,
    mask: groupMask }],
  layers: [{ name: 'Ink', groupKey: 'folder', x: 0, y: 0, width: 2, height: 1,
    pixels: pixel, blendMode: 'source-over', opacity: 1, visible: true }],
};
const maskAlphas = mask => Array.from(mask.pixels).filter((_, i) => i % 4 === 3);

for (const [extension, encode] of [['PSD', encodePsd], ['PSB', encodePsb]]) {
  test(`${extension}: native folder-mask channel survives two structural round-trips`, async () => {
    const first = await decodePsd(encode(options));
    assert.equal(first.groups.length, 1);
    assert.ok(first.groups[0].mask, 'Folder marker mask must not be flattened or discarded');
    assert.deepEqual(maskAlphas(first.groups[0].mask), [255, 0]);
    const nextOptions = { ...options,
      groups: first.groups.map(g => ({...g, mask: g.mask})),
      layers: first.layers.map(l => ({ ...l, pixels: l.pixelBuffer.data })),
    };
    const second = await decodePsd(encode(nextOptions));
    assert.deepEqual(maskAlphas(second.groups[0].mask), [255, 0]);
  });
}

test('native project sanitizer preserves raster group mask without affecting unmasked legacy groups', () => {
  const doc = createDocument({width:2,height:1});
  doc.groups = [
    createLayerGroup({id:'masked',mask:{enabled:true,dataUrl:'data:image/png;base64,AA==',density:1}}),
    createLayerGroup({id:'legacy'}),
  ];
  const restored = sanitizeProject(doc);
  assert.equal(restored.groups[0].mask?.dataUrl, 'data:image/png;base64,AA==');
  assert.equal(restored.groups[1].mask, null);
});

for (const [extension, encode] of [['PSD', encodePsd], ['PSB', encodePsb]]) {
  test(`${extension}: nested folder masks retain independent bounds and disabled flags`, async () => {
    const ink = Uint8Array.from(Array.from({length:3}, () => [32,90,140,255]).flat());
    const doc = {
      width:3,height:1,composite:ink,
      groups:[
        {key:'parent',name:'Parent',blendMode:'pass-through',opacity:1,
          mask:{pixels:rgba(0,255,0),x:0,y:0,width:3,height:1,defaultColor:255}},
        {key:'child',parentKey:'parent',name:'Child',blendMode:'multiply',opacity:0.5,
          mask:{pixels:rgba(0),x:1,y:0,width:1,height:1,defaultColor:255,disabled:true}},
      ],
      layers:[{name:'Ink',groupKey:'child',x:0,y:0,width:3,height:1,pixels:ink,
        blendMode:'source-over',opacity:1,visible:true}],
    };
    const imported=await decodePsd(encode(doc));
    const byName=new Map(imported.groups.map(group=>[group.name,group]));
    assert.deepEqual(maskAlphas(byName.get('Parent')?.mask),[0,255,0]);
    assert.equal(byName.get('Child')?.mask?.disabled,true);
    assert.deepEqual(maskAlphas(byName.get('Child')?.mask),[255,0,255]);
    assert.equal(byName.get('Child')?.parentKey,byName.get('Parent')?.key);
  });
}
