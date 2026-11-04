import { verifyBrowserDenseOwnerEvidence } from './browser-dense-owner-evidence.mjs';
try {
  await verifyBrowserDenseOwnerEvidence(process.env.ZPE_BROWSER_DENSE_OWNER_ARTIFACT_DIR);
  console.log('003W/2b-2d PSD16/PSB32 real two-document Worker receipts verified');
} catch(error) {
  console.error(error.stack||error.message||error);
  process.exitCode=1;
}
