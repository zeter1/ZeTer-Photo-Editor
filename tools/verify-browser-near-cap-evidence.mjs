import { verifyBrowserNearCapEvidence } from './browser-near-cap-evidence.mjs';

try {
  const dir=process.env.ZPE_BROWSER_NEAR_CAP_ARTIFACT_DIR;
  await verifyBrowserNearCapEvidence(dir);
  console.log('003W/2b-2a real Chromium near-cap PSD16/PSB32 receipts verified');
} catch(error) {
  console.error(error.stack||error.message||error);
  process.exitCode=1;
}
