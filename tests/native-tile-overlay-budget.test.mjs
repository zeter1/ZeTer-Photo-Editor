import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, createSerializedPixelBufferTileWorkingSet,
  deserializePixelBufferSource, serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';

const fixtures = [
  ['RGB16', () => createPixelBuffer({
    width:3, height:2, model:'rgb', channels:3, bitsPerChannel:16,
    data:Uint16Array.from({length:18}, (_, i) => i * 3511 + 13),
  }), 65001],
  ['CMYKA32', () => createPixelBuffer({
    width:3, height:2, model:'cmyk', channels:5, bitsPerChannel:32,
    colorSpace:'device-cmyk', alphaMode:'straight',
    data:Float32Array.from({length:30}, (_, i) => Math.fround(i/11)),
  }), Math.fround(7.125)],
];

for (const [name, make, value] of fixtures) {
  test('003X/3 '+name+': encoded dirty byte reservations reject multi-tile edits atomically', () => {
    const native=make();
    const source=serializeTiledPixelBufferSource(native,{tileSize:1});
    const oneEncoded=source.tiles[0].dataUrl.length;
    const work=createSerializedPixelBufferTileWorkingSet(source, {
      maxResidentBytes:source.tiles[0].rawBytes, maxEncodedDirtyBytes:oneEncoded,
    });
    const point=index=>({left:source.tiles[index].x,top:source.tiles[index].y,
      right:source.tiles[index].x+1,bottom:source.tiles[index].y+1});
    assert.equal(work.encodedDirtyTileBytes,0);
    assert.equal(work.visit(point(0),({buffer})=>{buffer.data[0]=value;return 1;}),1);
    assert.equal(work.encodedDirtyTileBytes,oneEncoded);
    const first=work.serialize();
    assert.equal(first.tiles[0].dataUrl.length,oneEncoded);
    assert.equal(work.visit(point(0),({buffer})=>{buffer.data[0]=value;return 1;}),1,
      'repeated updates to a reserved tile do not consume extra budget');
    assert.throws(()=>work.visit({left:0,top:0,right:3,bottom:2},({buffer})=>{
      buffer.data[0]=value;return 1;
    }),/encoded dirty tile byte budget/);
    assert.equal(work.dirtyTileCount,1);
    assert.equal(work.encodedDirtyTileBytes,oneEncoded);
    assert.deepEqual(work.serialize(),first);
    assert.deepEqual([...deserializePixelBufferSource(source).data],[...native.data]);
    assert.deepEqual([...deserializePixelBufferSource(JSON.parse(JSON.stringify(work.serialize()))).data],
      [...deserializePixelBufferSource(first).data],'.zpe native round-trip');
    assert.ok(work.residentTileBytes <= work.maxResidentBytes);
    assert.equal(work.maxEncodedDirtyBytes,oneEncoded);
    assert.throws(()=>createSerializedPixelBufferTileWorkingSet(source,{
      maxEncodedDirtyBytes:oneEncoded-1,
    }),/maxEncodedDirtyBytes/);
  });

  test('003X/3 '+name+': synchronous and cooperative ROI budget refusal leave old bytes',async()=>{
    const source=serializeTiledPixelBufferSource(make(),{tileSize:1});
    const work=createSerializedPixelBufferTileWorkingSet(source,{
      maxResidentBytes:source.tiles[0].rawBytes,
      maxEncodedDirtyBytes:source.tiles[0].dataUrl.length,
    });
    const region=work.readRegion({left:0,top:0,right:3,bottom:2});
    region.buffer.data.fill(value);
    assert.throws(()=>work.writeRegion(region),/encoded dirty tile byte budget/);
    assert.equal(work.dirtyTileCount,0);
    assert.deepEqual(work.serialize(),source);
    await assert.rejects(work.writeRegionCooperative(region,{
      yieldControl:async()=>{},
    }),/encoded dirty tile byte budget/);
    assert.equal(work.encodedDirtyTileBytes,0);
    assert.equal(await work.writeRegionCooperative(region,{isCancelled:()=>true}),null);
    assert.deepEqual(work.serialize(),source);
  });
}

test('003X/3: encoder failure before a multi-tile publish cannot partially commit',()=>{
  const source=serializeTiledPixelBufferSource(fixtures[0][1](),{tileSize:1});
  const tileBytes=source.tiles[0].rawBytes;
  const working=createSerializedPixelBufferTileWorkingSet(source,{
    maxResidentBytes:tileBytes,maxEncodedDirtyBytes:source.tiles[0].dataUrl.length*3,
  });
  const before=working.serialize();
  const realBtoa=globalThis.btoa;
  try {
    assert.throws(()=>working.visit({left:0,top:0,right:2,bottom:1},
      ({index,buffer})=>{
        buffer.data[0]=60000+index;
        if (index===1) globalThis.btoa=()=>{throw new Error('injected encoder failure');};
        return 1;
      }),/injected encoder failure/);
  } finally { globalThis.btoa=realBtoa; }
  assert.equal(working.dirtyTileCount,0);
  assert.equal(working.encodedDirtyTileBytes,0);
  assert.deepEqual(working.serialize(),before);
});

