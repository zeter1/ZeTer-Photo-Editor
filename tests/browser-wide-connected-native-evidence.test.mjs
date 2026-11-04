import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWideConnectedRoiIndices,
  verifyWideConnectedNativeRoundTrip,
  validateWideConnectedBrowserSampling,
} from '../tools/browser-wide-connected-native-evidence.mjs';

const WIDTH=256,HEIGHT=256,TILE=16,CHANNELS=4;
const TILE_PREFIX='data:application/x-zeter-pixel-buffer-tile;base64,';

function source(bits, { repaired=false }={}) {
  const selected=new Set(createWideConnectedRoiIndices(WIDTH,HEIGHT));
  const clean=bits===16?[10000,20000,30000,65535]:[0.125,0.25,0.375,1];
  const defect=bits===16?[59000,1000,1000,65535]:[4,0.0625,0.0625,1];
  const bytes=bits/8,stride=bytes*CHANNELS;
  const tiles=[];
  for(let y=0;y<HEIGHT;y+=TILE)for(let x=0;x<WIDTH;x+=TILE){
    const raw=Buffer.alloc(TILE*TILE*stride);
    const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
    for(let localY=0;localY<TILE;localY++)for(let localX=0;localX<TILE;localX++){
      const index=(y+localY)*WIDTH+x+localX;
      const values=selected.has(index)&&!repaired?defect:clean;
      const offset=(localY*TILE+localX)*stride;
      for(let channel=0;channel<CHANNELS;channel++){
        if(bits===16)view.setUint16(offset+channel*bytes,values[channel],true);
        else view.setFloat32(offset+channel*bytes,values[channel],true);
      }
    }
    tiles.push({x,y,width:TILE,height:TILE,rawBytes:raw.length,
      dataUrl:TILE_PREFIX+raw.toString('base64')});
  }
  return {
    kind:'zpe-pixel-buffer-source-v2',width:WIDTH,height:HEIGHT,model:'rgb',
    channels:CHANNELS,bitsPerChannel:bits,tileSize:TILE,
    rawBytes:WIDTH*HEIGHT*stride,colorSpace:'srgb',
    alphaMode:'straight',profileName:'',tiles,
  };
}
function pair(bits){
  const original=source(bits),filled=source(bits,{repaired:true});
  return {
    original,filled,undone:structuredClone(original),redone:structuredClone(filled),
    selectedIndices:createWideConnectedRoiIndices(WIDTH,HEIGHT),
    clean:bits===16?[10000,20000,30000,65535]:[0.125,0.25,0.375,1],
  };
}
function mutatePixel(v,which,x,y,channel,value) {
  const result=structuredClone(v);
  const source=result[which],tile=source.tiles.find(tile=>
    x>=tile.x&&x<tile.x+tile.width&&y>=tile.y&&y<tile.y+tile.height);
  const raw=Buffer.from(tile.dataUrl.slice(TILE_PREFIX.length),'base64');
  const bytes=source.bitsPerChannel/8;
  const offset=((y-tile.y)*tile.width+x-tile.x)*CHANNELS*bytes+channel*bytes;
  if(bytes===2)raw.writeUInt16LE(value,offset);
  else raw.writeFloatLE(value,offset);
  tile.dataUrl=TILE_PREFIX+raw.toString('base64');
  return result;
}

test('036A: canonical two-island diagonal bridge is 8-connected and has exactly 8288 pixels',()=>{
  const indices=createWideConnectedRoiIndices(300,300,{x:10,y:10});
  assert.equal(indices.length,8288);
  assert.equal(new Set(indices).size,8288);
  assert.ok(indices.includes(90*300+90));
  assert.ok(indices.includes(185*300+185));
  assert.ok(!indices.includes(90*300+91));
  assert.throws(()=>createWideConnectedRoiIndices(200,300),/bounds/);
  assert.throws(()=>createWideConnectedRoiIndices(256,256,{x:-1}),/bounds/);
});

