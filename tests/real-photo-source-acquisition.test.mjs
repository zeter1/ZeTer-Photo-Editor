import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  ORIGINAL_PHOTO_URL,ORIGINAL_PHOTO_POLICY,
  readPhotoSourceResponse,downloadPhotoSourceCandidate,
} from '../tools/fetch-real-photo-source.mjs';

// Intentionally NOT entropy-decodable and NOT a genuine photograph.
const syntheticJpeg=()=>Uint8Array.from([
  0xff,0xd8,0xff,0xe0,0,4,0,0,
  0xff,0xc0,0,17,8,0,240,0,240,3,1,0x11,0,2,0x11,0,3,0x11,0,
  0xff,0xda,0,8,3,1,0,2,0,3,0,0x01,0x33,0xff,0xd9,
]);
const sha=(bytes,algorithm)=>createHash(algorithm).update(bytes).digest('hex');
const policy=bytes=>({
  expectedSha1:sha(bytes,'sha1'),
  expectedWidth:240,
  expectedHeight:240,
});
const response=(bytes,headers={'content-type':'image/jpeg'})=>
  new Response(bytes,{status:200,headers});

test('037B2b-2e: fixed immutable source identity and no test policy in public downloader',async()=>{
  assert.match(ORIGINAL_PHOTO_URL,/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
  assert.equal(ORIGINAL_PHOTO_POLICY.expectedSha1,'c7fc9f013c70e01f164d232462ddd6e37e4079c4');
  assert.equal(ORIGINAL_PHOTO_POLICY.expectedWidth,2560);
  assert.equal(ORIGINAL_PHOTO_POLICY.expectedHeight,1920);
  const script=fileURLToPath(new URL('../tools/fetch-real-photo-source.mjs',import.meta.url));
  const cli=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:5000});
  assert.equal(cli.status,2);
  assert.match(cli.stderr,/NEW-original\.jpg/);
  const bytes=syntheticJpeg();
  const folder=await mkdtemp(join(tmpdir(),'zpe-photo-fetch-'));
  const path=join(folder,'original.jpg');
  try {
    let count=0;
    await assert.rejects(downloadPhotoSourceCandidate(path,{
      fetcher:async (url,options)=>{
        count++;
        assert.equal(url,ORIGINAL_PHOTO_URL);
        assert.equal(options.method,'GET');
        assert.equal(options.redirect,'error');
        assert.equal(options.headers.Accept,'image/jpeg');
        assert.equal(options.signal.aborted,false);
        return response(bytes);
      },
    }),/037 photo source: original JPEG SHA-1 mismatch/);
    assert.equal(count,1);
    await assert.rejects(stat(path),{code:'ENOENT'});
    await writeFile(path,'preexisting original');
    await assert.rejects(downloadPhotoSourceCandidate(path,{
      fetcher:async()=>response(bytes),
    }),/037 photo source: original JPEG SHA-1 mismatch/);
    assert.equal(await readFile(path,'utf8'),'preexisting original');
  } finally {
    await rm(folder,{recursive:true,force:true});
  }
});

test('037B2b-2e: bounded response reader validates synthetic structure before publication',async()=>{
  const bytes=syntheticJpeg();
  const result=await readPhotoSourceResponse(response(bytes),policy(bytes));
  assert.deepEqual(result.bytes,Buffer.from(bytes));
  assert.equal(result.inspection.sha1,sha(bytes,'sha1'));
  assert.equal(result.inspection.sha256,sha(bytes,'sha256'));
  assert.equal(result.inspection.pixelDecodeVerified,false);
  assert.equal(result.inspection.colorSpaceVerified,false);
  assert.equal(result.inspection.width,240);
  assert.equal(result.inspection.height,240);
});

test('037B2b-2e: hostile HTTP status, redirect, MIME, length and bytes fail closed',async()=>{
  const bytes=syntheticJpeg(),opts=policy(bytes);
  const altered=bytes.slice();altered[altered.length-3]^=1;
  const errors=[
    [new Response(bytes,{status:404,headers:{'content-type':'image/jpeg'}}),/direct HTTP 200/],
    [Response.redirect('https://example.invalid/photo.jpg',302),/direct HTTP 200/],
    [{status:200,redirected:true,headers:new Headers({'content-type':'image/jpeg'}),
      body:response(bytes).body},/direct HTTP 200/],
    [response(bytes,{'content-type':'text/html'}),/content type/],
    [response(bytes,{'content-type':'image/jpeg-unsafe'}),/content type/],
    [response(bytes,{'content-type':'image/jpeg','content-length':'33554433'}),/Content-Length/],
    [response(bytes,{'content-type':'image/jpeg','content-length':'junk'}),/Content-Length/],
    [response(bytes,{'content-type':'image/jpeg','content-length':String(bytes.length+1)}),/truncated JPEG/],
    [response(new Uint8Array(0)),/empty or truncated/],
    [response(altered),/original JPEG SHA-1 mismatch/],
    [response(bytes),/original JPEG SHA-1 mismatch/],
  ];
  for(let i=0;i<errors.length;i++){
    const [input,pattern]=errors[i];
    const expected=i===errors.length-1?{...opts,expectedSha1:'0'.repeat(40)}:opts;
    await assert.rejects(readPhotoSourceResponse(input,expected),pattern,'attack '+i);
  }
});

test('037B2b-2e: streaming size limit rejects oversized chunks regardless of Content-Length',async()=>{
  const stream=new ReadableStream({
    start(controller){
      controller.enqueue(new Uint8Array(32*1024*1024+1));
      controller.close();
    },
  });
  const fake={status:200,redirected:false,
    headers:new Headers({'content-type':'image/jpeg'}),body:stream};
  await assert.rejects(readPhotoSourceResponse(fake,policy(syntheticJpeg())),
    /download exceeds 32 MiB/);
});
