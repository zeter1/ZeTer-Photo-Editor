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

for (const [name, make] of [['RGB16', rgb16], ['CMYKA32', cmyk32]]) {
  test('003X/2: '+name+' dirty tile writeback survives LRU eviction, preview, Undo and .zpe', () => {
    const original = serializeTiledPixelBufferSource(make(), {tileSize:1});
    const tileBytes = original.tiles[0].rawBytes;
    const working = createSerializedPixelBufferTileWorkingSet(original, {maxResidentBytes:tileBytes});
    const before = JSON.stringify(original);
    const values = new Map([[0, make().bitsPerChannel === 16 ? 60001 : Math.fround(4.25)],
                            [4, make().bitsPerChannel === 16 ? 60002 : Math.fround(5.5)],
                            [8, make().bitsPerChannel === 16 ? 60003 : Math.fround(6.75)]]);
    for (const [index, value] of values) {
      const tile = original.tiles[index];
      assert.equal(working.visit({left:tile.x,top:tile.y,right:tile.x+1,bottom:tile.y+1},
        ({buffer}) => {buffer.data[0] = value; return 1;}), 1);
      assert.ok(working.residentTileBytes <= tileBytes);
      assert.ok(working.loadedTileCount <= 1);
    }
    assert.equal(working.dirtyTileCount, values.size);
    assert.ok(working.writtenBackTileCount >= 2);
    const seen = new Map();
    working.forEachPreviewDirty(({index,buffer}) => seen.set(index,buffer.data[0]));
    assert.deepEqual(seen, values, 'evicted dirty preview reloads exact native samples');
    const changed = working.serialize();
    const reopened = deserializePixelBufferSource(JSON.parse(JSON.stringify(changed)));
    const width = make().width, channels = make().channels;
    for (const [index, value] of values) {
      const tile = original.tiles[index];
      assert.equal(reopened.data[(tile.y*width+tile.x)*channels],value);
    }
    for (let i=0;i<original.tiles.length;i++) {
      if (!values.has(i)) assert.equal(changed.tiles[i].dataUrl,original.tiles[i].dataUrl);
    }
    assert.equal(JSON.stringify(original),before);
    assert.deepEqual([...deserializePixelBufferSource(original).data],[...make().data],
      'original unchanged native bytes remain an exact undo snapshot');
    assert.ok(working.residentTileBytes <= tileBytes);
  });
}

test('003X/2: clean native tiles evict without dirtying; alpha-promotion writebacks retain channels', () => {
  const source = serializeTiledPixelBufferSource(rgb16(), {tileSize:1});
  const working = createSerializedPixelBufferTileWorkingSet(source, {requireAlpha:true,maxResidentBytes:8});
  for (let i=0;i<source.tiles.length;i++) {
    const tile=source.tiles[i];
    const region=working.readRegion({left:tile.x,top:tile.y,right:tile.x+1,bottom:tile.y+1});
    assert.equal(region.buffer.channels,4);
    assert.equal(region.buffer.data[3],65535);
    assert.ok(working.residentTileBytes<=8);
  }
  assert.equal(working.dirtyTileCount,0);
  assert.equal(working.writtenBackTileCount,0);
  working.visit({left:0,top:0,right:1,bottom:1},({buffer})=>{
    buffer.data[0]=65001;
    buffer.data[3]=32123;
    return 1;
  });
  working.readRegion({left:4,top:2,right:5,bottom:3});
  assert.equal(working.writtenBackTileCount,1);
  const serialized=working.serialize();
  assert.equal(serialized.channels,4);
  assert.equal(serialized.alphaMode,'straight');
  const reopened=deserializePixelBufferSource(serialized);
  assert.deepEqual([...reopened.data.slice(0,4)],[65001,rgb16().data[1],rgb16().data[2],32123]);
  assert.equal(working.readRegion({left:0,top:0,right:1,bottom:1}).buffer.data[3],32123);
  assert.throws(()=>createSerializedPixelBufferTileWorkingSet(source,{requireAlpha:true,maxResidentBytes:7}),/maxResidentBytes/);
  assert.throws(()=>createSerializedPixelBufferTileWorkingSet(source,{maxBytes:source.rawBytes,maxResidentBytes:source.rawBytes+1}),/maxResidentBytes/);
});

test('003X/2: cooperative region writer refuses stale commit after a newer native edit', async () => {
  const sourceBuffer=createPixelBuffer({width:256,height:160,model:'rgb',channels:3,bitsPerChannel:16,
    data:new Uint16Array(256*160*3).fill(12345)});
  const source=serializeTiledPixelBufferSource(sourceBuffer,{tileSize:64});
  const tileBytes=64*64*3*2;
  const working=createSerializedPixelBufferTileWorkingSet(source,{maxResidentBytes:tileBytes});
  const region=working.readRegion({left:0,top:0,right:256,bottom:160});
  region.buffer.data.fill(54321);
  let yielded=false;
  await assert.rejects(working.writeRegionCooperative(region,{
    yieldControl:async()=>{
      if (!yielded) {
        yielded=true;
        working.visit({left:0,top:0,right:1,bottom:1},({buffer})=>{
          buffer.data[0]=33333;
          return 1;
        });
      }
    },
  }),/stale region write/);
  assert.equal(yielded,true,'interleave at a genuine 32768-pixel yield');
  assert.equal(working.dirtyTileCount,1);
  assert.ok(working.residentTileBytes<=tileBytes);
  const result=deserializePixelBufferSource(working.serialize());
  assert.equal(result.data[0],33333);
  assert.equal(result.data[1],12345);
  assert.equal(result.data.at(-1),12345);
  assert.deepEqual([...deserializePixelBufferSource(source).data.slice(0,3)],[12345,12345,12345]);
});
