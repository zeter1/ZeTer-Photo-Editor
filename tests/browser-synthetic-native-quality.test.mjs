import test from 'node:test';
import assert from 'node:assert/strict';
import {
  measureSyntheticNativeDefectQuality, validateBrowserSyntheticQualityEvidence,
} from '../tools/browser-synthetic-native-quality.mjs';

function fixture(bitsPerChannel, {damaged = true} = {}) {
  const width=7,height=7,channels=4,bytesPerChannel=bitsPerChannel/8;
  const background=bitsPerChannel===16?[10_000,20_000,30_000,65_535]:[0.125,0.25,0.375,1];
  const defect=bitsPerChannel===16?[59_000,1_000,1_000,65_535]:[4,0.0625,0.0625,1];
  const data=new Uint8Array(width*height*channels*bytesPerChannel);
  const view=new DataView(data.buffer);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const values=damaged && x>=1 && x<=5 && y>=1 && y<=5?defect:background;
    for(let channel=0;channel<channels;channel++){
      const offset=((y*width+x)*channels+channel)*bytesPerChannel;
      if(bitsPerChannel===16)view.setUint16(offset,values[channel],true);
      else view.setFloat32(offset,values[channel],true);
    }
  }
  const tile={
    x:0,y:0,width,height,rawBytes:data.length,
    dataUrl:'data:application/x-zeter-pixel-buffer-tile;base64,'+Buffer.from(data).toString('base64'),
  };
  return {
    source:{kind:'zpe-pixel-buffer-source-v2',width,height,channels,bitsPerChannel,tiles:[tile]},
    options:{normal:background,defectX:3,defectY:3,radius:2},
  };
}

for(const bits of [16,32]){
  test('033: native '+bits+'-bit defect metrics measure actual known clean reference, not 8-bit preview',()=>{
    const dirty=fixture(bits);
    const clean=fixture(bits,{damaged:false});
    const before=measureSyntheticNativeDefectQuality(dirty.source,dirty.options);
    const after=measureSyntheticNativeDefectQuality(clean.source,clean.options);
    assert.equal(before.sampledPixels,25);
    assert.equal(before.channels,4);
    assert.equal(before.bitsPerChannel,bits);
    assert.ok(before.meanAbsoluteError>0);
    assert.ok(before.rootMeanSquareError>=before.meanAbsoluteError);
    assert.equal(after.meanAbsoluteError,0);
    assert.equal(after.rootMeanSquareError,0);
    assert.equal(after.maxAbsoluteError,0);
  });
}

test('033: malformed native bytes, overlapping/missing tiles, NaN and invalid reference fail closed',()=>{
  const item=fixture(32);
  const corrupt=dataUrl=>({...item.source,tiles:[{...item.source.tiles[0],dataUrl}]});
  assert.throws(()=>measureSyntheticNativeDefectQuality(corrupt('data:application/x-zeter-pixel-buffer-tile;base64,?'),item.options),/base64/);
  assert.throws(()=>measureSyntheticNativeDefectQuality(corrupt('data:application/x-zeter-pixel-buffer-tile;base64,AA=='),item.options),/byte length/);
  assert.throws(()=>measureSyntheticNativeDefectQuality({...item.source,tiles:[]},item.options),/missing or overlapping/);
  assert.throws(()=>measureSyntheticNativeDefectQuality({...item.source,tiles:[...item.source.tiles,...item.source.tiles]},item.options),/missing or overlapping/);
  assert.throws(()=>measureSyntheticNativeDefectQuality(item.source,{...item.options,normal:[0,0,Infinity,1]}),/invalid source/);
  const bytes=Buffer.from(item.source.tiles[0].dataUrl.split(',')[1],'base64');
  bytes.writeFloatLE(NaN,((3*7+3)*4)*4);
  assert.throws(()=>measureSyntheticNativeDefectQuality(corrupt(
    'data:application/x-zeter-pixel-buffer-tile;base64,'+bytes.toString('base64')),item.options),/non-finite/);
});

function quality(outcome='completed-with-cancelled-retry') {
  const before={mae:20,rmse:30},after={mae:3,rmse:5};
  return {
    kind:'zpe-browser-synthetic-native-quality-v1',
    reference:'ZeTer-authored constant native background; not Photoshop',
    bitsPerChannel:16,channels:4,sampledPixels:25,
    baseline:before,firstFill:after,firstRedo:{...after},
    cancelled:outcome==='completed'?null:{...before},
    recoveredFill:outcome==='completed'?null:{...after},
    recoveredUndo:outcome==='completed'?null:{...before},
    recoveredRedo:outcome==='completed'?null:{...after},
  };
}

test('033: quality evidence checks exact native Undo/Redo and synthetic improvement',()=>{
  assert.equal(validateBrowserSyntheticQualityEvidence(quality(),
    {format:'PSD16',outcome:'completed-with-cancelled-retry'}),true);
  assert.equal(validateBrowserSyntheticQualityEvidence(quality('completed'),
    {format:'PSD16',outcome:'completed'}),true);
  const failures=[
    q=>{q.firstFill.mae=22;},
    q=>{q.firstFill.rmse=35;},
    q=>{q.firstRedo.mae=9;},
    q=>{q.cancelled.mae=0;},
    q=>{q.recoveredUndo.rmse=0;},
    q=>{q.recoveredRedo.mae=0;},
    q=>{q.recoveredFill.rmse=Infinity;},
    q=>{q.sampledPixels=24;},
    q=>{q.bitsPerChannel=32;},
    q=>{q.reference='Adobe-authored perfect reference';},
    q=>{q.injectedScore=1;},
  ];
  for(const mutate of failures){
    const q=quality();
    mutate(q);
    assert.throws(()=>validateBrowserSyntheticQualityEvidence(q,
      {format:'PSD16',outcome:'completed-with-cancelled-retry'}),/quality evidence/);
  }
  assert.throws(()=>validateBrowserSyntheticQualityEvidence(null,
    {format:'PSD16',outcome:'completed'}),/quality evidence/);
  assert.throws(()=>validateBrowserSyntheticQualityEvidence(quality(),
    {format:'PSD16',outcome:'failed'}),/quality evidence/);
});
