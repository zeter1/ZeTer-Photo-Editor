import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDng,inspectDng} from '../src/formats/dng.js';
import {decodeDngLosslessJpeg} from '../src/formats/dng-lossless-jpeg.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {encodeSyntheticLosslessJpeg,losslessJpegDngFixture} from './fixtures/dng-lossless-jpeg-fixture.mjs';

const bytes = b => new Uint8Array(b);
const pixels = b => [...decodeDng(b).rgba];
const markAt = (b,marker) => b.findIndex((v,i)=>v===255 && b[i+1]===marker);

test('SOF3 restart interval restores original camera samples at MCU boundaries',()=>{
  for(const components of [1,2,4])
    for(const interval of [1,2,3,4,7,8,11,24,47])
      for(const predictor of [1,4,7]){
        const width=8,height=6,bits=12;
        const values=Array.from({length:width*height},(_,i)=>600+(i%width)*11+Math.floor(i/width)*7);
        const jpeg=encodeSyntheticLosslessJpeg({width,height,bits,values,components,predictor,restartInterval:interval});
        assert.deepEqual([...decodeDngLosslessJpeg(jpeg,{width,height,bits})],values,
          'components='+components+' restart='+interval+' predictor='+predictor);
      }
});

test('DNG Compression=7 restart streams match uncompressed CFA previews and preserve bytes',()=>{
  for(const components of [1,2,4])for(const le of [true,false])
    for(const bits of [8,12,16]){
      const sample=(x,y,c)=>(bits===8?60:600)+x*9+y*7+c*13;
      const width=8,height=6;
      const input=losslessJpegDngFixture({components,le,bits,width,height,samples:sample,
        restartInterval:5,defaultCropOrigin:[0.5,0],defaultCropSize:[6,5],orientation:6});
      const original=bytes(input).slice();
      const plain=fixture({le,bits:bits===8?8:16,width,height,samples:sample,
        whiteLevel:2**bits-1,defaultCropOrigin:[0.5,0],defaultCropSize:[6,5],orientation:6});
      assert.deepEqual(pixels(input),pixels(plain),'sensor CFA vs compressed '+components+'/'+bits);
      assert.equal(inspectDng(input).compression,7);
      assert.deepEqual(bytes(input),original,'compressed source remains byte-identical');
    }
});

test('SOF3 restart is fail closed on wrong RST order, missing marker, DRI corruption, unannounced RST',()=>{
  const values=Array.from({length:32},(_,i)=>700+i*3);
  const good=encodeSyntheticLosslessJpeg({width:8,height:4,bits:12,values,
    components:4,restartInterval:2});
  assert.deepEqual([...decodeDngLosslessJpeg(good,{width:8,height:4,bits:12})],values);
  const rst=markAt(good,0xd0),dri=markAt(good,0xdd);
  assert.ok(rst>0 && dri>0,'fixture has restart and DRI markers');
  const mutated=(edit)=>{const b=good.slice();edit(b);return b;};
  assert.throws(()=>decodeDngLosslessJpeg(mutated(b=>{b[rst+1]=0xd3;}),{width:8,height:4,bits:12}),
    /restart|RST|маркер/i);
  assert.throws(()=>decodeDngLosslessJpeg(mutated(b=>{b[rst]=0;}),{width:8,height:4,bits:12}),
    /restart|RST|маркер/i);
  assert.throws(()=>decodeDngLosslessJpeg(mutated(b=>{b[dri+4]=0;b[dri+5]=0;}),{width:8,height:4,bits:12}),
    /restart|DRI/i);
  assert.throws(()=>decodeDngLosslessJpeg(mutated(b=>{b[dri+1]=0xfe;}),{width:8,height:4,bits:12}),
    /restart|маркер|EOI/i);
  assert.throws(()=>decodeDngLosslessJpeg(Uint8Array.from([...good,0]),{width:8,height:4,bits:12}),
    /EOI|лишние/i);
});

test('SOF3 no-DRI legacy stream remains identical to uncompressed pixels',()=>{
  const values=Array.from({length:16},(_,i)=>400+i*9);
  const jpeg=encodeSyntheticLosslessJpeg({width:4,height:4,bits:12,values});
  assert.equal(markAt(jpeg,0xdd),-1);
  assert.deepEqual([...decodeDngLosslessJpeg(jpeg,{width:4,height:4,bits:12})],values);
});
