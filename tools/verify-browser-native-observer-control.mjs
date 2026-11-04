import {verifyNativeObserverControl} from './browser-native-observer-control.mjs';
const [controlDir,controlNativeDir,treatmentDir,treatmentNativeDir]=process.argv.slice(2);
verifyNativeObserverControl(controlDir,controlNativeDir,treatmentDir,treatmentNativeDir).then(
  ()=>console.log('003T/4b independent PSD16/PSB32 observer-only controls PASS (no leak/peak claim)'),
  error=>{console.error(error.stack||String(error));process.exitCode=1;});