for(const bits of [16,32]){
  test('036A: '+bits+'-bit multi-tile native Fill improves 8288 colors, preserves alpha, Undo and Redo bytes',()=>{
    const v=pair(bits);
    const report=verifyWideConnectedNativeRoundTrip(v);
    assert.equal(report.kind,'zpe-browser-wide-connected-native-evidence-v1');
    assert.equal(report.selectedPixels,8288);
    assert.equal(report.scoredSamples,8288*3);
    assert.equal(report.changedSelectedPixels,8288);
    assert.ok(report.changedTiles>2);
    assert.ok(report.baseline.mae>0);
    assert.equal(report.repaired.mae,0);
    assert.equal(report.repaired.rmse,0);
    assert.equal(report.outsideSelectionAndAlphaUnchanged,true);
    assert.equal(report.undoNativeBytesExact,true);
    assert.equal(report.redoNativeBytesExact,true);
  });
  test('036A: '+bits+'-bit refuses forged ROI, changed off-selection/alpha, and mismatched Undo/Redo',()=>{
    const v=pair(bits);
    const invalid=[
      {...v,selectedIndices:Uint32Array.from([20*WIDTH+20])},
      {...v,selectedIndices:Uint32Array.from(v.selectedIndices).reverse()},
      mutatePixel(v,'filled',0,0,0,bits===16?42:0.5),
      mutatePixel(v,'filled',20,20,3,bits===16?0:0.5),
      mutatePixel(v,'undone',20,20,0,bits===16?42:0.5),
      mutatePixel(v,'redone',20,20,0,bits===16?42:0.5),
      {...v,filled:structuredClone(v.original)},
      {...v,filled:{...v.filled,model:'cmyk'}},
    ];
    for(const bad of invalid){
      assert.throws(()=>verifyWideConnectedNativeRoundTrip(bad),/036 |Known native ROI quality|Native selection pixel oracle/);
    }
  });
}
test('036A: truncated, overlapping, missing, non-canonical and NaN native payloads fail closed',()=>{
  const v=pair(32);
  const clone=()=>structuredClone(v);
  const cases=[];
  let b=clone();b.filled.tiles[0].dataUrl=TILE_PREFIX+'AA==';cases.push(b);
  b=clone();b.filled.tiles[0].dataUrl=TILE_PREFIX+'?';cases.push(b);
  b=clone();b.filled.tiles[0].dataUrl=b.filled.tiles[0].dataUrl.replace(/.$/,'A');cases.push(b);
  b=clone();b.filled.tiles[1]={...b.filled.tiles[0]};cases.push(b);
  b=clone();b.filled.tiles.pop();cases.push(b);
  b=mutatePixel(v,'filled',0,0,0,NaN);cases.push(b);
  for(const item of cases){
    assert.throws(()=>verifyWideConnectedNativeRoundTrip(item),/036 native tiles|036 wide ROI/);
  }
});

function samples(){
  return {
    milestonesMs:{imported:5,selected:6,filled:100,previewed:102,undone:110,redone:120},
    renderer:{attempts:4,observed:3,coverage:'partial',lastObservedBytes:null},
    linux:{attempts:4,observed:0,coverage:'unavailable',lastObservedBytes:null},
    workerPidMapping:'unknown',operationPeakRssBytes:null,
  };
}
test('036A: browser sampling must preserve missing samples and never claim operation peaks',()=>{
  assert.equal(validateWideConnectedBrowserSampling(samples()),true);
  const cases=[
    q=>{q.operationPeakRssBytes=100;},
    q=>{q.workerPidMapping='1234';},
    q=>{q.renderer.coverage='complete';},
    q=>{q.linux.lastObservedBytes=500;},
    q=>{q.linux.observed=5;},
    q=>{q.renderer.lastObservedBytes=Infinity;},
    q=>{q.milestonesMs.redone=50;},
    q=>{delete q.milestonesMs.filled;},
    q=>{q.renderer.attempts=0;},
  ];
  for(const patch of cases){
    const value=samples();patch(value);
    assert.throws(()=>validateWideConnectedBrowserSampling(value),/036 browser sampling/);
  }
});
