import {verifyReplicatedNativeSessions} from './browser-native-retention-replication.mjs';
const [root]=process.argv.slice(2);
verifyReplicatedNativeSessions(root).then(
  summary=>console.log('003T/4b-2 genuine fresh matched PSD16/PSB32 replica PASS',JSON.stringify(summary)),
  error=>{console.error(error.stack||String(error));process.exitCode=1;});
