import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixelBuffer, createSerializedPixelBufferTileWorkingSet, inpaintTiledPixelBufferSource, deserializePixelBufferSource, forEachSerializedPixelBufferTile, mutateSerializedPixelBufferTiles,
  PIXEL_BUFFER_SOURCE_KIND, PIXEL_BUFFER_TILED_SOURCE_KIND, sanitizeSerializedPixelBufferSource,
  serializePixelBufferSourceAdaptive, serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';

function rgb16(width,height){
  const data=new Uint16Array(width*height*3);
  for(let i=0;i<data.length;i+=1)data[i]=(i*997+31)&0xffff;
  return createPixelBuffer({width,height,model:'rgb',channels:3,bitsPerChannel:16,colorSpace:'srgb',data});
}

test('Stage 17a tiled source round-trips odd RGB16 tile edges exactly',()=>{
  const source=rgb16(5,3),packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  assert.equal(packed.kind,PIXEL_BUFFER_TILED_SOURCE_KIND);
  assert.equal(packed.tileSize,2);
  assert.equal(packed.tiles.length,6);
  assert.equal('dataUrl' in packed,false);
  assert.deepEqual(packed.tiles.map(t=>[t.x,t.y,t.width,t.height]),[[0,0,2,2],[2,0,2,2],[4,0,1,2],[0,2,2,1],[2,2,2,1],[4,2,1,1]]);
  assert.deepEqual([...deserializePixelBufferSource(packed).data],[...source.data]);
});

test('Stage 17a visitor decodes one bounded tile at a time and can reconstruct the plane',()=>{
  const source=rgb16(5,3),packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  const reconstructed=new Uint16Array(source.data.length);
  const count=forEachSerializedPixelBufferTile(packed,({x,y,width,height,buffer})=>{
    assert.ok(width<=2&&height<=2);
    for(let row=0;row<height;row+=1){
      const src=row*width*source.channels,dst=((y+row)*source.width+x)*source.channels;
      reconstructed.set(buffer.data.subarray(src,src+width*source.channels),dst);
    }
  });
  assert.equal(count,6);
  assert.deepEqual([...reconstructed],[...source.data]);
});

test('Stage 17a adaptive serializer keeps small sources v1 and promotes large sources to v2',()=>{
  const source=rgb16(4,4);
  assert.equal(serializePixelBufferSourceAdaptive(source,{tiledThresholdBytes:1_000_000}).kind,PIXEL_BUFFER_SOURCE_KIND);
  assert.equal(serializePixelBufferSourceAdaptive(source,{tiledThresholdBytes:1,tileSize:2}).kind,PIXEL_BUFFER_TILED_SOURCE_KIND);
});

test('Stage 17a sanitizer rejects reordered resized and byte-budget-tampered grids',()=>{
  const packed=serializeTiledPixelBufferSource(rgb16(5,3),{tileSize:2});
  assert.equal(sanitizeSerializedPixelBufferSource({...packed,tiles:[packed.tiles[1],packed.tiles[0],...packed.tiles.slice(2)]}),null);
  assert.equal(sanitizeSerializedPixelBufferSource({...packed,tiles:packed.tiles.map((t,i)=>i?t:{...t,width:t.width+1})}),null);
  assert.equal(sanitizeSerializedPixelBufferSource({...packed,rawBytes:packed.rawBytes+2}),null);
});

test('Stage 17a tiled Float32 CMYK round-trip preserves values and metadata',()=>{
  const source=createPixelBuffer({width:2,height:2,model:'cmyk',channels:4,bitsPerChannel:32,colorSpace:'device-cmyk',profileName:'Fixture CMYK',
    data:new Float32Array([.1,.2,.3,.4,.5,.6,.7,.8,1.2,.9,.05,.33,.01,.02,.03,.04])});
  const restored=deserializePixelBufferSource(serializeTiledPixelBufferSource(source,{tileSize:1}));
  assert.deepEqual([...restored.data],[...source.data]);
  assert.equal(restored.model,'cmyk');
  assert.equal(restored.profileName,'Fixture CMYK');
});


