import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeDng,inspectDng,developDng} from '../src/formats/dng.js';
import {decodeDngLosslessJpeg} from '../src/formats/dng-lossless-jpeg.js';
import {fixture} from './fixtures/dng-fixture.mjs';
import {losslessJpegDngFixture,encodeSyntheticLosslessJpeg} from './fixtures/dng-lossless-jpeg-fixture.mjs';

const rgba=b=>Array.from(decodeDng(b).rgba);
const as8=b=>new Uint8Array(b);
function jpegOffset(raw,le=true){
  const v=new DataView(raw);
  for(let i=0;i<v.getUint16(8,le);i++) {
    const p=10+i*12;
    if(v.getUint16(p,le)===273)return v.getUint32(p+8,le);
  }
  throw Error('no StripOffsets');
}

test('SOF3 compressed CFA decodes exact 8/16-bit pixels and preserves source for II/MM',()=>{
  for(const le of [true,false])for(const bits of [8,16]){
    const samples=bits===8?[100,50,25]:[800,400,200];
    const whiteLevel=bits===8?255:65535;
    const compressed=losslessJpegDngFixture({bits,le,samples,whiteLevel});
    const original=as8(compressed).slice();
    const source=inspectDng(compressed);
    assert.equal(source.compression,7);
    assert.equal(source.compressedSamples.length,16);
    assert.deepEqual(rgba(compressed),
      rgba(fixture({le,bits,samples,whiteLevel})));
    assert.deepEqual(as8(compressed),original,'decoded DNG keeps immutable compressed stream');
    assert.notDeepEqual(rgba(compressed),rgba(fixture({le,bits,samples:[0,0,0],whiteLevel})));
  }
});

test('SOF3 10/12/14-bit precision, predictors 1..7, negative differences, fractional crop + exposure',()=>{
  const sample=(x,y,c)=> (520+x*53+y*17+c*80) & ~3;
  for(const bits of [10,12,14])for(const predictor of [1,2,3,4,5,6,7]){
    const compressed=losslessJpegDngFixture({bits,predictor,width:6,height:4,samples:sample,
      activeArea:[0,1,4,6],defaultCropOrigin:[0.5,0],defaultCropSize:[4,3],
      defaultScale:[1.5,1],orientation:6});
    const uncompressed=fixture({bits:16,width:6,height:4,samples:sample,
      whiteLevel:2**bits-1,activeArea:[0,1,4,6],defaultCropOrigin:[0.5,0],
      defaultCropSize:[4,3],defaultScale:[1.5,1],orientation:6});
    assert.deepEqual(rgba(compressed),rgba(uncompressed),
      'precision='+bits+' predictor='+predictor);
    const a=developDng(inspectDng(compressed),{exposure:0});
    const b=developDng(inspectDng(compressed),{exposure:1});
    assert.ok(b.rgba[0]>a.rgba[0],'real re-development changes pixels');
    assert.deepEqual([a.width,a.height],[3,6]);
  }
});

test('SOF3 point transform 2 reconstructs original sample domain before BlackLevel',()=>{
  const sample=(x,y,c)=> (800+x*12+y*8+c*60) & ~3;
  const compressed=losslessJpegDngFixture({bits:12,pointTransform:2,samples:sample,
    blackLevel:20,whiteLevel:3000});
  const plain=fixture({bits:16,samples:sample,blackLevel:20,whiteLevel:3000});
  assert.deepEqual(rgba(compressed),rgba(plain));
});

test('rejects fabricated JPEG, SOF0, bad SOF3 dimensions, missing EOI and corrupt Huffman',()=>{
  assert.throws(()=>inspectDng(fixture({compression:7})),/lossless JPEG/);
  const valid=losslessJpegDngFixture();
  const offset=jpegOffset(valid);
  const mutation=(edit)=>{
    const b=valid.slice(0);edit(new Uint8Array(b),new DataView(b),offset);return b;
  };
  assert.throws(()=>inspectDng(mutation((u,_,o)=>{u[o]=0;})),/SOI/);
  assert.throws(()=>inspectDng(mutation((u,_,o)=>{u[o+3]=0xc0;})),/SOF3|неподдерживаемый JPEG/);
  assert.throws(()=>inspectDng(mutation((u,_,o)=>{u[o+8]=99;})),/SOF3/);
  assert.throws(()=>inspectDng(mutation((u,_,o)=>{u[u.length-1]=0;})),/EOI/);
  const dht=offset+2+2+2+9; // SOI + SOF3 marker/length/payload
  assert.throws(()=>inspectDng(mutation((u,_,o)=>{u[dht+5]=255;})),/Huffman/);
  assert.throws(()=>inspectDng(valid.slice(0,-1)),/Bayer-полоса|TIFF tag|усечённ/);
  assert.deepEqual(rgba(valid),rgba(losslessJpegDngFixture()),'failed reads do not poison subsequent decode');
});

