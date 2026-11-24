import {verifyOperationCpuRssCoverage} from './browser-operation-cpu-rss-coverage.mjs';
import {writeVerifiedPidChurnReceipts} from './browser-operation-pid-churn.mjs';

await verifyOperationCpuRssCoverage(
  process.env.ZPE_OPERATION_CPU_RSS_ARTIFACT_DIR,
  process.env.ZPE_OPERATION_CPU_ARTIFACT_DIR,
  process.env.ZPE_BROWSER_DENSE_CANCEL_ARTIFACT_DIR,
);
await writeVerifiedPidChurnReceipts(
  process.env.ZPE_OPERATION_CPU_RSS_ARTIFACT_DIR,
  process.env.ZPE_OPERATION_CPU_ARTIFACT_DIR,
);
console.log('003T/3c independent real PSD16+PSB32 CPU/RSS coverage and 003T/3d sampled PID churn receipts PASS');
