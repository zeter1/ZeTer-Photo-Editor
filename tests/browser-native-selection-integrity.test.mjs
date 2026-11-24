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

test('003W/2b-2b: ~2M dense indices preserve exact native tile membership with bounded oracle',()=>{
  // The same native geometry and near-cap marquee area as the real Chromium
  // 1450x1400 PSD16/PSB32 fixture; unlike the small smoke this forces dense
  // membership checks. Do not present this Node oracle as Worker success.
  const width=1450,height=1400,tileSize=256,channels=4,bitsPerChannel=16,stride=8;
  const tiles=[];
  for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize){
    const w=Math.min(tileSize,width-x),h=Math.min(tileSize,height-y);
    const bytes=Buffer.alloc(w*h*stride);
    tiles.push({x,y,width:w,height:h,rawBytes:bytes.length,
      dataUrl:prefix+bytes.toString('base64')});
  }
  const source={kind:'zpe-pixel-buffer-source-v2',width,height,channels,
    bitsPerChannel,model:'rgb',tileSize,rawBytes:width*height*stride,
    colorSpace:'srgb',alphaMode:'straight',profileName:'',tiles};
  const left=5,right=1445,top=5,bottom=1390;
  const selected=Uint32Array.from({length:(right-left)*(bottom-top)},(_,i)=>
    (top+Math.floor(i/(right-left)))*width+left+i%(right-left));
  assert.equal(selected.length,1_994_400);
  const changed=modify(source,725,700,2);
  assert.deepEqual(inspectNativeSelectedPixelChanges(source,changed,selected),{
    selectedPixels:1_994_400,changedSelectedPixels:1,changedTiles:1,
    changedOutsideSelectionPixels:0,
  });
  assert.throws(()=>inspectNativeSelectedPixelChanges(source,
    modify(source,1,1,2),selected),/outside frozen Worker selection/);
  // Repeated position must fail even for a 2M-element typed array.
  selected[selected.length-1]=selected[0];
  assert.throws(()=>inspectNativeSelectedPixelChanges(source,changed,selected),
    /invalid or duplicate frozen selection index/);
});
