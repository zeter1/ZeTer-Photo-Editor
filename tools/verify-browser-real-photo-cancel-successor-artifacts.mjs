// 037C-3b-2b/3b-2b: genuine-photo cancel-first -> real successor receipts.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRealPhotoCancelSuccessorSet} from './browser-real-photo-switch-failure.mjs';

export async function verifyRealPhotoCancelSuccessorFiles(dir){
  if(!dir)throw new TypeError('037C-3b-2b/3b-2b: missing receipt directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest,entries]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readdir(dir),
  ]);
  const matches=entries.filter(name=>/^real-photo-.*-cancel-successor-run-.*\.json$/.test(name)).sort();
  const expected=['real-photo-psb32-cancel-successor-run-1.json',
    'real-photo-psd16-cancel-successor-run-1.json'].sort();
  if(JSON.stringify(matches)!==JSON.stringify(expected))
    throw new TypeError('037C-3b-2b/3b-2b: missing or unexpected receipts');
  const receipts=await Promise.all(matches.map(async name=>{
    const r=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    if(name!==('real-photo-'+r.format+'-cancel-successor-run-'+r.runIndex+'.json'))
      throw new TypeError('037C-3b-2b/3b-2b: receipt filename mismatch');
    return r;
  }));
  return validateRealPhotoCancelSuccessorSet(receipts,pins,manifest);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyRealPhotoCancelSuccessorFiles(process.argv[2]).then(
    result=>console.log(JSON.stringify(result,null,2)),
    error=>{console.error(error);process.exitCode=1;},
  );
}
