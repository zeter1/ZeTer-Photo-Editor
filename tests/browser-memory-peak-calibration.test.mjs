import test from 'node:test';
import assert from 'node:assert/strict';
import {runIndependentMemoryCalibration,validateIndependentMemoryCalibration}
  from '../tools/browser-memory-peak-calibration.mjs';

const MIB=1024*1024;
const observation=(rss,hwm)=>({pid:8123,starttimeTicks:'18446744073709551619',
  rssBytes:rss*MIB,highWaterBytes:hwm*MIB});
const fixture=()=>({
  kind:'zpe-independent-linux-memory-calibration-v1',schemaVersion:1,
  origin:'real isolated Node child /proc (not Chromium)',pid:8123,
  controlBytes:16*MIB,operationBytes:64*MIB,
  samples:{
    beforeControl:observation(40,42),
    controlHeld:observation(58,60),
    beforeOperation:observation(43,60),
    operationHeld:observation(107,108),
    afterOperation:observation(45,108),
  },
  sampledMaxRssBytes:107*MIB,sampledMaxReportedHwmBytes:108*MIB,
  gap:{availability:'not-observed',
    reason:'no-continuous-proc-monitor-between-acknowledgements',periodicSamples:0},
  trueOperationPeakKnown:false,workerPidMapping:'unknown',
  limitations:'process-lifetime VmHWM is not operation peak; this is not Chromium and cannot identify Worker PID.',
});

test('003T/2d-1: control and operation samples are accepted without claiming a true peak',()=>{
  assert.equal(validateIndependentMemoryCalibration(fixture()),true);
  const nonMonotonic=fixture();
  nonMonotonic.samples.afterOperation.highWaterBytes=107*MIB;
  assert.equal(validateIndependentMemoryCalibration(nonMonotonic),true,
    'reported Linux VmHWM may dip slightly after allocator/GC cleanup');
});

test('003T/2d-1: fake peak, Worker PID, HWM, coverage and PID reuse fail closed',()=>{
  const corruptions=[
    e=>{e.trueOperationPeakKnown=true;},
    e=>{e.workerPidMapping='8123';},
    e=>{e.operationPeakRssBytes=100;},
    e=>{e.sampledMaxRssBytes=12;},
    e=>{e.sampledMaxReportedHwmBytes=12;},
    e=>{e.origin='Chromium Worker';},
    e=>{e.samples.operationHeld.starttimeTicks='18446744073709551620';},
    e=>{e.samples.operationHeld.pid=8124;},
    e=>{e.samples.operationHeld.rssBytes=-1;},
    e=>{e.samples.beforeOperation.highWaterBytes=30*MIB;},
    e=>{e.samples.operationHeld.highWaterBytes=e.samples.operationHeld.rssBytes-1;},
    e=>{e.samples.controlHeld.rssBytes=e.samples.beforeControl.rssBytes;},
    e=>{e.samples.operationHeld.rssBytes=e.samples.beforeOperation.rssBytes;},
    e=>{delete e.samples.beforeOperation;},
    e=>{e.gap.periodicSamples=1;},
    e=>{e.gap.availability='sampled';},
    e=>{e.samples.afterOperation.highWaterBytes=40*MIB;},
    e=>{e.workerRssBytes=100;},
    e=>{e.limitations='peak proof';},
  ];
  for(const corrupt of corruptions){
    const artifact=fixture();
    corrupt(artifact);
    assert.throws(()=>validateIndependentMemoryCalibration(artifact),
      /003T memory calibration/);
  }
});

test('003T/2d-1: independent real Linux child allocation is resident and HWM stays a lifetime metric',
  {skip:process.platform!=='linux'},async()=>{
    const report=await runIndependentMemoryCalibration();
    assert.equal(validateIndependentMemoryCalibration(report),true);
    assert.ok(report.samples.controlHeld.rssBytes >
      report.samples.beforeControl.rssBytes+4*MIB);
    assert.ok(report.samples.operationHeld.rssBytes >
      report.samples.beforeOperation.rssBytes+16*MIB);
    assert.equal(report.trueOperationPeakKnown,false);
    assert.equal(report.workerPidMapping,'unknown');
    assert.equal(report.gap.periodicSamples,0);
  });
