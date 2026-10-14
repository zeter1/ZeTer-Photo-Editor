import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectNativeSelectedPixelChanges} from '../tools/browser-native-selection-integrity.mjs';

const prefix = 'data:application/x-zeter-pixel-buffer-tile;base64,';
function fixture(bitsPerChannel = 16) {
  const width=4,height=2,channels=bitsPerChannel===16?4:5;
  const stride=channels*bitsPerChannel/8;
  const tiles=[];
  for (const x of [0,2]) {
    const bytes=Buffer.alloc(2*height*stride);
    for (let offset=0;offset<bytes.length;offset+=stride) {
      if (bitsPerChannel===16) {
        for (let ch=0;ch<channels;ch++) bytes.writeUInt16LE(1000+ch*117,offset+ch*2);
      } else {
        for (let ch=0;ch<channels;ch++) bytes.writeFloatLE(0.125+ch*0.0625,offset+ch*4);
      }
    }
    tiles.push({x,y:0,width:2,height,rawBytes:bytes.length,
      dataUrl:prefix+bytes.toString('base64')});
  }
  return {kind:'zpe-pixel-buffer-source-v2',width,height,
    channels,bitsPerChannel,model:bitsPerChannel===16?'rgb':'cmyk',
    tileSize:2,rawBytes:width*height*stride,colorSpace:'srgb',
    alphaMode:'straight',profileName:'',tiles};
}
function modify(source, x, y, byte=0) {
  const tiles=source.tiles.map(tile=>({...tile}));
  const tile=tiles.find(item=>x>=item.x&&x<item.x+item.width &&
    y>=item.y&&y<item.y+item.height);
  const data=Buffer.from(tile.dataUrl.slice(prefix.length),'base64');
  const stride=source.channels*source.bitsPerChannel/8;
  data[((y-tile.y)*tile.width+x-tile.x)*stride+byte]^=1;
  tile.dataUrl=prefix+data.toString('base64');
  return {...source,tiles};
}

for (const bits of [16,32]) {
  test('032: real native '+bits+'-bit words change only at frozen Worker indices',()=>{
    const baseline=fixture(bits), selection=Uint32Array.from([0,3,4]);
    const result=modify(modify(baseline,0,0),3,0,3);
    assert.deepEqual(inspectNativeSelectedPixelChanges(baseline,result,selection),{
      selectedPixels:3,changedSelectedPixels:2,changedTiles:2,
      changedOutsideSelectionPixels:0,
    });
    assert.equal(inspectNativeSelectedPixelChanges(baseline,baseline,selection)
      .changedSelectedPixels,0);
    assert.equal(inspectNativeSelectedPixelChanges(result,baseline,selection)
      .changedSelectedPixels,2);
    assert.deepEqual(baseline,fixture(bits),'original native payload must be immutable');
  });
  test('032: reject same-tile and another-tile unselected native mutations ('+bits+')',()=>{
    const baseline=fixture(bits), frozen=Uint32Array.from([0]);
    for (const [x,y] of [[1,0],[3,1]]) {
      assert.throws(()=>inspectNativeSelectedPixelChanges(baseline,
        modify(modify(baseline,0,0),x,y),frozen),
      /outside frozen Worker selection/);
    }
  });
}
test('032: reject forged indices, geometry, or corrupt native payload',()=>{
  const original=fixture(), success=modify(original,0,0);
  for (const selection of [[],[0,0],[8],[-1],[0.5],null]) {
    assert.throws(()=>inspectNativeSelectedPixelChanges(original,success,selection),
      /selection/);
  }
  assert.throws(()=>inspectNativeSelectedPixelChanges(original,
    {...success,width:5},Uint32Array.of(0)),/metadata or topology/);
  assert.throws(()=>inspectNativeSelectedPixelChanges(original,
    {...success,tiles:[{...success.tiles[0],x:1},success.tiles[1]]},
    Uint32Array.of(0)),/geometry or byte budget/);
  assert.throws(()=>inspectNativeSelectedPixelChanges(original,
    {...success,tiles:[{...success.tiles[0],dataUrl:prefix+'A'},success.tiles[1]]},
    Uint32Array.of(0)),/byte length|base64 payload/);
  assert.throws(()=>inspectNativeSelectedPixelChanges(original,
    {...success,tiles:[{...success.tiles[0],dataUrl:'data:image/png;base64,AA=='},success.tiles[1]]},
    Uint32Array.of(0)),/invalid native tile payload/);
});
