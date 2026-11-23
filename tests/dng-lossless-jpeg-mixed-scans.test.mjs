import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDngLosslessJpeg} from '../src/formats/dng-lossless-jpeg.js';
import {decodeDng} from '../src/formats/dng.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {encodeSyntheticLosslessJpeg, losslessJpegDngFixture,
  tiledLosslessJpegDngFixture} from './fixtures/dng-lossless-jpeg-fixture.mjs';

// A synthetic entropy/reference fixture, NOT an independent camera/LibRaw oracle.
const samples = (width, height, bits) => Array.from({length:width*height},(_,i)=>{
  const x=i%width,y=Math.floor(i/width);
  return (bits===8?34:500)+x*9+y*13+((x+y)%3)*5;
});
const markers = (bytes,id) => Array.from(bytes.keys()).filter(i=>bytes[i]===255&&bytes[i+1]===id);

test('SOF3 mixed 1+2+1 scans decode exact per-component CFA and RST predictors',()=>{
  for(const bits of [8,12,16])for(const predictor of [1,4,7])
    for(const restartInterval of [0,1,3,7]){
      const width=8,height=5,values=samples(width,height,bits);
      const bytes=encodeSyntheticLosslessJpeg({width,height,bits,values,
        components:4,scanMode:'mixed',scanOrder:[3,0,2,1],predictor,restartInterval});
      const scans=markers(bytes,0xda);
      assert.deepEqual(scans.map(i=>bytes[i+4]),[1,2,1]);
      assert.deepEqual([...decodeDngLosslessJpeg(bytes,{width,height,bits})],values,
        `mixed 1+2+1 SOF3 ${bits}/${predictor}/${restartInterval}`);
    }
});

test('mixed SOF3 preserves Pt and component permutations, including edge restart',()=>{
  const width=8,height=3,bits=16,values=samples(width,height,bits);
  for(const order of [[0,1,2,3],[2,0,3,1],[3,2,1,0]]){
    const stream=encodeSyntheticLosslessJpeg({width,height,bits,values,
      components:4,scanMode:'mixed',scanOrder:order,restartInterval:1,
      predictor:6,pointTransform:2});
    assert.deepEqual([...decodeDngLosslessJpeg(stream,{width,height,bits})],
      values.map(v=>(v>>2)<<2));
  }
});

test('mixed SOS TIFF II/MM strips and padded tiles match uncompressed RAW preview',()=>{
  for(const le of [true,false]){
    const options={le,bits:12,width:8,height:6,
      samples:(x,y,c)=>500+x*7+y*9+c*19,orientation:6,
      defaultCropOrigin:[0.5,0],defaultCropSize:[6,5],whiteLevel:4095};
    const expected=decodeDng(fixture({...options,bits:16}));
    for(const dng of [
      losslessJpegDngFixture({...options,components:4,scanMode:'mixed',
        scanOrder:[3,0,2,1],restartInterval:3}),
      tiledLosslessJpegDngFixture({...options,components:4,scanMode:'mixed',
        scanOrder:[2,1,3,0],tileWidth:4,tileLength:3,restartInterval:2})
    ]){
      const original=new Uint8Array(dng).slice();
      const actual=decodeDng(dng);
      assert.deepEqual([actual.width,actual.height],[expected.width,expected.height]);
      assert.deepEqual([...actual.rgba],[...expected.rgba]);
      assert.deepEqual([...new Uint8Array(dng)],[...original],'source DNG unchanged');
    }
  }
});

test('mixed SOS fail closed on partial, duplicate, unknown, malformed and RST',()=>{
  const width=8,height=4,bits=12,values=samples(width,height,bits);
  const base=encodeSyntheticLosslessJpeg({width,height,bits,values,
    components:4,scanMode:'mixed',scanOrder:[3,0,2,1],restartInterval:2});
  const [a,b,c]=markers(base,0xda);
  assert.ok(a&&b>a&&c>b);
  const bad=edit=>{const copy=base.slice();edit(copy);return copy;};
  const reject=bytes=>assert.throws(()=>decodeDngLosslessJpeg(bytes,{width,height,bits}),
    /DNG: lossless JPEG/);
  reject(Uint8Array.from([...base.slice(0,c),255,217])); // missing last component
  reject(bad(bytes=>{bytes[c+5]=bytes[a+5];})); // duplicate across scans
  reject(bad(bytes=>{bytes[b+7]=bytes[b+5];})); // duplicate within paired scan
  reject(bad(bytes=>{bytes[b+7]=99;})); // non-frame component
  reject(bad(bytes=>{bytes[b+4]=3;})); // unsupported SOS length/count
  const rst=markers(base,0xd0).find(i=>i>c);
  assert.ok(rst,'must exercise RST in final singleton SOS');
  reject(bad(bytes=>{bytes[rst+1]=0xd7;}));
  reject(Uint8Array.from([...base,0])); // bytes after EOI
});
