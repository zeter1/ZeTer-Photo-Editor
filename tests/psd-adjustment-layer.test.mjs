import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decodePsd, encodePsd, encodePsb, rewritePsdAdjustmentBlocks } from '../src/adapters/psd.js';

const root=new URL('./fixtures/photoshop-adjustments/',import.meta.url);
const fixtureBytes=name=>readFile(new URL(name,root)).then(buffer=>new Uint8Array(buffer));
const fixtureJson=name=>readFile(new URL(name,root),'utf8').then(JSON.parse);
const sha256=value=>createHash('sha256').update(value).digest('hex');

function approx(actual,expected,tolerance=1e-5){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} vs ${expected}`);
}

test('Stage 16a pins five real MIT Photoshop adjustment fixtures',async()=>{
  const manifest=await fixtureJson('manifest.json');
  for(const item of manifest.fixtures){
    const data=await fixtureBytes(item.file);
    assert.equal(data.byteLength,item.size,item.file+' size');
    assert.equal(sha256(data),item.sha256,item.file+' sha256');
    assert.match(item.sourceGitBlob,/^[0-9a-f]{40}$/);
  }
});

test('Stage 16a decodes real zero-bounds Photoshop adjustment records into semantic layers',async()=>{
  const expected=new Map([
    ['brightness-contrast.psd','brightness-contrast'],
    ['exposure.psd','exposure'],
    ['hue-saturation.psd','hue-saturation'],
    ['levels.psd','levels'],
    ['curves.psd','curves'],
  ]);
  for(const [file,kind] of expected){
    const decoded=await decodePsd(await fixtureBytes(file),{maxPixels:2_000_000,maxLayers:50});
    assert.equal(decoded.layers.length,0,file+' raster layers');
    assert.equal(decoded.adjustmentLayers.length,1,file+' adjustment layers');
    const layer=decoded.adjustmentLayers[0];
    assert.equal(layer.psdAdjustment.kind,kind,file+' kind');
    assert.equal(layer.psdAdjustment.parsed.kind,kind,file+' parsed kind');
    assert.deepEqual(layer.channelIds,[-1,0,1,2,-2],file+' channel ids');
    assert.equal(layer.stackIndex,0,file+' stack index');
    assert.ok(layer.psdAdjustment.blocks.length>=1,file+' raw blocks');
  }
});

test('Stage 16a reads canonical default parameter values from real fixtures',async()=>{
  const brightness=(await decodePsd(await fixtureBytes('brightness-contrast.psd'))).adjustmentLayers[0].psdAdjustment.parsed;
  assert.deepEqual(brightness,{kind:'brightness-contrast',brightness:0,contrast:0,legacy:false});

  const exposure=(await decodePsd(await fixtureBytes('exposure.psd'))).adjustmentLayers[0].psdAdjustment.parsed;
  assert.equal(exposure.exposure,0);assert.equal(exposure.offset,0);assert.equal(exposure.gamma,1);

  const hue=(await decodePsd(await fixtureBytes('hue-saturation.psd'))).adjustmentLayers[0].psdAdjustment.parsed;
  assert.equal(hue.hue,0);assert.equal(hue.saturation,0);assert.equal(hue.lightness,0);assert.equal(hue.colorize,false);

  const levels=(await decodePsd(await fixtureBytes('levels.psd'))).adjustmentLayers[0].psdAdjustment.parsed;
  assert.deepEqual(levels.master,{inputBlack:0,inputWhite:255,outputBlack:0,outputWhite:255,gamma:1});

  const curves=(await decodePsd(await fixtureBytes('curves.psd'))).adjustmentLayers[0].psdAdjustment.parsed;
  assert.equal(curves.version,1);assert.equal(curves.extraVersion,4);assert.deepEqual(curves.channels,[]);
});

test('Stage 16a rewrites editable adjustment parameters and round-trips them through PSD and PSB',async()=>{
  const cases=[
    ['brightness-contrast.psd',{kind:'brightness-contrast',brightness:23,contrast:70,legacy:false},parsed=>{assert.equal(parsed.brightness,23);assert.equal(parsed.contrast,70);} ],
    ['exposure.psd',{kind:'exposure',exposure:1.25,offset:.125,gamma:1.2},parsed=>{approx(parsed.exposure,1.25);approx(parsed.offset,.125);approx(parsed.gamma,1.2);} ],
    ['hue-saturation.psd',{kind:'hue-saturation',hue:30,saturation:20,lightness:-10,colorize:false},parsed=>{assert.equal(parsed.hue,30);assert.equal(parsed.saturation,20);assert.equal(parsed.lightness,-10);} ],
    ['levels.psd',{kind:'levels',master:{inputBlack:10,inputWhite:240,outputBlack:5,outputWhite:250,gamma:1.25},channels:[]},parsed=>{assert.deepEqual(parsed.master,{inputBlack:10,inputWhite:240,outputBlack:5,outputWhite:250,gamma:1.25});} ],
  ];
  for(const [file,model,verify] of cases){
    const source=await decodePsd(await fixtureBytes(file),{maxPixels:2_000_000,maxLayers:50});
    const layer=source.adjustmentLayers[0];
    const rewritten=rewritePsdAdjustmentBlocks(layer.psdAdjustment.blocks,model);
    for(const [format,encoded] of [
      ['PSD',encodePsd({width:source.width,height:source.height,bitsPerChannel:8,colorMode:3,layers:[{name:layer.name,x:0,y:0,width:0,height:0,opacity:layer.opacity,blendMode:layer.blendMode,visible:true,psdAdjustment:{kind:model.kind,blocks:rewritten.blocks,channelIds:layer.channelIds}}],composite:new Uint8ClampedArray(source.width*source.height*4)})],
      ['PSB',encodePsb({width:source.width,height:source.height,bitsPerChannel:8,colorMode:3,layers:[{name:layer.name,x:0,y:0,width:0,height:0,opacity:layer.opacity,blendMode:layer.blendMode,visible:true,psdAdjustment:{kind:model.kind,blocks:rewritten.blocks,channelIds:layer.channelIds}}],composite:new Uint8ClampedArray(source.width*source.height*4)})],
    ]){
      const roundTrip=await decodePsd(encoded,{maxPixels:2_000_000,maxLayers:50});
      assert.equal(roundTrip.adjustmentLayers.length,1,file+' '+format);
      verify(roundTrip.adjustmentLayers[0].psdAdjustment.parsed);
    }
  }
});

test('Stage 16a preserves Curves native block byte-for-byte when semantic points are unchanged',async()=>{
  const source=await decodePsd(await fixtureBytes('curves.psd'),{maxPixels:2_000_000,maxLayers:50});
  const layer=source.adjustmentLayers[0];
  const before=layer.psdAdjustment.blocks[0].data.slice();
  const rewritten=rewritePsdAdjustmentBlocks(layer.psdAdjustment.blocks,layer.psdAdjustment.parsed);
  assert.deepEqual(rewritten.blocks[0].data,before);
});
