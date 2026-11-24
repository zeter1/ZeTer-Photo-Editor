import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateBrowserSelectionComparisonRecords } from './browser-selection-comparison.mjs';

const selectionClass=process.env.ZPE_SELECTION_COMPARISON_KIND;
const directory=selectionClass==='dense'
  ?process.env.ZPE_BROWSER_DENSE_NEAR_CAP_ARTIFACT_DIR
  :process.env.ZPE_BROWSER_NEAR_CAP_ARTIFACT_DIR;
if(!directory||!['dense','sparse'].includes(selectionClass))
  throw new TypeError('003W/3b: missing comparative receipt directory or class');
const records=[];
for(const format of ['PSD16','PSB32']){
  for(const [run,suffix] of [[1,''],[2,'-repeat2']]){
    const id=format.toLowerCase();
    const phaseName=selectionClass==='dense'
      ?'stage003-selection-phase-'+id+suffix+'.json'
      :'stage003-selection-phase-sparse-'+id+suffix+'.json';
    const nativeName=selectionClass==='dense'
      ?'stage003-dense-near-cap-'+id+suffix+'.json'
      :'stage003-near-cap-'+id+suffix+'.json';
    const phase=JSON.parse(await readFile(path.join(directory,phaseName),'utf8'));
    const legacy=JSON.parse(await readFile(path.join(directory,nativeName),'utf8'));
    records.push({format,run,phase,legacy});
  }
}
const observations=validateBrowserSelectionComparisonRecords(records,selectionClass);
console.log('003W/3b repeated genuine Chromium native wall-time evidence:',
  JSON.stringify(observations));
