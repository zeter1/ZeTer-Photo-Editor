import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLinuxProcStartTime,createLinuxChromiumIdentityTracker} from '../tools/browser-linux-process-identity.mjs';
import {sampleLinuxChromiumRss} from '../tools/browser-linux-process-rss.mjs';
import {createBrowserRendererHeapSampler} from '../tools/browser-renderer-heap-sampler.mjs';

function stat(pid,ticks='18446744073709551619',comm='Chrome worker (gpu)') {
  return String(pid)+' ('+comm+') S '+Array(18).fill('0').join(' ')+' '+ticks+' 0\n';
}
const status = (rss,hwm) => 'VmRSS:\t'+rss+' kB\nVmHWM:\t'+hwm+' kB\n';

test('024B1: /proc parser handles spaces/parentheses and 64-bit starttime without rounding',()=>{
  assert.equal(parseLinuxProcStartTime(stat(17),17),'18446744073709551619');
  assert.equal(parseLinuxProcStartTime(stat(17,'00019','a (b) ) c'),17),'19');
  for (const bad of ['16 (chrome) S 1 2 3', '17 (chrome) S 1 2',
    '17 (chrome) S '+Array(18).fill('0').join(' ')+' 0',
    '17 (chrome) S '+Array(18).fill('0').join(' ')+' nope', '17 (unterminated']) {
    assert.throws(()=>parseLinuxProcStartTime(bad,17),/identity:/);
  }
  assert.throws(()=>parseLinuxProcStartTime(stat(18),17),/mismatch/);
});

test('024B1: reject PID reuse between two stat reads without publishing mixed RSS/HWM',async()=>{
  let polls=0;
  await assert.rejects(sampleLinuxChromiumRss([{id:17,type:'renderer'}],{
    platform:'linux',
    readStat:async () => stat(17,String(++polls*100)),
    readStatus:async () => status(400,500),
  }),/PID was reused/);
  assert.equal(polls,2);
  await assert.rejects(sampleLinuxChromiumRss([{id:17}],{
    platform:'linux',
    readStat:async () => stat(17),
    readStatus:async () => {throw Error('ENOENT: process died during status');},
  }),/ENOENT/);
  await assert.rejects(sampleLinuxChromiumRss([{id:17}],{
    platform:'linux',
    readStat:async () => stat(18),
    readStatus:async () => status(1,1),
  }),/mismatch/);
});

test('024B1: per-incarnation RSS/HWM never joins different processes with recycled PID',()=>{
  const tracker=createLinuxChromiumIdentityTracker();
  const p=(pid,ticks,rss,hwm,type='renderer')=>({
    pid,starttimeTicks:String(ticks),rssBytes:rss,highWaterBytes:hwm,type,
  });
  tracker.observe([p(7,10,400,900),p(8,15,200,300,'browser')],'before-import');
  tracker.observe([p(7,10,600,1000),p(8,15,210,310,'browser')],'during-worker');
  tracker.observe([p(7,11,10,50),p(9,4,250,280,'utility')],'finished');
  const r=tracker.report();
  assert.equal(r.availability,'sampled');
  assert.equal(r.sampleCount,3);
  assert.equal(r.uniqueProcessIdentities,4);
  assert.equal(r.reusedPidObservations,1);
  assert.equal(r.missingIdentityObservations,2);
  assert.equal(r.newIdentityObservations,2);
  assert.deepEqual(r.processes.map(v=>[v.pid,v.starttimeTicks,v.samples,v.maxSampledRssBytes,v.maxObservedLifetimeHwmBytes]),[
    [7,'10',2,600,1000],[7,'11',1,10,50],[8,'15',2,210,310],[9,'4',1,250,280],
  ]);
  assert.equal(r.workerPidMapping,'unknown');
  assert.equal(r.provenExitCount,null);
  assert.equal(r.observedAtLastSnapshotCount,2);
  assert.equal(r.noLongerObservedAtLastSnapshotCount,2);
  assert.deepEqual(r.processes.map(p=>p.observedAtLastSnapshot),[false,true,false,true]);
  assert.match(r.limitations,/not an operation peak/);
  assert.deepEqual(r.milestones.at(-1),{
    phase:'finished',processCount:2,newIdentityObservations:2,
    missingPreviouslyObservedIdentities:2,reusedPidObservations:1,
  });
  assert.throws(()=>tracker.observe([p(7,10,100,50)],'broken'),/invalid/);
});

