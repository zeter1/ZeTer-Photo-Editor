// 037C-3b-2b/1: fail-closed verification of two real Chromium photo-kernel receipts.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRealPhotoMidKernelFailureSet}
  from './browser-real-photo-switch-failure.mjs';

export async function verifyRealPhotoMidKernelFailureFiles(dir){
  if(!dir) throw new TypeError('037C-3b-2b: missing artifact directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest,entries]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readdir(dir),
  ]);
  const matches=entries.filter(name=>/^real-photo-.*-mid-kernel-run-.*\.json$/.test(name)).sort();
  const expected=['real-photo-psb32-mid-kernel-run-1.json','real-photo-psd16-mid-kernel-run-1.json'].sort();
  if(JSON.stringify(matches)!==JSON.stringify(expected))
    throw new TypeError('037C-3b-2b: missing, duplicate or unexpected mid-kernel receipts');
  const receipts=await Promise.all(matches.map(async name=>{
    const r=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    if(name!==`real-photo-${r.format}-mid-kernel-run-${r.runIndex}.json`)
      throw new TypeError('037C-3b-2b: filename / receipt mismatch');
    return r;
  }));
  return validateRealPhotoMidKernelFailureSet(receipts,pins,manifest);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyRealPhotoMidKernelFailureFiles(process.argv[2]).then(
    value=>console.log(JSON.stringify(value,null,2)),
    error=>{console.error(error);process.exitCode=1;},
  );
}
