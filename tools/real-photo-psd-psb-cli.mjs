// Offline 037B2b-3 native PSD16/PSB32 defect fixture generator.
// Input must already have independently reviewed hashes; no download,
// JPEG decoder, photo-authenticity or Photoshop compatibility is performed.
// Usage: node tools/real-photo-psd-psb-cli.mjs reviewed-manifest.json original.jpg decoded.rgba NEW-output-dir
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {REAL_PHOTO_SOURCE} from './real-photo-bundle-admission.mjs';
import {createVerifiedPhotoDefectDocuments} from './real-photo-psd-psb-fixtures.mjs';

async function boundedRead(path,max) {
  const info=await stat(path);
  if(!info.isFile() || info.size<=0 || info.size>max)
    throw new TypeError('037 photo PSD/PSB: empty or oversized input: '+path);
  return readFile(path);
}
const [manifestPath,jpegPath,rgbaPath,outputDir]=process.argv.slice(2);
if(!manifestPath || !jpegPath || !rgbaPath || !outputDir ||
   process.argv.length!==6) {
  console.error('Usage: node tools/real-photo-psd-psb-cli.mjs reviewed-manifest.json original.jpg decoded.rgba NEW-output-dir');
  process.exitCode=2;
} else {
  try {
    const [manifestText,jpeg,rgba]=await Promise.all([
      boundedRead(manifestPath,16*1024),boundedRead(jpegPath,32*1024*1024),
      boundedRead(rgbaPath,REAL_PHOTO_SOURCE.width*REAL_PHOTO_SOURCE.height*4),
    ]);
    const manifest=JSON.parse(manifestText.toString('utf8'));
    const evidence=await createVerifiedPhotoDefectDocuments({jpeg,rgba,manifest});
    // New directory only: never overwrite existing goldens or pinned fixtures.
    await mkdir(outputDir);
    for(const [key,extension] of [['psd16','.psd'],['psb32','.psb']])
      await writeFile(join(outputDir,key+'-defect'+extension),
        evidence.documents[key].bytes,{flag:'wx'});
    const {documents,...summary}=evidence;
    console.log(JSON.stringify({...summary,documents:Object.fromEntries(
      Object.entries(documents).map(([key,item])=>[key,item.proof]))},null,2));
  } catch(error) {
    console.error(String(error));
    process.exitCode=1;
  }
}
