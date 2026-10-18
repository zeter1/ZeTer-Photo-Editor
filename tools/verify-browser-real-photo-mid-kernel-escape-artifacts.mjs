// 037C-3b-2b/3a: strict PUBLIC Escape evidence from two photo-derived depths.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRealPhotoMidKernelEscapeSet}
  from './browser-real-photo-switch-failure.mjs';

export async function verifyRealPhotoMidKernelEscapeFiles(dir){
  if(!dir)throw new TypeError('037C-3b-2b/3a: missing receipt directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest,entries]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readdir(dir),
  ]);
  const matches=entries.filter(name=>/^real-photo-.*-mid-kernel-escape-run-.*\.json$/.test(name)).sort();
  const expected=['real-photo-psb32-mid-kernel-escape-run-1.json',
    'real-photo-psd16-mid-kernel-escape-run-1.json'].sort();
  if(JSON.stringify(matches)!==JSON.stringify(expected))
    throw new TypeError('037C-3b-2b/3a: missing or unexpected Escape receipts');
  const receipts=await Promise.all(matches.map(async name=>{
    const r=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    if(name!==`real-photo-${r.format}-mid-kernel-escape-run-${r.runIndex}.json`)
      throw new TypeError('037C-3b-2b/3a: receipt/filename mismatch');
    return r;
  }));
  return validateRealPhotoMidKernelEscapeSet(receipts,pins,manifest);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyRealPhotoMidKernelEscapeFiles(process.argv[2]).then(
    value=>console.log(JSON.stringify(value,null,2)),
    error=>{console.error(error);process.exitCode=1;},
  );
}
