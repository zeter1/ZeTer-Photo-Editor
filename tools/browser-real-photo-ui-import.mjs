// 037C-1: genuine photo-derived PSD16/PSB32 in Chromium file://.
// This first gate proves UI import + public Save Project native-byte integrity.
// It does NOT execute Content-Aware Fill, Worker, Undo/Redo or measure repair quality.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {validateRealPhotoImportReceipt} from './verify-browser-real-photo-import-artifacts.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FORMATS = Object.freeze({
  psd16:{filename:'psd16-defect.psd',bits:16},
  psb32:{filename:'psb32-defect.psb',bits:32},
});

function browserImportFile(){
  const state=window.__photo037c;
  const input=document.querySelector('#fileInput');
  if(!input || !state || !Array.isArray(state.parts)) throw Error('037C missing import input');
  const file=new File(state.parts,state.filename,{type:'image/vnd.adobe.photoshop'});
  const transfer=new DataTransfer();
  transfer.items.add(file);
  state.parts=[]; // release transport buffers promptly
  input.files=transfer.files;
  const oldConfirm=window.confirm;
  window.confirm=()=>true;
  try {input.dispatchEvent(new Event('change',{bubbles:true}));}
  finally {window.confirm=oldConfirm;}
  return {name:file.name,bytes:file.size,protocol:location.protocol};
}