test('SOF3 reader never accepts pixel/data dimension mismatch or extra trailing bytes',()=>{
  const strip=encodeSyntheticLosslessJpeg({bits:12,width:4,height:4,
    values:Array.from({length:16},()=>800)});
  assert.equal(decodeDngLosslessJpeg(strip,{width:4,height:4,bits:12}).length,16);
  assert.throws(()=>decodeDngLosslessJpeg(strip,{width:5,height:4,bits:12}),/SOF3/);
  assert.throws(()=>decodeDngLosslessJpeg(strip,{width:4,height:4,bits:16}),/SOF3/);
  assert.throws(()=>decodeDngLosslessJpeg(Uint8Array.from([...strip,0]),{width:4,height:4,bits:12}),/EOI/);
});

test('compressed DNG may apply LinearizationTable before BlackLevel without losing source bytes',()=>{
  const lut=Array.from({length:1024},(_,i)=>i*30);
  const raw=losslessJpegDngFixture({bits:10,samples:[500,500,500],
    linearizationTable:lut,blackLevel:500,whiteLevel:30000});
  const source=inspectDng(raw);
  assert.equal(source.compression,7);
  assert.equal(source.linearization[500],15000);
  const srgb=v=>Math.round(255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055));
  assert.deepEqual(Array.from(developDng(source).rgba.slice(0,4)),
    [srgb((15000-500)/(30000-500)),srgb((15000-500)/(30000-500)),srgb((15000-500)/(30000-500)),255]);
});


test('SOF3 2/4 interleaved DC components preserve Bayer pixel order (II/MM, 8–16 bits)',()=>{
  for(const components of [2,4])for(const le of [true,false])for(const bits of [8,10,12,14,16]){
    const sample=(x,y,c)=>((bits===8?24:360)+x*7+y*11+c*13);
    const raw=losslessJpegDngFixture({components,le,bits,width:8,height:4,samples:sample});
    const plain=fixture({le,bits:bits===8?8:16,width:8,height:4,samples:sample,
      whiteLevel:2**bits-1});
    assert.deepEqual(rgba(raw),rgba(plain),
      'components='+components+' endian='+le+' precision='+bits);
    const source=inspectDng(raw);
    assert.equal(source.compression,7);
    assert.equal(source.compressedSamples.length,32);
    assert.equal(source.compressedSamples[0],sample(0,0,0));
    assert.equal(source.compressedSamples[1],sample(1,0,1));
    assert.equal(source.compressedSamples[8],sample(0,1,1));
  }
});

test('SOF3 independent component predictors 1..7 and point transform survive re-development',()=>{
  for(const components of [2,4])for(const predictor of [1,2,3,4,5,6,7]){
    const sample=(x,y,c)=> (600+x*20+y*12+c*44)&~3;
    const raw=losslessJpegDngFixture({components,predictor,pointTransform:2,
      width:8,height:6,bits:12,samples:sample,defaultCropOrigin:[0.5,0],
      defaultCropSize:[6,6],orientation:6,blackLevel:12});
    const plain=fixture({width:8,height:6,bits:16,samples:sample,
      whiteLevel:4095,defaultCropOrigin:[0.5,0],defaultCropSize:[6,6],
      orientation:6,blackLevel:12});
    assert.deepEqual(rgba(raw),rgba(plain), 'component predictor '+components+'/'+predictor);
    const source=inspectDng(raw);
    const a=developDng(source,{exposure:0});
    const b=developDng(source,{exposure:1});
    assert.ok(b.rgba.some((v,i)=>i%4!==3 && v!==a.rgba[i]),'exposure re-develops actual pixels');
  }
});

test('SOF3 multi-component malformed frame and SOS are fail-closed',()=>{
  const valid=losslessJpegDngFixture({components:4,width:8,height:4});
  const offset=jpegOffset(valid);
  const mutation=edit=>{const copy=valid.slice(0);edit(new Uint8Array(copy),offset);return copy;};
  // SOF3 starts FF C3 length(2), precision, height(2), width(2), Nf.
  assert.throws(()=>inspectDng(mutation((b,o)=>{b[o+11]=3;})),/SOF3|компонент/);
  assert.throws(()=>inspectDng(mutation((b,o)=>{b[o+15]=1;})),/SOF3|компонент/); // duplicate component ID
  assert.throws(()=>inspectDng(mutation((b,o)=>{b[o+13]=0x21;})),/SOF3|subsampling/);
  const stream=encodeSyntheticLosslessJpeg({width:8,height:4,bits:12,components:4,
    values:Array.from({length:32},(_,i)=>500+i*3)});
  assert.throws(()=>decodeDngLosslessJpeg(stream,{width:6,height:4,bits:12}),/SOF3|компонент/);
  const bad=stream.slice();
  const sos=bad.findIndex((v,i)=>v===0xff&&bad[i+1]===0xda);
  assert.ok(sos>0);
  bad[sos+5]=99; // SOS first component selector; not in SOF3
  assert.throws(()=>decodeDngLosslessJpeg(bad,{width:8,height:4,bits:12}),/SOS|компонент/);
  assert.deepEqual(Array.from(decodeDngLosslessJpeg(stream,{width:8,height:4,bits:12})),
    Array.from({length:32},(_,i)=>500+i*3));
});
