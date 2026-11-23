import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDngLosslessJpeg} from '../src/formats/dng-lossless-jpeg.js';
import {decodeDng,inspectDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {encodeSyntheticLosslessJpeg,losslessJpegDngFixture,
  tiledLosslessJpegDngFixture} from './fixtures/dng-lossless-jpeg-fixture.mjs';

const makeSamples=(width,height,bits)=>
  Array.from({length:width*height},(_,i)=> {
    const x=i%width,y=Math.floor(i/width);
    return (bits===8?40:440)+x*7+y*9+((x+y)%3)*13;
  });
const markers=(bytes,id)=>Array.from(bytes.keys()).filter(i=>
  bytes[i]===0xff && bytes[i+1]===id);

test('SOF3 separate non-interleaved component scans decode exact independent sample positions',()=>{
  for(const components of [2,4])for(const bits of [8,12,16])
    for(const predictor of [1,4,7])for(const interval of [0,1,5,13]) {
      const width=8,height=5,values=makeSamples(width,height,bits);
      const stream=encodeSyntheticLosslessJpeg({width,height,bits,values,
        components,predictor,restartInterval:interval,scanMode:'planar'});
      assert.equal(markers(stream,0xda).length,components,'one SOS per component');
      assert.deepEqual([...decodeDngLosslessJpeg(stream,{width,height,bits})],values,
        'SOF3 separate scans '+components+'/'+bits+'/'+predictor+'/'+interval);
    }
});

test('SOF3 out-of-order scans use frame component IDs and keep native pixel precision',()=>{
  const width=8,height=4,bits=16,values=makeSamples(width,height,bits);
  const input=encodeSyntheticLosslessJpeg({width,height,bits,values,
    components:4,scanMode:'planar',scanOrder:[3,1,0,2],restartInterval:3,pointTransform:2});
  const expected=values.map(v=>(v>>2)<<2);
  assert.deepEqual([...decodeDngLosslessJpeg(input,{width,height,bits})],expected);
});

test('DNG SOF3 planar multi-scan strips and padded TIFF tiles render like uncompressed Bayer',()=>{
  for(const le of [true,false])for(const components of [2,4]) {
    const bits=12,width=8,height=6;
    const sample=(x,y,c)=>600+x*7+y*11+c*23;
    const options={le,bits,width,height,samples:sample,orientation:6,
      defaultCropOrigin:[0.5,0],defaultCropSize:[6,5],whiteLevel:4095};
    const baseline=fixture({...options,bits:16});
    const scan=losslessJpegDngFixture({...options,components,scanMode:'planar',
      scanOrder:components===4?[3,1,0,2]:[1,0],restartInterval:3});
    const tiled=tiledLosslessJpegDngFixture({...options,components,scanMode:'planar',
      tileWidth:4,tileLength:3,restartInterval:2});
    for(const result of [scan,tiled]) {
      const original=new Uint8Array(result).slice();
      assert.deepEqual([...decodeDng(result).rgba],[...decodeDng(baseline).rgba]);
      assert.equal(inspectDng(result).compression,7);
      assert.deepEqual(new Uint8Array(result),original,'original SOF3 DNG bytes immutable');
    }
  }
});

test('SOF3 multi-scan rejects absent, duplicate, unknown and corrupt component scans',()=>{
  const width=8,height=4,bits=12,values=makeSamples(width,height,bits);
  const original=encodeSyntheticLosslessJpeg({width,height,bits,values,
    components:4,scanMode:'planar',restartInterval:3});
  const scan=markers(original,0xda);
  assert.equal(scan.length,4);
  const replace=(edit)=>{const v=original.slice();edit(v);return v;};
  assert.throws(()=>decodeDngLosslessJpeg(
    Uint8Array.from([...original.slice(0,scan[3]),255,217]),{width,height,bits}),
    /scan|компонент|SOS|EOI|неполный/i,'premature EOI');
  assert.throws(()=>decodeDngLosslessJpeg(replace(b=>b[scan[1]+5]=1),
    {width,height,bits}),/компонент|повтор|SOS|scan/i,'duplicate component');
  assert.throws(()=>decodeDngLosslessJpeg(replace(b=>b[scan[1]+5]=99),
    {width,height,bits}),/компонент|SOF3|SOS|scan/i,'unknown component');
  assert.throws(()=>decodeDngLosslessJpeg(replace(b=>b[scan[2]+6]=0xff),
    {width,height,bits}),/таблиц|SOS|scan|Huffman|компонент/i,'invalid Huffman selector');
  assert.throws(()=>decodeDngLosslessJpeg(replace(b=>b[scan[1]+4]=2),
    {width,height,bits}),/SOS|scan|компонент/i,'illegal mixed scan');
  assert.throws(()=>decodeDngLosslessJpeg(Uint8Array.from([...original,0]),
    {width,height,bits}),/EOI|лишние/i,'trailing garbage');
});
