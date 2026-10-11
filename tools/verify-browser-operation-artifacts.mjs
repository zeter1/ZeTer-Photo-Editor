import {verifyBrowserOperationArtifacts} from './browser-operation-artifact.mjs';

try {
  const files=await verifyBrowserOperationArtifacts(process.env.ZPE_BROWSER_OPERATION_ARTIFACT_DIR);
  console.log('024B2a Chromium file:// JSON reports verified:',files.join(', '));
} catch(error) {
  console.error(error.stack || error.message || error);
  process.exitCode=1;
}
