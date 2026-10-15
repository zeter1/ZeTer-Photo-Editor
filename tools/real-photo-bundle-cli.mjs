// Offline photo fixture admission, no network access and no JPEG decoder.
// Usage: node tools/real-photo-bundle-cli.mjs candidate <original.jpg> <decoded.rgba> <decoder.json>
//        node tools/real-photo-bundle-cli.mjs verify <reviewed-manifest.json> <original.jpg> <decoded.rgba>
// Candidate output must be reviewed and pinned separately before "verify".
import {readFile,stat} from 'node:fs/promises';
import {inspectPhotoBundleCandidate,admitPhotoBundle,REAL_PHOTO_SOURCE}
  from './real-photo-bundle-admission.mjs';

const usage='Usage: node tools/real-photo-bundle-cli.mjs candidate <original.jpg> <decoded.rgba> <decoder.json>\n'+
  '   or: node tools/real-photo-bundle-cli.mjs verify <reviewed-manifest.json> <original.jpg> <decoded.rgba>';
async function boundedRead(path,max) {
  const info=await stat(path);
  if(!info.isFile() || info.size<=0 || info.size>max)
    throw new TypeError('037 photo bundle: empty or oversized fixture input: '+path);
  return readFile(path);
}
async function jsonRead(path) {
  const raw=await boundedRead(path,16*1024);
  return JSON.parse(raw.toString('utf8'));
}
const [mode,a,b,c]=process.argv.slice(2);
if(!['candidate','verify'].includes(mode) || !a || !b || !c ||
   process.argv.length!==6) {
  console.error(usage);
  process.exitCode=2;
} else {
  try {
    const rgbaLimit=REAL_PHOTO_SOURCE.width*REAL_PHOTO_SOURCE.height*4;
    if(mode==='candidate') {
      const [jpeg,rgba,decoder]=await Promise.all([
        boundedRead(a,32*1024*1024),boundedRead(b,rgbaLimit),jsonRead(c),
      ]);
      const result=inspectPhotoBundleCandidate({jpeg,rgba,decoder});
      console.log(JSON.stringify(result,null,2));
    } else {
      const [manifest,jpeg,rgba]=await Promise.all([
        jsonRead(a),boundedRead(b,32*1024*1024),boundedRead(c,rgbaLimit),
      ]);
      const {fixtures,...evidence}=admitPhotoBundle({manifest,jpeg,rgba});
      console.log(JSON.stringify(evidence,null,2));
    }
  } catch(error) {
    console.error(String(error));
    process.exitCode=1;
  }
}
