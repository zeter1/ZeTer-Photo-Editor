// 002B/2a: Public Chromium file:// import of independent, SHA-pinned
// Photoshop-published PSD16/PSD32 files. PSD32 is NOT PSB32.
// The oracle compares every exported native sample byte with the ORIGINAL
// externally authored raster layer decoded directly by the PSD codec.
// It does not establish Adobe layer-blending or adjustment render parity.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {decodePsd} from '../src/formats/psd.js';
import {PHOTOCRAFT_CASES} from './verify-photocraft-candidates.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function expectedPhotoshopNativeLayers(decoded, bitsPerChannel) {
  const result = (decoded.layers || [])
    .filter(layer => layer.pixelBuffer &&
      !layer.psdSmartObject && !layer.psdText?.parsed && !layer.psdShape)
    .map(layer => {
      const pixels=layer.pixelBuffer;
      assert.equal(pixels.bitsPerChannel,bitsPerChannel,'Photoshop native layer depth');
      assert.equal(pixels.model,'rgb','Photoshop native layer color model');
      assert.ok(pixels.data instanceof (bitsPerChannel===16?Uint16Array:Float32Array));
      const raw=new Uint8Array(pixels.data.buffer,pixels.data.byteOffset,pixels.data.byteLength);
      return {
        name:layer.name,width:layer.width,height:layer.height,
        bitsPerChannel,rawBytes:raw.byteLength,sha256:sha256(raw),
      };
    });
  return result.sort(compareNativeLayers);
}

function compareNativeLayers(a,b) {
  return JSON.stringify([a.name,a.width,a.height,a.bitsPerChannel,a.rawBytes,a.sha256])
    .localeCompare(JSON.stringify([b.name,b.width,b.height,b.bitsPerChannel,b.rawBytes,b.sha256]));
}

export function verifyPhotoshopBrowserReceipt(receipt, spec, expected) {
  assert.equal(receipt.protocol,'file:','real local browser protocol');
  assert.equal(receipt.fileSha256,spec.sha256,'pinned Photoshop input');
  assert.equal(receipt.fileSize,spec.size,'pinned Photoshop length');
  assert.ok(Number.isSafeInteger(receipt.importedRowCount) &&
    receipt.importedRowCount>=expected.length,'public Layers panel');
  assert.ok(expected.length>0,'Photoshop reference needs native raster layers');
  assert.deepEqual(receipt.nativeLayers,expected,'public Save Project native layer byte parity');
  assert.equal(receipt.canvasWidth,receipt.sourceWidth,'document width');
  assert.equal(receipt.canvasHeight,receipt.sourceHeight,'document height');
  assert.equal(receipt.bitsPerChannel,spec.bitsPerChannel,'native document depth');
  return true;
}

function dispatchBrowserFile() {
  const state=window.__zpePhotoshopImport;
  const input=document.querySelector('#fileInput');
  if(!state || !input || !Array.isArray(state.parts)) throw Error('002B/2a missing file input');
  const file=new File(state.parts,state.filename,{type:'image/vnd.adobe.photoshop'});
  const transfer=new DataTransfer();
  transfer.items.add(file);
  input.files=transfer.files;
  state.parts=[];
  const original=window.confirm;
  window.confirm=()=>true;
  try { input.dispatchEvent(new Event('change',{bubbles:true})); }
  finally { window.confirm=original; }
  return {name:file.name,size:file.size,protocol:location.protocol};
}

