import { verifyBrowserDenseNearCapEvidence } from './browser-dense-near-cap-evidence.mjs';

try {
  await verifyBrowserDenseNearCapEvidence(process.env.ZPE_BROWSER_DENSE_NEAR_CAP_ARTIFACT_DIR);
  console.log('003W/2b-2b dense PSD16/PSB32 real Chromium receipts verified');
} catch(error) {
  console.error(error.stack||error.message||error);
  process.exitCode=1;
}
