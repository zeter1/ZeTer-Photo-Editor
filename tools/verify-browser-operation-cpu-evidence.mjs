import {verifyOperationCpuEvidence} from './browser-operation-cpu-evidence.mjs';

verifyOperationCpuEvidence(process.env.ZPE_OPERATION_CPU_ARTIFACT_DIR,
  process.env.ZPE_BROWSER_DENSE_CANCEL_ARTIFACT_DIR)
  .then(()=>console.log('003T/3b independent real PSD16+PSB32 CPU boundary receipts PASS'))
  .catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
