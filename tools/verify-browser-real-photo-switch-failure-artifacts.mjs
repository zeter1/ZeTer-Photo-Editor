// Fail-closed artifact gate for the two actual Chromium file:// photo switch runs.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRealPhotoSwitchFailureSet}
  from './browser-real-photo-switch-failure.mjs';

export async function verifyRealPhotoSwitchFailureFiles(dir){
  if(!dir) throw new TypeError('037C-3b-2a: missing artifact directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const [pins,manifest,entries]=await Promise.all([
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readdir(dir),
  ]);
  const matches=entries.filter(name=>/^real-photo-.*-failure-run-.*\.json$/.test(name)).sort();
  const expected=['real-photo-psb32-failure-run-1.json','real-photo-psd16-failure-run-1.json'].sort();
  if(JSON.stringify(matches)!==JSON.stringify(expected))
    throw new TypeError('037C-3b-2a: missing, duplicate or unexpected failure receipts');
  const receipts=await Promise.all(matches.map(async name=>{
    const parsed=JSON.parse(await readFile(path.join(dir,name),'utf8'));
    if(name!==`real-photo-${parsed.format}-failure-run-${parsed.runIndex}.json`)
      throw new TypeError('037C-3b-2a: filename / receipt mismatch');
    return parsed;
  }));
  return validateRealPhotoSwitchFailureSet(receipts,pins,manifest);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyRealPhotoSwitchFailureFiles(process.argv[2]).then(
    value=>console.log(JSON.stringify(value,null,2)),
    error=>{console.error(error);process.exitCode=1;},
  );
}
