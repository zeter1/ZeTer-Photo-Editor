import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  validateBrowserPhaseAlignedEvidence,
  summarizeBrowserPhaseAlignedEvidence,
} from './browser-selection-phase-alignment.mjs';

const kind=process.env.ZPE_SELECTION_ALIGNMENT_KIND;
if(!['dense','sparse-refusal'].includes(kind))
  throw new Error('003W/3c: expected dense or sparse-refusal verification kind');
const directory=process.env[kind==='dense'?
  'ZPE_BROWSER_DENSE_NEAR_CAP_ARTIFACT_DIR':'ZPE_BROWSER_NEAR_CAP_ARTIFACT_DIR'];
if(!directory)throw new Error('003W/3c: missing real Chromium artifact directory');
const rows=[];
for(const format of ['PSD16','PSB32']){
  for(const repeat of ['', '-repeat2']){
    const name='stage003-selection-phase-aligned-'+
      (kind==='dense'?'':'sparse-')+format.toLowerCase()+repeat+'.json';
    const receipt=JSON.parse(await readFile(path.join(directory,name),'utf8'));
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
console.log('003W/3c real phase-aligned Chromium file:// scan samples (not CPU/RSS):',
  JSON.stringify(rows));
