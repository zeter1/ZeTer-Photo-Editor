import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRealPhotoMemoryCapSet} from './browser-real-photo-switch-failure.mjs';

export async function verifyRealPhotoMemoryCapFiles(dir){
  if(!dir)throw new TypeError('037C-3b-3/2b-2: missing memory-cap directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest,entries]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readdir(dir),
  ]);
  const names=entries.filter(n=>/^real-photo-.*-memory-cap-run-.*\.json$/.test(n)).sort();
  const expected=['real-photo-psd16-memory-cap-run-1.json',
    'real-photo-psb32-memory-cap-run-1.json'];
  if(JSON.stringify(names)!==JSON.stringify(expected))
    throw new TypeError('037C-3b-3/2b-2: missing/unexpected cap receipts');
  const receipts=await Promise.all(names.map(async name=>{
    const r=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    if(name!=='real-photo-'+r.format+'-memory-cap-run-'+r.runIndex+'.json')
      throw new TypeError('037C-3b-3/2b-2: memory-cap receipt filename mismatch');
    return r;
  }));
  return validateRealPhotoMemoryCapSet(receipts,pins,manifest);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyRealPhotoMemoryCapFiles(process.argv[2]).then(
    result=>console.log(JSON.stringify(result,null,2)),
    error=>{console.error(error);process.exitCode=1;});
}
