import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMatchedScanRows } from '../tools/browser-selection-comparison.mjs';

const rows=(kind)=>['PSD16','PSB32'].flatMap(format=>[1,2].map(run=>({
  format,run,selectedPixels:kind==='dense'?1973400:576,
  scanWallMs:run===1?300:320,sampledIntervals:48,
  maxObservedTimerDelayMs:run===1?22:31,pulsesTruncated:false,
  operationPeakKnown:false,workerPidMapping:'unknown',
  ...(kind==='sparse'?{refusalSelectedPixels:2018665,refusalScanWallMs:340}:{}),
})));
test('003W/3b compares exactly two matching genuine-depth scan sample summaries',()=>{
  for(const kind of ['dense','sparse']){
    const result=compareMatchedScanRows(rows(kind),kind);
    assert.equal(result.length,2);
    assert.deepEqual(result[0].scanWallObservedRangeMs,[300,320]);
    assert.equal(result[0].independentRuns,2);
    assert.match(result[0].limitations,/no CPU/);
  }
});
test('003W/3b rejects duplicates, forged near-cap counts, missing samples and false peak claims',()=>{
  for(const kind of ['dense','sparse']){
    for(const mutate of [
      a=>a.pop(),
      a=>a[1].run=1,
      a=>a[1].selectedPixels=kind==='dense'?1900000:575,
      a=>a[0].scanWallMs=-1,
      a=>a[0].pulsesTruncated=true,
      a=>a[0].maxObservedTimerDelayMs=Number.NaN,
      a=>a[0].operationPeakKnown=true,
      a=>a[0].workerPidMapping='verified',
      ...(kind==='sparse'?[
        a=>a[0].refusalSelectedPixels=2000000,
        a=>a[0].refusalScanWallMs=-1,
      ]:[]),
    ]){
      const samples=rows(kind);mutate(samples);
      assert.throws(()=>compareMatchedScanRows(samples,kind),
        /invalid comparative scan evidence/);
    }
  }
});
