import test from 'node:test';
import assert from 'node:assert/strict';
import {measureKnownNativeConnectedRoiQuality} from '../tools/complex-roi-native-quality.mjs';

function fixture(bitsPerChannel) {
  const float=bitsPerChannel===32;
  const Type=float?Float32Array:Uint16Array;
  const clean=float?[0.12,0.23,0.34,0.45,1]:[12000,22000,32000];
  const defect=float?[0.92,0.88,0.84,0.8,1]:[60000,60000,60000];
  const before=Type.from([...clean,...defect,...clean,...defect]);
  const after=Type.from([...clean,...clean,...clean,...clean]);
  return {before,after,selectedIndices:Uint32Array.from([1,3]),clean,
    channels:clean.length,bitsPerChannel,alphaChannel:float?4:null};
}
for (const bits of [16,32]) {
  test('034: '+bits+'-bit connected ROI quality uses native words and known clean values',()=>{
    const item=fixture(bits);
    const report=measureKnownNativeConnectedRoiQuality(item);
    assert.equal(report.kind,'zpe-known-native-connected-roi-quality-v1');
    assert.equal(report.bitsPerChannel,bits);
    assert.equal(report.selectedPixels,2);
    assert.equal(report.scoredSamples,2*(bits===32?4:3));
    assert.ok(report.baseline.mae>0);
    assert.ok(report.baseline.rmse>=report.baseline.mae);
    assert.ok(report.repaired.mae<report.baseline.mae);
    assert.ok(report.repaired.rmse<report.baseline.rmse);
    assert.ok(report.repaired.maxAbsoluteError <= (bits===16 ? 0 : 1e-6));
    assert.equal(report.unchangedOutsideSelection,true);
  });
  test('034: '+bits+'-bit reference fails closed for unselected edits, invalid index and native sample',()=>{
    const item=fixture(bits);
    const mutate=(fn)=>{const altered={...item,after:item.after.slice()};fn(altered);return altered;};
    assert.throws(()=>measureKnownNativeConnectedRoiQuality(mutate(v=>{v.after[0]+=1;})),/outside selected/);
    assert.throws(()=>measureKnownNativeConnectedRoiQuality({...item,selectedIndices:Uint32Array.from([1,1])}),/duplicate/);
    assert.throws(()=>measureKnownNativeConnectedRoiQuality({...item,selectedIndices:Uint32Array.from([4])}),/selected pixel/);
    assert.throws(()=>measureKnownNativeConnectedRoiQuality({...item,clean:[0]}),/invalid native/);
    assert.throws(()=>measureKnownNativeConnectedRoiQuality({...item,after:new Uint8Array(item.after.length)}),/invalid native/);
    if(bits===32) {
      assert.throws(()=>measureKnownNativeConnectedRoiQuality(mutate(v=>{v.after[1*5+4]=0;})),/outside selected/);
      assert.throws(()=>measureKnownNativeConnectedRoiQuality(mutate(v=>{v.after[2]=NaN;})),/non-finite/);
    }
  });
}
