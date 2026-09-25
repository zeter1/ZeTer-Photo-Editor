import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decodePsd } from '../src/formats/psd.js';

const root=new URL('./fixtures/photoshop-fills/',import.meta.url);
async function bytes(name){return new Uint8Array(await readFile(new URL(name,root)));}
async function json(name){return JSON.parse(await readFile(new URL(name,root),'utf8'));}
function sha256(value){return createHash('sha256').update(value).digest('hex');}

test('Stage 15d pins real gradient/pattern fill fixtures by size and SHA-256',async()=>{
  const manifest=await json('manifest.json');
  for(const fixture of manifest.fixtures){
    const data=await bytes(fixture.file);
    assert.equal(data.byteLength,fixture.size,fixture.id+' size');
    assert.equal(sha256(data),fixture.sha256,fixture.id+' sha256');
    assert.match(fixture.sourceCommit,/^[0-9a-f]{40}$/);
    assert.match(fixture.sourceGitBlob,/^[0-9a-f]{40}$/);
  }
});

test('Stage 15d exposes bounded GdFl metadata from a real Photoshop Gradient Fill layer',async()=>{
  const decoded=await decodePsd(await bytes('psd-tools-gradient-fill.psd'),{maxPixels:2_000_000,maxLayers:50});
  assert.equal(decoded.layers.length,0);
  assert.equal(decoded.fillLayers.length,1);
  const fill=decoded.fillLayers[0];
  assert.equal(fill.name,'Gradient Fill 1');
  assert.equal(fill.psdShape.fillType,'gradient');
  assert.equal(fill.psdShape.sourceContentKey,'GdFl');
  assert.equal(fill.psdShape.contentSubtype,'GdFl');
  assert.equal(fill.psdShape.blocks[0].key,'GdFl');
  assert.equal(fill.psdShape.gradient.angle,90);
  assert.equal(fill.psdShape.gradient.type,'Lnr ');
  assert.equal(fill.psdShape.gradient.name,'Color to Transparent');
  assert.equal(fill.psdShape.gradient.form,'CstS');
  assert.equal(fill.psdShape.gradient.smoothness,4096);
  assert.deepEqual(fill.psdShape.gradient.colorStops,[
    {location:0,midpoint:50,color:'#ff0000'},
    {location:4096,midpoint:50,color:'#ff0000'},
  ]);
  assert.deepEqual(fill.psdShape.gradient.transparencyStops,[
    {location:0,midpoint:50,opacity:100},
    {location:4096,midpoint:50,opacity:0},
  ]);
  assert.ok(decoded.warnings.some(message=>message.includes('gradient fill metadata сохранены в fillLayers foundation')));
  assert.ok(decoded.warnings.some(message=>message.includes('composite preview')));
});

test('Stage 15d exposes bounded PtFl metadata from a real Photoshop Pattern Fill layer',async()=>{
  const decoded=await decodePsd(await bytes('psd-tools-pattern-fill.psd'),{maxPixels:2_000_000,maxLayers:50});
  assert.equal(decoded.layers.length,0);
  assert.equal(decoded.fillLayers.length,1);
  const fill=decoded.fillLayers[0];
  assert.equal(fill.name,'Pattern Fill 1');
  assert.equal(fill.psdShape.fillType,'pattern');
  assert.equal(fill.psdShape.sourceContentKey,'PtFl');
  assert.equal(fill.psdShape.contentSubtype,'PtFl');
  assert.equal(fill.psdShape.blocks[0].key,'PtFl');
  assert.equal(fill.psdShape.pattern.id,'cf324614-b915-11d7-b003-ad2608ed939e');
  assert.equal(fill.psdShape.pattern.name,'$$$/Presets/Patterns/ColorPaper_pat/MetallicFlecks=Metallic Flecks');
  assert.equal(fill.psdShape.pattern.linked,true);
  assert.ok(decoded.warnings.some(message=>message.includes('pattern fill metadata сохранены в fillLayers foundation')));
});