test('003X/3: promoted RGB16 alpha reserves encoded target channels',()=>{
  const source=serializeTiledPixelBufferSource(fixtures[0][1](),{tileSize:1});
  const baseline=createSerializedPixelBufferTileWorkingSet(source,{requireAlpha:true});
  baseline.visit({left:0,top:0,right:1,bottom:1},({buffer})=>{
    buffer.data[3]=11111; return 1;
  });
  const encoded=baseline.serialize().tiles[0].dataUrl.length;
  assert.ok(encoded>source.tiles[0].dataUrl.length);
  const working=createSerializedPixelBufferTileWorkingSet(source,{
    requireAlpha:true,maxResidentBytes:8,maxEncodedDirtyBytes:encoded,
  });
  working.visit({left:0,top:0,right:1,bottom:1},({buffer})=>{
    buffer.data[3]=11111;return 1;
  });
  assert.equal(working.encodedDirtyTileBytes,encoded);
  working.readRegion({left:2,top:1,right:3,bottom:2});
  assert.equal(working.readRegion({left:0,top:0,right:1,bottom:1}).buffer.data[3],11111);
  assert.equal(deserializePixelBufferSource(working.serialize()).data[3],11111);
});


test('003X/3: repeated sparse native edits remain capped across dirty LRU reloads',()=>{
  const buffer=createPixelBuffer({width:16,height:8,model:'rgb',channels:3,bitsPerChannel:16,
    data:Uint16Array.from({length:16*8*3},(_,i)=>i+1)});
  const source=serializeTiledPixelBufferSource(buffer,{tileSize:1});
  const encodedTileBytes=source.tiles[0].dataUrl.length;
  const work=createSerializedPixelBufferTileWorkingSet(source,{
    maxResidentBytes:source.tiles[0].rawBytes,maxEncodedDirtyBytes:encodedTileBytes*9,
  });
  const expected=new Map();
  for(let i=0;i<9;i++){
    const index=i*12, tile=source.tiles[index], value=63000+i;
    work.visit({left:tile.x,top:tile.y,right:tile.x+1,bottom:tile.y+1},
      ({buffer:next})=>{next.data[0]=value;return 1;});
    expected.set(index,value);
    assert.ok(work.encodedDirtyTileBytes<=work.maxEncodedDirtyBytes);
    assert.ok(work.residentTileBytes<=work.maxResidentBytes);
  }
  assert.equal(work.encodedDirtyTileBytes,encodedTileBytes*9);
  // Read older evicted native bytes, then change an already reserved tile.
  assert.equal(work.readRegion({left:0,top:0,right:1,bottom:1}).buffer.data[0],63000);
  work.visit({left:0,top:0,right:1,bottom:1},({buffer:next})=>{
    next.data[0]=65000;return 1;
  });
  expected.set(0,65000);
  const prior=work.serialize();
  const next=source.tiles[127];
  assert.throws(()=>work.visit({left:next.x,top:next.y,right:next.x+1,bottom:next.y+1},
    ({buffer:nextBuffer})=>{nextBuffer.data[0]=60001;return 1;}),/encoded dirty tile byte budget/);
  assert.deepEqual(work.serialize(),prior);
  const reopened=deserializePixelBufferSource(JSON.parse(JSON.stringify(prior)));
  for(const [index,value] of expected){
    const tile=source.tiles[index];
    assert.equal(reopened.data[(tile.y*16+tile.x)*3],value);
  }
  assert.equal(prior.tiles[127].dataUrl,source.tiles[127].dataUrl);
  assert.deepEqual([...deserializePixelBufferSource(source).data],[...buffer.data]);
});

test('003X/3: yielded ROI over budget refuses before any native publication',async()=>{
  const buffer=createPixelBuffer({width:256,height:160,model:'rgb',channels:3,bitsPerChannel:16,
    data:new Uint16Array(256*160*3).fill(43121)});
  const source=serializeTiledPixelBufferSource(buffer,{tileSize:64});
  const work=createSerializedPixelBufferTileWorkingSet(source,{
    maxResidentBytes:64*64*3*2,maxEncodedDirtyBytes:source.tiles[0].dataUrl.length,
  });
  const region=work.readRegion({left:0,top:0,right:256,bottom:160});
  region.buffer.data.fill(64512);
  let yields=0;
  await assert.rejects(work.writeRegionCooperative(region,{
    yieldControl:async()=>{yields++;},
  }),/encoded dirty tile byte budget/);
  assert.ok(yields>0,'real cooperative checkpoints were exercised');
  assert.equal(work.dirtyTileCount,0);
  assert.equal(work.encodedDirtyTileBytes,0);
  assert.deepEqual(work.serialize(),source);
});

