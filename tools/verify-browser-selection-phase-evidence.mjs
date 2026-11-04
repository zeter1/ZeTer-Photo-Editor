import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  validateBrowserSelectionPhaseEvidence,
  summarizeBrowserSelectionPhaseEvidence,
} from './browser-selection-freeze-observer.mjs';

const directory=process.env.ZPE_BROWSER_DENSE_NEAR_CAP_ARTIFACT_DIR;
if(!directory) throw new Error('003W/3: missing browser selection phase directory');
const output=[];
for(const format of ['PSD16','PSB32']){
  const file=path.join(directory,'stage003-selection-phase-'+format.toLowerCase()+'.json');
  const receipt=JSON.parse(await readFile(file,'utf8'));
  validateBrowserSelectionPhaseEvidence(receipt,{
    format,geometryPixels:2030000,selectionClass:'dense',
  });
  if(receipt.windows.length!==1||receipt.windows[0].label!=='first-fill'||
     receipt.windows[0].selectedPixels!==1973400)
    throw new Error('003W/3: unexpected dense native browser selection receipt for '+format);
  const summary=summarizeBrowserSelectionPhaseEvidence(receipt,{
    format,geometryPixels:2030000,selectionClass:'dense',
  });
  output.push({format,...summary[0]});
}
console.log('003W/3 exact PSD16 + PSB32 dense selection freeze:',JSON.stringify(output));
