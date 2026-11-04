import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, createSerializedPixelBufferTileWorkingSet,
  serializeTiledPixelBufferSource, deserializePixelBufferSource,
} from '../src/core/pixel-buffer.js';

const fixtures = [
  ['RGB16', () => createPixelBuffer({
    width:5, height:3, model:'rgb', channels:3, bitsPerChannel:16,
    data:Uint16Array.from({length:45},(_,i)=>(i*1277+13)&65535),
  }), Uint16Array, 65001],
  ['CMYKA32', () => createPixelBuffer({
    width:3, height:3, model:'cmyk', channels:5, bitsPerChannel:32,
    colorSpace:'device-cmyk', alphaMode:'straight',
    data:Float32Array.from({length:45},(_,i)=>Math.fround(i/11+0.375)),
  }), Float32Array, Math.fround(3.25)],
];

for (const [label, make, ArrayType, changedSample] of fixtures) {
  test('003X/4: '+label+' ROI write refuses the second private tile BEFORE slice and preserves exact native undo', () => {
    const initial=make();
    const source=serializeTiledPixelBufferSource(initial,{tileSize:2});
    const snapshot=JSON.stringify(source);
    const tileBytes=source.tiles[0].rawBytes;
    const working=createSerializedPixelBufferTileWorkingSet(source,{
      maxVisitBytes:tileBytes,maxResidentBytes:tileBytes,
    });
    const region=working.readRegion({left:0,top:0,right:initial.width,bottom:initial.height});
    region.buffer.data[0]=changedSample;
    region.buffer.data[2*initial.channels]=changedSample;
    let tileCopies=0;
    const originalSlice=ArrayType.prototype.slice;
    ArrayType.prototype.slice=function(...args) {
      if (this.length===tileBytes/this.BYTES_PER_ELEMENT) tileCopies++;
      return originalSlice.apply(this,args);
    };
    try {
      assert.throws(()=>working.writeRegion(region),/region write.*private tile byte budget/);
    } finally {
      ArrayType.prototype.slice=originalSlice;
    }
    assert.equal(tileCopies,1,'the rejected second full native tile was never copied');
    assert.equal(working.dirtyTileCount,0);
    assert.deepEqual(working.serialize(),source,'failure does not publish dirty tile or preview');
    assert.equal(JSON.stringify(source),snapshot,'original source remains immutable');
    const one=working.readRegion({left:0,top:0,right:1,bottom:1});
    one.buffer.data[0]=changedSample;
    assert.equal(working.writeRegion(one),1,'smaller follow-up ROI still works');
    const changed=JSON.parse(JSON.stringify(working.serialize()));
    assert.equal(deserializePixelBufferSource(changed).data[0],changedSample);
    assert.deepEqual([...deserializePixelBufferSource(source).data],[...initial.data],
      'native Undo remains byte-exact, including alpha/float precision');
    assert.deepEqual([...deserializePixelBufferSource(changed).data.slice(initial.channels)],
      [...initial.data.slice(initial.channels)],'untouched channels and pixels remain exact');
  });

  test('003X/4: '+label+' native ROI ceiling rejects BEFORE allocating/loading and blocks oversized writes', async () => {
    const source=serializeTiledPixelBufferSource(make(),{tileSize:2});
    const promoteAlpha=label==='RGB16';
    const channels=promoteAlpha?4:5;
    const pixelBytes=channels*(label==='RGB16'?2:4);
    const working=createSerializedPixelBufferTileWorkingSet(source,{
      requireAlpha:promoteAlpha,maxRegionBytes:4*pixelBytes,
    });
    assert.equal(working.maxRegionBytes,4*pixelBytes);
    assert.throws(()=>working.readRegion({left:0,top:0,right:3,bottom:2}),
      /region byte budget exceeded/);
    await assert.rejects(working.readRegionCooperative({left:0,top:0,right:3,bottom:2}),
      /region byte budget exceeded/);
    assert.equal(working.loadedTileCount,0,'rejected ROI cannot even decode one tile');
    const small=working.readRegion({left:0,top:0,right:2,bottom:2});
    assert.equal(small.buffer.data.byteLength,4*pixelBytes);
    if (promoteAlpha) assert.equal(small.buffer.data[3],65535);
    const unrestricted=createSerializedPixelBufferTileWorkingSet(source,{requireAlpha:promoteAlpha});
    const oversized=unrestricted.readRegion({left:0,top:0,right:3,bottom:2});
    assert.throws(()=>working.writeRegion(oversized),/region byte budget exceeded/);
    assert.equal(working.dirtyTileCount,0);
    assert.deepEqual(working.serialize().tiles.map(t=>t.dataUrl),
      unrestricted.serialize().tiles.map(t=>t.dataUrl));
    assert.equal(await working.readRegionCooperative({left:0,top:0,right:3,bottom:2},{
      isCancelled:()=>true,
    }),null,'pre-cancellation avoids allocation');
    assert.throws(()=>createSerializedPixelBufferTileWorkingSet(source,{
      requireAlpha:promoteAlpha,maxRegionBytes:pixelBytes-1,
    }),/maxRegionBytes/);
  });
}

for (const [label, makeLarge, ArrayType, newValue] of [
  ['RGB16',()=>createPixelBuffer({width:256,height:160,model:'rgb',channels:3,bitsPerChannel:16,
    data:new Uint16Array(256*160*3).fill(1337)}),Uint16Array,61000],
  ['CMYKA32',()=>createPixelBuffer({width:256,height:160,model:'cmyk',channels:5,bitsPerChannel:32,
    colorSpace:'device-cmyk',alphaMode:'straight',
    data:new Float32Array(256*160*5).fill(Math.fround(0.375))}),Float32Array,Math.fround(7.75)],
]) {
  test('003X/4: '+label+' cooperative mid-ROI cancellation discards already staged private tiles',async()=>{
    const original=makeLarge();
    const source=serializeTiledPixelBufferSource(original,{tileSize:64});
    const working=createSerializedPixelBufferTileWorkingSet(source,{
      maxVisitBytes:source.rawBytes,maxResidentBytes:source.tiles[0].rawBytes,
    });
    const region=working.readRegion({left:0,top:0,right:256,bottom:160});
    region.buffer.data.fill(newValue);
    let yields=0;
    const result=await working.writeRegionCooperative(region,{
      yieldControl:async()=>{yields++;},
      isCancelled:()=>yields>0,
    });
    assert.equal(result,null);
    assert.equal(yields,1,'a real 32,768-pixel checkpoint was reached');
    assert.equal(working.dirtyTileCount,0,'no partially staged tile is published');
    assert.deepEqual(working.serialize(),source);
    assert.equal(working.writeRegion(region),256*160,'safe retry after cancellation');
    const reopened=deserializePixelBufferSource(JSON.parse(JSON.stringify(working.serialize())));
    assert.equal(reopened.data[0],newValue);
    assert.equal(reopened.data.at(-1),newValue);
    assert.deepEqual([...deserializePixelBufferSource(source).data.slice(0,10)],
      [...original.data.slice(0,10)],'original precision remains intact');
    assert.equal(reopened.data.constructor,ArrayType);
  });
}
