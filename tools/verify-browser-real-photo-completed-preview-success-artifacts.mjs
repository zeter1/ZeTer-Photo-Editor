// 037C-3b-2b/3b-2a: real Worker success before public Escape.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRealPhotoCompletedPreviewSuccessSet} from './browser-real-photo-switch-failure.mjs';

export async function verifyRealPhotoCompletedPreviewSuccessFiles(dir){
  if(!dir)throw new TypeError('037C-3b-2b/3b-2a: missing receipt directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest,entries]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readdir(dir),
  ]);
  const matches=entries.filter(name=>/^real-photo-.*-completed-preview-success-run-.*\.json$/.test(name)).sort();
  const expected=['real-photo-psb32-completed-preview-success-run-1.json',
    'real-photo-psd16-completed-preview-success-run-1.json'].sort();
  if(JSON.stringify(matches)!==JSON.stringify(expected))
    throw new TypeError('037C-3b-2b/3b-2a: missing or unexpected receipt names');
  const receipts=await Promise.all(matches.map(async name=>{
    const r=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    if(name!==('real-photo-'+r.format+'-completed-preview-success-run-'+r.runIndex+'.json'))
      throw new TypeError('037C-3b-2b/3b-2a: filename/receipt mismatch');
    return r;
  }));
  return validateRealPhotoCompletedPreviewSuccessSet(receipts,pins,manifest);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyRealPhotoCompletedPreviewSuccessFiles(process.argv[2]).then(
    result=>console.log(JSON.stringify(result,null,2)),
    error=>{console.error(error);process.exitCode=1;},
  );
}