async function browserSnapshot(){
  let saved=null;
  const old=URL.createObjectURL;
  URL.createObjectURL=function(blob,...args){
    if(blob instanceof Blob && blob.type==='application/json') saved=blob;
    return old.call(URL,blob,...args);
  };
  try {
    document.querySelector('.menu-button[data-menu="file"]')?.click();
    const save=[...document.querySelectorAll('#menuPopover .menu-item')].find(
      button=>button.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
    if(!save || save.disabled) throw Error('037C Save Project unavailable');
    save.click();
    if(!saved) throw Error('037C Save Project produced no JSON');
    const project=JSON.parse(await saved.text());
    const native=project.layers?.find(layer=>layer.name==='Pinned photo defect (8-bit derived)')?.highDepthSource;
    if(!native || native.kind!=='zpe-pixel-buffer-source-v2' ||
       native.width!==1025 || native.height!==1025 || native.model!=='rgb' ||
       native.channels!==4 || native.bitsPerChannel!==window.__photo037c.bits ||
       !Number.isSafeInteger(native.tileSize) || native.tileSize<1 ||
       !Array.isArray(native.tiles) || native.tiles.length<2 ||
       native.rawBytes!==1025*1025*4*(native.bitsPerChannel/8))
      throw Error('037C public native source metadata mismatch');
    // Reconstitute canonical little-endian RGBA native words from exported tiles,
    // independent of renderer preview; exactly one tile must cover each pixel.
    const stride=4*(native.bitsPerChannel/8);
    const result=new Uint8Array(native.rawBytes);
    const seen=new Uint8Array(1025*1025);
    for(const tile of native.tiles){
      if(!tile || ![tile.x,tile.y,tile.width,tile.height,tile.rawBytes].every(Number.isSafeInteger) ||
         tile.x<0 || tile.y<0 || tile.width<1 || tile.height<1 ||
         tile.width>native.tileSize || tile.height>native.tileSize ||
         tile.x+tile.width>1025 || tile.y+tile.height>1025 ||
         tile.rawBytes!==tile.width*tile.height*stride ||
         typeof tile.dataUrl!=='string' ||
         !tile.dataUrl.startsWith('data:application/x-zeter-pixel-buffer-tile;base64,'))
        throw Error('037C malformed exported native tile geometry');
      const encoded=tile.dataUrl.split(',')[1];
      if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
        throw Error('037C noncanonical tile base64');
      const binary=atob(encoded);
      if(binary.length!==tile.rawBytes || btoa(binary)!==encoded)
        throw Error('037C truncated or noncanonical tile bytes');
      const raw=Uint8Array.from(binary,c=>c.charCodeAt(0));
      for(let y=0;y<tile.height;y++){
        const outRow=(tile.y+y)*1025+tile.x;
        for(let x=0;x<tile.width;x++){
          if(seen[outRow+x]++) throw Error('037C overlapping tile');
        }
        const rowBytes=tile.width*stride;
        result.set(raw.subarray(y*rowBytes,(y+1)*rowBytes),outRow*stride);
      }
    }
    if(seen.some(n=>n!==1)) throw Error('037C missing tile pixels');
    if(!globalThis.crypto?.subtle) throw Error('037C secure-context SHA-256 unavailable');
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',result));
    return {kind:native.kind,model:native.model,depth:native.bitsPerChannel,
      nativeSha256:Array.from(digest,b=>b.toString(16).padStart(2,'0')).join(''),
      layerName:'Pinned photo defect (8-bit derived)',
      tileCount:native.tiles.length,pixelCount:seen.length,rawBytes:result.byteLength,
      canvasWidth:document.querySelector('#editorCanvas')?.width,
      canvasHeight:document.querySelector('#editorCanvas')?.height};
  } finally { URL.createObjectURL=old; }
}

export async function verifyGenuinePhotoUiImport(client,{
  evaluate,waitFor,assert,format,runIndex,sourceDir,artifactDir,
}={}){
  if(!Object.hasOwn(FORMATS,format) || ![1,2,3].includes(runIndex) ||
     !sourceDir || !artifactDir) throw new TypeError('037C invalid browser baseline arguments');
  const fmt=FORMATS[format];
  const [pins,manifest,bytes]=await Promise.all([
    readFile(path.join(ROOT,'tests/fixtures/real-photo/reviewed-native-artifacts.json'),'utf8').then(JSON.parse),
    readFile(path.join(ROOT,'tests/fixtures/real-photo/reviewed-manifest.json'),'utf8').then(JSON.parse),
    readFile(path.join(sourceDir,fmt.filename)),
  ]);
  const fileSha=sha256(bytes);
  assert(bytes.length>1024 && fileSha===pins.documents?.[format]?.fileSha256,
    '037C actual binary file must match independently frozen file pin',fileSha);
  assert(pins.documents[format].nativeSha256===
    manifest.native[format==='psd16'?'rgb16':'float32'].damagedSha256,
    '037C independent native/photo manifest pins disagree');

  const start=Date.now();
  await evaluate(client,'window.__photo037c={filename:'+JSON.stringify(fmt.filename)+
    ',bits:'+fmt.bits+',parts:[]};true');
  const b64=bytes.toString('base64');
  for(let offset=0;offset<b64.length;offset+=192*1024){
    await evaluate(client,'(() => {const binary=atob('+JSON.stringify(b64.slice(offset,offset+192*1024))+
      ');window.__photo037c.parts.push(Uint8Array.from(binary,c=>c.charCodeAt(0)));return true;})()');
  }
  const dispatched=await evaluate(client,'('+browserImportFile.toString()+')()');
  assert(dispatched.name===fmt.filename && dispatched.bytes===bytes.length &&
    dispatched.protocol==='file:', '037C UI input did not receive exact pinned PSD/PSB bytes',
    JSON.stringify(dispatched));
  await waitFor('037C genuine-photo UI PSD/PSB import',()=>evaluate(client,
    'document.querySelector("#editorCanvas")?.width===1025 && '+
    'document.querySelector("#editorCanvas")?.height===1025 && '+
    'document.querySelector("#statusText")?.textContent?.startsWith("PSD/PSB импортирован")'),60000);
  const importMs=Date.now()-start;
  const saved=await evaluate(client,'('+browserSnapshot.toString()+')()');
  assert(saved.kind==='zpe-pixel-buffer-source-v2' &&
    saved.nativeSha256===pins.documents[format].nativeSha256 &&
    saved.depth===fmt.bits && saved.rawBytes===1025*1025*4*(fmt.bits/8) &&
    saved.tileCount>1 && saved.pixelCount===1025*1025 &&
    saved.canvasWidth===1025 && saved.canvasHeight===1025,
    '037C Save Project native bytes differ from externally pinned photo defect',
    JSON.stringify(saved));
  const receipt={
    kind:'zpe-real-photo-browser-import-baseline-v1',
    status:'ui-import-and-save-native-baseline-verified',
    format,runIndex,protocol:dispatched.protocol,
    inputFilename:fmt.filename,inputFileSha256:fileSha,inputBytes:bytes.length,
    sourcePhotoSha256:pins.sourceSha256,
    nativeDefectSha256:saved.nativeSha256,rawNativeBytes:saved.rawBytes,
    pixelCount:saved.pixelCount,bitsPerChannel:fmt.bits,tileCount:saved.tileCount,
    inputNativeMatchedFrozenPin:true,publicSaveNativeMatchedFrozenPin:true,
    startedAtUnixMs:start,importElapsedMs:importMs,
    totalElapsedMs:Date.now()-start,
    workerVerified:false,undoRedoVerified:false,realPhotoRepairQualityVerified:false,
    processPeakRssBytes:null,workerPidMapping:'unknown',
    photoshopCompatibilityVerified:false,
  };
  validateRealPhotoImportReceipt(receipt,pins,manifest);
  await mkdir(artifactDir,{recursive:true});
  const output=path.join(artifactDir,`real-photo-${format}-baseline-run-${runIndex}.json`);
  await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  await evaluate(client,'delete window.__photo037c;true');
  console.log('037C genuine photo UI baseline:',JSON.stringify({output,...receipt}));
  return receipt;
}
