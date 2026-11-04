// 037C-3b-3/2a: strict independent-format real-photo malformed-alpha receipts.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRealPhotoMalformedReplySet} from './browser-real-photo-switch-failure.mjs';

export async function verifyRealPhotoMalformedAlphaFiles(dir){
  if(!dir)throw new TypeError('037C-3b-3/2a: missing receipt directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest,entries]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readdir(dir),
  ]);
  const matches=entries.filter(name=>/^real-photo-.*-malformed-alpha-run-.*\.json$/.test(name)).sort();
  const expected=['real-photo-psb32-malformed-alpha-run-1.json',
    'real-photo-psd16-malformed-alpha-run-1.json'].sort();
  if(JSON.stringify(matches)!==JSON.stringify(expected))
    throw new TypeError('037C-3b-3/2a: missing or unexpected receipts');
  const receipts=await Promise.all(matches.map(async name=>{
    const r=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    if(name!=='real-photo-'+r.format+'-malformed-alpha-run-'+r.runIndex+'.json')
      throw new TypeError('037C-3b-3/2a: format/filename mismatch');
    return r;
  }));
  return validateRealPhotoMalformedReplySet(receipts,pins,manifest);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyRealPhotoMalformedAlphaFiles(process.argv[2]).then(
    result=>console.log(JSON.stringify(result,null,2)),
    error=>{console.error(error);process.exitCode=1;},
  );
}