async function browserNativeLayerReceipt() {
  const old=URL.createObjectURL;
  let jsonBlob=null;
  URL.createObjectURL=function(blob,...args) {
    if(blob instanceof Blob && blob.type==='application/json')jsonBlob=blob;
    return old.call(URL,blob,...args);
  };
  let project;
  try {
    document.querySelector('.menu-button[data-menu="file"]')?.click();
    const save=[...document.querySelectorAll('#menuPopover .menu-item')].find(
      button=>button.querySelector('span')?.textContent?.startsWith('Сохранить проект'));
    if(!save || save.disabled)throw Error('002B/2a Save Project unavailable');
    save.click();
    if(!jsonBlob)throw Error('002B/2a Save Project did not produce JSON');
    project=JSON.parse(await jsonBlob.text());
  } finally {URL.createObjectURL=old;}
  if(!crypto?.subtle)throw Error('002B/2a SHA-256 unavailable in file://');
  const results=[];
  for(const layer of project.layers||[]) {
    const source=layer.highDepthSource;
    if(layer.type!=='raster' || !source)continue;
    if(!['zpe-pixel-buffer-source-v1','zpe-pixel-buffer-source-v2'].includes(source.kind) ||
       source.model!=='rgb' || source.channels!==4 ||
       ![16,32].includes(source.bitsPerChannel) ||
       source.width!==layer.width || source.height!==layer.height ||
       source.byteOrder!=='little-endian')
      throw Error('002B/2a invalid native layer metadata');
    const stride=4*(source.bitsPerChannel/8);
    if(source.rawBytes!==source.width*source.height*stride)
      throw Error('002B/2a native raw byte length mismatch');
    const raw=new Uint8Array(source.rawBytes);
    const visited=new Uint8Array(source.width*source.height);
    if(source.kind==='zpe-pixel-buffer-source-v1') {
      if(typeof source.dataUrl!=='string' ||
         !source.dataUrl.startsWith('data:application/x-zeter-pixel-buffer;base64,'))
        throw Error('002B/2a invalid v1 source');
      const encoded=source.dataUrl.split(',')[1];
      if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
        throw Error('002B/2a noncanonical v1 base64');
      const binary=atob(encoded);
      if(binary.length!==source.rawBytes || btoa(binary)!==encoded)
        throw Error('002B/2a invalid v1 bytes');
      raw.set(Uint8Array.from(binary,c=>c.charCodeAt(0)));
      visited.fill(1);
    } else {
    if(!Number.isSafeInteger(source.tileSize) || source.tileSize<1 ||
       !Array.isArray(source.tiles) || source.tiles.length<1)
      throw Error('002B/2a invalid v2 tile list');
    for(const tile of source.tiles) {
      if(!tile || ![tile.x,tile.y,tile.width,tile.height,tile.rawBytes].every(Number.isSafeInteger) ||
         tile.x<0 || tile.y<0 || tile.width<1 || tile.height<1 ||
         tile.width>source.tileSize || tile.height>source.tileSize ||
         tile.x+tile.width>source.width || tile.y+tile.height>source.height ||
         tile.rawBytes!==tile.width*tile.height*stride ||
         typeof tile.dataUrl!=='string' ||
         !tile.dataUrl.startsWith('data:application/x-zeter-pixel-buffer-tile;base64,'))
        throw Error('002B/2a malformed native tile');
      const encoded=tile.dataUrl.split(',')[1];
      if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
        throw Error('002B/2a noncanonical tile base64');
      const binary=atob(encoded);
      if(binary.length!==tile.rawBytes || btoa(binary)!==encoded)
        throw Error('002B/2a noncanonical native tile payload');
      const tileBytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      for(let y=0;y<tile.height;y++){
        const target=(tile.y+y)*source.width+tile.x;
        for(let x=0;x<tile.width;x++){
          if(visited[target+x]++)throw Error('002B/2a overlapping native tiles');
        }
        raw.set(tileBytes.subarray(y*tile.width*stride,(y+1)*tile.width*stride),target*stride);
      }
    }
    }
    if(visited.some(value=>value!==1))throw Error('002B/2a missing native tile samples');
    const digest=await crypto.subtle.digest('SHA-256',raw);
    results.push({
      name:layer.name,width:source.width,height:source.height,
      bitsPerChannel:source.bitsPerChannel,rawBytes:raw.byteLength,
      sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),
    });
  }
  results.sort((a,b)=>JSON.stringify([a.name,a.width,a.height,a.bitsPerChannel,a.rawBytes,a.sha256])
    .localeCompare(JSON.stringify([b.name,b.width,b.height,b.bitsPerChannel,b.rawBytes,b.sha256])));
  const canvas=document.querySelector('#editorCanvas');
  return {nativeLayers:results,importedRowCount:document.querySelectorAll('.layer-row').length,
    canvasWidth:canvas?.width,canvasHeight:canvas?.height};
}

export async function verifyPhotoshopBrowserImport(client,{evaluate,waitFor,assert:assertBrowser,sourceDir}={}) {
  if(typeof sourceDir!=='string' || !path.isAbsolute(sourceDir))
    throw new TypeError('002B/2a requires absolute pinned corpus directory');
  const results=[];
  for(const spec of PHOTOCRAFT_CASES) {
    const bytes=await readFile(path.join(sourceDir,spec.file));
    assert.equal(bytes.byteLength,spec.size,'Photoshop source size');
    assert.equal(sha256(bytes),spec.sha256,'Photoshop SHA-256 pin');
    const decoded=await decodePsd(bytes);
    const expected=expectedPhotoshopNativeLayers(decoded,spec.bitsPerChannel);
    assert.ok(expected.length>0,'Photoshop-authored source must have raster layers');
    await evaluate(client,'location.reload();true');
    await waitFor('002B/2a Photoshop browser bootstrap',()=>
      evaluate(client,'document.documentElement?.dataset.appReady==="true"'),30000);
    await evaluate(client,'window.__zpePhotoshopImport='+JSON.stringify({
      filename:path.basename(spec.file),parts:[],
    })+';true');
    const base64=bytes.toString('base64');
    for(let offset=0;offset<base64.length;offset+=192*1024) {
      const chunk=base64.slice(offset,offset+192*1024);
      await evaluate(client,'(() => {const b=atob('+JSON.stringify(chunk)+
        ');window.__zpePhotoshopImport.parts.push(Uint8Array.from(b,c=>c.charCodeAt(0)));return true;})()');
    }
    const dispatched=await evaluate(client,'('+dispatchBrowserFile.toString()+')()');
    assertBrowser(dispatched.protocol==='file:' && dispatched.size===bytes.length &&
      dispatched.name===path.basename(spec.file),'002B/2a public PSD input bytes',JSON.stringify(dispatched));
    await waitFor('002B/2a Photoshop public PSD import',()=>evaluate(client,
      'document.querySelector("#statusText")?.textContent?.startsWith("PSD/PSB импортирован") && '+
      'document.querySelector("#editorCanvas")?.width==='+decoded.width+' && '+
      'document.querySelector("#editorCanvas")?.height==='+decoded.height),60000);
    const result=await evaluate(client,'('+browserNativeLayerReceipt.toString()+')()');
    const receipt={caseId:spec.id,protocol:dispatched.protocol,fileSha256:spec.sha256,
      fileSize:bytes.length,sourceWidth:decoded.width,sourceHeight:decoded.height,
      bitsPerChannel:spec.bitsPerChannel,...result};
    verifyPhotoshopBrowserReceipt(receipt,spec,expected);
    results.push(receipt);
    await evaluate(client,'delete window.__zpePhotoshopImport;true');
    console.log('002B/2a actual Photoshop public file:// native-layer parity:',JSON.stringify({
      caseId:spec.id,depth:spec.bitsPerChannel,nativeLayers:receipt.nativeLayers.length,
      sourceSha256:spec.sha256,
    }));
  }
  return results;
}
