import {verifyBrowserOperationArtifacts} from './browser-operation-artifact.mjs';
import {verifyWideConnectedBrowserArtifacts} from './browser-wide-connected-operation-artifact.mjs';

try {
  const directory=process.env.ZPE_BROWSER_OPERATION_ARTIFACT_DIR;
  const files=await verifyBrowserOperationArtifacts(directory);
  const wideFiles=await verifyWideConnectedBrowserArtifacts(directory);
  console.log('Chromium file:// JSON reports verified:',[...files,...wideFiles].join(', '));
} catch(error) {
  console.error(error.stack || error.message || error);
  process.exitCode=1;
}
