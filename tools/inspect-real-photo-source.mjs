// Inspect a LOCAL copy of the documented 037 CC0 photograph. Do not
// download an unpinned mutable URL during tests or call this a benchmark.
import {readFile} from 'node:fs/promises';
import {inspectPhotoJpeg} from './real-photo-source-integrity.mjs';

const path=process.argv[2];
if(!path || process.argv.length!==3) {
  console.error('Usage: node tools/inspect-real-photo-source.mjs <local-original-jpeg>');
  process.exitCode=2;
} else {
  try {
    const bytes=await readFile(path);
    const info=inspectPhotoJpeg(bytes,{
      expectedSha1:'c7fc9f013c70e01f164d232462ddd6e37e4079c4',
      expectedWidth:2560,expectedHeight:1920,
    });
    console.log(JSON.stringify({
      ...info,
      source:'https://commons.wikimedia.org/wiki/File:Red-brick-wall-texture-clean.jpg',
      license:'CC0-1.0',
      status:'candidate inspection only; pin SHA-256 and verify decoded pixels before benchmarking',
    },null,2));
  } catch(error) {
    console.error(String(error));
    process.exitCode=1;
  }
}