test('Stage 17b tile mutation rewrites only changed payloads and preserves untouched tiles byte-for-byte',()=>{
  const source=rgb16(4,2),packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  const originalTiles=packed.tiles.map(tile=>tile.dataUrl);
  const result=mutateSerializedPixelBufferTiles(packed,({x,buffer})=>{
    if(x!==0)return 0;
    buffer.data[0]=1234;
    return 1;
  });
  assert.equal(result.changed,1);
  assert.equal(result.changedTiles,1);
  assert.notEqual(result.source.tiles[0].dataUrl,originalTiles[0]);
  assert.equal(result.source.tiles[1].dataUrl,originalTiles[1]);
  const restored=deserializePixelBufferSource(result.source);
  assert.equal(restored.data[0],1234);
  assert.deepEqual([...restored.data.slice(1)],[...source.data.slice(1)]);
});

test('Stage 17b tile mutation can promote RGB16 tiles to straight alpha without a full contiguous source',()=>{
  const source=createPixelBuffer({
    width:3,height:2,model:'rgb',channels:3,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array([
      100,200,300, 400,500,600, 700,800,900,
      1000,1100,1200, 1300,1400,1500, 1600,1700,1800,
    ]),
  });
  const packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  const result=mutateSerializedPixelBufferTiles(packed,({x,buffer})=>{
    if(x!==0)return 0;
    buffer.data[3]=0;
    return 1;
  },{requireAlpha:true});
  assert.equal(result.promotedAlpha,true);
  assert.equal(result.source.channels,4);
  assert.equal(result.source.rawBytes,3*2*4*2);
  assert.equal(result.changed,1);
  assert.equal(result.changedTiles,packed.tiles.length);
  const restored=deserializePixelBufferSource(result.source);
  assert.deepEqual([...restored.data.slice(0,3)],[100,200,300]);
  assert.equal(restored.data[3],0);
  for(let pixel=1;pixel<6;pixel+=1)assert.equal(restored.data[pixel*4+3],65535);
});


test('Stage 17c stroke working set lazily decodes touched tiles and preserves untouched payloads',()=>{
  const packed=serializeTiledPixelBufferSource(rgb16(4,2),{tileSize:2});
  const untouched=packed.tiles[1].dataUrl;
  const working=createSerializedPixelBufferTileWorkingSet(packed);
  assert.equal(working.loadedTileCount,0);
  const changed=working.visit({left:0,top:0,right:2,bottom:2},({buffer})=>{
    buffer.data[0]=4321;
    return 1;
  });
  assert.equal(changed,1);
  assert.equal(working.loadedTileCount,1);
  assert.equal(working.dirtyTileCount,1);
  const next=working.serialize();
  assert.equal(next.kind,PIXEL_BUFFER_TILED_SOURCE_KIND);
  assert.equal(next.tiles[1].dataUrl,untouched);
  assert.equal(deserializePixelBufferSource(next).data[0],4321);
});

test('Stage 17c eraser working set defers alpha promotion until touched/serialized tiles without a full plane',()=>{
  const source=createPixelBuffer({
    width:3,height:2,model:'rgb',channels:3,bitsPerChannel:16,colorSpace:'srgb',
    data:new Uint16Array(3*2*3).fill(12345),
  });
  const packed=serializeTiledPixelBufferSource(source,{tileSize:2});
  const working=createSerializedPixelBufferTileWorkingSet(packed,{requireAlpha:true});
  assert.equal(working.channels,4);
  assert.equal(working.loadedTileCount,0);
  working.visit({left:0,top:0,right:1,bottom:1},({buffer})=>{
    assert.equal(buffer.channels,4);
    buffer.data[3]=0;
    return 1;
  });
  assert.equal(working.loadedTileCount,1);
  const restored=deserializePixelBufferSource(working.serialize());
  assert.equal(restored.channels,4);
  assert.equal(restored.data[3],0);
  assert.equal(restored.data[7],65535);
});


