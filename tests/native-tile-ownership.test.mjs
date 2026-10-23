import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPixelBuffer,
  deserializeEditablePixelBufferSource,
  deserializePixelBufferSource,
  createSerializedPixelBufferTileWorkingSet,
  serializePixelBufferSource,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';

const rgb16 = () => createPixelBuffer({
  width:5, height:3, model:'rgb', channels:3, bitsPerChannel:16,
  data:Uint16Array.from({length:45}, (_, i) => (i * 1277 + 13) & 65535),
});
const cmyk32 = () => createPixelBuffer({
  width:3, height:3, model:'cmyk', channels:5, bitsPerChannel:32,
  colorSpace:'device-cmyk', alphaMode:'straight',
  data:Float32Array.from({length:45}, (_, i) => (i % 7) / 7 + (i % 3 === 0 ? 1 : 0)),
});

test('003X: legacy editable decode owns one private plane, preserving full native bits and source', async () => {
  const painting = await readFile(new URL('../src/painting/controller.js', import.meta.url), 'utf8');
  assert.match(painting, /deserializeEditablePixelBufferSource\(layer\.highDepthSource, \{ requireAlpha \}\)/);
  assert.doesNotMatch(painting, /clonePixelBuffer\(decoded\)/);
  for (const source of [rgb16(), cmyk32()]) {
    const packed = serializePixelBufferSource(source);
    const before = JSON.stringify(packed);
    const editable = deserializeEditablePixelBufferSource(packed, { requireAlpha:true });
    const separate = deserializeEditablePixelBufferSource(packed, { requireAlpha:true });
    assert.notStrictEqual(editable.data, source.data);
    assert.notStrictEqual(editable.data.buffer, separate.data.buffer);
    const native = source.data[0];
    editable.data[0] = source.bitsPerChannel === 16 ? 65534 : Math.fround(10.125);
    assert.equal(deserializePixelBufferSource(packed).data[0], native);
    assert.equal(JSON.stringify(packed), before);
  }
  const withoutAlpha = createPixelBuffer({width:1,height:1,model:'rgb',channels:3,bitsPerChannel:16,data:Uint16Array.of(123,456,789)});
  const promoted = deserializeEditablePixelBufferSource(serializePixelBufferSource(withoutAlpha), { requireAlpha:true });
  assert.deepEqual([...promoted.data], [123,456,789,65535]);
});

for (const [name, source] of [['RGB16',rgb16()],['CMYKA32',cmyk32()]]) {
  test('003X: '+name+' tile writeback owns edges, excludes zero-change mutations and round-trips exact undo', () => {
    const original = serializeTiledPixelBufferSource(source, { tileSize:2 });
    const originalJson = JSON.stringify(original);
    const tilesBefore = original.tiles.map(t => t.dataUrl);
    const working = createSerializedPixelBufferTileWorkingSet(original);
    assert.equal(working.loadedTileCount, 0);
    const edge = {left:source.width-1,top:source.height-1,right:source.width,bottom:source.height};
    assert.equal(working.visit(edge, ({buffer,width,height}) => {
      assert.deepEqual([width,height],[1,1]);
      buffer.data[0] = source.bitsPerChannel === 16 ? 64123 : Math.fround(42.25);
      return 0;
    }),0);
    assert.equal(working.dirtyTileCount,0);
    assert.equal(working.serialize().tiles.at(-1).dataUrl,tilesBefore.at(-1));
    const changed = working.visit(edge, ({buffer}) => {
      buffer.data[0] = source.bitsPerChannel === 16 ? 64123 : Math.fround(42.25);
      return 1;
    });
    assert.equal(changed,1);
    const mutated = working.serialize();
    assert.equal(working.dirtyTileCount,1);
    assert.equal(mutated.tiles.filter((t,i)=>t.dataUrl !== tilesBefore[i]).length,1);
    assert.deepEqual(mutated.tiles.slice(0,-1).map(t=>t.dataUrl),tilesBefore.slice(0,-1));
    assert.equal(deserializePixelBufferSource(mutated).data.at(-source.channels),
      source.bitsPerChannel === 16 ? 64123 : Math.fround(42.25));
    assert.deepEqual([...deserializePixelBufferSource(original).data],[...source.data],
      'Undo snapshot retains exact data including unmodified HDR and ink');
    assert.equal(JSON.stringify(original),originalJson);
    assert.deepEqual([...deserializePixelBufferSource(JSON.parse(JSON.stringify(mutated))).data],
      [...deserializePixelBufferSource(mutated).data], '.zpe JSON round-trip keeps native samples');
  });
}

test('003X: multi-tile visitor exception/invalid return cannot commit earlier tile changes', () => {
  const packed = serializeTiledPixelBufferSource(rgb16(), {tileSize:2});
  const working = createSerializedPixelBufferTileWorkingSet(packed);
  assert.throws(() => working.visit(null, ({index,buffer}) => {
    buffer.data[0]=50000;
    if(index===1) throw new Error('aborted edit');
    return 1;
  }),/aborted edit/);
  assert.equal(working.dirtyTileCount,0);
  assert.deepEqual(working.serialize(),packed);
  assert.throws(()=>working.visit(null,({index,buffer})=>{
    buffer.data[0]=50000;
    return index===1 ? -1 : 1;
  }),/неотрицательное целое/);
  assert.deepEqual(working.serialize(),packed);
});

test('003X: strict visit byte budget fails atomically, not after publishing first tile', () => {
  const packed=serializeTiledPixelBufferSource(rgb16(),{tileSize:2});
  const oneTileBytes=2*2*3*2;
  const working=createSerializedPixelBufferTileWorkingSet(packed,{maxVisitBytes:oneTileBytes});
  assert.throws(()=>working.visit({left:0,top:0,right:4,bottom:2},({buffer})=>{
    buffer.data[0]=65535;
    return 1;
  }),/private tile byte budget/);
  assert.equal(working.dirtyTileCount,0);
  assert.deepEqual(working.serialize(),packed);
  assert.throws(()=>createSerializedPixelBufferTileWorkingSet(packed,{maxVisitBytes:0}),/maxVisitBytes/);
  assert.equal(working.visit({left:0,top:0,right:2,bottom:2},({buffer})=>{
    buffer.data[0]=56789;
    return 1;
  }),1);
  assert.equal(deserializePixelBufferSource(working.serialize()).data[0],56789);
});

test('003X: cancelled ROI staging leaves serialized native and prior committed tile untouched',async()=>{
  const packed=serializeTiledPixelBufferSource(cmyk32(),{tileSize:2});
  const working=createSerializedPixelBufferTileWorkingSet(packed);
  working.visit({left:0,top:0,right:1,bottom:1},({buffer})=>{
    buffer.data[0]=Math.fround(6.75);
    return 1;
  });
  const before=working.serialize();
  const region=working.readRegion({left:0,top:0,right:3,bottom:3});
  region.buffer.data.fill(0);
  // Pre-cancel must not touch the already dirty first tile or any ROI tile.
  const changed=await working.writeRegionCooperative(region,{
    isCancelled:()=>true,
  });
  assert.equal(changed,null);
  assert.deepEqual(working.serialize(),before);
  assert.deepEqual([...deserializePixelBufferSource(packed).data],[...cmyk32().data]);
});
