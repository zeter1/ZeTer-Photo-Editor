import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import {
  createPixelBuffer,
  inpaintTiledPixelBufferSourceFromIndices,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';
import { decodePsd, encodePsd, encodePsb, inspectPsdHeader } from '../src/formats/psd.js';
import { createTiledInpaintWorkerJobController } from '../src/core/tiled-inpaint-worker-client.js';
import { prepareTiledInpaintWithWorker } from '../src/painting/tiled-inpaint-dispatch.js';

// Exercise the complete native Photoshop binary -> tiled -> detached Worker
// seam at the two depths not provided by the independently sourced 8-bit corpus.
// These fixtures are created by ZeTer's own writer, NOT Photoshop-authored
// compatibility fixtures or evidence for large-file browser memory behavior.
const cases = [
  {
    name:'16-bit layered PSD',
    version:1,
    bitsPerChannel:16,
    write:encodePsd,
    ArrayType:Uint16Array,
    colorSpace:'srgb',
    background:[12000,22000,32000,65535],
    defect:[62000,50000,45000,65535],
  },
  {
    name:'32-bit HDR layered PSB',
    version:2,
    bitsPerChannel:32,
    write:encodePsb,
    ArrayType:Float32Array,
    colorSpace:'linear-rgb-unmanaged',
    background:[-0.5,0.25,2.5,1],
    defect:[9,5,7,1],
  },
];

for (const scenario of cases) {
  test('Stage 003: ' + scenario.name + ' preserves native samples through real tiled Worker', async () => {
    const width=8, height=8, tileSize=4, channels=4, x=3, y=3;
    const samples = new scenario.ArrayType(width * height * channels);
    for (let row=0; row<height; row+=1) {
      for (let column=0; column<width; column+=1) {
        samples.set(column===x && row===y ? scenario.defect : scenario.background,
          (row*width+column)*channels);
      }
    }
    const original = createPixelBuffer({
      width,height,model:'rgb',channels,bitsPerChannel:scenario.bitsPerChannel,
      colorSpace:scenario.colorSpace,data:samples,
    });
    const bytes = scenario.write({
      width,height,bitsPerChannel:scenario.bitsPerChannel,
      compositePixelBuffer:original,
      layers:[{
        name:'Native high-depth seam',x:0,y:0,width,height,pixelBuffer:original,
        opacity:1,blendMode:'source-over',visible:true,
      }],
    });
    const header = inspectPsdHeader(bytes);
    assert.equal(header.version,scenario.version);
    assert.equal(header.bitsPerChannel,scenario.bitsPerChannel);
    const decoded = await decodePsd(bytes);
    assert.equal(decoded.layers.length,1);
    const decodedPixels=decoded.layers[0].pixelBuffer;
    assert.equal(decodedPixels.bitsPerChannel,scenario.bitsPerChannel);
    assert.ok(decodedPixels.data instanceof scenario.ArrayType);
    assert.deepEqual(Array.from(decodedPixels.data),Array.from(samples),
      'PSD/PSB binary round-trip must not quantize native precision');

    const source=serializeTiledPixelBufferSource(decodedPixels,{tileSize});
    assert.equal(source.kind,'zpe-pixel-buffer-source-v2');
    assert.equal(source.tiles.length,4);
    const before=JSON.stringify(source);
    const chosen=y*width+x;
    const expected=inpaintTiledPixelBufferSourceFromIndices(source,{
      selectedIndices:Uint32Array.of(chosen),
    });
    let created=0, sampled=0, yielded=0;
    const worker=createTiledInpaintWorkerJobController({
      createWorker() {
        created+=1;
        return new Worker(new URL('../tools/tiled-inpaint-worker-thread.mjs',import.meta.url),{
          type:'module',
        });
      },
    });
    try {
      const result=await prepareTiledInpaintWithWorker(source,{
        worker,scanChunkPixels:9,
        yieldControl:async () => { yielded+=1; },
        isAllowed:(col,row) => {
          sampled+=1;
          return col===x && row===y;
        },
      });
      assert.equal(created,1,'a real worker_threads kernel must execute');
      assert.ok(yielded>0,'selection scan must remain cooperative');
      assert.equal(sampled,width*height,'selection geometry must be sampled once');
      assert.equal(result.filled,1);
      assert.deepEqual(result,expected,'Worker output must match native frozen-index oracle');
      assert.equal(JSON.stringify(source),before,'original tile payloads remain immutable');
      assert.equal(result.changedTiles,1,'seam-adjacent edit must touch only its tile');
      for (let tile=1; tile<source.tiles.length; tile+=1) {
        assert.equal(result.source.tiles[tile].dataUrl,source.tiles[tile].dataUrl,
          'unmodified donor tile payload must stay byte-identical');
      }
      assert.equal(worker.cancel(),false,'worker already terminated after result');
    } finally {
      worker.cancel();
    }
  });
}
