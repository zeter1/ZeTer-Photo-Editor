// 037C-2: strict, test-only per-pixel native photo quality oracle.
// The clean ROI is derived from the independently pinned 8-bit photo decode;
// it is NOT an Adobe Photoshop golden or true 16/32-bit capture.
export function verifyBrowserRealPhotoRoiQuality({
  before, after, selectedIndices, expectedIndices, cleanSelected, bitsPerChannel,
} = {}) {
  const fail = reason => { throw new TypeError('037C-2 photo quality: ' + reason); };
  const Type = bitsPerChannel===16 ? Uint16Array
    : bitsPerChannel===32 ? Float32Array : null;
  if (!Type || !(before instanceof Type) || !(after instanceof Type) ||
      before===after || before.buffer===after.buffer ||
      before.length!==after.length || before.length===0 || before.length%4!==0 ||
      !(selectedIndices instanceof Uint32Array) ||
      !(expectedIndices instanceof Uint32Array) ||
      selectedIndices.length!==8288 || expectedIndices.length!==8288 ||
      !(cleanSelected instanceof Type) || cleanSelected.length!==8288*4 ||
      selectedIndices.some((value,i)=>value!==expectedIndices[i])) {
    fail('missing native arrays or noncanonical 8288-pixel Worker selection');
  }
  const selected=new Uint8Array(before.length/4);
  for (const index of expectedIndices) {
    if (index>=selected.length || selected[index]++) fail('repeated/out-of-range selection');
  }
  const wordBytes=bitsPerChannel/8;
  const viewA=new DataView(before.buffer,before.byteOffset,before.byteLength);
  const viewB=new DataView(after.buffer,after.byteOffset,after.byteLength);
  const rawWord=(view,i)=>bitsPerChannel===16
    ? view.getUint16(i*wordBytes,true) : view.getUint32(i*wordBytes,true);
  const statOld={abs:0,squared:0,max:0};
  const statNew={abs:0,squared:0,max:0};
  let changedPixels=0,selectedPosition=0;
  for(let pixel=0;pixel<selected.length;pixel++) {
    const active=selected[pixel]===1;
    let changed=false;
    for(let c=0;c<4;c++) {
      const index=pixel*4+c;
      const a=before[index],b=after[index];
      if(!Number.isFinite(a)||!Number.isFinite(b)) fail('non-finite native sample');
      const differs=rawWord(viewA,index)!==rawWord(viewB,index);
      if(!active || c===3) {
        if(differs) fail('outside-selection or alpha native word changed');
        continue;
      }
      changed ||= differs;
      const clean=cleanSelected[selectedPosition*4+c];
      const alpha=cleanSelected[selectedPosition*4+3];
      if(!Number.isFinite(clean) ||
         alpha!==(bitsPerChannel===16?65535:1)) fail('invalid pinned clean ROI');
      const oldError=Math.abs(a-clean),newError=Math.abs(b-clean);
      statOld.abs+=oldError;statOld.squared+=oldError*oldError;
      statOld.max=Math.max(statOld.max,oldError);
      statNew.abs+=newError;statNew.squared+=newError*newError;
      statNew.max=Math.max(statNew.max,newError);
    }
    if(active) {
      selectedPosition++;
      if(changed) changedPixels++;
    }
  }
  if(selectedPosition!==8288 || changedPixels===0) fail('no verified selected-pixel native mutation');
  const count=8288*3;
  const metrics=s=>({mae:s.abs/count,rmse:Math.sqrt(s.squared/count),
    maxAbsoluteError:s.max});
  const baseline=metrics(statOld),repaired=metrics(statNew);
  if(!(repaired.mae<baseline.mae && repaired.rmse<baseline.rmse))
    fail('real-photo repair did not improve independently pinned clean reference');
  return {
    kind:'zpe-real-photo-chromium-native-quality-v1',
    selectedPixels:8288,changedSelectedPixels:changedPixels,scoredSamples:count,
    bitsPerChannel,baseline,repaired,
    outsideSelectionAndAlphaNativeWordsExact:true,
    cleanReferenceSource:'independently pinned real photo RGBA8; depth 8-bit-derived',
  };
}
