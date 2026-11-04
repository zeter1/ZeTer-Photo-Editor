// 037C-3b-2b/2: two independent genuine-photo Chromium PUBLIC close receipts.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRealPhotoMidKernelCloseSet}
  from './browser-real-photo-switch-failure.mjs';

export async function verifyRealPhotoMidKernelCloseFiles(dir){
  if(!dir) throw new TypeError('037C-3b-2b/2: missing receipt directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest,entries]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readdir(dir),
  ]);
  const matches=entries.filter(name=>/^real-photo-.*-mid-kernel-close-run-.*\.json$/.test(name)).sort();
  const expected=['real-photo-psb32-mid-kernel-close-run-1.json',
    'real-photo-psd16-mid-kernel-close-run-1.json'].sort();
  if(JSON.stringify(matches)!==JSON.stringify(expected))
    throw new TypeError('037C-3b-2b/2: missing or unexpected close receipts');
  const receipts=await Promise.all(matches.map(async name=>{
    const r=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    if(name!==`real-photo-${r.format}-mid-kernel-close-run-${r.runIndex}.json`)
      throw new TypeError('037C-3b-2b/2: receipt/filename mismatch');
    return r;
  }));
  return validateRealPhotoMidKernelCloseSet(receipts,pins,manifest);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyRealPhotoMidKernelCloseFiles(process.argv[2]).then(
    value=>console.log(JSON.stringify(value,null,2)),
    error=>{console.error(error);process.exitCode=1;},
  );
}
