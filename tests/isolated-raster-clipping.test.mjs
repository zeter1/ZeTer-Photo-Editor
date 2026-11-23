import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDocument, createRasterLayer, createLayerGroup, addLayer, addLayerGroup, sanitizeProject } from '../src/core/state.js';
import { createLayerPropertyCommandController } from '../src/layers/property-command-controller.js';

function harness(doc) {
  let active = doc;
  const commits = [];
  const controller = createLayerPropertyCommandController({
    state: { getDocument: () => active },
    transaction: { commit: label => commits.push(label) },
    rendering: { render() {} },
  });
  return { controller, commits, setActive: value => { active = value; } };
}

test('raster clipping is editable, history-backed, .zpe persistent and no-op-safe', () => {
  const doc = createDocument({ width: 4, height: 2 });
  const group = addLayerGroup(doc, createLayerGroup({ blendMode: 'multiply', opacity: .5 }));
  const base = addLayer(doc, createRasterLayer({ name: 'Masked base', groupId: group.id }));
  const clipped = addLayer(doc, createRasterLayer({ name: 'Clipped raster', groupId: group.id }));
  const h = harness(doc);

  assert.equal(h.controller.setClipping(doc, clipped.id, true), true);
  assert.equal(clipped.clipping, true);
  assert.deepEqual(h.commits, ['Изменить clipping растрового слоя']);
  assert.equal(h.controller.setClipping(doc, clipped.id, true), false);
  assert.equal(h.controller.setClipping(doc, base.id, 'true'), false);
  assert.equal(h.controller.setClipping(doc, base.id, null), false);
  const restored = sanitizeProject(JSON.parse(JSON.stringify(doc)));
  assert.equal(restored.groups[0].blendMode, 'multiply');
  assert.equal(restored.groups[0].opacity, .5);
  assert.equal(restored.layers.find(layer => layer.id === clipped.id).clipping, true);

  clipped.locked = true;
  assert.equal(h.controller.setClipping(doc, clipped.id, false), false);
  clipped.locked = false;
  group.locked = true;
  assert.equal(h.controller.setClipping(doc, clipped.id, false), false);
  group.locked = false;
  h.setActive(createDocument());
  assert.equal(h.controller.setClipping(doc, clipped.id, false), false);
  h.setActive(doc);
  assert.equal(h.controller.setClipping(doc, clipped.id, false), true);
  assert.equal(clipped.clipping, false);
  assert.deepEqual(h.commits, [
    'Изменить clipping растрового слоя',
    'Изменить clipping растрового слоя',
  ]);
});

test('clipped raster has its own alpha isolation against the base mask and preserves blend mode', () => {
  const render = readFileSync(new URL('../src/core/render.js', import.meta.url), 'utf8');
  assert.match(render, /if \(layer\.clipping === true && !clippingMask\) return/);
  assert.match(render, /const clippedCanvas = document\.createElement\('canvas'\)/);
  assert.match(render, /clippedCtx\.globalCompositeOperation = 'destination-in'/);
  assert.match(render, /clippedCtx\.drawImage\(clippingMask, 0, 0\)/);
  assert.match(render, /ctx\.globalCompositeOperation = layer\.blendMode \|\| 'source-over'/);
});

test('native PSD and PSB retain clipped raster, base mask and isolated multiply group across re-encode', async () => {
  const { encodePsd, encodePsb, decodePsd, inspectPsdHeader } = await import('../src/formats/psd.js');
  const pixel = ([r,g,b,a]) => [r,g,b,a];
  const pixels = (...values) => Uint8Array.from(values.flatMap(pixel));
  const blue = pixels(...Array.from({length:8}, () => [0,0,255,255]));
  const red = pixels(...Array.from({length:8}, () => [255,0,0,255]));
  const maskPixels = pixels(...Array.from({length:8}, (_,i) => [255,255,255,i%4<2?255:0]));
  const source={
    width:4,height:2,composite:pixels(...Array.from({length:8},()=>[255,127,127,255])),
    groups:[{key:'isolated',name:'Isolated',visible:true,opacity:.5,blendMode:'multiply',collapsed:false}],
    layers:[
      {name:'Masked base',groupKey:'isolated',x:0,y:0,width:4,height:2,
        pixels:blue,opacity:1,blendMode:'source-over',visible:true,
        mask:{pixels:maskPixels,width:4,height:2,x:0,y:0,defaultColor:255}},
      {name:'Clipped red',groupKey:'isolated',x:0,y:0,width:4,height:2,
        pixels:red,opacity:1,blendMode:'source-over',visible:true,clipping:true},
    ],
  };
  for(const [codec,version] of [[encodePsd,1],[encodePsb,2]]) {
    const binary=codec(source);
    assert.equal(inspectPsdHeader(binary).version,version);
    const decoded=await decodePsd(binary);
    assert.equal(decoded.groups.length,1);
    assert.equal(decoded.groups[0].blendMode,'multiply');
    assert.ok(Math.abs(decoded.groups[0].opacity-.5)<.004);
    const base=decoded.layers.find(layer=>layer.name==='Masked base');
    const top=decoded.layers.find(layer=>layer.name==='Clipped red');
    assert.ok(base?.mask?.pixels && top);
    assert.equal(top.clipping,true);
    assert.equal(base.groupKey,decoded.groups[0].key);
    assert.equal(top.groupKey,decoded.groups[0].key);
    assert.deepEqual([3,7,11,15].map(i=>base.mask.pixels[i]),[255,255,0,0]);
    const second=codec({
      width:decoded.width,height:decoded.height,composite:source.composite,
      groups:decoded.groups.map(group=>({
        key:group.key,parentKey:group.parentKey,name:group.name,
        visible:group.visible,collapsed:group.collapsed,opacity:group.opacity,blendMode:group.blendMode,
      })),
      layers:decoded.layers.map(layer=>({
        name:layer.name,groupKey:layer.groupKey,x:layer.x,y:layer.y,
        width:layer.width,height:layer.height,pixels:layer.pixelBuffer.data,
        opacity:layer.opacity,blendMode:layer.blendMode,visible:layer.visible,clipping:layer.clipping,
        ...(layer.mask?{mask:{pixels:layer.mask.pixels,width:4,height:2,x:0,y:0,defaultColor:255}}:{}),
      })),
    });
    const again=await decodePsd(second);
    assert.equal(again.layers.find(layer=>layer.name==='Clipped red').clipping,true);
    assert.equal(again.groups[0].blendMode,'multiply');
    assert.deepEqual(
      [3,7,11,15].map(i=>again.layers.find(layer=>layer.name==='Masked base').mask.pixels[i]),
      [255,255,0,0],
    );
  }
});