test('Stage 17d working-set regions read halo pixels across tiles without dirtying them',()=>{
  const packed=serializeTiledPixelBufferSource(rgb16(4,1),{tileSize:2});
  const untouchedSecond=packed.tiles[1].dataUrl;
  const working=createSerializedPixelBufferTileWorkingSet(packed);
  const region=working.readRegion({left:1,top:0,right:3,bottom:1});
  assert.equal(region.x,1);
  assert.equal(region.y,0);
  assert.equal(region.buffer.width,2);
  assert.equal(region.buffer.height,1);
  assert.equal(working.loadedTileCount,2);
  assert.equal(working.dirtyTileCount,0);
  region.buffer.data[0]=4321;
  assert.equal(working.writeRegion(region),1);
  assert.equal(working.dirtyTileCount,1);
  const serialized=working.serialize();
  assert.equal(serialized.tiles[1].dataUrl,untouchedSecond);
  assert.equal(deserializePixelBufferSource(serialized).data[3],4321);
});

test('Stage 003: localized CMYKA Float32 Content-Aware Fill spans tile boundaries without full-plane decode', () => {
  const width = 80, height = 16, channels = 5;
  const data = new Float32Array(width * height * channels);
  for (let i = 0; i < width * height; i += 1) {
    data.set([0.1, 0.2, 0.3, 0.4, 1], i * channels);
  }
  for (const x of [7, 8]) data.set([5, 5, 5, 5, 1], (7 * width + x) * channels);
  const native = createPixelBuffer({ width, height, model:'cmyk', channels, bitsPerChannel:32, data });
  const source = serializeTiledPixelBufferSource(native, { tileSize:8 });
  const oldPayloads = source.tiles.map(tile => tile.dataUrl);
  const result = inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => y === 7 && (x === 7 || x === 8),
    halo:2,
    maxLayerPixels:64, // whole source is 1,280 px; only the ROI may be in memory
  });
  assert.equal(result.filled, 2);
  assert.equal(result.changed, 2);
  assert.equal(result.changedTiles, 2);
  assert.equal(result.loadedTiles, 4);
  assert.notEqual(result.source, source);
  for (let i = 0; i < source.tiles.length; i += 1) {
    if (i === 0 || i === 1) assert.notEqual(result.source.tiles[i].dataUrl, oldPayloads[i]);
    else assert.equal(result.source.tiles[i].dataUrl, oldPayloads[i]);
  }
  const filled = deserializePixelBufferSource(result.source);
  for (const x of [7, 8]) {
    const sample = filled.data.subarray((7 * width + x) * channels, (7 * width + x + 1) * channels);
    assert.deepEqual([...sample], [...data.subarray(0, 5)]);
  }
  assert.deepEqual([...filled.data.subarray((7 * width + 9) * channels, (7 * width + 10) * channels)],
    [...data.subarray((7 * width + 9) * channels, (7 * width + 10) * channels)]);
});

test('Stage 003: tiled inpaint no-donor, safe ROI budget and aborted selection are non-destructive', () => {
  const source = serializeTiledPixelBufferSource(rgb16(24, 16), { tileSize:8 });
  const original = JSON.stringify(source);
  const none = inpaintTiledPixelBufferSource(source, { isAllowed:() => false });
  const whole = inpaintTiledPixelBufferSource(source, { isAllowed:() => true });
  assert.equal(none.changed, 0);
  assert.equal(whole.filled, 0);
  assert.equal(whole.loadedTiles, 0);
  assert.equal(none.source, source);
  assert.equal(whole.source, source);
  assert.throws(() => inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => x >= 7 && x <= 8 && y === 7,
    halo:2, maxLayerPixels:10,
  }), /рабочая область/);
  assert.throws(() => inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => x === 7 && y < 3,
    maxFillPixels:2,
  }), /безопасного лимита/);
  assert.throws(() => inpaintTiledPixelBufferSource(source, {
    isAllowed:(x, y) => { if (x === 10 && y === 10) throw Error('cancelled'); return x === 2; },
  }), /cancelled/);
  assert.equal(JSON.stringify(source), original);
});
