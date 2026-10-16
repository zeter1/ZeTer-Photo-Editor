import test from 'node:test';
import assert from 'node:assert/strict';
import {createWideConnectedRoiIndices} from '../tools/browser-wide-connected-native-evidence.mjs';
import {verifyBrowserRealPhotoRoiQuality} from '../tools/browser-real-photo-quality.mjs';

const width=240, height=240,selected=createWideConnectedRoiIndices(width,height);
function pair(bits) {
  const Type=bits===16?Uint16Array:Float32Array;
  const clean=new Type(width*height*4);
  for(let p=0;p<width*height;p++){
    const intensity=(p*13)%200;
    clean[p*4]=bits===16?intensity*257:Math.fround(intensity/255);
    clean[p*4+1]=bits===16?((intensity+11)%256)*257:Math.fround(((intensity+11)%256)/255);
    clean[p*4+2]=bits===16?((intensity+23)%256)*257:Math.fround(((intensity+23)%256)/255);
    clean[p*4+3]=bits===16?65535:1;
  }
  const before=clean.slice();
  const cleanSelected=new Type(selected.length*4);
  for(let i=0;i<selected.length;i++){
    const pos=selected[i]*4;
    cleanSelected.set(clean.subarray(pos,pos+4),i*4);
    for(let c=0;c<3;c++) before[pos+c]=bits===16
      ?before[pos+c]^65535:Math.fround(before[pos+c]+1);
  }
  const after=clean.slice();
  return {before,after,selectedIndices:selected.slice(),expectedIndices:selected.slice(),
    cleanSelected,bitsPerChannel:bits};
}
for (const bits of [16,32]) {
  test('037C-2: '+bits+'-bit genuine-photo native ROI oracle improves 8288 textured pixels',()=>{
    const report=verifyBrowserRealPhotoRoiQuality(pair(bits));
    assert.equal(report.selectedPixels,8288);
    assert.equal(report.scoredSamples,8288*3);
    assert.equal(report.changedSelectedPixels,8288);
    assert.equal(report.repaired.mae,0);
    assert.ok(report.baseline.mae>0);
    assert.equal(report.outsideSelectionAndAlphaNativeWordsExact,true);
  });
  test('037C-2: '+bits+'-bit rejects forged ROI, alpha/off-ROI mutation and no improvement',()=>{
    const original=pair(bits);
    const failures=[
      v=>v.selectedIndices[0]+=1,
      v=>v.selectedIndices.reverse(),
      v=>v.after[0]=bits===16?12:0.5,
      v=>v.after[selected[0]*4+3]=bits===16?0:0.5,
      v=>v.after=v.before.slice(),
      v=>v.cleanSelected[3]=0,
      v=>v.after[0]=bits===16?1234:NaN,
    ];
    for(const mutate of failures) {
      const value=pair(bits); mutate(value);
      assert.throws(()=>verifyBrowserRealPhotoRoiQuality(value),/037C-2 photo quality/);
    }
    assert.equal(original.before.length,width*height*4);
  });
}
test('037C-2: unverified or aliased native arrays cannot fabricate a pass',()=>{
  const item=pair(16);
  assert.throws(()=>verifyBrowserRealPhotoRoiQuality({...item,after:item.before}),/037C-2/);
  assert.throws(()=>verifyBrowserRealPhotoRoiQuality({...item,selectedIndices:[...selected]}),/037C-2/);
  assert.throws(()=>verifyBrowserRealPhotoRoiQuality({...item,cleanSelected:new Uint16Array(7)}),/037C-2/);
});
