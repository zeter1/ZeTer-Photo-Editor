// 003T/3a: real Chromium file:// Worker CPU control. Observed overlapping
// PID jiffies are not whole-operation CPU or Worker PID attribution.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {findChrome,devtoolsUrl} from './browser-worker-control-smoke.mjs';
import {connectCdp,evaluate,until} from './browser-chromium-cgroup-control.mjs';
import {collectLinuxCpuCensus,compareLinuxCpuCensuses,
  validateLinuxCpuEvidence} from './browser-linux-cpu-observation.mjs';

const check=(ok,message)=>{if(!ok)throw new Error('003T CPU control: '+message);};

async function readCensus(browserClient) {
  const result=await browserClient.send('SystemInfo.getProcessInfo');
  check(Array.isArray(result?.processInfo) && result.processInfo.length>0,
    'CDP process census unavailable');
  return collectLinuxCpuCensus(result.processInfo);
}

export async function runChromiumCpuControl() {
  check(process.platform==='linux','real Linux /proc required');
  const dir=await mkdtemp(path.join(tmpdir(),'zpe-003t-cpu-'));
  let browser=null,page=null,browserClient=null;
  try {
    const file=path.join(dir,'cpu-control.html');
    await writeFile(file,'<!doctype html><meta charset="utf-8"><title>CPU control</title>');
    const href=pathToFileURL(file).href;
    browser=spawn(findChrome(),[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--disable-background-networking','--no-first-run','--no-default-browser-check',
      '--no-extensions','--remote-debugging-port=0',
      '--user-data-dir='+path.join(dir,'profile'),href,
    ],{stdio:['ignore','ignore','pipe']});
    check(Number.isSafeInteger(browser.pid) && browser.pid>0,'Chromium not started');
    const ws=await devtoolsUrl(browser);
    browserClient=await connectCdp(ws);
    const root=new URL(ws),origin='http://'+root.hostname+':'+root.port;
    let target=null;
    await until('file:// CPU control',async()=>{
      const response=await fetch(origin+'/json/list');
      const list=await response.json();
      target=list.find(item=>item.type==='page' && item.url===href &&
        item.webSocketDebuggerUrl);
      return Boolean(target);
    });
    page=await connectCdp(target.webSocketDebuggerUrl);
    await page.send('Runtime.enable');
    await until('CPU control page loaded',()=>
      evaluate(page,'document.readyState==="complete"'));

    const before=await readCensus(browserClient);
    const code="(() => { window.__zpeCpuControl={done:false,checksum:null};"+
      "const script='let sum=0;for(let i=0;i<16000000;i++)sum=(sum+i)%1000003;self.postMessage(sum);';"+
      "const url=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));"+
      "const worker=new Worker(url);window.__zpeCpuControl.worker=worker;"+
      "window.__zpeCpuControl.url=url;worker.onmessage=event=>{"+
      "window.__zpeCpuControl.checksum=event.data;window.__zpeCpuControl.done=true};"+
      "return true; })()";
    check(await evaluate(page,code)===true,'CPU Worker dispatch failed');
    await until('real CPU Worker acknowledgement',()=>
      evaluate(page,'window.__zpeCpuControl?.done===true'));
    const checksum=await evaluate(page,'window.__zpeCpuControl.checksum');
    check(Number.isInteger(checksum) && checksum>=0 && checksum<1000003,
      'CPU Worker result invalid');
    const after=await readCensus(browserClient);
    await evaluate(page,'(() => {window.__zpeCpuControl.worker.terminate();URL.revokeObjectURL(window.__zpeCpuControl.url);return true})()');

    const report={
      kind:'zpe-chromium-overlapping-cpu-ticks-v1',
      origin:'real Chromium file:// temporary Worker CPU control',
      workerAcknowledged:true,before,after,
      comparison:compareLinuxCpuCensuses(before,after),
      limitations:'Observed /proc user/system jiffies for matching CDP PIDs, not operation CPU or operation peak. Sequential Linux reads have blind windows; short-lived processes and PID reuse are excluded. No documented CDP target to OS join, not Worker PID attribution.',
    };
    validateLinuxCpuEvidence(report);
    return report;
  } finally {
    page?.close();browserClient?.close();
    if(browser && browser.exitCode===null && browser.signalCode===null)
      browser.kill('SIGTERM');
    await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100});
  }
}

async function main() {
  if(process.argv[2]==='--verify') {
    check(process.argv.length===4,'usage: --verify FILE');
    validateLinuxCpuEvidence(JSON.parse(await readFile(process.argv[3],'utf8')));
    console.log('003T real Chromium CPU receipt validator PASS');
    return;
  }
  check(process.argv.length===3,'usage: script ARTIFACT.json');
  const report=await runChromiumCpuControl();
  await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('003T real Chromium CPU ticks: '+report.comparison.availability+
    '; true operation CPU/peak and Worker PID unknown');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
