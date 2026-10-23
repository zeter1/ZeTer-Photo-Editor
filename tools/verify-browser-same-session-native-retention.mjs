import {verifySameSessionNativeRetention} from './browser-same-session-native-retention.mjs';
const [directory,nativeDirectory]=process.argv.slice(2);
verifySameSessionNativeRetention(directory,nativeDirectory).then(
  ()=>console.log('003T/4 independent PSD16 and PSB32 same-session RSS evidence PASS'),
  error=>{console.error(error.stack||String(error));process.exitCode=1;});
