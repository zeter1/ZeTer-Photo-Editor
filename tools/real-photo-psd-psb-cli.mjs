// Offline 037B2b-3 native PSD16/PSB32 defect fixture generator.
// Input must already have independently reviewed hashes; no download,
// JPEG decoder, photo-authenticity or Photoshop compatibility is performed.
// Usage: node tools/real-photo-psd-psb-cli.mjs reviewed-manifest.json original.jpg decoded.rgba NEW-output-dir
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {REAL_PHOTO_SOURCE} from './real-photo-bundle-admission.mjs';
import {createVerifiedPhotoDefectDocuments} from './real-photo-psd-psb-fixtures.mjs';
import {PHOTO_DEFECT_ARTIFACT_FILE,serializePhotoDefectArtifactEvidence,
  verifyPhotoDefectArtifactSet} from './real-photo-psd-psb-artifacts.mjs';

async function boundedRead(path,max) {
  const info=await stat(path);
  if(!info.isFile() || info.size<=0 || info.size>max)
    throw new TypeError('037 photo PSD/PSB: empty or oversized input: '+path);
  return readFile(path);
}
const verifying=process.argv[2]==='verify';
const args=process.argv.slice(verifying?3:2);
const [manifestPath,jpegPath,rgbaPath,outputDir]=args;
const usage='Usage: node tools/real-photo-psd-psb-cli.mjs reviewed-manifest.json original.jpg decoded.rgba NEW-output-dir\n'+
  '   or: node tools/real-photo-psd-psb-cli.mjs verify reviewed-manifest.json original.jpg decoded.rgba existing-output-dir';
if(args.length!==4 || !args.every(Boolean)) {
  console.error(usage);
  process.exitCode=2;
} else {
  try {
    const [manifestText,jpeg,rgba]=await Promise.all([
      boundedRead(manifestPath,16*1024),boundedRead(jpegPath,32*1024*1024),
      boundedRead(rgbaPath,REAL_PHOTO_SOURCE.width*REAL_PHOTO_SOURCE.height*4),
    ]);
    const manifest=JSON.parse(manifestText.toString('utf8'));
    if(verifying) {
      const [artifactText,psd16,psb32]=await Promise.all([
        boundedRead(join(outputDir,PHOTO_DEFECT_ARTIFACT_FILE),16*1024),
        boundedRead(join(outputDir,'psd16-defect.psd'),48*1024*1024),
        boundedRead(join(outputDir,'psb32-defect.psb'),48*1024*1024),
      ]);
      const artifact=JSON.parse(artifactText.toString('utf8'));
      const verified=await verifyPhotoDefectArtifactSet({
        jpeg,rgba,manifest,artifact,files:{psd16,psb32},
      });
      console.log(JSON.stringify(verified,null,2));
    } else {
      const evidence=await createVerifiedPhotoDefectDocuments({jpeg,rgba,manifest});
      // Never overwrite existing goldens. Evidence is the LAST file written:
      // an interrupted or partial output directory cannot pass verification.
      await mkdir(outputDir);
      for(const [key,extension] of [['psd16','.psd'],['psb32','.psb']])
        await writeFile(join(outputDir,key+'-defect'+extension),
          evidence.documents[key].bytes,{flag:'wx'});
      const artifact=serializePhotoDefectArtifactEvidence(evidence);
      await writeFile(join(outputDir,PHOTO_DEFECT_ARTIFACT_FILE),
        JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
      console.log(JSON.stringify(artifact,null,2));
    }
  } catch(error) {
    console.error(String(error));
    process.exitCode=1;
  }
}
