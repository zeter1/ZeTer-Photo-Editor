// Stage 002B/2b: admission of a genuinely external RGB32 PSB fixture.
// psd-tools fixture authorship by Adobe Photoshop is NOT established.
// A matching PSD pair tests file-format interpretation, not an Adobe golden.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodePsd} from '../src/formats/psd.js';

export const PSDTOOLS_REVISION='c49b17525254d84c89ab42d1cb0316402ddb89b8';
export const PSDTOOLS_CASES=Object.freeze([
  {name:'32bit.psb',version:2,width:100,height:150,size:282992,
    sha256:'232bde4537492a671d22b7ff7025a786bc8110677ce5add180103f977be4f5ee'},
  {name:'32bit.psd',version:1,width:100,height:150,size:282154,
    sha256:'78dd96ec74960a392db0a3bf4193478d62adfa5d93634ab7ce8a40e4468df5e1'},
  {name:'32bit5x5.psb',version:2,width:5,height:5,size:20954,
    sha256:'cd506872a4b1dc48bf7f64e10d321b99ea950c557cd3a83e303288e8ef6bf481'},
]);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// Independent, minimal wire-header gate: must not mistake PSD32 for PSB32.
export function verifyExternalPsbHeader(bytes,spec) {
  assert.ok(bytes instanceof Uint8Array,'external source must be bytes');
  assert.equal(bytes.byteLength,spec.size,'fixed external input length');
  assert.equal(sha256(bytes),spec.sha256,'fixed external SHA-256');
  assert.ok(bytes.byteLength>=26,'complete PSD/PSB header');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(Buffer.from(bytes.subarray(0,4)).toString('ascii'),'8BPS','8BPS signature');
  assert.equal(view.getUint16(4,false),spec.version,'PSD versus PSB wire version');
  assert.ok(bytes.subarray(6,12).every(b=>b===0),'reserved header bytes');
  const channels=view.getUint16(12,false);
  assert.ok(channels===3 || channels===4,'RGB channel count');
  assert.equal(view.getUint32(14,false),spec.height,'height');
  assert.equal(view.getUint32(18,false),spec.width,'width');
  assert.equal(view.getUint16(22,false),32,'native Float32 depth');
  assert.equal(view.getUint16(24,false),3,'RGB mode only');
  return {version:spec.version,channels,width:spec.width,height:spec.height};
}

export function fingerprintNativeLayers(document) {
  assert.ok(Array.isArray(document?.layers),'decoded document has layers');
  const layers=[];
  for(const layer of document.layers) {
    const source=layer.pixelBuffer;
    if(!source)continue;
    assert.equal(source.model,'rgb','native RGB layer model');
    assert.equal(source.bitsPerChannel,32,'native source depth');
    assert.ok(source.data instanceof Float32Array,'native Float32Array retained');
    assert.equal(source.data.length,layer.width*layer.height*4,'complete native RGBA buffer');
    const raw=Buffer.from(source.data.buffer,source.data.byteOffset,source.data.byteLength);
    layers.push({name:layer.name,width:layer.width,height:layer.height,
      rawBytes:raw.byteLength,sha256:sha256(raw)});
  }
  assert.ok(layers.length>0,'at least one editable native Float32 layer');
  return layers.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export async function verifyPsdToolsPsbCorpus(dir) {
  assert.ok(typeof dir==='string' && path.isAbsolute(dir),'absolute external corpus directory');
  const results=[];
  for(const spec of PSDTOOLS_CASES) {
    const bytes=await readFile(path.join(dir,spec.name));
    const wire=verifyExternalPsbHeader(bytes,spec);
    const decoded=await decodePsd(bytes);
    assert.equal(decoded.width,wire.width,'decoded width matches external header');
    assert.equal(decoded.height,wire.height,'decoded height matches external header');
    const layers=fingerprintNativeLayers(decoded);
    results.push({name:spec.name,version:wire.version,layers});
  }
  // Two upstream variants share a fixture stem. This is cross-format
  // raster preservation, not an independent Photoshop render oracle.
  assert.deepEqual(results[0].layers,results[1].layers,'PSD/PSB paired native raster parity');
  return results;
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const pos=process.argv.indexOf('--dir');
  if(pos<0 || !process.argv[pos+1])throw Error('usage: node tools/verify-psdtools-psb32-candidates.mjs --dir /abs/dir');
  const results=await verifyPsdToolsPsbCorpus(process.argv[pos+1]);
  console.log('Independent psd-tools PSB32 candidate:',JSON.stringify(results));
}
