import { verifyBrowserDenseCancelEvidence } from './browser-dense-cancel-evidence.mjs';

try {
  await verifyBrowserDenseCancelEvidence(process.env.ZPE_BROWSER_DENSE_CANCEL_ARTIFACT_DIR);
  console.log('003W/2b-2c real Chromium dense cancellation PSD16/PSB32 receipts verified');
} catch(error) {
  console.error(error.stack||error.message||error);
  process.exitCode=1;
}
