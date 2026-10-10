import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Script, runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  createPixelBuffer,
  inpaintTiledPixelBufferSource,
  serializeTiledPixelBufferSource,
} from '../src/core/pixel-buffer.js';

const supplier = await readFile(new URL('../src/core/tiled-inpaint-worker-source.js', import.meta.url), 'utf8');

test('Stage 003 classic browser Worker source is deterministically rebuilt from canonical modules', () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../tools/build-tiled-inpaint-worker.mjs', import.meta.url)),
    '--check',
  ], { encoding:'utf8', timeout:30_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const realm = {};
  runInNewContext(supplier, realm);
  const script = realm.__zpeTiledInpaintWorkerSource;
  assert.ok(typeof script === 'string' && script.length > 10_000);
  assert.doesNotMatch(script, /\bimportScripts\s*\(|\bimport\s*\(/);
  assert.doesNotMatch(script, /^\s*(?:import|export)\s/m);
  assert.doesNotMatch(script, /\bfetch\s*\(/);
  assert.doesNotMatch(script, /\bnode:worker_threads\b/);
  new Script(script, { filename:'tiled-inpaint.worker.js' });
});

test('Stage 003 classic Worker protocol computes native CMYKA and recovers after malformed job', () => {
  const realm = {};
  runInNewContext(supplier, realm);
  const listeners = new Map();
  const replies = [];
  const workerSelf = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    postMessage(payload) { replies.push(payload); },
  };
  runInNewContext(realm.__zpeTiledInpaintWorkerSource, {
    self:workerSelf, atob, btoa,
    setTimeout, clearTimeout,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(replies.shift())), {ready:true});
  const width=16, height=16;
  const data=new Float32Array(width*height*5);
  for(let pixel=0;pixel<width*height;pixel+=1) {
    data.set([0.15,0.25,0.35,0.45,1],pixel*5);
  }
  const selected=7*width+8;
  data.set([9,9,9,9,1],selected*5);
  const source=serializeTiledPixelBufferSource(createPixelBuffer({
    width,height,model:'cmyk',channels:5,
    bitsPerChannel:32,colorSpace:'device-cmyk',data,
  }),{tileSize:8});
  const expected=inpaintTiledPixelBufferSource(source,{
    isAllowed:(x,y)=>y*width+x===selected,halo:2,maxLayerPixels:300,
  });
  const frozen=JSON.stringify(source);
  const onMessage=listeners.get('message');
  assert.equal(typeof onMessage,'function');
  onMessage({data:{id:1,source,selectedIndices:[selected,selected]}});
  assert.equal(replies.shift().ok,false);
  onMessage({data:{id:2,source,selectedIndices:[selected],halo:2,maxLayerPixels:300}});
  const reply=replies.shift();
  assert.equal(reply.id,2);
  assert.equal(reply.ok,true);
  assert.deepEqual(JSON.parse(JSON.stringify(reply.result)),expected);
  assert.equal(JSON.stringify(source),frozen,'original tiles must stay immutable');
});
