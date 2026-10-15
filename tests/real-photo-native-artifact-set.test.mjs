import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const manifest=JSON.parse(readFileSync('tests/fixtures/real-photo/reviewed-manifest.json','utf8'));
const python=process.env.PYTHON || 'python3';
const cli='tools/verify-photo-native-artifact-set.py';
const hasPython=spawnSync(python,['--version'],{encoding:'utf8'}).status===0;
const baseEvidence=()=>({
  kind:'zpe-photo-defect-psd-psb-codec-evidence-v1',
  status:'zpe-codec-native-roundtrip-only',
  originalSha256:manifest.sourceSha256,
  decodedRgbaSha256:manifest.decoded.sha256,
  sourcePrecisionBits:8,selectedPixels:8288,
  photoshopParityVerified:false,browserBenchmarkVerified:false,
  documents:{
    psd16:{format:'PSD16',fileSha256:'0'.repeat(64),
      nativeDefectSha256:manifest.native.rgb16.damagedSha256,
      selectedPixels:8288,nativeLayerAndCompositeExact:true,
      unchangedOutsideSelectionAndAlpha:true},
    psb32:{format:'PSB32',fileSha256:'0'.repeat(64),
      nativeDefectSha256:manifest.native.float32.damagedSha256,
      selectedPixels:8288,nativeLayerAndCompositeExact:true,
      unchangedOutsideSelectionAndAlpha:true},
  },
});

test('037B2b-3 rejects fake source/ROI claims and symlinked native artifact before readback',t=>{
  if(!hasPython) return t.skip('Python required by external photo intake CI');
  const dir=mkdtempSync(join(tmpdir(),'zpe-native-receipt-'));
  const manifestFile=join(dir,'reviewed.json'), evidenceFile=join(dir,'codec-evidence.json');
  const run=()=>spawnSync(python,[cli,manifestFile,dir],{encoding:'utf8'});
  const save=evidence=>writeFileSync(evidenceFile,JSON.stringify(evidence));
  try {
    writeFileSync(manifestFile,JSON.stringify(manifest));
    const forgedSource=baseEvidence();forgedSource.originalSha256='f'.repeat(64);
    save(forgedSource);
    assert.match(run().stderr,/saved source\/decoder digests/);

    const forgedRoi=baseEvidence();forgedRoi.selectedPixels=8287;
    save(forgedRoi);
    assert.match(run().stderr,/unsupported source depth, ROI or parity/);

    const forgedAdobe=baseEvidence();forgedAdobe.photoshopParityVerified=true;
    save(forgedAdobe);
    assert.match(run().stderr,/unsupported source depth, ROI or parity/);

    const valid=baseEvidence();save(valid);
    symlinkSync(evidenceFile,join(dir,'psd16-defect.psd'));
    assert.match(run().stderr,/symlinked or oversized psd16-defect.psd/);

    // Neither preflight rejection nor a tampered source may publish a receipt.
    assert.equal(existsSync(join(dir,'independent-native-readback.json')),false);
  } finally {
    rmSync(dir,{force:true,recursive:true});
  }
});

