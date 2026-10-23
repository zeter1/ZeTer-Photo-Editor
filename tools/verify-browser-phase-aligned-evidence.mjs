import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  validateBrowserPhaseAlignedEvidence,
  summarizeBrowserPhaseAlignedEvidence,
} from './browser-selection-phase-alignment.mjs';

const dense=process.env.ZPE_BROWSER_DENSE_NEAR_CAP_ARTIFACT_DIR;
const sparse=process.env.ZPE_BROWSER_NEAR_CAP_ARTIFACT_DIR;
if(!dense||!sparse)throw new Error('003W/3c: missing real Chromium artifact directories');
const rows=[];
for(const format of ['PSD16','PSB32']){
  for(const repeat of ['', '-repeat2']){
    for(const kind of ['dense','sparse-refusal']){
      const name='stage003-selection-phase-aligned-'+
        (kind==='dense'?'':'sparse-')+format.toLowerCase()+repeat+'.json';
      const receipt=JSON.parse(await readFile(path.join(
        kind==='dense'?dense:sparse,name),'utf8'));
      const opts={format,geometryPixels:2030000,selectionClass:kind,
        expectedSparsePixels:576};
      validateBrowserPhaseAlignedEvidence(receipt,opts);
      if(kind==='dense'){
        if(receipt.windows.length!==1||receipt.windows[0].selectedPixels!==1973400)
          throw new Error('003W/3c: false dense native count for '+format+repeat);
      }else if(receipt.windows.length!==2||
          receipt.windows[0].selectedPixels!==576||
          receipt.windows[1].phaseEvents[1].selectedPixels!==2018665||
          receipt.windows[1].handoffAtMs!==null)
        throw new Error('003W/3c: false sparse/refusal native count for '+format+repeat);
      rows.push({format,repeat:repeat||'1',kind,
        summary:summarizeBrowserPhaseAlignedEvidence(receipt,opts)});
    }
  }
}
console.log('003W/3c real phase-aligned Chromium file:// scan samples (not CPU/RSS):',
  JSON.stringify(rows));