test('024B1: real /proc-shaped samples reach browser operation report; missing identity stays unavailable',async()=>{
  const lists=[
    [{id:17,type:'renderer'},{id:18,type:'browser'}],
    [{id:17,type:'renderer'},{id:18,type:'browser'}],
    [{id:17,type:'renderer'},{id:18,type:'browser'}],
  ];
  let sample=0;
  const clients={
    page:{async send(method) {
      if(method==='Performance.enable')return {};
      assert.equal(method,'Performance.getMetrics');
      return {metrics:[{name:'JSHeapUsedSize',value:100},{name:'JSHeapTotalSize',value:200}]};
    }},
    process:{async send(method) {
      assert.equal(method,'SystemInfo.getProcessInfo');
      return {processInfo:lists[sample++]};
    }},
  };
  const starttimes=[100,100,101];
  let statusCount=0;
  const sampler=createBrowserRendererHeapSampler(clients.page,{
    processClient:clients.process,
    processRssSampler:async (processes)=>{
      const index=statusCount++;
      return sampleLinuxChromiumRss(processes,{
        platform:'linux',
        readStat:async path=>stat(Number(path.split('/')[2]),String(starttimes[index])),
        readStatus:async path=>status(Number(path.split('/')[2])===17?100:200,250),
      });
    },
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  await sampler.snapshot('worker');
  const result=await sampler.stop();
  assert.equal(result.linuxProcessRss.availability,'sampled');
  assert.equal(result.linuxProcessIdentity.availability,'sampled');
  assert.equal(result.linuxProcessIdentity.sampleCount,3);
  assert.equal(result.linuxProcessIdentity.reusedPidObservations,2);
  assert.equal(result.linuxProcessIdentity.uniqueProcessIdentities,4);
  assert.equal(result.chromiumProcessLifecycle.uniquePidsSeen,2,
    'plain PID membership intentionally cannot detect reuse');
  assert.equal(statusCount,3);
  assert.equal(result.chromiumProcesses.availability,'unavailable',
    'missing CDP privateMemory cannot block Linux identity');
});

test('024B1: invalid identity never silently turns sampled RSS into a verified identity',async()=>{
  let calls=0;
  const page={async send(m) {
    if(m==='Performance.enable')return {};
    return {metrics:[{name:'JSHeapUsedSize',value:1},{name:'JSHeapTotalSize',value:2}]};
  }};
  const sampler=createBrowserRendererHeapSampler(page,{
    processClient:{async send(){return {processInfo:[{id:17,type:'browser'}]};}},
    processRssSampler:async()=>{calls++;return {supported:true,processCount:1,aggregateRssBytes:100,largestProcessHighWaterBytes:100};},
    schedule:()=>1,unschedule:()=>{},
  });
  await sampler.start();
  const report=await sampler.stop();
  assert.equal(calls,2);
  assert.equal(report.linuxProcessRss.availability,'sampled');
  assert.equal(report.linuxProcessIdentity.availability,'unavailable');
  assert.match(report.linuxProcessIdentity.unavailableReason,/invalid process snapshot/);
  assert.equal(report.linuxProcessIdentity.sampleCount,0);
});


test('024B2a: reappearing incarnation is observed again, not falsely counted as an exit',()=>{
  const tracker=createLinuxChromiumIdentityTracker();
  const p=(pid,starttimeTicks)=>({pid,starttimeTicks,rssBytes:100,highWaterBytes:150,type:'renderer'});
  tracker.observe([p(3,'99'),p(4,'50')],'start');
  tracker.observe([p(4,'50')],'gap');
  const gap=tracker.report();
  assert.equal(gap.noLongerObservedAtLastSnapshotCount,1);
  assert.equal(gap.provenExitCount,null);
  assert.deepEqual(gap.processes.map(process=>process.observedAtLastSnapshot),[false,true]);
  tracker.observe([p(3,'99'),p(4,'50')],'reappeared');
  const final=tracker.report();
  assert.equal(final.noLongerObservedAtLastSnapshotCount,0);
  assert.equal(final.provenExitCount,null);
  assert.equal(final.reusedPidObservations,0);
  assert.equal(final.processes.find(process=>process.pid===3).samples,2);
  assert.equal(final.missingIdentityObservations,1);
});

test('027 / 024C2: absent /proc snapshot breaks identity adjacency without erasing incarnation evidence', () => {
  const tracker=createLinuxChromiumIdentityTracker();
  const p=(pid,ticks)=>({pid,starttimeTicks:String(ticks),rssBytes:100,highWaterBytes:150});
  tracker.observe([p(7,100),p(8,200)],'before-import');
  tracker.noteMissingSnapshot();
  let r=tracker.report();
  assert.equal(r.lastSnapshotObserved,false);
  assert.equal(r.observedAtLastSnapshotCount,null);
  assert.equal(r.noLongerObservedAtLastSnapshotCount,null);
  assert.deepEqual(r.processes.map(x=>x.observedAtLastSnapshot),[null,null]);
  tracker.observe([p(7,100),p(9,300)],'retry-completed');
  r=tracker.report();
  assert.equal(r.newIdentityObservations,0,'no arrival inferred across an observation gap');
  assert.equal(r.missingIdentityObservations,0,'no departure inferred across an observation gap');
  assert.equal(r.uniqueProcessIdentities,3);
  assert.equal(r.observedAtLastSnapshotCount,2);
  assert.equal(r.noLongerObservedAtLastSnapshotCount,1);
  tracker.noteMissingSnapshot();
  tracker.observe([p(7,101)],'finished');
  r=tracker.report();
  assert.equal(r.reusedPidObservations,1,'changed starttime proves a distinct observed incarnation');
  assert.equal(r.newIdentityObservations,0);
  assert.equal(r.missingIdentityObservations,0);
  assert.equal(r.provenExitCount,null);
  assert.equal(r.workerPidMapping,'unknown');
});
